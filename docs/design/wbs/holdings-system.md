# Holdings System — WBS Design Document

**Status:** Draft
**Last Updated:** 2026-02-25
**Related Documents:** warfare-foundation.md, siege-mechanics.md, war-conflict-framework.md, craftsmanship-aptitude.md

---

## 1. Overview

Holdings are the fundamental territorial unit in the Gauntlet warfare system. Each holding represents a settlement — from small fishing villages to massive capital cities. Holdings produce resources, muster troops, and serve as the strategic objectives of warfare.

---

## 2. Holding Properties

Every holding has two independent axes:

### 2.1 Type (Troop Composition & Economy)

Determines the quality and ratio of troops mustered, and the number of gathering/production slots available.

| Type | Levy % | Men-at-Arms % | Elite % | AvgATK | Gathering/Production Slots | Description |
|---|---|---|---|---|---|---|
| **Military** | 40% | 40% | 20% | ~34 | 2 each | Fortresses, castles, military outposts |
| **Hybrid** | 60% | 28% | 12% | ~25 | 3 each | Fortified towns, regional seats |
| **Civilian** | 80% | 17% | 3% | ~15 | 4 each | Cities, trade hubs, farming communities |

### 2.2 Size (Scale)

Determines manpower, defense slots, base Settlement HP, and overall scale.

| Size | Defense Slots | Description |
|---|---|---|
| 1 | 1 | Minor holdfasts, towers, small keeps, villages |
| 2 | 2 | Regional castles, fortified towns, mid-size cities |
| 3 | 3 | Major castles, large cities, capital-tier settlements |

---

## 3. Manpower

Manpower is determined by the combination of type and size. Civilian holdings have more bodies but lower troop quality; military holdings have fewer but superior troops.

| | Size 1 | Size 2 | Size 3 |
|---|---|---|---|
| **Military** | 1,500 | 3,000 | 5,000 |
| **Hybrid** | 2,000 | 4,000 | 6,000 |
| **Civilian** | 3,000 | 6,000 | 10,000 |

### 3.1 Troop Breakdown Examples

**Size 3 Military (5,000 manpower):**
| Unit Type | Count | HP | ATK |
|---|---|---|---|
| Levy | 2,000 (40%) | 10 | 10 |
| Men-at-Arms | 2,000 (40%) | 20 | 20 |
| Elite | 1,000 (20%) | 30 | 30 |

**Size 3 Civilian (10,000 manpower):**
| Unit Type | Count | HP | ATK |
|---|---|---|---|
| Levy | 8,000 (80%) | 10 | 10 |
| Men-at-Arms | 1,700 (17%) | 20 | 20 |
| Elite | 300 (3%) | 30 | 30 |

### 3.2 Manpower & Production

Available manpower directly affects settlement production output. Non-combatant population (women, children, elders) maintains baseline production even when all troops are deployed.

| Manpower Status | Production Output | Manpower Recovery Rate |
|---|---|---|
| 100% (no armies raised) | 100% | N/A (already full) |
| 50% deployed | 75% | Normal recovery |
| 100% deployed | 50% | 0% (no men home to reproduce) |
| 0% (wiped out) | 50% (non-combatants) | Slow (~6 months RL to full) |

- At **100% manpower deployment**, manpower accumulation is **0%** — the men who would be fathering children are out fighting.
- Settlements recover from 0 to 100% maximum manpower in approximately **6 months of real-world time**.
- Production never drops below **50%** as long as non-combatant population survives.

---

## 4. Settlement HP

Represents the structural integrity of the settlement's defenses (walls, gates, towers). Determined by both type and size — military holdings are built to withstand assault.

| | Size 1 | Size 2 | Size 3 |
|---|---|---|---|
| **Civilian** | 2,000 | 4,000 | 6,000 |
| **Hybrid** | 2,500 | 5,000 | 7,500 |
| **Military** | 3,000 | 6,000 | 9,000 |

Settlement HP is increased by the **Fortified Walls** defense installation and **Special Slot** traits. Settlement HP can be damaged by siege engines and dragons during a siege.

---

## 5. Defense Slots

Each holding has 1–3 defense slots (determined by size) where defensive installations can be built. All installations are tiered 1–5.

### 5.1 Available Installations

| Installation | Tiers | Effect |
|---|---|---|
| **Scorpion Battery** | 1–5 | Anti-dragon and anti-siege engine fire per tick during siege. Higher tiers increase batteries per volley, hit threshold, and damage. |
| **Fortified Walls** | 1–5 | +2 Defender Advantage per tier (+2 to +10). Also increases base Settlement HP (see §5.3). Advantage degrades as Settlement HP drops (see siege-mechanics.md §5.3). |
| **Watchtower** | 1–5 | Increases visibility radius and raises stealth DC for approaching armies. Higher tiers extend detection range. |
| **Garrison** | 1–5 | Increases troop capacity within walls. Default garrison capacity equals holding manpower. Each tier adds +20% capacity, up to 200% at Tier 5. |

### 5.2 Fortified Walls HP Bonus

In addition to the Defender Advantage bonus (+2 per tier), Fortified Walls increase the settlement's total HP pool:

| Walls Tier | HP Bonus | Total Advantage | Description |
|---|---|---|---|
| 0 (none) | +0 | +0 | No walls — open settlement |
| 1 | +500 | +2 | Basic stone curtain wall |
| 2 | +1,000 | +4 | Reinforced walls with towers |
| 3 | +2,000 | +6 | Full castle walls, murder holes, gatehouse |
| 4 | +3,500 | +8 | Major fortification, concentric walls |
| 5 | +5,000 | +10 | Maximum fortification, multi-layered defense |

**Example Settlement HP Totals (base + T5 Fortified Walls):**

| | Size 1 (base → w/ T5) | Size 2 (base → w/ T5) | Size 3 (base → w/ T5) |
|---|---|---|---|
| **Civilian** | 2,000 → 7,000 | 4,000 → 9,000 | 6,000 → 11,000 |
| **Hybrid** | 2,500 → 7,500 | 5,000 → 10,000 | 7,500 → 12,500 |
| **Military** | 3,000 → 8,000 | 6,000 → 11,000 | 9,000 → 14,000 |

Special Slot traits can add further HP (e.g., Storm's End +2,000, King's Landing +3,000). The absolute maximum for a non-Special standard settlement is 14,000 HP (Military Size 3 with T5 Fortified Walls).

### 5.3 Garrison Capacity Scaling

| Tier | Capacity Modifier | Size 3 Civilian Example |
|---|---|---|
| 0 (none) | 100% of manpower | 10,000 |
| 1 | 120% | 12,000 |
| 2 | 140% | 14,000 |
| 3 | 160% | 16,000 |
| 4 | 180% | 18,000 |
| 5 | 200% | 20,000 |

Troops exceeding garrison capacity remain outside the walls. They do not benefit from defender advantage during assault and consume their own supply rather than the settlement's food stores.

---

## 6. Resource System

### 6.1 Resources

Five resources are tracked in the settlement warehouse:

| Resource | Type | Refining Required? | Tiers? | Primary Sources |
|---|---|---|---|---|
| **Food** | Volume | No | No | Farms, Fisheries, Lodges |
| **Gold** | Volume | No | No | Mines |
| **Timber** | Volume | No | No | Lumber Camps |
| **Stone** | Volume | No | No | Quarries |
| **Iron** | Quality | Yes (at Blacksmith) | 1–5 (+6 special) | Mines |

- **Volume resources** (Food, Gold, Timber, Stone) — quantity matters, not quality. Gathered and stored directly.
- **Quality resources** (Iron) — must be refined at a Blacksmith into tiered ingots before use in crafting.

### 6.1b Resource Weights

Resource weights for army inventory calculations (1 man = 100 KG capacity):

| Resource | Weight (KG per unit) |
|---|---|
| Food | 2 |
| Gold | 5 |
| Timber | 10 |
| Stone | 20 |
| Iron (raw ore) | 15 |
| Refined Iron (all tiers) | 10 |
| Weapons/Armor (per item) | 5 |
| Siege Supplies | 25 |

**Example:** An army of 5,000 men (500,000 KG capacity) can carry 250,000 food, or 50,000 gold, or 25,000 stone. Mixed loads are common — an army on a long campaign needs food AND siege supplies.

### 6.2 Iron Tier System

The Blacksmith handles both refining raw iron ore and crafting finished goods. The Blacksmith's tier determines the maximum quality of refined iron it can produce. Higher-tier ingots require more raw ore per unit.

| Tier | Refined Output | Raw Iron Ore Cost (per unit) |
|---|---|---|
| 1 | Crude Iron | 1 ore |
| 2 | Iron Ingot | 2 ore |
| 3 | Steel | 3 ore |
| 4 | Fine Steel | 4 ore |
| 5 | Castle-Forged Steel | 5 ore |
| 6 | **Valyrian Steel** | Unobtainable through normal production |

Tier 6 (Valyrian Steel) cannot be produced — it is staff-granted, quest-sourced, or obtained through special narrative means. Tier 5 is the maximum naturally producible tier.

### 6.3 Weapon Tier System (6 Tiers)

Weapons use a 6-tier system matching the iron tier pipeline:

| Tier | Weapon Quality | Material Required |
|---|---|---|
| 1 | Crude / Rusty | Crude Iron |
| 2 | Iron | Iron Ingot |
| 3 | Steel | Steel |
| 4 | Fine Steel | Fine Steel |
| 5 | Castle-Forged | Castle-Forged Steel |
| 6 | Valyrian | Valyrian Steel (unobtainable) |

### 6.4 Special Tier 6 Materials

Tier 6 materials are unobtainable through normal production. They exist only through staff intervention, quests, or narrative events.

| Resource | Tier 6 Name | Notes |
|---|---|---|
| Iron | Valyrian Steel | Legendary weapons, cannot be forged normally |
| Timber | Weirwood | Sacred wood, cannot be harvested normally |
| Stone | — | No Tier 6 stone exists |

---

## 7. Resource Nodes

Every settlement has **2 resource nodes**. Nodes are assigned by staff and represent the natural resources available in the area. The two nodes must be **different resource types**.

### 7.1 Node Types

| Node Type | Resource Produced | Notes |
|---|---|---|
| **Farmland** | Food | Produces ~2x the food output of Fishing or Hunting Grounds |
| **Fishing** | Food | ~1x base food output |
| **Hunting Grounds** | Food | ~1x base food output |
| **Gold** | Gold | — |
| **Timber** | Timber | — |
| **Stone** | Stone | — |
| **Iron** | Iron | Raw iron ore, requires Blacksmith to refine |

Nodes do not produce resources on their own — they **multiply resource output** based on the gathering buildings assigned to them. Resources are endless and will always be produced as long as settlement production has not halted.

---

## 8. Gathering Buildings

Gathering buildings extract raw resources from resource nodes. The number of gathering slots is determined by settlement type.

| Settlement Type | Gathering Slots |
|---|---|
| Military | 2 |
| Hybrid | 3 |
| Civilian | 4 |

### 8.1 Available Gathering Buildings

| Building | Node Type | Resource Gathered | Tiered? |
|---|---|---|---|
| **Farm** | Farmland | Food (2x output) | Yes (1–5, affects output volume) |
| **Fishery** | Fishing | Food (1x output) | Yes (1–5, affects output volume) |
| **Lodge** | Hunting Grounds | Food (1x output) | Yes (1–5, affects output volume) |
| **Mine** | Gold or Iron | Gold or Raw Iron Ore | Yes (1–5, affects output volume) |
| **Quarry** | Stone | Stone | Yes (1–5, affects output volume) |
| **Lumber Camp** | Timber | Timber | Yes (1–5, affects output volume) |

Gathering building tiers affect resource output volume — a Tier 5 Farm produces significantly more food per tick than a Tier 1 Farm.

### 8.2 Gathering Output Per Tick

Base output per gathering building per tick:

| Building Tier | Output/Tick | Scaling |
|---|---|---|
| 1 | 50 | Base |
| 2 | 80 | ×1.6 |
| 3 | 120 | ×2.4 |
| 4 | 170 | ×3.4 |
| 5 | 250 | ×5.0 |

**Node type multiplier:** Farmland nodes give ×2 food output (all other nodes ×1).

**Example — Civilian Size 3 with 4 gathering slots:**
- 2× T3 Farm on Farmland: 120 × 2 (Farmland bonus) × 2 buildings = 480 food/tick
- 1× T3 Mine on Iron: 120 iron ore/tick
- 1× T3 Lumber Camp on Timber: 120 timber/tick

**Example — Military Size 1 with 2 gathering slots:**
- 1× T2 Farm on Farmland: 80 × 2 = 160 food/tick
- 1× T2 Mine on Gold: 80 gold/tick

---

## 9. Production Buildings

Production buildings craft finished goods from gathered resources. The number of production slots is determined by settlement type.

| Settlement Type | Production Slots |
|---|---|
| Military | 2 |
| Hybrid | 3 |
| Civilian | 4 |

### 9.1 Available Production Buildings

| Building | Input | Output | Tiered? |
|---|---|---|---|
| **Blacksmith** | Raw Iron Ore | Tiered iron ingots → weapons, armor, armaments | Yes (1–5, determines max iron/item tier) |
| **Siege Workshop** | Timber + Tiered Iron | Siege Supplies, Scorpion Wagons | Yes (1–5, determines max equipment tier) |
| **Shipyard** | Timber + Tiered Iron | Ships | Yes (1–5, determines ship quality) |

Production building tiers determine the **maximum tier of items** they can produce. A Tier 3 Blacksmith can produce up to Steel (Tier 3) quality items but cannot forge Fine Steel or Castle-Forged weapons.

### 9.2 Production Output Per Tick

| Building | Tier | Output/Tick | Input Cost/Tick |
|---|---|---|---|
| **Blacksmith** | 1 | 10 crude iron | 10 raw ore |
| | 2 | 8 iron ingots | 16 raw ore |
| | 3 | 6 steel | 18 raw ore |
| | 4 | 5 fine steel | 20 raw ore |
| | 5 | 4 castle-forged steel | 20 raw ore |
| **Siege Workshop** | 1-5 | 5 siege supplies/tick | 25 timber + 5 tiered iron |
| **Shipyard** | 1-5 | 1 ship per 3 ticks | 50 timber + 10 tiered iron per ship |

### 9.3 Resource Pipeline

```
Resource Nodes (2, staff-assigned)
    ↓
Gathering Buildings (extract raw resources, tiered 1–5 for volume)
    ↓
Production Buildings (craft finished goods, tiered 1–5 for quality)

Volume resources (Food, Gold, Timber, Stone):
    Gathering → Warehouse (direct, no processing needed)

Quality resources (Iron):
    Gathering → Blacksmith (refines + crafts) → Finished Goods
```

A single settlement with both an Iron node and a Blacksmith can handle the full iron pipeline independently. Settlements without a Blacksmith must transport raw iron ore to one that does.

---

## 10. Warehouse

Every settlement has one warehouse. The warehouse stores all resources for the settlement. Warehouse capacity scales with settlement size and can be upgraded (tiers 1–5) to increase storage capacity.

### 10.1 Base Warehouse Capacity

Base capacity is per resource type (each resource stored separately):

| Settlement Size | Base Capacity (per resource) |
|---|---|
| Size 1 | 5,000 units |
| Size 2 | 10,000 units |
| Size 3 | 20,000 units |

### 10.2 Warehouse Tier Scaling

| Warehouse Tier | Capacity Modifier | Size 1 | Size 2 | Size 3 |
|---|---|---|---|---|
| 1 (default) | 100% | 5,000 | 10,000 | 20,000 |
| 2 | 125% | 6,250 | 12,500 | 25,000 |
| 3 | 150% | 7,500 | 15,000 | 30,000 |
| 4 | 175% | 8,750 | 17,500 | 35,000 |
| 5 | 200% | 10,000 | 20,000 | 40,000 |

### 10.3 Settlement Food Consumption

Settlements consume food each tick based on garrison size and civilian population:

| Factor | Food Cost/Tick |
|---|---|
| Per 1,000 garrison troops | 100 food |
| Non-combatant population (flat) | 50 food |

**Examples:**

| Settlement | Garrison | Total Food/Tick | T1 Warehouse (food) | Ticks Until Starvation |
|---|---|---|---|---|
| Military S1 (1,500 men) | 1,500 | 200 | 5,000 | 25 ticks |
| Military S3 (5,000 men) | 5,000 | 550 | 20,000 | 36 ticks |
| Civilian S3 (10,000 men) | 10,000 | 1,050 | 20,000 | 19 ticks |
| Military S3, T5 warehouse | 5,000 | 550 | 40,000 | 73 ticks |

A well-stocked fortress can hold for months. Larger garrisons eat faster — stuffing extra troops behind walls accelerates starvation.

---

## 11. Building Construction

### 11.1 Construction Costs

All buildings cost resources and time to construct or upgrade. Cost is per tier upgrade (upgrading from T2 to T3 costs the T3 row).

| Building Type | Gold | Timber | Stone | Iron | Build Time (ticks) |
|---|---|---|---|---|---|
| **Gathering (T1)** | 200 | 50 | 25 | — | 3 |
| **Gathering (T2)** | 400 | 100 | 50 | — | 5 |
| **Gathering (T3)** | 800 | 200 | 100 | — | 7 |
| **Gathering (T4)** | 1,500 | 400 | 200 | 50 | 10 |
| **Gathering (T5)** | 3,000 | 800 | 400 | 100 | 14 |
| **Production (T1)** | 300 | 75 | 50 | 25 | 5 |
| **Production (T2)** | 600 | 150 | 100 | 50 | 7 |
| **Production (T3)** | 1,200 | 300 | 200 | 100 | 10 |
| **Production (T4)** | 2,500 | 600 | 400 | 200 | 14 |
| **Production (T5)** | 5,000 | 1,200 | 800 | 400 | 21 |
| **Warehouse (T2)** | 500 | 200 | 150 | — | 5 |
| **Warehouse (T3)** | 1,000 | 400 | 300 | — | 7 |
| **Warehouse (T4)** | 2,000 | 800 | 600 | — | 10 |
| **Warehouse (T5)** | 4,000 | 1,500 | 1,200 | — | 14 |

### 11.2 Defense Installation Costs

| Installation | Gold | Timber | Stone | Iron | Build Time (ticks) |
|---|---|---|---|---|---|
| **Fortified Walls (T1)** | 500 | 200 | 300 | 50 | 7 |
| **Fortified Walls (T2)** | 1,000 | 400 | 600 | 100 | 10 |
| **Fortified Walls (T3)** | 2,000 | 800 | 1,200 | 200 | 14 |
| **Fortified Walls (T4)** | 4,000 | 1,500 | 2,500 | 400 | 21 |
| **Fortified Walls (T5)** | 8,000 | 3,000 | 5,000 | 800 | 30 |
| **Scorpion Battery (T1–T5)** | Same as Gathering tier costs | — | — | +50% iron | Same |
| **Watchtower (T1–T5)** | Same as Gathering tier costs | — | — | — | Same |
| **Garrison (T1–T5)** | Same as Gathering tier costs | — | — | — | Same |

Building T5 Fortified Walls from scratch (T1 through T5) costs a total of 15,500 gold, 5,900 timber, 9,600 stone, 1,550 iron, and 82 ticks of construction — a massive investment that represents years of fortification work.

---

## 12. Army Equipment

### 12.1 Equipment Tier Bonuses

Army equipment provides flat percentage bonuses to army stats:

| Tier | Offensive Armament | Defensive Armament |
|---|---|---|
| 1 | +5% army ATK | +5% incoming damage reduction |
| 2 | +10% army ATK | +10% incoming damage reduction |
| 3 | +15% army ATK | +15% incoming damage reduction |
| 4 | +20% army ATK | +20% incoming damage reduction |
| 5 | +25% army ATK | +25% incoming damage reduction |

Special Equipment slot bonuses vary by item type (Scorpion Battery provides anti-dragon capability, Siege Supplies required for siege engine construction).

---

## 13. Special Slot

Every holding has **1 Special Slot** — a staff-assigned unique trait that provides mechanical identity to named locations. Special Slots are preset by staff and cannot be built or modified by players.

### 13.1 Examples

| Holding | Type/Size | Special Trait | Mechanical Effect |
|---|---|---|---|
| King's Landing | Civilian 3 | **The Red Keep** | +3 Fortification Advantage, +3,000 Settlement HP |
| The Eyrie | Military 2 | **The Bloody Gate** | +15 Fortification Advantage, immune to siege engines (~5:1 ratio required) |
| Storm's End | Military 3 | **Storm Wall** | +10 Fortification Advantage, +2,000 Settlement HP, immune to naval blockade (~4:1 ratio required) |
| Casterly Rock | Hybrid 3 | **The Rock** | +4 Fortification Advantage, +2,500 Settlement HP, gold production bonus |
| Moat Cailin | Military 1 | **Neck Chokepoint** | +8 Fortification Advantage, attackers can only engage with 50% of forces (~3.5:1 ratio required) |
| The Twins | Hybrid 2 | **River Crossing** | Toll income, can deny crossing entirely |
| Harrenhal | Military 3 | **Ruined Grandeur** | -4 Fortification Advantage, +5 garrison capacity tiers (ruined walls undermine defense) |
| Dragonstone | Military 2 | **Dragonmont** | Dragon bonding bonus, scorpion resistance |

---

## 14. Army Inventory

Armies carry resources and loot using a weight-based inventory system.

- **Capacity:** 1 man = 100 KG carrying capacity
- **No slot limit** — inventory is gated purely by total weight
- **Scales with manpower** — as troops die, carrying capacity decreases
- **Looting:** Captured settlement warehouses can be looted, limited by available army inventory space

### 13.1 Examples

| Army Size | Carrying Capacity |
|---|---|
| 1,500 | 150,000 KG |
| 5,000 | 500,000 KG |
| 10,000 | 1,000,000 KG |

---

## 15. Scouting & Army Detection

Moving armies are subject to detection by enemy settlements and forces. Detection determines whether a defender knows an army is approaching — and how much intelligence they receive about it.

### 15.1 Detection Check

**Frequency:** Once per tick, only while the army is moving. Stationary armies are not checked.

**Mechanic:** Cunning vs Cunning contested check.

```
Detection Roll = Defender's Spymaster Cunning + Terrain Modifier + Watchtower Bonus + Size Modifier
Stealth Roll   = Attacker's Spymaster Cunning + Terrain Modifier

If Detection Roll ≥ Stealth Roll → Army detected
If Detection Roll < Stealth Roll → Army moves undetected this tick
```

Both sides roll their Spymaster's Cunning as a d10 dice pool (same as Command dice in combat). Each die that meets the success threshold (6+) counts as 1 success. The modifiers below adjust the number of successes needed, not the dice pool.

**Base Detection DC:** 3 successes (before modifiers). An army moving through neutral terrain with no watchtower and no Spymaster needs 3 detection successes to spot. This means a Cunning 5 Spymaster (~2-3 successes average) has a reasonable chance of spotting or missing an approaching force.

### 15.2 Terrain Stealth Modifiers

Terrain affects the **Detection DC** (successes needed). Positive values make detection harder (benefit the moving army); negative values make detection easier (benefit the defender).

| Terrain | DC Modifier | Reasoning |
|---|---|---|
| **Forest** | +2 | Dense canopy conceals movement — ideal for stealth approaches |
| **Boreal Forest** | +2 | Same concealment as standard forest |
| **Grey Mountains** | +1 | Valleys and passes provide moderate cover, but dust/noise carries |
| **Red Mountains** | +1 | Narrow passes offer concealment but limit routes |
| **Snow Mountain** | +1 | Harsh terrain limits visibility but tracks are obvious in snow |
| **Snow** | 0 | Open terrain, tracks visible — no advantage either way |
| **Tundra** | 0 | Flat and exposed, but sparse population means few eyes |
| **Desert Plains** | -1 | Flat terrain, dust clouds visible for miles |
| **Plains** | -1 | Wide open — large armies visible on the horizon |
| **Swamp** | +1 | Mist and difficult terrain limit sightlines |
| **Road** | -2 | Maximum exposure — marching in column on a road is impossible to hide |
| **Ocean** | — | Naval detection uses separate fleet scouting rules |

### 15.3 Army Size Modifier

Larger armies are harder to conceal. The size modifier adjusts the **Detection DC** (negative = easier to detect).

| Army Size | DC Modifier |
|---|---|
| ≤ 200 | +2 (small raiding party, very stealthy) |
| 201–500 | +1 |
| 501–1,000 | 0 (baseline) |
| 1,001–2,000 | -1 |
| 2,001–5,000 | -2 |
| 5,001+ | -3 (massive host, impossible to fully conceal) |

### 15.4 Watchtower Detection Bonus

Watchtower installations on settlements increase visibility radius and add bonus dice to the defender's detection pool for armies moving within range.

| Watchtower Tier | Visibility Radius | Bonus Detection Dice |
|---|---|---|
| T1 | +50 px | +1 |
| T2 | +100 px | +2 |
| T3 | +150 px | +3 |
| T4 | +200 px | +4 |
| T5 | +250 px | +5 |

**Without a watchtower**, the base visibility radius of a settlement is **50 px** (approximately 1 tile). Armies outside this range cannot be detected by the settlement alone — only by scouts or allied armies with their own Spymaster.

### 15.5 Detection Quality

When an army is detected, the quality of intelligence depends on the margin of success (Detection Roll - Stealth Roll):

| Margin | Intelligence Gained |
|---|---|
| 1 | Army detected — direction of approach only |
| 2 | Approximate size (small / medium / large / massive) |
| 3 | Exact size + composition ratio (Levy/MaA/Elite %) |
| 4 | Above + equipment tier |
| 5+ | Full intelligence — composition, equipment, War Council members, estimated arrival |

A Spymaster with Cunning 8+ and a T5 Watchtower creates a formidable intelligence network — approaching armies will be detected early with detailed information. Conversely, a small force (≤200 men) moving through forest against a settlement with no watchtower and no Spymaster is nearly invisible.

### 15.6 Examples

**Example 1 — Large army on open ground:**
3,000 men marching across Plains toward a settlement with a T3 Watchtower. Defender has Spymaster Cunning 6. Attacker has Spymaster Cunning 4.

```
Detection DC: 3 (base) + (-1 Plains) + (-2 army size 2,001-5,000) = 0 (minimum 1)
Defender rolls: 6 dice (Cunning) + 3 (Watchtower) = 9 dice → ~4 successes
Attacker rolls: 4 dice → ~2 successes

Detection Roll (4) ≥ Stealth Roll (2) → Detected with margin 2
Intelligence: Approximate size revealed
```

**Example 2 — Small force through forest:**
150 men moving through Forest toward an unwatched settlement. Defender has no Spymaster. Attacker has Spymaster Cunning 7.

```
Detection DC: 3 (base) + (+2 Forest) + (+2 small party) = 7
Defender rolls: 0 dice (no Spymaster) → 0 successes
Attacker rolls: 7 dice → ~3 successes

Detection Roll (0) < Stealth Roll (3) → Undetected
```

This raiding party slips through unseen. The settlement has no warning until the army arrives.

---

## 16. Full Settlement Slot Summary

| Category | Military | Hybrid | Civilian | Scaling | Tiered? |
|---|---|---|---|---|---|
| **Resource Nodes** | 2 | 2 | 2 | Fixed | No (type only) |
| **Defense Slots** | 1–3 | 1–3 | 1–3 | By size | Yes (1–5) |
| **Gathering Slots** | 2 | 3 | 4 | By type | Yes (1–5) |
| **Production Slots** | 2 | 3 | 4 | By type | Yes (1–5) |
| **Warehouse** | 1 | 1 | 1 | Fixed | Yes (1–5) |
| **Special Slot** | 1 | 1 | 1 | Fixed | Staff-assigned |

---

## Open Questions

- [x] Base warehouse capacity values per settlement size — **RESOLVED** §10.1
- [x] Exact resource weights for inventory calculations — **RESOLVED** §6.1b
- [x] Gathering building output values per tier — **RESOLVED** §8.2
- [x] Defense installation construction costs — **RESOLVED** §11.2
- [x] Production building construction costs and build times — **RESOLVED** §11.1
- [x] Fortified Walls HP bonus per tier — **RESOLVED** §5.2
- [x] Army equipment tier bonus values — **RESOLVED** §12.1
- [x] Scouting base DC and terrain modifier values — **RESOLVED** §15.1–§15.6
- [x] Settlement food consumption rate per tick — **RESOLVED** §10.3
- [x] Resource node output multiplier values — **RESOLVED** §8.2 (Farmland = ×2, others ×1)
- [x] Ship construction costs and build time — **RESOLVED** §9.2 (50 timber + 10 iron, 3 ticks)
