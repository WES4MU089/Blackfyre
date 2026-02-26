<script setup lang="ts">
defineProps<{
  text: string
}>()
</script>

<template>
  <div class="combat-callout">
    <div class="callout-bubble">
      <span class="callout-text">&ldquo;{{ text }}&rdquo;</span>
    </div>
    <div class="callout-arrow" />
  </div>
</template>

<style scoped>
.combat-callout {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  pointer-events: none;
  margin-bottom: 4px;
  animation: callout-in 0.3s ease-out, callout-out 0.5s ease-in 3.5s forwards;
}

.callout-bubble {
  background: rgba(20, 18, 15, 0.92);
  border: 1px solid var(--color-gold-dim);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  max-width: 180px;
  white-space: normal;
}

.callout-text {
  font-size: var(--font-size-xs);
  color: var(--color-text);
  font-style: italic;
  line-height: 1.3;
}

.callout-arrow {
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid var(--color-gold-dim);
  margin: 0 auto;
}

@keyframes callout-in {
  from { opacity: 0; transform: translateX(-50%) translateY(4px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}

@keyframes callout-out {
  from { opacity: 1; }
  to   { opacity: 0; }
}
</style>
