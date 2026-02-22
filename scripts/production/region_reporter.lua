-- DEPRECATED: Superseded by blackfyre_hud.lsl (legacy LSL)
-- SLua is not yet available on private regions. Will migrate once supported.
--
-- Blackfyre Region Reporter (SLua version)
-- Reports SL region to backend for proximity-based chat
-- Attach to avatar or HUD object

local API_BASE = "http://187.77.211.96:3000/api"
local currentRegion = ""
local POLL_INTERVAL = 5.0

local function reportRegion(region: string)
    local body = ll.List2Json("JSON_OBJECT", {
        "sl_uuid", tostring(ll.GetOwner()),
        "region", region
    })

    ll.HTTPRequest(API_BASE .. "/players/region", {
        ll.HTTP_METHOD, "POST",
        ll.HTTP_MIMETYPE, "application/json"
    }, body)
end

local function checkRegion()
    local region = ll.GetRegionName()
    if region ~= currentRegion then
        currentRegion = region
        reportRegion(region)
        ll.OwnerSay("[Blackfyre] Region: " .. region)
    end
end

local function init()
    currentRegion = ll.GetRegionName()
    reportRegion(currentRegion)
    ll.OwnerSay("[Blackfyre] Region reporter active: " .. currentRegion)
    ll.SetTimerEvent(POLL_INTERVAL)
end

ll.OnScriptStart:Connect(init)
ll.OnTimer:Connect(checkRegion)

-- Also detect region change via the changed event
ll.OnChanged:Connect(function(change: number)
    if bit32.band(change, ll.CHANGED_REGION) ~= 0 then
        checkRegion()
    end
end)
