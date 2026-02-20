import type { DialogTree } from '../types.js';

export const retainerCaptainTree: DialogTree = {
  npcType: 'retainer_captain',
  npcName: 'The Retainer Captain',
  greeting: 'greeting',
  nodes: {
    greeting: {
      id: 'greeting',
      npcText: 'Looking for swords for hire? I\'ve got fighters of every caliber — from green recruits to legendary warriors. What do you need?',
      options: [
        { id: 'browse', text: 'Show me who\'s available.', action: 'list_retainer_tiers' },
        { id: 'dismiss', text: 'I want to dismiss a retainer.', action: 'list_owned_retainers' },
        { id: 'leave', text: 'Never mind.', nextNodeId: 'farewell' },
      ],
    },

    // Dynamic node — replaced at runtime by list_retainer_tiers action
    browse_tiers: {
      id: 'browse_tiers',
      npcText: 'Here\'s what I can offer:',
      options: [],
    },

    name_retainer: {
      id: 'name_retainer',
      npcText: 'What shall we call your new recruit? Choose a name wisely — it\'ll be the last thing their enemies hear.',
      options: [],
    },

    hired: {
      id: 'hired',
      npcText: 'Done. Your new retainer is ready for duty. You can deploy them in your next combat lobby, or manage their equipment from the retainer window.',
      options: [
        { id: 'browse_more', text: 'I need another.', action: 'list_retainer_tiers' },
        { id: 'leave', text: 'That will do.', nextNodeId: 'farewell' },
      ],
    },

    no_gold: {
      id: 'no_gold',
      npcText: 'You don\'t have enough gold for that. Come back when your purse is heavier.',
      options: [
        { id: 'back', text: 'Let me look at other tiers.', action: 'list_retainer_tiers' },
        { id: 'leave', text: 'I\'ll come back later.', nextNodeId: 'farewell' },
      ],
    },

    too_many: {
      id: 'too_many',
      npcText: 'You\'ve already got a full retinue — four fighters at your command. Dismiss someone first if you want fresh blood.',
      options: [
        { id: 'dismiss', text: 'I\'ll dismiss one.', action: 'list_owned_retainers' },
        { id: 'leave', text: 'I\'ll manage.', nextNodeId: 'farewell' },
      ],
    },

    // Dynamic node — replaced at runtime by list_owned_retainers action
    dismiss_select: {
      id: 'dismiss_select',
      npcText: 'Which of your retainers do you want to let go?',
      options: [],
    },

    no_retainers: {
      id: 'no_retainers',
      npcText: 'You don\'t have any retainers to dismiss. Want to hire some instead?',
      options: [
        { id: 'browse', text: 'Show me who\'s available.', action: 'list_retainer_tiers' },
        { id: 'leave', text: 'Never mind.', nextNodeId: 'farewell' },
      ],
    },

    dismissed: {
      id: 'dismissed',
      npcText: 'They\'ve been sent on their way. No refunds, mind you.',
      options: [
        { id: 'browse', text: 'I need a replacement.', action: 'list_retainer_tiers' },
        { id: 'leave', text: 'That\'s all.', nextNodeId: 'farewell' },
      ],
    },

    farewell: {
      id: 'farewell',
      npcText: 'I\'ll be here when you need fighters.',
      options: [],
      closeAfter: true,
    },
  },
};
