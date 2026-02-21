/**
 * NPC Dialog System — Shared types.
 *
 * Generic dialog tree model used by all NPC interactions.
 * Trees are static data; the engine resolves nodes at runtime
 * with dynamic context (player gold, health, etc.).
 */

// ── Tree definition (static data) ─────────────────────────────

export interface DialogOption {
  id: string;
  text: string;                  // What the player says
  nextNodeId?: string;           // Navigate to another node
  action?: string;               // Server-side action key (e.g. 'heal')
  /** Conditions that must ALL pass for the action to execute. */
  conditions?: string[];         // e.g. ['health_not_full', 'has_gold:50']
  conditionFailNodeId?: string;  // Node shown when a condition fails
}

export interface DialogNode {
  id: string;
  npcText: string;               // Supports {cash}, {health}, {maxHealth} placeholders
  options: DialogOption[];
  closeAfter?: boolean;          // Auto-close dialog after displaying this node
}

export interface DialogTree {
  npcType: string;               // 'healer', 'blacksmith', etc.
  npcName: string;               // Display name
  npcPortrait?: string;          // Portrait URL (future use)
  greeting: string;              // ID of the first node
  nodes: Record<string, DialogNode>;
  shopItems?: string[];          // item_keys this NPC sells (for open_shop action)
}

// ── Runtime context ────────────────────────────────────────────

export interface DialogContext {
  characterId: number;
  currentHealth: number;
  maxHealth: number;
  cash: number;
  inventorySlotsFree: number;
  level: number;
  xpSegments: number;
  woundSeverity: string;
}

// ── Active session (in-memory) ─────────────────────────────────

export interface DialogSession {
  characterId: number;
  npcType: string;
  tree: DialogTree;
  currentNodeId: string;
  context: DialogContext;
  /** Stored when an action returns a dynamicNode so option lookup works. */
  currentDynamicNode?: DialogNode;
}

// ── Payload sent to the frontend ───────────────────────────────

export interface DialogPayload {
  npcType: string;
  npcName: string;
  npcPortrait: string | null;
  nodeId: string;
  npcText: string;               // Placeholders resolved
  options: { id: string; text: string }[];
  closeAfter: boolean;
}
