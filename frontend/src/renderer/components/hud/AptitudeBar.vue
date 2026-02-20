<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  name: string
  value: number
  maxValue?: number
  xpSegments?: number
  segmentsPerLevel?: number
  compact?: boolean
  showPlus?: boolean
}>(), {
  maxValue: 10,
  xpSegments: 0,
  segmentsPerLevel: 5,
  compact: false,
  showPlus: false,
})

const emit = defineEmits<{
  allocate: []
}>()

/** For compact (skill) mode — continuous fill */
const fillPercent = computed(() => {
  return Math.min(100, (props.value / props.maxValue) * 100)
})

/** For aptitude (non-compact) mode — discrete segments */
const segments = computed(() => {
  const result = []
  for (let i = 1; i <= props.maxValue; i++) {
    result.push({ index: i, filled: i <= props.value })
  }
  return result
})
</script>

<template>
  <!-- Aptitude mode: segmented blocks -->
  <div v-if="!compact" class="aptitude-bar">
    <span class="aptitude-name">{{ name }}</span>
    <div class="aptitude-segments">
      <div
        v-for="seg in segments"
        :key="seg.index"
        class="aptitude-seg"
        :class="{ 'aptitude-seg--filled': seg.filled }"
      />
    </div>
    <span class="aptitude-value">{{ value }}</span>
    <button
      v-if="showPlus"
      class="aptitude-plus"
      title="Allocate point"
      @click.stop="emit('allocate')"
    >+</button>
  </div>

  <!-- Skill mode: compact level bar + XP segments -->
  <div v-else class="skill-bar">
    <span class="skill-name">{{ name }}</span>
    <div class="skill-bar-tracks">
      <div class="skill-track">
        <div class="skill-fill" :style="{ width: `${fillPercent}%` }" />
        <!-- Level segment markers -->
        <div class="skill-segments">
          <div v-for="i in (maxValue - 1)" :key="i" class="skill-segment" :style="{ left: `${(i / maxValue) * 100}%` }" />
        </div>
      </div>
      <!-- XP segment sub-bar (progress toward next skill level) -->
      <div class="skill-xp-segments">
        <div
          v-for="i in segmentsPerLevel"
          :key="i"
          class="skill-xp-seg"
          :class="{ 'skill-xp-seg--filled': i <= xpSegments }"
        />
      </div>
    </div>
    <span class="skill-value">{{ value }}</span>
    <button
      v-if="showPlus"
      class="skill-plus"
      title="Allocate point"
      @click.stop="emit('allocate')"
    >+</button>
  </div>
</template>

<style scoped>
/* =========================================================
   APTITUDE MODE — Large segmented blocks
   ========================================================= */
.aptitude-bar {
  display: flex;
  align-items: center;
  gap: 6px;
}

.aptitude-name {
  font-family: var(--font-display);
  font-size: 10px;
  color: var(--color-text-dim);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  width: 82px;
  flex-shrink: 0;
  text-align: right;
}

.aptitude-segments {
  flex: 1;
  display: flex;
  gap: 2px;
}

.aptitude-seg {
  flex: 1;
  height: 14px;
  background: rgba(201, 168, 76, 0.06);
  border: 1px solid rgba(201, 168, 76, 0.12);
  border-radius: 1px;
  transition: all var(--transition-normal);
}

.aptitude-seg--filled {
  background: linear-gradient(180deg, var(--color-gold), var(--color-gold-dark));
  border-color: rgba(201, 168, 76, 0.5);
  box-shadow: 0 0 3px rgba(201, 168, 76, 0.15);
}

.aptitude-value {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: var(--color-gold);
  width: 18px;
  text-align: center;
  flex-shrink: 0;
  font-weight: 700;
}

/* Plus allocation button */
.aptitude-plus {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0;
  border: 1px solid var(--color-gold-dark);
  border-radius: 2px;
  background: rgba(201, 168, 76, 0.12);
  color: var(--color-gold);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: bold;
  line-height: 1;
  cursor: pointer;
  transition: all var(--transition-fast);
  animation: plus-glow 2s ease-in-out infinite;
}

.aptitude-plus:hover {
  background: rgba(201, 168, 76, 0.3);
  border-color: var(--color-gold);
  transform: scale(1.15);
}

/* =========================================================
   SKILL MODE — Compact continuous bar
   ========================================================= */
.skill-bar {
  display: flex;
  align-items: center;
  gap: 4px;
}

.skill-name {
  font-family: var(--font-body);
  font-size: 9px;
  color: var(--color-text-muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  width: 72px;
  flex-shrink: 0;
  text-align: right;
}

.skill-bar-tracks {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.skill-track {
  width: 100%;
  height: 5px;
  background: rgba(201, 168, 76, 0.05);
  border: 1px solid var(--color-border-dim);
  border-radius: 1px;
  position: relative;
  overflow: hidden;
}

.skill-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-gold-dark), var(--color-gold-dim));
  border-radius: 1px;
  transition: width var(--transition-normal);
}

.skill-segments {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.skill-segment {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba(0, 0, 0, 0.4);
}

/* Skill XP segment sub-bar (progress toward next skill level) */
.skill-xp-segments {
  display: flex;
  gap: 1px;
  width: 100%;
}

.skill-xp-seg {
  flex: 1;
  height: 3px;
  background: rgba(147, 112, 219, 0.06);
  border: 1px solid rgba(147, 112, 219, 0.1);
  border-radius: 0.5px;
  transition: all 200ms ease;
}

.skill-xp-seg--filled {
  background: linear-gradient(180deg, #a855f7, #7c3aed);
  border-color: rgba(168, 85, 247, 0.35);
}

.skill-value {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--color-text-muted);
  width: 16px;
  text-align: center;
  flex-shrink: 0;
}

/* Skill plus button */
.skill-plus {
  width: 13px;
  height: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0;
  border: 1px solid var(--color-gold-dark);
  border-radius: 2px;
  background: rgba(201, 168, 76, 0.12);
  color: var(--color-gold);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: bold;
  line-height: 1;
  cursor: pointer;
  transition: all var(--transition-fast);
  animation: plus-glow 2s ease-in-out infinite;
}

.skill-plus:hover {
  background: rgba(201, 168, 76, 0.3);
  border-color: var(--color-gold);
  transform: scale(1.15);
}

@keyframes plus-glow {
  0%, 100% { box-shadow: 0 0 2px rgba(201, 168, 76, 0.2); }
  50% { box-shadow: 0 0 6px rgba(201, 168, 76, 0.5); }
}
</style>
