// Blackfyre Retainer Captain NPC — Touch-to-interact
// Place this script inside a prim representing the Retainer Captain NPC.
// When a player touches the prim, it sends an HTTP request to the backend,
// which opens the NPC conversation dialog on the player's HUD.

string API_BASE = "https://lastlight.ngrok.io/api";
string NPC_TYPE  = "retainer_captain";
string NPC_NAME  = "The Retainer Captain";

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
        // if (status != 200) llOwnerSay("[Retainer Captain] HTTP error: " + (string)status + " — " + body);
    }
}
