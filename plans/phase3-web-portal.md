# Phase 3: Web Portal — Public Site + Staff Admin

## Goal

Build a standalone Vue 3 SPA (no Electron) served by Express at `/portal`.
Shares the same dark medieval fantasy theme as the HUD, same backend API,
same JWT auth via Discord OAuth.

Three audiences:
1. **Public / Logged-out** — Social Viewer (Regions, Houses, Characters), Codex
2. **Logged-in Players** — My Applications, application detail, profile editing
3. **Staff / Super Admin** — Application review, role manager, player list, DB console

---

## Architecture

### Separate Vite project at `portal/`

```
d:\Blackfyre\portal\
├── package.json          # Vue 3 + Vite (no Electron)
├── vite.config.ts        # Build to portal/dist/
├── tsconfig.json
├── index.html
└── src/
    ├── main.ts
    ├── App.vue
    ├── router/index.ts   # Vue Router (history mode, base '/portal')
    ├── stores/            # Pinia stores (auth, social, admin, sysadmin)
    ├── styles/
    │   ├── variables.css  # Copy of HUD variables.css (shared theme)
    │   ├── global.css     # Portal-specific global styles (solid bg, not transparent)
    │   └── portal.css     # Layout, nav, responsive grid
    ├── composables/       # useAuth(), useApi()
    ├── components/
    │   ├── layout/        # NavBar, Sidebar, PageHeader, Footer
    │   ├── social/        # RegionCard, HouseCard, CharacterCard, FamilyTree
    │   ├── codex/         # CodexBrowser, CodexEntry (future-ready)
    │   ├── applications/  # AppList, AppDetail, AppReview, CommentThread
    │   ├── admin/         # PlayerList, RoleManager, PermissionMatrix
    │   └── sysadmin/      # SchemaViewer, MigrationRunner, QueryConsole
    └── views/
        ├── Home.vue
        ├── social/        # RegionList, RegionPage, HousePage, CharacterPage
        ├── codex/         # CodexIndex, CodexCategory, CodexEntry
        ├── player/        # MyApplications, ApplicationDetail, Profile
        ├── staff/         # AppQueue, AppReview, FamilyTreePending
        └── sysadmin/      # RoleList, RoleEditor, PlayerManager, AuditLog,
                           # SchemaViewer, MigrationRunner, QueryConsole
```

### Backend changes

1. **Serve portal SPA**: Add `express.static` + SPA fallback in `index.ts`
2. **New API routes** (6 files):
   - `sysadmin-roles.ts` — CRUD roles, assign permissions
   - `sysadmin-players.ts` — Player list, role assignment, ban
   - `sysadmin-database.ts` — Schema browser, migration list/run, query console
   - `sysadmin-audit-log.ts` — Full audit log (extends staff-audit-log)
   - `houses.ts` additions — Public house detail for portal (already partial)
   - `codex.ts` — Codex content API (lore entries)
3. **Codex tables**: Migration for `codex_categories` and `codex_entries`

### Deployment

Portal builds to `portal/dist/`. On deploy:
```bash
ssh root@187.77.211.96 "sudo -u blackfyre bash -c '
  cd /home/blackfyre/blackfyre &&
  git pull &&
  cd portal && npm install && npm run build &&
  cd ../backend && npm install &&
  pm2 restart blackfyre
'"
```

Portal accessible at `http://187.77.211.96:3000/portal`

---

## Implementation Steps

### Step 1: Portal scaffold + backend serving (foundation)

**Backend:**
- Add static file serving to `index.ts`:
  ```typescript
  app.use('/portal', express.static(join(__dirname, '../../portal/dist')));
  // SPA fallback — serve index.html for all /portal/* routes
  app.get('/portal/*', (req, res) => {
    res.sendFile(join(__dirname, '../../portal/dist/index.html'));
  });
  ```
  (Place BEFORE the 404 handler)

**Portal project:**
- `portal/package.json` — Vue 3, Vite, Pinia, Vue Router, TypeScript
- `portal/vite.config.ts` — base: '/portal/', build to dist/
- `portal/src/main.ts` — createApp, Pinia, Router
- `portal/src/App.vue` — NavBar + `<router-view />`
- `portal/src/styles/variables.css` — Shared theme vars (copy from HUD)
- `portal/src/styles/global.css` — Solid dark background, font imports, scrollbar
- `portal/src/router/index.ts` — All routes with lazy loading + permission guards

### Step 2: Auth + shared composables

- `stores/auth.ts` — Discord OAuth flow (redirect to `/api/auth/discord`, receive JWT, store in localStorage, decode permissions)
- `composables/useApi.ts` — `apiFetch(path, options)` helper that injects Bearer token
- `composables/useAuth.ts` — `hasPermission()`, `isSuperAdmin`, `isLoggedIn`
- `components/layout/NavBar.vue` — Logo, nav links, login/logout, user badge
- `components/layout/Sidebar.vue` — Staff/sysadmin nav (permission-gated)
- `components/layout/PageHeader.vue` — Breadcrumb + title

### Step 3: Public Social Viewer pages

These pages work WITHOUT login (public data).

- `views/social/RegionList.vue` — Grid of region cards (GET `/api/houses/regions/list`)
- `views/social/RegionPage.vue` — Region detail + house cards (GET `/api/houses?regionId=X`)
- `views/social/HousePage.vue` — House detail, members, family tree (GET `/api/houses/:id`, GET `/api/family-tree/houses/:id/tree`)
- `views/social/CharacterPage.vue` — Portrait, bio, lineage badges, faction
- Shared components: `RegionCard`, `HouseCard`, `CharacterCard`, `FamilyTreeViewer`

### Step 4: Codex system

**Migration (040):**
```sql
CREATE TABLE codex_categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  icon VARCHAR(50) NULL,
  sort_order INT UNSIGNED DEFAULT 0
);

CREATE TABLE codex_entries (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id INT UNSIGNED NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  summary VARCHAR(500) NULL,
  image_url VARCHAR(500) NULL,
  is_published BOOLEAN DEFAULT TRUE,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES codex_categories(id)
);

-- Seed some starter categories
INSERT INTO codex_categories (slug, name, description, sort_order) VALUES
('world', 'The Known World', 'Geography, regions, and landmarks', 1),
('houses', 'Noble Houses', 'History and heraldry of the great families', 2),
('faiths', 'Faiths & Religion', 'The gods and their followers', 3),
('orders', 'Orders & Organizations', 'Kingsguard, Night''s Watch, Maesters, and more', 4),
('history', 'History & Lore', 'Key events that shaped the realm', 5),
('combat', 'Combat & Warfare', 'Rules of engagement, weapons, and tactics', 6),
('crafting', 'Crafting & Trade', 'Materials, recipes, and the economy', 7),
('guide', 'Player Guide', 'How to play Dragon''s Dominion', 8);
```

**Backend:** `codex.ts` route file
- `GET /api/codex/categories` — List published categories
- `GET /api/codex/categories/:slug` — Category + entries
- `GET /api/codex/entries/:slug` — Single entry
- `POST /api/staff/codex/entries` — Create entry (requires `content.manage_codex`)
- `PATCH /api/staff/codex/entries/:id` — Edit entry
- `DELETE /api/staff/codex/entries/:id` — Delete entry

**Frontend:**
- `views/codex/CodexIndex.vue` — Category grid
- `views/codex/CodexCategory.vue` — Entry list for a category
- `views/codex/CodexEntry.vue` — Full article view (markdown rendered)
- Staff: inline edit button → edit form (permission-gated)

**New permission** (add to seed): `content.manage_codex`

### Step 5: Player pages (auth required)

- `views/player/MyApplications.vue` — List own applications (GET `/api/applications`)
- `views/player/ApplicationDetail.vue` — Full app view + public comments
- `views/player/Profile.vue` — Edit public bio, portrait URL, view characters

### Step 6: Staff application review

- `views/staff/AppQueue.vue` — Filterable application queue
- `views/staff/AppReview.vue` — Full review view with public+private comments, action buttons
- `views/staff/FamilyTreePending.vue` — Pending suggestions

### Step 7: System Admin — Role Manager + Player List

**New backend routes** (`sysadmin-roles.ts`):
- `GET /api/sysadmin/roles` — All roles with permission counts + user counts
- `POST /api/sysadmin/roles` — Create role
- `PATCH /api/sysadmin/roles/:id` — Update role name/description/color
- `DELETE /api/sysadmin/roles/:id` — Delete role (unassign all players)
- `GET /api/sysadmin/roles/:id` — Role detail with full permission list
- `PUT /api/sysadmin/roles/:id/permissions` — Set permissions (array of perm IDs)
- `GET /api/sysadmin/permissions` — All permissions grouped by category

**New backend routes** (`sysadmin-players.ts`):
- `GET /api/sysadmin/players` — Player list with roles, character counts
- `PATCH /api/sysadmin/players/:id/role` — Assign/remove role
- `PATCH /api/sysadmin/players/:id/ban` — Ban/unban player

**Frontend:**
- `views/sysadmin/RoleList.vue` — Role cards with stats
- `views/sysadmin/RoleEditor.vue` — Name, color, description + permission matrix (checkboxes grouped by category)
- `views/sysadmin/PlayerManager.vue` — Searchable player list, role dropdown, ban toggle
- `views/sysadmin/AuditLog.vue` — Filterable audit log (reuse staff-audit-log API)

### Step 8: System Admin — Database Console

**New backend routes** (`sysadmin-database.ts`):
- `GET /api/sysadmin/database/schema` — All tables from INFORMATION_SCHEMA
- `GET /api/sysadmin/database/schema/:table` — Column details for a table
- `GET /api/sysadmin/database/migrations` — List migration files + applied status
- `POST /api/sysadmin/database/migrations/run` — Apply pending migrations
- `POST /api/sysadmin/database/query` — Execute read-only SQL
- `POST /api/sysadmin/database/execute` — Execute write SQL (requires confirmation token)

**Migration tracking table** (migration 041):
```sql
CREATE TABLE schema_migrations (
  filename VARCHAR(255) NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Backfill all existing migrations as applied
INSERT INTO schema_migrations (filename) VALUES
('001_add_discord_columns.sql'), ... through ('039_...');
```

**Frontend:**
- `views/sysadmin/SchemaViewer.vue` — Expandable table list with column metadata
- `views/sysadmin/MigrationRunner.vue` — Migration list with pending/applied badges, preview + run
- `views/sysadmin/QueryConsole.vue` — SQL editor, read/write mode toggle, results table, CSV export

---

## File Count Estimate

| Area | New Files | Modified Files |
|------|-----------|----------------|
| Portal scaffold | ~8 | 0 |
| Auth + layout | ~6 | 0 |
| Social viewer pages | ~8 | 0 |
| Codex system | ~5 portal + 1 backend route + 1 migration | 1 (api/index.ts) |
| Player pages | ~3 | 0 |
| Staff pages | ~3 | 0 |
| Sysadmin pages | ~8 | 0 |
| Backend routes | ~4 new route files | 2 (api/index.ts, index.ts) |
| Migrations | 2-3 | 0 |
| **Total** | **~50 new** | **~3 modified** |

---

## What's NOT in Phase 3

- Portrait file upload (multipart) — deferred to later
- Server configuration panel — deferred (placeholder page)
- Discord webhook notifications — future
- Codex markdown editor with preview — start simple with textarea
- Mobile-responsive layout — basic responsive, not fully optimized
