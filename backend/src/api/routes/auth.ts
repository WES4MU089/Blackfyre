import { Router, Request, Response } from 'express';
import { config } from '../../config/index.js';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';
import { getPlayerPermissions } from '../../utils/permissions.js';
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
    scope: 'identify',
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
      avatar?: string;
    };

    // Find or create player in database
    let player = await db.queryOne<{ id: number; discord_id: string; discord_username: string }>(
      'SELECT id, discord_id, discord_username FROM players WHERE discord_id = ?',
      [discordUser.id]
    );

    if (!player) {
      // Create new player
      const id = await db.insert(
        `INSERT INTO players (discord_id, discord_username, sl_name)
         VALUES (?, ?, ?)`,
        [
          discordUser.id,
          discordUser.username,
          discordUser.username,
        ]
      );
      player = { id, discord_id: discordUser.id, discord_username: discordUser.username };
      logger.info(`New player created via Discord: ${discordUser.username} (${id})`);
    } else {
      // Update existing player
      await db.execute(
        `UPDATE players SET
          discord_username = ?,
          last_seen = NOW()
        WHERE id = ?`,
        [
          discordUser.username,
          player.id,
        ]
      );
      logger.info(`Player logged in via Discord: ${discordUser.username} (${player.id})`);
    }

    // Generate JWT token
    const jwt = generateJWT({
      userId: player.id,
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

  const player = await db.queryOne<{
    id: number;
    discord_id: string;
    discord_username: string;
    is_banned: boolean;
    created_at: string;
    last_seen: string;
    role_id: number | null;
    is_super_admin: boolean;
  }>(
    `SELECT id, discord_id, discord_username, is_banned, created_at, last_seen,
            role_id, is_super_admin
     FROM players WHERE id = ? AND is_active = 1`,
    [payload.userId]
  );

  if (!player) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Load role name and permissions
  let roleName: string | null = null;
  if (player.role_id) {
    const role = await db.queryOne<{ name: string }>(
      `SELECT name FROM roles WHERE id = ?`,
      [player.role_id]
    );
    roleName = role?.name ?? null;
  }

  const permissions = await getPlayerPermissions(player.id);

  res.json({
    user: {
      ...player,
      roleName,
      permissions: Array.from(permissions),
      isSuperAdmin: !!player.is_super_admin,
    },
  });
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
