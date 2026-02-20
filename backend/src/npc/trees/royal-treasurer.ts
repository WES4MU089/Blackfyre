import type { DialogTree } from '../types.js';

export const royalTreasurerTree: DialogTree = {
  npcType: 'royal_treasurer',
  npcName: 'The Royal Treasurer',
  greeting: 'greeting',
  nodes: {
    greeting: {
      id: 'greeting',
      npcText: 'The Crown\'s coffers are open for testing purposes. You currently hold {cashFormatted}. How much gold do you require?',
      options: [
        { id: 'give_100', text: 'Give me 100 gold.', action: 'give_gold:100' },
        { id: 'give_1000', text: 'Give me 1,000 gold.', action: 'give_gold:1000' },
        { id: 'give_10000', text: 'Give me 10,000 gold.', action: 'give_gold:10000' },
        { id: 'leave', text: 'Never mind.', nextNodeId: 'farewell' },
      ],
    },

    gold_given: {
      id: 'gold_given',
      npcText: 'Done. The gold has been added to your purse. You now hold {cashFormatted}.',
      options: [
        { id: 'more', text: 'I need more.', nextNodeId: 'greeting' },
        { id: 'leave', text: 'That will do.', nextNodeId: 'farewell' },
      ],
    },

    farewell: {
      id: 'farewell',
      npcText: 'The treasury remains at your disposal.',
      options: [],
      closeAfter: true,
    },
  },
};
