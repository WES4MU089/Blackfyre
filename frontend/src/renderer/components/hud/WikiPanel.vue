<script setup lang="ts">
import { ref, computed } from 'vue'
import { useHudStore } from '@/stores/hud'
import { useDraggable } from '@/composables/useDraggable'
import { useResizable } from '@/composables/useResizable'

const hudStore = useHudStore()
const panelRef = ref<HTMLElement | null>(null)
const { isDragging, onDragStart } = useDraggable('wiki', panelRef, { alwaysDraggable: true })
const { isResizing, onResizeStart, currentWidth, currentHeight } = useResizable(
  'wiki', panelRef,
  { minWidth: 400, maxWidth: 900, minHeight: 300, maxHeight: 900 },
)

interface WikiSection {
  id: string
  label: string
}

interface WikiCategory {
  id: string
  label: string
  sections: WikiSection[]
}

const categories: WikiCategory[] = [
  {
    id: 'combat',
    label: 'Combat',
    sections: [
      { id: 'overview', label: 'Overview' },
      { id: 'attack', label: 'Attacking' },
      { id: 'defense', label: 'Defending' },
      { id: 'weapons', label: 'Weapons' },
      { id: 'armor', label: 'Armor & Shields' },
      { id: 'damage', label: 'Damage' },
      { id: 'status', label: 'Status Effects' },
      { id: 'special', label: 'Maneuvers' },
      { id: 'initiative', label: 'Initiative' },
    ],
  },
]

const activeCategory = ref('combat')
const activeSection = ref('overview')
const expandedCategories = ref<Set<string>>(new Set(['combat']))

function toggleCategory(catId: string) {
  if (expandedCategories.value.has(catId)) {
    expandedCategories.value.delete(catId)
  } else {
    expandedCategories.value.add(catId)
  }
  activeCategory.value = catId
  // Scroll to top of category content
  const cat = categories.find(c => c.id === catId)
  if (cat && cat.sections.length > 0) {
    activeSection.value = cat.sections[0].id
    const el = document.getElementById(`wiki-${cat.sections[0].id}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function scrollToSection(catId: string, sectionId: string) {
  activeCategory.value = catId
  activeSection.value = sectionId
  const el = document.getElementById(`wiki-${sectionId}`)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const panelStyle = computed(() => ({
  width: currentWidth.value + 'px',
  height: currentHeight.value + 'px',
}))

function close() {
  hudStore.toggleSystemPanel('wiki')
}
</script>

<template>
  <div class="wiki-panel-wrapper" :style="panelStyle">
    <div
      ref="panelRef"
      class="wiki-panel panel-ornate animate-fade-in"
      :class="{ 'is-dragging': isDragging || isResizing }"
      :style="panelStyle"
    >
      <!-- Header (drag handle) -->
      <div class="wiki-header" @mousedown="onDragStart">
        <span class="wiki-title">Codex</span>
        <button class="wiki-close" @click="close" title="Close">&times;</button>
      </div>

      <!-- Body: sidebar TOC + scrollable content -->
      <div class="wiki-body">
        <!-- Table of Contents -->
        <nav class="wiki-toc">
          <div v-for="cat in categories" :key="cat.id" class="wiki-toc-category">
            <button
              class="wiki-toc-cat-header"
              :class="{ 'wiki-toc-cat-header--active': activeCategory === cat.id }"
              @click="toggleCategory(cat.id)"
            >
              <span class="wiki-toc-chevron" :class="{ 'wiki-toc-chevron--open': expandedCategories.has(cat.id) }">&#9656;</span>
              {{ cat.label }}
            </button>
            <div v-if="expandedCategories.has(cat.id)" class="wiki-toc-sections">
              <button
                v-for="s in cat.sections"
                :key="s.id"
                class="wiki-toc-item"
                :class="{ 'wiki-toc-item--active': activeCategory === cat.id && activeSection === s.id }"
                @click="scrollToSection(cat.id, s.id)"
              >
                {{ s.label }}
              </button>
            </div>
          </div>
        </nav>

        <!-- Content -->
        <div class="wiki-content">

          <!-- Overview -->
          <section id="wiki-overview" class="wiki-section">
            <h3 class="wiki-section-title">Overview</h3>
            <p class="wiki-text">
              Combat is resolved through <span class="kw">contested rolls</span>. When steel meets
              steel, both attacker and defender roll the dice, and their aptitudes tip the balance.
              Higher aptitudes mean more consistent results.
            </p>
            <p class="wiki-text">
              Combat begins with an <span class="kw">initiative</span> roll that locks in the turn
              order for the entire fight. Each round, combatants take turns attacking, defending,
              or using special maneuvers. Combat continues until one side falls, yields, or retreats.
            </p>
            <p class="wiki-text">
              Your choice of weapon, armor, and aptitude investment shapes your fighting identity.
              There is no single "best" build &mdash; every advantage comes with a trade-off.
            </p>
          </section>

          <div class="wiki-divider" />

          <!-- Attacking -->
          <section id="wiki-attack" class="wiki-section">
            <h3 class="wiki-section-title">Attacking</h3>
            <p class="wiki-text">
              Your attack roll combines raw fortune with martial talent. <span class="kw">Prowess</span>
              represents your natural combat ability &mdash; every point matters.
            </p>
            <div class="wiki-formula">
              Attack = d100 + (Prowess &times; 5)
            </div>
            <p class="wiki-text">
              A knight with Prowess 9 adds +45 to every attack roll. A less seasoned
              fighter with Prowess 5 adds only +25. That gap is significant &mdash;
              the veteran warrior will consistently land hits that the novice cannot.
            </p>
            <p class="wiki-text">
              Two-handed weapons gain an <span class="kw">Overwhelm</span> bonus when fighting
              shielded opponents: +10 to the attack roll, and the shield's blocking power is halved.
            </p>
          </section>

          <div class="wiki-divider" />

          <!-- Defending -->
          <section id="wiki-defense" class="wiki-section">
            <h3 class="wiki-section-title">Defending</h3>
            <p class="wiki-text">
              Your defense depends on what you wear. The aptitude used to defend is determined by
              your armor class:
            </p>
            <ul class="wiki-list">
              <li><span class="kw">Heavy Armor</span> &rarr; <span class="kw">Fortitude</span> &mdash; stand firm, absorb impacts through sheer endurance</li>
              <li><span class="kw">Medium Armor</span> &rarr; best of <span class="kw">Fortitude</span> or <span class="kw">Cunning</span> &mdash; a flexible blend of toughness and agility</li>
              <li><span class="kw">Light Armor</span> &rarr; <span class="kw">Cunning</span> &mdash; read your opponent, evade, and exploit openings</li>
            </ul>
            <p class="wiki-text">
              <span class="kw">Shields</span> add a block bonus on top of your defense roll. Heavier
              shields offer more protection, but come with encumbrance that slows your initiative.
            </p>
            <div class="wiki-tip">
              <div class="wiki-tip-label">Strategy</div>
              <p class="wiki-tip-text">
                Your armor choice shapes your entire build. A plate-clad knight invests in Fortitude
                to stand immovable, while a leather-clad duelist invests in Cunning to never be
                where the blade falls.
              </p>
            </div>
          </section>

          <div class="wiki-divider" />

          <!-- Weapons -->
          <section id="wiki-weapons" class="wiki-section">
            <h3 class="wiki-section-title">Weapons</h3>
            <p class="wiki-text">
              Weapons are divided into four families, each with a distinct role in combat.
            </p>

            <h4 class="wiki-subtitle">Blades</h4>
            <p class="wiki-text">
              Longswords, bastard swords, greatswords, and daggers. Bladed weapons deal
              <span class="kw">slashing</span> damage that is devastating against lightly armored
              targets &mdash; cutting through leather and cloth with ease. On a critical hit,
              blades inflict <span class="status-bleed">Bleeding</span>, dealing sustained damage
              over time.
            </p>

            <h4 class="wiki-subtitle">Blunt</h4>
            <p class="wiki-text">
              Maces, warhammers, and greataxes. Blunt weapons excel against
              <span class="kw">heavy armor</span>, ignoring a portion of plate protection through
              concussive force. They deal less against light and medium armor. On a critical hit,
              blunt weapons <span class="status-stun">Stun</span> the target, causing them to lose
              their next action.
            </p>

            <h4 class="wiki-subtitle">Polearms</h4>
            <p class="wiki-text">
              Spears, halberds, and other long-reaching weapons. Polearms offer excellent
              penetration and are versatile against all armor types. On a critical hit, they deliver a
              <span class="status-pierce">Piercing</span> strike that punches through armor gaps for
              bonus damage.
            </p>

            <h4 class="wiki-subtitle">Archery</h4>
            <p class="wiki-text">
              Bows and crossbows for ranged engagements. Archery allows striking from afar but offers
              no shield and limited melee options.
            </p>

            <h4 class="wiki-subtitle">Material Quality</h4>
            <p class="wiki-text">
              Weapons come in five material tiers, each progressively better. Higher-tier weapons
              hit harder, penetrate deeper, and degrade slower.
            </p>
            <ul class="wiki-list">
              <li><span class="tier-rusty">Rusty</span> &mdash; Corroded and unreliable</li>
              <li><span class="tier-iron">Iron</span> &mdash; Common, serviceable</li>
              <li><span class="tier-steel">Steel</span> &mdash; Solid, well-forged</li>
              <li><span class="tier-cf">Castle-Forged</span> &mdash; Masterwork quality</li>
              <li><span class="tier-vs">Valyrian Steel</span> &mdash; Legendary, nearly indestructible</li>
            </ul>
          </section>

          <div class="wiki-divider" />

          <!-- Armor & Shields -->
          <section id="wiki-armor" class="wiki-section">
            <h3 class="wiki-section-title">Armor &amp; Shields</h3>

            <h4 class="wiki-subtitle">Armor Classes</h4>
            <ul class="wiki-list">
              <li>
                <span class="kw">Light Armor</span> &mdash; Minimal protection, but enables
                <span class="kw">dodge rolls</span> based on Cunning. Vulnerable to slashing attacks.
                Best for agile, evasion-focused fighters.
              </li>
              <li>
                <span class="kw">Medium Armor</span> &mdash; Balanced protection with a small dodge
                chance. Uses the higher of Fortitude or Cunning for defense. A versatile choice
                for hybrid builds.
              </li>
              <li>
                <span class="kw">Heavy Armor</span> &mdash; Maximum protection, no dodge. Relies
                purely on Fortitude. Vulnerable to blunt weapons that bypass plate through
                concussive force.
              </li>
            </ul>

            <h4 class="wiki-subtitle">Shields</h4>
            <p class="wiki-text">
              Shields come in three classes: <span class="kw">Bucklers</span> (light),
              <span class="kw">Heaters</span> (medium), and <span class="kw">Tower Shields</span>
              (heavy). Each adds a block bonus to your defense roll and makes critical hits
              harder for your opponent to land.
            </p>
            <p class="wiki-text">
              However, shields have counters. Two-handed weapons gain an Overwhelm bonus that halves
              your shield's block value. Daggers wielded by lightly-armored fighters can slip past
              shields entirely.
            </p>

            <div class="wiki-tip">
              <div class="wiki-tip-label">Strategy</div>
              <p class="wiki-tip-text">
                A tower shield makes you nearly impervious to one-handed attacks, but a warrior
                with a greathammer will batter right through it. Choose your shield based on what
                you expect to face.
              </p>
            </div>
          </section>

          <div class="wiki-divider" />

          <!-- Damage & Wounds -->
          <section id="wiki-damage" class="wiki-section">
            <h3 class="wiki-section-title">Damage &amp; Wounds</h3>
            <p class="wiki-text">
              When a hit lands, your weapon's <span class="kw">penetration</span> is compared
              against the target's armor <span class="kw">mitigation</span>. The difference
              determines how much of your damage gets through.
            </p>
            <ul class="wiki-list">
              <li><span class="dmg-deflect">Deflected</span> &mdash; Barely scratched (very low damage)</li>
              <li><span class="dmg-glance">Glancing</span> &mdash; A shallow cut</li>
              <li><span class="dmg-partial">Partial</span> &mdash; Some force gets through</li>
              <li><span class="dmg-reduced">Reduced</span> &mdash; Armor absorbs the worst of it</li>
              <li><span class="dmg-solid">Solid</span> &mdash; A clean strike, full damage</li>
              <li><span class="dmg-clean">Clean</span> &mdash; Armor barely helps</li>
              <li><span class="dmg-devas">Devastating</span> &mdash; Armor offers no meaningful resistance</li>
            </ul>

            <h4 class="wiki-subtitle">Critical Hits</h4>
            <p class="wiki-text">
              When your attack roll is exceptionally high, you land a <span class="kw">critical
              hit</span> &mdash; dealing 25% bonus damage and triggering your weapon's special
              effect (bleeding, stun, sunder, or piercing). Higher Prowess makes crits more likely.
              Shields make crits harder to land against the bearer.
            </p>

            <h4 class="wiki-subtitle">Wound Penalties</h4>
            <p class="wiki-text">
              As a fighter takes damage, their effectiveness decreases. Below 75% health,
              attack and defense rolls begin to suffer penalties that grow more severe as health
              drops. A fighter at death's door is far less dangerous than one fresh to the field.
            </p>
          </section>

          <div class="wiki-divider" />

          <!-- Status Effects -->
          <section id="wiki-status" class="wiki-section">
            <h3 class="wiki-section-title">Status Effects</h3>
            <p class="wiki-text">
              Critical hits and certain maneuvers inflict status effects that alter the course
              of battle. Effects stack in severity &mdash; multiple bleeds or sunders compound
              rapidly.
            </p>
            <ul class="wiki-list">
              <li>
                <span class="status-bleed">Bleeding</span> &mdash; Open wounds that deal damage
                each round. Stacks up to 3 times. Caused by blade criticals.
              </li>
              <li>
                <span class="status-stun">Stunned</span> &mdash; Dazed by a crushing blow, the
                fighter loses their next action. Caused by blunt weapon criticals.
              </li>
              <li>
                <span class="status-sunder">Sundered</span> &mdash; Armor is damaged and provides
                less protection. Stacks up to 3 times. Caused by axe criticals.
              </li>
              <li>
                <span class="status-pierce">Piercing</span> &mdash; A precise thrust finds the gaps
                in armor, granting significant bonus penetration on the critical strike. Caused by
                polearm criticals.
              </li>
            </ul>

            <div class="wiki-tip">
              <div class="wiki-tip-label">Strategy</div>
              <p class="wiki-tip-text">
                Bleeding accumulates &mdash; three stacks deal 15 damage per round, which can
                decide a prolonged fight. Stun is powerful but brief. Sunder weakens armor
                permanently for the remainder of the engagement. Choose your weapon based on
                the effect you want.
              </p>
            </div>
          </section>

          <div class="wiki-divider" />

          <!-- Special Maneuvers -->
          <section id="wiki-special" class="wiki-section">
            <h3 class="wiki-section-title">Special Maneuvers</h3>

            <h4 class="wiki-subtitle">Dodge &amp; Riposte</h4>
            <p class="wiki-text">
              Fighters without shields in <span class="kw">light armor</span> have a chance to
              dodge attacks entirely, based on their Cunning. <span class="kw">Medium armor</span>
              offers a smaller dodge chance. On a successful dodge, the defender gets a free
              <span class="kw">riposte</span> &mdash; a swift counter-strike that lands
              automatically.
            </p>

            <h4 class="wiki-subtitle">Counter-Attacks</h4>
            <p class="wiki-text">
              When you successfully block an attack, there is a chance for a
              <span class="kw">defensive critical</span> &mdash; a devastating counter-blow
              that lands automatically and bypasses the attacker's armor entirely. Higher Prowess
              increases this chance.
            </p>

            <h4 class="wiki-subtitle">Two-Handed Overwhelm</h4>
            <p class="wiki-text">
              Two-handed weapons gain a significant attack bonus against shielded opponents and
              halve their shield's blocking power. This makes greatswords, greathammers, and
              polearms the natural counter to heavily shielded builds.
            </p>

            <h4 class="wiki-subtitle">Dagger Mastery</h4>
            <p class="wiki-text">
              Daggers are unique &mdash; fast and precise. Lightly-armored dagger fighters can
              slip past shields entirely, and on a critical hit, they gain a free bonus strike.
              Daggers also have a chance to find gaps in armor on high attack rolls. However,
              these bonuses only apply when wearing light armor &mdash; a knight in plate gains
              none of these tricks.
            </p>
          </section>

          <div class="wiki-divider" />

          <!-- Initiative & Turns -->
          <section id="wiki-initiative" class="wiki-section">
            <h3 class="wiki-section-title">Initiative &amp; Turns</h3>
            <p class="wiki-text">
              At the start of combat, all combatants roll for <span class="kw">initiative</span>
              to determine turn order. This order is locked in for the entire fight &mdash;
              <span class="kw">Cunning</span> is the primary driver, with
              <span class="kw">Prowess</span> contributing as well.
            </p>
            <div class="wiki-formula">
              Initiative = d100 + (Cunning &times; 3) + (Prowess &times; 2) &minus; Encumbrance
            </div>
            <p class="wiki-text">
              <span class="kw">Encumbrance</span> from heavy armor and weapons slows your
              initiative but does not reduce your defense. A lightly-equipped fighter will
              consistently act before a plate-clad knight &mdash; speed versus durability.
            </p>
            <p class="wiki-text">
              In multiplayer combat, all combatants roll initiative once and act each round in
              order from highest to lowest. The combat order does not change between rounds.
            </p>
          </section>


        </div>
      </div>

      <!-- Resize handle (bottom-right corner) -->
      <div class="wiki-resize-handle" @mousedown="onResizeStart">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <circle cx="10" cy="10" r="1.2" />
          <circle cx="6" cy="10" r="1.2" />
          <circle cx="10" cy="6" r="1.2" />
          <circle cx="2" cy="10" r="1.2" />
          <circle cx="6" cy="6" r="1.2" />
          <circle cx="10" cy="2" r="1.2" />
        </svg>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wiki-panel-wrapper {
  position: fixed;
  z-index: 100;
}

.wiki-panel {
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  position: relative;
  resize: none;
}

/* Header */
.wiki-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
  cursor: grab;
  user-select: none;
}

.wiki-header:active {
  cursor: grabbing;
}

.wiki-title {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-gold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.wiki-close {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.wiki-close:hover {
  color: var(--color-text);
  background: var(--color-surface-hover);
}

/* Body layout */
.wiki-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

/* Table of Contents sidebar */
.wiki-toc {
  width: 120px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: var(--space-sm) 0;
  border-right: 1px solid var(--color-border-dim);
  overflow-y: auto;
}

/* Category header */
.wiki-toc-category {
  margin-bottom: 2px;
}

.wiki-toc-cat-header {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 6px var(--space-sm);
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--font-display);
  font-size: 10px;
  color: var(--color-text-dim);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-align: left;
  transition: all var(--transition-fast);
}

.wiki-toc-cat-header:hover {
  color: var(--color-gold);
  background: var(--color-surface-hover);
}

.wiki-toc-cat-header--active {
  color: var(--color-gold);
}

.wiki-toc-chevron {
  font-size: 8px;
  transition: transform var(--transition-fast);
  display: inline-block;
}

.wiki-toc-chevron--open {
  transform: rotate(90deg);
}

.wiki-toc-sections {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.wiki-toc-item {
  padding: 4px var(--space-sm) 4px 20px;
  background: none;
  border: none;
  border-left: 2px solid transparent;
  cursor: pointer;
  font-family: var(--font-display);
  font-size: 10px;
  color: var(--color-text-muted);
  letter-spacing: 0.06em;
  text-align: left;
  transition: all var(--transition-fast);
}

.wiki-toc-item:hover {
  color: var(--color-text-dim);
  background: var(--color-surface-hover);
}

.wiki-toc-item--active {
  color: var(--color-gold);
  border-left-color: var(--color-gold);
  background: rgba(201, 168, 76, 0.06);
}

/* Content area */
.wiki-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-md);
  min-height: 0;
}

.wiki-content::-webkit-scrollbar { width: 4px; }
.wiki-content::-webkit-scrollbar-track { background: transparent; }
.wiki-content::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 2px;
}

/* Sections */
.wiki-section {
  margin-bottom: var(--space-lg);
}

.wiki-section:last-child {
  margin-bottom: 0;
}

.wiki-section-title {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-gold);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin: 0 0 var(--space-sm) 0;
  padding-bottom: var(--space-xs);
  border-bottom: 1px solid var(--color-border-dim);
}

.wiki-subtitle {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-gold-dark);
  letter-spacing: 0.08em;
  margin: var(--space-sm) 0 var(--space-xs) 0;
}

.wiki-text {
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  line-height: 1.6;
  margin: 0 0 var(--space-sm) 0;
}

.wiki-text:last-child {
  margin-bottom: 0;
}

/* Formula callout */
.wiki-formula {
  display: block;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-gold-light);
  background: rgba(201, 168, 76, 0.08);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  padding: 6px 10px;
  margin: var(--space-xs) 0 var(--space-sm) 0;
  text-align: center;
}

/* Lists */
.wiki-list {
  list-style: none;
  padding: 0;
  margin: var(--space-xs) 0 var(--space-sm) 0;
}

.wiki-list li {
  position: relative;
  padding-left: 14px;
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  line-height: 1.5;
  margin-bottom: 4px;
}

.wiki-list li::before {
  content: '\2756';
  position: absolute;
  left: 0;
  color: var(--color-gold-dim);
  font-size: 8px;
  top: 3px;
}

/* Keywords */
.kw {
  color: var(--color-gold);
  font-weight: 600;
}

/* Status effect colors */
.status-bleed { color: #c42b2b; font-weight: 600; }
.status-stun { color: #d4a932; font-weight: 600; }
.status-sunder { color: #3a7bd5; font-weight: 600; }
.status-pierce { color: #9b32d4; font-weight: 600; }

/* Damage labels */
.dmg-deflect { color: #6b6051; font-weight: 600; }
.dmg-glance { color: #7a7e8b; font-weight: 600; }
.dmg-partial { color: #a89b85; font-weight: 600; }
.dmg-reduced { color: #e8dcc8; font-weight: 600; }
.dmg-solid { color: #c9a84c; font-weight: 600; }
.dmg-clean { color: #e0c878; font-weight: 600; }
.dmg-devas { color: #c42b2b; font-weight: 600; }

/* Tier colors */
.tier-rusty { color: #6b6051; }
.tier-iron { color: #7a7e8b; }
.tier-steel { color: #a89b85; }
.tier-cf { color: #c9a84c; }
.tier-vs { color: #e0c878; text-shadow: 0 0 6px rgba(224, 200, 120, 0.3); }

/* Ornamental divider */
.wiki-divider {
  width: 60%;
  height: 1px;
  margin: var(--space-md) auto;
  background: linear-gradient(90deg, transparent, var(--color-gold-dim), transparent);
}

/* Tip callout */
.wiki-tip {
  padding: var(--space-sm) var(--space-md);
  background: rgba(201, 168, 76, 0.04);
  border-left: 2px solid var(--color-gold-dim);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  margin: var(--space-sm) 0;
}

.wiki-tip-label {
  font-family: var(--font-display);
  font-size: 9px;
  color: var(--color-gold);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 2px;
}

.wiki-tip-text {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  line-height: 1.5;
  margin: 0;
}

/* Resize handle */
.wiki-resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: nwse-resize;
  color: var(--color-gold-dark);
  opacity: 0.5;
  transition: opacity var(--transition-fast);
  z-index: 10;
}

.wiki-resize-handle:hover {
  opacity: 1;
  color: var(--color-gold);
}
</style>
