<script setup lang="ts">
import { useHudStore } from '@/stores/hud'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/stores/admin'
import { useSocialStore } from '@/stores/social'
import { useWesterosClock } from '@/composables/useWesterosClock'
import characterIcon from '@res/images/icons/character.png'
import combatIcon from '@res/images/icons/combat.png'
import inventoryIcon from '@res/images/icons/inventory.png'
import holdingsIcon from '@res/images/icons/holding.png'
import worldIcon from '@res/images/icons/world.png'
import wikiIcon from '@res/images/icons/wiki.png'
import settingsIcon from '@res/images/icons/settings.png'

interface SystemTab {
  id: string
  label: string
  icon: string
  tooltip: string
}

const hudStore = useHudStore()
const authStore = useAuthStore()
const adminStore = useAdminStore()
const socialStore = useSocialStore()
const { time } = useWesterosClock()

function toggleAdminPanel() {
  if (adminStore.isOpen) {
    adminStore.closePanel()
  } else {
    adminStore.openPanel()
  }
}

function toggleSocialPanel() {
  if (socialStore.isOpen) {
    socialStore.closePanel()
  } else {
    socialStore.openPanel()
  }
}

const leftSystems: SystemTab[] = [
  { id: 'character', label: 'Character', icon: characterIcon, tooltip: 'Character & Stats' },
  { id: 'combat', label: 'Combat', icon: combatIcon, tooltip: 'Combat' },
  { id: 'inventory', label: 'Inventory', icon: inventoryIcon, tooltip: 'Inventory' },
  { id: 'retainers', label: 'Retainers', icon: combatIcon, tooltip: 'Retainer Management' },
]

const rightSystems: SystemTab[] = [
  { id: 'holdings', label: 'Holdings', icon: holdingsIcon, tooltip: 'Holdings & Land' },
  { id: 'social', label: 'Social', icon: worldIcon, tooltip: 'Social Viewer' },
  { id: 'wiki', label: 'Codex', icon: wikiIcon, tooltip: 'Codex' },
  { id: 'settings', label: 'Settings', icon: settingsIcon, tooltip: 'Settings' },
]
</script>

<template>
  <div class="topbar">
    <!-- Left system icons -->
    <div class="topbar-systems left-systems">
      <button
        v-for="sys in leftSystems"
        :key="sys.id"
        class="system-btn"
        :class="{ active: hudStore.isPanelOpen(sys.id) }"
        :title="sys.tooltip"
        @click="hudStore.toggleSystemPanel(sys.id)"
      >
        <div class="system-icon">
          <img :src="sys.icon" :alt="sys.label" class="system-icon-img" />
        </div>
        <span class="system-label">{{ sys.label }}</span>
      </button>
    </div>

    <!-- Center title -->
    <div class="topbar-title-group">
      <div class="title-ornament-line left" />
      <div class="topbar-title">
        <div class="title-dragon left">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" opacity="0.7">
            <path d="M9 2C6 2 4 4.5 4 7c0 1.5.5 2.8 1.3 3.8L2 14l3 1-1 3 3-1 1 3 3.7-3.3c1 .8 2.3 1.3 3.8 1.3 2.5 0 5-2 5-5 0-1-.3-2-.8-2.8L22 6l-4.2 1.8C16.5 5.5 14.5 4 12 4c-1 0-2 .3-2.8.8L9 2z"/>
          </svg>
        </div>
        <h1 class="title-text">Dragon's Dominion</h1>
        <div class="title-dragon right">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" opacity="0.7" style="transform: scaleX(-1)">
            <path d="M9 2C6 2 4 4.5 4 7c0 1.5.5 2.8 1.3 3.8L2 14l3 1-1 3 3-1 1 3 3.7-3.3c1 .8 2.3 1.3 3.8 1.3 2.5 0 5-2 5-5 0-1-.3-2-.8-2.8L22 6l-4.2 1.8C16.5 5.5 14.5 4 12 4c-1 0-2 .3-2.8.8L9 2z"/>
          </svg>
        </div>
      </div>
      <div class="title-ornament-line right" />
    </div>

    <!-- Right system icons -->
    <div class="topbar-systems right-systems">
      <button
        v-for="sys in rightSystems"
        :key="sys.id"
        class="system-btn"
        :class="{ active: sys.id === 'social' ? socialStore.isOpen : hudStore.isPanelOpen(sys.id) }"
        :title="sys.tooltip"
        @click="sys.id === 'social' ? toggleSocialPanel() : hudStore.toggleSystemPanel(sys.id)"
      >
        <div class="system-icon">
          <img :src="sys.icon" :alt="sys.label" class="system-icon-img" />
        </div>
        <span class="system-label">{{ sys.label }}</span>
      </button>

      <!-- Staff panel button (only visible for staff) -->
      <button
        v-if="authStore.isStaff"
        class="system-btn staff-btn"
        :class="{ active: adminStore.isOpen }"
        title="Staff Panel"
        @click="toggleAdminPanel"
      >
        <div class="system-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <span class="system-label">Staff</span>
      </button>
    </div>

    <!-- Westeros Clock (top-right) -->
    <div class="topbar-clock">
      <span class="clock-hour-name">{{ time.hourName }}</span>
      <span class="clock-date">{{ time.dateLine }}</span>
      <span class="clock-slt">{{ time.sltTime }} SLT</span>
    </div>
  </div>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0 var(--space-sm);
  height: 76px;
  background: #0a0a0f;
  border-bottom: 1px solid var(--color-border-dim);
  position: relative;
  pointer-events: auto;
}

/* Gold accent line at very top */
.topbar::before {
  content: '';
  position: absolute;
  top: 0;
  left: 10%;
  right: 10%;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--color-gold-dim) 20%,
    var(--color-gold) 50%,
    var(--color-gold-dim) 80%,
    transparent 100%
  );
}

/* System icon groups */
.topbar-systems {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 1;
}

.left-systems {
  justify-content: flex-end;
  padding-right: var(--space-sm);
}

.right-systems {
  justify-content: flex-start;
  padding-left: var(--space-sm);
}

/* Individual system button */
.system-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  position: relative;
  min-width: 64px;
}

.system-btn::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 25%;
  right: 25%;
  height: 1px;
  background: transparent;
  transition: all var(--transition-fast);
}

.system-btn:hover {
  background: rgba(201, 168, 76, 0.08);
}

.system-btn:hover::after {
  background: var(--color-gold-dim);
}

.system-btn:hover .system-icon {
  color: var(--color-gold);
}

.system-btn:hover .system-label {
  color: var(--color-text);
}

.system-btn.active {
  background: rgba(201, 168, 76, 0.12);
}

.system-btn.active::after {
  background: var(--color-gold);
  box-shadow: 0 0 6px var(--color-gold-dim);
}

.system-btn.active .system-icon {
  color: var(--color-gold);
  filter: drop-shadow(0 0 3px rgba(201, 168, 76, 0.4));
}

.system-btn.active .system-label {
  color: var(--color-gold);
}

.system-icon {
  color: var(--color-text-dim);
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
}

.system-icon-img {
  width: 26px;
  height: 26px;
  object-fit: contain;
  filter: brightness(0.6);
  transition: filter var(--transition-fast);
}

.system-btn:hover .system-icon-img {
  filter: brightness(0.8) sepia(1) hue-rotate(5deg) saturate(3);
}

.system-btn.active .system-icon-img {
  filter: brightness(0.9) sepia(1) hue-rotate(5deg) saturate(4) drop-shadow(0 0 3px rgba(201, 168, 76, 0.4));
}

.system-label {
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  transition: color var(--transition-fast);
  line-height: 1;
}

/* Staff button uses inline SVG instead of img */
.staff-btn .system-icon svg {
  color: var(--color-text-dim);
  transition: all var(--transition-fast);
}

.staff-btn:hover .system-icon svg {
  color: var(--color-gold);
}

.staff-btn.active .system-icon svg {
  color: var(--color-gold);
  filter: drop-shadow(0 0 3px rgba(201, 168, 76, 0.4));
}

/* Center title group */
.topbar-title-group {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-shrink: 0;
  padding: 0 var(--space-md);
}

.title-ornament-line {
  width: 60px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--color-gold-dim));
  flex-shrink: 0;
}

.title-ornament-line.right {
  background: linear-gradient(90deg, var(--color-gold-dim), transparent);
}

.topbar-title {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-shrink: 0;
}

.title-text {
  font-family: var(--font-display);
  font-size: var(--font-size-xl);
  color: var(--color-gold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  white-space: nowrap;
  text-shadow: 0 0 12px rgba(201, 168, 76, 0.3);
  font-weight: 400;
  line-height: 1;
}

.title-dragon {
  color: var(--color-gold-dark);
  display: flex;
  align-items: center;
}

/* Westeros Clock */
.topbar-clock {
  position: absolute;
  top: 8px;
  right: 16px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
  pointer-events: auto;
}

.clock-hour-name {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-gold);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  white-space: nowrap;
  text-shadow: 0 0 8px rgba(201, 168, 76, 0.3);
}

.clock-date {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-gold);
  letter-spacing: 0.08em;
  white-space: nowrap;
  opacity: 0.8;
}

.clock-slt {
  font-family: var(--font-display);
  font-size: 12px;
  color: var(--color-text);
  letter-spacing: 0.06em;
  opacity: 0.7;
}
</style>
