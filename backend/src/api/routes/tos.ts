import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db/connection.js';
import { logger } from '../../utils/logger.js';
import { requireAuth } from '../middleware/auth.js';
import { TOS_VERSION, TOS_LAST_UPDATED, TOS_CONTENT } from '../../legal/tos.js';
import { PRIVACY_VERSION, PRIVACY_LAST_UPDATED, PRIVACY_CONTENT } from '../../legal/privacy.js';

export const tosRouter = Router();

// Get current TOS and Privacy Policy documents
tosRouter.get('/documents', (_req: Request, res: Response) => {
  res.json({
    tos: {
      version: TOS_VERSION,
      content: TOS_CONTENT,
      lastUpdated: TOS_LAST_UPDATED,
    },
    privacy: {
      version: PRIVACY_VERSION,
      content: PRIVACY_CONTENT,
      lastUpdated: PRIVACY_LAST_UPDATED,
    },
  });
});

// Check if the authenticated user has accepted the current TOS + Privacy versions
tosRouter.get('/status', requireAuth(), async (req: Request, res: Response) => {
  try {
    const acceptance = await db.queryOne<{
      accepted_at: string;
    }>(
      `SELECT accepted_at FROM tos_acceptances
       WHERE player_id = ? AND tos_version = ? AND privacy_version = ?`,
      [req.player!.id, TOS_VERSION, PRIVACY_VERSION]
    );

    res.json({
      tosAccepted: !!acceptance,
      currentTosVersion: TOS_VERSION,
      currentPrivacyVersion: PRIVACY_VERSION,
      acceptedAt: acceptance?.accepted_at ?? null,
    });
  } catch (err) {
    logger.error('Failed to check TOS status:', err);
    res.status(500).json({ error: 'Failed to check TOS status' });
  }
});

const acceptSchema = z.object({
  tosVersion: z.string(),
  privacyVersion: z.string(),
});

// Record TOS + Privacy acceptance
tosRouter.post('/accept', requireAuth(), async (req: Request, res: Response) => {
  const parsed = acceptSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation error', details: parsed.error.issues });
  }

  const { tosVersion, privacyVersion } = parsed.data;

  if (tosVersion !== TOS_VERSION || privacyVersion !== PRIVACY_VERSION) {
    return res.status(400).json({ error: 'Version mismatch — please reload and accept the current terms' });
  }

  try {
    await db.execute(
      `INSERT INTO tos_acceptances (player_id, tos_version, privacy_version)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE accepted_at = NOW()`,
      [req.player!.id, tosVersion, privacyVersion]
    );

    logger.info(`Player ${req.player!.id} accepted TOS v${tosVersion} / Privacy v${privacyVersion}`);

    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to record TOS acceptance:', err);
    res.status(500).json({ error: 'Failed to record acceptance' });
  }
});
