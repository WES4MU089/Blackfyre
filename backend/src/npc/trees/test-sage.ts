import type { DialogTree } from '../types.js';

export const testSageTree: DialogTree = {
  npcType: 'test_sage',
  npcName: 'The Sage of Trials',
  greeting: 'greeting',
  nodes: {
    greeting: {
      id: 'greeting',
      npcText: 'Ah, a seeker of power. You stand at level {level} with {xpSegments} segments filled. What would you have of me?',
      options: [
        { id: 'grant_1', text: 'Grant me 1 XP segment.', action: 'grant_xp:1' },
        { id: 'grant_3', text: 'Grant me 3 XP segments.', action: 'grant_xp:3' },
        { id: 'levelup', text: 'Level me up.', action: 'grant_levelup' },
        { id: 'leave', text: 'I seek nothing.', nextNodeId: 'farewell' },
      ],
    },

    xp_granted: {
      id: 'xp_granted',
      npcText: 'The knowledge flows into you. You now stand at level {level} with {xpSegments} segments filled.',
      options: [
        { id: 'more', text: 'I want more.', nextNodeId: 'greeting' },
        { id: 'leave', text: 'That is enough.', nextNodeId: 'farewell' },
      ],
    },

    leveled_up: {
      id: 'leveled_up',
      npcText: 'Power surges through you. You have ascended to level {level}.',
      options: [
        { id: 'again', text: 'Again.', action: 'grant_levelup' },
        { id: 'leave', text: 'I feel the change.', nextNodeId: 'farewell' },
      ],
    },

    farewell: {
      id: 'farewell',
      npcText: 'Return when you hunger for more.',
      options: [],
      closeAfter: true,
    },
  },
};
