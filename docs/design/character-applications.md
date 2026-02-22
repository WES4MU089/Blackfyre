# Chapter 15 — Character Applications & Noble Lineage

> Design document for the character application system, noble house
> membership, lineage flags, featured roles, and public biography.

---

## 1. Overview

Character creation currently bypasses any approval step — a player picks a
template, allocates aptitudes, types a name and optional backstory, and the
character is instantly live. This works for common-born characters but is
inadequate for the political layer of the game. Noble houses, royal
bloodlines, Great House leadership, and bastard heritage all carry
mechanical and narrative weight that warrants a structured application and
approval pipeline.

This document defines:

- The **application data model** (what a player submits).
- **Lineage flags** (noble house, bastard, dragon seed, Great House, royal).
- **Featured roles** (Head of House, Lord Paramount, royalty) and the
  expectations attached to them.
- The **approval workflow** (pending → approved / denied / revision).
- **Public biography** for the social wiki / family-tree viewer.

---

## 2. Application Data Model

### 2.1 New Fields on `characters`

| Column | Type | Default | Notes |
|---|---|---|---|
| `house_id` | INT UNSIGNED NULL | NULL | FK → `houses.id`. NULL = no house. |
| `is_bastard` | BOOLEAN | FALSE | Character has bastard blood. |
| `is_dragon_seed` | BOOLEAN | FALSE | Character carries Valyrian/dragon blood outside the main Targaryen line. |
| `father_name` | VARCHAR(150) NULL | NULL | Father's name (free text — does not need to be a player character). |
| `mother_name` | VARCHAR(150) NULL | NULL | Mother's name (free text — does not need to be a player character). |
| `title` | VARCHAR(100) NULL | NULL | Display title, e.g. "Lord", "Ser", "Septa". Set by staff or earned. |
| `epithet` | VARCHAR(100) NULL | NULL | Informal name, e.g. "The Kingslayer", "Littlefinger". |
| `application_status` | ENUM('none','pending','approved','denied','revision') | 'none' | Tracks approval state. 'none' = auto-approved common character. |
| `application_reviewed_by` | INT UNSIGNED NULL | NULL | FK → `players.id` (the staff member). |
| `application_reviewed_at` | TIMESTAMP NULL | NULL | When the decision was made. |
| `application_notes` | TEXT NULL | NULL | Staff-facing notes on the decision. |
| `public_bio` | TEXT NULL | NULL | Optional publicly visible biography (IC info, RP hooks). |

### 2.2 `houses` Table

```sql
CREATE TABLE IF NOT EXISTS houses (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE,   -- e.g. "Stark", "Lannister"
    motto           VARCHAR(255) NULL,               -- "Winter Is Coming"
    sigil_url       VARCHAR(500) NULL,               -- Path or URL to house sigil
    seat            VARCHAR(100) NULL,               -- "Winterfell", "Casterly Rock"
    region          VARCHAR(100) NULL,               -- "The North", "The Westerlands"
    is_great_house  BOOLEAN DEFAULT FALSE,           -- One of the paramount houses
    is_royal_house  BOOLEAN DEFAULT FALSE,           -- The ruling dynasty
    is_extinct      BOOLEAN DEFAULT FALSE,           -- No living members
    head_character_id INT UNSIGNED NULL,             -- FK → characters.id (current Head of House)
    lore_summary    TEXT NULL,                       -- Staff-written house lore
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Great Houses and the royal house are staff-seeded rows. Players cannot
create new Great Houses — they can only apply to join existing ones or
found minor noble houses (with staff approval).

### 2.3 `character_applications` Table

A dedicated table that stores the full application submission, preserving
history even after the character row is updated on approval.

```sql
CREATE TABLE IF NOT EXISTS character_applications (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    character_id    INT UNSIGNED NOT NULL,            -- FK → characters.id
    player_id       INT UNSIGNED NOT NULL,            -- FK → players.id (denormalized for queries)
    -- Lineage fields (as submitted)
    house_id        INT UNSIGNED NULL,                -- FK → houses.id
    is_bastard      BOOLEAN DEFAULT FALSE,
    is_dragon_seed  BOOLEAN DEFAULT FALSE,
    father_name     VARCHAR(150) NOT NULL,            -- Free text — need not be a player character
    mother_name     VARCHAR(150) NOT NULL,            -- Free text — need not be a player character
    requested_role  ENUM('member','head_of_house','lord_paramount','royalty') DEFAULT 'member',
    is_featured_role BOOLEAN DEFAULT FALSE,           -- Player toggle; auto-TRUE for HoH/LP/royalty
    -- Head of House coordination (required when joining an existing house)
    hoh_contact     TEXT NULL,                        -- Short answer: did you contact the Head of House?
    -- Bios
    application_bio TEXT NOT NULL,                    -- Full backstory / justification (staff-only)
    public_bio      TEXT NULL,                        -- Optional public-facing IC bio
    -- Status
    status          ENUM('pending','approved','denied','revision') DEFAULT 'pending',
    staff_notes     TEXT NULL,                        -- Reviewer feedback
    reviewed_by     INT UNSIGNED NULL,                -- FK → players.id
    reviewed_at     TIMESTAMP NULL,
    -- Timestamps
    submitted_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id),
    FOREIGN KEY (house_id) REFERENCES houses(id)
);
```

### 2.4 Application Bio vs Public Bio

| Field | Audience | Purpose |
|---|---|---|
| `application_bio` | Staff only | Full backstory, OOC justification, lore tie-ins, why the player wants this role. Used for review. |
| `public_bio` | All players | Publicly known IC information — parentage, reputation, notable deeds, personality hooks. Displayed in the family tree / house wiki. Should **not** contain secret plots or OOC info. |

The existing `backstory` column on `characters` remains as the private
character backstory (visible only to the owning player and staff). The
`public_bio` is a new, separate field intended for community consumption.

---

## 3. Lineage Flags

### 3.1 Noble House Membership (`house_id`)

Any character may apply for membership in a house. Common characters have
`house_id = NULL`. Membership in a house grants:

- The house name appended to the character name display (e.g. "Robb Stark").
- Access to the house vault / holding finances (if the house has holdings).
- Eligibility for house-specific political actions.

### 3.2 Bastard Blood (`is_bastard`)

A bastard is the illegitimate child of a noble. Bastards:

- Use the regional surname convention (Snow, Rivers, Sand, Stone, Hill,
  Flowers, Storm, Pyke, Waters).
- May claim `house_id` to indicate parentage but are **not** in the line
  of succession unless legitimized by staff action.
- Carry a social stigma that may be reflected in NPC dialog or reputation
  modifiers (future system).

### 3.3 Dragon Seed (`is_dragon_seed`)

A dragon seed is a character with Valyrian blood who is not a member of
the ruling Targaryen dynasty. Dragon seeds:

- Are extremely rare — staff will gate this heavily.
- May unlock future dragon-binding mechanics if/when dragon content is
  added.
- The flag is purely narrative and application-gated for now; no
  mechanical bonus at launch.

### 3.4 Great House Membership

Determined by `houses.is_great_house = TRUE` on the character's
`house_id`. Great House members face stricter application review because
they represent a central political faction. See Section 5.

### 3.5 Royal Family

Determined by `houses.is_royal_house = TRUE` on the character's
`house_id`. The most restricted lineage — see Section 5.3.

---

## 4. Application Workflow

### 4.1 Who Needs an Application?

There are three tiers of character creation:

**Tier 1 — Instant (no approval)**
Smallfolk / common-born characters with no house, no lineage flags, no
featured role toggle, and no affiliation with a restricted organization.
These are created instantly as today. `application_status = 'none'`.

**Tier 2 — Standard Application (requires approval)**

| Trigger | Notes |
|---|---|
| Any nobility template | All noble characters require approval. |
| `house_id` is set | Joining any house — minor or Great. |
| `is_bastard = TRUE` | Bastard blood of any house. |
| `is_dragon_seed = TRUE` | Extremely rare, strict review. |
| Organization with `requires_approval = TRUE` | Smallfolk joining a major organization (see below). |

**Tier 3 — Featured Role Application (stricter review)**

| Trigger | Notes |
|---|---|
| `is_featured_role = TRUE` on the application | Player self-selects this toggle. |
| `requested_role` = head_of_house | Automatically treated as featured. |
| `requested_role` = lord_paramount | Automatically treated as featured. |
| `requested_role` = royalty | Automatically treated as featured. |

The `is_featured_role` toggle is a checkbox on the application form. It
is **automatically enabled** when `requested_role` is head_of_house,
lord_paramount, or royalty. Players may also **manually enable** it for
any other character they consider significant enough to warrant the
featured role expectations (Section 5). This is opt-in — it signals to
staff that the player intends to take on a prominent narrative position.

Add to `character_applications`:

| Column | Type | Default | Notes |
|---|---|---|---|
| `is_featured_role` | BOOLEAN | FALSE | Player toggle. Auto-set TRUE for head_of_house/lord_paramount/royalty roles. |

**Restricted Organizations**

Some organizations are significant enough that membership requires staff
approval even for common-born characters. These have
`requires_approval = TRUE` on the `organizations` table (see Section
6.4). Examples:

- The Kingsguard
- The Faith Militant
- The Iron Bank
- The Golden Company
- The Night's Watch
- The Maesters (Citadel)

When a player selects one of these organizations during character
creation, the application is routed to staff review regardless of
template category. Smallfolk joining a local merchant guild or a minor
sellsword band do **not** need approval.

### 4.2 Flow

```
Player creates a character
        │
        ▼
  Step 1: Template (class selection)
  Step 2: Aptitudes
        │
        ▼
  Step 3: Identity
   ├─ Name
   ├─ Father's Name (required — free text, does not need to be a PC)
   ├─ Mother's Name (required — free text, does not need to be a PC)
   ├─ House selection (dropdown, or "Found new minor house", or none)
   ├─ Organization affiliation (optional — dropdown of organizations)
   ├─ Bastard? (checkbox, conditional on house selection)
   ├─ Dragon Seed? (checkbox, very rare — tooltip warns of strict review)
   ├─ Requested Role (member / head of house / lord paramount / royalty)
   ├─ Featured Role? (toggle — auto-on for HoH/LP/royalty, opt-in otherwise)
   ├─ Head of House Contact (short answer — shown when joining an existing
   │    house: "Have you contacted the current Head of House to discuss
   │    your character concept and share story ideas? Please describe.")
   ├─ Application Bio (required for Tier 2/3, min 500 chars for featured)
   └─ Public Bio (optional, shown in family tree / wiki)
        │
        ▼
  Step 4: Review → Submit
        │
        ├── Tier 1 (no triggers) ──→ Character goes live immediately
        │                             application_status = 'none'
        │
        └── Tier 2 or 3 (any trigger) ──→ application_status = 'pending'
                                           Character is NOT playable
                                                    │
                                                    ▼
                                          Staff reviews in admin panel
                                           ├─ Approve → character goes live
                                           ├─ Deny → player notified, may resubmit
                                           └─ Request Revision → player edits
```

### 4.3 Notifications

- On submission: staff members with the `review_applications` permission
  receive a notification (future: Discord webhook to a staff channel).
- On decision: the player receives an in-app notification and (future)
  Discord DM.

---

## 5. Featured Roles & Expectations

Featured roles are positions of significant narrative power. Players who
hold these roles accept higher activity and roleplay standards.

### 5.1 Head of House (Minor Noble House)

**What it means:** The player leads a minor noble house. They control the
house vault, can accept or dismiss members, and represent the house in
political RP.

**Requirements:**
- At least one prior character on the account that reached level 5+.
- Application bio must detail the house's origin, current standing, and
  the character's claim to leadership.
- Minimum 500-character application bio.

**Expectations:**
- Maintain regular activity (login at least once per week).
- Actively engage other houses and political factions in RP.
- If inactive for 30+ days without notice, staff may reassign headship.

### 5.2 Head of House / Lord Paramount (Great House)

**What it means:** The player leads one of the Great Houses — a paramount
lord with vassals, regional authority, and a seat on the political stage.

**Requirements:**
- At least one prior character on the account that reached level 10+.
- Demonstrated track record of quality RP (staff discretion).
- Application bio must detail the character's political goals, leadership
  style, and how they intend to drive regional RP (minimum 1000 chars).
- Public bio required (minimum 300 chars).

**Expectations:**
- Maintain high activity (login at least 3 times per week).
- Actively generate RP for house members and vassals — this is a
  storyteller role as much as a player role.
- Coordinate with staff on major political arcs.
- Respond to vassals and petitioners in a timely manner.
- If inactive for 14+ days without notice, staff may reassign the role.
- Staff reserves the right to revoke the role if the player is not
  fulfilling the storytelling obligation.

### 5.3 Royal Family

**What it means:** The player is a member of the ruling dynasty. This
carries the highest narrative weight and visibility.

**Requirements:**
- At least one prior character on the account that reached level 10+.
- Strong reputation for quality RP across multiple characters.
- Application bio must detail the character's place in the royal family
  tree, personality, political ambitions, and relationships with other
  royals (minimum 1500 chars).
- Public bio required (minimum 500 chars).
- Staff interview may be required at staff discretion.

**Expectations:**
- All Lord Paramount expectations apply, plus:
- The player is expected to be a pillar of the server's political RP.
- Major actions (declarations of war, royal decrees, marriages, etc.)
  must be coordinated with staff.
- Activity: login at least 4 times per week.
- If inactive for 7+ days without notice, staff may install a regent
  or reassign the role.

### 5.4 Activity Enforcement

Activity requirements are guidelines, not automatic. Staff will consider
context (holidays, announced breaks, real-life events). The goal is to
prevent key political positions from going dark and stalling RP for
everyone else.

Future: an automated activity tracker that flags characters below their
role's threshold for staff review.

---

## 6. The Social Viewer — Regions, Houses & Characters

The Social Viewer is an in-HUD panel that serves as a living encyclopedia
of the game world. It is organized in a **three-level hierarchy**:

```
Region Page
 ├─ House Cards (houses seated in this region)
 │    └─ House Page
 │         ├─ Character Cards (house members)
 │         │    └─ Character Page (portrait, public bio, lineage)
 │         └─ House details (sigil, motto, seat, lore, Head of House)
 ├─ Character Cards (regionless / houseless characters based here)
 ├─ Organization Cards (guilds, orders, companies based here)
 └─ Region details (description, ruling house, Lord Paramount, map)
```

### 6.0 Data Model — Regions

```sql
CREATE TABLE IF NOT EXISTS regions (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE,   -- "The North", "The Westerlands"
    description     TEXT NULL,                       -- Staff-written region lore
    banner_url      VARCHAR(500) NULL,               -- Header image for the region page
    ruling_house_id INT UNSIGNED NULL,               -- FK → houses.id (the Great House)
    warden_character_id INT UNSIGNED NULL,            -- FK → characters.id (Lord Paramount / Warden)
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

The `houses` table (Section 2.2) already has a `region VARCHAR(100)`.
This will be replaced with `region_id INT UNSIGNED NULL` (FK → regions.id)
so houses are properly linked to region pages.

Additionally, add to `characters`:

| Column | Type | Default | Notes |
|---|---|---|---|
| `region_id` | INT UNSIGNED NULL | NULL | FK → `regions.id`. Where this character is based. Inferred from house region if in a house, or set manually for houseless characters. |

### 6.0.1 Page Hierarchy Detail

**Region Page** displays:
- Region name, description, and banner image.
- Ruling House (the Great House, linked from `ruling_house_id`).
- Lord Paramount / Warden (the `warden_character_id` — character card).
- **House Cards** — all houses with `region_id` matching this region,
  sorted by Great House first, then minor houses alphabetically.
- **Character Cards** — characters based in this region who are not
  members of any house (smallfolk, hedge knights, wanderers).
- **Organization Cards** — guilds, orders, and companies stationed in
  this region (see Section 6.4).

**House Page** displays:
- House sigil, name, motto, seat, and lore summary.
- Head of House (character card, from `houses.head_character_id`).
- **Character Cards** — all characters with this `house_id`, grouped:
  - Trueborn members first, bastards second.
  - Head of House pinned at top.
  - Deceased/inactive members in a collapsed "Fallen" section.
- **Family Tree** — see Section 6.6.

**Character Page** displays:
- Portrait (or placeholder silhouette).
- Name, title, epithet.
- House affiliation and sigil (if any).
- Parentage (father and mother names).
- Lineage badges: Bastard, Dragon Seed, Royal.
- Public bio.
- Faction allegiance (if formally declared — see Section 6.5).

### 6.1 Public Bio Guidelines (shown to players)

> Your public bio should contain **publicly known, in-character
> information** — things that people in the world would reasonably know
> about your character. Think of it as your character's reputation.
>
> **Good examples:**
> - Parentage and house affiliation
> - Notable battles or political actions
> - Personality traits visible to others
> - Titles held, lands governed
>
> **Do not include:**
> - Secret plots or hidden identities
> - OOC information
> - Meta-gaming hooks ("I'm secretly planning to betray House X")

### 6.2 Bio & Portrait Editing

Players can edit the following from the **Character Panel** at any time:

| Field | Editable By | Notes |
|---|---|---|
| `public_bio` | Player | Staff can review and flag inappropriate entries. |
| `portrait_url` | Player | Upload an image or paste an external URL (see 6.3). |
| `backstory` | Player | Private — visible only to the owning player and staff. |
| `application_bio` | Immutable | Preserved for records after approval. Players who need significant backstory changes should contact staff. |

### 6.3 Character Portrait

The `portrait_url` column already exists on `characters` but is unused.
Players will be able to set their portrait via two methods:

**Option A — Image Upload**
- Player uploads an image file (JPEG, PNG, WebP) through the Character
  Panel.
- Backend receives the file via `POST /characters/:id/portrait` (multipart
  form data).
- Image is validated (max 2 MB, image MIME type check), resized to a
  standard dimension (256x256), and stored on disk under
  `backend/uploads/portraits/<characterId>.webp`.
- `portrait_url` is set to `/uploads/portraits/<characterId>.webp`.
- Overwrites any previous upload.

**Option B — External URL**
- Player pastes an image URL into the portrait field.
- Backend validates the URL format and optionally fetches headers to
  confirm it serves an image content type.
- `portrait_url` is set to the external URL directly.
- No file is stored server-side.

**Display:**
- The portrait is shown in the Character Panel header, the public wiki
  page, and the family tree viewer.
- A default silhouette placeholder is used when `portrait_url` is NULL.
- Portraits are visible to all players through the social viewer.

### 6.4 Organizations (Guilds, Orders & Companies)

Organizations are groups that exist outside the feudal house structure.
They will be added in a future phase but the social viewer is designed
to accommodate them from the start.

**Examples:**
- **Orders** — The Night's Watch, The Kingsguard, The Maesters.
- **Guilds** — The Alchemists' Guild, merchant guilds.
- **Companies** — Sellsword companies, mercenary bands.

```sql
CREATE TABLE IF NOT EXISTS organizations (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE,
    org_type        ENUM('order','guild','company') NOT NULL,
    description     TEXT NULL,
    sigil_url       VARCHAR(500) NULL,
    region_id       INT UNSIGNED NULL,               -- FK → regions.id (where stationed/HQ'd)
    leader_character_id INT UNSIGNED NULL,            -- FK → characters.id
    requires_approval BOOLEAN DEFAULT FALSE,          -- TRUE = joining triggers Tier 2 application
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS organization_members (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id INT UNSIGNED NOT NULL,            -- FK → organizations.id
    character_id    INT UNSIGNED NOT NULL,            -- FK → characters.id
    rank            VARCHAR(50) NULL,                 -- "Commander", "Brother", "Captain"
    joined_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY (organization_id, character_id),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);
```

Organizations appear as **Organization Cards** on their home region page.
Each organization also has its own page (similar to a house page) showing
members, leader, description, and sigil.

A character may belong to **one house** and **one or more organizations**
simultaneously (e.g., a Lannister knight who also serves in the
Kingsguard).

### 6.5 Factions

Factions represent large-scale political allegiances — wars, succession
crises, rebellions. Unlike houses and organizations, factions are
**temporary and event-driven**. They are formally declared by staff
(or by royal/lord paramount characters with staff approval) and dissolved
when the conflict ends.

```sql
CREATE TABLE IF NOT EXISTS factions (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,            -- "The Blacks", "The Greens"
    description     TEXT NULL,                        -- What this faction stands for
    banner_url      VARCHAR(500) NULL,
    leader_character_id INT UNSIGNED NULL,            -- FK → characters.id (faction figurehead)
    is_active       BOOLEAN DEFAULT TRUE,             -- FALSE when conflict resolved
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS faction_members (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    faction_id      INT UNSIGNED NOT NULL,            -- FK → factions.id
    character_id    INT UNSIGNED NOT NULL,            -- FK → characters.id
    declared_publicly BOOLEAN DEFAULT TRUE,           -- FALSE = secret allegiance (staff-only)
    joined_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY (faction_id, character_id),
    FOREIGN KEY (faction_id) REFERENCES factions(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);
```

**Key rules:**
- A character may belong to **at most one faction** at a time (enforced
  in application logic, not DB constraint, to allow staff overrides).
- Faction membership can be **public or secret**:
  - `declared_publicly = TRUE` — the character's faction badge is visible
    on their character card and page. This is the default.
  - `declared_publicly = FALSE` — allegiance is hidden from the social
    viewer. Only staff and the faction leader can see it. Useful for
    spies, double agents, and undeclared sympathizers.
- Not everyone will formally declare for a faction. Houseless smallfolk,
  neutral lords, or characters playing both sides may have no faction
  membership at all.
- When a faction is deactivated (`is_active = FALSE`), all membership
  records are preserved for historical reference but the faction no
  longer appears in the active factions list.

**Display:**
- Active factions appear in a dedicated **Factions** tab in the social
  viewer, showing the faction banner, leader, description, and a roster
  of publicly declared members.
- On character pages, the faction badge appears next to the house sigil
  (if publicly declared).
- On region pages, a summary of faction influence can be shown (count of
  declared members per faction in the region).

### 6.6 House Family Trees

Each house has a visual family tree on its House Page. The tree includes
both **player characters** and **NPC entries** (historical or off-screen
figures who are not playable but matter for lineage — e.g. a deceased
patriarch, a mother who never appears in-game).

#### 6.6.1 Data Model

```sql
CREATE TABLE IF NOT EXISTS family_tree_npcs (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    house_id        INT UNSIGNED NOT NULL,            -- FK → houses.id
    name            VARCHAR(150) NOT NULL,
    title           VARCHAR(100) NULL,
    epithet         VARCHAR(100) NULL,
    portrait_url    VARCHAR(500) NULL,
    public_bio      TEXT NULL,
    is_deceased     BOOLEAN DEFAULT FALSE,
    created_by      INT UNSIGNED NOT NULL,            -- FK → players.id (who added this NPC)
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS family_tree_edges (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    house_id        INT UNSIGNED NOT NULL,            -- FK → houses.id
    relationship    ENUM('parent','spouse','sibling') NOT NULL,
    -- Exactly one of each pair should be set (character or NPC)
    from_character_id   INT UNSIGNED NULL,            -- FK → characters.id
    from_npc_id         INT UNSIGNED NULL,            -- FK → family_tree_npcs.id
    to_character_id     INT UNSIGNED NULL,            -- FK → characters.id
    to_npc_id           INT UNSIGNED NULL,            -- FK → family_tree_npcs.id
    -- Audit
    created_by      INT UNSIGNED NOT NULL,            -- FK → players.id
    approved_by     INT UNSIGNED NULL,                -- FK → players.id (staff)
    approved_at     TIMESTAMP NULL,
    status          ENUM('pending','approved','denied') DEFAULT 'pending',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE
);
```

Each edge connects two nodes. A node is either a `characters.id` or a
`family_tree_npcs.id`. The `relationship` type determines the line drawn:

| Relationship | Meaning | Display |
|---|---|---|
| `parent` | `from` is a parent of `to` | Vertical line down |
| `spouse` | `from` is married to `to` | Horizontal line between |
| `sibling` | `from` is a sibling of `to` | Shared parent bracket |

The `parent` relationship is the primary building block. Child
relationships are derived (if A is parent of B, then B is child of A).
Sibling relationships can be inferred from shared parents but are stored
explicitly when parents are unknown or off-tree.

#### 6.6.2 Node Types

**Player Character cards** — linked to `characters.id`. Display the
character's portrait, name, title, and a link to their Character Page.
Living characters are shown normally; deceased characters are dimmed.

**NPC cards** — linked to `family_tree_npcs.id`. Same visual treatment
but cannot be clicked through to a full Character Page (no game stats).
Used for ancestors, deceased relatives, or off-screen figures that
establish lineage.

#### 6.6.3 Editing & Approval

Family trees are **staff-managed** with a player suggestion workflow:

| Action | Who Can Do It | Requires Approval? |
|---|---|---|
| Add NPC entry | Admin, Moderator | No |
| Add/remove edge | Admin, Moderator | No |
| Edit NPC details | Admin, Moderator | No |
| Suggest new edge | Any player | Yes — pending until staff approves |
| Suggest NPC entry | Any player | Yes — pending until staff approves |

**Player suggestion flow:**
1. Player opens the family tree on a House Page.
2. Clicks "Suggest Edit" and selects the type (new NPC, new relationship).
3. Fills in details and submits.
4. A `family_tree_edges` row is created with `status = 'pending'`.
   Pending edges are **not visible** on the public tree.
5. Staff/moderators see pending suggestions in the admin panel and
   on the House Page (highlighted, staff-only).
6. Staff approves or denies. On approval, the edge becomes visible.

This prevents players from unilaterally claiming lineage to important
figures while still letting them contribute to the world-building.

#### 6.6.4 Bootstrapping from Applications

When a noble character application is approved, the system can
auto-generate pending family tree edges from the `father_name` and
`mother_name` fields:
- If a character or NPC with that name exists in the house, create a
  `parent` edge (pre-approved since the application was already reviewed).
- If no match exists, create a `family_tree_npcs` entry for the parent
  and link it (also pre-approved).

This seeds the tree automatically as noble characters are approved.

---

## 7. Seed Data — Great Houses, Royal House & Regions

### 7.1 Regions

| Region | Ruling House | Notes |
|---|---|---|
| The Crownlands | Targaryen | Seat of the Iron Throne |
| The North | Stark | Largest region by area |
| The Westerlands | Lannister | Wealthiest region |
| The Stormlands | Baratheon | |
| The Vale | Arryn | Isolated by mountains |
| The Riverlands | Tully | Central, war-torn crossroads |
| The Iron Islands | Greyjoy | Naval power |
| The Reach | Tyrell | Most fertile, largest population |
| Dorne | Martell | Southernmost, culturally distinct |

### 7.2 Great Houses & Royal House

| House | Seat | Region | Type | Motto |
|---|---|---|---|---|
| Targaryen | King's Landing | The Crownlands | Royal | "Fire and Blood" |
| Stark | Winterfell | The North | Great | "Winter Is Coming" |
| Lannister | Casterly Rock | The Westerlands | Great | "Hear Me Roar!" |
| Baratheon | Storm's End | The Stormlands | Great | "Ours Is the Fury" |
| Arryn | The Eyrie | The Vale | Great | "As High as Honor" |
| Tully | Riverrun | The Riverlands | Great | "Family, Duty, Honor" |
| Greyjoy | Pyke | The Iron Islands | Great | "We Do Not Sow" |
| Tyrell | Highgarden | The Reach | Great | "Growing Strong" |
| Martell | Sunspear | Dorne | Great | "Unbowed, Unbent, Unbroken" |

Minor houses are created by players through the application system (with
staff approval) or seeded by staff as needed.

---

## 8. Staff Roles & Permissions

No staff role system currently exists in the codebase. The application
system requires one. This section defines a **role-based access control
(RBAC)** system with granular permissions. Custom roles can be created
and configured by super admins through a dedicated System Administration
panel.

### 8.1 Data Model

#### `is_super_admin` Flag on `players`

```sql
ALTER TABLE players
  ADD COLUMN role_id INT UNSIGNED NULL,          -- FK → roles.id (NULL = no staff role)
  ADD COLUMN is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;
```

The `is_super_admin` flag is a hard-coded escape hatch that bypasses all
permission checks. It is **not** assignable through the UI — it can only
be set via direct database update. This prevents lockout scenarios and
ensures at least one account always has full control. At launch, the
server owner's player row is set to `is_super_admin = TRUE` manually.

Super admins:
- Bypass all permission checks (every `requirePermission` call passes).
- Can access the System Administration panel (Section 11.4).
- Can create/edit/delete roles and assign permissions.
- Can promote other players to super admin (via database only — no UI
  for this to prevent accidental escalation).

#### `roles` Table

```sql
CREATE TABLE IF NOT EXISTS roles (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(50) NOT NULL UNIQUE,   -- e.g. "Moderator", "Admin", "Lore Keeper"
    description     VARCHAR(255) NULL,              -- Human-readable purpose
    color           VARCHAR(7) NULL,                -- Hex color for badge display, e.g. "#c9a84c"
    is_default      BOOLEAN DEFAULT FALSE,          -- If TRUE, auto-assigned to new players (only one)
    sort_order      INT UNSIGNED DEFAULT 0,         -- Display priority (lower = higher rank)
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `permissions` Table

```sql
CREATE TABLE IF NOT EXISTS permissions (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    key             VARCHAR(100) NOT NULL UNIQUE,   -- Machine-readable key, e.g. "applications.review"
    label           VARCHAR(150) NOT NULL,           -- Human-readable label for the UI
    category        VARCHAR(50) NOT NULL,            -- Grouping: "applications", "family_tree", "content", "admin"
    description     VARCHAR(255) NULL                -- Tooltip explanation
);
```

#### `role_permissions` Junction Table

```sql
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id         INT UNSIGNED NOT NULL,
    permission_id   INT UNSIGNED NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);
```

### 8.2 Seed Permissions

The `permissions` table is seeded with a fixed set of permission keys.
New permissions are added via migrations as features are built. Super
admins assign these to roles through the System Administration panel.

| Category | Permission Key | Label |
|---|---|---|
| **applications** | `applications.view_queue` | View application queue |
| | `applications.review` | Approve, deny, or request revision |
| | `applications.comment_public` | Post public staff comments |
| | `applications.comment_private` | Post and view private staff comments |
| | `applications.delete` | Delete applications |
| **family_tree** | `family_tree.manage` | Add/remove/edit nodes and edges |
| | `family_tree.approve_suggestions` | Approve or deny player suggestions |
| **content** | `content.edit_bios` | Flag or edit player public bios |
| | `content.manage_houses` | Create, edit, delete houses |
| | `content.manage_regions` | Create, edit, delete regions |
| | `content.manage_organizations` | Create, edit, delete organizations |
| | `content.manage_factions` | Create, edit, delete factions |
| **players** | `players.view_list` | View player list |
| | `players.assign_roles` | Assign roles to players |
| | `players.ban` | Ban or suspend players |
| | `players.delete_characters` | Delete characters |
| **system** | `system.view_audit_log` | View the audit log |
| | `system.manage_roles` | Create, edit, delete roles and assign permissions |
| | `system.server_config` | Access server configuration settings |

### 8.3 Seed Roles

Two roles are seeded at launch. Super admins can create additional roles
(e.g. "Lore Keeper" with only `family_tree.*` + `content.edit_bios`,
or "Application Reviewer" with only `applications.*`).

**Moderator** (seed)
- `applications.view_queue`, `applications.review`,
  `applications.comment_public`, `applications.comment_private`
- `family_tree.manage`, `family_tree.approve_suggestions`
- `content.edit_bios`
- `players.view_list`
- `system.view_audit_log`

**Admin** (seed)
- All permissions from Moderator, plus:
- `applications.delete`
- `content.manage_houses`, `content.manage_regions`,
  `content.manage_organizations`, `content.manage_factions`
- `players.assign_roles`, `players.ban`, `players.delete_characters`
- `system.manage_roles`, `system.server_config`

### 8.4 Backend Middleware

Two middleware functions handle authorization:

```typescript
/**
 * Checks if the player has at least one of the required permissions.
 * Super admins always pass.
 */
function requirePermission(...keys: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const player = req.player; // set by auth middleware
    if (!player) return res.status(401).json({ error: 'Not authenticated' });
    if (player.isSuperAdmin) return next(); // bypass

    const playerPerms = await getPlayerPermissions(player.id); // cached per request
    if (keys.some(k => playerPerms.has(k))) return next();

    return res.status(403).json({ error: 'Insufficient permissions' });
  };
}

/**
 * Requires the player to be a super admin.
 * Used for system administration routes only.
 */
function requireSuperAdmin() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.player?.isSuperAdmin) {
      return res.status(403).json({ error: 'Super admin access required' });
    }
    next();
  };
}
```

Usage:
```typescript
router.get('/api/staff/applications', requirePermission('applications.view_queue'), ...);
router.patch('/api/staff/applications/:id', requirePermission('applications.review'), ...);
router.post('/api/sysadmin/roles', requireSuperAdmin(), ...);
```

The `getPlayerPermissions()` helper queries the player's `role_id`,
joins through `role_permissions` → `permissions`, and returns a `Set`
of permission keys. The result is cached on `req` for the duration of
the request. For Socket.IO, permissions are resolved at connection time
and refreshed on role change events.

### 8.5 Frontend Permission Model

The HUD frontend receives the player's permission set in the auth
payload (JWT claims or initial socket handshake):

```typescript
interface AuthPayload {
  playerId: number;
  characterId: number | null;
  roleName: string | null;     // "Moderator", "Admin", or custom
  permissions: string[];        // ["applications.review", "family_tree.manage", ...]
  isSuperAdmin: boolean;
}
```

Vue components use a composable to check permissions:

```typescript
const { hasPermission, isSuperAdmin } = useAuth();

// Conditionally render UI
v-if="hasPermission('applications.view_queue')"
v-if="isSuperAdmin"
```

This keeps the frontend decoupled from specific role names — it only
checks permission keys, so custom roles work without frontend changes.

### 8.6 Permission Scoping Summary

| Action | Required Permission |
|---|---|
| View application review queue | `applications.view_queue` |
| Review applications (approve/deny/revision) | `applications.review` |
| Post public staff comments | `applications.comment_public` |
| Post/view private staff comments | `applications.comment_private` |
| Delete applications | `applications.delete` |
| Manage family tree directly | `family_tree.manage` |
| Approve player family tree suggestions | `family_tree.approve_suggestions` |
| Flag/edit player public bios | `content.edit_bios` |
| Manage houses | `content.manage_houses` |
| Manage regions | `content.manage_regions` |
| Manage organizations | `content.manage_organizations` |
| Manage factions | `content.manage_factions` |
| View player list | `players.view_list` |
| Assign roles to players | `players.assign_roles` |
| Ban/suspend players | `players.ban` |
| Delete characters | `players.delete_characters` |
| View audit log | `system.view_audit_log` |
| Create/edit/delete roles & permissions | `system.manage_roles` |
| Server configuration | `system.server_config` |
| **System Administration panel** | **super_admin only** |

---

## 9. Application Comments

The existing `staff_notes TEXT` column on `character_applications` is a
single blob — insufficient for threaded conversation between staff and
applicants. It is replaced by a proper comments table supporting both
**public comments** (visible to the applicant) and **private comments**
(visible only to staff).

### 9.1 Data Model

```sql
CREATE TABLE IF NOT EXISTS application_comments (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_id  INT UNSIGNED NOT NULL,            -- FK → character_applications.id
    author_id       INT UNSIGNED NOT NULL,            -- FK → players.id (staff member)
    body            TEXT NOT NULL,                     -- Comment text (markdown supported)
    is_private      BOOLEAN DEFAULT FALSE,            -- TRUE = staff-only; FALSE = visible to applicant
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES character_applications(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES players(id)
);
```

The `staff_notes` column on `character_applications` is **retained** as
a legacy field for any pre-migration data but new comments use the
`application_comments` table exclusively.

### 9.2 Comment Visibility Rules

| Viewer | Sees Public Comments | Sees Private Comments |
|---|---|---|
| Applicant (owning player) | Yes | No |
| Moderator | Yes | Yes |
| Admin | Yes | Yes |
| Other players | No | No |

- **Public comments** are used for feedback the applicant should see:
  requests for revision, praise, approval rationale, or questions about
  the character concept. They are tagged with a "Staff" badge in the UI.
- **Private comments** are internal staff discussion: concerns about the
  player, meta-game notes, coordination between reviewers. The applicant
  never sees these.
- Only staff (moderator/admin) can post comments. Applicants cannot
  reply via comments — they revise their application or contact staff
  through Discord. This keeps the comment thread focused on review.

### 9.3 Comment Notifications

- When a public comment is posted on an application, the applicant
  receives an in-app notification: "A staff member commented on your
  application for [Character Name]."
- When a private comment is posted, other online staff members receive a
  notification.
- Future: Discord webhook posts to a `#staff-applications` channel for
  both comment types.

---

## 10. Application Visibility — The Player View

Players can view the status of their own applications from both the HUD
and the web portal. They cannot view other players' applications.

### 10.1 Player Application List

Accessible from the **Character Panel** or a dedicated "My Applications"
section. Shows:

| Column | Description |
|---|---|
| Character Name | The character this application is for |
| Status | `pending` / `approved` / `denied` / `revision` — color-coded badge |
| Submitted | Date submitted |
| Last Updated | Date of most recent status change or public comment |

Clicking an application opens the **Application Detail View**.

### 10.2 Application Detail View (Player)

The player sees their full application as submitted:

- Character name, house, lineage flags, requested role
- Father / mother names
- Featured role toggle status
- Head of House contact response (if applicable)
- Application bio (full text, read-only after submission)
- Public bio (as submitted)
- **Status badge** with timestamp (e.g. "Approved on 2026-02-15 by
  Moderator")
- **Public staff comments** — displayed in chronological order below the
  application, each showing the staff member's display name, timestamp,
  and comment body. Styled distinctly from the application content
  (e.g. staff badge, indented block).

The player does **not** see:
- Private staff comments
- The name of the reviewer (unless staff chooses to sign their public
  comment) — the reviewer field (`reviewed_by`) is staff-only
- Other players' applications

### 10.3 Revision Workflow

When an application is set to `revision` status:

1. Staff posts a public comment explaining what needs to change.
2. The applicant receives a notification.
3. The applicant opens the Application Detail View, reads the comment,
   and clicks "Edit & Resubmit."
4. Editable fields unlock: `application_bio`, `public_bio`,
   `hoh_contact`, and lineage flags. Name and template cannot change.
5. On resubmission, status returns to `pending` and staff is notified.
6. The original submission is preserved in the comment history (the
   system auto-posts a private comment: "Application resubmitted —
   previous version archived").

---

## 11. Admin Panel — HUD & Web Portal

The application review system is accessible from two surfaces:

1. **HUD Admin Panel** — An in-HUD overlay panel shown when the logged-in
   player has `role = 'moderator'` or `role = 'admin'`. Designed for
   quick review while in-game.
2. **Web Portal** — A standalone browser-based interface (separate from
   the Electron app) for full-featured application management from any
   device. Authenticated via Discord OAuth (same flow as the HUD).

Both surfaces share the same backend API routes and permission model.

### 11.1 HUD Admin Panel

#### Activation

- The HUD detects the player's permissions from the auth payload
  received at login (JWT claims include `permissions[]` and `roleName`).
- When the player has **any** staff permission (i.e. `role_id` is not
  NULL), a **Staff** icon appears in the HUD chrome (e.g. a shield or
  crown icon near the system tray area).
- Clicking the Staff icon opens a slide-out Admin Panel within the HUD
  overlay.
- The Admin Panel is a Vue component rendered in the HUD window — it
  does not spawn a new Electron window.

#### Panel Layout

```
┌─────────────────────────────────────┐
│ ☰ Staff Panel             [X Close] │
├─────────────────────────────────────┤
│ [Applications] [Family Trees] [Bio] │
│─────────────────────────────────────│
│                                     │
│  Applications Queue                 │
│  ┌───────────────────────────────┐  │
│  │ ● Robb Stark     Tier 3  NEW │  │
│  │   House: Stark | HoH request │  │
│  │   Submitted: 2h ago         │  │
│  ├───────────────────────────────┤  │
│  │ ○ Jon Rivers     Tier 2      │  │
│  │   House: Stark | Bastard     │  │
│  │   Submitted: 1d ago         │  │
│  ├───────────────────────────────┤  │
│  │ ○ Maric of Lys   Tier 2      │  │
│  │   Org: Golden Company        │  │
│  │   Submitted: 3d ago         │  │
│  └───────────────────────────────┘  │
│                                     │
│  [Show: Pending ▼] [Sort: Newest ▼] │
│                                     │
└─────────────────────────────────────┘
```

#### Application Review (HUD)

Clicking an application in the queue opens a detail view:

```
┌─────────────────────────────────────┐
│ ← Back           Review Application │
├─────────────────────────────────────┤
│ Robb Stark            STATUS: PENDING│
│ House: Stark (Great House)          │
│ Role: Head of House  ★ Featured     │
│ Bastard: No  |  Dragon Seed: No    │
│ Father: Eddard Stark               │
│ Mother: Catelyn Tully              │
│─────────────────────────────────────│
│ HoH Contact:                       │
│ "I spoke with the current HoH      │
│  player via Discord on 2/14..."     │
│─────────────────────────────────────│
│ Application Bio:                    │
│ [Full backstory text, scrollable]   │
│                                     │
│─────────────────────────────────────│
│ Public Bio:                         │
│ [Submitted public bio text]         │
│─────────────────────────────────────│
│ Comments:                           │
│ ┌─ Staff (public) ─ Mod Alice ────┐ │
│ │ Looks good, but please expand   │ │
│ │ on the relationship with the    │ │
│ │ Boltons.               2h ago  │ │
│ └─────────────────────────────────┘ │
│ ┌─ Staff (private) ─ Admin Bob ──┐  │
│ │ Player has a good track record. │  │
│ │ I'd approve once they revise.   │  │
│ │                        1h ago  │  │
│ └─────────────────────────────────┘ │
│                                     │
│ [Add Comment ▼ Public/Private]      │
│ ┌─────────────────────────────────┐ │
│ │ Type comment here...            │ │
│ └─────────────────────────────────┘ │
│ [Post Comment]                      │
│                                     │
│ ┌─────────┐ ┌──────┐ ┌──────────┐  │
│ │ Approve │ │ Deny │ │ Revision │  │
│ └─────────┘ └──────┘ └──────────┘  │
└─────────────────────────────────────┘
```

**HUD Panel Tabs:**

| Tab | Purpose |
|---|---|
| Applications | Queue of pending/recent applications. Filter by status, tier, house. |
| Family Trees | Pending player suggestions for family tree edges/NPCs. Approve/deny. |
| Bio Review | Flagged public bios that need staff attention. (Future) |

The HUD panel is intentionally compact — it surfaces the most common
staff actions. Complex management (bulk operations, house/region setup,
role assignment) is reserved for the web portal.

### 11.2 Web Portal

The web portal is a separate Express-served single-page application
(Vue 3 SPA, no Electron dependency) hosted on the same backend server.
It provides the full administrative experience outside the game.

#### Authentication

- Same Discord OAuth flow as the HUD.
- On login, the backend issues a session cookie (or JWT stored in
  `httpOnly` cookie) for the browser session.
- Permission-based access: staff pages require the relevant permission
  (e.g. `applications.view_queue`). System Administration requires
  `is_super_admin`. Players can access the portal to view their own
  applications and public social viewer pages.

#### Portal Routes

| Route | Access | Description |
|---|---|---|
| `/portal` | All players | Landing page — links to social viewer and "My Applications" |
| `/portal/applications` | Player | Player's own application list |
| `/portal/applications/:id` | Player (owner) | Application detail + public comments |
| `/portal/staff/applications` | `applications.view_queue` | Application review queue |
| `/portal/staff/applications/:id` | `applications.view_queue` | Full review view with private comments |
| `/portal/staff/family-trees` | `family_tree.approve_suggestions` | Pending family tree suggestions |
| `/portal/staff/players` | `players.view_list` | Player list — role assignment, bans |
| `/portal/staff/houses` | `content.manage_houses` | House management — create, edit, assign HoH |
| `/portal/staff/regions` | `content.manage_regions` | Region management — create, edit, assign warden |
| `/portal/staff/organizations` | `content.manage_organizations` | Organization management |
| `/portal/sysadmin` | Super Admin | System Administration landing page |
| `/portal/sysadmin/roles` | Super Admin | Role editor — create, edit, delete roles |
| `/portal/sysadmin/roles/:id` | Super Admin | Permission matrix for a specific role |
| `/portal/sysadmin/audit-log` | Super Admin | Full audit log viewer |
| `/portal/sysadmin/server` | Super Admin | Server configuration |
| `/portal/sysadmin/database` | Super Admin | Database management — migrations, schema, query |
| `/portal/social/regions` | All players | Public social viewer — region list |
| `/portal/social/regions/:id` | All players | Region page |
| `/portal/social/houses/:id` | All players | House page + family tree |
| `/portal/social/characters/:id` | All players | Character page |

#### Application Review (Web Portal)

The web portal review view is functionally identical to the HUD version
but benefits from a full browser layout:

- **Left sidebar**: Application queue with filters (status, tier, house,
  date range, reviewer).
- **Main content**: Selected application detail — all fields, bios,
  lineage, and HoH contact response.
- **Right sidebar / below**: Comment thread (public and private,
  clearly distinguished). Staff can toggle comment visibility
  (public/private) before posting.
- **Action bar**: Approve / Deny / Request Revision buttons. Each
  action prompts for an optional comment (defaulting to public for
  approvals, public for revisions, private for denials).

#### Additional Web Portal Features

- **Bulk actions**: Select multiple pending applications and approve or
  deny in batch (with a shared comment).
- **Search**: Full-text search across application bios, character names,
  and house names.
- **Audit log**: History of all staff actions (role changes, application
  decisions, family tree edits) with timestamp and actor.
- **Statistics dashboard** (admin only): Application volume, average
  review time, approval/denial rates, active staff reviewers.

### 11.3 Shared API Routes

Both the HUD and web portal consume the same REST API:

| Method | Route | Permission | Description |
|---|---|---|---|
| `GET` | `/api/applications` | Player (auth) | Own applications (filtered by auth) |
| `GET` | `/api/applications/:id` | Player (owner) / Staff | Application detail |
| `GET` | `/api/staff/applications` | `applications.view_queue` | All applications with filters |
| `PATCH` | `/api/staff/applications/:id` | `applications.review` | Update status (approve/deny/revision) |
| `GET` | `/api/applications/:id/comments` | Player (owner, public only) / Staff (all) | Comment thread |
| `POST` | `/api/staff/applications/:id/comments` | `applications.comment_public` or `_private` | Post comment (body includes `is_private`) |
| `GET` | `/api/staff/family-tree/pending` | `family_tree.approve_suggestions` | Pending family tree suggestions |
| `PATCH` | `/api/staff/family-tree/edges/:id` | `family_tree.approve_suggestions` | Approve/deny edge suggestion |
| `GET` | `/api/staff/players` | `players.view_list` | Player list with roles |
| `PATCH` | `/api/staff/players/:id/role` | `players.assign_roles` | Update player role |
| `GET` | `/api/sysadmin/roles` | Super Admin | List all roles with permissions |
| `POST` | `/api/sysadmin/roles` | Super Admin | Create a new role |
| `PATCH` | `/api/sysadmin/roles/:id` | Super Admin | Update role name/description/permissions |
| `DELETE` | `/api/sysadmin/roles/:id` | Super Admin | Delete a role (unassigns from all players) |
| `GET` | `/api/sysadmin/permissions` | Super Admin | List all available permissions |
| `GET` | `/api/sysadmin/audit-log` | Super Admin | Query audit log (filterable) |
| `GET` | `/api/sysadmin/database/schema` | Super Admin | List all tables with column metadata |
| `GET` | `/api/sysadmin/database/migrations` | Super Admin | List migrations with applied status |
| `POST` | `/api/sysadmin/database/migrations/run` | Super Admin | Apply pending migrations |
| `POST` | `/api/sysadmin/database/query` | Super Admin | Execute a raw SQL query (read-only by default) |
| `POST` | `/api/sysadmin/database/execute` | Super Admin | Execute a write SQL statement (requires confirmation token) |

Socket.IO events provide real-time updates to both surfaces:
- `application:submitted` — new application in queue (staff only)
- `application:updated` — status change (sent to applicant + staff)
- `application:comment` — new comment posted (sent to applicant for
  public, staff for private)
- `familytree:suggestion` — new pending suggestion (staff only)

### 11.4 System Administration Panel (Super Admin)

The System Administration panel is a dedicated section of the **web
portal only** — it is not available in the HUD due to its complexity.
Only players with `is_super_admin = TRUE` can access it.

#### Access

- A "System Admin" link appears in the web portal sidebar **only** for
  super admins.
- The entire `/portal/sysadmin/*` route tree is guarded by
  `requireSuperAdmin()` middleware on both the frontend (route guard)
  and backend (API middleware).
- Non-super-admin staff (moderators, admins) cannot see or navigate to
  these pages.

#### Role Manager (`/portal/sysadmin/roles`)

The role manager is the primary tool for configuring the RBAC system.

```
┌──────────────────────────────────────────────────────┐
│ System Administration > Roles                        │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Roles                          [+ Create New Role]  │
│  ┌────────────────────────────────────────────────┐  │
│  │ ● Moderator          12 permissions    5 users │  │
│  │   Review apps, manage family trees, mod bios   │  │
│  ├────────────────────────────────────────────────┤  │
│  │ ● Admin               20 permissions    2 users│  │
│  │   Full staff access, role assignment           │  │
│  ├────────────────────────────────────────────────┤  │
│  │ ○ Lore Keeper          4 permissions    1 user │  │
│  │   Family trees and bio editing only            │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

#### Role Editor (`/portal/sysadmin/roles/:id`)

Clicking a role opens the permission matrix editor:

```
┌──────────────────────────────────────────────────────┐
│ System Administration > Roles > Moderator            │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Name: [Moderator        ]  Color: [#c9a84c]        │
│  Description: [Review apps, manage family trees...] │
│                                                      │
│  ── Applications ──────────────────────────────────  │
│  [✓] View application queue                          │
│  [✓] Approve, deny, or request revision              │
│  [✓] Post public staff comments                      │
│  [✓] Post and view private staff comments            │
│  [ ] Delete applications                             │
│                                                      │
│  ── Family Tree ───────────────────────────────────  │
│  [✓] Add/remove/edit nodes and edges                 │
│  [✓] Approve or deny player suggestions              │
│                                                      │
│  ── Content ───────────────────────────────────────  │
│  [✓] Flag or edit player public bios                 │
│  [ ] Manage houses                                   │
│  [ ] Manage regions                                  │
│  [ ] Manage organizations                            │
│  [ ] Manage factions                                 │
│                                                      │
│  ── Players ───────────────────────────────────────  │
│  [✓] View player list                                │
│  [ ] Assign roles to players                         │
│  [ ] Ban or suspend players                          │
│  [ ] Delete characters                               │
│                                                      │
│  ── System ────────────────────────────────────────  │
│  [✓] View audit log                                  │
│  [ ] Create/edit/delete roles & permissions          │
│  [ ] Server configuration                            │
│                                                      │
│  Players with this role (5):                         │
│  Alice, Bob, Charlie, Dana, Eve                      │
│                                                      │
│  [Save Changes]                    [Delete Role]     │
└──────────────────────────────────────────────────────┘
```

**Key behaviors:**
- Permissions are grouped by category with checkboxes.
- Changes are previewed before saving — a confirmation dialog shows
  what was added/removed and how many players are affected.
- Deleting a role unassigns it from all players (they become roleless /
  `role_id = NULL` and lose all staff access). A confirmation dialog
  warns about this.
- The two seed roles (Moderator, Admin) can be edited but not deleted.
- Role names must be unique.
- The `color` field sets the badge color shown next to staff names in
  comments and the player list.

#### Player Role Assignment

From the **Player List** page (`/portal/staff/players`), staff with
`players.assign_roles` permission can assign roles:

- Each player row shows their current role (or "—" if none).
- Clicking the role badge opens a dropdown of all available roles.
- Assigning a role sets `players.role_id` to the selected role's ID.
- Removing a role sets `players.role_id = NULL`.
- The `is_super_admin` flag is **not** editable from the UI — it is
  intentionally database-only.

#### Audit Log (`/portal/sysadmin/audit-log`)

A searchable, filterable log of all staff actions:

| Column | Description |
|---|---|
| Timestamp | When the action occurred |
| Actor | Staff member who performed the action (player name + role) |
| Action | Machine-readable action key (e.g. `application.approved`, `role.created`) |
| Description | Human-readable summary (e.g. "Approved application for Robb Stark") |
| Target | The affected entity (player, character, role, application) |

The audit log is append-only — entries cannot be edited or deleted.
Super admins can view the full log; staff with `system.view_audit_log`
permission can view a filtered subset (excluding role/permission
changes).

#### Server Configuration (`/portal/sysadmin/server`)

Future placeholder for server-wide settings:
- Application bio minimum character counts per tier
- Activity thresholds for featured role warnings
- Discord webhook URLs for notifications
- Maintenance mode toggle
- Announcement banner text

These settings are stored in a `server_config` key-value table and
loaded at server startup. Details deferred to a future design document.

#### Database Management (`/portal/sysadmin/database`)

A browser-based database administration panel for super admins. This
replaces the need to SSH into the server or use a desktop client like
HeidiSQL for routine database tasks.

**Tabs:**

| Tab | Description |
|---|---|
| Schema Browser | Visual overview of all tables, columns, types, indexes, and foreign keys. |
| Migrations | List of migration files with applied/pending status. Run pending migrations with one click. |
| Query Console | Execute SQL directly against the database from the browser. |

##### Schema Browser

```
┌──────────────────────────────────────────────────────┐
│ Database > Schema Browser                            │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Tables (24)                      [Search tables...] │
│  ┌────────────────────────────────────────────────┐  │
│  │ ▶ characters              42 columns   1,283 rows│ │
│  │ ▶ character_applications  18 columns      47 rows│ │
│  │ ▶ application_comments     6 columns      93 rows│ │
│  │ ▶ players                 12 columns     214 rows│ │
│  │ ▶ houses                  12 columns      14 rows│ │
│  │ ▶ roles                    6 columns       3 rows│ │
│  │ ▶ permissions              5 columns      20 rows│ │
│  │ ...                                              │ │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ▼ characters                                        │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Column          │ Type          │ Nullable │ Key │ │
│  │─────────────────┼───────────────┼──────────┼─────│ │
│  │ id              │ INT UNSIGNED  │ NO       │ PRI │ │
│  │ player_id       │ INT UNSIGNED  │ NO       │ FK  │ │
│  │ name            │ VARCHAR(100)  │ NO       │ UNI │ │
│  │ house_id        │ INT UNSIGNED  │ YES      │ FK  │ │
│  │ ...             │               │          │     │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
└──────────────────────────────────────────────────────┘
```

- Clicking a table expands its column listing with types, nullability,
  default values, and key status (PK, FK, UNI, IDX).
- Foreign key columns show a link to the referenced table.
- Row counts are displayed per table (approximate, from
  `INFORMATION_SCHEMA.TABLES`).
- Schema data is read from MariaDB's `INFORMATION_SCHEMA` — no manual
  maintenance required.

##### Migrations

```
┌──────────────────────────────────────────────────────┐
│ Database > Migrations                                │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Migration History                                   │
│  ┌─────────────────────────────────────────────────┐ │
│  │ ✓ 001_add_discord_columns.sql      2025-11-02  │ │
│  │ ✓ 002_aptitudes_equipment_skills.sql 2025-11-15 │ │
│  │ ✓ 003_character_level.sql          2025-11-20  │ │
│  │ ✓ 004_skill_cap_10.sql             2025-12-01  │ │
│  │ ✓ 005_unspent_points.sql           2025-12-10  │ │
│  │ ✓ 006_wound_system.sql             2026-01-15  │ │
│  │ ○ 007_character_applications.sql   PENDING     │ │
│  │ ○ 008_rbac_system.sql              PENDING     │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  2 pending migrations                                │
│  [Preview Pending SQL]     [Run Pending Migrations]  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

- Lists all migration files from `database/migrations/` with applied
  status tracked in a `schema_migrations` table.
- **Preview** shows the raw SQL of each pending migration before
  execution.
- **Run** applies pending migrations in order within a transaction.
  Success or failure is reported inline with the affected row counts.
- Each migration run is logged to the audit log with the executing
  super admin's identity.
- Migrations cannot be rolled back from the UI — rollback scripts must
  be written and applied as new forward migrations.

##### Query Console

```
┌──────────────────────────────────────────────────────┐
│ Database > Query Console                             │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │ SELECT c.name, h.name AS house, c.level         │ │
│  │ FROM characters c                               │ │
│  │ LEFT JOIN houses h ON c.house_id = h.id         │ │
│  │ WHERE c.level >= 10                             │ │
│  │ ORDER BY c.level DESC                           │ │
│  │ LIMIT 50;                                       │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  Mode: [● Read-Only (SELECT)]  [○ Write (DML/DDL)]  │
│  [Execute Query]                   Elapsed: 12ms     │
│                                                      │
│  Results (23 rows):                                  │
│  ┌──────────────┬────────────┬───────┐               │
│  │ name         │ house      │ level │               │
│  │──────────────┼────────────┼───────│               │
│  │ Daemon Stark │ Stark      │ 18    │               │
│  │ Cersei Lann… │ Lannister  │ 16    │               │
│  │ ...          │            │       │               │
│  └──────────────┴────────────┴───────┘               │
│                                    [Export CSV]       │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Two modes:**

| Mode | Allowed Statements | Safety |
|---|---|---|
| **Read-Only** (default) | `SELECT`, `SHOW`, `DESCRIBE`, `EXPLAIN` | No confirmation needed. Results displayed in a scrollable table. |
| **Write** | `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `CREATE`, `DROP` | Requires a two-step confirmation flow (see below). |

**Write mode safety:**

1. Super admin toggles to Write mode.
2. Types a write statement and clicks Execute.
3. The backend parses the statement and returns a preview:
   - For `UPDATE`/`DELETE`: a `SELECT` equivalent is run first to show
     the rows that **will be affected** (e.g. "This UPDATE will modify
     47 rows in `characters`").
   - For `ALTER`/`DROP`/`CREATE`: the statement text is shown verbatim.
4. A confirmation dialog displays the preview with a **confirmation
   token** (short random string) that the super admin must type to
   proceed. This prevents accidental clicks.
5. On confirmation, the statement is executed. The result (rows affected
   or error) is displayed inline.
6. Every write query is logged to the audit log with the full SQL text,
   the executing super admin, and the result.

**Additional features:**
- **Query history**: Recent queries are stored in browser local storage
  for quick re-execution.
- **Syntax highlighting**: SQL keywords highlighted in the editor
  (CodeMirror or Monaco widget).
- **CSV export**: Query results can be downloaded as CSV.
- **Row limit**: All queries are implicitly wrapped with `LIMIT 1000`
  unless the user explicitly specifies a higher limit (max 10,000) to
  prevent accidental full-table dumps.
- **Timeout**: Queries are killed after 30 seconds to prevent
  long-running locks.

**Security considerations:**
- The query console endpoint (`/api/sysadmin/database/query` and
  `/execute`) is guarded by `requireSuperAdmin()` middleware.
- Parameterized queries are not applicable here (raw SQL is the point),
  so the risk is accepted by design — only super admins have access,
  and all queries are audit-logged.
- The database connection used by the query console should be a
  **separate connection pool** with a lower `max_connections` limit to
  prevent admin queries from starving the application pool.
- `DROP DATABASE`, `GRANT`, `REVOKE`, and `FLUSH` statements are
  blacklisted and rejected regardless of mode.

---

## 12. Future Considerations

- **Ward relationship**: The family tree (Section 6.6) covers parent,
  spouse, and sibling. A `ward` relationship type could be added later
  for fostered children (politically significant in Westerosi culture).
- **Holding system**: Great Houses will eventually control holdings
  (castles, towns). Head of House manages the holding vault. The old
  schema (`05_holdings.sql`) has a rich design that can be adapted.
- **Succession mechanics**: When a Head of House dies or is removed, the
  system should assist staff in identifying eligible heirs based on
  family relationships and legitimacy.
- **Legitimization**: Staff action that flips `is_bastard = FALSE` and
  optionally changes the character's surname. Should create an audit
  log entry.
- **Dragon content**: If dragons are added, `is_dragon_seed` becomes
  mechanically relevant for binding eligibility.
- **Discord webhook**: Application submissions and decisions posted to a
  staff Discord channel for visibility.
- **Account Destinies interaction**: The destiny system (on hold) may
  eventually influence application eligibility or grant lineage
  bonuses at character creation.
- **Organization implementation**: Orders, guilds, and companies (Section
  6.4) are designed but will be implemented in a later phase after the
  core region/house/character hierarchy is working.
- **Faction influence mechanics**: Faction membership could eventually
  affect NPC pricing, combat bonuses in faction-controlled regions, or
  trigger faction-specific events.
- **Region maps**: Each region page could display an interactive map
  showing house seats, holdings, and points of interest.
