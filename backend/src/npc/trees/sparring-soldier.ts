import type { DialogTree } from '../types.js';

export const sparringSoldierTree: DialogTree = {
  npcType: 'sparring_soldier',
  npcName: 'Ser Rodrik',
  greeting: 'greeting',
  nodes: {
    greeting: {
      id: 'greeting',
      npcText: 'Looking for a bout? I\'m always here to cross swords with those willing to test their steel.',
      options: [
        { id: 'ask_spar', text: 'I\'d like to spar.', action: 'join_spar' },
        { id: 'leave', text: 'Never mind.', nextNodeId: 'farewell' },
      ],
    },

    no_lobby: {
      id: 'no_lobby',
      npcText: '[OOC: You need to create a combat lobby first before inviting the sparring soldier.]',
      options: [
        { id: 'understood', text: 'Got it.', nextNodeId: 'farewell' },
      ],
    },

    joining: {
      id: 'joining',
      npcText: 'Very well. Let\'s see what you\'ve got.',
      options: [],
      closeAfter: true,
    },

    farewell: {
      id: 'farewell',
      npcText: 'I\'ll be here when you\'re ready.',
      options: [],
      closeAfter: true,
    },

    post_combat_win: {
      id: 'post_combat_win',
      npcText: 'You\'re doing quite well with that weapon. Not sure if I\'m here to keep you on your toes, or if you\'re here to keep me on mine.',
      options: [
        { id: 'spar_again', text: 'Spar again?', action: 'join_spar' },
        { id: 'leave', text: 'Farewell.', nextNodeId: 'farewell' },
      ],
    },

    post_combat_loss: {
      id: 'post_combat_loss',
      npcText: 'Well, we wouldn\'t get better if we didn\'t earn a few cuts and scrapes along the way. Keep at it, and you\'ll sharpen your skills in no time.',
      options: [
        { id: 'spar_again', text: 'Let\'s go again.', action: 'join_spar' },
        { id: 'leave', text: 'Farewell.', nextNodeId: 'farewell' },
      ],
    },
  },
};
