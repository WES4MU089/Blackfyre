# Gauntlet: Warfare System — Foundation Document

> **Status:** Draft — Brainstorming Phase
> **Scope:** Field Battles, Sieges, Naval Combat
> **Last Updated:** 2026-02-25

---

## Table of Contents

1. [Design Pillars](#1-design-pillars)
2. [System Boundaries](#2-system-boundaries)
3. [Unit Types & Army Stats](#3-unit-types--army-stats)
4. [The Holding-to-Army Pipeline](#4-the-holding-to-army-pipeline)
5. [Terrain & the Map](#5-terrain--the-map)
6. [Regional Traits & Army Composition](#6-regional-traits--army-composition)
7. [Tick System & Pacing](#7-tick-system--pacing)
8. [The Three Phases of War](#8-the-three-phases-of-war)
9. [The War Council](#9-the-war-council)
10. [The Damage Formula](#10-the-damage-formula)
11. [Morale](#11-morale)
12. [The Routed Pool](#12-the-routed-pool)
13. [Advantage](#13-advantage)
14. [The Warlord's Decision](#14-the-warlords-decision)
15. [Post-Battle: Aftermath & Recovery](#15-post-battle-aftermath--recovery)
16. [Mercenaries](#16-mercenaries)
17. [Naval Combat](#17-naval-combat)
18. [Open Questions](#18-open-questions)

---

## 1. Design Pillars

### Scale
Large army battles. Think the Battle of the Blackwater, the Battle of the Bastards, the Battle of the Trident. Gauntlet simulates the clash of armies numbering in the hundreds to thousands.

### Automation First
The system is **automated with minimal player input**. Combat resolves automatically each tick based on army stats, War Council aptitudes, and modifiers. The Warlord's only per-tick decision is: **fight, retreat, or surrender.** There are no tactical orders, formation changes, or mid-battle micro-management. The strategic decisions happen before battle — who you recruit to your War Council, what army you muster, where you choose to fight. Once swords are drawn, the system runs itself.

### Time as a Resource
Time is an actual resource and commodity in warfare. The clock never stops. Armies that move faster, muster sooner, and act decisively hold an advantage over those that are slow to respond. The system operates at a realistic scale that allows players to respond when they can, without pausing the world to wait for them.

### Where It Lives
Entirely within the HUD and backend. There are no warfare objects, units, or systems in the Second Life world space. All combat is abstracted and presented through the HUD interface and resolved on the server.

### Scope
Three domains of warfare:
- **Field Battles** — armies clashing in open or contested terrain
- **Sieges** — assaulting or defending fortified holdings
- **Naval Combat** — fleet engagements at sea

---

## 2. System Boundaries

| Aspect | In Scope | Out of Scope (for now) |
|---|---|---|
| Field battles | Yes | — |
| Sieges | Yes | — |
| Naval combat | Yes — [Section 17](#17-naval-combat) | — |
| Raiding | Future doc | — |
| War declaration / casus belli | See [war-conflict-framework.md](war-conflict-framework.md) | — |
| Warscore / peace deals | See [war-conflict-framework.md](war-conflict-framework.md) | — |
| Alliances / calling banners | Future doc | — |
| Mercenary details | See [mercenaries.md](mercenaries.md) — fully defined | — |
| Duels / personal combat | Future doc | — |
| Dragon system | See [dragon-system.md](dragon-system.md) — fully defined | — |

---

## 3. Unit Types & Army Stats

### Three Unit Types

Every army is composed of three unit types. All holdings produce the same three types — the difference is the ratio.

| Unit Type | HP | ATK | Morale Behavior | Character |
|---|---|---|---|---|
| **Levymen** | 10 | 10 | Routs when morale is negative | Peasants pressed into service. Cheap, numerous, fragile. |
| **Men-at-Arms** | 20 | 20 | Routs when morale is negative | Trained professional soldiers. The backbone of any real army. |
| **Elites** | 30 | 30 | **Never routs from morale** | Sworn elite warriors. Armored, mounted, lethal. Fight until ordered to withdraw or killed. |

### 1 Manpower = 1 Life

Each man in the army contributes his unit type's HP and ATK to the army totals. There is one troop pool — every man counts.

### Army Stats (Pooled & Averaged)

| Stat | Calculation | What It Does |
|---|---|---|
| **Total Army HP** | Sum of all living men's HP | The army's health pool. Damage reduces this. |
| **Total Army ATK** | Sum of all living men's ATK | Used to calculate Avg ATK. |
| **Avg ATK** | Total ATK / Total Men | The army's damage quality. Feeds the damage formula. |
| **Army Morale** | Starts at 10, shifts per tick | Positive = damage resistance. Negative = troops rout per engagement. |

### Example Army

500 Levymen + 100 Men-at-Arms + 20 Elites = **620 men**

```
Total HP:  (500 × 10) + (100 × 20) + (20 × 30) = 7,600
Total ATK: (500 × 10) + (100 × 20) + (20 × 30) = 7,600
Avg ATK:   7,600 / 620 = 12.3
```

### Casualty Distribution

When the army takes HP damage, casualties are distributed **proportionally by headcount ratio**:

```
Army composition: 80.6% Levy, 16.1% MaA, 3.2% Elites
Army loses 888 HP this tick:

  Levy share:   888 × 0.806 = 716 HP → 716 / 10 HP per levy = 71 Levymen dead
  MaA share:    888 × 0.161 = 143 HP → 143 / 20 HP per MaA  = 7 MaA dead
  Elite share: 888 × 0.032 = 28 HP  → 28 / 30 HP per elite  = 0 Elites dead

  Total: 78 men dead
  Remaining HP (20) tracked as fractional damage, carries to next tick.
```

Because levymen have lower HP per man, they die in greater numbers for the same HP share. Over time, the army's composition shifts toward higher-quality troops as levies thin out faster. This is emergent — not a special rule, just math.

### Wounded Recovery

Not all casualties are permanent deaths. A percentage of men lost in combat enter a **wounded pool** instead of dying:

```
Wounded Recovery Rate = Base Rate + (War Maester Lore × 2%)
```

- Wounded men heal over subsequent ticks and eventually rejoin the army
- A high-Lore War Maester means more casualties are saved and they recover faster
- This creates long-term strategic value: two armies that take identical casualties in battle have very different outcomes a week later based on their Lore investment

---

## 4. The Holding-to-Army Pipeline

### The Two-Axis Model

```
SIZE determines BOTH type and max manpower  →  Size 1 (Military), Size 2 (Hybrid), Size 3 (Civilian)
TERRAIN determines stat bonuses             →  Where the holding sits on the map
```

### Holding Size = Holding Type

Size and type are the same thing. There are three sizes, each with a fixed type and manpower cap:

| Size | Type | Max Manpower | Composition | Examples |
|---|---|---|---|---|
| **1** | **Military** (Motte/Keep/Castle/Fortress) | 3,000 | 40% Levy, 40% MaA, 20% Elite | The Dreadfort, Moat Cailin, Storm's End |
| **2** | **Hybrid** | 5,000 | 60% Levy, 28% MaA, 12% Elite | Lannisport, White Harbor, Sunspear |
| **3** | **Civilian** (Village/Town/City) | 10,000 | 80% Levy, 17% MaA, 3% Elite | King's Landing, Oldtown |

### What Each Size Produces (At Max Manpower)

**Size 1 — Military (3,000 men max):**

| Levy | MaA | Elites | Avg ATK | Army HP |
|---|---|---|---|---|
| 1,200 | 1,200 | 600 | 34.00 | 102,000 |

**Size 2 — Hybrid (5,000 men max):**

| Levy | MaA | Elites | Avg ATK | Army HP |
|---|---|---|---|---|
| 3,000 | 1,400 | 600 | 25.00 | 125,000 |

**Size 3 — Civilian (10,000 men max):**

| Levy | MaA | Elites | Avg ATK | Army HP |
|---|---|---|---|---|
| 8,000 | 1,700 | 300 | 15.25 | 152,500 |

### The Feudal Dynamic

This creates the classic feudal dependency:

- **Cities** (Size 3) produce the most men but weakest quality. The Gold Cloaks are numerous but they're not soldiers. Kings need their bannermen for real soldiers.
- **Castles** (Size 1) produce fewer men but with devastating quality — 20% elites, Avg ATK of 34. A Size 1 castle at max produces 600 elites that never rout.
- **Towns** (Size 2) are the balanced middle — decent numbers with decent quality.

A king who controls King's Landing has 10,000 men, but a professional army of 3,000 castle-bred soldiers with 600 elites tears through levy-heavy forces. The king needs his lords. The lords need the king. This is Westeros.

### Mustering — Player-Driven

Mustering is **not automated**. Players decide when to raise their men. This is a deliberate strategic action — calling your levies to arms has consequences (economic cost, leaving holdings undefended, tipping off enemies).

**Player characters** raise their own holdings' levies manually. They choose when, and their troops begin mustering with a delay based on holding size and distance.

**NPC vassals** can be called to raise banners. When a lord calls NPC banners, those vassals auto-muster and march to the rally point — but with mustering delay per link in the chain:

```
Lord Paramount (player)
  └── Raises own levies (immediate decision, mustering delay applies)
  └── Calls NPC banners → NPC Vassal Lords
        └── Auto-muster their levies (additional delay)
        └── March to rally point (travel time)
```

A lord defending his own castle has his garrison immediately. Calling full NPC banners might take 5-7 ticks before everyone assembles.

### NPC Mustering & the Law

NPC vassal willingness to muster is affected by **casus belli** and **Acts of Tyranny**. NPCs are not blind — they evaluate whether the war is just before marching their men to die.

| Condition | NPC Mustering Effect |
|---|---|
| **Defending against attack** | Full mustering + morale bonus |
| **Strong casus belli** (tyranny against your house, broken protection) | Full mustering |
| **Moderate casus belli** (broken oath, disputed succession) | Normal mustering |
| **Weak casus belli** (territorial claim, insult) | -10 to -15% NPC manpower |
| **No casus belli** (unprovoked aggression) | -30% NPC manpower, +2 tick delay |
| **Undeclared war** (attacking without formal declaration) | Act of Tyranny — additional penalties stack |

A lord with Acts of Tyranny on record faces compounding penalties — NPC vassals who already distrust him are even less eager to answer the call. Full details in [War & Conflict Framework](war-conflict-framework.md).

**Strategic decisions:**
- Raise levies now and reveal your intentions, or wait?
- Call banners early and risk the enemy mustering in response?
- Attack before the enemy's NPC vassals arrive?
- A surprise attack catches a lord with only his household garrison
- **Do you have cause?** Fighting without casus belli means your NPC vassals muster fewer men and take longer. The defender gets full commitment.

### Port Flag

Holdings may be flagged as a **Port**, granting access to naval manpower (ships, marines). Details deferred to Naval Combat design document.

---

## 5. Terrain & the Map

### Terrain Types

The world map uses the following terrain types, each with properties that directly affect warfare:

| Terrain | Move Cost | Attrition | DEF | Character |
|---|---|---|---|---|
| **Ocean** | 1.00 | 2.00 | 0 | Naval domain. Not land-battleable. |
| **Plains** | 1.00 | 0.00 | 0 | Fast movement, no defense. Attacker's ground. |
| **Snow** | 2.00 | 3.00 | 0 | Slow, punishing march. No natural defense. |
| **Grey Mountains** | 5.00 | 2.00 | 1 | Slow, defensive. Hard to assault. |
| **Desert Plains** | 2.00 | 4.00 | 0 | Moderate speed, brutal attrition. |
| **Boreal Forest** | 3.00 | 0.00 | 1 | Moderate speed, good cover. |
| **Snow Mountain** | 10.00 | 5.00 | 1 | Near-impassable. Armies arrive gutted. |
| **Forest** | 1.00 | 0.00 | 1 | Fast, no attrition, defensive. Ideal ground to hold. |
| **Tundra** | 1.00 | 5.00 | 0 | Fast but lethal attrition. |
| **Red Mountains** | 5.00 | 3.00 | 1 | Dorne's natural fortress. Slow and punishing. |
| **Swamp** | 5.00 | 5.00 | 0 | Nightmare. Slow AND deadly. Nobody wants to fight here. |
| **Road** | 0.50 | 0.00 | 0 | Fastest movement. No defense. For marching, not fighting. |

### DEF → Advantage Mapping

The DEF value translates directly into defensive Advantage for armies fighting on that terrain:

| DEF | Advantage Bonus | Terrains |
|---|---|---|
| 0 | +0 | Plains, Snow, Desert Plains, Tundra, Swamp, Ocean, Road |
| 1 | +2 | Grey Mountains, Boreal Forest, Snow Mountain, Forest, Red Mountains |

### March Attrition

During army movement, each tick the army crosses terrain and takes attrition proportional to the terrain's attrition value. War Council seats reduce this:

```
Effective Attrition = Terrain Attrition
  × (1 - Quartermaster Stewardship × 0.025)
  × (1 - Marshal Fortitude × 0.02)
```

### The Map Is Strategy

Army composition is a **map puzzle**:
- Invading through Swamp or Tundra is suicide without excellent logistics
- Snow Mountain is nearly impassable (move 10.0, attrition 5.0)
- Red Mountains are Dorne's natural fortress (slow, high attrition, DEF 1)
- Plains and Roads are invasion corridors — fast, no attrition, no defense
- Forest is ideal defensive ground — easy to reach, no attrition, DEF 1
- You look at your holdings and ask: what can I field? What am I missing? Where do I fight?

---

## 6. Regional Traits & Army Composition

### Culture Comes From the Land

When a holding produces troops, the cultural identity comes from **the region the holding is in**, not the faction that owns it. Northmen fight like Northmen regardless of who holds the castle.

### Army Composition — Per-Region Tracking

Armies track troops by **region and type**. When armies merge from multiple regions, each contingent retains its regional identity. This determines which regional bonuses apply, how casualties are tracked, and whether cultural synergy is active.

```
Army Roster Example:
  300 Northern Conscripts      (The North / Levy)
  150 Stark Shieldmen          (The North / MaA)
   30 Sworn Swords             (The North / Elite)
  200 Vale Peasants            (The Vale / Levy)
   50 Arryn Vanguard           (The Vale / MaA)
   20 Knights of the Vale      (The Vale / Elite)
  ─────────────────────────────────────────────
  750 Total Men
```

Casualties distribute proportionally across all region/type entries. When troops are lost, the army roster updates per entry — "Lost 15 Northern Conscripts, 10 Vale Peasants, 8 Stark Shieldmen..." etc.

### Regional Traits

Each region has a **Regional Trait** — a unified package combining terrain affinity and cultural identity. Two components:

- **Terrain Affinity** — specific terrain types where troops from this region gain a combat bonus. Activates based on **where the battle takes place**, not where the troops were born.
- **Identity Bonus** — a broader bonus reflecting the region's character. May be always-active or situational.

---

**The North — Winter's Resolve**

| Component | Detail |
|---|---|
| **Affinity Terrains** | Snow, Boreal Forest, Tundra, Swamp |
| **Terrain Bonus** | -50% march attrition on affinity terrain |
| **Identity Bonus** | +5% morale drain resistance in all combat |
| **Unit Names** | Northern Conscripts (Levy), Stark Shieldmen (MaA), Sworn Swords (Elite) |

*The North endures what kills others. Winter-hardened, they march through snow and swamp where southern armies wither.*

---

**Westerlands — Gilded Steel**

| Component | Detail |
|---|---|
| **Affinity Terrains** | Grey Mountains, Forest |
| **Terrain Bonus** | +10% damage on affinity terrain |
| **Identity Bonus** | +5% army HP in all combat |
| **Unit Names** | Lannister Levies (Levy), Lannister Men-at-Arms (MaA), Knights of the Rock (Elite) |

*Gold buys the best steel. Well-equipped and well-trained, Westerlands troops are tougher everywhere and lethal on home ground.*

---

**The Reach — Fields of Glory**

| Component | Detail |
|---|---|
| **Affinity Terrains** | Plains |
| **Terrain Bonus** | +10% damage on affinity terrain |
| **Identity Bonus** | +5% damage when army exceeds 1,000 men |
| **Unit Names** | Reachmen Militia (Levy), Tyrell Footmen (MaA), Knights of the Green (Elite) |

*Only one affinity terrain — but Plains is the most common battlefield in Westeros. The Reach fields the largest armies, and their cavalry charges on open ground are devastating.*

---

**Stormlands — Ours is the Fury**

| Component | Detail |
|---|---|
| **Affinity Terrains** | Forest, Grey Mountains |
| **Terrain Bonus** | +10% DR on affinity terrain |
| **Identity Bonus** | +5% damage when morale is below 5 |
| **Unit Names** | Storm Levies (Levy), Storm Brothers (MaA), Storm Knights (Elite) |

*Storm-hardened and stubborn. Tough on defensive terrain, dangerous when cornered. The more desperate a Stormlander, the harder they fight.*

---

**Dorne — Unbowed, Unbent, Unbroken**

| Component | Detail |
|---|---|
| **Affinity Terrains** | Desert Plains, Red Mountains |
| **Terrain Bonus** | +10% DR and -50% march attrition on affinity terrain |
| **Identity Bonus** | None — doubled terrain bonus compensates |
| **Unit Names** | Dornish Spears (Levy), Dornish Fighters (MaA), Sand Knights (Elite) |

*Their terrain IS their identity. Dorne has never been conquered — the land itself fights for them. Double bonus on home terrain, nothing abroad.*

---

**Iron Islands — The Iron Price**

| Component | Detail |
|---|---|
| **Affinity Terrains** | Ocean (naval combat) |
| **Terrain Bonus** | +10% naval combat damage |
| **Identity Bonus** | +5% damage in the first 2 ticks of any land battle |
| **Unit Names** | Thralls (Levy), Ironborn Reavers (MaA), Ironborn Captains (Elite) |

*Born to the sea. Ironborn dominate naval warfare and hit hard on first contact — reavers who strike fast and fade. Weak in prolonged land campaigns.*

---

**Riverlands — The Bloodied Fields**

| Component | Detail |
|---|---|
| **Affinity Terrains** | Forest, Swamp, Plains |
| **Terrain Bonus** | +5% DR when defending on affinity terrain |
| **Identity Bonus** | +1 Advantage when defending on any terrain |
| **Unit Names** | Rivermen (Levy), Tully Guard (MaA), River Knights (Elite) |

*Always the battlefield, never the aggressor. Three affinity terrains but a weaker per-terrain bonus (5% vs 10%). The Riverlands know how to hold ground — they've had centuries of practice.*

---

**The Vale — Impregnable**

| Component | Detail |
|---|---|
| **Affinity Terrains** | Grey Mountains, Snow Mountain |
| **Terrain Bonus** | +10% DR on affinity terrain |
| **Identity Bonus** | +5% to fortification Advantage bonus |
| **Unit Names** | Vale Peasants (Levy), Arryn Vanguard (MaA), Knights of the Vale (Elite) |

*Mountain fortress warriors. The Eyrie has never fallen. Nearly unbreakable when dug in, but their advantage disappears on flat ground.*

---

**Crownlands — Crown's Authority**

| Component | Detail |
|---|---|
| **Affinity Terrains** | Plains, Road |
| **Terrain Bonus** | -50% march attrition on affinity terrain |
| **Identity Bonus** | +5% Herald rally effectiveness |
| **Unit Names** | City Watch Levy (Levy), Gold Cloaks (MaA), Kingsguard Knights (Elite) |

*The beating heart of the realm. Not the best fighters, but the best organized. Fast marches on roads and plains, and rallying power that holds armies together.*

---

### Proportional Bonus Application

In merged armies, terrain bonuses apply **proportionally** based on what percentage of the army comes from the matching region:

```
Battle on Snow terrain:

  Army: 480 Northern troops (64%) + 270 Vale troops (36%)

  Winter's Resolve (+5% morale DR): applies to 64% → 3.2% effective DR
  Impregnable (Snow ≠ Grey Mountains/Snow Mountain): 0%

  Total terrain bonus: +3.2% DR
```

A **pure regional army** on its affinity terrain gets the full bonus. Mixed armies get diluted bonuses — but gain raw numbers from merging. This creates a natural trade-off between homogeneity and size.

### Cultural Synergy

If **80%+ of an army** comes from the same region, the army receives a **+2 Advantage** bonus (shared doctrine, cohesion, familiarity).

This stacks with terrain affinity bonuses. A pure Northern army fighting on Snow gets: full Winter's Resolve + cultural synergy. A multi-regional empire fields diverse armies — stronger in raw numbers but less cohesive. This is a **natural counter to snowballing**: the more you conquer, the more you lose cultural synergy.

---

## 7. Tick System & Pacing

### Universal 24-Hour Tick

All warfare operates on a single, universal **24-hour tick**. Field battles, sieges, movement, mustering — everything advances once per day.

**Rationale:** One real day equals one day of war. A two-week siege feels like a two-week siege. Players check in once daily, decide whether to fight, retreat, or surrender, and the world ticks forward. Between ticks, players are in-world holding war councils, arguing strategy, receiving scouts, giving speeches.

### Multiple Engagements Per Tick

Each 24-hour tick resolves **multiple engagements**. The attacking army's size determines how many:

| Attacker Army Size | Engagements Per Tick |
|---|---|
| < 500 men | 2 |
| 500 – 1,999 | 3 |
| 2,000 – 4,999 | 4 |
| 5,000+ | 5 |

Larger armies rotate fresh troops into the fight throughout the day. A massive host grinds relentlessly — fresh units pushing forward all day. A small raiding force can only sustain brief engagements.

**Both sides fight each engagement.** Each engagement, both the attacker and defender roll their dice and deal damage simultaneously. More engagements means more total damage dealt AND received — the larger army's advantage is that it can afford the mutual bleed.

### Pacing by Context

| Context | Tick Rate | Typical Duration |
|---|---|---|
| Field Battle (all phases) | 24 hours per tick | 9-17 real days total |
| Siege | 24 hours per tick | Days to weeks |
| Army Movement | 24 hours per tick | Varies by distance + terrain |
| Mustering | 24 hours per tick | Several days to assemble |

---

## 8. The Three Phases of War

### Overview

| Phase | Duration | Combat? | What Happens |
|---|---|---|---|
| **Maneuver** | 2-3 ticks | No | Scouting, formation, preparation. Either side can withdraw cleanly. |
| **Battle** | 5-10+ ticks | Yes | Daily engagements resolve automatically. Morale shifts. Routing accumulates. Warlord decides: fight, retreat, or surrender. |
| **Aftermath** | 2-4 ticks | No | Winner recovers. Loser retreats or scatters. Routed pool pathfinds home. |

**Total real-time for a major battle: 9-17 real days.**

### Phase 1: Maneuver (2-3 ticks)

No combat. No casualties. Pure preparation and positioning.

**What happens:**
- **Scouts report** — intelligence about the enemy army (composition, size, War Council members). Quality depends on the Spymaster's Cunning vs. enemy counter-intelligence.
- **Terrain is contested** — the side that maneuvers better claims favorable ground, feeding into the Advantage stat.
- **War Council assembles** — players fill seats. Their aptitudes passively apply to the army.
- **Reinforcements approach** — allied armies still marching get closer each tick.
- **Clean retreat available** — either side can withdraw during Maneuver without combat.
- **Sabotage opportunities** — Spymaster can attempt pre-battle actions (damage supplies, spread false intelligence).
- **Diplomatic options** — Herald can demand surrender, negotiate terms.

**Engagement timing:**
- A side that wants to **force engagement** can attempt to shorten Maneuver. Success depends on Warlord Command + army speed.
- A side that wants to **delay** (waiting for reinforcements) tries to extend Maneuver. Success depends on Warlord Command + defensive terrain.
- If neither side forces the issue, Maneuver transitions to Battle after 3 ticks.

### Phase 2: Battle (5-10+ ticks)

The main engagement. Each tick resolves N engagements based on the attacking army's size.

**Per tick (automated):**
0. **Warlord Decision** — evaluate gambit loadout or manual choice (see §14). If Retreat or Surrender, skip to §14.4/§14.5. Tick ends.
1. Dragon gambit evaluation (per `dragon-system.md` §4)
2. Dragon strafe / scorpion checks
3. Calculate both sides' effective ATK (averaged ATK × War Council modifiers)
4. Resolve N engagements (both sides roll Command dice, deal damage simultaneously)
5. Apply casualties proportionally by headcount ratio
6. Apply wounded recovery (War Maester Lore)
7. If morale is negative, calculate troops routing to the routed pool
8. Herald rallies percentage of routed pool back to army
9. Update morale based on the day's results

**Battle ends when:**
- Warlord orders retreat or surrender (at step 0, before combat resolves)
- Army is depleted (all men dead or routed, Herald cannot keep pace)
- Enemy retreats or surrenders
- Mutual withdrawal

**There is no forced rout.** The Warlord always has agency. A stubborn lord can fight at deeply negative morale, watching levies desert each engagement while his elites hold the line. The army degrades through the routing mechanic — it doesn't shatter at a threshold.

### Phase 3: Aftermath (2-4 ticks)

The battle is over. Both sides deal with the consequences.

- **Winner:** Enters mandatory recovery phase. Cannot march or attack. Tends wounded, reorganizes.
- **Loser (retreat):** Army withdraws to destination. Enters recovery on arrival.
- **Loser (depleted):** Remaining men join the routed pool. Everyone pathfinds home.
- **Routed pool:** Consolidates into one unit, begins pathfinding home immediately.
- **Escape check:** All attached characters (War Council, players) on the losing side roll to escape or be captured.

See [Post-Battle: Aftermath & Recovery](#15-post-battle-aftermath--recovery) for full details.

---

## 9. The War Council

The War Council replaces the old flank-commander model. Nine seats, one per aptitude. Each seat contributes its aptitude to the army in a specific way.

Seats can be filled by **player characters** (uses their actual aptitude score) or **NPC retainers** (lower effectiveness, roughly aptitude 4-5). Empty seats default to no bonus.

### Warlord — Command
*The tactician. How well your army fights.*

| Type | Effect |
|---|---|
| **Core** | Dice pool for engagements — roll [Command]d6, success on 4+. Each success generates damage. |
| **Maneuver** | Determines ability to force or delay engagement timing. |

Command 3: rolling 3d6. Swingy, inconsistent. Green commander.
Command 10: rolling 10d6. Reliable, devastating. Master tactician.

### Champion — Prowess
*The blade. Raw killing power.*

| Type | Effect |
|---|---|
| **Core** | +2% army damage per Prowess level (multiplicative). |
| **Passive** | The Champion's presence on the field inspires troops and leads charges. Higher Prowess = more lethal engagements. |
| **Duel** | When opposing army also has a Champion, personal combat events can trigger. Outcomes affect morale. |
| **Risk** | Can be wounded, killed, or captured. Death causes -2 morale. Prowess determines survival odds. |

### Marshal — Fortitude
*The iron wall. Endurance and toughness.*

| Type | Effect |
|---|---|
| **Core** | -2% incoming damage per Fortitude level (multiplicative). |
| **March** | Forced march capability — faster movement with less attrition. |
| **Siege** | Siege endurance — longer before starvation/disease during siege. |
| **Campaign** | Reduces attrition losses from weather, terrain, prolonged marching. |

### Spymaster — Cunning
*The shadow. Disruption, deception, intelligence.*

| Type | Effect |
|---|---|
| **Core** | -2% enemy combat effectiveness per Cunning level (debuffs enemy damage output). |
| **Maneuver** | Scouting quality — reveals enemy composition, size, and War Council members. |
| **Maneuver** | Counter-intelligence — resists enemy scouting. |
| **Maneuver** | Sabotage — pre-battle disruption to enemy supplies, false intelligence. |

### Quartermaster — Stewardship
*The organizer. Logistics and efficiency.*

| Type | Effect |
|---|---|
| **Core** | -2.5% army upkeep and attrition per Stewardship level. |
| **Supply** | Determines army supply status (well-fed = morale bonus, starving = morale penalty). |
| **Mustering** | Reduces ticks needed to muster when banners are called. |
| **Aftermath** | Recovery phase reduction: -0.5 ticks at Stewardship 6+, -1 tick at Stewardship 9+. |

### Herald — Presence
*The voice. Rallies broken men back to the fight.*

| Type | Effect |
|---|---|
| **Core** | Rallies Presence × 2% of the routed pool back to the army per tick. Rallied men rejoin as their original unit type. |
| **Passive** | +0.5 starting morale per Presence level. |
| **Maneuver** | Diplomatic actions — demand surrender, negotiate terms, intimidate. |
| **Risk** | If Herald is killed, rallying stops. Routed pool only grows from that point. |

### War Maester — Lore
*The healer. Wounded recovery and knowledge.*

| Type | Effect |
|---|---|
| **Core** | +2% wounded recovery rate per Lore level per tick. More casualties saved to wounded pool instead of dead. |
| **Wounded** | Wounded men heal and rejoin the army faster between battles. |
| **Siege** | Engineering bonus — siege weapon effectiveness (attack) and fortification strength (defense). |
| **Maneuver** | Tactical analysis — small Advantage bonus from terrain reading (Lore 6+). |

### War Priest — Faith
*The anchor. Holds men's nerves when fear takes root.*

| Type | Effect |
|---|---|
| **Core** | Reduces troop rout rate by Faith × 1.5% when morale is negative. |
| **Passive** | Morale drain resistance — reduces all morale losses by Faith × 1%. |
| **Holy Warrior** | +3% damage when fighting an army of a different faith. |
| **Dragon Terror** | Reduces dragon morale penalties by Faith × 2% per level. |

### Siege Master — Craftsmanship
*The engineer. Builds, breaks, and repairs fortifications.*

| Type | Effect |
|---|---|
| **Core** | Gates the maximum tier of siege engines that can be built on-site during a siege. |
| **Siege** | Siege engine build speed — higher Craftsmanship = faster construction (reduces the ~7 tick build time). |
| **Repair** | Settlement repair rate during and after sieges. |
| **Naval** | Ship repair rate (equivalent role at sea). |

See craftsmanship-aptitude.md for the full 9th aptitude design.

### War Council Summary

| Seat | Aptitude | Primary Effect | Scaling |
|---|---|---|---|
| Warlord | Command | Dice pool (offensive engine) | +1 die per level |
| Champion | Prowess | Damage boost | +2% per level |
| Marshal | Fortitude | Damage reduction | -2% per level |
| Spymaster | Cunning | Enemy debuff | -2% per level |
| Quartermaster | Stewardship | Upkeep/attrition/recovery | -2.5% per level |
| Herald | Presence | Routed troop rally + starting morale | +2% rally, +0.5 morale per level |
| War Maester | Lore | Wounded recovery + siege | +2% recovery per level |
| War Priest | Faith | Rout resistance + drain resist | -1.5% rout, -1% drain per level |
| Siege Master | Craftsmanship | Siege engine tier + build speed + repair | Tier gate + speed scaling |

### Defensive Stacking Example (All seats at aptitude 8)

```
Enemy deals 1000 base damage:
  × Spymaster debuff (1 - 0.16) = × 0.84 → 840
  × Marshal reduction (1 - 0.16) = × 0.84 → 706

Final damage taken: 706 (29.4% total reduction)
```

A full player War Council at high aptitudes has roughly double the defensive benefit of NPC defaults. Significant but not insurmountable.

---

## 10. The Damage Formula

### Core Formula: Command Dice Pool

Each engagement, both sides roll simultaneously:

```
Dice Pool     = Warlord's Command aptitude (1-10)
Roll          = [Command]d6, count successes on 4+ (50% per die)
Base Damage   = Successes × (Avg ATK × Total Men / 75)
```

**Consistent with single combat dice pools.** Command determines how many dice you roll. The army's stats determine how hard each success hits.

### Modifier Chain

```
ATTACKER CALCULATES:
  Base Damage = Successes × (Avg ATK × Total Men / 75)
  × Champion bonus     (1 + Prowess × 0.02)
  × Morale DR          (if attacker morale > 0: damage resistance doesn't apply to own attacks)
  × Advantage modifier (1 + Net Advantage × 0.03)
  = Raw Damage Out

DEFENDER RECEIVES:
  Raw Damage Out
  × Marshal reduction      (1 - Fortitude × 0.02)
  × Spymaster debuff       (1 - Cunning × 0.02)
  × Morale DR              (if defender morale > 0: 1 - morale × 0.01)
  = Final Damage Taken
```

### Worked Example: One Engagement

**Bolton** (620 men, Avg ATK 15.3, Command 7, Champion Prowess 7):
```
Dice: 7d6 → rolls 3, 5, 6, 2, 6, 4, 1 → 4 successes
Base Damage: 4 × (15.3 × 620 / 75) = 4 × 126.48 = 505.9
× Champion (1.14) = 576.7
```

**Stark** (980 men, Avg ATK 15.1, Command 5, Champion Prowess 5) defending:
```
Stark has Marshal Fortitude 6, Spymaster Cunning 5, Morale 12 (12% DR):
576.7 × (1 - 0.12) × (1 - 0.10) × (1 - 0.12) = 576.7 × 0.88 × 0.90 × 0.88 = 401.9

Bolton deals 401.9 HP damage to Stark.
```

**Stark attacks simultaneously:**
```
Dice: 5d6 → 3 successes
Base: 3 × (15.1 × 980 / 75) = 3 × 197.31 = 591.9
× Champion (1.10) = 651.1

Bolton has Marshal Fortitude 4, Spymaster Cunning 8, Morale 14 (14% DR):
651.1 × (1 - 0.08) × (1 - 0.16) × (1 - 0.14) = 651.1 × 0.92 × 0.84 × 0.86 = 432.6

Stark deals 432.6 HP damage to Bolton.
```

Despite fewer successes, Stark's larger army produces comparable damage per engagement due to the men multiplier. Bolton's superior Spymaster (Cunning 8) significantly blunted Stark's advantage.

### Zero Successes

A roll of zero successes is possible (Command 10: ~0.1% chance; Command 3: ~12.5% per engagement). This represents a disastrous engagement — disorganized attack, nothing connects. Rare at high Command, occasional at low Command. Whiffs are acceptable given their rarity.

### Balancing Lever

The **/75 divisor** in the damage formula is the primary balance knob, validated via simulation (warfare-sim.js). Adjusting it tunes how long battles last:
- /50 → very short, extremely bloody
- /75 → standard pacing (current, simulation-validated)
- /100 → longer wars of attrition
- /150 → extended siege-like grinding

---

## 11. Morale

Morale is a **sliding scale** that continuously affects army performance. It is not a binary break point — it's a spectrum from inspired to crumbling.

### The Morale Scale

```
       INSPIRED          BASELINE          CRUMBLING
  ◄──────────────────────────┼──────────────────────────────►
  20    15    10    5    0    -1    -5    -10    -15    -20
  ├── Damage Resistance ──┤    ├── Troops Rout Per Engagement ─┤
  20%   15%   10%   5%  0%   0.5%  2.5%   5%    7.5%   10%
```

**All armies start at 10.** Pre-battle modifiers shift this before the first engagement.

**Morale is hard-capped at -20 and +20.** No effect can push morale beyond these bounds. At +20 the army has maximum conviction (20% DR). At -20 the army is in full collapse (10% rout/tick) — but it cannot get worse. This cap prevents runaway death spirals where dragon terror or cascading losses make morale meaninglessly negative.

### Positive Morale (Above 0): Damage Resistance

Each point of positive morale = **1% damage resistance** applied to all incoming damage.

- Morale 10 (baseline): 10% DR — the army is steady
- Morale 15: 15% DR — inspired, fighting hard
- Morale 20+: 20%+ DR — nearly unstoppable conviction

### Negative Morale (Below 0): Troop Routing

Each point below 0 = **0.5% of Levymen and Men-at-Arms rout per engagement.**

- Morale -1: 0.5% per engagement
- Morale -5: 2.5% per engagement
- Morale -10: 5% per engagement

**Elites never rout from morale.** They're sworn, armored, professional. They fight until ordered to withdraw or killed. At deeply negative morale, all levies and MaA have deserted — what remains is the elite core, still fighting.

Routed men enter the **routed pool** (see next section). They are not dead.

### Starting Morale Modifiers

Base is always 10. These adjust before the first engagement:

| Factor | Modifier | Source |
|---|---|---|
| Herald (Presence) | +0.5 per level | War Council |
| Defending homeland | +3 | Situational |
| Outnumbered 2:1+ | -3 | Situational |
| Outnumbered 3:1+ | -5 | Situational |
| Recent victory (7 days) | +2 | History |
| Recent defeat (7 days) | -2 | History |
| Well-supplied | +2 | Quartermaster |
| Poorly supplied | -3 | Logistics |
| Friendly dragon | +Tier | Dragon (T5 = +5, T3 = +3, etc.) |
| Enemy dragon | -Tier | Dragon (T5 = -5, T3 = -3, etc.) |
| Warlord Renown | +1 to +3 (or -1 to -3) | Track record |

**Practical range:** A demoralized force might start at 3-4. An inspired homeland defense with a legendary commander and dragon might start at 22-23.

### Per-Tick Morale Changes

After all engagements resolve:

**Morale Range:** -10 to +10 (capped). Simplified to damage comparison only — no HP% drain, no warlord/champion death modifiers (warlords and champions are no longer killed in WBS).

**Per-Tick Damage Comparison:**

| Situation | Morale Change |
|---|---|
| Dealt 2:1+ more damage than taken | +2 |
| Dealt more damage than taken (>10% difference) | +1 |
| Roughly even (within 10%) | 0 |
| Took more damage than dealt (>10% difference) | -1 |
| Took 2:1+ more damage than dealt | -2 |

**Situational Modifiers (constant per tick while active):**

| Event | Change |
|---|---|
| Friendly dragon active | +2 per tick |
| Enemy dragon active | -2 per tick |
| Enemy dragon strafing | -2 per tick + Terror value drain (see dragon-system.md §4) |
| Supply cut off | -1 per tick |
| Reinforcements arrive | +3 (one-time) |

### Morale Spirals

The simplified system produces controlled spirals. An army that consistently loses engagements will drop morale at -1 to -2 per tick, reaching rout territory (-5 to -10) in 3-5 ticks. An army that consistently wins will climb at the same rate, gaining DR that further compounds their advantage.

Dragon presence is the strongest morale lever — a +2/-2 per tick swing means the dragon army trends toward +4 net morale advantage per tick, creating a decisive edge in equal matchups (simulation shows 75% win rate for dragon army in mirror matches).

The critical moment is when morale crosses 0. Above 0, you're buffered. Below 0, you're hemorrhaging. A smart Warlord orders retreat while morale is still positive.

---

## 12. The Routed Pool

The routed pool is the mid-battle accumulator for men who desert due to negative morale. It is not a separate phase — routing happens continuously within the Battle phase.

### The Flow

```
ARMY (fighting)                    ROUTED POOL (accumulated)
      │                                    │
      ├── OUTFLOW (per engagement) ──────► │
      │   Levy + MaA desert when           │
      │   morale < 0                       │
      │   WAR PRIEST reduces this          │
      │                                    │
      │ ◄── INFLOW (per tick) ────────────┤
      │     Herald rallies men back        │
      │     to the army                    │
```

### Routing Rate (Outflow — Per Engagement)

When morale is below 0:

```
Rout Rate = |Morale| × 0.5% of Levy + MaA
War Priest Reduction = Faith × 1.5%
Effective Rout Rate = Rout Rate × (1 - Faith × 0.015)
```

**Example at morale -6 with Faith 8 Priest:**
```
Base rout: 6 × 0.5% = 3.0% per engagement
Priest reduction: 8 × 1.5% = 12%
Effective: 3.0% × 0.88 = 2.64% per engagement
```

Elites never rout.

### Rally Rate (Inflow — Per Tick)

After all engagements resolve, the Herald rallies men from the routed pool:

```
Rally Rate = Presence × 2% of current routed pool
```

**Example with Presence 8 Herald, 200 men in routed pool:**
```
Rally: 8 × 2% = 16% of 200 = 32 men return to the army
```

Rallied men rejoin as their original unit type and are available for the next tick's engagements.

### The Balance of Flows

The battle is a war of flows:
- If **routing outpaces rallying**, the army is dying — men leave faster than the Herald can bring them back
- If **rallying keeps pace**, the army sustains at a degraded level — men desert during the day, straggle back at night
- **War Priest (Faith)** reduces outflow. **Herald (Presence)** increases inflow. They work opposite ends of the same pipe.

An army with a strong Herald AND strong Priest can fight at negative morale for extended periods. An army with neither collapses rapidly once morale goes negative.

### Post-Battle

When the battle ends, the routed pool consolidates into a **single routed unit**:
- Uses the same **pathfinding and movement speed** formulas as regular armies
- Pathfinds to home holdings immediately when the battle ends
- Moves at the speed of its slowest component
- Routed units are **not a fighting force** — if intercepted by an enemy army, they can be captured or destroyed with minimal resistance
- When routed men reach their home holding, they rejoin the garrison/manpower pool

The loss is temporary — it cost time, not lives. But time matters enormously in a 24-hour tick world.

---

## 13. Advantage

Advantage represents tactical superiority — better positioning, terrain, intelligence, and preparation. The side with Advantage deals more effective damage.

### How Advantage Works

**Net Advantage = Your Advantage - Their Advantage**

Each point of net Advantage = **3% damage modifier**.

- Net +5 → +15% damage dealt
- Net 0 → even fight
- Net -3 → -9% damage dealt

### Sources of Advantage

| Source | When Determined | Magnitude | Notes |
|---|---|---|---|
| **Terrain DEF** | Maneuver | +2 to +4 | DEF 1 = +2, DEF 2 = +4. Defender only. |
| **Fortifications** | Maneuver | +3 to +8 | Defending a holding. Size 1 (Military) highest bonus, Size 3 (Civilian) lowest. |
| **Scouting superiority** | Maneuver | +1 to +3 | Cunning vs Cunning contest. |
| **War Maester analysis** | Maneuver | +1 | Lore 6+ required. |
| **Numerical superiority** | Each tick | +1 to +3 | Diminishing. 2:1 = +2. 3:1 = +3. Cap +3. |
| **Supply advantage** | Each tick | +1 to +2 | Well-supplied vs starving enemy. |
| **Cultural synergy** | Battle start | +2 | 80%+ same region. |
| **Sabotage** | Maneuver | +1 to +2 | Successful Spymaster action. |

### Advantage Shifts During Battle

Most Advantage is locked during Maneuver. This makes Maneuver decisions consequential. Some sources shift during Battle (numerical superiority changes as casualties mount, supply situations evolve).

### Example

Bolton defends a hilltop castle: terrain +2, fortification +5, scouting win +2, War Maester +1 = **+10 Advantage**.
Stark attacks uphill: numerical superiority 2:1 = +2, good supply +1 = **+3 Advantage**.

Net: Bolton +7 = **+21% damage** for Bolton. Stark is marching into a fortified position against an enemy who saw them coming. They need overwhelming numbers or a long siege.

---

## 14. The Warlord's Decision

### 14.1 The Three Decisions

Each tick during the Battle phase, the Warlord makes a single decision:

| Decision | Effect |
|---|---|
| **Fight** (default) | Battle continues. Engagements resolve normally this tick. |
| **Retreat** | Army begins organized withdrawal. No engagements resolve. See §14.5. |
| **Surrender** | Army offers surrender. Battle pauses. See §14.4. |

If the Warlord does not check in, the default is **Fight**. The battle continues automatically. All War Council seat bonuses are passive — they apply every tick without requiring input from the players filling those seats.

The **Warlord Gambit System** (§14.2) allows players to pre-configure conditional rules that automate this decision. If a Warlord has gambits configured, the system evaluates them before applying the default.

### 14.2 The Warlord Gambit System

Extending the dragon gambit system (see `dragon-system.md` §4) to Warlords. Each Warlord can configure a **decision loadout** — an ordered list of conditional rules evaluated top-to-bottom at the start of each tick, before engagements resolve. The first rule whose condition is satisfied determines the Warlord's decision for that tick.

```
PRIORITY   CONDITION                                    ACTION
--------------------------------------------------------------------
  1        If army HP below 15%                       -> Surrender
  2        If morale below -8                         -> Retreat
  3        If War Council alive < 3 AND morale < 0    -> Retreat
  4        Always                                     -> Fight
```

**Evaluation timing:** Warlord gambits evaluate at the **start of the tick** (step 0), before engagements resolve. The gambit reacts to the state at the end of the previous tick. If a gambit triggers Retreat or Surrender, the current tick's engagements do not resolve — the decision takes effect immediately.

A Warlord who sees his army crumbling at dawn orders the retreat before another engagement begins.

#### 14.2.1 Gambit Slots

Warlords may configure up to **8 gambit rules**. This is deliberately fewer than the dragon gambit system — a Warlord's decision space is smaller (three actions vs. four dragon actions with target selectors). Eight slots provide enough room for nuanced conditional behavior without creating analysis paralysis.

If no gambits are configured, the Warlord defaults to **Fight** every tick (identical to current behavior). If no gambit rule matches (all conditions evaluate false and no "Always" fallback is set), the default is also **Fight**. A misconfigured loadout never accidentally surrenders.

#### 14.2.2 Conditions

Warlord gambit conditions use the same syntax and logical operators as dragon gambits: IF, AND, OR, NOT, with parentheses for grouping.

**Army State Conditions:**

| Condition | Description |
|---|---|
| **Army HP above/below X%** | Current army HP as percentage of starting HP this battle |
| **Army men above/below X** | Raw headcount of living men |
| **Morale above/below X** | Current morale value (range: -20 to +20) |
| **Elites remaining above/below X%** | Percentage of starting elites still alive |
| **Routed pool above/below X%** | Percentage of total army in the routed pool |

**War Council Conditions:**

| Condition | Description |
|---|---|
| **War Council alive = / > / < N** | Count of occupied, living War Council seats |
| **[Seat] alive** | A specific seat is still occupied (e.g., "Champion alive") |
| **[Seat] dead or captured** | A specific seat has been lost |

**Enemy Conditions:**

| Condition | Description |
|---|---|
| **Enemy army HP above/below X%** | Enemy army's HP as a percentage |
| **Enemy morale above/below X** | Enemy army's current morale |
| **Enemy has dragon** | True if an enemy dragon is active on the battlefield |
| **Enemy dragon count = / > / < N** | Number of active enemy dragons |

**Battle Conditions:**

| Condition | Description |
|---|---|
| **Tick count above/below X** | Ticks the battle has been in the Battle phase |
| **Advantage net above/below X** | Your net Advantage minus enemy net Advantage |
| **Friendly dragon active** | True if a friendly dragon is on the battlefield |
| **Friendly dragon dead or fled** | True if the army's dragon has been killed or withdrawn |

**Universal:**

| Condition | Description |
|---|---|
| **Always** | Always true. Used as the final fallback rule. |

#### 14.2.3 Actions

There are exactly three Warlord gambit actions:

| Action | Effect |
|---|---|
| **Fight** | Continue battle. Engagements resolve normally this tick. |
| **Retreat** | Begin organized withdrawal. See §14.5. |
| **Surrender** | Offer surrender. Battle pauses. See §14.4. |

There is no "Offer Terms" as a separate action. Surrender *is* the offer — what those terms are is negotiated during the pause. This keeps the action space minimal and consistent.

#### 14.2.4 Default Gambit (If None Configured)

No gambits configured means Fight every tick. Identical to current behavior — an absent Warlord defaults to Fight.

**Suggested starter loadout** (provided as a template players can customize):

```
PRIORITY   CONDITION                              ACTION
------------------------------------------------------------
  1        If army HP below 10%                  -> Surrender
  2        If morale below -10 AND army HP < 30% -> Retreat
  3        Always                                -> Fight
```

#### 14.2.5 Interaction with Dragon Gambits

Warlord gambits and dragon gambits evaluate in sequence, not simultaneously:

1. **Warlord gambit evaluates first** (step 0).
2. If the Warlord chooses Retreat or Surrender, **dragon gambits do not evaluate**:
   - On **Retreat**: the dragon automatically Withdraws (or attempts Disengage if in a duel, with standard AoO risk).
   - On **Surrender**: the dragon automatically Withdraws. Dragons cannot be surrendered — they are living creatures, not property. The dragon returns to its lair or the rider's nearest holding.
3. If the Warlord chooses Fight, **dragon gambits evaluate normally** (step 1).

A Warlord's decision to retreat or surrender overrides all dragon behavior.

#### 14.2.6 Manual Override

A player Warlord can **always override their own gambits** with a manual decision before the tick resolves. The gambit system is an automation layer, not a constraint.

**Priority order:**
1. Manual decision (if submitted before tick resolution)
2. Gambit evaluation (if gambits are configured)
3. Default: Fight

#### 14.2.7 Example Warlord Gambit Loadouts

**Stannis Baratheon — "Bend or Break"**

| # | Condition | Action |
|---|---|---|
| 1 | If army HP below 5% | Surrender |
| 2 | Always | Fight |

Two rules. Fight until the army is functionally destroyed, then yield.

**Tywin Lannister — "Calculated Withdrawal"**

| # | Condition | Action |
|---|---|---|
| 1 | If morale below -6 AND enemy army HP above 50% | Retreat |
| 2 | If army HP below 25% AND enemy has dragon | Retreat |
| 3 | If War Council alive < 4 | Retreat |
| 4 | Always | Fight |

Retreats when the battle is unwinnable. Preserves his army for the next engagement. Never surrenders.

**Robb Stark — "The Young Wolf"**

| # | Condition | Action |
|---|---|---|
| 1 | If army HP below 15% AND morale below -5 | Retreat |
| 2 | Always | Fight |

Aggressive but not suicidal. Pulls back before destruction.

**Cersei Lannister — "Wildfire or Nothing"**

| # | Condition | Action |
|---|---|---|
| 1 | Always | Fight |

One rule. Never retreats, never surrenders. Bad strategy. The system allows it.

### 14.3 Warlord Gambit Worked Example

**Scenario:** Bolton army (2,100 men, morale -4) vs. Stark army (3,800 men, morale 8). Bolton has dragon Sunfyre (T4). Tick 7 of the Battle phase.

**Bolton Warlord gambit loadout:**

```
1. IF army HP below 20%                         -> Surrender
2. IF morale below -8 AND friendly dragon dead   -> Retreat
3. IF morale below -5 AND enemy has dragon       -> Retreat
4. Always                                        -> Fight
```

**Tick 7 evaluation:**
- Rule 1: Army HP is ~45%. **False.** Skip.
- Rule 2: Morale is -4, not below -8. **False.** Skip.
- Rule 3: Morale is -4, not below -5. **False.** Skip.
- Rule 4: Always. **True.** Action: **Fight.**

Bolton fights. Heavy casualties. Morale drops to -7.

**Tick 8 evaluation:**
- Rule 1: Army HP is ~32%. **False.** Skip.
- Rule 2: Morale is -7, not below -8. Sunfyre alive. **False.** Skip.
- Rule 3: Morale is -7, IS below -5. But Stark has no dragon. **False.** Skip.
- Rule 4: Always. **True.** Action: **Fight.**

Bolton fights again. Morale drops to -9.

**Tick 9 evaluation:**
- Rule 1: Army HP is ~22%. **False.** Skip.
- Rule 2: Morale is -9, IS below -8. Sunfyre withdrew last tick (dragon gambit triggered at 30% HP). **True.** Action: **Retreat.**

Bolton retreats. No engagements resolve this tick. Retreat begins immediately (§14.5).

### 14.4 Surrender Flow

#### 14.4.1 Offering Surrender

Surrender can be triggered in three ways:
1. **Manual decision** — the Warlord submits a surrender choice between ticks.
2. **Gambit trigger** — a gambit rule evaluates true with the Surrender action.
3. **Herald diplomacy** — during the Maneuver phase, the Herald can offer surrender preemptively (before Battle begins). Same flow applies.

When surrender is offered:

1. **The battle pauses.** The current tick does not resolve (no engagements, no damage, no routing).
2. **The opposing Warlord is notified** that surrender has been offered.
3. **A 24-hour response window begins.** The opposing Warlord has one full tick (24 real hours) to respond.

#### 14.4.2 The Pause

During the pause:
- **No combat occurs.** Both armies hold position.
- **Morale is frozen.** No morale changes.
- **Routing stops.** Men do not desert. The pause represents a ceasefire.
- **Dragon behavior freezes.** Dragons do not strafe, intercept, or withdraw. If a dragon duel was in progress, it resolves to completion before the pause takes effect.
- **The surrendering side cannot withdraw the offer** once submitted.
- **Wounded recovery continues.** The War Maester tends the wounded during the ceasefire.

#### 14.4.3 Response Options

| Response | Effect |
|---|---|
| **Accept** | Battle ends. Surrender terms apply (§14.4.5). All characters on the surrendering side are auto-captured (0% escape). |
| **Reject** | Battle resumes next tick. The surrendering side's decision defaults to **Fight** (they can submit a new manual choice or their gambits re-evaluate). |
| **No response** (timeout) | After 24 hours, the battle **resumes automatically**. Same as Reject. |

**Why no auto-accept:** Accepting a surrender may not be in the winning side's interest. A lord who wants the enemy dead, not captured, may prefer to continue fighting. This has consequences (§14.4.6), but it is a valid tactical choice.

#### 14.4.4 Repeated Surrender Offers

If surrender is rejected and the battle resumes, the Warlord can offer surrender again on any subsequent tick. There is no cooldown. However, each surrender offer costs a tick of pause — which means:
- The surrendering army gets one tick of no combat (beneficial if morale is in freefall).
- The winning army is delayed by one tick.

A Warlord who spam-surrenders to stall is burning credibility for a minor delay. Staff may intervene if clearly abusive, but the one-tick cost is its own deterrent.

#### 14.4.5 Surrender Terms

**Battlefield surrender is unconditional.** The losing army lays down arms, and the standard consequences apply:

| Consequence | Detail |
|---|---|
| **Auto-capture** | All characters attached to the surrendering army are captured. 0% escape. |
| **Ransom** | Base ransom = character's highest aptitude × 500 gold. War Council members command higher ransoms (§15). |
| **Army disbands** | Surrendering army ceases to exist as a fighting force. Surviving troops disarmed. |
| **Equipment captured** | All army equipment slots captured by the winner. |
| **Inventory captured** | 100% of the surrendering army's carried inventory taken (no 50% cap — you yielded everything). |

There is no "conditional surrender" on the battlefield. Negotiated terms belong in RP — through the Herald during Maneuver, or through diplomatic channels before battle. Once swords are drawn and you offer surrender mid-battle, it is unconditional.

**Siege surrender remains RP-only** (see `siege-mechanics.md` §9.1). The battlefield surrender mechanic applies only to field battles and naval engagements.

#### 14.4.6 Refusing a Yielded Army

When a Warlord rejects a surrender offer, the battle resumes. The rejection is noted. If the rejecting side subsequently captures characters from the surrendering army (through continued battle and failed escape checks), those characters were taken **after they attempted to yield**.

**Refusing surrender is NOT an Act of Tyranny.** It is a legitimate tactical choice — you may believe the enemy is stalling, or you may want total destruction rather than prisoners.

**However:**
- **Capturing characters who offered surrender and then executing them** = **Killing the Yielded** (Severe Act of Tyranny). They tried to surrender. They were refused. They fought on because they had no choice. Killing them after capture is butchery.
- **Accepting surrender and then killing the prisoners** = **Execution of Prisoners of War** (Severe Act of Tyranny).

The distinction: refusing surrender and continuing to fight is war. Killing people who tried to yield is murder.

### 14.5 Retreat Mechanics

#### 14.5.1 Ordering Retreat

Retreat can be triggered by manual decision or gambit. When ordered, it takes effect **immediately at the start of the tick**. No engagements resolve. The army begins withdrawal.

#### 14.5.2 Retreat Types

Retreat type is determined by the army's **morale at the time the retreat is ordered**:

| Retreat Type | Morale When Ordered | Recovery Duration | Pursuit Window | Retreat Speed | Rearguard Losses |
|---|---|---|---|---|---|
| **Clean withdrawal** | Above 5 | 2 ticks | 1 tick | 100% march speed | 2% of army |
| **Fighting retreat** | 0 to 5 | 3 ticks | 2 ticks | 75% march speed | 5% of army |
| **Desperate retreat** | Below 0 | 3 ticks + rout losses | 3 ticks | 50% march speed | 10% of army + continued rout losses |

**Rearguard losses** represent the cost of breaking contact. Even a clean withdrawal leaves men behind to hold the line while the bulk of the army withdraws.

#### 14.5.3 Retreat Direction

The retreating army must declare a **retreat destination** — a friendly holding or rally point. The army marches toward that destination using standard movement rules (terrain, road bonuses, Marshal forced march). If no destination is specified, the army retreats toward the nearest friendly holding automatically.

#### 14.5.4 Pursuit

The winning army may choose to **pursue** the retreating army. Pursuit is not automatic — the winning Warlord must decide to chase.

During the pursuit window (see table above):
- The pursuing army may engage the retreating army in combat each tick.
- Pursuit engagements use the standard damage formula with modified conditions:
  - Retreating army: **-3 Advantage** (disorganized, rear-facing)
  - Retreating Warlord: **-2 Command dice** (minimum 1)
  - Pursuing army: **+2 Advantage** (hunting a fleeing enemy)
- The retreating army **cannot change its decision** during pursuit. It is committed to retreating — it can only fight defensively.
- Pursuit ends when the window expires, the retreating army reaches a holding, or the pursuer breaks off.

**Why pursuit is optional:** The pursuing army delays its own recovery phase while chasing. Pursuit extends the campaign at the cost of rest and reorganization.

#### 14.5.5 Retreat vs. Rout

| | Retreat | Rout |
|---|---|---|
| **Trigger** | Warlord decision (manual or gambit) | Army HP reaches 0, or all non-elite troops rout |
| **Organization** | Organized withdrawal. Army remains a single formation. | Disorganized collapse. Army breaks into the routed pool. |
| **Command** | Warlord maintains command. War Council still functions. | No command. War Council members roll escape checks individually. |
| **Fighting ability** | Can fight defensively during pursuit (at penalty). | Cannot fight. Routed unit is defenseless. |
| **Destination** | Warlord chooses destination. | Routed pool pathfinds home automatically. |
| **Recovery** | Enters recovery phase at destination. Army intact. | Men trickle back over many ticks. Army must be re-mustered. |
| **Escape chance** | Per retreat type (90% / 70% / 45%). | 25% base (army depleted). |

**The critical insight:** A Warlord who retreats while the army is still functional preserves it. A Warlord who fights until collapse loses it entirely. The gambit system exists precisely to automate the "retreat before it's too late" decision.

### 14.6 Naval Surrender & Retreat

The same mechanics apply at sea with the following modifications:

| Mechanic | Naval Variant |
|---|---|
| **Surrender pause** | Identical. 24-hour response window. |
| **Auto-capture** | All characters captured. Ships become prizes — winner gains 50% of surviving fleet HP as captured ships. |
| **Retreat direction** | Nearest friendly port. Fleet sails directly. |
| **Pursuit at sea** | Same as land pursuit but uses naval speed. Retreating fleet suffers -25% speed penalty (damaged ships slow the fleet). |
| **Rout at sea** | Routed ships return to home harbor. Unlike land rout, routed ships that reach harbor are intact — they sailed home. |

### 14.7 Interaction Summary

```
TICK BEGINS
    │
    ├── Step 0: WARLORD DECISION
    │     │
    │     ├── Manual override submitted? → Use it.
    │     │
    │     ├── No manual → Evaluate gambit loadout top-to-bottom.
    │     │     First matching rule fires.
    │     │     No match → default FIGHT.
    │     │
    │     ├── FIGHT → Proceed to Step 1 (dragon gambits, combat, etc.)
    │     │
    │     ├── RETREAT → Skip combat. Begin withdrawal (§14.5).
    │     │     Dragon auto-withdraws. Tick ends.
    │     │
    │     └── SURRENDER → Skip combat. Initiate pause (§14.4).
    │           Dragon auto-withdraws. Opponent has 24h to respond.
    │           Accept → Battle ends. Auto-capture.
    │           Reject / Timeout → Battle resumes next tick.
    │
    └── Steps 1-9: Normal combat resolution (if FIGHT)

TICK ENDS
```

### Design Rationale

**Why extend the gambit system?** The dragon gambit model is already designed, validated, and familiar. Using the same IF/THEN/top-to-bottom model for Warlords creates consistency. The UI can reuse the same visual builder with different condition/action dropdowns.

**Why 8 gambit slots?** Warlord decisions are simple (3 actions, no targets). Eight slots are more than sufficient — the worked examples use 1-4 rules each.

**Why evaluate at start-of-tick?** Moving evaluation to step 0 means retreat/surrender triggers *before* the next round of bloodshed. A Warlord who set a condition made a strategic decision, and the system respects it without adding one more day of losses.

**Why is battlefield surrender unconditional?** The battlefield is not the place for complex diplomacy. Unconditional surrender incentivizes negotiating through the Herald during Maneuver instead. If you wait until mid-battle to yield, you yield everything.

**Why can the opponent reject surrender?** This is a feudal world with brutal politics. A lord may want his enemy dead, not ransomed. The system doesn't force mercy — it makes cruelty expensive through the Act of Tyranny framework.

---

## 15. Post-Battle: Aftermath & Recovery

### Post-Battle Flow

```
BATTLE ENDS
    │
    ├── WINNING ARMY → Recovery Phase (2-4 ticks)
    │     Cannot march, cannot attack.
    │     Tend wounded, reorganize, morale recovers.
    │     CAN be attacked (vulnerable).
    │
    ├── LOSING ARMY → Two outcomes:
    │     │
    │     ├── Warlord ordered retreat
    │     │     Army withdraws as organized force.
    │     │     Recovery phase at destination.
    │     │
    │     └── Army depleted
    │           All remaining men join routed pool.
    │           No organized retreat.
    │
    └── ROUTED POOL → Consolidates into ONE unit.
          Pathfinds home using standard army movement.
          Begins moving immediately when battle ends.
```

### Recovery Phase

**Base duration: 3 ticks.** Modifiers:

| Factor | Effect |
|---|---|
| Quartermaster (Stewardship 6+) | -0.5 ticks |
| Quartermaster (Stewardship 9+) | -1 tick |
| Decisive victory | -1 tick |
| Pyrrhic victory (lost 40%+ of army) | +1 tick |
| Recovering inside a holding | -1 tick |

**Minimum: 1 tick.** Even the most efficient army needs a day.

**During recovery:**
- Wounded pool heals (War Maester Lore determines rate)
- Morale drifts toward baseline 10 at +2 per tick
- Army reforms and reorganizes
- War Council plans next moves
- Reinforcements and rallied scattered troops can arrive

**Critical vulnerability:** An army in recovery CAN be attacked. A second enemy army arriving during recovery forces battle in a weakened state.

### Retreat Types

See §14.5 for full retreat mechanics including pursuit, rearguard losses, and the distinction between retreat and rout.

| Retreat Type | Morale When Ordered | Recovery Duration | Pursuit Window | Rearguard Losses |
|---|---|---|---|---|
| Clean withdrawal | Above 5 | 2 ticks | 1 tick | 2% of army |
| Fighting retreat | 0 to 5 | 3 ticks | 2 ticks | 5% of army |
| Desperate retreat | Below 0 | 3 ticks + rout losses | 3 ticks | 10% of army + continued rout losses |

### The Routed Unit

All men in the routed pool at battle's end consolidate into a single unit:
- Pathfinds home using **standard army movement speed formulas**
- Moves at the speed of its slowest component
- Begins moving immediately when the battle ends
- **Not a fighting force** — can be intercepted and captured/destroyed
- Arrives home and rejoins the holding's manpower pool
- The loss is temporary (time, not lives) but time is a critical resource

### Escape & Capture

When a battle ends, every character attached to the **losing army** (War Council members, player characters traveling with the army) rolls an escape check. This determines whether they evade capture or are taken prisoner.

**Base Escape Chance (by defeat type):**

| Defeat Type | Base Escape % | Context |
|---|---|---|
| **Clean withdrawal** (morale > 5) | 90% | Organized retreat, bodyguards intact |
| **Fighting retreat** (morale 0–5) | 70% | Chaotic but still some order |
| **Desperate retreat** (morale < 0) | 45% | Rout conditions, every man for himself |
| **Army depleted** | 25% | No army left, surrounded |
| **Surrender** | 0% | Automatic capture — you laid down arms. See §14.4. |

**Modifiers:**

| Factor | Modifier | Reasoning |
|---|---|---|
| Character's Cunning | +3% per level | Evasion, disguise, knowing when to run |
| Character's Prowess | +2% per level | Fighting through pursuit |
| Enemy Spymaster Cunning | -3% per level | Organized manhunt, scouts hunting you |
| Enemy numerical superiority | -5% | More men searching |
| Battle on home terrain | +10% | Know the land, locals help hide you |
| Character's Fortitude 7+ | +5% | Endurance to flee through harsh terrain |

**Outcomes:**
- **Escape** — character flees to nearest friendly holding
- **Capture** — character is taken prisoner (ransom, hostage, execution — details outside this document's scope)

**Retreat costs lives.** The Warlord can order retreat at any time during the Battle phase, but retreating under pressure costs additional casualties. The worse the situation when retreat is ordered, the more men are lost covering the withdrawal.

**Example:**
```
Bolton loses — desperate retreat (base 45%)

Warlord (Cunning 4, Prowess 3):
  45% + (4 × 3%) + (3 × 2%) = 63%
  Enemy Spymaster Cunning 8: -24%
  Final: 39% escape chance

Champion (Cunning 2, Prowess 9):
  45% + (2 × 3%) + (9 × 2%) = 69%
  Enemy Spymaster: -24%
  Final: 45% — fighting skill helps break through
```

A powerful enemy Spymaster makes escape very difficult. Cunning is the primary escape stat — the shrewd survive where the bold are caught.

### Casualty Recovery & Wounded

After battle, casualties are split into **dead** and **wounded** pools:

| Casualty Type | Percentage of Losses | Recovery |
|---|---|---|
| **Dead** | 60% of casualties | Permanent — these men are gone |
| **Wounded** | 40% of casualties | Recoverable over time |

**Wounded recovery rate:** The War Maester's Lore determines how many wounded rejoin the army per tick during recovery:

| War Maester Lore | Wounded Recovered/Tick |
|---|---|
| 0 (no War Maester) | 5% of wounded pool |
| 1-3 | 8% of wounded pool |
| 4-6 | 12% of wounded pool |
| 7-9 | 16% of wounded pool |
| 10 | 20% of wounded pool |

*Example: An army loses 1,000 men in battle. 600 are dead, 400 are wounded. With a Lore 7 War Maester, 64 wounded rejoin per tick (16% of 400). The full wounded pool recovers in ~7 ticks.*

### Battle Loot

The winning army can loot the battlefield after victory:

| Source | Loot |
|---|---|
| **Defeated army's inventory** | 50% of carried supplies (food, gold, materials). **100% if surrendered** (§14.4.5). |
| **Equipment** | Defeated army's equipment is captured intact (all 3 slots) |
| **Arms & armor** | Converted to gold: 1 gold per 10 dead enemies (scavenged weapons, stripped armor) |

Loot is limited by the winning army's **carrying capacity** (1 man = 100 KG). Excess is abandoned on the battlefield.

### Prisoners & Ransom

Captured characters (those who failed escape checks) become prisoners:

| Action | Effect |
|---|---|
| **Ransom** | Captor demands gold for release. Base ransom = character's highest aptitude × 500 gold. War Council members command higher ransoms. |
| **Hostage** | Character held as political leverage. No gold exchange, but used for negotiations. |
| **Execution** | Character is killed. Triggers an **Act of Tyranny** (Severe). Enemies gain +2 morale boost (martyrdom). |
| **Release** | Character freed without payment. Builds goodwill, may prevent future conflict. |

Prisoner mechanics are primarily **RP-driven** — staff adjudicates ransom negotiations and political consequences. The base ransom formula provides a starting point for negotiation.

### War Exhaustion

Prolonged wars drain a faction's ability to fight:

| Ticks at War | Effect |
|---|---|
| 0-30 | No penalty — war fervor sustains morale |
| 31-60 | -1 levy mustering rate (longer to raise new troops) |
| 61-90 | -2 levy mustering, -5% levy combat effectiveness |
| 91+ | -3 levy mustering, -10% levy effectiveness, NPC settlements may refuse call to arms |

**War exhaustion only affects levies** — Men-at-Arms and Elites are professional soldiers unaffected by civilian war weariness. Mercenaries are also unaffected (they fight for gold, not patriotism).

War exhaustion resets when a **formal peace** is declared (see war-conflict-framework.md). A ceasefire reduces exhaustion by 1 tier per 14 ticks of peace.

### Strategic Implications

- **Don't fight near enemy territory** unless you can handle a counterattack during recovery
- **Multiple armies matter** — while Army A recovers, Army B continues operations
- **Pursuit decisions** — letting the enemy retreat means their routed men come home eventually. Intercepting the routed unit with cavalry prevents that recovery.
- **Recovery phase prevents chain victories** — you can't steamroll from battle to battle without pause
- **Invest in Cunning** — a Warlord with low Cunning facing a high-Cunning Spymaster is as good as captured if the battle goes south
- **Retreat early or risk everything** — clean withdrawal at 90% escape is far better than desperate retreat at 45%. Know when to quit. The Warlord gambit system (§14.2) automates this decision for players who can't check in daily.
- **War Maester saves lives** — a Lore 10 War Maester recovers wounded 4× faster than no War Maester, turning a costly victory into a recoverable one
- **Long wars favor professionals** — war exhaustion cripples levy-dependent factions while MaA-heavy forces maintain full effectiveness

---

## 16. Mercenaries

*For the full mercenary system, see [mercenaries.md](mercenaries.md).*

Mercenary companies are **gold-for-swords** supplements to holding-based levies.

| Property | Mechanic |
|---|---|
| **Hiring** | Lump sum contract for X ticks + gold per tick ongoing |
| **Composition** | Fixed Levy/MaA/Elite ratio per company. Not customizable. |
| **Quality** | Generally MaA-heavy. Some elite companies are Elite-heavy. |
| **Availability** | Limited companies exist. First-come, first-served. |
| **Loyalty** | Fight as long as paid. 3-tick grace if unpaid, then desert. Betrayal by company reputation (see mercenaries.md §7-8). |
| **Cultural** | No regional passive. Don't count toward cultural synergy. Outsiders. |
| **Speed** | No mustering delay (already assembled). Standard march time. |
| **War Council** | Mercenary captains can fill empty War Council seats (~aptitude 5-6). |

### Example Companies (see mercenaries.md for full stats)

| Company | Size | Composition | Specialty |
|---|---|---|---|
| The Golden Company | Large (500+) | Heavy MaA + Elites | Premium, expensive, never breaks contract |
| The Second Sons | Medium (300) | Balanced | Versatile, moderate cost, flexible loyalty |
| The Brave Companions | Medium (250) | MaA heavy | Cheap, brutal, unreliable |
| Stormcrows | Small (150) | Light, fast | Scouting/screening. Captain can fill Spymaster seat. |

### Strategic Role

Mercenaries let a cash-rich, land-poor lord field an army. They plug composition gaps. They create economic warfare opportunities (force the enemy to bleed gold maintaining hired swords during a long war). They also create espionage opportunities — what if the enemy's mercenaries can be bribed?

---

## 17. Naval Combat

*For the full naval warfare system, see naval-warfare.md.*

### Ships — The Unit of the Sea

One generic ship type. No variant classes:

| Property | Value |
|---|---|
| **Crew** | 30 per ship |
| **Cargo Capacity** | 3,000 KG per ship |
| **Base Speed** | 0.007 px/s (flat, all fleets) |
| **Production** | Shipyard (port-flagged holdings only, Timber + Tiered Iron) |

Shipyard tier determines fleet capacity: T1 = 25 ships, T2 = 50, T3 = 75, T4 = 100, T5 = 150.

### Combat at Sea

Troops fighting at sea suffer a **-25% effectiveness penalty** to ATK and HP. Men-at-Arms and Elites retain their stat advantages over Levies, but all fight worse than on land. This represents poor footing on decks, armor liability near water, and unfamiliar combat environment.

Naval combat uses the **same tick-based systems** as land warfare:
- Same Command dice pool
- Same damage formula (Successes × Avg ATK × Total Men / Divisor) × 0.75 sea penalty
- Same War Council modifiers (all 9 seats apply)
- Same engagements per tick
- Same morale scale

Fleet HP is an **aggregate pool** — ship count is derived from remaining fleet HP. As fleet HP drops, ships are lost proportionally. Routed ships return to home harbor.

### Fleet Mechanics

For the full naval warfare system — fleet HP, ship-to-ship combat, routing, dragon interactions, blockades, embarkation/disembarkation — see **naval-warfare.md**.

Key design points:
- **Fleet HP is aggregate** — ship count derived from remaining HP pool
- **-25% sea combat penalty** — troops keep their stats but fight less effectively
- **Routed ships return home** — removed from battle but not destroyed
- **Flat 25 ships to blockade** any port settlement
- **Blockade + siege = total strangulation** — production halts completely
- **Dragons are mutually dangerous at sea** — fire spread on wooden ships, but open sky gives scorpions accuracy bonus
- **Embark/disembark costs 1 tick** each — army is stationary and vulnerable during transition

---

## 18. Open Questions

### Resolved — See Dedicated Documents
- ~~Siege Mechanics~~ — **RESOLVED.** See [siege-mechanics.md](siege-mechanics.md)
- ~~Holdings System~~ — **RESOLVED.** See [holdings-system.md](holdings-system.md)
- ~~Naval Warfare~~ — **RESOLVED.** See [naval-warfare.md](naval-warfare.md)
- ~~Mercenary System~~ — **RESOLVED.** See [mercenaries.md](mercenaries.md)
- ~~War & Conflict Framework~~ — **RESOLVED.** See [war-conflict-framework.md](war-conflict-framework.md)
- ~~Dragon System~~ — **RESOLVED.** See [dragon-system.md](dragon-system.md) and [dragon-bonding.md](dragon-bonding.md)
- ~~9th Aptitude~~ — **RESOLVED.** See [craftsmanship-aptitude.md](craftsmanship-aptitude.md)

### Remaining Design Work
- ~~Post-Battle & War Economy~~ — **RESOLVED.** §15 now includes casualty recovery (60% dead/40% wounded), wounded recovery rates by War Maester Lore, battle loot (50% of inventory + captured equipment), prisoner ransom (aptitude × 500 gold), and war exhaustion (levy penalties after 30+ ticks at war).
- **Bannerman & Alliance System** — calling banners, vassal obligations, combined armies. **Future document** — requires its own WBS doc covering feudal hierarchy, banner call mechanics, combined army command, and alliance diplomacy.
- **Player vs Dragon (Raid Boss)** — ground-based dragon encounter mechanics for non-rider combat. **Future document** — requires its own WBS doc covering ground-vs-dragon combat using the single combat system, scorpion targeting by individuals, and dragonslayer mechanics.
- ~~Dragon Strafe vs Settlement HP~~ — **RESOLVED.** See siege-mechanics.md §4.1 (formula: Tier² × 25 + Might × 10)
- ~~Siege Engine Damage Values~~ — **RESOLVED.** See siege-mechanics.md §3.3 (T1: 100/t through T5: 700/t)
- ~~Resource Weights~~ — **RESOLVED.** See holdings-system.md §6.1b
- ~~Gathering/Production Output Values~~ — **RESOLVED.** See holdings-system.md §8.2, §9.2

### Balancing & Tuning (Testing Phase)
- ~~Exact numbers for the /75 damage divisor~~ — **RESOLVED.** /75 validated via warfare-sim.js
- Engagement count brackets
- Morale drain/gain rates
- Advantage point values
- Regional trait bonus percentages
- Holding manpower curves
- Recovery phase durations
- Wounded pool recovery rates
- ~~Naval cascade tuning~~ — **CUT.** Cascade mechanic removed from design. Fire spread (30% chance, 100 dmg) replaces it.
- Blockade minimum fleet sizes
- Embarkation/disembarkation vulnerability windows
