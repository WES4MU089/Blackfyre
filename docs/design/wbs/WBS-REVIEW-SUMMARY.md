# WBS Design Review — Final Summary

> **Review Date:** 2026-02-25
> **Last Updated:** 2026-02-25
> **Documents Reviewed:** 11
> **Review Scope:** Consistency sweep, cross-document references, open questions audit, status assessment

---

## Part 1: Document Status Overview

| # | Document | Status | Design Completeness | Needs Simulation | Notes |
|---|----------|--------|-------------------|-----------------|-------|
| 1 | warfare-foundation.md | Complete | ~95% | No | Core combat loop, War Council, morale, advantage, post-battle, Warlord gambit system, surrender flow, retreat mechanics all designed. Divisor /75 validated. Raiding deferred to future doc. Duels implemented in backend. Bannerman system designed in bannerman-system.md. |
| 2 | dragon-system.md | Complete | ~95% | No | All 18 dragons statted, aerial combat validated (153k Monte Carlo fights), strafe/scorpion/rider formulas locked. T1/T2 auto-grow 90 days, T3+ staff-only. |
| 3 | dragon-bonding.md | Complete | 100% | No | Fully designed. d6 dice pool, favored aptitudes (all 17 assigned), three outcomes, sacrifice cap, all worked examples. |
| 4 | dragon-sheets.md | Reference | ~95% | No | All 17 stat blocks complete. T1/T2 bumped to T3. Only Morning (unhatched) is TBD — starts T1 if hatched. |
| 5 | siege-mechanics.md | Complete | ~95% | No | All 11 open questions resolved. Siege engines, dragon siege damage, scorpion batteries, food/starvation, sacking all sim-validated via siege-sim.js. |
| 6 | holdings-system.md | Complete | ~100% | No | All 12 open questions resolved. Buildings, costs, output rates, resource weights, scouting, equipment tiers — all concrete numbers. |
| 7 | war-conflict-framework.md | Complete | ~95% | No | CB system, tyranny (9 acts), smallfolk unrest, reputation, trials, bastard law all designed. 6 political subsystems intentionally deferred to Phase 5. |
| 8 | naval-warfare.md | Complete | ~95% | No | All simulation items resolved via validation-sim.js. Fleet vs fleet, morale/routing, dragon vs fleet balance validated. Cascade mechanic cut — replaced by fire spread. |
| 9 | mercenaries.md | Complete | ~100% | No | All 8 open questions resolved. 4 companies fully statted (manpower, cost, equipment tier, War Council NPCs, betrayal risk, HQ locations). |
| 10 | craftsmanship-aptitude.md | Complete | ~95% | No | Design complete. 7 of 8 implementation tasks done. Siege Master War Council seat pending warfare system implementation. |
| 11 | bannerman-system.md | Complete | ~95% | No | NPC lord disposition (-100 to +100, 5 tiers), calling banners (3-factor multiplicative response), petitions (7 types, cascading neglect), aid requests, combined army command, defection/rebellion. 7 open questions deferred to future phases. |

---

## Part 2: Master Open Questions

### Category A — Simulation Required

**ALL RESOLVED.** Naval simulation completed via validation-sim.js:

- ~~Fleet vs fleet outcomes~~ — validated at 25/50/75/100/150 ship counts
- ~~Morale/routing thresholds~~ — mirrors land system (±10 cap, |Morale| × 0.5% rout rate)
- ~~Dragon vs fleet balance~~ — T5 dominates ≤50 ships, 100+ ships threaten T5, T3 coin-flip at 25
- ~~The Cascade~~ — **CUT.** Replaced by fire spread (30% chance, 100 dmg)

### Category B — Playtesting / Tuning

**ALL RESOLVED.**

- ~~Strafe damage formula~~ — validated via dragon-wbs-sim.js and validation-sim.js
- ~~Rider survival check~~ — validated
- ~~Critical strike balance~~ — Agility% asymmetry confirmed intentional
- ~~Damage divisor~~ — **/75 locked** across all docs (warfare-foundation updated to match siege/sim)
- ~~Morale drain/gain~~ — validated via warfare-sim.js

### Category C — Design Decisions Still Outstanding

10. ~~Surrender terms~~ — **RESOLVED.** See warfare-foundation.md §14 (Warlord Gambit System, Surrender Flow, Retreat Mechanics)
11. ~~Bannerman & Alliance System~~ — **RESOLVED.** See bannerman-system.md. NPC lord disposition system, calling banners, petitions, aid requests, combined army command, defection/rebellion all designed.
12. Player vs Dragon (Raid Boss) — ground-based dragon encounter for non-riders (future doc)
13. Raiding system mechanics (future doc)
14. ~~Duel / personal combat mechanics~~ — **RESOLVED.** Fully implemented in backend (duel-engine.ts, tactical-engine.ts, attack-resolver.ts, damage.ts). 1v1 duels, multiplayer tactical combat, yield mechanics, equipment/armor system all coded.

### Category D — Implementation Tasks

**From craftsmanship-aptitude.md:**

| # | Task | Status |
|---|------|--------|
| 69 | Add `craftsmanship` column to `character_aptitudes` table | **DONE** |
| 70 | Update `APTITUDE_TOTAL` from 32 to 36 in creation.ts | **DONE** |
| 71 | Add `craftsmanship` to all aptitude validation schemas | **DONE** |
| 72 | Update all 17 class templates to include `craftsmanship: 1` minimum | **DONE** |
| 73 | Add Craftsman class template to `class_templates` table | **DONE** |
| 74 | Implement aptitude hard-cap tier enforcement in allocation.ts | **DONE** |
| 75 | Add Siege Master War Council seat (when warfare system implemented) | PENDING |
| 76 | Update HUD frontend to display 9th aptitude | **DONE** |

### Category E — Intentionally Deferred (future design phases)

**From war-conflict-framework.md §12:**

15. Alliances & Pacts — formal alliance mechanics, mutual defense treaties
16. Succession Law — inheritance, disputed claims, regency, primogeniture
17. Small Council Composition — mechanical roles for councillors
18. The Faith's Role — condemning tyranny, excommunication, sanctuary, Trial by Combat interaction
19. Marriage Law — Faith officiating, legal authority, diplomatic tool
20. Wardship & Hostages — fostering, loyalty guarantees, hostage execution as tyranny

**From dragon-sheets.md:**

21. Morning (unhatched) — starts T1 if/when hatched, staff-driven narrative event

---

## Part 3: What's Done (Validated & Locked In)

These systems have been designed, cross-referenced, and (where applicable) simulation-validated:

1. **Core combat loop** — d6 dice pools, 4+ success, simultaneous damage, /75 divisor, engagements/tick scale by army size (2-5)
2. **Morale system** — damage-comparison model, ±2/±1/0 per tick, -20 to +20 cap, dragon ±Tier/tick
3. **Fortification advantage** — +3% per net point, validated at +18 (3:1 ratio) and +25 (5:1 ratio)
4. **Dragon tier system** — 5 tiers, T1/T2 auto-grow every 90 days, T3+ static (staff-only promotions)
5. **Dragon stat formulas** — HP, Strike, Evasion, Terror all formula-derived, 18 stat blocks complete (17 + Morning TBD)
6. **Dragon aerial combat** — validated via 153k Monte Carlo fights, wound spiral, hit thresholds, damage per hit (Tier + 3)
7. **Dragon bonding** — d6 pool, favored aptitudes (hidden), three outcomes, sacrifice cap 4, assistant eligibility
8. **Favored aptitudes** — all 17 dragons assigned, staff-only hidden mechanic, assisting player provides Lore/Faith bonus
9. **Dragon death** — no mechanical penalty for rider, but rider can never bond another dragon
10. **Dragon eggs** — staff-placed narrative items, can hatch via staff-driven events, start T1
11. **Rider death** — dragon becomes unbonded, available for new bonding attempts (staff determines timing, possible +2 DC)
12. **War Council** — 9 seats (Warlord, Vanguard, Quartermaster, Champion, Spymaster, Admiral, Dragonlord, Arbiter, Siege Master)
13. **Casus Belli system** — 6 CB types with strength ratings, CB determines allowed war goals and tyranny implications
14. **Acts of Tyranny** — 9 acts across Moderate/Severe/Extreme, event-log tracking, NPC mustering penalties (0% to -100%)
15. **Smallfolk unrest** — production penalties by tyranny tier (-10% to -40%), peasant revolts at Reviled+
16. **Reputation tracking** — event-log (not numerical), NPC awareness delays by distance, staff arbitrated
17. **Occupation penalties** — same-region -50% (decays 6mo), different-region -25% permanent
18. **Fortification tiers** — Unfortified +4, Light +8, Moderate +12, Heavy +18, Exceptional +25
19. **Siege mechanics** — engine damage by tier (100-700/tick), dragon siege formula, scorpion batteries, food/starvation, sacking, all sim-validated
20. **Holdings system** — 3 types × 3 sizes, manpower pools, settlement HP, buildings, resource system, construction costs, scouting, equipment tiers
21. **Sea combat** — -25% penalty, fire spread (30% chance, 100 dmg, no cascade), naval strafe ×1.5, wreckage recovery, blockades (25 ships), fleet vs fleet / dragon vs fleet sim-validated
22. **Mercenaries** — 4 companies fully statted (Gold Company, Second Sons, Brave Companions, Stormcrows), betrayal risk, contract termination
23. **Craftsmanship aptitude** — 9th aptitude, 36-point budget, Siege Master War Council seat defined, implementation complete
24. **Regional traits** — 9 regions with terrain bonuses, identity bonuses, synergy at 80%+ composition
25. **Terrain system** — 12 types with move costs, attrition, DEF bonuses
26. **Post-battle aftermath** — 3-tick recovery, 60/40 dead/wounded split, escape mechanics, ransom formula, war exhaustion at 30+ ticks
27. **Trial system** — Trial Among Peers, Trial by Combat (sacred right), Trial by Seven (royal-only)
28. **Bastard law** — Unacknowledged/Acknowledged/Legitimized tiers with specific rights per tier
29. **Warlord Gambit System** — 8-slot IF/THEN decision automation for Fight/Retreat/Surrender, same model as dragon gambits
30. **Surrender flow** — battle pauses on offer, 24h response window, unconditional battlefield surrender, auto-capture
31. **Retreat mechanics** — 3 types by morale (Clean/Fighting/Desperate), pursuit windows, rearguard losses, retreat vs rout distinction
32. **Naval surrender/retreat** — ships as prizes, port retreat, speed penalties
33. **NPC Lord Disposition** — hybrid system (-100 to +100 score, 5 qualitative tiers: Loyal/Dutiful/Reluctant/Hostile/Rebellious), hidden from players, staff override
34. **Calling Banners** — 3-factor multiplicative response (Disposition × CB Strength × Tyranny), mustering delays, garrison reserve, refusal conditions, rally points
35. **NPC Petitions** — 7 petition types, 4 urgency levels (Critical/High/Medium/Low), cascading neglect penalties, Negligent Lord flag
36. **NPC Aid Requests** — bidirectional, Failure of Protection consequences (-15 disposition, grants moderate CB), Laws of Protection CB for defenders
37. **Combined Army Command** — NPC contingents merge into roster, player controls War Council, command succession on lord death, contingent detachment triggers
38. **NPC Defection & Rebellion** — defection via secret negotiation (3-7 tick phase, Spymaster detection), rebellion at Rebellious tier, coalition rebellion when 3+ NPCs Rebellious

---

## Part 4: Recommended Next Steps (Priority Order)

### Phase 1 — Future Design Documents
- [x] Bannerman & Alliance System — **DONE** (bannerman-system.md)
- [x] Duel / personal combat mechanics — **DONE** (implemented in backend)
- [ ] Raiding system mechanics
- [ ] Player vs Dragon (Raid Boss) encounters

### Phase 2 — Political Systems (Deferred)
- [ ] Alliances & Pacts
- [ ] Succession Law
- [ ] Small Council mechanics
- [ ] Faith's mechanical authority
- [ ] Marriage Law
- [ ] Wardship & Hostages

---

## Part 5: Cross-Document Consistency (Verified)

The following consistency checks were performed across all 11 documents:

| Check | Status |
|-------|--------|
| Dice system: all d6, 4+ success | Verified |
| Aptitude count: 9 (includes Craftsmanship) | Verified |
| Skills system: removed (aptitude checks only) | Verified |
| War Council: 9 seats (Siege Master added) | Verified |
| Dragon tiers: T1/T2 auto-grow 90 days, T3+ staff-only | Verified |
| Fortification advantage: +3% per point | Verified |
| Engagements per tick: scales by army size (2-5) | Verified |
| Morale cap: ±20 | Verified |
| Dragon morale: ±Tier (not flat) | Verified |
| Favored aptitudes: hidden from players | Verified |
| Lore/Faith bonding: from assisting players | Verified |
| T1/T2 bumped dragons: stat blocks at T3 | Verified |
| Dragon death: no penalty, never bond again | Verified |
| Dragon eggs: staff-placed, hatch via narrative, start T1 | Verified |
| Rider death: dragon unbonded, available for re-bonding | Verified |
| Holdings: all numerical values resolved | Verified |
| Mercenaries: all 4 companies fully statted | Verified |
| Siege: sim-validated via siege-sim.js | Verified |
| Damage divisor: /75 (all docs aligned) | Verified |
| Cascade mechanic: cut, replaced by fire spread | Verified |
| Naval sim: fleet vs fleet, dragon vs fleet validated | Verified |
| Warlord gambit: IF/THEN model matches dragon gambits | Verified |
| Tick order: Warlord decision at step 0, dragon gambits step 1 | Verified |
| Surrender: unconditional on battlefield, RP-only for siege | Verified |
| Retreat: 3 types with pursuit windows and rearguard losses | Verified |
| NPC disposition: 5 tiers (Loyal/Dutiful/Reluctant/Hostile/Rebellious) | Verified |
| Bannerman mustering: 3-factor multiplicative (Disposition × CB × Tyranny) | Verified |
| NPC petitions: 7 types, 4 urgency levels with response windows | Verified |
| Defection: Spymaster detection, 3-7 tick secret phase | Verified |
| Tyranny → disposition mapping: Moderate -10, Severe -25, Extreme -40 | Verified |
| Faith alignment: same +5 start / +2 drift, different -5 start / -1 drift | Verified |

---

*Generated during WBS Design Review session, 2026-02-25.*
