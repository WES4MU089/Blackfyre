# Dragon's Dominion - HUD Client

Electron-based RPG HUD overlay for Second Life, built with Vue 3 + TypeScript.

## Overview

Dragon's Dominion provides a transparent desktop overlay that displays real-time RPG game data alongside Second Life:

- Health, Armor, Stamina bars
- Hunger, Thirst, Stress survival mechanics
- Money management (Cash, Bank)
- Inventory system
- Skill progression and leveling
- Notifications and status effects

## Tech Stack

- **Framework**: Electron 33.x + Vue 3.5 + TypeScript
- **Build Tool**: electron-vite 5.x
- **State Management**: Pinia
- **Real-time**: Socket.IO client
- **Auto-updates**: electron-updater via GitHub Releases
- **Installer**: NSIS (Windows)

## Building

```bash
cd frontend
npm install
npm run build
npm run pack          # signed NSIS installer
npm run pack:unsigned # unsigned (development only)
```

## License

All rights reserved.
