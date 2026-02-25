# Bannerman & NPC Lord Relationships — WBS Design Document

**Status:** Complete
**Last Updated:** 2026-02-25
**Related Documents:** warfare-foundation.md, war-conflict-framework.md, holdings-system.md, siege-mechanics.md

---

## Table of Contents

1. [Design Pillars](#1-design-pillars)
2. [NPC Lord Disposition System](#2-npc-lord-disposition-system)
3. [Calling Banners](#3-calling-banners)
4. [NPC Petitions](#4-npc-petitions)
5. [NPC Aid Requests](#5-npc-aid-requests)
6. [Combined Army Command](#6-combined-army-command)
7. [NPC Defection & Rebellion](#7-npc-defection--rebellion)
8. [Interaction with Existing Systems](#8-interaction-with-existing-systems)
9. [Worked Examples](#9-worked-examples)
10. [Open Questions](#10-open-questions)

---

## 1. Design Pillars

### Feudalism Is Personal

The feudal hierarchy is not an org chart. It is a web of personal relationships — each link a sworn oath between two people. A vassal who loves his lord fights harder, musters faster, and endures more than one who resents him. The system tracks these relationships numerically under the hood, but players experience them as a qualitative human dynamic: a loyal bannerman, a reluctant ally, a hostile subject.

### Actions, Not Diplomacy

Player lords do not manage disposition through a diplomacy menu, gift-giving, or charm offensives. Disposition is a **reflection of behavior** — how you rule, how you fight, how you treat your people. Defend your vassals and they love you. Break your oaths and they hate you. The system reacts to what you do, not what you say.

### NPCs Have Agency

NPC lords are not silent troop dispensaries. They petition their liege for help. They demand justice when wronged. They grumble when ignored and defect when mistreated. The relationship is **bidirectional** — the player lord needs NPC bannermen, and NPC bannermen need their player lord. Ignoring one side of this equation has consequences.

### Transparent Tiers, Hidden Numbers

Players see qualitative disposition tiers: **Loyal**, **Dutiful**, **Reluctant**, **Hostile**, **Rebellious**. The underlying numerical score (-100 to +100) is hidden from players and visible only to staff. This prevents players from gaming specific point values while still giving them clear feedback about how their bannermen feel.

### Staff Override

Staff can manually adjust any NPC lord's disposition score at any time for narrative reasons. The automated system handles routine events; staff handles the exceptional. A dramatic betrayal, a heroic sacrifice, a generation-spanning grudge — these are staff territory.

---

## 2. NPC Lord Disposition System

### 2.1 The Disposition Scale

Every NPC lord has a **disposition score** toward each player lord in their feudal chain. The score ranges from **-100 to +100**.

```
REBELLIOUS     HOSTILE     RELUCTANT     DUTIFUL     LOYAL
  -100           -50          -20            0          +20          +50          +100
  |_______________|____________|______________|__________|_____________|
  Open revolt   Contempt    Grudging duty   Neutral   Willing service  Fanatical
```

### 2.2 Disposition Tiers

| Tier | Score Range | NPC Behavior | Banner Response |
|---|---|---|---|
| **Loyal** | +50 to +100 | Enthusiastic service. Musters at full strength with bonus speed. Volunteers for dangerous assignments. Defends the lord's reputation to other NPCs. | Full muster + 1 tick faster |
| **Dutiful** | +20 to +49 | Reliable service. Answers the call, fulfills obligations, performs duties without complaint. The baseline of a healthy feudal relationship. | Full muster, standard speed |
| **Reluctant** | -19 to +19 | Minimal compliance. Answers the call but drags feet. Sends fewer men than capacity allows. May delay or find excuses. | -15% manpower, +1 tick delay |
| **Hostile** | -50 to -20 | Active resentment. Sends the bare minimum. Sabotages from within when opportunity arises. Considers defection if approached by a rival. | -35% manpower, +2 tick delay, defection risk |
| **Rebellious** | -100 to -51 | Open defiance. Refuses the call to banners. May raise arms against the lord. Actively seeks alternative liege or independence. | Refuses to muster. Rebellion risk each tick. |

### 2.3 Starting Disposition

Disposition is not always neutral. The context of the relationship determines starting position.

| Context | Starting Score | Tier | Rationale |
|---|---|---|---|
| **Longstanding vassal** (inherited relationship, no grievances) | +30 | Dutiful | Generational loyalty — the default of a healthy realm |
| **Newly sworn vassal** (willing oath, no coercion) | +15 | Reluctant/Dutiful | Relationship is fresh. Trust not yet earned. |
| **Newly conquered lord** (war, forced submission) | -30 | Hostile | Defeated in war. Obeying because the alternative is death. |
| **Vassal whose lord was recently elevated** (new Lord Paramount) | +5 | Reluctant | Unknown quantity. Neither hostile nor loyal — watching and waiting. |
| **Vassal of same Faith** | +5 bonus | — | Shared religious bond. Stacks with other starting conditions. |
| **Vassal of different Faith** | -5 penalty | — | Religious tension. Stacks with other starting conditions. |
| **Vassal whose lands were defended by the lord** | +10 bonus | — | Gratitude for protection. Stacks. |
| **Vassal whose lands were NOT defended when attacked** | -15 penalty | — | The fundamental oath was broken. Stacks. |

**Example:** A lord conquers Lord Bracken's lands (-30 starting). They share the Faith of the Seven (+5). Starting disposition: **-25** (Hostile).

### 2.4 Disposition Modifiers

Events modify the disposition score. All modifiers are **per-event** — they fire once when the event occurs, not per tick. Modifiers stack.

#### Positive Events

| Event | Modifier | Notes |
|---|---|---|
| **Defended vassal's lands from attack** | +15 | The core feudal obligation, fulfilled |
| **Won a defensive war** | +10 | Victory inspires confidence |
| **Won an offensive war with strong CB** | +5 | Justified conquest — the realm approves |
| **Honored a ransom (released prisoner as agreed)** | +5 | Trustworthy lord |
| **Just trial and fair sentencing** | +5 | The law was served |
| **Granted lands or titles to the NPC** | +10 to +20 | Depending on size of the grant |
| **Responded to a petition (fulfilled)** | +5 to +10 | Depending on petition severity |
| **Protected vassal's trade routes** | +5 | Economic protection matters |
| **Shared Faith alignment** | +2 per 30 ticks | Slow passive bond from religious commonality |
| **Clean tyranny record (30+ ticks clean)** | +3 | Just rule is noticed over time |
| **Released NPC's captured kin** | +10 | Personal kindness remembered |
| **NPC's children fostered safely** | +5 | Trust in the lord's household |

#### Negative Events

| Event | Modifier | Notes |
|---|---|---|
| **Failed to defend vassal's lands** | -15 | The core feudal obligation, broken |
| **Lost a defensive war** | -10 | Incompetence erodes trust |
| **Lost an offensive war** | -10 | Led men to die for nothing |
| **Committed Act of Tyranny (Moderate)** | -10 | See war-conflict-framework.md §4 |
| **Committed Act of Tyranny (Severe)** | -25 | Butchery, denial of sacred rights |
| **Committed Act of Tyranny (Extreme)** | -40 | Kinslaying, guest right violation |
| **Sacked a holding in the NPC's region** | -20 | Even if it was an enemy's holding — the region remembers |
| **Ignored a petition (no response)** | -5 to -15 | Depending on petition urgency |
| **Rejected a petition (responded but denied)** | -3 to -8 | Less than ignoring — at least you answered |
| **Excessive taxation** | -5 per instance | Bleeding your vassals dry |
| **War without casus belli** | -10 | Unjust aggression tarnishes the lord |
| **Executed NPC's kin** | -30 | Personal and unforgivable |
| **Broke a sworn oath** | -20 | The foundation of feudalism shattered |
| **Prolonged war (30+ ticks)** | -3 per 30 ticks | War exhaustion breeds resentment |
| **Different Faith (ongoing)** | -1 per 30 ticks | Slow passive friction |

### 2.5 Disposition Drift

Disposition drifts toward a **baseline** over time, representing the natural tendency of relationships to stabilize. The baseline is not always 0 — it depends on context.

| Context | Baseline | Drift Rate |
|---|---|---|
| **Longstanding vassal, no active grievances** | +25 | ±2 per 30 ticks toward baseline |
| **Newly sworn vassal** | +10 | ±2 per 30 ticks toward baseline |
| **Conquered vassal, no severe tyranny** | -10 | ±1 per 30 ticks toward baseline |
| **Conquered vassal, severe tyranny on record** | -30 | No positive drift (severe acts never decay) |
| **Vassal whose kin were executed** | -40 | No positive drift (blood grudge) |

**Drift rules:**
- Drift moves the score toward the baseline by the drift rate each 30-tick cycle
- Drift **never crosses the baseline** — it stops when the score reaches the baseline
- Active events override drift — a new event resets the 30-tick drift timer
- Severe and Extreme tyranny acts **freeze positive drift** for that NPC (mirrors tyranny decay in war-conflict-framework.md §4)

**Design rationale:** Drift prevents permanent grudges from minor slights while ensuring serious offenses have lasting consequences. A lord who commits moderate tyranny and then rules justly for 60 ticks will see his vassals recover. A lord who executes prisoners will never be forgiven by those NPCs.

### 2.6 Staff Override

Staff can:
- Set any NPC's disposition score to any value at any time
- Add or remove specific event modifiers
- Override the disposition tier display (e.g., forcing "Loyal" display on a secretly disloyal NPC for narrative tension)
- Create custom events with custom disposition modifiers
- Freeze drift for narrative reasons

Staff overrides are logged in the event log alongside automated events for transparency.

---

## 3. Calling Banners

### 3.1 The Call

A player lord calls NPC banners through the HUD. The call propagates down the feudal chain:

```
PLAYER LORD issues "Call Banners"
    |
    +-- Direct NPC vassals receive the call immediately (tick 0)
    |     |
    |     +-- Each NPC vassal's sub-vassals receive it next tick (+1 tick per link)
    |
    +-- All NPCs evaluate disposition + CB strength to determine response
```

The call includes a **stated purpose** — defense, offensive war (with CB), or general muster. NPCs evaluate the purpose against their disposition and the casus belli.

### 3.2 NPC Response Evaluation

When an NPC lord receives the call, the system evaluates three factors:

```
Response = f(Disposition Tier, CB Strength, Tyranny Tier)
```

**Step 1 — Disposition determines base willingness:**

| Disposition Tier | Base Manpower % | Mustering Delay Modifier |
|---|---|---|
| Loyal | 100% + 10% bonus | -1 tick (arrives faster) |
| Dutiful | 100% | 0 (standard) |
| Reluctant | 85% | +1 tick |
| Hostile | 65% | +2 ticks |
| Rebellious | 0% (refuses) | — |

**Step 2 — CB Strength modifies willingness (from war-conflict-framework.md §5):**

| CB Strength | Manpower Modifier | Delay Modifier |
|---|---|---|
| Defense (automatic) | +10% (cap 110%) | -1 tick |
| Strong CB | +0% | 0 |
| Moderate CB | -5% | 0 |
| Weak CB | -10% | +1 tick |
| No CB | -25% | +2 ticks |

**Step 3 — Tyranny Tier applies as a final penalty (from war-conflict-framework.md §4):**

| Tyranny Tier | Manpower Penalty | Delay Penalty |
|---|---|---|
| Clean | 0% | 0 |
| Stained | -15% | +1 tick |
| Feared | -30% | +2 ticks |
| Reviled | -50% | +3 ticks |
| Tyrant | Up to -100% | — |

**All three factors multiply.** A Reluctant NPC (85%) called to a war without CB (-25%) by a Feared lord (-30%) provides: 85% × 75% × 70% = **44.6%** of their manpower, with +1 +2 +2 = **+5 tick delay**.

### 3.3 Mustering Delay

Base mustering delay (before modifiers) depends on holding size:

| NPC Holding Size | Base Muster Time |
|---|---|
| Size 1 (Military) | 2 ticks |
| Size 2 (Hybrid) | 3 ticks |
| Size 3 (Civilian) | 4 ticks |

**Chain delay:** Add +1 tick per link in the feudal chain beyond direct vassals.

```
Lord Paramount calls banners:
  Direct vassals: base muster time + modifiers
  Sub-vassals (1 link removed): base + modifiers + 1 tick (chain delay)
  Sub-sub-vassals (2 links removed): base + modifiers + 2 ticks
```

**Quartermaster reduction:** The calling lord's Quartermaster (Stewardship aptitude) reduces total muster time:
- Stewardship 5+: -0.5 ticks (rounded down)
- Stewardship 8+: -1 tick

**Minimum muster time: 1 tick.** Even the most eager bannerman needs a day to arm and march.

### 3.4 How Many Troops?

Each NPC lord provides troops based on their holding's manpower pool and the response evaluation:

```
Troops Provided = Holding Max Manpower × Response Manpower % (from §3.2)
```

The NPC retains a **garrison reserve** of 20% of their manpower — they never send 100% of their men even at Loyal disposition. The garrison defends the NPC's own holding while the lord is away.

| NPC Holding | Max Manpower | Garrison Reserve (20%) | Available to Muster | Loyal (110%) | Dutiful (100%) | Reluctant (85%) | Hostile (65%) |
|---|---|---|---|---|---|---|---|
| Military S1 | 1,500 | 300 | 1,200 | 1,200 (cap) | 1,200 | 1,020 | 780 |
| Hybrid S2 | 4,000 | 800 | 3,200 | 3,200 (cap) | 3,200 | 2,720 | 2,080 |
| Civilian S3 | 10,000 | 2,000 | 8,000 | 8,000 (cap) | 8,000 | 6,800 | 5,200 |

**Note:** The "110% bonus" from Loyal disposition means the NPC dips into their garrison reserve — they trust their lord enough to commit everything. Loyal NPCs provide up to 90% of their max manpower (keeping only 10% as skeleton garrison).

### 3.5 Can an NPC Refuse?

Yes. An NPC lord refuses the call under these conditions:

| Condition | Result |
|---|---|
| **Rebellious disposition** (-51 or lower) | Automatic refusal. The NPC considers themselves in de facto rebellion. |
| **Hostile disposition + No CB** | 50% chance of refusal per tick the call goes unanswered. Evaluated once. |
| **NPC's own holding is under siege** | Refuses — cannot march while defending their own walls. |
| **NPC's own holding was recently sacked** (within 14 ticks) | Refuses — manpower too depleted, population in crisis. |
| **Rebellious + approached by a rival lord with CB** | May defect (see §7). |

**Refusal is an event.** It is logged. The player lord is notified. Refusal without legitimate cause (no siege, no sack, no Rebellious disposition) can be treated as **oath-breaking** — granting the player lord strong casus belli against the refusing NPC.

### 3.6 Rally Points and March Behavior

When NPC troops muster, they march to a **rally point** designated by the calling lord:

- The lord sets a rally point when calling banners (any owned holding, or a map coordinate)
- If no rally point is specified, NPCs march to the lord's capital holding
- NPC contingents march independently using standard army movement (terrain, road bonuses)
- NPC contingents are **vulnerable while marching** — they can be intercepted and engaged as separate armies
- Once NPC contingents arrive at the rally point, they merge into the lord's army (see §6 for combined army rules)

**Strategic implication:** Calling banners early gives NPCs time to assemble, but also reveals your intentions. Enemies can pick off marching NPC contingents individually before they merge. A lord must balance early mustering against operational security.

---

## 4. NPC Petitions

### 4.1 What Are Petitions?

NPC lords can petition their player liege for action. Petitions are the NPC side of the feudal contract — the right of a vassal to demand that their lord fulfill their obligations.

### 4.2 Petition Types

| Petition Type | Trigger | Urgency | Description |
|---|---|---|---|
| **Aid Against Raiders** | NPC's holding is raided or threatened | High | "My lord, bandits/raiders are pillaging my lands. I require your protection." |
| **Aid Against Invasion** | Enemy army approaches NPC's holding | Critical | "My lord, Lord Bolton marches on my castle. Where are your armies?" |
| **Justice for Wrongs** | A player or NPC commits a crime against the NPC | Medium | "My lord, my kinsman was murdered / my lands were seized / my rights were violated." |
| **Dispute Resolution** | Two NPC vassals have a conflict the liege must resolve | Low | "My lord, Lord Rivers and I dispute the rights to the mill on the border." |
| **Economic Relief** | NPC's holding is suffering (sacked, depleted, drought event) | Medium | "My lord, my people are starving. I beg assistance — grain, gold, anything." |
| **Protection Request** | NPC fears a specific threat | Medium | "My lord, House Bolton musters. I fear they march for me. What will you do?" |
| **Title/Land Claim** | NPC believes they deserve recognition or a grant | Low | "My lord, I have served faithfully for many years. I petition for the vacant lordship of Saltpans." |

### 4.3 How Petitions Are Generated

Petitions are generated through **two channels**:

**Automated triggers:**
- Enemy army enters territory containing an NPC's holding → Aid Against Invasion (Critical)
- NPC's holding takes damage (raid, siege, dragon strafe) → Aid Against Raiders or Invasion (High)
- NPC's manpower drops below 50% from external causes → Economic Relief (Medium)
- An Act of Tyranny is committed against the NPC or their kin → Justice for Wrongs (Medium)

**Staff-driven events:**
- Staff creates a petition at any time for narrative reasons
- Dispute Resolution petitions are always staff-driven (requires context)
- Title/Land Claims are staff-driven (NPC ambition, narrative timing)
- Protection Requests based on staff assessment of the political situation

### 4.4 Response Window

Every petition has a **response window** — a deadline by which the player lord must respond. The window varies by urgency:

| Urgency | Response Window | Rationale |
|---|---|---|
| **Critical** | 3 ticks (72 hours) | Your vassal is under attack. Delay means destruction. |
| **High** | 7 ticks (1 week) | Serious threat requiring prompt action. |
| **Medium** | 14 ticks (2 weeks) | Important but not immediately life-threatening. |
| **Low** | 30 ticks (1 month) | Administrative matters — the NPC is patient, for now. |

### 4.5 Response Options

The player lord has three options for each petition:

| Response | Effect | Disposition Impact |
|---|---|---|
| **Fulfill** | Take the requested action (send troops, grant justice, provide aid) | +5 to +15 (varies by petition type and urgency) |
| **Acknowledge & Deny** | Respond to the petition but decline the request, with a stated reason | -3 to -8 (less than ignoring — at least the lord listened) |
| **Ignore** | No response before the window expires | -5 to -15 (the lord did not even answer) |

**Partial fulfillment** is possible. Sending a small force when the NPC asked for a large one counts as Fulfill with reduced disposition gain (+2 to +5 instead of full bonus). The NPC notices the bare minimum.

### 4.6 Cascading Neglect

Ignoring petitions has compounding effects:

| Ignored Petitions (rolling 90-tick window) | Additional Penalty |
|---|---|
| 1 ignored petition | Standard disposition loss |
| 2 ignored petitions | Standard loss + "Negligent Lord" flag (other NPCs notice) |
| 3+ ignored petitions | Standard loss + all NPC vassals in the domain lose -5 disposition ("If he ignores Lord Bracken, he will ignore me too") |

The "Negligent Lord" flag fades after 30 ticks of no ignored petitions. This prevents a single lapse from permanently staining a lord, while ensuring a pattern of neglect has domain-wide consequences.

---

## 5. NPC Aid Requests

### 5.1 When NPCs Ask for Help

NPC lords send **Aid Requests** when threatened by external forces. Unlike petitions (which are administrative), aid requests are urgent military matters.

| Trigger | Request Type | Urgency |
|---|---|---|
| Enemy army within 3 tiles of NPC's holding | "Enemy approaches" | High |
| NPC's holding is actively besieged | "Under siege" | Critical |
| NPC's holding was raided | "Raided — request retaliation" | High |
| NPC's holding manpower below 30% | "Critically weakened — request reinforcement" | High |

### 5.2 Interaction with the War System

Responding to an NPC's aid request has direct war-system consequences:

**If the player responds (sends troops or personally intervenes):**
- The NPC gains +10 to +15 disposition (defended as promised)
- If the player's intervention results in a victory, additional +5 to +10
- The NPC's troops fight at full effectiveness alongside the player's army
- If the NPC's holding was under siege and the player breaks it, the NPC's garrison rallies with +3 morale bonus

**If the player ignores the aid request:**
- The NPC suffers -15 disposition (**Failure of Protection** modifier)
- If the NPC's holding falls while the request is unanswered, additional -10
- If the NPC survives but was not aided, this is logged as a **Failure of Protection** event
- A Failure of Protection event grants the NPC **moderate casus belli** against their liege (from war-conflict-framework.md §5) — they may not use it immediately, but they hold it
- Other NPC vassals in the domain who learn of the failure lose -5 disposition each (NPC awareness delay of 1-3 ticks applies per war-conflict-framework.md §10.3)

### 5.3 Does Responding Grant CB?

Responding to an NPC's aid request does not itself grant casus belli against the attacker. However:

- If the attacker is already at war with the player lord, no new CB is needed
- If the attacker is at war with the NPC only, the player lord intervening on behalf of a sworn vassal is covered under the **Laws of Protection** (war-conflict-framework.md §2) — this grants automatic **strong casus belli** against the attacker
- If no war has been declared, the attacker committing hostile acts against the NPC constitutes grounds for the player lord to petition the moderators for CB (likely granted as Moderate to Strong depending on the aggression)

---

## 6. Combined Army Command

### 6.1 When NPC Bannermen March with a Player Lord

NPC contingents that arrive at the rally point **merge into the player lord's army roster**. They are tracked as separate regional/type entries (per warfare-foundation.md §6) but fight as one army under one War Council.

```
Army Roster Example (after banners called):
  Player Lord's Own Troops:
    400 Northern Conscripts      (The North / Levy)
    200 Stark Shieldmen          (The North / MaA)
     50 Sworn Swords             (The North / Elite)

  NPC Lord Karstark's Contingent:
    300 Northern Conscripts      (The North / Levy)
    150 Stark Shieldmen          (The North / MaA)
     30 Sworn Swords             (The North / Elite)

  NPC Lord Umber's Contingent:
    250 Northern Conscripts      (The North / Levy)
    100 Stark Shieldmen          (The North / MaA)
     20 Sworn Swords             (The North / Elite)
  -------------------------------------------------
  1,500 Total Men (100% Northern — Cultural Synergy active: +2 Advantage)
```

Casualties distribute proportionally across **all entries** in the army roster. NPC contingent troops die at the same rate as the player's own troops.

### 6.2 War Council Control

The **player lord controls the War Council entirely.** NPC bannermen do not automatically fill seats. The player assigns their own characters (player characters or retainers) to War Council seats.

However, NPC lords can **volunteer to fill empty seats** if asked. This is handled through RP — the player lord asks NPC Lord Umber to serve as Champion, and Lord Umber accepts or refuses based on disposition and circumstance.

**NPC War Council aptitude values:**
- NPC lords use their character aptitude scores (generated by staff at NPC creation)
- Typical NPC lord aptitudes range from 3-7, depending on the NPC's background
- NPC lords who fill War Council seats are **attached to the army** — subject to escape/capture checks if the battle is lost (warfare-foundation.md §15)

### 6.3 NPC War Council Refusal

An NPC lord may refuse a War Council seat:

| Disposition Tier | Accepts Dangerous Seat? | Notes |
|---|---|---|
| Loyal | Always | Will serve as Champion, Warlord, or any seat asked |
| Dutiful | Yes, unless seat is suicidal | Refuses if battle is clearly hopeless |
| Reluctant | Only safe seats | Will serve as Quartermaster or Herald. Refuses Champion. |
| Hostile | Refuses all seats | Will not risk their life for a lord they resent |

### 6.4 What Happens to NPC Troops If the Player Lord Dies?

If the player lord (or Warlord) is killed or captured during battle:

1. **The army does NOT automatically shatter.** NPC contingents remain in the battle.
2. **Command succession:** The highest-ranking NPC lord present automatically becomes the interim Warlord. Their Command aptitude replaces the fallen Warlord's dice pool.
3. **Morale impact:** -3 morale (lord's death is devastating to troops, but the army survives if leadership transitions).
4. **NPC War Council members remain** in their seats.
5. **After the battle:** NPC contingents detach and march home to their own holdings. They do not remain under the fallen lord's heir's command automatically — the heir must call banners again.

If **no NPC lord or War Council member survives**, the army operates with no Warlord (default Command 0 = 0 dice, no damage dealt) and will likely rout.

### 6.5 NPC Contingent Detachment

NPC contingents may **detach from the combined army** under certain conditions:

| Condition | NPC Action |
|---|---|
| Disposition drops to Rebellious during the campaign | Contingent detaches and marches home |
| Player lord commits Act of Tyranny during the campaign | All NPC contingents re-evaluate. Hostile or lower → immediate detachment. |
| Player lord attacks without CB (NPC joined for defense, lord pivots to offense) | Contingent detaches — they signed up for defense, not conquest |
| NPC's own holding comes under attack | Contingent detaches to defend home (automatic, no disposition loss) |
| Campaign exceeds 60 ticks with no resolution | Reluctant or lower → detachment. War exhaustion. |

Detaching NPC contingents withdraw from the army immediately. Their troops are removed from the roster and begin marching home. This can happen **mid-campaign** — a lord who mistreats his bannermen may watch his army shrink between battles.

---

## 7. NPC Defection & Rebellion

### 7.1 Defection

Defection occurs when an NPC lord abandons their current liege and swears allegiance to a rival. This is distinct from rebellion — a defector joins another faction rather than going independent.

**Defection conditions:**

| Condition | Defection Risk |
|---|---|
| Hostile disposition (-20 to -50) + rival lord actively offers alliance | 10% chance per tick, evaluated when conditions are met |
| Hostile disposition + rival lord has strong CB against the NPC's current liege | 25% chance per tick |
| Rebellious disposition (-51 or lower) + any rival contact | 40% chance per tick |
| Rebellious + rival lord offers protection oath | 75% chance (near-certain) |

**Defection is not instant.** When an NPC decides to defect:

1. **Secret negotiation phase** (3-7 ticks): The NPC enters covert communication with the rival. Staff manages this. The current liege has no automatic notification — detecting defection requires Spymaster (Cunning) checks.
2. **Detection check:** Each tick of the secret phase, the current liege's Spymaster (if assigned) rolls a detection check. Cunning vs. the defecting NPC's Cunning. Success reveals "Lord Karstark is in communication with your enemies."
3. **Defection announcement:** If undetected, the NPC formally renounces their oath and declares for the rival. Their holding, troops, and all sub-vassals transfer allegiance.
4. **If detected:** The current liege can act — confront the NPC (may accelerate defection or intimidate them into staying), imprison them (Act of Tyranny if done without trial), or grant concessions to restore loyalty.

**What transfers on defection:**
- The NPC's holding (ownership changes)
- The NPC's current garrison
- All sub-vassals of the defecting NPC (they follow their direct lord, not the distant liege)
- Any NPC contingent currently in the field returns home and is now under the rival's banner

### 7.2 Rebellion

Rebellion occurs when an NPC lord raises arms against their own liege — not to join another, but to fight for independence, replace the liege, or press their own claim.

**Rebellion triggers:**

| Condition | Rebellion Risk |
|---|---|
| Rebellious disposition (-51 or lower) + no rival to defect to | 5% chance per tick |
| Rebellious + liege commits new Act of Tyranny | 20% chance immediately |
| Rebellious + liege loses a major battle | 15% chance immediately |
| Multiple NPCs at Rebellious simultaneously | Coalition rebellion: 30% chance when 3+ NPCs are Rebellious |

**The rebel army:**
- Composed of the NPC's holding manpower (full muster — they are fighting for their lives)
- Equipment tier matches the NPC's holding
- War Council filled by the NPC lord and their household retainers (typically aptitude 3-6)
- **No mercenaries** — NPC rebels cannot hire mercenary companies (player-only mechanic)

**Coalition rebellion:** When 3 or more NPC vassals are simultaneously at Rebellious disposition, they may form a coalition. The coalition pools manpower and fights as a single army. One NPC is chosen as the coalition leader (highest Command aptitude among them). This is the most dangerous form of NPC rebellion — a coalition can field an army rivaling the player lord's.

### 7.3 Rebellion Resolution

| Outcome | Result |
|---|---|
| **Player lord defeats the rebel** | Rebel NPC is captured (escape check per warfare-foundation.md §15). Holding is forfeit. Player may: execute (Severe tyranny), imprison, strip of lands, offer the Wall, or pardon. |
| **Rebel defeats the player lord** | The rebel becomes the new lord of the domain (if succession claim) or achieves independence. Staff adjudicates based on the rebel's stated goals. |
| **Negotiated peace** | RP-driven. Player may grant concessions (land, titles, reduced taxes) to end the rebellion peacefully. |
| **Stalemate** | Prolonged war. War exhaustion applies. Other NPCs watch and evaluate. |

### 7.4 Can Defected NPCs Be Reconciled?

Yes, but it is difficult:

| Circumstance | Reconciliation Path |
|---|---|
| NPC defected due to neglect (Failure of Protection) | Fulfill the original obligation. Offer +20 bonus to disposition if the NPC returns. Requires RP negotiation + staff approval. |
| NPC defected due to tyranny | Only if the specific tyranny act was Moderate and has since decayed. Severe/Extreme = no reconciliation. |
| NPC defected to a rival who then mistreats them | "Enemy of my enemy" — the NPC may return if their new lord proves worse. Staff-driven event. |
| NPC rebelled and was defeated | Pardon grants the NPC life but not trust. Starting disposition if reinstated: -30 (Hostile). |

---

## 8. Interaction with Existing Systems

### 8.1 Tyranny System (war-conflict-framework.md §4)

Acts of Tyranny map directly to disposition modifiers:

| Tyranny Event | Disposition Impact | System Cross-Reference |
|---|---|---|
| Moderate Act (War Without Declaration, Failure of Protection, Unjust Seizure) | -10 per act | §2.4 negative events |
| Severe Act (Execution Without Trial, Killing the Yielded, Execution of POWs, Denial of Trial) | -25 per act | §2.4 negative events |
| Extreme Act (Guest Right Violation, Kinslaying) | -40 per act | §2.4 negative events |

**The tyranny tier and disposition tier are independent systems that compound.** A lord at Feared tyranny (-30% NPC manpower from tyranny) calling Hostile NPCs (-35% from disposition) faces multiplicative penalties. These are the same penalties listed in §3.2 — the tyranny tier's mustering penalty applies **on top of** the disposition-based willingness.

### 8.2 CB Strength (war-conflict-framework.md §5)

Casus belli strength directly modifies NPC willingness to muster (§3.2). Additionally:

- NPCs at Dutiful or higher will muster for Moderate CB without complaint
- NPCs at Reluctant will grumble about Weak CB and send fewer men
- NPCs at Hostile may refuse any call that does not involve direct defense of the realm
- **Defense is always honored** — even Hostile NPCs muster for defense (at reduced strength). Only Rebellious NPCs refuse defensive calls.

### 8.3 Warlord Gambit System (warfare-foundation.md §14.2)

NPC contingents obey the Warlord's gambit loadout. When the Warlord's gambit triggers Retreat, all NPC contingents retreat with the army. NPC lords do not have their own gambits — they follow the army command structure.

**Exception:** If an NPC lord fills the Warlord seat (e.g., command succession after the player lord's death), they use a **default NPC gambit loadout:**

```
PRIORITY   CONDITION                              ACTION
------------------------------------------------------------
  1        If army HP below 20%                  -> Surrender
  2        If morale below -8                    -> Retreat
  3        If army HP below 40% AND morale < -3  -> Retreat
  4        Always                                -> Fight
```

NPC Warlords are conservative. They preserve lives over pressing advantages. A player lord who delegates command to an NPC accepts cautious leadership.

### 8.4 Faith Alignment

Shared faith creates a passive bond between lord and vassal. Different faith creates passive friction.

| Faith Alignment | Effect |
|---|---|
| **Same Faith** | +5 starting disposition, +2 per 30 ticks passive drift bonus, NPC offers +5% more manpower when mustering for a war involving defense of the Faith |
| **Different Faith** | -5 starting disposition, -1 per 30 ticks passive friction, NPC is -5% less willing to muster for wars against settlements of their own Faith |
| **War Priest present** | +3 disposition bonus for same-Faith NPCs when a War Priest of matching Faith sits on the War Council |

The Four Faiths (R'hllor, The Seven, Old Gods, Drowned God) each have mechanical identity elsewhere in the system. Here, what matters is alignment between lord and vassal. A lord of the Old Gods calling Northern bannermen who share his Faith gets a small but meaningful loyalty advantage. A lord of R'hllor calling Seven-worshipping Riverlanders faces passive erosion.

### 8.5 Smallfolk Unrest (war-conflict-framework.md §9)

NPC disposition and smallfolk unrest are **separate systems that influence each other**:

- **Low NPC disposition does NOT directly cause smallfolk unrest** — NPCs are lords, not peasants
- **Smallfolk unrest in an NPC's holdings lowers NPC disposition** — a lord whose smallfolk are revolting blames their liege (-5 if unrest is caused by the liege's tyranny)
- **NPC rebellion can trigger local smallfolk unrest** — a rebelling NPC lord may rouse their smallfolk to support the revolt (staff-driven event)

---

## 9. Worked Examples

### 9.1 A Good Lord Calls His Banners

**Lord Stark (Player)** rules the North. Tyranny: Clean. He has 4 NPC vassal lords:

| NPC Lord | Disposition | Tier | Holding | Available Manpower (after reserve) |
|---|---|---|---|---|
| Lord Karstark | +45 (Dutiful) | Dutiful | Military S2 (3,000 max) | 2,400 |
| Lord Umber | +60 (Loyal) | Loyal | Military S2 (3,000 max) | 2,400 |
| Lord Manderly | +25 (Dutiful) | Dutiful | Civilian S2 (6,000 max) | 4,800 |
| Lord Bolton | -15 (Reluctant) | Reluctant | Hybrid S2 (4,000 max) | 3,200 |

**Situation:** The Riverlands invade. Stark declares war with Strong CB (defense). Stark calls banners.

**Response evaluation for each NPC:**

**Lord Umber (Loyal + Defense + Clean):**
- Manpower: Loyal dips into reserve → 90% of max = 2,700 men
- Delay: Base 3 (S2) - 1 (Loyal) - 1 (Defense) = **1 tick**

**Lord Karstark (Dutiful + Defense + Clean):**
- Manpower: 100% of available + 10% (Defense) = 2,400 × 1.10 = 2,640
- Delay: Base 3 + 0 - 1 (Defense) = **2 ticks**

**Lord Manderly (Dutiful + Defense + Clean):**
- Manpower: 100% of available + 10% (Defense) = 4,800 × 1.10 = 5,280
- Delay: Base 3 + 0 - 1 (Defense) = **2 ticks**

**Lord Bolton (Reluctant + Defense + Clean):**
- Manpower: 85% × 110% = 3,200 × 0.935 = 2,992
- Delay: Base 3 + 1 (Reluctant) - 1 (Defense) = **3 ticks**

**Result:** Stark musters 1,500 of his own + 2,700 (Umber, tick 1) + 2,640 (Karstark, tick 2) + 5,280 (Manderly, tick 2) + 2,992 (Bolton, tick 3) = **15,112 men** assembled by tick 3. Bolton's troops arrive last and in reduced numbers, but even the reluctant lord answers the call for defense.

### 9.2 A Tyrant Calls His Banners

**Lord Bolton (Player)** rules the Dreadfort. Tyranny: **Feared** (Severe act: Execution Without Trial). He has 3 NPC vassal lords.

| NPC Lord | Disposition | Tier | Holding | Available Manpower |
|---|---|---|---|---|
| Lord Dustin | -10 (Reluctant) | Reluctant | Hybrid S1 (2,000 max) | 1,600 |
| Lord Ryswell | -35 (Hostile) | Hostile | Military S1 (1,500 max) | 1,200 |
| Lord Hornwood | -55 (Rebellious) | Rebellious | Civilian S1 (3,000 max) | 2,400 |

**Situation:** Bolton declares war on the Karstarks with Weak CB (territorial claim). He calls banners.

**Lord Dustin (Reluctant + Weak CB + Feared):**
- Manpower: 85% (Reluctant) × 90% (Weak CB) × 70% (Feared) = 1,600 × 0.536 = **857 men**
- Delay: Base 3 + 1 (Reluctant) + 1 (Weak CB) + 2 (Feared) = **7 ticks**

**Lord Ryswell (Hostile + Weak CB + Feared):**
- Manpower: 65% (Hostile) × 90% (Weak CB) × 70% (Feared) = 1,200 × 0.41 = **492 men**
- Delay: Base 2 + 2 (Hostile) + 1 (Weak CB) + 2 (Feared) = **7 ticks**

**Lord Hornwood (Rebellious):**
- **Refuses.** Lord Hornwood does not muster. Additionally, at -55 disposition with Bolton at Feared tyranny, Hornwood is evaluating rebellion.

**Result:** Bolton musters his own garrison + 857 (Dustin, tick 7) + 492 (Ryswell, tick 7) = roughly **1,350 NPC troops** arriving 7 ticks late. Compare to Stark's 13,612 NPC troops arriving in 1-3 ticks. Tyranny has cost Bolton 90% of his NPC support.

Meanwhile, Lord Hornwood is at Rebellious disposition. Each tick, there is a 5% chance he raises his own banner in open revolt. Bolton faces a two-front war.

### 9.3 Petition Cascade

**Lord Arryn (Player)** rules the Vale. Clean tyranny. Three NPC vassals.

**Tick 1:** Lord Royce petitions for economic relief — his holding was raided and he needs grain. Medium urgency, 14-tick window.

**Tick 3:** Lord Corbray petitions for justice — his brother was killed by a hedge knight. Medium urgency, 14-tick window.

**Tick 5:** Lord Redfort sends an Aid Request — enemy scouts spotted near his borders. High urgency, 7-tick window.

**Lord Arryn ignores all three petitions.** He is busy preparing for a war to the south.

**Consequences:**

- **Tick 12:** Lord Redfort's aid request window expires. Disposition: -15 (Failure of Protection). Redfort drops from Dutiful (+30) to Reluctant (+15).
- **Tick 15:** Lord Royce's petition expires. Disposition: -8 (ignored Medium petition). Royce drops from Dutiful (+35) to Dutiful (+27). Cascading Neglect: 2 ignored petitions — "Negligent Lord" flag. Lord Corbray and Redfort each lose an additional -5.
- **Tick 17:** Lord Corbray's petition expires. Disposition: -8. Corbray drops from Dutiful (+28) to Dutiful (+20). Cascading Neglect: 3 ignored petitions — all NPCs in the domain lose -5.

**After 17 ticks of neglect:**

| NPC | Before | After | Change |
|---|---|---|---|
| Lord Royce | +35 (Dutiful) | +14 (Reluctant) | -21 |
| Lord Corbray | +28 (Dutiful) | +5 (Reluctant) | -23 |
| Lord Redfort | +30 (Dutiful) | -5 (Reluctant) | -35 |

Lord Arryn went from three Dutiful vassals to three Reluctant ones in 17 ticks of inattention. His next call to banners will be slower, smaller, and more resentful. If he continues to neglect his vassals, they will slide to Hostile within a few more cycles.

### 9.4 Defection in Progress

**Lord Lannister (Player)** is at war with Lord Baratheon. Lord Crakehall, an NPC vassal, is at Hostile disposition (-40) after Lannister failed to defend Crakehall's lands and committed an Act of Tyranny (Unjust Seizure of another vassal's lands).

**Tick 1:** Lord Baratheon's envoy reaches Lord Crakehall in secret. Baratheon has strong CB against Lannister (the unjust seizure). Defection conditions met: Hostile + rival with strong CB = 25% chance per tick.

**Tick 1 roll:** 25% check fails. Crakehall hesitates.

**Tick 2:** Lannister's Spymaster (Cunning 7) rolls a detection check. The Spymaster rolls 7d6, needs to beat Crakehall's Cunning (4). Detection succeeds with margin 2 — Lannister is notified: "Lord Crakehall is in communication with your enemies. We do not yet know his intentions."

**Lannister's options:**
1. **Confront Crakehall** (RP) — demand loyalty. If Lannister is convincing (staff adjudicated), Crakehall may back down. If Lannister threatens, Crakehall's defection chance increases to 40%.
2. **Grant concessions** — return seized lands, publicly honor Crakehall. +15 to +20 disposition, potentially pulling Crakehall out of Hostile.
3. **Arrest Crakehall** — prevents defection but is an Act of Tyranny (Unjust Seizure) if done without trial. All other NPCs take note.
4. **Do nothing** — hope the 25% roll fails each tick. Risky.

This is the intended gameplay loop: tyranny creates disposition loss, which creates defection risk, which the Spymaster can detect, which the player must resolve through RP — not through a button press.

---

## 10. Open Questions

- [ ] Exact NPC lord aptitude generation ranges for staff-created NPCs (suggested 3-7 with bell curve)
- [ ] Integration with future Alliance & Pacts system (deferred from war-conflict-framework.md §12)
- [ ] Integration with future Succession Law system (what happens to disposition when a lord dies and their heir inherits?)
- [ ] Integration with future Wardship & Hostages system (holding a vassal's child as ward could act as disposition modifier)
- [ ] Whether NPC lords should have their own Faith-specific petition types (e.g., a sept is defiled, a Weirwood is felled)
- [ ] Detailed Spymaster detection mechanics for defection (currently uses scouting system from holdings-system.md §15 as baseline — may need refinement)
- [ ] Coalition rebellion mechanics — how exactly do 3+ NPC lords coordinate? (staff-driven? automated when all conditions met?)

---

## Design Rationale Summary

**Why a hybrid numerical/qualitative system?**
Pure numerical scores invite min-maxing. Pure qualitative tiers are too coarse for the system to react to small events. The hybrid model gives staff the fine-grained control of numerical scores while presenting players with the thematic clarity of named tiers. Players know Lord Karstark is "Loyal" — they do not know he is at +52.

**Why no diplomacy actions?**
This is a feudal relationship simulator, not a diplomacy game. In Westeros, vassals do not love their lords because of gifts. They love them because the lord defended their lands, kept the peace, and judged fairly. The system reflects this — disposition is an output of behavior, not an input of player action.

**Why are NPCs so reactive?**
Because the player is the protagonist. NPC lords do not start wars or hatch plots on their own (staff handles that through events). What NPCs do is **respond** to the player's behavior with realistic consequences. This keeps the player at the center of every feudal drama while ensuring their choices have weight.

**Why does disposition multiply with tyranny rather than replace it?**
Because they are measuring different things. Tyranny measures how the **realm** sees you. Disposition measures how a **specific NPC** feels about you. A lord can be at Clean tyranny but have terrible disposition with one specific NPC (personal grudge). A lord can be at Feared tyranny but have Loyal disposition with a favored NPC (the NPC is complicit). Multiplying both creates a wide range of outcomes that feel organic.
