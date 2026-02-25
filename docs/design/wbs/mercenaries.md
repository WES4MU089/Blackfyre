# Mercenary Companies — WBS Design Document

**Status:** Draft
**Last Updated:** 2026-02-25
**Related Documents:** warfare-foundation.md, holdings-system.md, naval-warfare.md

---

## 1. Overview

Mercenary companies are pre-built professional armies available for hire. All four companies are headquartered in Essos, requiring naval transport to recruit and deploy. They are staff-run NPC organizations — players cannot control mercenary companies directly.

---

## 2. Core Mechanics

| Feature | Detail |
|---|---|
| **Army composition** | Men-at-Arms + Elite only (no levies — professional soldiers) |
| **Upkeep** | Gold per tick only (no food cost — they supply their own attrition) |
| **Gold cost** | Higher than normal army upkeep to offset the no-food advantage |
| **Hiring process** | Player must travel to the company's HQ in Essos → negotiate with staff NPC |
| **Management** | Staff-run (avoids player bias and metagaming) |
| **Contract duration** | Determined through RP negotiation |
| **Betrayal** | Possible — mercenaries can switch sides if circumstances warrant |
| **Location** | All HQs in Essos (requires naval transport to hire and deploy) |

### 2.1 Hiring Logistics

Hiring a mercenary company is a significant strategic commitment:

1. Player must have **ships** to sail to Essos
2. Player must **travel to the company's HQ** on the map
3. Player **negotiates terms** with the staff NPC running the company
4. Player must have **sufficient gold** for the upfront cost and ongoing per-tick upkeep
5. Player must have **ships to transport** the mercenary army back to Westeros

This makes mercenaries a deliberate, expensive choice — not a casual supplement.

---

## 3. Mercenary Companies

### 3.1 Gold Company

| Stat | Value |
|---|---|
| **Manpower** | 2,000 |
| **Composition** | 50% Men-at-Arms (1,000) / 50% Elite (1,000) |
| **Army HP** | 50,000 |
| **Avg ATK** | 25.0 |
| **Equipment** | Offensive T4, Defensive T4, Special T3 (Scorpion Battery) |
| **Upfront Cost** | 10,000 gold |
| **Upkeep** | 500 gold/tick |
| **Reputation** | Honorable — never breaks a contract |
| **Specialty** | Heavy infantry, siege experience |

The most prestigious and reliable mercenary company. Their word is their bond. Expensive, but you get what you pay for — disciplined heavy troops with excellent equipment. The Gold Company fields more Elites than any other company, giving them the highest Avg ATK and the most troops immune to morale-based routing.

### 3.2 Second Sons

| Stat | Value |
|---|---|
| **Manpower** | 1,200 |
| **Composition** | 70% Men-at-Arms (840) / 30% Elite (360) |
| **Army HP** | 27,600 |
| **Avg ATK** | 23.0 |
| **Equipment** | Offensive T3, Defensive T3, Special T2 |
| **Upfront Cost** | 5,000 gold |
| **Upkeep** | 250 gold/tick |
| **Reputation** | Pragmatic — generally reliable |
| **Specialty** | Versatile, balanced force |

A solid, professional outfit. Not as prestigious as the Gold Company, but competent and reasonably priced. A practical choice for most employers. Good value for cost — roughly half the price of the Gold Company with solid combat capability.

### 3.3 Brave Companions

| Stat | Value |
|---|---|
| **Manpower** | 800 |
| **Composition** | 60% Men-at-Arms (480) / 40% Elite (320) |
| **Army HP** | 19,200 |
| **Avg ATK** | 24.0 |
| **Equipment** | Offensive T2, Defensive T1, Special: none |
| **Upfront Cost** | 2,500 gold |
| **Upkeep** | 150 gold/tick |
| **Reputation** | Treacherous — will break contracts |
| **Specialty** | Brutal, cheap — but significant betrayal risk |

Cheap and effective, but notoriously untrustworthy. The Brave Companions are known for switching sides when offered better terms. Hiring them is a gamble — they may fight well, or they may turn on you at the worst possible moment. Poor equipment reflects their disorganized nature, but their high Elite ratio (40%) gives them surprising punch.

### 3.4 Stormcrows

| Stat | Value |
|---|---|
| **Manpower** | 600 |
| **Composition** | 80% Men-at-Arms (480) / 20% Elite (120) |
| **Army HP** | 13,200 |
| **Avg ATK** | 22.0 |
| **Equipment** | Offensive T3, Defensive T2, Special T2 |
| **Upfront Cost** | 3,000 gold |
| **Upkeep** | 200 gold/tick |
| **Reputation** | Opportunistic — loyal while it's profitable |
| **Specialty** | Fast, mobile, scouting |

A smaller, mobile company suited for rapid operations, scouting, and harassment. Less effective in pitched battles than the Gold Company or Second Sons, but useful for flexible campaigns. Their captain can fill the Spymaster War Council seat (Cunning ~6).

---

## 4. War Council

Each mercenary company has its **own War Council** with NPC leaders. These follow company-specific templates that reflect the organization's character and capabilities.

- War Council members are **randomly generated** from the company template when needed.
- If a mercenary company is **wiped out** during a campaign, new War Council members are regenerated when the company replenishes.
- The hiring player does **not** assign their own characters to mercenary War Council seats — the company commands itself.

### 4.1 War Council NPC Stats by Company

Stats are generated randomly within the listed range for each seat:

| Company | Warlord (Cmd) | Champion (Prow) | Marshal (Fort) | Spymaster (Cun) | Quartermaster (Stew) | Herald (Pres) | War Maester (Lore) | War Priest (Faith) | Siege Master (Craft) |
|---|---|---|---|---|---|---|---|---|---|
| **Gold Company** | 6-8 | 6-8 | 5-7 | 5-7 | 5-7 | 5-7 | 4-6 | 4-6 | 5-7 |
| **Second Sons** | 5-7 | 5-7 | 4-6 | 5-7 | 4-6 | 4-6 | 3-5 | 3-5 | 3-5 |
| **Brave Companions** | 4-6 | 6-8 | 3-5 | 4-6 | 2-4 | 3-5 | 2-4 | 2-4 | 2-4 |
| **Stormcrows** | 4-6 | 4-6 | 3-5 | 6-8 | 4-6 | 4-6 | 3-5 | 3-5 | 3-5 |

**Notes:**
- Gold Company has the highest average across all seats — expensive but well-led
- Brave Companions excel at Champion (Prowess) but are weak at organization (Stewardship, Lore)
- Stormcrows have the best Spymaster (Cunning) — their specialty is scouting and intelligence

---

## 5. Equipment

Each mercenary company comes with its **own equipment** in the standard 3 army equipment slots:

| Slot | Purpose |
|---|---|
| **Offensive Armament** | Pre-filled based on company quality |
| **Defensive Armament** | Pre-filled based on company quality |
| **Special Equipment** | Pre-filled based on company (e.g., Gold Company may have scorpions) |

Equipment quality varies by company (see §3). The hiring player does not need to supply equipment — mercenaries bring their own gear.

---

## 6. Replenishment

Mercenary companies regenerate manpower at their **HQ in Essos**, following the same manpower recovery mechanics as settlements:

- Recovery from 0 to 100% takes approximately **6 months of real-world time**
- Deploying the army costs **manpower**, not gold (the hiring player pays gold for the contract)
- A depleted company cannot be hired until it has recovered sufficient manpower
- War Council members are **randomly regenerated** from company templates when the army is rebuilt after being wiped

---

## 7. Betrayal

Mercenary companies can **switch sides** during a conflict. The likelihood depends on the company:

| Company | Betrayal Risk |
|---|---|
| Gold Company | None — never breaks a contract |
| Second Sons | Low — pragmatic, but generally honorable |
| Stormcrows | Moderate — loyal while profitable |
| Brave Companions | High — notorious for switching sides |

Betrayal is handled through **staff RP** based on narrative circumstances, not a random dice roll. Factors that may trigger betrayal:

- Being outbid by the opposing side
- The hiring player's position becoming clearly hopeless
- Mistreatment or unpaid wages
- Better opportunity presenting itself

---

## 8. HQ Locations & Contract Rules

### 8.1 HQ Locations

Each mercenary company is headquartered at a specific location on the Essos portion of the map:

| Company | HQ Location | Region | Notes |
|---|---|---|---|
| **Gold Company** | Near Pentos (west coast) | Western Essos | Closest to Westeros — shortest transit time |
| **Second Sons** | Volantis | Southern Essos | Far from Westeros — long naval voyage required |
| **Brave Companions** | Qohor | Interior Essos | Requires inland travel after making port |
| **Stormcrows** | Near Myr | Central Free Cities | Moderate distance, accessible port |

**Exclusive contracts:** Only **one player** can hire a given company at a time. If the Gold Company is already under contract, no other player can recruit them until the contract ends. This creates competition for the best mercenaries — hiring them before your enemy does is a strategic move.

### 8.2 Contract Termination

If the hiring player **cannot pay** the per-tick upkeep:

| Tick | Event |
|---|---|
| **Tick 1 (missed payment)** | Grace period — the company continues fighting but morale drops. Staff NPC warns the employer. |
| **Tick 2 (still unpaid)** | Company halts offensive operations — they hold position but will not advance or attack. |
| **Tick 3 (still unpaid)** | Company **deserts** — they leave the battlefield and begin marching back to their HQ in Essos. |

**After desertion:**
- The company is **unavailable for hire** until they return to HQ (travel time varies by location)
- The hiring player's **reputation** with that company is damaged — future hiring costs +25% upfront
- The Gold Company (never breaks contracts) will still desert if unpaid — they're honorable, not suicidal
- The Brave Companions may **turn hostile** instead of simply deserting — unpaid Brave Companions might loot the employer's own supply train on the way out

**Voluntary dismissal:** A player can end a contract at any time. The company returns to HQ (no reputation penalty). No refund of upfront cost.

---

## Open Questions

- [x] Manpower numbers per company — **RESOLVED** §3 (Gold 2,000; Second Sons 1,200; Brave Companions 800; Stormcrows 600)
- [x] Gold upkeep cost per tick — **RESOLVED** §3 (Gold 500/t; Second Sons 250/t; Brave 150/t; Stormcrows 200/t)
- [x] Upfront hiring cost — **RESOLVED** §3 (Gold 10k; Second Sons 5k; Brave 2.5k; Stormcrows 3k)
- [x] Equipment tier per company — **RESOLVED** §3
- [x] War Council NPC template stats — **RESOLVED** §4.1
- [x] HQ locations on the Essos portion of the map — **RESOLVED** §8 (Gold Company: west coast near Pentos; Second Sons: Volantis; Brave Companions: Qohor; Stormcrows: near Myr)
- [x] Can multiple players hire the same company simultaneously? — **RESOLVED** §8.1 (No — exclusive contract, one employer at a time)
- [x] What happens if the hiring player stops paying? — **RESOLVED** §8.2 (3-tick grace period, then desertion → return to HQ)
