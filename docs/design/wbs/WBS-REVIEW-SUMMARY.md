# WBS Design Review — Final Summary

> **Review Date:** 2026-02-25
> **Documents Reviewed:** 10
> **Review Scope:** Consistency sweep, cross-document references, open questions audit, status assessment

---

## Part 1: Document Status Overview

| # | Document | Status | Design Completeness | Needs Simulation | Notes |
|---|----------|--------|-------------------|-----------------|-------|
| 1 | warfare-foundation.md | Draft | ~75% | Yes | Core combat loop done. Numbers TBD for post-battle economy, mercenary details, raiding, duels |
| 2 | dragon-system.md | Draft | ~85% | Partial | Tier system, stats, aerial combat, strafe, WBS integration all designed. Rider risk/crit/strafe tuning needs sim |
| 3 | dragon-bonding.md | Draft | ~95% | No | Fully designed. d6 dice pool, favored aptitudes, three outcomes, all worked examples updated |
| 4 | dragon-sheets.md | Reference | ~95% | No | All 17 stat blocks complete. T1/T2 bumped to T3. Only Morning (unhatched) is TBD |
| 5 | siege-mechanics.md | Draft | ~70% | Yes | Fortification advantage system validated (+18 standard, +25 Eyrie). Siege engine/dragon damage values TBD |
| 6 | holdings-system.md | Draft | ~60% | Yes | Structure defined (buildings, upgrades, special slots). Nearly all numerical values TBD |
| 7 | war-conflict-framework.md | Draft | ~90% | No | CB system, tyranny, smallfolk unrest, reputation all designed. Only political subsystems deferred |
| 8 | naval-warfare.md | Draft | ~50% | Yes | Framework defined (fleet HP pools, sea combat penalty, fire, blockades). Most numbers TBD |
| 9 | mercenaries.md | Draft | ~40% | No | 6 companies described with lore. All stats/costs/manpower TBD |
| 10 | craftsmanship-aptitude.md | Draft | ~80% | No | Design complete. 8 implementation tasks pending (DB + backend code changes) |

---

## Part 2: Master Open Questions

### Category A — Simulation Required (numbers that need warfare-sim.js calibration)

These items require Monte Carlo simulation runs to set balanced values.

**From siege-mechanics.md:**
1. Siege engine damage per tick by tier (calibrate against Settlement HP pools)
2. Dragon siege damage per tick by tier (separate from field strafe formula)
3. Settlement HP repair rate per tick for defenders
4. Starvation combat penalty scaling
5. Scorpion Battery effectiveness against siege engines (damage/tick)

**From naval-warfare.md:**
6. Sea combat penalty tuning (-25% confirmed, but edge cases untested)
7. Fleet vs fleet outcomes at various ship counts
8. Morale/routing thresholds for naval combat
9. Dragon vs fleet balance — ship count needed to reliably threaten a T3/T5 dragon
10. Fire spread mechanics — damage chain rate, spread probability
11. The Cascade — needs testing; may be reintroduced or replaced

**From dragon-system.md:**
12. Scorpion damage by tier — can a fleet of scorpions threaten a T5 meaningfully?
13. Strafe damage formula — (Tier x 500) + (Might x 100) against 40k-150k army HP. Scaling right?
14. Rider risk (1d20, nat 1/nat 20) — frequency appropriate?
15. Rider bonus magnitude — floor(max(Prowess,Command)/2) offense, floor(max(Cunning,Fortitude)/2) defense. Right magnitude?
16. Critical strike balance — Agility% crit asymmetry intentional?

**From warfare-foundation.md:**
17. Exact damage divisor value (currently /75, simulation-validated for field combat)
18. Morale drain/gain rate tuning (simplified system in place, needs edge-case testing)
19. Regional trait bonus percentages
20. Recovery phase durations and wounded pool recovery rates
21. Naval cascade tuning (if reintroduced)

---

### Category B — Design Decisions (need human design input, not simulation)

**From dragon-system.md:**
22. Dragon Death Consequences — psychological trauma / mechanical penalty for rider?
23. Dragon Eggs — do they exist in play? Can new dragons be hatched during the campaign?
24. Rider Death — what does the dragon do when rider dies mid-battle? Staff controls?
25. T4 population — only Dreamfyre + Silverwing. Intentional scarcity?
26. Grey Ghost at T3 — Ferocity 2 means he never fights. T3 correct for non-combatant?
27. Tier advancement pacing — how quickly should staff promote during the Dance?

**From siege-mechanics.md:**
28. Food consumption rate per tick (garrison size x modifier)
29. Manpower bleed rate after food depletion
30. Siege engine construction resource costs (Lumber per tier)
31. Sacking resource payout formula
32. Sacking Act of Tyranny severity level (Severe? Extreme?)
33. Can defenders target siege engines with sorties?

**From warfare-foundation.md:**
34. Post-Battle & War Economy — casualty recovery, prisoners, loot, war exhaustion, rebuilding
35. Bannerman & Alliance System — calling banners, vassal obligations, combined armies
36. Player vs Dragon (Raid Boss) — ground-based dragon encounter for non-riders
37. Raiding system mechanics
38. Duel / personal combat mechanics (referenced in Champion War Council role)
39. Surrender terms (capture, ransom, etc.)

---

### Category C — Numerical Values (need to be set, may or may not need simulation)

**From holdings-system.md:**
40. Base warehouse capacity per settlement size
41. Exact resource weights (KG per unit) for inventory calculations
42. Gathering building output per tier (volume per tick)
43. Defense installation construction costs (resources + time)
44. Production building construction costs and build times
45. Fortified Walls HP bonus per tier
46. Army equipment tier bonus values (% attack/defense per tier)
47. Scouting base DC and terrain modifier values
48. Settlement food consumption rate per tick
49. Resource node output multiplier values
50. Ship construction costs and build time at Shipyard

**From naval-warfare.md:**
51. Ship HP per ship (for fleet aggregate calculation)
52. Ship cargo capacity (KG per ship)
53. Ship construction cost (Timber + Iron per ship)
54. Ship build time (ticks per ship, or batch building?)
55. Wreckage loot percentage on fleet defeat
56. Fire spread probability and damage per spread
57. Open sky scorpion accuracy bonus value
58. Dragon bonus damage multiplier vs ships
59. Rider survival DC modifier at sea
60. Blockade minimum fleet sizes

**From mercenaries.md:**
61. Manpower numbers per company
62. Gold upkeep cost per tick per company
63. Upfront hiring cost per company
64. Equipment tier per company
65. War Council NPC template stats per company
66. HQ locations on the Essos map
67. Exclusivity rule — can multiple players hire same company? (Likely no)
68. Non-payment consequences — desert? Return to HQ?

---

### Category D — Implementation Tasks (code changes, not design)

**From craftsmanship-aptitude.md:**
69. Add `craftsmanship` column to `character_aptitudes` table
70. Update `APTITUDE_TOTAL` from 32 to 36 in creation.ts
71. Add `craftsmanship` to all aptitude validation schemas
72. Update all 17 class templates to include `craftsmanship: 1` minimum
73. Add Craftsman class template to `class_templates` table
74. Implement aptitude hard-cap tier enforcement in allocation.ts
75. Add Siege Master War Council seat (when warfare system implemented)
76. Update HUD frontend to display 9th aptitude

---

### Category E — Intentionally Deferred (future design phases)

**From war-conflict-framework.md §12:**
77. Alliances & Pacts — formal alliance mechanics, mutual defense treaties
78. Succession Law — inheritance, disputed claims, regency, primogeniture
79. Small Council Composition — mechanical roles for councillors
80. The Faith's Role — condemning tyranny, excommunication, sanctuary, Trial by Combat interaction
81. Marriage Law — Faith officiating, legal authority, diplomatic tool
82. Wardship & Hostages — fostering, loyalty guarantees, hostage execution as tyranny

**From dragon-sheets.md:**
83. Morning (unhatched) — stats TBD if/when hatched, likely T1 initially

---

## Part 3: What's Done (Validated & Locked In)

These systems have been designed, cross-referenced, and (where applicable) simulation-validated:

1. **Core combat loop** — d6 dice pools, 4+ success, simultaneous damage, /75 divisor, 4 engagements/tick
2. **Morale system** — simplified damage-comparison model, ±2/±1/0 per tick, -10 to +10 cap, dragon ±2/tick
3. **Fortification advantage** — +3% per net point, validated at +18 (3:1 ratio) and +25 (5:1 ratio)
4. **Dragon tier system** — 5 tiers, T1/T2 not rideable, T3+ war-capable, auto-grow every 90 days
5. **Dragon stat formulas** — HP, Strike, Evasion, Terror all formula-derived, 17 stat blocks complete
6. **Dragon bonding** — d6 pool, favored aptitudes (hidden), three outcomes, sacrifice cap 3, assistant eligibility
7. **Favored aptitudes** — all 17 dragons assigned, staff-only hidden mechanic, assisting player provides Lore/Faith bonus
8. **War Council** — 9 seats (Warlord, Vanguard, Quartermaster, Champion, Spymaster, Admiral, Dragonlord, Arbiter, Siege Master)
9. **Casus Belli system** — 6 CB types, CB determines allowed war goals and tyranny implications
10. **Acts of Tyranny** — 7 severity tiers (Minor → Monstrous), event-log tracking, NPC mustering penalties
11. **Smallfolk unrest** — production penalties by tyranny tier (-10% to -40%), peasant revolts at Reviled+
12. **Reputation tracking** — event-log (not numerical), NPC awareness delays by distance, staff arbitrated
13. **Occupation penalties** — same-region -50% (decays 6mo), different-region -25% permanent
14. **Fortification tiers** — Unfortified +4, Light +8, Moderate +12, Heavy +18, Exceptional +25
15. **Sea combat** — -25% penalty, fire mechanics framework, blockade mechanics, naval morale
16. **Craftsmanship aptitude** — 9th aptitude designed, 36-point budget, Siege Master War Council seat defined

---

## Part 4: Recommended Next Steps (Priority Order)

### Phase 1 — Implementation (can start now)
- [ ] Craftsmanship aptitude: DB migration + backend code (8 tasks from craftsmanship-aptitude.md)
- [ ] Dragon sheets: finalize as staff reference document

### Phase 2 — Numerical Calibration (needs simulation)
- [ ] Settlement HP pools by size/tier → drives siege engine + dragon siege damage values
- [ ] Ship HP values → drives naval combat simulation
- [ ] Holdings economy values (resource weights, output rates, costs, capacities)
- [ ] Mercenary company stats and costs

### Phase 3 — Combat Simulation Expansion
- [ ] Siege engine damage per tick (expand warfare-sim.js with siege scenarios)
- [ ] Dragon siege damage per tick (separate from field strafe)
- [ ] Naval combat simulation (fleet vs fleet, dragon vs fleet)
- [ ] Scorpion vs dragon balance by tier

### Phase 4 — Design Decisions
- [ ] Dragon death/rider death consequences
- [ ] Dragon egg mechanics
- [ ] Tier advancement pacing during the Dance
- [ ] Post-battle economy (casualty recovery, prisoners, loot)
- [ ] Bannerman/alliance call-to-arms system
- [ ] Raiding and duel mechanics

### Phase 5 — Political Systems (Deferred)
- [ ] Alliances & Pacts
- [ ] Succession Law
- [ ] Small Council mechanics
- [ ] Faith's mechanical authority
- [ ] Marriage Law
- [ ] Wardship & Hostages

---

## Part 5: Cross-Document Consistency (Verified)

The following consistency checks were performed across all 10 documents:

| Check | Status |
|-------|--------|
| Dice system: all d6, 4+ success | Verified |
| Aptitude count: 9 (includes Craftsmanship) | Verified |
| Skills system: removed (aptitude checks only) | Verified |
| War Council: 9 seats (Siege Master added) | Verified |
| Dragon tiers: T1/T2 not rideable, T3+ static | Verified |
| Fortification advantage: +3% per point | Verified |
| Damage divisor: /75 | Verified |
| Engagements per tick: 4 | Verified |
| Morale cap: ±10 | Verified |
| Dragon morale: ±Tier (not flat ±5) | Verified |
| Favored aptitudes: hidden from players | Verified |
| Lore/Faith bonding: from assisting players | Verified |
| T1/T2 bumped dragons: stat blocks at T3 | Verified |

---

*Generated during WBS Design Review session, 2026-02-25.*
