<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import type { InventoryItem, EquippedItem } from '@/stores/character'

const props = defineProps<{
  item: InventoryItem | EquippedItem
  source: 'inventory' | 'equipment'
  x: number
  y: number
}>()

const emit = defineEmits<{
  action: [action: string]
  close: []
}>()

const el = ref<HTMLElement | null>(null)
const adjustedX = ref(props.x)
const adjustedY = ref(props.y)
const confirmingDrop = ref(false)

const isInventoryItem = computed(() => props.source === 'inventory')
const invItem = computed(() => isInventoryItem.value ? props.item as InventoryItem : null)

interface MenuOption {
  key: string
  label: string
  danger?: boolean
}

const options = computed<MenuOption[]>(() => {
  const list: MenuOption[] = []

  if (isInventoryItem.value && invItem.value) {
    if (invItem.value.slot_type) {
      list.push({ key: 'equip', label: 'Equip' })
    }
    if (invItem.value.is_usable) {
      list.push({ key: 'use', label: 'Use' })
    }
  }

  if (!isInventoryItem.value) {
    list.push({ key: 'unequip', label: 'Unequip' })
  }

  list.push({ key: 'inspect', label: 'Inspect' })

  if (isInventoryItem.value && invItem.value) {
    if (invItem.value.is_tradeable) {
      list.push({ key: 'give', label: 'Give' })
    }
    list.push({ key: 'drop', label: 'Drop', danger: true })
  }

  return list
})

function handleAction(key: string): void {
  if (key === 'drop' && !confirmingDrop.value) {
    confirmingDrop.value = true
    return
  }
  emit('action', key)
}

function onClickOutside(e: MouseEvent): void {
  if (el.value && !el.value.contains(e.target as Node)) {
    emit('close')
  }
}

function positionMenu(): void {
  if (!el.value) return
  const rect = el.value.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight

  let x = props.x
  let y = props.y

  if (x + rect.width > vw) x = vw - rect.width - 4
  if (y + rect.height > vh) y = vh - rect.height - 4
  x = Math.max(4, x)
  y = Math.max(4, y)

  adjustedX.value = x
  adjustedY.value = y
}

onMounted(() => {
  requestAnimationFrame(positionMenu)
  document.addEventListener('mousedown', onClickOutside, { capture: true })
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onClickOutside, { capture: true })
})
</script>

<template>
  <Teleport to="#hud-popover-root">
    <div
      ref="el"
      class="ctx-menu"
      :style="{ left: adjustedX + 'px', top: adjustedY + 'px' }"
    >
      <button
        v-for="opt in options"
        :key="opt.key"
        class="ctx-menu__item"
        :class="{
          'ctx-menu__item--danger': opt.danger,
          'ctx-menu__item--confirm': opt.key === 'drop' && confirmingDrop,
        }"
        @click.stop="handleAction(opt.key)"
      >
        {{ opt.key === 'drop' && confirmingDrop ? 'Confirm Drop?' : opt.label }}
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.ctx-menu {
  position: fixed;
  z-index: 10000;
  min-width: 120px;
  pointer-events: auto;
  padding: 4px 0;
  background: rgba(18, 14, 10, 0.97);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7);
}

.ctx-menu__item {
  display: block;
  width: 100%;
  padding: 6px 14px;
  background: none;
  border: none;
  text-align: left;
  font-family: var(--font-body);
  font-size: 11px;
  color: var(--color-text);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.ctx-menu__item:hover {
  background: rgba(201, 168, 76, 0.12);
  color: var(--color-gold-light);
}

.ctx-menu__item--danger {
  color: #b04040;
}

.ctx-menu__item--danger:hover {
  background: rgba(139, 26, 26, 0.2);
  color: #d44;
}

.ctx-menu__item--confirm {
  color: #d44;
  font-weight: 600;
}

.ctx-menu__item--confirm:hover {
  background: rgba(200, 40, 40, 0.25);
}
</style>
