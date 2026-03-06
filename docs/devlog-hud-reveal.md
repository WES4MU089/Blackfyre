# Dragon's Dominion — DevLog #1: The HUD Reveal

---

## What is Dragon's Dominion?

Dragon's Dominion is a **next-generation roleplay experience** set in a dark medieval fantasy world inspired by Westeros. We're building something that has never existed in Second Life before — a fully integrated **HUD overlay system** that brings the depth of standalone RPG mechanics directly into your SL experience, without ever leaving the world.

Think of it as **FiveM meets Game of Thrones**. A transparent overlay sits on top of your Second Life viewer, handling everything from combat to crafting, politics to dragon-riding — all driven by real-time data, live dice rolls, and persistent world state.

This isn't a meter. This isn't a HUD attachment with floating text. This is a **dedicated desktop application** that connects to our servers and transforms Second Life into a living, breathing RPG.

---

## The Tech Behind It

Dragon's Dominion is powered by a custom-built tech stack:

- **Electron + Vue 3** — A native desktop app with a modern reactive UI
- **Real-time Socket.IO** — Every action, every dice roll, every chat message syncs instantly
- **Persistent World State** — Your character, inventory, wounds, allegiances — all saved server-side
- **Auto-Updating** — The HUD updates itself. No manual downloads after initial install.
- **Transparent Overlay** — The HUD renders over your SL viewer with click-through support. Press **F2** to toggle interaction, **F3** to show/hide, **F4** to customize your layout.

Every panel is **draggable and resizable**. Arrange your HUD however you like, and it remembers your layout between sessions.

---

## What's In the Box at Launch

### Discord Login & Seamless Authentication
Log in once with Discord. That's it. No passwords to remember, no notecards to fill out. Your Discord identity links to your Dragon's Dominion account, and you're in.

### Character Creation Wizard
A guided, multi-step character creation flow:

- **17 Class Templates** across 7 categories — Nobility, Military, Religious, Scholarly, Commerce, Criminal, and Common folk
- **9 Aptitudes** to allocate — Prowess, Fortitude, Command, Cunning, Stewardship, Presence, Lore, Faith, and Craftsmanship
- **Deep Identity** — Name your character, write your backstory, upload a portrait, choose your house, declare your lineage
- **Lineage Flags** — Bastard? Dragonseed? Head of House? Lord Paramount? The system tracks it all
- **Tiered Applications** — Common characters auto-approve. Featured roles (Heads of House, royalty) go through staff review with a full comment thread

### Live Combat System
Real-time, turn-based combat powered by a **d6 dice pool engine**:

- **Team-Based Battles** — Blue vs. Red, with full initiative order
- **Combatant Cards** — Portraits, health bars, equipped weapons, status effects — all visible at a glance
- **Live Combat Log** — Watch every attack resolve: dice pools, successes, damage, critical hits, dodges, and parries
- **Floating Callouts** — Damage numbers and critical hit notifications pop up on screen, fighting-game style
- **Wound Assessment** — After combat, injuries are assessed with severity, healing timers, and infection risks
- **Combat Lobby** — Set up fights before they begin: pick teams, add retainers, ready up, and go

### Inventory & Equipment
A full RPG inventory system:

- **25-Slot Inventory Grid** — Drag, drop, stack, and manage your gear
- **13+ Equipment Slots** — Head, chest, hands, main hand, off hand, rings, and more
- **Three-Tier Currency** — Dragons, Stags, and Stars (1 Dragon = 100 Stags = 10,000 Stars)
- **Item Rarity & Tiers** — Color-coded quality indicators so you know what's worth keeping
- **Weight & Encumbrance** — Carry too much and you'll feel it
- **Full Item Tooltips** — Hover over any item to see damage, penetration, mitigation, durability, material, and more

### NPC Interaction & Shops
The world is alive with NPCs:

- **Dynamic Dialog Trees** — Talk to NPCs with branching conversation options
- **Typewriter Text Effect** — Dialog reveals character-by-character for immersion
- **NPC Merchants** — Browse categorized shops (Weapons, Armor, Shields), see full stats before you buy, and manage your gold
- **Lootable Containers** — Find chests, crates, and stashes in the world. Check for locks, drag items out, manage your haul

### Retainer System
Hire and command followers:

- **Up to 4 Retainers** — Recruit NPCs to serve you
- **Tiered Retainers** — Different tiers with different costs and capabilities
- **Full Equipment & Inventory** — Gear up your retainers just like your main character
- **Combat Companions** — Bring your retainers into battle alongside you

### Chat System
A full in-world communication system:

- **Four Channels** — IC (In-Character), Whispers, OOC (Out-of-Character), and System messages
- **Chat Commands** — `/say`, `/shout`, `/low`, `/me`, `/w`, `/ooc`, `/gooc` — if you've used GTA World or FiveM, you'll feel right at home
- **Character Portraits** — Messages display with your uploaded portrait
- **Configurable Portrait Sizes** — Small, Medium, or Large — your choice
- **Session Player List** — See who's online in your region with GTA World-style session IDs

### Social & Political Layer
See the world's power structures at a glance:

- **Region Browser** — Explore the Nine Regions and see who rules each one
- **Noble Houses** — View sigils, mottos, seats, members, and family trees
- **Organizations** — Guilds, Orders, and Companies — join up or form your own
- **Factions** — Political and military alignments with leader info and member rosters
- **Family Tree Widget** — Visualize noble lineages and NPC relationships

### Health, Wounds & Ailments
Consequences are real:

- **Five Wound Severities** — Healthy, Light, Serious, Severe, Grave — each with dice pool penalties
- **Healing Timers** — Wounds take real time to heal, displayed with countdown clocks
- **Ailment Tracking** — Diseases and poisons progress through stages with symptoms, immunity windows, and cures
- **No HP Potions** — You fight, you bleed, you heal. Time and tending are your medicine.

### Notifications & Status
Stay informed:

- **Toast Notifications** — Pop-up alerts for combat, messages, world events
- **Persistent Notification Panel** — Check your backlog anytime
- **Connection Status** — Live latency display so you know your connection is solid
- **Location Data** — Current region, coordinates, and nearby player count
- **Westeros Clock** — In-world time display

### Staff Tools (Admin Panel)
For our storytelling team:

- **Application Review Queue** — Filter, sort, review, and comment on character applications
- **Organization & Faction Management** — Create and manage world entities
- **Family Tree Administration** — Approve lineage submissions
- **Audit Logging** — Full history of every staff action for transparency

---

## The Roadmap: What's Coming After Launch

Launch is just the beginning. Here's what's already designed, validated, and queued for deployment:

### Phase 2: The Warfare Battle System (WBS)

This is the big one. A **full-scale warfare engine** that turns political roleplay into strategic reality.

**Army Composition & Holdings**
- Three troop types: **Levy** (cheap masses), **Men-at-Arms** (trained soldiers), **Elite** (devastating veterans)
- Holdings generate troops based on **Type** (Military, Hybrid, Civilian) and **Size** (1-3)
- **Equipment Tiers T1-T5** — Better gear means better soldiers
- **Regional Synergy** — Field an army from a single region and earn combat bonuses

**The War Council (9 Seats)**
Every war needs leadership. Appoint your council:

| Seat | Aptitude | Role |
|---|---|---|
| **Warlord** | Command | Overall strategy, sets gambits |
| **Vanguard** | Prowess | Offensive combat bonuses |
| **Quartermaster** | Stewardship | Logistics, supply, faster mustering |
| **Champion** | Prowess | Morale through reputation |
| **Spymaster** | Cunning | Scouting, detecting defections |
| **Admiral** | Cunning | Naval fleet command |
| **Dragonlord** | Lore | Aerial tactics, dragon coordination |
| **Arbiter** | Faith | Faith-based morale, trials |
| **Siege Master** | Craftsmanship | Siege engine tiers & build speed |

**Morale & Routing**
- Morale swings from -20 to +20 based on battle performance
- Broken armies rout — losing 50% effectiveness
- **Dragons shift morale** by their tier every tick. A T5 dragon on the field is terrifying.

**Siege Warfare**
- Settlements have HP based on type and fortification
- **Siege Engines T1-T5** — Built on-site by your Siege Master
- **Starvation Mechanics** — Cut off food supply and wait them out
- **Scorpion Batteries** — Defenders can shoot back at siege engines
- **Dragon Strafe Runs** — Burn siege equipment or defenders from above

**Naval Combat & Blockades**
- Fleet-based warfare with the same dice engine
- **Blockade ports** to cut off sea supply (requires 25+ ships)
- Dragons vs. Fleets — a T5 dragon dominates small fleets, but 100+ ships can threaten even the mightiest
- **Fire Spread** — Ships burn. 30% chance each destroyed ship sets the next one ablaze.

### Dragons

18 named dragons across 5 tiers, from fledgling hatchlings to world-ending apex predators:

- **T5 Apex Dragons**: Vhagar, Caraxes, Meleys, Vermithor, and The Cannibal
- **T4 Formidable**: Dreamfyre, Silverwing
- **T3 War-Capable**: Sunfyre, Seasmoke, Sheepstealer, and more
- Every dragon has **unique stats** (Might, Agility, Ferocity, Resilience) and a **hidden favored aptitude**

**Dragon Bonding** is a one-shot event. You get one attempt per dragon, ever. Fail, and that dragon is closed to you forever. Critically fail, and the dragon may kill you.

Your bonding pool combines your aptitude score, lore rituals, faith invocations, personal sacrifice (up to human sacrifice), and group assistance. Even with maximum preparation, bonding a T5 dragon is a coin flip. Attempting The Cannibal unprepared is suicide.

### The Bannerman System

NPC lords aren't decorations — they're political actors with opinions:

- **Disposition Score (-100 to +100)** — From Rebellious to Loyal
- **Calling the Banners** — Loyal lords answer immediately with full forces. Hostile lords send 65% and may defect mid-campaign.
- **NPC Petitions** — Your bannermen come to you with problems. Ignore them at your peril — cascading neglect turns allies into rebels.
- **Defection & Rebellion** — Push a lord too far and they'll raise their own army against you
- **Tyranny System** — Commit atrocities (kinslaying, violating guest right, executing prisoners) and watch your realm crumble

**9 Acts of Tyranny** — from moderate (war without declaration) to extreme (violation of guest right, kinslaying). Some stains never wash off.

### Mercenary Companies

When your own armies aren't enough, hire professionals:

- **The Gold Company** — 2,000 men, honorable, expensive, never breaks a contract
- **The Second Sons** — 1,200 men, pragmatic, balanced
- **The Brave Companions** — 800 men, cheap and brutal — but they might switch sides
- **The Stormcrows** — 600 men, light and flexible

### Casus Belli & Justice

War has rules. Break them and pay the price:

- **6 Types of Casus Belli** — from righteous defense to unprovoked aggression
- **Trial Among Peers** — Noble justice before the council
- **Trial by Combat** — The gods decide. Deny this right and commit an Act of Tyranny.
- **Trial by Seven** — The holiest judgment. Seven champions per side.

### Future Phases

Beyond the warfare system, we have designs queued for:

- **Alliances & Pacts** — Formal treaties, mutual defense, marriage as politics
- **Succession Law** — Inheritance, disputed claims, regency
- **Small Council Mechanics** — Mechanical roles for the realm's councillors
- **The Faith's Authority** — Excommunication, sanctuary, condemnation of tyranny
- **Marriage Law** — Faith officiating, diplomatic implications
- **Wardship & Hostages** — Fostering, loyalty guarantees

---

## The Setting

Dragon's Dominion is set in the year **120 AC** — a Westeros-inspired world where the Targaryen dynasty rules from the Iron Throne, dragons darken the skies, and the great houses maneuver for power.

**Four Faiths** shape the spiritual landscape:
- **The Seven** — The dominant faith of the south
- **The Old Gods** — Worshipped in the North, ancient and wordless
- **R'hllor, the Lord of Light** — Fire and shadow, prophecy and sacrifice
- **The Drowned God** — What is dead may never die

**Nine Regions** carve the continent, each with ruling houses, bannermen, resources, and ambitions. From the frozen North to sun-scorched Dorne, every region is a theater for conflict.

The realm has known rebellion, plague, dragonfire, and treachery. The political landscape is a powder keg. Who will seize the moment?

---

## Why Dragon's Dominion?

**Because nothing like this exists.**

- No more notecards and honor-system stat tracking
- No more dice HUDs that can't remember your name
- No more "combat meters" with zero narrative depth
- No more spreadsheets to track your holdings and armies

Everything is **live, persistent, and integrated**. Your character sheet is always up to date. Your inventory is real. Your wounds heal in real time. Your bannermen remember how you treated them. Your dragon remembers who tried to claim it.

This is roleplay with **teeth**.

---

## How to Get Involved

Dragon's Dominion is approaching its sim launch. Here's how to stay connected:

- **Join our Discord** — [Link to Discord]
- **Follow development** — DevLogs will continue as we approach launch
- **Apply for Featured Roles** — Heads of Houses, Lord Paramounts, and other key positions will be available for application before launch
- **Spread the word** — Share this with your RP community

The dragons are waking. The banners are being called. The question is: **whose side will you be on?**

---

*— The Dragon's Dominion Development Team*
