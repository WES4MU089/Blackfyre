# Craftsmanship — 9th Aptitude Addition

**Status:** Draft
**Last Updated:** 2026-02-25
**Related Documents:** holdings-system.md, siege-mechanics.md, warfare-foundation.md

---

## 1. Overview

Craftsmanship is the 9th aptitude, added to support blacksmithing, siege engineering, construction, and resource refining. It fills a gap where none of the existing 8 aptitudes covered the act of making things.

---

## 2. The Nine Aptitudes

| # | Aptitude | Domain |
|---|---|---|
| 1 | Prowess | Combat skill, martial ability |
| 2 | Fortitude | Endurance, resilience, health |
| 3 | Command | Leadership, military strategy |
| 4 | Cunning | Stealth, subterfuge, intelligence |
| 5 | Stewardship | Economics, logistics, management |
| 6 | Presence | Charisma, influence, morale |
| 7 | Lore | Knowledge, scholarship, healing |
| 8 | Faith | Devotion, religion |
| 9 | **Craftsmanship** | Blacksmithing, siege engineering, construction, refining |

---

## 3. Craftsmanship Covers

- **Blacksmithing** — forging weapons, armor, and equipment
- **Siege Engineering** — building siege engines on-site during sieges
- **Construction** — settlement building, fortification construction and repairs
- **Refining** — smelting, sawmill operation, stonecutting efficiency
- **Item Enhancement** (future) — degrees of success on crafted items may add unique stat enhancements

---

## 4. War Council — Siege Master (9th Seat)

| Seat | Aptitude | Role |
|---|---|---|
| **Siege Master** | Craftsmanship | Siege engine build speed and tier capability, settlement repair rate |

- Craftsmanship level gates the **maximum tier of siege engines** that can be built on-site
- Affects **siege engine build speed** (higher Craftsmanship = faster construction)
- Affects **settlement repair rate** during and after sieges

---

## 5. Character Creation Changes

### 5.1 Aptitude Budget

- **Previous:** 32 points across 8 aptitudes (average 4.0)
- **Updated:** 36 points across 9 aptitudes (average 4.0)
- **Range per aptitude at creation:** min 1, max 7 (unchanged)

### 5.2 Hard-Cap Tiers

Remain the same as before:
- 1 aptitude can reach 10
- 2 aptitudes can reach 9
- 5 aptitudes max at 8
- Destiny-sourced points bypass these tiers

### 5.3 Existing Class Templates

All 17 existing class templates receive a **Craftsmanship minimum of 1** (the floor). No existing template has Craftsmanship as a focus.

---

## 6. Craftsman Class Template (New)

| Field | Value |
|---|---|
| **Template Name** | Craftsman |
| **Application Tier** | 1 (common, no staff review) |
| **Concept** | Smiths, builders, engineers, artisans |

### 6.1 Aptitude Minimums

| Aptitude | Minimum | Rationale |
|---|---|---|
| Prowess | 1 | Not a fighter |
| Fortitude | 3 | Physical labor demands endurance |
| Command | 1 | Not a leader |
| Cunning | 1 | — |
| Stewardship | 2 | Runs a shop/business |
| Presence | 1 | — |
| Lore | 2 | Technical knowledge |
| Faith | 1 | — |
| Craftsmanship | 5 | Core identity |

**Locked points:** 17 of 36, leaving 19 to distribute freely.

### 6.2 Starting Package

- **Job:** Blacksmith / Artisan
- **Starting Cash:** Moderate
- **Starting Items:** Craftsman's tools, leather apron

*Note: Character creation will be overhauled — these are rough values.*

---

## 7. Code Changes Required

When implementing this aptitude, the following backend changes are needed:

- [x] Add `craftsmanship` row to `character_aptitudes` for all existing characters (migration 042)
- [x] Update `APTITUDE_TOTAL` from 32 to 36 in `creation.ts` and `applications.ts`
- [x] Add `craftsmanship` to all aptitude validation schemas (creation, allocation, aptitudes route)
- [x] Update all 17 existing class templates to include `craftsmanship: 1` minimum (migration 042)
- [x] Add Craftsman class template (#18) to `class_templates` table (migration 042)
- [x] Implement aptitude hard-cap tier enforcement in `allocation.ts` (1×10, 2×9+, rest max 8)
- [ ] Add Siege Master War Council seat to warfare system (deferred — warfare not yet implemented)
- [x] Update HUD frontend to display 9th aptitude (5+4 column layout)
