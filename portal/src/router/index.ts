import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory('/portal/'),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/Home.vue'),
    },

    // --- Public Social Viewer ---
    {
      path: '/social/regions',
      name: 'regions',
      component: () => import('@/views/social/RegionList.vue'),
    },
    {
      path: '/social/regions/:id',
      name: 'region',
      component: () => import('@/views/social/RegionPage.vue'),
    },
    {
      path: '/social/houses/:id',
      name: 'house',
      component: () => import('@/views/social/HousePage.vue'),
    },
    {
      path: '/social/characters/:id',
      name: 'character',
      component: () => import('@/views/social/CharacterPage.vue'),
    },

    // --- Codex ---
    {
      path: '/codex',
      name: 'codex',
      component: () => import('@/views/codex/CodexIndex.vue'),
    },
    {
      path: '/codex/:categorySlug',
      name: 'codex-category',
      component: () => import('@/views/codex/CodexCategory.vue'),
    },
    {
      path: '/codex/:categorySlug/:entrySlug',
      name: 'codex-entry',
      component: () => import('@/views/codex/CodexEntry.vue'),
    },

    // --- Player (auth required) ---
    {
      path: '/my/applications',
      name: 'my-applications',
      component: () => import('@/views/player/MyApplications.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/my/applications/new',
      name: 'new-application',
      component: () => import('@/views/player/NewApplication.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/my/applications/:id',
      name: 'my-application-detail',
      component: () => import('@/views/player/ApplicationDetail.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/my/profile',
      name: 'my-profile',
      component: () => import('@/views/player/Profile.vue'),
      meta: { requiresAuth: true },
    },

    // --- Staff (permission required) ---
    {
      path: '/staff/applications',
      name: 'staff-applications',
      component: () => import('@/views/staff/AppQueue.vue'),
      meta: { requiresAuth: true, permission: 'applications.view_queue' },
    },
    {
      path: '/staff/applications/:id',
      name: 'staff-application-review',
      component: () => import('@/views/staff/AppReview.vue'),
      meta: { requiresAuth: true, permission: 'applications.review' },
    },
    {
      path: '/staff/family-trees',
      name: 'staff-family-trees',
      component: () => import('@/views/staff/FamilyTreePending.vue'),
      meta: { requiresAuth: true, permission: 'family_tree.approve_suggestions' },
    },

    // --- System Admin (super admin only) ---
    {
      path: '/sysadmin/roles',
      name: 'sysadmin-roles',
      component: () => import('@/views/sysadmin/RoleList.vue'),
      meta: { requiresAuth: true, requiresSuperAdmin: true },
    },
    {
      path: '/sysadmin/roles/:id',
      name: 'sysadmin-role-editor',
      component: () => import('@/views/sysadmin/RoleEditor.vue'),
      meta: { requiresAuth: true, requiresSuperAdmin: true },
    },
    {
      path: '/sysadmin/players',
      name: 'sysadmin-players',
      component: () => import('@/views/sysadmin/PlayerManager.vue'),
      meta: { requiresAuth: true, requiresSuperAdmin: true },
    },
    {
      path: '/sysadmin/audit-log',
      name: 'sysadmin-audit-log',
      component: () => import('@/views/sysadmin/AuditLog.vue'),
      meta: { requiresAuth: true, requiresSuperAdmin: true },
    },
    {
      path: '/sysadmin/database',
      name: 'sysadmin-database',
      component: () => import('@/views/sysadmin/SchemaViewer.vue'),
      meta: { requiresAuth: true, requiresSuperAdmin: true, permission: 'system.database_access' },
    },
    {
      path: '/sysadmin/database/migrations',
      name: 'sysadmin-migrations',
      component: () => import('@/views/sysadmin/MigrationRunner.vue'),
      meta: { requiresAuth: true, requiresSuperAdmin: true, permission: 'system.database_access' },
    },
    {
      path: '/sysadmin/database/query',
      name: 'sysadmin-query',
      component: () => import('@/views/sysadmin/QueryConsole.vue'),
      meta: { requiresAuth: true, requiresSuperAdmin: true, permission: 'system.database_access' },
    },

    // --- Gauntlet (campaign maps) ---
    {
      path: '/gauntlet',
      name: 'gauntlet-index',
      component: () => import('@/views/gauntlet/GauntletIndex.vue'),
      meta: { requiresAuth: true, permission: 'content.manage_gauntlet' },
    },
    {
      path: '/gauntlet/:id/edit',
      name: 'gauntlet-map-editor',
      component: () => import('@/views/gauntlet/GauntletMapEditor.vue'),
      meta: { requiresAuth: true, permission: 'content.manage_gauntlet' },
    },
    {
      path: '/gauntlet/:id/test',
      name: 'gauntlet-map-tester',
      component: () => import('@/views/gauntlet/GauntletMapTester.vue'),
      meta: { requiresAuth: true, permission: 'content.manage_gauntlet' },
    },

    // --- Logs (staff) ---
    {
      path: '/logs/combat',
      name: 'combat-log',
      component: () => import('@/views/logs/CombatLogIndex.vue'),
      meta: { requiresAuth: true, requiresSuperAdmin: true },
    },
    {
      path: '/logs/combat/duels/:duelId',
      name: 'duel-detail',
      component: () => import('@/views/logs/DuelDetail.vue'),
      meta: { requiresAuth: true, requiresSuperAdmin: true },
    },
    {
      path: '/logs/combat/:sessionId',
      name: 'combat-session-detail',
      component: () => import('@/views/logs/CombatSessionDetail.vue'),
      meta: { requiresAuth: true, requiresSuperAdmin: true },
    },
    {
      path: '/logs/chat',
      name: 'chat-log',
      component: () => import('@/views/logs/ChatLogIndex.vue'),
      meta: { requiresAuth: true, requiresSuperAdmin: true },
    },
    {
      path: '/logs/chat/:date',
      name: 'chat-log-day',
      component: () => import('@/views/logs/ChatLogDay.vue'),
      meta: { requiresAuth: true, requiresSuperAdmin: true },
    },

    // Catch-all
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

export default router
