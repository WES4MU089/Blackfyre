// Blackfyre Healer NPC — Touch-to-interact
// Place this script inside a prim representing the Healer NPC.
// When a player touches the prim, it sends an HTTP request to the backend,
// which opens the NPC conversation dialog on the player's HUD.

string API_BASE = "http://187.77.211.96:3000/api";
string NPC_TYPE  = "healer";
string NPC_NAME  = "Sister Maris";

default
{
    touch_start(integer total)
    {
        key toucher = llDetectedKey(0);

        string body = "{\"sl_uuid\":\"" + (string)toucher
            + "\",\"npc_type\":\"" + NPC_TYPE
            + "\",\"npc_name\":\"" + NPC_NAME + "\"}";

        llHTTPRequest(API_BASE + "/npc/interact", [
            HTTP_METHOD, "POST",
            HTTP_MIMETYPE, "application/json",
            HTTP_BODY_MAXLENGTH, 1024
        ], body);
    }

    http_response(key request_id, integer status, list metadata, string body)
    {
        // Silent — dialog opens on the player's HUD.
        // Uncomment below for debugging:
        // if (status != 200) llOwnerSay("[Healer] HTTP error: " + (string)status + " — " + body);
    }
}
