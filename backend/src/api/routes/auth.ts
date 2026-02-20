import { Router, Request, Response } from 'express';
import { config } from '../../config/index.js';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';
import crypto from 'crypto';

export const authRouter = Router();

const DISCORD_API = 'https://discord.com/api/v10';

// Generate Discord OAuth2 URL and redirect
authRouter.get('/discord', (_req: Request, res: Response) => {
  const { clientId, redirectUri } = config.discord;

  if (!clientId) {
    return res.status(500).json({ error: 'Discord OAuth not configured' });
  }

  const state = crypto.randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify email',
    state,
  });

  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

// Handle Discord OAuth2 callback
authRouter.get('/discord/callback', async (req: Request, res: Response) => {
  const { code } = req.query;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.discord.clientId,
        client_secret: config.discord.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.discord.redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      logger.error('Discord token exchange failed:', await tokenRes.text());
      return res.status(401).json({ error: 'Failed to authenticate with Discord' });
    }

    const tokenData = await tokenRes.json() as {
      access_token: string;
      token_type: string;
      refresh_token: string;
      expires_in: number;
    };

    // Fetch Discord user info
    const userRes = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `${tokenData.token_type} ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      return res.status(401).json({ error: 'Failed to fetch Discord user' });
    }

    const discordUser = await userRes.json() as {
      id: string;
      username: string;
      discriminator?: string;
      email?: string;
      avatar?: string;
    };

    // Find or create user in database (PascalCase `user` table)
    let user = await db.queryOne<{ Id: number; DiscordId: string; DiscordUsername: string }>(
      'SELECT Id, DiscordId, DiscordUsername FROM user WHERE DiscordId = ?',
      [discordUser.id]
    );

    const tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    if (!user) {
      // Create new user
      const id = await db.insert(
        `INSERT INTO user (DiscordId, DiscordUsername, DiscordDiscriminator, DiscordEmail, DiscordAvatarHash, DiscordAccessToken, DiscordRefreshToken, DiscordTokenExpiresAt, LastLoginAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          discordUser.id,
          discordUser.username,
          discordUser.discriminator || null,
          discordUser.email || null,
          discordUser.avatar || null,
          tokenData.access_token,
          tokenData.refresh_token,
          tokenExpiresAt,
        ]
      );
      user = { Id: id, DiscordId: discordUser.id, DiscordUsername: discordUser.username };
      logger.info(`New user created via Discord: ${discordUser.username} (${id})`);
    } else {
      // Update existing user
      await db.execute(
        `UPDATE user SET
          DiscordUsername = ?,
          DiscordDiscriminator = ?,
          DiscordEmail = ?,
          DiscordAvatarHash = ?,
          DiscordAccessToken = ?,
          DiscordRefreshToken = ?,
          DiscordTokenExpiresAt = ?,
          LastLoginAt = NOW()
        WHERE Id = ?`,
        [
          discordUser.username,
          discordUser.discriminator || null,
          discordUser.email || null,
          discordUser.avatar || null,
          tokenData.access_token,
          tokenData.refresh_token,
          tokenExpiresAt,
          user.Id,
        ]
      );
      logger.info(`User logged in via Discord: ${discordUser.username} (${user.Id})`);
    }

    // Generate JWT token
    const jwt = generateJWT({
      userId: user.Id,
      discordId: discordUser.id,
      discordUsername: discordUser.username,
    });

    // Redirect to Electron app via custom protocol
    res.redirect(`blackfyre://auth?token=${jwt}`);
  } catch (err) {
    logger.error('Discord OAuth callback error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Validate JWT and return user info
authRouter.get('/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.slice(7);
  const payload = verifyJWT(token);

  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const user = await db.queryOne(
    `SELECT Id, DiscordId, DiscordUsername, DiscordEmail, DiscordAvatarHash, IsBanned, CreatedAt, LastLoginAt
     FROM user WHERE Id = ? AND IsDeleted = 0`,
    [payload.userId]
  );

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ user });
});

// --- JWT Helpers ---

interface JWTPayload {
  userId: number;
  discordId: string;
  discordUsername: string;
  iat: number;
  exp: number;
}

function generateJWT(data: Omit<JWTPayload, 'iat' | 'exp'>): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const expiresInSeconds = parseExpiry(config.jwt.expiresIn);

  const payload: JWTPayload = {
    ...data,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', config.jwt.secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  return `${headerB64}.${payloadB64}.${signature}`;
}

export function verifyJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', config.jwt.secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    if (signature !== expectedSig) return null;

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as JWTPayload;

    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

function base64url(str: string): string {
  return Buffer.from(str).toString('base64url');
}

function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)(h|d|m|s)$/);
  if (!match) return 86400; // Default 24h
  const [, num, unit] = match;
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return parseInt(num) * (multipliers[unit] || 3600);
}
