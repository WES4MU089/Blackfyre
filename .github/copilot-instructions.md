# Blackfyre Project - AI Assistant Instructions

## Project Overview
Blackfyre is a CEF (Chromium Embedded Framework) based RPG HUD overlay system for Second Life, similar to FiveM's rich roleplay frameworks for GTA V.

## Technology Stack

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js + Socket.IO
- **Database**: MariaDB
- **Package Manager**: npm

### Frontend (Planned)
- HTML5, CSS3, JavaScript/TypeScript
- CEF-compatible web technologies

### Second Life Scripting - IMPORTANT
**We use SLua (Luau), NOT legacy LSL.**

SLua is Second Life's modern scripting language based on **Luau** - the same language used by Roblox. When writing any Second Life scripts for this project:

1. **Always use SLua/Luau syntax**, not LSL
2. SLua uses Lua-style syntax with types (similar to TypeScript for Lua)
3. Key differences from LSL:
   - Functions use `function name() end` syntax
   - Variables use `local` keyword
   - Tables instead of lists
   - String concatenation with `..`
   - Comments with `--` and `--[[ ]]`
   - Type annotations available (e.g., `local x: number = 5`)

### SLua Example Pattern
```lua
-- SLua script example for Blackfyre HUD
local HttpService = game:GetService("HttpService") -- Roblox-style service access

local API_URL = "http://your-server:3000/api"

local function onTouch(hit)
    local player = hit.Parent:FindFirstChild("Humanoid")
    if player then
        -- Make HTTP request
        local response = HttpService:GetAsync(API_URL .. "/players")
        print(response)
    end
end

script.Parent.Touched:Connect(onTouch)
```

### SLua Second Life Specific APIs
When working with Second Life's SLua implementation, use the SL-specific APIs:
- `ll.*` functions are available but with Lua syntax
- HTTP requests for communicating with our backend
- JSON encoding/decoding for data transfer

## Code Style Guidelines

### TypeScript/JavaScript
- Use ES modules
- Prefer async/await over callbacks
- Use Zod for validation
- Follow Express router patterns in `/api/routes/`

### SLua/Luau
- Use `local` for all variables
- Use type annotations where possible
- Prefer early returns
- Keep scripts modular

### Database
- Use parameterized queries (never string concatenation for SQL)
- Use transactions for multi-step operations
- Follow the existing schema patterns in `/database/schema.sql`

## Project Structure
```
Blackfyre/
├── backend/          # Node.js API server
├── database/         # MariaDB schema
├── frontend/         # CEF overlay UI (planned)
├── overlay/          # CEF desktop app (planned)
└── scripts/          # SLua scripts for Second Life
```

## Communication Flow
1. SLua script in Second Life makes HTTP request to backend
2. Backend processes request, updates MariaDB
3. Backend sends WebSocket update to CEF overlay
4. CEF overlay displays updated HUD information

## Key Reminders
- **SLua, not LSL** - Always use Luau syntax for Second Life scripts
- **Real-time updates** - Use WebSocket for HUD state changes
- **JSON data format** - All API communication uses JSON
- **MariaDB CLI** - Available at `C:\Program Files\MariaDB 12.1\bin`
