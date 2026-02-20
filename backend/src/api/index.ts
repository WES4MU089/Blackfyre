import { Router, Request, Response } from 'express';
import { playersRouter } from './routes/players.js';
import { charactersRouter } from './routes/characters.js';
import { vitalsRouter } from './routes/vitals.js';
import { inventoryRouter } from './routes/inventory.js';
import { financesRouter } from './routes/finances.js';
import { jobsRouter } from './routes/jobs.js';
import { authRouter } from './routes/auth.js';
import { chatRouter } from './routes/chat.js';
import { aptitudesRouter } from './routes/aptitudes.js';
import { equipmentRouter } from './routes/equipment.js';
import { combatRouter } from './routes/combat.js';
import { npcRouter } from './routes/npc.js';
import { retainersRouter } from './routes/retainers.js';
import { ailmentsRouter } from './routes/ailments.js';
import { craftingRouter } from './routes/crafting.js';
import { shopRouter } from './routes/shop.js';

export const apiRouter = Router();

// API Info
apiRouter.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Blackfyre HUD API',
    version: '1.0.0',
    endpoints: [
      '/api/auth',
      '/api/players',
      '/api/characters',
      '/api/vitals',
      '/api/inventory',
      '/api/finances',
      '/api/jobs',
      '/api/chat',
      '/api/aptitudes',
      '/api/equipment',
      '/api/combat',
      '/api/npc',
      '/api/retainers',
      '/api/ailments',
      '/api/crafting',
      '/api/shop',
    ],
  });
});

// Mount route handlers
apiRouter.use('/auth', authRouter);
apiRouter.use('/players', playersRouter);
apiRouter.use('/characters', charactersRouter);
apiRouter.use('/vitals', vitalsRouter);
apiRouter.use('/inventory', inventoryRouter);
apiRouter.use('/finances', financesRouter);
apiRouter.use('/jobs', jobsRouter);
apiRouter.use('/chat', chatRouter);
apiRouter.use('/aptitudes', aptitudesRouter);
apiRouter.use('/equipment', equipmentRouter);
apiRouter.use('/combat', combatRouter);
apiRouter.use('/npc', npcRouter);
apiRouter.use('/retainers', retainersRouter);
apiRouter.use('/ailments', ailmentsRouter);
apiRouter.use('/crafting', craftingRouter);
apiRouter.use('/shop', shopRouter);
