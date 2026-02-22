// Blackfyre Floating Text
// Displays customizable floating text above the prim.
// Set text, color, and alpha via the variables below.

string gText = "Blackfyre";
vector gColor = <0.788, 0.659, 0.298>; // Gold #c9a84c
float gAlpha = 1.0;

default
{
    state_entry()
    {
        llSetText(gText, gColor, gAlpha);
    }

    on_rez(integer start_param)
    {
        llSetText(gText, gColor, gAlpha);
    }
}
