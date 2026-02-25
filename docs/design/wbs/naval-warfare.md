# Naval Warfare — WBS Design Document

**Status:** Draft
**Last Updated:** 2026-02-25
**Related Documents:** warfare-foundation.md, holdings-system.md, dragon-system.md, siege-mechanics.md

---

## 1. Overview

Naval warfare extends the land-based warfare system to sea. Fleets use the same tick-based combat resolution, War Council seats, morale/routing mechanics, and equipment slots as land armies — adapted for the maritime environment.

---

## 2. Ships

One generic ship type. No variant classes.

| Stat | Value |
|---|---|
| **Crew** | 30 per ship |
| **Ship HP** | 500 per ship |
| **Cargo Capacity** | 3,000 KG per ship |
| **Speed** | 0.007 px/s (flat, all fleets) |

### 2.0b Fleet HP Aggregate

Fleet HP is the sum of all ship HP values. Ship count is derived from remaining fleet HP:

| Shipyard Tier | Max Ships | Fleet HP | Fleet Cargo | Total Crew |
|---|---|---|---|---|
| T1 | 25 | 12,500 | 75,000 KG | 750 |
| T2 | 50 | 25,000 | 150,000 KG | 1,500 |
| T3 | 75 | 37,500 | 225,000 KG | 2,250 |
| T4 | 100 | 50,000 | 300,000 KG | 3,000 |
| T5 | 150 | 75,000 | 450,000 KG | 4,500 |

As fleet HP drops, ships are lost proportionally: `Current Ships = Floor(Fleet HP ÷ 500)`. A fleet reduced to 250 HP has no functional ships remaining.

### 2.1 Shipyard & Fleet Capacity

Ships are built at **Shipyard** production buildings in port settlements. Shipyard tier determines the maximum fleet capacity the port can support.

| Shipyard Tier | Fleet Capacity |
|---|---|
| 1 | 25 ships |
| 2 | 50 ships |
| 3 | 75 ships |
| 4 | 100 ships |
| 5 | 150 ships |

- Ships require **Timber + Tiered Iron** to construct.
- Only settlements with the **port flag** can build Shipyards.
- Higher tier Shipyards support larger fleets, not better ships.

### 2.2b Ship Construction

| Resource | Cost per Ship |
|---|---|
| Timber | 50 |
| Tiered Iron | 10 |
| Build Time | 3 ticks per ship |

Ships are built sequentially at the Shipyard. A T5 Shipyard building 150 ships from scratch requires 7,500 timber + 1,500 iron and 450 ticks — fleet building is a long-term investment.

### 2.2 Ports

A port is a **boolean flag** on a settlement. Not all coastal settlements are ports — the flag is assigned by staff during world setup. Port settlements can:

- Build Shipyards (production building)
- Be naval blockaded (see siege-mechanics.md §2.1)
- Embark/disembark armies

---

## 3. Fleet Combat

Naval combat uses the **same tick-based system as land combat**: Maneuver Phase → Battle Phase → Aftermath Phase.

### 3.1 Fleet HP

Fleet HP is an **aggregate pool**, same as army HP on land. Ship count is derived from remaining fleet HP:

```
Current Ships = Fleet HP ÷ HP per Ship
```

As fleet HP drops from combat damage, ships are lost proportionally. This mirrors how army manpower works on land.

### 3.2 Sea Combat Penalty

Troops fighting at sea suffer a **flat -25% effectiveness penalty** to both ATK and HP. Men-at-Arms and Elites retain their stat advantages over Levies, but all fight worse than on land. This represents poor footing on decks, armor liability near water, and unfamiliar combat environment.

The penalty is flat (not scaling) for simplicity — all troops are equally disadvantaged at sea regardless of experience or type. This keeps naval combat straightforward while ensuring fleets are meaningfully weaker than equivalent land forces, making the choice to fight at sea a deliberate strategic decision.

### 3.3 War Council

The same **9 War Council seats** apply at sea:

| Seat | Aptitude | Naval Role |
|---|---|---|
| Warlord | Command | Fleet battle dice pool |
| Champion | Prowess | +2% damage/level |
| Marshal | Fortitude | -2% incoming damage/level |
| Spymaster | Cunning | -2% enemy effectiveness, naval scouting |
| Quartermaster | Stewardship | -2.5% upkeep/attrition |
| Herald | Presence | +2% rally, morale |
| War Maester | Lore | +2% wounded recovery |
| War Priest | Faith | Rout reduction, morale drain reduction |
| Siege Master | Craftsmanship | Ship repair rate |

### 3.4 Morale & Routing

Same morale system as land combat. Routed HP converts to routed ships:

```
Routed Ships = Routed HP ÷ HP per Ship
```

Routed ships **return to home harbor**. They are removed from the battle but not destroyed — they can be reconsolidated after the battle.

### 3.5 Ship-to-Ship Combat

Combat is resolved as **ship-to-ship damage only**. There is no boarding mechanic — engagements are resolved through the aggregate HP system, same as land combat.

---

## 4. Fleet Equipment

Fleets use the **same 3 equipment slots** as armies:

| Slot | Purpose | Examples |
|---|---|---|
| **Offensive Armament** | Fleet-wide attack modifier | Ramming prows, improved weapons |
| **Defensive Armament** | Fleet-wide defense modifier | Reinforced hulls, fire-resistant coating |
| **Special Equipment** | Unique capabilities | Scorpion batteries (anti-dragon) |

- Equipment is **built at settlements** using production buildings.
- Equipment **has weight** and counts against fleet inventory.
- Equipment can be **captured** on complete fleet defeat.
- Same tier 1–5 system as army equipment.

---

## 5. Fleet Inventory

Fleet inventory is **per ship**, not per soldier.

```
Fleet Cargo Capacity = Ship Count × Cargo Capacity per Ship
```

- As ships are lost, fleet cargo capacity decreases.
- Cargo on sunk ships is lost (except wreckage — see §7).
- Army equipment loaded onto ships counts against fleet cargo.

---

## 6. Dragons at Sea

Naval-dragon combat is **mutually dangerous**. Both sides are more exposed at sea than on land.

### 6.1 Dragon Advantages

**Fire vs Wood Multiplier:** Dragon strafe damage against fleets is multiplied by **×1.5** (fire vs wooden ships). This applies to the standard strafe formula:

```
Naval Strafe Damage = [(Tier × 500) + (Might × 100)] × 1.5
```

| Dragon | Tier | Might | Land Strafe | Naval Strafe (×1.5) | Ships Sunk (per tick) |
|---|---|---|---|---|---|
| **Vhagar** | T5 | 10 | 3,500 | 5,250 | ~10 ships |
| **Caraxes** | T5 | 7 | 3,200 | 4,800 | ~9 ships |
| **Syrax** | T3 | 5 | 1,750 | 2,625 | ~5 ships |
| **Arrax** | T1 | 2 | 700 | 1,050 | ~2 ships |

**Fire Spread:** When a dragon strafes a fleet, fire can spread to adjacent ships beyond the primary strafe damage. After resolving strafe damage:

- Each ship adjacent to a destroyed ship has a **30% chance** of catching fire
- Ships on fire take **100 additional damage** (20% of ship HP) at the end of the tick
- Fire does not chain further — only the initial spread triggers (no cascading infernos)
- Fire is extinguished at the end of the tick (crew douses flames)

Fire spread creates bonus attrition beyond the base strafe damage. Against a 100-ship fleet, a Vhagar strafe that sinks 10 ships might spread fire to 3-4 more, dealing an extra 300-400 damage (~1 more ship lost). Against smaller fleets, the percentage impact is higher.

**No terrain cover:** Fleets cannot use terrain to reduce dragon damage. The open ocean provides no hiding.

### 6.2 Ship Advantages

**Open Sky Scorpion Accuracy Bonus:** At sea, scorpion batteries fire with a **+25% accuracy bonus** (added to base hit rate). Dragons cannot use terrain features to evade.

| Dragon Agility | Land Hit Rate | Sea Hit Rate (+25%) |
|---|---|---|
| 3 (Vhagar) | 65% | 90% |
| 5 (Vermithor) | 55% | 80% |
| 7 (Syrax) | 45% | 70% |
| 9 (Caraxes) | 35% | 60% |
| 10 (Meleys) | 30% | 55% |

At sea, even the most agile dragons face significantly higher scorpion hit rates. Caraxes, who dodges 65% of scorpion fire on land, can only evade 40% at sea.

**Volume of fire:** Large fleets with scorpion batteries in the Special Equipment slot multiply the effect. A 100-ship fleet with T5 scorpion batteries generates massive anti-dragon firepower.

### 6.3 Rider Survival at Sea

If a dragon is downed at sea, the rider survival check DC increases by **+5** (from base DC 15 to **DC 20**):

- **Drowning risk** replaces crash-landing — armor becomes lethal
- **No solid ground** for emergency landing
- **Rescue** depends on friendly ships being nearby

| Scenario | DC | Effect |
|---|---|---|
| Land (standard) | 15 | Base survival check |
| Sea (no friendly ships) | 20 | +5 penalty — drowning |
| Sea (friendly ships nearby) | 18 | +3 penalty — rescue possible but difficult |

*Example: Daemon on Caraxes at sea (modifier +8). Against DC 20, he needs a 12+ on d20 — 45% survival chance, down from 70% on land. The sea is merciless.*

### 6.4 Fleet Anti-Dragon Defense

- Fleets **without a Scorpion Battery** in the Special Equipment slot deal **no damage** to dragons — crew with bows and spears cannot threaten a flying dragon at sea (unlike land armies which have a small chance with massed archery).
- The open-sky accuracy bonus only applies to properly equipped fleets.
- A fleet must carry scorpion batteries to have any anti-dragon capability at sea.

---

## 7. Fleet Defeat

When a fleet is completely defeated:

- **Ships sink** — all remaining ships are destroyed.
- **Crews drown** — crew members go down with their ships.
- **No retreat on total defeat** — unlike routing (which sends ships home), a complete defeat is catastrophic.

### 7.1 Wreckage Loot

The victorious fleet can recover **15%** of the defeated fleet's cargo inventory from the wreckage. This represents salvageable goods from floating debris, captured lifeboats, and recovering cargo before it sinks.

| Modifier | Effect |
|---|---|
| Base recovery | 15% of cargo inventory |
| Quartermaster (Stewardship) | +2% per level (max +20% at Stewardship 10) |
| Storm conditions | -5% (rough seas make salvage harder) |
| **Maximum recovery** | **35%** (15% base + 20% Quartermaster) |

- **Equipment** (offensive/defensive armaments, special equipment) on the defeated fleet is **not recoverable** — it sinks with the ships.
- **Gold** in the cargo is fully recoverable up to the percentage cap (gold doesn't sink as fast as heavy supplies).
- Recovery is automatic — the victorious fleet collects wreckage on the tick after battle ends.
- Recovered cargo is limited by the victorious fleet's **remaining cargo capacity**. Excess wreckage is lost.

---

## 8. Embarkation & Disembarkation

Armies can load onto and off of ships at port settlements.

| Action | Duration | Vulnerability |
|---|---|---|
| **Embarkation** (army → ships) | 1 tick | Army is stationary and vulnerable |
| **Disembarkation** (ships → land) | 1 tick | Army is stationary and vulnerable |

- During embarkation/disembarkation, the army cannot fight or move.
- Enemy forces can attack during this window for a significant advantage.
- Army inventory transfers to/from fleet inventory during this process.

---

## 9. Blockades

A fleet can blockade a port settlement to cut off sea-based supply and trade.

| Requirement | Value |
|---|---|
| **Ships needed** | 25 (flat, all settlement sizes) |

### 9.1 Blockade Effects

- Combined with a land siege, a blockade creates **total strangulation** — production halts completely and food stores bleed.
- Without a land siege, a blockade alone reduces sea trade and supply but does not halt production (see siege-mechanics.md §2.1).
- Maintaining a blockade ties up 25 ships that cannot be used elsewhere.

---

## 10. Simulation Requirements

The following mechanics require simulation testing before final values can be set:

- [x] Sea combat penalty tuning — **RESOLVED** §3.2 (flat -25%, not scaling)
- [x] Fleet vs fleet outcomes at various ship counts — **RESOLVED** via validation-sim.js §1 (equal and mismatched fleets, war council quality impact)
- [x] Morale/routing thresholds for naval combat — **RESOLVED** via validation-sim.js §2 (morale mirrors land: ±10 cap, |Morale| × 0.5% rout rate)
- [x] Dragon vs fleet balance — **RESOLVED** via validation-sim.js §3 (T5 dominates ≤50 ships, 100+ ships threaten T5, T3 is coin-flip at 25 ships)
- [x] Fire spread mechanics — **RESOLVED** §6.1 (30% chance, 100 damage, no cascade)
- [x] Wreckage loot percentage — **RESOLVED** §7.1 (15% base, +2%/Stewardship level, max 35%)
- [x] Ship HP values — **RESOLVED** §2 (500 HP per ship)
- [x] Ship cargo capacity — **RESOLVED** §2 (3,000 KG per ship)
- [x] The Cascade — **CUT.** Replaced by fire spread mechanic (30% chance per destroyed ship, 100 dmg to adjacent). No chain reaction beyond immediate spread.
- [x] Ship construction costs and build time — **RESOLVED** §2.2b

---

## Open Questions

- [x] Ship HP per ship — **RESOLVED** §2 (500 HP per ship)
- [x] Ship cargo capacity — **RESOLVED** §2 (3,000 KG per ship)
- [x] Ship construction cost — **RESOLVED** §2.2b (50 timber + 10 iron per ship)
- [x] Ship build time — **RESOLVED** §2.2b (3 ticks per ship, sequential)
- [x] Wreckage loot percentage on fleet defeat — **RESOLVED** §7.1 (15% base, +2%/Stewardship, max 35%)
- [x] Fire spread probability and damage per spread — **RESOLVED** §6.1 (30% chance, 100 dmg, no cascade)
- [x] Open sky scorpion accuracy bonus value — **RESOLVED** §6.2 (+25% hit rate at sea)
- [x] Dragon bonus damage multiplier vs ships — **RESOLVED** §6.1 (×1.5 fire vs wood)
- [x] Rider survival DC modifier at sea — **RESOLVED** §6.3 (+5 DC, or +3 with friendly ships)
- [x] Sea combat penalty — **RESOLVED** §3.2 (flat -25%)
