<script setup lang="ts">
import { computed } from 'vue'
import { useCharacterStore } from '@/stores/character'

const store = useCharacterStore()

function formatMoney(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`
  return amount.toLocaleString()
}

const displayPurse = computed(() => formatMoney(store.finances.purse))
const displayVault = computed(() => formatMoney(store.finances.vault))
</script>

<template>
  <div class="money-display animate-fade-in">
    <!-- Purse (coins on person) -->
    <div class="money-row">
      <div class="money-icon purse-icon">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm.5 10.5v1h-1v-1H6v-1h2.5a.5.5 0 000-1H7a1.5 1.5 0 010-3V5.5h1v1H10v1H7.5a.5.5 0 000 1H9a1.5 1.5 0 010 3z" />
        </svg>
      </div>
      <span class="money-value">{{ displayPurse }}</span>
    </div>

    <!-- Vault (stored wealth) -->
    <div class="money-row">
      <div class="money-icon vault-icon">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1L1 5v1h14V5L8 1zM2 7v5h2V7H2zm4 0v5h4V7H6zm6 0v5h2V7h-2zM1 13v1h14v-1H1z" />
        </svg>
      </div>
      <span class="money-value">{{ displayVault }}</span>
    </div>
  </div>
</template>

<style scoped>
.money-display {
  background: linear-gradient(
    135deg,
    rgba(8, 6, 12, 0.94) 0%,
    rgba(12, 10, 18, 0.92) 100%
  );
  backdrop-filter: var(--blur-md);
  -webkit-backdrop-filter: var(--blur-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-md);
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 140px;
  box-shadow: var(--shadow-md), inset 0 1px 0 rgba(201, 168, 76, 0.06);
  position: relative;
}

.money-display::before {
  content: '';
  position: absolute;
  top: 0;
  left: 12px;
  right: 12px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--color-gold-dim), transparent);
}

.money-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.money-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  filter: drop-shadow(0 0 2px currentColor);
}

.purse-icon { color: var(--color-gold); }
.vault-icon { color: var(--color-armor); }

.money-value {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: 0.05em;
}
</style>
