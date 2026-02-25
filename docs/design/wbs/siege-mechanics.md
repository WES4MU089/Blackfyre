# Siege Mechanics — WBS Design Document

**Status:** Draft
**Last Updated:** 2026-02-25
**Related Documents:** holdings-system.md, warfare-foundation.md, dragon-system.md, war-conflict-framework.md

---

## 1. Overview

Sieges occur when an army surrounds a holding and attempts to take it through attrition, assault, or a combination of both. Sieges are long, grinding affairs — most are won through starvation rather than storming the walls.

**Core balance principle (simulation-validated):** A standard fortress requires approximately a **3:1 attacker-to-defender ratio** to reliably storm. Exceptional fortifications (The Eyrie, Storm's End) can require up to **5:1**. Dragons shift this by roughly 0.5:1 to 1:1 through morale pressure alone (before strafe damage).

---

## 2. Initiating a Siege

An army can besiege a holding by moving to its location and declaring a siege. Once a siege is declared:

- **Production within the settlement halts** — no resource generation on each tick
- **Food stores begin to deplete** — the garrison and population consume stored food each tick
- **Siege engine construction begins** — the besieging army starts building siege engines (requires ~7 ticks and Lumber resources)

### 2.1 Port Settlements Under Siege (Land Only)

If a settlement has a port and is besieged by land forces only (no naval blockade):

- Production decays by **50%** (not fully halted)
- Resource accumulation reduced by **50%**
- Food stores do **NOT** begin to bleed until the port is also **blockaded by a naval unit**

This reflects the ability to receive supplies by sea — a siege without a blockade is incomplete.

---

## 3. Settlement HP & Siege Engines

### 3.1 Settlement HP

Settlement HP represents the structural integrity of the settlement's defenses (walls, gates, towers). See holdings-system.md §4 for base values:

| | Size 1 | Size 2 | Size 3 |
|---|---|---|---|
| **Civilian** | 2,000 | 4,000 | 6,000 |
| **Hybrid** | 2,500 | 5,000 | 7,500 |
| **Military** | 3,000 | 6,000 | 9,000 |

Modified by: Fortified Walls installation, Special Slot traits.

### 3.2 Siege Engines

Siege engines are built on-site during the siege using **Siege Supplies** (produced at Siege Workshops) and **Lumber** carried by the army.

- **Build time:** ~7 ticks (1 week)
- **Resource requirement:** Lumber (carried in army inventory)
- **Aptitude requirement:** The army's **Siege Master** (War Council seat, Craftsmanship aptitude) determines the maximum tier of siege engines that can be built
- Once built, siege engines **damage Settlement HP each tick**

### 3.3 Siege Engine Damage Per Tick

Siege engine tier is gated by the Siege Master's Craftsmanship aptitude. Higher-tier engines deal more damage per tick.

| Engine Tier | Damage/Tick | Craftsmanship Required |
|---|---|---|
| T1 | 100 | Craftsmanship 1-2 |
| T2 | 200 | Craftsmanship 3-4 |
| T3 | 350 | Craftsmanship 5-6 |
| T4 | 500 | Craftsmanship 7-8 |
| T5 | 700 | Craftsmanship 9-10 |

**Siege Master build speed bonus:** Each point of Craftsmanship above the minimum for the tier reduces build time by 0.5 ticks (minimum 4 ticks).

**Breach pacing (ticks of bombardment after engines are built):**

| Target Settlement | HP | T1 (100/t) | T3 (350/t) | T5 (700/t) |
|---|---|---|---|---|
| Civilian S1, no walls | 2,000 | 20 | 6 | 3 |
| Military S2, T3 walls | 8,000 | 80 | 23 | 11 |
| Military S3, T5 walls | 14,000 | 140 | 40 | 20 |
| Storm's End (9k + 5k + 2k) | 16,000 | 160 | 46 | 23 |
| The Eyrie | Immune | — | — | — |

**Design intent:** Even T5 siege engines require 20+ ticks to breach a top-tier fortress after the 7-tick build delay (27+ ticks total). Starvation is faster for most large sieges. Against unfortified targets, engines are devastating — T5 can breach in 3 ticks.

### 3.4 Siege Engine Construction Costs

| Engine Tier | Siege Supplies | Lumber | Total Weight |
|---|---|---|---|
| T1 | 10 | 50 | 750 KG |
| T2 | 20 | 100 | 1,500 KG |
| T3 | 30 | 150 | 2,250 KG |
| T4 | 50 | 250 | 3,750 KG |
| T5 | 75 | 400 | 5,750 KG |

Armies must carry siege supplies and lumber in their inventory (see holdings-system.md §6.1b for resource weights). A T5 siege engine requires 5,750 KG of inventory space — affordable for a large army but a significant commitment.

### 3.5 Settlement Defenses During Siege

Defenders have two active countermeasures during a siege beyond passive repair (§3.6):

#### 3.5.1 Scorpion Batteries (Anti-Dragon Only)

Scorpion Batteries are **anti-dragon weapons only** — they do not fire at siege engines. Their role is to deter or destroy dragons strafing the settlement's walls.

**Scorpion Battery Stats (per tick):**

| Battery Tier | Bolts/Tick | Damage/Bolt | Total Damage/Tick |
|---|---|---|---|
| T1 | 2 | 15 | 30 |
| T2 | 3 | 20 | 60 |
| T3 | 4 | 25 | 100 |
| T4 | 5 | 30 | 150 |
| T5 | 6 | 40 | 240 |

**Hit chance vs dragons:** Uses the standard scorpion evasion mechanic — `getHitRate(max(agility, resilience))`. Agile dragons dodge bolts; armored dragons deflect them. See dragon-system.md §6 for the hit rate table.

**Multiple batteries:** Each Scorpion Battery in a defense slot fires independently. A Size 3 settlement with 3× T5 Scorpion Batteries fires 18 bolts/tick at a strafing dragon — enough to drive off or kill any dragon within a few ticks.

**Simulation-validated effectiveness (siege-sim.js):**

| Battery Config | Vhagar Breaches 8k Walls? | Survives? | Avg Ticks Active |
|---|---|---|---|
| No batteries | 100% | 100% | 14 |
| 1× T3 battery | 98% | 98% | 14 |
| 1× T5 battery | 14% | 14% (withdraws) | 11 |
| 2× T5 battery | 0% | 0% (withdraws ~6t) | 6 |
| 3× T5 battery | 0% | 0% (withdraws ~5t) | 5 |

**Design intent:** A single T5 battery makes dragon strafing risky but not suicidal. Two or more T5 batteries shut down dragon siege strafing entirely — the dragon is forced to withdraw before dealing meaningful wall damage. However, filling defense slots with batteries means sacrificing Fortified Walls, Watchtowers, or Garrisons. Defenders must choose: anti-dragon deterrence or raw fortification.

#### 3.5.2 Sorties Against Siege Engines

Defenders can **sortie** (sally out) from the settlement to attack siege engines directly. This is a deliberate tactical action, not automatic.

**Sortie mechanics:**
- The defender commits a portion of their garrison (minimum 500 men) to a sortie
- Sortie troops fight **outside the walls** — they lose all fortification bonuses
- The attacking army can intercept the sortie with a field engagement
- If the sortie reaches the siege engines, they deal damage based on troop count:

```
Sortie Damage to Engine = (Sortie Troops / 100) × 10 per tick of contact
```

A 1,000-man sortie deals 100 damage/tick to siege engines — enough to destroy a T1 engine in 2 ticks of contact. However, the attacking army will likely engage the sortie force, forcing a field battle outside the walls.

**Sortie risks:**
- Sortie troops fight without wall bonuses (lose Fortification Advantage)
- The full attacking army can engage the sortie force
- Losses from the sortie reduce the garrison permanently
- If the sortie force is destroyed or routed, those men are gone

**Strategic value:** Sorties are high-risk, high-reward. They're most valuable when:
- The attacker's field army is small relative to the garrison
- T1-T2 engines are the only threat (easily destroyed)
- The attacker has no reserves to intercept
- Desperate situations where siege engines will breach before relief arrives

### 3.6 Settlement Repair Rate

Defenders repair Settlement HP each tick during siege. Repair rate depends on the defending Siege Master's Craftsmanship.

| Factor | HP Repaired/Tick |
|---|---|
| Base repair rate | 50 |
| Per Craftsmanship level | +15 |
| **Maximum** (Craftsmanship 10) | **200** |

**Net damage examples (engine damage minus repair):**

| Scenario | Engine Dmg | Repair | Net Dmg/Tick | Notes |
|---|---|---|---|---|
| T1 engine vs Craftsmanship 5 | 100 | 125 | **-25** | Defenders out-repair — T1 engines useless |
| T2 engine vs Craftsmanship 5 | 200 | 125 | 75 | Slow progress |
| T3 engine vs Craftsmanship 10 | 350 | 200 | 150 | Steady progress despite max repair |
| T5 engine vs no Siege Master | 700 | 50 | 650 | Devastating against undefended |

A skilled Siege Master on defense can neutralize T1 engines entirely and dramatically slow T2-T3 engines. This makes the Craftsmanship aptitude valuable on both sides of a siege.

---

## 4. Dragon Siege Damage

Dragons bypass the 7-tick siege engine build time and damage Settlement HP directly from the first tick of siege.

- **Dragons are more effective than siege engines** at damaging Settlement HP
- **Settlement defenses fire back** at dragons each tick using the same scorpion battery mechanics from dragon-system.md
- Dragon siege damage uses **separate scaling** from the field battle strafe formula

### 4.1 Dragon Siege Damage Per Tick

**Formula: (Tier² × 25) + (Might × 10)**

Dragon siege damage uses separate scaling from the field battle strafe formula. Siege damage represents sustained fire directed at stone and timber fortifications — different from strafing troop formations.

| Dragon | Tier | Might | Siege Dmg/Tick | vs 8k HP (Mil S2/T3 walls) | vs 14k HP (Mil S3/T5 walls) |
|---|---|---|---|---|---|
| Arrax | T1 | 2 | 45 | 178 ticks | 311 ticks |
| Tyraxes | T1 | 2 | 45 | 178 ticks | 311 ticks |
| Stormcloud | T1 | 2 | 45 | 178 ticks | 311 ticks |
| Tessarion | T2 | 4 | 140 | 57 ticks | 100 ticks |
| Syrax | T2 | 6 | 160 | 50 ticks | 88 ticks |
| Vermax | T2 | 4 | 140 | 57 ticks | 100 ticks |
| Moondancer | T2 | 3 | 130 | 62 ticks | 108 ticks |
| Seasmoke | T3 | 5 | 275 | 29 ticks | 51 ticks |
| Sunfyre | T4 | 6 | 460 | 18 ticks | 31 ticks |
| Dreamfyre | T4 | 7 | 470 | 17 ticks | 30 ticks |
| Silverwing | T4 | 7 | 470 | 17 ticks | 30 ticks |
| Vhagar | T5 | 10 | 725 | 11 ticks | 19 ticks |
| Caraxes | T5 | 7 | 695 | 12 ticks | 20 ticks |
| Vermithor | T5 | 9 | 715 | 11 ticks | 20 ticks |
| Meleys | T5 | 7 | 695 | 12 ticks | 20 ticks |
| The Cannibal | T5 | 8 | 705 | 11 ticks | 20 ticks |

**Design validation:**
- **T1 fledgling:** 45 damage/tick against 8,000 HP = 178 ticks. Symbolic — a fledgling cannot meaningfully damage castle walls.
- **T3 war dragon:** 275-285/tick = walls fall in ~28 ticks. Meaningful siege acceleration, especially since dragons start from tick 1 (no 7-tick build delay).
- **T5 apex:** 695-725/tick = 11-12 ticks to breach a standard fortress. Devastating. Combined with T3 engines (350/tick), total ~1,050/tick = walls fall in ~8 ticks.
- **Settlement scorpion batteries** fire at strafing dragons each tick (see §3.5.1). Batteries are **anti-dragon only** — they do not target siege engines. Hit chance uses `max(agility, resilience)` for evasion (agile dragons dodge, armored dragons deflect).

### 4.2 Combined Arms Siege Timeline

**Simulation-validated (siege-sim.js): Military S2, T3 walls (8,000 HP), T3 engines + Vhagar, 1× T5 battery, Craft 5 defender:**

| Tick | Event | Wall HP |
|---|---|---|
| 1-7 | Vhagar strafes alone (725/tick − 125 repair), battery fires back | ~3,800 |
| 7 | Siege engines built | — |
| 8-10 | Vhagar (725) + T3 engine (350) − 125 repair = 950 net/tick | ~950 |
| ~11 | Vhagar withdraws (HP too low from battery fire) | ~725 |
| 12-14 | Engine alone (350 − 125 = 225 net/tick) | 0 |
| **~14** | **Walls breached** | — |

Without a dragon, the same siege takes **43 ticks** (7 build + 36 bombardment at 225 net/tick). With Vhagar, **~16 ticks** — dragons cut siege time by roughly 2/3 against standard fortifications.

Against heavily defended targets (2-3× T5 batteries), dragons are driven off within 4-6 ticks and contribute less — the siege falls back on engines and starvation.

---

## 5. Defender Advantage (Fortification Bonus)

Defenders fighting behind walls receive a Fortification Advantage bonus. This is the primary mechanic that enforces the 3:1 ratio for standard sieges and 5:1 for exceptional fortifications.

### 5.1 Advantage Sources

Fortification Advantage is the sum of three components:

| Source | Value | Notes |
|---|---|---|
| **Base Defender Bonus** | +4 | All settlements — represents being behind any walls |
| **Fortified Walls (T1–T5)** | +2 per tier (+2 to +10) | Defense slot installation |
| **Terrain** | +2 to +4 | Hills, mountains, chokepoints |
| **Watchtower Scouting** | +1 to +2 | Preparation from advance warning |
| **Special Slot Trait** | Varies | Staff-assigned per holding |

### 5.2 Fortification Tiers (Simulation-Validated)

| Fortification Level | Total Advantage | Ratio to Reliably Storm | Example Holdings |
|---|---|---|---|
| **Unfortified** | +4 | ~1.5:1 | Open camps, ruined keeps |
| **Weak Fort** (T1 walls) | +6 | ~2:1 | Minor holdfasts, watchtowers |
| **Modest Fort** (T2 walls) | +8 | ~2:1 | Small castles, walled towns |
| **Standard Fort** (T3 walls) | +10 | ~2.5:1 | Regional castles (e.g. Riverrun) |
| **Strong Fort** (T3 walls + terrain) | +12 | ~2.5:1 | Hilltop castles (e.g. Casterly Rock) |
| **Major Fort** (T4 walls + terrain) | +15 | ~3:1 | Great castles (e.g. Winterfell) |
| **Maximum Fort** (T5 walls + terrain) | +18 | ~3:1 | Fully upgraded capital fortresses |
| **Exceptional** (Special Slot) | +25 | ~5:1 | The Eyrie, Storm's End, The Bloody Gate |

### 5.3 Advantage Decay During Siege

As Settlement HP is reduced by siege engines or dragons, the Fortified Walls component of defender advantage degrades:

| Settlement HP % | Fortified Walls Effectiveness |
|---|---|
| 100% (full walls) | 100% of Fortified Walls bonus |
| 75% | 75% of Fortified Walls bonus |
| 50% (breach) | 50% of Fortified Walls bonus |
| 25% (crumbling) | 25% of Fortified Walls bonus |
| 0% (rubble) | 0% (Fortified Walls bonus lost entirely) |

**Base Defender Bonus (+4), Terrain, and Special Slot bonuses do NOT decay** — they represent inherent positional advantages that cannot be destroyed by siege engines.

### 5.4 Special Slot Fortification Examples

| Holding | Special Slot Bonus | Total w/ T5 Walls | Effective Ratio | Notes |
|---|---|---|---|---|
| **The Eyrie** | +15 (The Bloody Gate) | +25 | ~5:1 | Approach is the defense; immune to siege engines |
| **Storm's End** | +10 (Storm Wall) | +22 | ~4:1 | Magical construction, immune to naval blockade |
| **Moat Cailin** | +8 (Neck Chokepoint) | +20 | ~3.5:1 | Attackers can only engage with 50% of forces |
| **Casterly Rock** | +4 (The Rock) | +18 | ~3:1 | Mountain fortress, gold production bonus |
| **Harrenhal** | -4 (Ruined Grandeur) | +10 | ~2.5:1 | Huge garrison but ruined walls reduce defense |
| **King's Landing** | +3 (The Red Keep) | +17 | ~3:1 | Inner keep provides fallback defense |

### 5.5 Simulation Reference Data

*Validated with Monte Carlo simulation (1,000 runs per scenario, divisor /75, 4 engagements/tick):*

**Standard Fortress (+18 advantage):**

| Attacker Ratio | Attacker Win % | Avg Duration |
|---|---|---|
| 2:1 | 0% | — (defender wins) |
| 2.5:1 | ~45% | ~40 ticks |
| 3:1 | 100% | ~10 ticks |
| 3.5:1 | 100% | ~8 ticks |

**Exceptional Fortress (+25 advantage, e.g. The Eyrie):**

| Attacker Ratio | Attacker Win % | Avg Duration |
|---|---|---|
| 3:1 | 0% | — (defender wins) |
| 4:1 | ~83% | ~28 ticks |
| 5:1 | 100% | ~10 ticks |
| 6:1 | 100% | ~8 ticks |

**Dragon Morale Impact on Siege (+12 fort):**

| Attacker Ratio | Without Dragon | With Dragon (morale only) |
|---|---|---|
| 2:1 | 61% | 87% |
| 2.5:1 | 100% | 100% |
| 3:1 | 100% | 100% (faster) |

*Dragon morale shifts siege balance by roughly 0.5:1 worth of troops. Combined with strafe damage (see §4.1), dragons dramatically accelerate siege timelines — Vhagar can breach a top-tier fortress in 19 ticks solo.*

---

## 6. Starvation & Attrition

### 6.1 Food Depletion

Once a settlement is fully sieged (or a port settlement is both land-sieged and naval-blockaded):
- **Production halts entirely**
- **Food stores decrease each tick** based on garrison size and population
- When food stores reach **zero**, manpower begins to bleed

**Food consumption rate:** 100 food per 1,000 garrison troops + 50 food (flat, non-combatant population) per tick. See holdings-system.md §10.3 for full details.

**Starvation timeline examples (full food stores at siege start):**

| Settlement | Garrison | Food/Tick | T1 Warehouse | T5 Warehouse | Starvation (T1) | Starvation (T5) |
|---|---|---|---|---|---|---|
| Military S1 | 1,500 | 200 | 5,000 | 10,000 | 25 ticks | 50 ticks |
| Military S3 | 5,000 | 550 | 20,000 | 40,000 | 36 ticks | 73 ticks |
| Civilian S3 | 10,000 | 1,050 | 20,000 | 40,000 | 19 ticks | 38 ticks |
| Mil S3, extra garrison | 10,000 | 1,050 | 20,000 | 40,000 | 19 ticks | 38 ticks |

**Key insight:** Stuffing extra troops behind walls via a Garrison installation accelerates starvation. Garrison capacity increases troop cap but not food stores — more mouths to feed with the same reserves.

### 6.2 Manpower Bleed

After food is depleted:
- The settlement loses manpower each tick (starvation, desertion, disease)
- **Auto-surrender occurs only when manpower reaches 0** — there is no early auto-surrender
- Player-controlled settlements can **negotiate surrender at any time** through RP
- NPC settlements hold until manpower reaches 0

**Manpower bleed rate (after food = 0):**

| Ticks After Food Depletion | Bleed Rate | Notes |
|---|---|---|
| Ticks 1-4 | 2% of garrison/tick | Early starvation, desertion begins |
| Ticks 5-9 | 3% of garrison/tick | Disease and hunger compound |
| Ticks 10+ | 5% of garrison/tick | Full starvation, mass desertion |

**Example: Military Size 3, 5,000 garrison, after food runs out:**
- Ticks 1-4: lose 100 men/tick (400 total)
- Ticks 5-9: lose ~138 men/tick (690 total)
- Ticks 10+: lose ~196 men/tick (accelerating)
- **~35 ticks after food depletion to reach 0 manpower** (auto-surrender)

### 6.3 Starvation Combat Penalties

As food depletes and manpower bleeds, defenders fight with increasing penalties if they sally or are assaulted:

| Starvation Phase | Effect |
|---|---|
| Food below 50% | -2 morale (hunger begins to affect troops) |
| Food at 0% | -5 morale, -10% ATK and HP effectiveness |
| Manpower bleed active (ticks 1-4) | -7 morale, -15% ATK and HP |
| Manpower bleed active (ticks 5+) | -10 morale, -25% ATK and HP |

A starving garrison is not an effective fighting force. These penalties make sallying out increasingly desperate and storming the walls increasingly viable as the siege wears on.

---

## 7. Sally & Field Battle

Defenders can **sally out** from the settlement to engage the besieging army. This is treated as a **standard field battle** — the defenders lose their wall advantage and fight in the open.

Reasons to sally:
- Break the siege before starvation sets in
- Coordinate with an approaching relief army
- Destroy siege engines before they breach the walls
- Desperation when food is running out

---

## 8. Relief Armies

When a friendly army approaches to break a siege:

1. **Detection:** The besieging army may detect the approaching relief force via scouting/watchtower systems (advance warning based on detection range)
2. **Decision point:** The besieger can **lift the siege and withdraw** before the relief army arrives. Siege progress (engine damage to walls, positioning) is lost.
3. **If the besieger stays:** A **maneuver phase begins** (3 ticks for parlay before combat initiates). This is handled as a standard field battle.
4. **Once battle is joined:** The besieger can only **retreat or negotiate withdrawal** — they cannot lift the siege mid-battle.
5. **No force splitting:** The besieging army cannot divide forces to screen the walls while fighting the relief army.
6. **Garrison sally:** The garrison can sally out to combine forces with the relief army against the besieger.

---

## 9. Surrender & Capture

### 9.1 Surrender Conditions

- **Player-controlled settlements:** Surrender is purely RP negotiation. The defender can offer terms at any time.
- **NPC settlements:** Hold until manpower reaches 0, then auto-surrender.

### 9.2 Capturing a Holding

When a settlement falls (surrender or manpower depletion):

- The **attacker gains control** of the holding
- The attacker **inherits all damage** inflicted on the settlement (Settlement HP, infrastructure)
- The attacker becomes **responsible for repairs** until the holding is granted to someone else
- The attacker's **liege typically decides** whom the settlement is bestowed upon (through RP)
- The attacker **can loot the warehouse** — resources are transferred to the army's inventory, limited by available carrying capacity (1 man = 100 KG)

### 9.3 Sacking

After capturing a settlement, the attacker may choose to **sack** it instead of occupying it intact. Sacking is a short-term gain with devastating long-term consequences.

#### 9.3.1 Sacking Resource Payout

The sacking payout has two components:

```
Total Payout = Warehouse Contents + Settlement Value Bonus
```

**Warehouse Contents:** 100% of all resources currently stored in the settlement's warehouse are transferred to the attacker's army inventory (limited by carrying capacity — 1 man = 100 KG). Any excess that cannot be carried is **destroyed**, not left behind.

**Settlement Value Bonus:** A one-time gold payout representing looted wealth, stripped valuables, sold prisoners, and dismantled infrastructure. This gold is generated (not taken from the warehouse) — it represents the settlement's inherent value being consumed.

| Settlement Type | Size 1 Bonus | Size 2 Bonus | Size 3 Bonus |
|---|---|---|---|
| **Military** | 2,000 gold | 5,000 gold | 10,000 gold |
| **Hybrid** | 3,000 gold | 8,000 gold | 15,000 gold |
| **Civilian** | 5,000 gold | 12,000 gold | 25,000 gold |

**Modifiers to Settlement Value Bonus:**
- **Gold resource node present:** +50% bonus (rich settlement)
- **Market or Trade Hub (Special Slot):** +25% bonus
- **Already damaged/depleted:** -25% if settlement was starved below 50% manpower before capture (less to loot)

#### 9.3.2 Sacking Destruction

Sacking inflicts severe, long-term damage:

| Effect | Detail |
|---|---|
| **Defense installations** | All reduced by 2 tiers (minimum T0 = destroyed) |
| **Gathering buildings** | All reduced by 1 tier (minimum T0 = destroyed) |
| **Production buildings** | All reduced by 2 tiers (minimum T0 = destroyed) |
| **Warehouse** | Reduced by 2 tiers (minimum T1) |
| **Settlement HP** | Reduced to 25% of base (before Fortified Walls bonus) |
| **Manpower** | Reduced to 10% of maximum (civilian casualties, refugees) |
| **Manpower recovery** | Halved recovery rate for 30 ticks (~1 month) |
| **Production** | All production halted for 14 ticks (~2 weeks) |

#### 9.3.3 Act of Tyranny

Sacking triggers a **Severe** Act of Tyranny (see war-conflict-framework.md):

- **NPC settlements** in the same region gain a temporary loyalty penalty toward the sacker (-15 loyalty for 60 ticks)
- **NPC levies** are harder to muster from the sacked settlement's region (-25% levy mustering for 30 ticks)
- **Diplomatic consequences** — other houses may use the sacking as casus belli or refuse alliance
- **The Faith** condemns the action if the settlement had a Sept/Godswood — additional piety penalty

Sacking a settlement of the **same Faith** as the attacker doubles the Act of Tyranny penalty. Sacking during a declared war is slightly less severe than sacking during peacetime (which is treated as an **Extreme** Act of Tyranny).

#### 9.3.4 Strategic Calculus

Sacking is worthwhile when:
- You **cannot hold** the settlement (enemy relief coming, overextended supply)
- You need **immediate gold** to pay mercenaries or fund a campaign
- You want to **cripple an enemy's economy** for the long term
- The settlement is **enemy territory** you have no intention of keeping

Sacking is a bad idea when:
- You intend to **rule the territory** — you inherit the destruction
- The settlement belongs to a **potential ally** or neutral party
- Your **Faith alignment** matches the settlement's — doubled tyranny penalty
- You're trying to **win hearts and minds** — sacking generates lasting resentment

---

## 10. Siege Timeline Reference

Approximate pacing for a standard siege (no dragons, no relief):

| Event | Tick | Notes |
|---|---|---|
| Siege declared | 0 | Production halts, food begins depleting |
| Siege engines under construction | 0–7 | ~7 ticks to build |
| Siege engines begin hitting walls | 7+ | Settlement HP decreases each tick |
| Food stores depleted | Varies | Depends on garrison size vs stored food |
| Manpower bleed begins | After food = 0 | Garrison weakens over time |
| Walls breached (50% HP) | Varies | Assault becomes viable but costly |
| Walls crumble (0% HP) | Varies | Assault at reduced defender advantage |
| Auto-surrender | Manpower = 0 | NPC only; players can negotiate earlier |

### 10.1 Travel Time Reference

For strategic planning — approximate march times across Westeros:

- **Winterfell to King's Landing:** ~14 ticks (2 weeks)
- **Dorne to King's Landing:** ~24 ticks (3.5 weeks)
- **Naval travel:** Significantly faster than land marches

---

## 11. Combat Parameters (Simulation-Validated)

The following core combat parameters have been validated through Monte Carlo simulation (1,000 runs per scenario):

| Parameter | Value | Notes |
|---|---|---|
| **Damage Divisor** | /75 | Controls overall battle lethality |
| **Engagements per Tick** | 4 | Number of combat exchanges per 24-hour tick |
| **Advantage per Point** | 3% | Each point of net advantage = 3% damage modifier |
| **Morale Range** | -10 to +10 | Simplified system, damage comparison only |
| **Sea Combat Penalty** | -25% | ATK and HP effectiveness reduction at sea |

### 11.1 Battle Duration Reference

| Scenario | Avg Ticks | Notes |
|---|---|---|
| Equal armies (5k vs 5k) | ~14 | 2 weeks — balanced, decisive |
| Equal fleets (naval) | ~20 | Sea penalty extends battles |
| 3:1 vs standard fort (+18) | ~10 | Quick once threshold is met |
| 5:1 vs exceptional fort (+25) | ~10 | Same speed at correct ratio |

---

## Open Questions

- [x] Siege engine damage per tick by tier — **RESOLVED** §3.3
- [x] Dragon siege damage per tick by tier — **RESOLVED** §4.1 (formula: Tier² × 25 + Might × 10)
- [x] Settlement HP repair rate per tick — **RESOLVED** §3.6 (50 base + 15 per Craftsmanship level)
- [x] Food consumption rate per tick — **RESOLVED** §6.1 (100 per 1k troops + 50 flat)
- [x] Manpower bleed rate after food depletion — **RESOLVED** §6.2 (2%/3%/5% escalating)
- [x] Starvation combat penalty scaling — **RESOLVED** §6.3
- [x] Siege engine construction resource costs — **RESOLVED** §3.4
- [x] Sacking resource payout formula — **RESOLVED** §9.3.1 (warehouse contents + settlement value bonus by type/size)
- [x] Sacking Act of Tyranny severity level — **RESOLVED** §9.3.3 (Severe during war, Extreme in peacetime)
- [x] Scorpion Battery role — **RESOLVED** §3.5.1 (anti-dragon only, do NOT target siege engines; simulation-validated in siege-sim.js)
- [x] Can defenders target siege engines with sorties? — **RESOLVED** §3.5.2 (yes, sortie mechanics with field battle risk)
