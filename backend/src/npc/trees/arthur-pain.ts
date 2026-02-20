import type { DialogTree } from '../types.js';

export const arthurPainTree: DialogTree = {
  npcType: 'arthur_pain',
  npcName: 'Ser Arthur Pain',
  greeting: 'greeting',
  nodes: {
    greeting: {
      id: 'greeting',
      npcText: 'You dare approach me? I have mastered every weapon, every art of war. If you seek a challenge, know that I will not hold back.',
      options: [
        { id: 'ask_spar', text: 'I challenge you.', action: 'join_spar_arthur' },
        { id: 'leave', text: 'Perhaps another time.', nextNodeId: 'farewell' },
      ],
    },

    no_lobby: {
      id: 'no_lobby',
      npcText: '[OOC: You need to create a combat lobby first before challenging Ser Arthur Pain.]',
      options: [
        { id: 'understood', text: 'Got it.', nextNodeId: 'farewell' },
      ],
    },

    joining: {
      id: 'joining',
      npcText: 'So be it. Prepare yourself.',
      options: [],
      closeAfter: true,
    },

    farewell: {
      id: 'farewell',
      npcText: 'Wise. Few survive my blade.',
      options: [],
      closeAfter: true,
    },

    post_combat_win: {
      id: 'post_combat_win',
      npcText: 'Impossible... you bested me? Perhaps I have grown complacent. Come, let us see if fortune favors you twice.',
      options: [
        { id: 'spar_again', text: 'Again.', action: 'join_spar_arthur' },
        { id: 'leave', text: 'That was enough.', nextNodeId: 'farewell' },
      ],
    },

    post_combat_loss: {
      id: 'post_combat_loss',
      npcText: 'As expected. You have courage, but courage alone will not save you. Train harder and return when you are ready.',
      options: [
        { id: 'spar_again', text: 'Let me try again.', action: 'join_spar_arthur' },
        { id: 'leave', text: 'Farewell.', nextNodeId: 'farewell' },
      ],
    },
  },
};
