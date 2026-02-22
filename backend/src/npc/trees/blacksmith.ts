import type { DialogTree } from '../types.js';

export const blacksmithTree: DialogTree = {
  npcType: 'blacksmith',
  npcName: 'Harwin the Smith',
  greeting: 'greeting',
  shopItems: [
    // Daggers
    'rusty_dagger', 'iron_dagger', 'steel_dagger', 'cf_dagger',
    // Bastard Swords (1H)
    'iron_bastard_sword', 'steel_bastard_sword', 'cf_bastard_sword',
    // Greatswords (2H)
    'iron_sword', 'steel_sword', 'cf_longsword',
    'iron_greatsword', 'steel_greatsword', 'cf_greatsword',
    // Battle Axes (1H)
    'iron_battleaxe', 'steel_battleaxe', 'cf_battleaxe',
    // Greataxes (2H)
    'iron_greataxe', 'steel_greataxe', 'cf_greataxe',
    // Maces (1H)
    'iron_mace', 'steel_mace', 'cf_mace',
    // Warhammers (1H)
    'iron_warhammer', 'steel_warhammer', 'cf_warhammer',
    // Great Warhammers (2H)
    'iron_great_warhammer', 'steel_great_warhammer', 'cf_great_warhammer',
    // Spears (1H)
    'iron_spear', 'steel_spear', 'cf_spear',
    // Polearms (2H)
    'iron_halberd', 'steel_halberd', 'cf_halberd',
    // Ranged
    'hunting_bow', 'longbow', 'cf_longbow', 'crossbow',
    // Misc weapons
    'steel_lance', 'war_scythe',
    // Light Armor
    'gambeson', 'leather_armor', 'studded_leather', 'cf_leather',
    // Medium Armor
    'brigandine', 'chainmail', 'scale_armor', 'cf_chainmail',
    // Heavy Armor
    'iron_plate', 'steel_plate', 'plate_armor',
    // Bucklers
    'iron_buckler', 'steel_buckler', 'cf_buckler',
    // Heater Shields
    'wooden_shield', 'iron_shield', 'steel_heater', 'cf_heater',
    // Tower Shields
    'iron_tower_shield', 'tower_shield', 'cf_tower_shield',
  ],
  nodes: {
    greeting: {
      id: 'greeting',
      npcText:
        'Welcome to the forge. I sell blades, armor, and shields. If you need something that can take a hit or deal one, you have come to the right place.',
      options: [
        { id: 'shop', text: 'Show me your wares.', action: 'open_shop' },
        { id: 'leave', text: 'Just passing through. Farewell.', nextNodeId: 'farewell' },
      ],
    },

    farewell: {
      id: 'farewell',
      npcText: 'Come back when you need gear. I will be here.',
      options: [],
      closeAfter: true,
    },
  },
};
