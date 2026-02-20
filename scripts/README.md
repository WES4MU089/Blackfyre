# Blackfyre SLua Scripts

This directory contains **SLua** (Luau) scripts for Second Life integration.

> **IMPORTANT**: We use SLua, NOT legacy LSL. SLua is based on Luau - the same language used by Roblox.

## SLua vs LSL

| Feature | SLua (Luau) | LSL (Legacy) |
|---------|-------------|--------------|
| Syntax | Lua-based | C-like |
| Variables | `local x = 5` | `integer x = 5;` |
| Functions | `function name() end` | `name() { }` |
| Comments | `-- comment` | `// comment` |
| Strings | `..` concatenation | `+` concatenation |
| Tables | Native tables | Lists/Arrays |
| Types | Optional annotations | Required types |

## Example SLua Script

```lua
-- Blackfyre HUD Connector
-- SLua script for Second Life

local API_BASE = "http://your-server:3000/api"
local playerUUID = nil
local characterId = nil

-- Initialize on script start
local function init()
    playerUUID = ll.GetOwner()
    ll.OwnerSay("Blackfyre HUD initializing...")
    
    -- Register with backend
    local body = ll.List2Json(JSON_OBJECT, {
        "sl_uuid", tostring(playerUUID),
        "sl_name", ll.GetDisplayName(playerUUID)
    })
    
    ll.HTTPRequest(API_BASE .. "/players/login", {
        ll.HTTP_METHOD, "POST",
        ll.HTTP_MIMETYPE, "application/json"
    }, body)
end

-- Handle HTTP responses
local function onHTTPResponse(request_id, status, metadata, body)
    if status == 200 then
        local data = ll.Json2List(body)
        ll.OwnerSay("Connected to Blackfyre!")
    else
        ll.OwnerSay("Connection failed: " .. tostring(status))
    end
end

-- Event handlers
ll.OnScriptStart:Connect(init)
ll.OnHTTPResponse:Connect(onHTTPResponse)
```

## Scripts in this Directory

- `hud_connector.lua` - Main HUD connection script
- `vitals_tracker.lua` - Tracks and sends vital stats
- `inventory_sync.lua` - Inventory synchronization
- `region_sensors.lua` - Location and region detection

## Communication Protocol

All communication with the backend uses:
- **HTTP POST/GET** for API calls
- **JSON** for data format
- **WebSocket** for real-time updates (via CEF overlay)

## Setup Instructions

1. Create a prim/HUD attachment in Second Life
2. Add the SLua script to the object
3. Update `API_BASE` with your server URL
4. Attach the HUD to your avatar
