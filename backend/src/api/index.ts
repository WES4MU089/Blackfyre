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
import { housesRouter } from './routes/houses.js';
import { applicationsRouter } from './routes/applications.js';
import { staffApplicationsRouter } from './routes/staff-applications.js';
import { notificationsRouter } from './routes/notifications.js';
import { tosRouter } from './routes/tos.js';
import { clientRouter } from './routes/client.js';
import { organizationsRouter } from './routes/organizations.js';
import { staffOrganizationsRouter } from './routes/staff-organizations.js';
import { factionsRouter } from './routes/factions.js';
import { staffFactionsRouter } from './routes/staff-factions.js';
import { familyTreeRouter } from './routes/family-tree.js';
import { staffFamilyTreeRouter } from './routes/staff-family-tree.js';
import { staffAuditLogRouter } from './routes/staff-audit-log.js';
import { staffCombatLogRouter } from './routes/staff-combat-log.js';
import { staffChatLogRouter } from './routes/staff-chat-log.js';
import { codexRouter } from './routes/codex.js';
import { sysadminRouter } from './routes/sysadmin.js';

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
      '/api/houses',
      '/api/applications',
      '/api/staff/applications',
      '/api/notifications',
      '/api/tos',
      '/api/client',
      '/api/organizations',
      '/api/factions',
      '/api/family-tree',
      '/api/staff/organizations',
      '/api/staff/factions',
      '/api/staff/family-tree',
      '/api/staff/audit-log',
      '/api/staff/combat-log',
      '/api/staff/chat-log',
      '/api/codex',
      '/api/sysadmin',
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
apiRouter.use('/houses', housesRouter);
apiRouter.use('/applications', applicationsRouter);
apiRouter.use('/staff/applications', staffApplicationsRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/tos', tosRouter);
apiRouter.use('/client', clientRouter);
apiRouter.use('/organizations', organizationsRouter);
apiRouter.use('/factions', factionsRouter);
apiRouter.use('/family-tree', familyTreeRouter);
apiRouter.use('/staff/organizations', staffOrganizationsRouter);
apiRouter.use('/staff/factions', staffFactionsRouter);
apiRouter.use('/staff/family-tree', staffFamilyTreeRouter);
apiRouter.use('/staff/audit-log', staffAuditLogRouter);
apiRouter.use('/staff/combat-log', staffCombatLogRouter);
apiRouter.use('/staff/chat-log', staffChatLogRouter);
apiRouter.use('/codex', codexRouter);
apiRouter.use('/sysadmin', sysadminRouter);
