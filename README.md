# Blackfyre - CEF RPG HUD System for Second Life

A comprehensive Chromium Embedded Framework (CEF) based HUD overlay system for Second Life, inspired by FiveM's rich roleplay frameworks.

## Overview

Blackfyre provides a graphically rich, real-time RPG HUD overlay system that runs externally to Second Life, communicating via HTTP/WebSocket to display:

- **Health, Armor, Stamina** tracking
- **Hunger, Thirst, Stress** survival mechanics
- **Money Management** (Cash, Bank, Crypto)
- **Inventory System** with weight and slots
- **Skill Progression** with XP and leveling
- **Job/Career System** with grades and paychecks
- **Faction/Organization** membership
- **Quest/Achievement** tracking
- **Status Effects** (buffs/debuffs)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Second Life (Client)                        │
│  ┌─────────────┐                              ┌───────────────┐ │
│  │  LSL Script │ ─── HTTP Requests ──────────►│               │ │
│  │  (In-world) │◄─── JSON Responses ──────────│               │ │
│  └─────────────┘                              │               │ │
└───────────────────────────────────────────────│               │─┘
                                                │    Backend    │
┌───────────────────────────────────────────────│    Server     │─┐
│              CEF Overlay (Desktop App)        │  (Node.js)    │ │
│  ┌─────────────────────────────────────────┐  │               │ │
│  │           Frontend (HTML/CSS/JS)        │  │               │ │
│  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       │  │               │ │
│  │  │Vitals│ │Money│ │ Inv │ │Skills│       │◄─┤  WebSocket   │ │
│  │  └─────┘ └─────┘ └─────┘ └─────┘       │  │  Real-time   │ │
│  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       │  │               │ │
│  │  │ Jobs │ │Quests│ │ Map │ │Notify│      │  │               │ │
│  │  └─────┘ └─────┘ └─────┘ └─────┘       │  │               │ │
│  └─────────────────────────────────────────┘  │               │ │
└───────────────────────────────────────────────│               │─┘
                                                │               │
                    ┌───────────────────────────┴───────────────┘
                    │
                    ▼
            ┌───────────────┐
            │   MariaDB     │
            │   Database    │
            └───────────────┘
```

## Components

### 1. Backend Server (`/backend`)
Node.js + Express + Socket.IO server providing:
- REST API for all game systems
- WebSocket for real-time HUD updates
- MariaDB database integration
- CLI tools for database management

### 2. Database (`/database`)
MariaDB schema with tables for:
- Players & Characters
- Vitals & Finances
- Inventory & Items
- Skills & Jobs
- Factions & Quests
- And more...

### 3. Frontend (Coming Soon) (`/frontend`)
CEF-compatible web interface featuring:
- Modern UI components
- Animated status bars
- Notifications system
- Responsive design

### 4. CEF Overlay (Coming Soon) (`/overlay`)
Desktop application using CEF to render the HUD:
- Transparent overlay
- Always-on-top mode
- Click-through support
- System tray integration

### 5. SL Scripts (Coming Soon) (`/scripts`)
SLua scripts for Second Life (Luau-based, NOT legacy LSL):
- HUD attachment scripts
- Region sensor integration
- HTTP communication

## Quick Start

### Prerequisites
- Node.js 18+
- MariaDB 12.1+ (or compatible MySQL)
- Windows 10/11

### Setup

1. **Start MariaDB** (if not running as service):
   ```powershell
   # Add to PATH
   $env:Path += ";C:\Program Files\MariaDB 12.1\bin"
   
   # Start server (in separate terminal)
   & "C:\Program Files\MariaDB 12.1\bin\mariadbd.exe" --console
   ```

2. **Initialize Database**:
   ```powershell
   cd d:\Blackfyre
   Get-Content "database\schema.sql" -Raw | mariadb -u root
   ```

3. **Install & Run Backend**:
   ```powershell
   cd backend
   npm install
   npm run dev
   ```

4. **Use CLI Tools**:
   ```powershell
   npm run db:cli
   ```

## API Quick Reference

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Server health check |
| `GET /api/players` | List players |
| `GET /api/characters/:id` | Get character |
| `PATCH /api/vitals/:id` | Update vitals |
| `POST /api/inventory/:id/items` | Add item |
| `POST /api/finances/:id/add` | Add money |
| `POST /api/skills/:id/xp` | Add skill XP |

## WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `player:auth` | → Server | Authenticate |
| `character:select` | → Server | Select character |
| `vitals:update` | → Server | Update vitals |
| `hud:state` | ← Server | Full HUD data |
| `vitals:changed` | ← Server | Vitals changed |

## Tech Stack

- **Backend**: Node.js, Express, Socket.IO, TypeScript
- **Database**: MariaDB with full relational schema
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla or Vue.js)
- **Overlay**: Chromium Embedded Framework (CEF)
- **SL Integration**: SLua (Luau) - NOT legacy LSL

> **Note**: Second Life scripts use **SLua**, the modern Luau-based scripting language (same as Roblox), not the legacy LSL.

## Roadmap

- [x] Database schema design
- [x] Backend API server
- [x] WebSocket real-time updates
- [x] CLI database tools
- [ ] Frontend HUD components
- [ ] CEF desktop overlay
- [ ] Second Life SLua scripts
- [ ] Authentication system
- [ ] Admin dashboard
- [ ] Quest builder
- [ ] Item editor

## License

MIT License - See LICENSE file for details.

---

**Blackfyre** - Built for immersive roleplay in Second Life
