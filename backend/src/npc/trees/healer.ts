import type { DialogTree } from '../types.js';

export const healerTree: DialogTree = {
  npcType: 'healer',
  npcName: 'Sister Maris',
  greeting: 'greeting',
  nodes: {
    greeting: {
      id: 'greeting',
      npcText:
        'Welcome, traveler. I am Sister Maris, a healer. You look like you could use my services. How may I help?',
      options: [
        { id: 'ask_heal', text: 'I need healing.', nextNodeId: 'healing_inquiry' },
        { id: 'ask_services', text: 'Tell me about your services.', nextNodeId: 'services' },
        { id: 'leave', text: 'Farewell, healer.', nextNodeId: 'farewell' },
      ],
    },

    services: {
      id: 'services',
      npcText:
        'I mend wounds. Broken bones, deep cuts, injuries from battle. For the right sum, I can restore you to full health. I do not treat diseases or poisons, only wounds.',
      options: [
        { id: 'ask_price', text: 'How much do you charge?', nextNodeId: 'healing_inquiry' },
        { id: 'leave', text: 'Good to know. Farewell.', nextNodeId: 'farewell' },
      ],
    },

    healing_inquiry: {
      id: 'healing_inquiry',
      npcText:
        'A full restoration will cost you 50 copper stars. You carry {cashFormatted} upon your person. Shall I tend to your wounds?',
      options: [
        {
          id: 'heal',
          text: 'Yes, heal me.',
          action: 'heal',
          conditions: ['needs_healing', 'has_cash:50'],
          conditionFailNodeId: 'condition_fail', // engine resolves dynamically
        },
        { id: 'decline', text: "That's too rich for my blood.", nextNodeId: 'farewell' },
      ],
    },

    already_healed: {
      id: 'already_healed',
      npcText:
        'You appear to be in full health already. I see no wounds that need tending.',
      options: [
        { id: 'leave', text: 'My mistake. Farewell.', nextNodeId: 'farewell' },
      ],
    },

    healed: {
      id: 'healed',
      npcText:
        'There. Your wounds are closed and the pain should ease shortly. You are restored to full health. Try not to get yourself killed out there.',
      options: [
        { id: 'leave', text: 'My thanks, healer.', nextNodeId: 'farewell' },
      ],
    },

    insufficient_gold: {
      id: 'insufficient_gold',
      npcText:
        "You haven't the coin, I'm afraid. A healer must eat as well. Come back when you can pay.",
      options: [
        { id: 'leave', text: "I'll return with the coin.", nextNodeId: 'farewell' },
      ],
    },

    farewell: {
      id: 'farewell',
      npcText: 'Safe travels, friend. Come find me if you take a bad hit.',
      options: [],
      closeAfter: true,
    },
  },
};
