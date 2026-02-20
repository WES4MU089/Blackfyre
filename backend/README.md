# Blackfyre RPG HUD Backend

A powerful backend system for the Blackfyre CEF-based RPG HUD overlay for Second Life.

## Features

- **Real-time WebSocket communication** for instant HUD updates
- **Full RPG character system** with vitals, skills, jobs, and inventory
- **MariaDB database** with comprehensive schema
- **CLI tools** for database management
- **REST API** for all game systems

## Quick Start

### Prerequisites

- Node.js 18+
- MariaDB 10.5+ (installed at `C:\Program Files\MariaDB 12.1`)
- npm or yarn

### Installation

```bash
cd backend
npm install
```

### Database Setup

Make sure MariaDB is running, then initialize the schema:

```powershell
# Add MariaDB to PATH (if not permanent)
$env:Path += ";C:\Program Files\MariaDB 12.1\bin"

# Initialize database
Get-Content "..\database\schema.sql" -Raw | mariadb -u root
```

### Running the Server

```bash
# Development mode (with hot reload)
npm run dev

# Production build
npm run build
npm start
```

### CLI Tools

Interactive database management:

```bash
npm run db:cli
```

Available CLI commands:
- `help` - Show all commands
- `tables` - List database tables
- `players` - List all players
- `characters` - List all characters
- `jobs` - List available jobs
- `items` - List all items
- `create-player` - Create a test player
- `create-character` - Create a character
- `give-money` - Give money to character
- `give-item` - Give item to character
- Direct SQL queries are also supported!

## API Endpoints

### Players
- `GET /api/players` - List players
- `GET /api/players/:id` - Get player
- `POST /api/players/login` - Login/create player
- `GET /api/players/:id/hud-settings` - Get HUD settings

### Characters
- `GET /api/characters/player/:playerId` - List player's characters
- `GET /api/characters/:id` - Get character details
- `POST /api/characters` - Create character
- `PATCH /api/characters/:id` - Update character

### Vitals
- `GET /api/vitals/:characterId` - Get vitals
- `PATCH /api/vitals/:characterId` - Update vitals
- `POST /api/vitals/:characterId/damage` - Apply damage
- `POST /api/vitals/:characterId/heal` - Heal character

### Inventory
- `GET /api/inventory/:characterId` - Get inventory
- `POST /api/inventory/:characterId/items` - Add item
- `DELETE /api/inventory/:characterId/items/:id` - Remove item
- `POST /api/inventory/:characterId/items/:id/use` - Use item

### Finances
- `GET /api/finances/:characterId` - Get finances
- `POST /api/finances/:characterId/add` - Add money
- `POST /api/finances/:characterId/deposit` - Bank deposit
- `POST /api/finances/:characterId/withdraw` - Bank withdraw
- `POST /api/finances/:characterId/transfer` - Transfer money

### Jobs
- `GET /api/jobs` - List all jobs
- `GET /api/jobs/character/:characterId` - Get character's jobs
- `POST /api/jobs/character/:characterId/hire` - Hire for job
- `POST /api/jobs/character/:characterId/paycheck` - Process paycheck

### Skills
- `GET /api/skills` - List all skills
- `GET /api/skills/character/:characterId` - Get character's skills
- `POST /api/skills/character/:characterId/xp` - Add skill XP

## WebSocket Events

### Client → Server
- `player:auth` - Authenticate with SL UUID
- `character:select` - Select active character
- `vitals:update` - Update character vitals
- `hud:sync` - Request full HUD state

### Server → Client
- `player:authenticated` - Auth successful
- `character:loaded` - Full character data
- `vitals:changed` - Vitals updated
- `hud:state` - Complete HUD state

## Database Schema

The database includes:
- **players** - Second Life avatar links
- **characters** - RPG characters
- **character_vitals** - Health, hunger, etc.
- **character_finances** - Cash, bank, crypto
- **character_inventory** - Items owned
- **character_skills** - Skill levels & XP
- **character_jobs** - Employment
- **items** - Item definitions
- **skills** - Skill definitions
- **jobs** - Job definitions
- **factions** - Organizations/gangs
- **quests** - Mission system
- **achievements** - Achievement system
- **status_effects** - Buffs/debuffs
- ...and more!

## Project Structure

```
backend/
├── src/
│   ├── api/
│   │   ├── index.ts
│   │   └── routes/
│   │       ├── players.ts
│   │       ├── characters.ts
│   │       ├── vitals.ts
│   │       ├── inventory.ts
│   │       ├── finances.ts
│   │       ├── jobs.ts
│   │       └── skills.ts
│   ├── cli/
│   │   └── db-cli.ts
│   ├── config/
│   │   └── index.ts
│   ├── db/
│   │   └── connection.ts
│   ├── utils/
│   │   └── logger.ts
│   ├── websocket/
│   │   └── index.ts
│   └── index.ts
├── .env
├── .env.example
├── package.json
└── tsconfig.json
```

## License

MIT
