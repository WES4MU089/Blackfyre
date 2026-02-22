import { Router, Request, Response } from 'express';

export const clientRouter = Router();

/**
 * Returns latest client version info.
 * electron-updater handles the actual update mechanism via GitHub Releases,
 * but this endpoint lets the launcher display version info and release notes.
 */
clientRouter.get('/version', (_req: Request, res: Response) => {
  res.json({
    latestVersion: process.env.CLIENT_VERSION || '1.0.0',
    releaseNotes: process.env.CLIENT_RELEASE_NOTES || '',
    isRequired: false,
  });
});
