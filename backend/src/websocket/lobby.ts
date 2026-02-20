import { Server as SocketServer, Socket } from 'socket.io';
import { logger } from '../utils/logger.js';
import { db } from '../db/connection.js';
import { getConnectedPlayer } from './index.js';
import { broadcastProximityEmote } from './proximity-broadcast.js';
import * as lobbyManager from '../combat/lobby-manager.js';
import * as sessionManager from '../combat/session-manager.js';
import { generateCombatEmotes, generateBleedingEmote, generateEntranceEmotes, decorateRetainerInEmote, generateWoundNarrative } from '../combat/combat-narrator.js';
import { isAutoNpc, scheduleNpcTurn, handleNpcPostCombat } from '../combat/npc-combatant.js';
import type { LobbyState, CombatSessionCombatant, CombatSessionState, TacticalAction, CombatantStats } from '../combat/types.js';
import { serializeActionResult } from '../combat/serialize-result.js';
import { grantPostSessionXpToAll } from '../xp/combat-xp.js';

/** Rough power score for vague in-character formidability assessment. */
function computeCombatRating(s: CombatantStats): number {
  return (s.prowess * 5) + (s.fortitude * 3) + (s.cunning * 2)
       + (s.weaponTier * 8) + (s.armorTier * 6) + (s.shieldTier * 4)
       + s.maxHealth;
}

/** Broadcast wound assessment results after a session ends. */
function broadcastWoundAssessment(
  io: SocketServer,
  combatRoom: string,
  sessionId: number,
  session: CombatSessionState | null | undefined,
): void {
  if (!session?.woundAssessments?.length) return;
  io.to(combatRoom).emit('combat:wound-assessment', {
    sessionId,
    results: session.woundAssessments.map(r => ({
      characterId: r.characterId,
      characterName: r.characterName,
      healthPercent: r.healthPercent,
      severity: r.severity,
      dicePenalty: r.dicePenalty,
      requiresTending: r.requiresTending,
      infectionRisk: r.infectionRisk,
      narrative: generateWoundNarrative(r),
    })),
  });
}

/** Serialize a combatant for client broadcast. */
function serializeCombatant(c: CombatSessionCombatant) {
  const s = c.statsSnapshot;
  return {
    characterId: c.characterId,
    characterName: c.characterName,
    team: c.team,
    initiative: c.initiative,
    currentHealth: c.currentHealth,
    maxHealth: c.maxHealth,
    isAlive: c.isAlive,
    isYielded: c.isYielded,
    statusEffects: c.statusEffects,
    engagedTo: c.engagedTo,
    protectingId: c.protectingId,
    isBracing: c.isBracing,
    ownerCharacterId: c.ownerCharacterId,

    // Observable equipment
    weaponType: s.weaponType,
    weaponTier: s.weaponTier,
    weaponMaterial: s.weaponMaterial,
    isTwoHanded: s.isTwoHanded,
    armorClass: s.armorClass,
    armorTier: s.armorTier,
    shieldClass: s.shieldClass,
    shieldTier: s.shieldTier,
    hasShield: s.hasShield,
    combatRating: computeCombatRating(s),
  };
}

/** Serialize lobby state for client broadcast. */
function serializeLobby(lobby: LobbyState) {
  return {
    lobbyId: lobby.lobbyId,
    hostCharacterId: lobby.hostCharacterId,
    hostName: lobby.hostName,
    region: lobby.region,
    status: lobby.status,
    maxPlayers: lobby.maxPlayers,
    members: lobby.members.map(m => ({
      characterId: m.characterId,
      characterName: m.characterName,
      team: m.team,
      isReady: m.isReady,
      ownerCharacterId: m.ownerCharacterId,
      isRetainer: m.isRetainer,
    })),
  };
}

export function setupLobbyHandlers(io: SocketServer, socket: Socket): void {

  // --- Create a lobby ---
  socket.on('lobby:create', async () => {
    try {
      const player = getConnectedPlayer(socket.id);
      if (!player?.characterId || !player.region) {
        return socket.emit('lobby:error', { message: 'No active character or region' });
      }

      const lobby = await lobbyManager.createLobby(
        player.characterId,
        player.characterName ?? 'Unknown',
        player.region,
        socket.id,
      );

      socket.join(`lobby:${lobby.lobbyId}`);
      socket.emit('lobby:created', serializeLobby(lobby));
      socket.emit('lobby:state', serializeLobby(lobby));

      // Broadcast to region so lobby browser updates
      io.to(`region:${lobby.region}`).emit('lobby:region-update', { region: lobby.region });

      logger.info(`Lobby ${lobby.lobbyId} created by ${player.characterName}`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to create lobby';
      logger.error('lobby:create error:', error);
      socket.emit('lobby:error', { message: msg });
    }
  });

  // --- Join a lobby ---
  socket.on('lobby:join', async (data: { lobbyId: number }) => {
    try {
      const player = getConnectedPlayer(socket.id);
      if (!player?.characterId) {
        return socket.emit('lobby:error', { message: 'No active character' });
      }

      const lobby = await lobbyManager.joinLobby(
        data.lobbyId,
        player.characterId,
        player.characterName ?? 'Unknown',
        socket.id,
      );

      socket.join(`lobby:${lobby.lobbyId}`);
      io.to(`lobby:${lobby.lobbyId}`).emit('lobby:state', serializeLobby(lobby));

      logger.info(`${player.characterName} joined lobby ${lobby.lobbyId}`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to join lobby';
      socket.emit('lobby:error', { message: friendlyError(msg) });
    }
  });

  // --- Leave a lobby ---
  socket.on('lobby:leave', async (data: { lobbyId: number }) => {
    try {
      const player = getConnectedPlayer(socket.id);
      if (!player?.characterId) return;

      const result = await lobbyManager.leaveLobby(data.lobbyId, player.characterId);
      socket.leave(`lobby:${data.lobbyId}`);

      if (result.cancelled) {
        io.to(`lobby:${data.lobbyId}`).emit('lobby:cancelled', {
          lobbyId: data.lobbyId,
          reason: 'No members remaining',
        });
      } else if (result.lobby) {
        io.to(`lobby:${data.lobbyId}`).emit('lobby:state', serializeLobby(result.lobby));
      }

      socket.emit('lobby:left', { lobbyId: data.lobbyId });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to leave lobby';
      socket.emit('lobby:error', { message: msg });
    }
  });

  // --- Switch team ---
  socket.on('lobby:switch-team', async (data: { lobbyId: number; team: number }) => {
    try {
      const player = getConnectedPlayer(socket.id);
      if (!player?.characterId) return;

      const lobby = await lobbyManager.switchTeam(data.lobbyId, player.characterId, data.team);
      io.to(`lobby:${data.lobbyId}`).emit('lobby:state', serializeLobby(lobby));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to switch team';
      socket.emit('lobby:error', { message: friendlyError(msg) });
    }
  });

  // --- Toggle ready ---
  socket.on('lobby:ready', async (data: { lobbyId: number; ready: boolean }) => {
    try {
      const player = getConnectedPlayer(socket.id);
      if (!player?.characterId) return;

      const lobby = await lobbyManager.setReady(data.lobbyId, player.characterId, data.ready);
      io.to(`lobby:${data.lobbyId}`).emit('lobby:state', serializeLobby(lobby));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to toggle ready';
      socket.emit('lobby:error', { message: msg });
    }
  });

  // --- Toggle retainers ---
  socket.on('lobby:toggle-retainers', async (data: { lobbyId: number; retainerIds: number[] }) => {
    try {
      const player = getConnectedPlayer(socket.id);
      if (!player?.characterId) return;

      const lobby = await lobbyManager.toggleRetainers(data.lobbyId, player.characterId, data.retainerIds);
      io.to(`lobby:${data.lobbyId}`).emit('lobby:state', serializeLobby(lobby));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to toggle retainers';
      socket.emit('lobby:error', { message: friendlyError(msg) });
    }
  });

  // --- Start combat (host only) ---
  socket.on('lobby:start', async (data: { lobbyId: number }) => {
    try {
      const player = getConnectedPlayer(socket.id);
      if (!player?.characterId) return;

      const lobby = await lobbyManager.startCombat(data.lobbyId, player.characterId);
      io.to(`lobby:${data.lobbyId}`).emit('lobby:starting', { lobbyId: data.lobbyId });

      // Create combat session from the lobby
      const session = await sessionManager.createSession(lobby);

      // Mark lobby as fully started (clears lobby state)
      lobbyManager.markStarted(data.lobbyId);

      // Move all members from lobby room to combat room
      const lobbyRoom = `lobby:${data.lobbyId}`;
      const combatRoom = `combat:${session.sessionId}`;
      const sockets = await io.in(lobbyRoom).fetchSockets();
      for (const s of sockets) {
        s.leave(lobbyRoom);
        s.join(combatRoom);
      }

      // Broadcast session start to all combatants
      const combatantsArray = Array.from(session.combatants.values()).map(serializeCombatant);
      const currentTurnId = session.turnOrder[0]?.characterId ?? null;

      io.to(combatRoom).emit('combat:session-start', {
        sessionId: session.sessionId,
        combatants: combatantsArray,
        turnOrder: session.turnOrder,
        currentTurnCharacterId: currentTurnId,
        currentRound: 1,
      });

      // Build name→team and retainer→owner maps for all combat emotes
      const combatantTeams: Record<string, number> = {};
      const retainerOwners: Record<string, string> = {};
      for (const [, c] of session.combatants) {
        combatantTeams[c.characterName] = c.team;
        if (c.ownerCharacterId !== null) {
          const owner = session.combatants.get(c.ownerCharacterId);
          if (owner) retainerOwners[c.characterName] = owner.characterName;
        }
      }

      // Broadcast entrance emotes introducing each team
      // Use the first combatant as anchor for DB persistence (character_id FK)
      const anchorId = session.combatants.keys().next().value!;
      try {
        const entranceEmotes = generateEntranceEmotes(session.combatants);
        for (const emoteText of entranceEmotes) {
          await broadcastProximityEmote(
            io, anchorId, emoteText,
            'Combat', null,
            session.region, 50, anchorId,
            { combatantTeams, retainerOwners },
          );
        }
      } catch (emoteErr) {
        logger.error('Entrance emote broadcast failed:', emoteErr);
      }

      // If the first turn is an auto-AI NPC (not a retainer), schedule their action
      if (currentTurnId !== null && await isAutoNpc(currentTurnId)) {
        scheduleNpcTurn(session.sessionId, currentTurnId, io);
      }

      logger.info(`Combat session ${session.sessionId} started from lobby ${data.lobbyId}`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to start combat';
      logger.error('lobby:start error:', error);
      socket.emit('lobby:error', { message: friendlyError(msg) });
    }
  });

  // --- Cancel lobby (host only) ---
  socket.on('lobby:cancel', async (data: { lobbyId: number }) => {
    try {
      const player = getConnectedPlayer(socket.id);
      if (!player?.characterId) return;

      const lobby = lobbyManager.getLobby(data.lobbyId);
      const region = lobby?.region;

      await lobbyManager.cancelLobby(data.lobbyId, player.characterId);

      io.to(`lobby:${data.lobbyId}`).emit('lobby:cancelled', {
        lobbyId: data.lobbyId,
        reason: 'Host cancelled the lobby',
      });

      // Notify region for lobby browser update
      if (region) {
        io.to(`region:${region}`).emit('lobby:region-update', { region });
      }

      logger.info(`Lobby ${data.lobbyId} cancelled by host`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to cancel lobby';
      socket.emit('lobby:error', { message: msg });
    }
  });

  // ============================================
  // Combat session action handlers
  // ============================================

  // --- Submit a combat action ---
  socket.on('combat:action', async (data: { sessionId: number; actionType: string; targetCharacterId?: number; actorCharacterId?: number }) => {
    try {
      const player = getConnectedPlayer(socket.id);
      if (!player?.characterId) {
        return socket.emit('combat:error', { message: 'No active character' });
      }

      // Determine actor — either the player or their retainer
      const actorId = data.actorCharacterId ?? player.characterId;

      // If acting for a retainer, validate ownership
      if (actorId !== player.characterId) {
        const { isRetainerOf } = await import('../retainers/retainer-manager.js');
        const isOwner = await isRetainerOf(actorId, player.characterId);
        if (!isOwner) {
          return socket.emit('combat:error', { message: 'Not your retainer' });
        }
      }

      // Capture session reference BEFORE processing — completeSession() deletes
      // the session from the in-memory map, but our local reference stays valid.
      const session = sessionManager.getSession(data.sessionId);

      const { result, roundStart, sessionEnded, nextTurnCharacterId, stunnedSkips } = await sessionManager.processAction(
        data.sessionId,
        actorId,
        data.actionType as TacticalAction,
        data.targetCharacterId,
      );

      const combatRoom = `combat:${data.sessionId}`;

      // Broadcast action result with updated combatant state (for status effects, engagement, etc.)
      const updatedCombatants = session
        ? Array.from(session.combatants.values()).map(serializeCombatant)
        : undefined;
      io.to(combatRoom).emit('combat:action-result', {
        sessionId: data.sessionId,
        result: serializeActionResult(result),
        combatants: updatedCombatants,
      });

      // Generate and broadcast IC emotes to nearby players (50m)
      try {
        if (session) {
          const targetFallen = result.targetCharacterId !== null &&
            session.combatants.get(result.targetCharacterId!)?.isAlive === false;

          const emotes = generateCombatEmotes(result, {
            targetFallen,
            targetThresholdCrossed: result.targetThresholdCrossed ?? null,
          });

          // Build name→team and retainer→owner maps for chat highlighting
          const actionCombatantTeams: Record<string, number> = {};
          const actionRetainerOwners: Record<string, string> = {};
          for (const [, c] of session.combatants) {
            actionCombatantTeams[c.characterName] = c.team;
            if (c.ownerCharacterId !== null) {
              const owner = session.combatants.get(c.ownerCharacterId);
              if (owner) actionRetainerOwners[c.characterName] = owner.characterName;
            }
          }

          for (let emoteText of emotes) {
            emoteText = decorateRetainerInEmote(emoteText, result.actorName, actionRetainerOwners);
            await broadcastProximityEmote(
              io, result.actorCharacterId, emoteText,
              'Combat', null,
              session.region, 50, 0,
              { combatantTeams: actionCombatantTeams, retainerOwners: actionRetainerOwners },
            );
          }
        }
      } catch (emoteErr) {
        logger.error('Combat emote broadcast failed:', emoteErr);
      }

      // Broadcast round start if new round (include combatant state for effect expiry sync)
      if (roundStart) {
        const roundCombatants = session
          ? Array.from(session.combatants.values()).map(serializeCombatant)
          : undefined;
        io.to(combatRoom).emit('combat:round-start', {
          sessionId: data.sessionId,
          ...roundStart,
          combatants: roundCombatants,
        });

        // Broadcast bleeding tick emotes
        if (session) {
          // Build name→team and retainer→owner maps for chat highlighting
          const bleedCombatantTeams: Record<string, number> = {};
          const bleedRetainerOwners: Record<string, string> = {};
          for (const [, c] of session.combatants) {
            bleedCombatantTeams[c.characterName] = c.team;
            if (c.ownerCharacterId !== null) {
              const owner = session.combatants.get(c.ownerCharacterId);
              if (owner) bleedRetainerOwners[c.characterName] = owner.characterName;
            }
          }

          for (const bleed of roundStart.bleedingDamage) {
            const combatant = session.combatants.get(bleed.characterId);
            if (combatant) {
              try {
                const died = roundStart.deaths.some(d => d.characterId === bleed.characterId);
                const bleedText = generateBleedingEmote(combatant.characterName, bleed.stacks, died);
                await broadcastProximityEmote(
                  io, bleed.characterId, bleedText,
                  'Combat', null,
                  session.region, 50, 0,
                  { combatantTeams: bleedCombatantTeams, retainerOwners: bleedRetainerOwners },
                );
              } catch (bleedErr) {
                logger.error('Bleeding emote broadcast failed:', bleedErr);
              }
            }
          }
        }
      }

      // Check for defeated combatants
      if (session) {
        for (const [, c] of session.combatants) {
          if (!c.isAlive && result.targetCharacterId === c.characterId) {
            io.to(combatRoom).emit('combat:combatant-defeated', {
              sessionId: data.sessionId,
              characterId: c.characterId,
              killedBy: result.actorCharacterId,
            });
          }
        }
      }

      // Broadcast stun skips before session-end or turn-start
      for (const skip of stunnedSkips) {
        io.to(combatRoom).emit('combat:turn-skipped', {
          sessionId: data.sessionId,
          characterId: skip.characterId,
          reason: 'stunned',
        });
      }

      if (sessionEnded) {
        io.to(combatRoom).emit('combat:session-end', {
          sessionId: data.sessionId,
          winningTeam: session?.winningTeam ?? null,
        });
        broadcastWoundAssessment(io, combatRoom, data.sessionId, session);

        // Handle NPC post-combat (dialog + vitals reset)
        handleNpcPostCombat(data.sessionId, session?.winningTeam ?? null, io).catch(
          err => logger.error('NPC post-combat handling failed:', err),
        );

        // Grant post-session XP to all player combatants
        grantPostSessionXpToAll(data.sessionId).catch(
          err => logger.error('Post-session XP grant failed:', err),
        );
      } else if (nextTurnCharacterId !== null) {
        io.to(combatRoom).emit('combat:turn-start', {
          sessionId: data.sessionId,
          characterId: nextTurnCharacterId,
          round: session?.currentRound ?? 1,
        });

        // If next turn is an NPC, schedule their action
        if (await isAutoNpc(nextTurnCharacterId)) {
          scheduleNpcTurn(data.sessionId, nextTurnCharacterId, io);
        }
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to process action';
      socket.emit('combat:error', { message: friendlyError(msg) });
    }
  });

  // --- Yield in combat ---
  socket.on('combat:yield', async (data: { sessionId: number; actorCharacterId?: number }) => {
    try {
      const player = getConnectedPlayer(socket.id);
      if (!player?.characterId) return;

      const actorId = data.actorCharacterId ?? player.characterId;

      // Validate retainer ownership if acting for a retainer
      if (actorId !== player.characterId) {
        const { isRetainerOf } = await import('../retainers/retainer-manager.js');
        if (!(await isRetainerOf(actorId, player.characterId))) {
          return socket.emit('combat:error', { message: 'Not your retainer' });
        }
      }

      // Capture session reference BEFORE processing — completeSession() deletes it
      const session = sessionManager.getSession(data.sessionId);

      const { sessionEnded, winningTeam, nextTurnCharacterId, roundStart, stunnedSkips } =
        await sessionManager.handleYield(data.sessionId, actorId);
      const combatRoom = `combat:${data.sessionId}`;

      io.to(combatRoom).emit('combat:combatant-yielded', {
        sessionId: data.sessionId,
        characterId: actorId,
      });

      if (roundStart) {
        io.to(combatRoom).emit('combat:round-start', { sessionId: data.sessionId, ...roundStart });
      }

      // Broadcast stun skips
      for (const skip of stunnedSkips) {
        io.to(combatRoom).emit('combat:turn-skipped', {
          sessionId: data.sessionId,
          characterId: skip.characterId,
          reason: 'stunned',
        });
      }

      if (sessionEnded) {
        io.to(combatRoom).emit('combat:session-end', {
          sessionId: data.sessionId,
          winningTeam,
        });
        broadcastWoundAssessment(io, combatRoom, data.sessionId, session);

        // Handle NPC post-combat (dialog + vitals reset)
        handleNpcPostCombat(data.sessionId, winningTeam, io).catch(
          err => logger.error('NPC post-combat handling failed:', err),
        );

        // Grant post-session XP to all player combatants
        grantPostSessionXpToAll(data.sessionId).catch(
          err => logger.error('Post-session XP grant failed:', err),
        );
      } else if (nextTurnCharacterId !== null) {
        io.to(combatRoom).emit('combat:turn-start', {
          sessionId: data.sessionId,
          characterId: nextTurnCharacterId,
          round: session?.currentRound ?? 1,
        });

        // If next turn is an NPC, schedule their action
        if (await isAutoNpc(nextTurnCharacterId)) {
          scheduleNpcTurn(data.sessionId, nextTurnCharacterId, io);
        }
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to yield';
      socket.emit('combat:error', { message: msg });
    }
  });

  // --- Skip turn ---
  socket.on('combat:skip', async (data: { sessionId: number; actorCharacterId?: number }) => {
    try {
      const player = getConnectedPlayer(socket.id);
      if (!player?.characterId) return;

      const actorId = data.actorCharacterId ?? player.characterId;

      // Validate retainer ownership if acting for a retainer
      if (actorId !== player.characterId) {
        const { isRetainerOf } = await import('../retainers/retainer-manager.js');
        if (!(await isRetainerOf(actorId, player.characterId))) {
          return socket.emit('combat:error', { message: 'Not your retainer' });
        }
      }

      // Capture session reference BEFORE processing — completeSession() deletes it
      const session = sessionManager.getSession(data.sessionId);

      const { result, roundStart, sessionEnded, nextTurnCharacterId, stunnedSkips } = await sessionManager.skipTurn(
        data.sessionId,
        actorId,
      );

      const combatRoom = `combat:${data.sessionId}`;
      io.to(combatRoom).emit('combat:turn-skipped', {
        sessionId: data.sessionId,
        characterId: actorId,
        reason: 'voluntary',
      });

      if (roundStart) {
        io.to(combatRoom).emit('combat:round-start', { sessionId: data.sessionId, ...roundStart });
      }

      // Broadcast stun skips
      for (const skip of stunnedSkips) {
        io.to(combatRoom).emit('combat:turn-skipped', {
          sessionId: data.sessionId,
          characterId: skip.characterId,
          reason: 'stunned',
        });
      }

      if (sessionEnded) {
        io.to(combatRoom).emit('combat:session-end', {
          sessionId: data.sessionId,
          winningTeam: session?.winningTeam ?? null,
        });
        broadcastWoundAssessment(io, combatRoom, data.sessionId, session);

        // Handle NPC post-combat (dialog + vitals reset)
        handleNpcPostCombat(data.sessionId, session?.winningTeam ?? null, io).catch(
          err => logger.error('NPC post-combat handling failed:', err),
        );

        // Grant post-session XP to all player combatants
        grantPostSessionXpToAll(data.sessionId).catch(
          err => logger.error('Post-session XP grant failed:', err),
        );
      } else if (nextTurnCharacterId !== null) {
        io.to(combatRoom).emit('combat:turn-start', {
          sessionId: data.sessionId,
          characterId: nextTurnCharacterId,
          round: session?.currentRound ?? 1,
        });

        // If next turn is an NPC, schedule their action
        if (await isAutoNpc(nextTurnCharacterId)) {
          scheduleNpcTurn(data.sessionId, nextTurnCharacterId, io);
        }
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to skip turn';
      socket.emit('combat:error', { message: msg });
    }
  });

  // --- List open lobbies in current region ---
  socket.on('lobby:list', async () => {
    try {
      const player = getConnectedPlayer(socket.id);
      if (!player?.region) {
        return socket.emit('lobby:list', { lobbies: [] });
      }

      const lobbies = await lobbyManager.getLobbiesInRegion(player.region);
      socket.emit('lobby:list', {
        lobbies: lobbies.map(l => ({
          lobbyId: l.lobbyId,
          hostName: l.hostName,
          region: l.region,
          memberCount: l.members.length,
          maxPlayers: l.maxPlayers,
        })),
      });
    } catch (error) {
      logger.error('lobby:list error:', error);
      socket.emit('lobby:error', { message: 'Failed to list lobbies' });
    }
  });
}

/**
 * Handle a player disconnecting from all lobby and combat state.
 * Called from the main disconnect handler in websocket/index.ts.
 */
export async function handleLobbyDisconnect(
  io: SocketServer,
  characterId: number,
): Promise<void> {
  // Handle lobby disconnect
  try {
    const result = await lobbyManager.handleDisconnect(characterId);
    if (result) {
      if (result.cancelled) {
        io.to(`lobby:${result.lobbyId}`).emit('lobby:cancelled', {
          lobbyId: result.lobbyId,
          reason: 'Host disconnected',
        });
      } else if (result.lobby) {
        io.to(`lobby:${result.lobbyId}`).emit('lobby:state', serializeLobby(result.lobby));
      }
    }
  } catch (error) {
    logger.error('handleLobbyDisconnect error:', error);
  }

  // Handle combat session disconnect — treat as yield
  try {
    const combatResult = await sessionManager.handleCombatDisconnect(characterId);
    if (combatResult) {
      const combatRoom = `combat:${combatResult.sessionId}`;
      io.to(combatRoom).emit('combat:combatant-yielded', {
        sessionId: combatResult.sessionId,
        characterId,
        reason: 'disconnected',
      });

      if (combatResult.roundStart) {
        io.to(combatRoom).emit('combat:round-start', {
          sessionId: combatResult.sessionId,
          ...combatResult.roundStart,
        });
      }

      // Broadcast stun skips
      for (const skip of combatResult.stunnedSkips) {
        io.to(combatRoom).emit('combat:turn-skipped', {
          sessionId: combatResult.sessionId,
          characterId: skip.characterId,
          reason: 'stunned',
        });
      }

      if (combatResult.sessionEnded) {
        io.to(combatRoom).emit('combat:session-end', {
          sessionId: combatResult.sessionId,
          winningTeam: combatResult.winningTeam,
        });

        // Broadcast wound assessment results
        if (combatResult.woundAssessments?.length) {
          io.to(combatRoom).emit('combat:wound-assessment', {
            sessionId: combatResult.sessionId,
            results: combatResult.woundAssessments.map(r => ({
              characterId: r.characterId,
              characterName: r.characterName,
              healthPercent: r.healthPercent,
              severity: r.severity,
              dicePenalty: r.dicePenalty,
              requiresTending: r.requiresTending,
              infectionRisk: r.infectionRisk,
              narrative: generateWoundNarrative(r),
            })),
          });
        }

        // Handle NPC post-combat (dialog + vitals reset)
        handleNpcPostCombat(combatResult.sessionId, combatResult.winningTeam, io).catch(
          err => logger.error('NPC post-combat handling failed:', err),
        );

        // Grant post-session XP to all player combatants
        grantPostSessionXpToAll(combatResult.sessionId).catch(
          err => logger.error('Post-session XP grant failed:', err),
        );
      } else if (combatResult.nextTurnCharacterId !== null) {
        const session = sessionManager.getSession(combatResult.sessionId);
        io.to(combatRoom).emit('combat:turn-start', {
          sessionId: combatResult.sessionId,
          characterId: combatResult.nextTurnCharacterId,
          round: session?.currentRound ?? 1,
        });

        // If next turn is an NPC, schedule their action
        if (await isAutoNpc(combatResult.nextTurnCharacterId)) {
          scheduleNpcTurn(combatResult.sessionId, combatResult.nextTurnCharacterId, io);
        }
      }
    }
  } catch (error) {
    logger.error('handleCombatDisconnect error:', error);
  }
}

/** Convert internal error codes to user-friendly messages. */
function friendlyError(code: string): string {
  const messages: Record<string, string> = {
    ALREADY_IN_LOBBY: 'You are already in a lobby',
    LOBBY_NOT_FOUND: 'Lobby not found',
    LOBBY_NOT_OPEN: 'Lobby is no longer open',
    LOBBY_FULL: 'Lobby is full',
    POSITION_UNKNOWN: 'Could not determine your position',
    DIFFERENT_REGION: 'You must be in the same region as the host',
    TOO_FAR: 'You must be within 20 meters of the host',
    TEAM_FULL: 'That team is full (max 64 players)',
    NOT_YOUR_RETAINER: 'That is not your retainer',
    NOT_IN_LOBBY: 'You are not in this lobby',
    NOT_HOST: 'Only the host can do that',
    NOT_READY: 'Not all members are ready, or teams are incomplete',
    INVALID_TEAM: 'Invalid team number',
    CHARACTER_GRAVE_WOUNDS: 'This character has grave wounds and cannot enter combat',
    CHARACTER_DEAD: 'This character is dead',
  };
  return messages[code] ?? code;
}
