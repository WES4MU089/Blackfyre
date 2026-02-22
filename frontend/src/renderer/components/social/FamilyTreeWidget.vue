<script setup lang="ts">
import { computed } from 'vue'
import type { FamilyTreeNpc, FamilyTreeEdge, FamilyTreeCharacter } from '@/stores/social'

interface Props {
  npcs: FamilyTreeNpc[]
  edges: FamilyTreeEdge[]
  characters: FamilyTreeCharacter[]
}

const props = defineProps<Props>()

// ===== Node abstraction =====
interface TreeNode {
  key: string          // "c:5" or "n:3"
  name: string
  title: string | null
  isCharacter: boolean
  isDeceased: boolean
}

// ===== Build tree layout =====
const treeLayout = computed(() => {
  // Build node map
  const nodeMap = new Map<string, TreeNode>()

  for (const c of props.characters) {
    nodeMap.set(`c:${c.id}`, {
      key: `c:${c.id}`,
      name: c.name,
      title: c.title,
      isCharacter: true,
      isDeceased: !c.is_active,
    })
  }
  for (const n of props.npcs) {
    nodeMap.set(`n:${n.id}`, {
      key: `n:${n.id}`,
      name: n.name,
      title: n.title,
      isCharacter: false,
      isDeceased: n.is_deceased,
    })
  }

  if (nodeMap.size === 0) return { generations: [], spouseLinks: [] }

  // Build parent→child adjacency
  const childrenOf = new Map<string, string[]>() // parent key → child keys
  const parentOf = new Map<string, string[]>()   // child key → parent keys
  const spouseLinks: Array<{ a: string; b: string }> = []

  for (const edge of props.edges) {
    const fromKey = edge.from_character_id ? `c:${edge.from_character_id}` : edge.from_npc_id ? `n:${edge.from_npc_id}` : null
    const toKey = edge.to_character_id ? `c:${edge.to_character_id}` : edge.to_npc_id ? `n:${edge.to_npc_id}` : null
    if (!fromKey || !toKey) continue

    if (edge.relationship === 'parent') {
      // from is parent, to is child
      if (!childrenOf.has(fromKey)) childrenOf.set(fromKey, [])
      childrenOf.get(fromKey)!.push(toKey)
      if (!parentOf.has(toKey)) parentOf.set(toKey, [])
      parentOf.get(toKey)!.push(fromKey)
    } else if (edge.relationship === 'spouse') {
      spouseLinks.push({ a: fromKey, b: toKey })
    }
    // siblings are implicit (same parents)
  }

  // Find root nodes (no incoming parent edges)
  const allKeys = [...nodeMap.keys()]
  const roots = allKeys.filter(k => !parentOf.has(k) || parentOf.get(k)!.length === 0)

  // If no clear roots, treat all nodes as generation 0 (flat fallback)
  if (roots.length === 0) {
    return {
      generations: [allKeys.map(k => nodeMap.get(k)!)],
      spouseLinks: [],
    }
  }

  // BFS to assign generation levels
  const genLevel = new Map<string, number>()
  const queue: string[] = [...roots]
  for (const r of roots) genLevel.set(r, 0)

  while (queue.length > 0) {
    const current = queue.shift()!
    const level = genLevel.get(current)!
    const children = childrenOf.get(current) ?? []
    for (const child of children) {
      const existing = genLevel.get(child)
      if (existing === undefined || existing < level + 1) {
        genLevel.set(child, level + 1)
        queue.push(child)
      }
    }
  }

  // Also assign generation to spouse of someone already placed
  for (const link of spouseLinks) {
    if (genLevel.has(link.a) && !genLevel.has(link.b)) {
      genLevel.set(link.b, genLevel.get(link.a)!)
    } else if (genLevel.has(link.b) && !genLevel.has(link.a)) {
      genLevel.set(link.a, genLevel.get(link.b)!)
    }
  }

  // Any unplaced nodes go to generation 0
  for (const key of allKeys) {
    if (!genLevel.has(key)) genLevel.set(key, 0)
  }

  // Group by generation
  const maxGen = Math.max(...genLevel.values())
  const generations: TreeNode[][] = []
  for (let g = 0; g <= maxGen; g++) {
    const nodesInGen = allKeys
      .filter(k => genLevel.get(k) === g)
      .map(k => nodeMap.get(k)!)
      .filter(Boolean)
    if (nodesInGen.length > 0) {
      generations.push(nodesInGen)
    }
  }

  return { generations, spouseLinks }
})
</script>

<template>
  <div class="family-tree">
    <div
      v-for="(gen, gi) in treeLayout.generations"
      :key="gi"
      class="tree-generation"
    >
      <div class="tree-gen-label">Gen {{ gi }}</div>
      <div class="tree-gen-nodes">
        <div
          v-for="node in gen"
          :key="node.key"
          class="tree-node"
          :class="{
            'tree-node--character': node.isCharacter,
            'tree-node--npc': !node.isCharacter,
            'tree-node--deceased': node.isDeceased,
          }"
        >
          <span class="node-name">{{ node.name }}</span>
          <span v-if="node.title" class="node-title">{{ node.title }}</span>
          <span v-if="node.isDeceased" class="node-deceased-mark">&#x2020;</span>
        </div>
      </div>
      <!-- Connector line to next generation -->
      <div v-if="gi < treeLayout.generations.length - 1" class="tree-connector" />
    </div>
  </div>
</template>

<style scoped>
.family-tree {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  padding: var(--space-sm) 0;
}

.tree-generation {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 100%;
}

.tree-gen-label {
  font-family: var(--font-mono);
  font-size: 8px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.6;
}

.tree-gen-nodes {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-sm);
}

.tree-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-dim);
  background: var(--color-surface);
  min-width: 80px;
  text-align: center;
  position: relative;
}

.tree-node--character {
  border-color: rgba(201, 168, 76, 0.4);
}

.tree-node--npc {
  border-color: var(--color-border-dim);
  border-style: dashed;
}

.tree-node--deceased {
  opacity: 0.55;
}

.node-name {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text);
  font-weight: 600;
  line-height: 1.2;
}

.tree-node--character .node-name {
  color: var(--color-gold);
}

.node-title {
  font-family: var(--font-body);
  font-size: 10px;
  color: var(--color-text-muted);
}

.node-deceased-mark {
  position: absolute;
  top: 2px;
  right: 4px;
  font-size: 10px;
  color: var(--color-crimson-light);
}

.tree-connector {
  width: 1px;
  height: 16px;
  background: var(--color-border);
}
</style>
