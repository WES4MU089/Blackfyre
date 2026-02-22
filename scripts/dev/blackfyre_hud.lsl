// Blackfyre Inworld HUD — Registration + Keepalive
// Attach to avatar as a HUD attachment
// Sends periodic keepalive with location data to backend
// Listens for /bf verify <code> in local chat for SL account linking

string API_BASE = "https://lastlight.ngrok.io/api";
float KEEPALIVE_INTERVAL = 10.0;

key gOwner;
string gOwnerName;
string gCurrentRegion;
key gLoginRequest;
key gKeepaliveRequest;
key gVerifyRequest;
integer gListenHandle;
integer gRegistered;

// Build JSON object manually (LSL has no native JSON)
string jsonObj(list pairs)
{
    string out = "{";
    integer i;
    integer n = llGetListLength(pairs);
    for (i = 0; i < n; i += 2)
    {
        if (i > 0) out += ",";
        out += "\"" + llList2String(pairs, i) + "\":";
        string val = llList2String(pairs, i + 1);
        // Check if value is numeric
        if ((string)((float)val) == val || (string)((integer)val) == val)
        {
            out += val;
        }
        else
        {
            out += "\"" + val + "\"";
        }
    }
    out += "}";
    return out;
}

sendLogin()
{
    string body = jsonObj([
        "sl_uuid", (string)gOwner,
        "sl_name", gOwnerName
    ]);

    gLoginRequest = llHTTPRequest(API_BASE + "/players/login", [
        HTTP_METHOD, "POST",
        HTTP_MIMETYPE, "application/json",
        HTTP_BODY_MAXLENGTH, 1024
    ], body);
}

sendKeepalive()
{
    string region = llGetRegionName();
    vector regionCorner = llGetRegionCorner();
    vector pos = llGetPos();

    string body = jsonObj([
        "sl_uuid", (string)gOwner,
        "sim_name", region,
        "grid_x", (string)llRound(regionCorner.x / 256.0),
        "grid_y", (string)llRound(regionCorner.y / 256.0),
        "pos_x", (string)llRound(pos.x),
        "pos_y", (string)llRound(pos.y),
        "pos_z", (string)llRound(pos.z),
        "display_name", gOwnerName
    ]);

    gKeepaliveRequest = llHTTPRequest(API_BASE + "/players/keepalive", [
        HTTP_METHOD, "POST",
        HTTP_MIMETYPE, "application/json",
        HTTP_BODY_MAXLENGTH, 2048
    ], body);
}

sendVerify(string code)
{
    // Build JSON manually to ensure verification_code is always a quoted string.
    // The generic jsonObj() function detects all-digit values as numeric and omits
    // quotes, which breaks the backend's Zod string validation.
    string body = "{\"sl_uuid\":\"" + (string)gOwner + "\",\"verification_code\":\"" + code + "\"}";

    gVerifyRequest = llHTTPRequest(API_BASE + "/players/verify-sl", [
        HTTP_METHOD, "POST",
        HTTP_MIMETYPE, "application/json",
        HTTP_BODY_MAXLENGTH, 1024
    ], body);
}

default
{
    state_entry()
    {
        gOwner = llGetOwner();
        gOwnerName = llGetDisplayName(gOwner);
        if (gOwnerName == "" || gOwnerName == "???")
        {
            gOwnerName = llKey2Name(gOwner);
        }
        gCurrentRegion = llGetRegionName();
        gRegistered = FALSE;

        llOwnerSay("[Blackfyre] HUD initializing...");

        // Listen for /bf commands on channel 0 (local chat)
        gListenHandle = llListen(0, "", gOwner, "");

        // Register with backend
        sendLogin();

        // Start keepalive timer
        llSetTimerEvent(KEEPALIVE_INTERVAL);

        llOwnerSay("[Blackfyre] HUD active in " + gCurrentRegion);
        llOwnerSay("[Blackfyre] To link your SL account, type: /bf verify <code>");
    }

    on_rez(integer start_param)
    {
        llResetScript();
    }

    attach(key id)
    {
        if (id != NULL_KEY)
        {
            llResetScript();
        }
    }

    listen(integer channel, string name, key id, string message)
    {
        // Parse /bf commands
        if (llGetSubString(message, 0, 3) == "/bf ")
        {
            list parts = llParseString2List(message, [" "], []);
            string cmd = llToLower(llList2String(parts, 1));

            if (cmd == "verify" && llGetListLength(parts) >= 3)
            {
                string code = llToUpper(llList2String(parts, 2));
                llOwnerSay("[Blackfyre] Verifying code: " + code + "...");
                sendVerify(code);
            }
            else if (cmd == "status")
            {
                string status = "Registered: ";
                if (gRegistered) status += "Yes";
                else status += "No";
                status += "\nRegion: " + gCurrentRegion;
                vector pos = llGetPos();
                status += "\nPosition: " + (string)llRound(pos.x) + ", " + (string)llRound(pos.y) + ", " + (string)llRound(pos.z);
                llOwnerSay("[Blackfyre] " + status);
            }
            else if (cmd == "help")
            {
                llOwnerSay("[Blackfyre] Commands:");
                llOwnerSay("  /bf verify <code> - Link SL account");
                llOwnerSay("  /bf status - Show HUD status");
                llOwnerSay("  /bf help - Show this help");
            }
        }
    }

    timer()
    {
        // Check for region change
        string region = llGetRegionName();
        if (region != gCurrentRegion)
        {
            gCurrentRegion = region;
            llOwnerSay("[Blackfyre] Region: " + region);
        }

        // Send keepalive
        sendKeepalive();
    }

    changed(integer change)
    {
        if (change & CHANGED_REGION)
        {
            gCurrentRegion = llGetRegionName();
            llOwnerSay("[Blackfyre] Region: " + gCurrentRegion);
            sendKeepalive();
        }

        if (change & CHANGED_OWNER)
        {
            llResetScript();
        }
    }

    http_response(key request_id, integer status, list metadata, string body)
    {
        if (request_id == gLoginRequest)
        {
            if (status == 200 || status == 201)
            {
                gRegistered = TRUE;
                llOwnerSay("[Blackfyre] Registered with server.");
            }
            else
            {
                llOwnerSay("[Blackfyre] Registration failed (HTTP " + (string)status + ")");
            }
        }
        else if (request_id == gVerifyRequest)
        {
            if (status == 200)
            {
                llOwnerSay("[Blackfyre] Account linked successfully! Your SL avatar is now connected to your Blackfyre account.");
            }
            else
            {
                llOwnerSay("[Blackfyre] Verification failed — invalid or expired code. Please try again.");
            }
        }
        // Keepalive responses are silent
    }
}
