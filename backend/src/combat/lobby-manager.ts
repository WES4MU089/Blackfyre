import { db } from '../db/connection.js';
import { logger } from '../utils/logger.js';
import type { LobbyState, LobbyMember } from './types.js';

// In-memory lobby store, backed by DB for persistence
const lobbies = new Map<number, LobbyState>();

// Character → lobby mapping for quick lookups
const characterLobby = new Map<number, number>();

/** Throw if a character is dead or has grave wounds and cannot enter combat. */
async function assertCombatEligible(characterId: number): Promise<void> {
  const row = await db.queryOne<{ death_state: string; wound_severity: string }>(
    `SELECT death_state, wound_severity FROM characters WHERE id = ?`,
    [characterId],
  );
  if (row?.death_state === 'dead') throw new Error('CHARACTER_DEAD');
  if (row?.wound_severity === 'grave') throw new Error('CHARACTER_GRAVE_WOUNDS');
}

/**
 * Create a new combat lobby.
 */
export async function createLobby(
  hostCharacterId: number,
  hostName: string,
  region: string,
  socketId: string,
): Promise<LobbyState> {
  // Check if character can enter combat
  await assertCombatEligible(hostCharacterId);

  // Check if already in a lobby
  if (characterLobby.has(hostCharacterId)) {
    throw new Error('ALREADY_IN_LOBBY');
  }

  const lobbyId = await db.insert(
    `INSERT INTO combat_lobbies (host_character_id, region, status, max_players)
     VALUES (?, ?, 'open', 128)`,
    [hostCharacterId, region],
  );

  const host: LobbyMember = {
    characterId: hostCharacterId,
    characterName: hostName,
    team: 1,
    isReady: false,
    socketId,
    ownerCharacterId: null,
    isRetainer: false,
  };

  await db.insert(
    `INSERT INTO combat_lobby_members (lobby_id, character_id, team, is_ready)
     VALUES (?, ?, 1, FALSE)`,
    [lobbyId, hostCharacterId],
  );

  const lobby: LobbyState = {
    lobbyId,
    hostCharacterId,
    hostName,
    region,
    status: 'open',
    maxPlayers: 128,
    members: [host],
  };

  lobbies.set(lobbyId, lobby);
  characterLobby.set(hostCharacterId, lobbyId);

  logger.info(`Lobby ${lobbyId} created by ${hostName} (${hostCharacterId}) in ${region}`);
  return lobby;
}

/**
 * Join an existing lobby. Validates proximity (20m), capacity, and status.
 */
export async function joinLobby(
  lobbyId: number,
  characterId: number,
  characterName: string,
  socketId: string,
): Promise<LobbyState> {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) throw new Error('LOBBY_NOT_FOUND');
  if (lobby.status !== 'open') throw new Error('LOBBY_NOT_OPEN');
  await assertCombatEligible(characterId);
  if (characterLobby.has(characterId)) throw new Error('ALREADY_IN_LOBBY');
  const playerCount = lobby.members.filter(m => !m.isRetainer).length;
  if (playerCount >= lobby.maxPlayers) throw new Error('LOBBY_FULL');

  // Proximity check — 20m max distance from host
  const positions = await db.query<{
    character_id: number; region: string; pos_x: number; pos_y: number; pos_z: number;
  }>(
    `SELECT character_id, region, pos_x, pos_y, pos_z FROM character_positions
     WHERE character_id IN (?, ?)`,
    [lobby.hostCharacterId, characterId],
  );

  const hostPos = positions.find(p => p.character_id === lobby.hostCharacterId);
  const joinerPos = positions.find(p => p.character_id === characterId);

  if (!hostPos || !joinerPos) {
    throw new Error('POSITION_UNKNOWN');
  }
  if (hostPos.region !== joinerPos.region) {
    throw new Error('DIFFERENT_REGION');
  }

  const dx = hostPos.pos_x - joinerPos.pos_x;
  const dy = hostPos.pos_y - joinerPos.pos_y;
  const dz = hostPos.pos_z - joinerPos.pos_z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (distance > 20) {
    throw new Error('TOO_FAR');
  }

  // Assign to the team with fewer players (max 64 players per team, retainers don't count)
  const team1Players = lobby.members.filter(m => m.team === 1 && !m.isRetainer).length;
  const team2Players = lobby.members.filter(m => m.team === 2 && !m.isRetainer).length;
  const team = team1Players <= team2Players ? 1 : 2;

  const member: LobbyMember = {
    characterId,
    characterName,
    team,
    isReady: false,
    socketId,
    ownerCharacterId: null,
    isRetainer: false,
  };

  await db.insert(
    `INSERT INTO combat_lobby_members (lobby_id, character_id, team, is_ready)
     VALUES (?, ?, ?, FALSE)`,
    [lobbyId, characterId, team],
  );

  lobby.members.push(member);
  characterLobby.set(characterId, lobbyId);

  logger.info(`${characterName} (${characterId}) joined lobby ${lobbyId} on team ${team}`);
  return lobby;
}

/**
 * Leave a lobby. If the host leaves, promote next member or cancel.
 */
export async function leaveLobby(
  lobbyId: number,
  characterId: number,
): Promise<{ lobby: LobbyState | null; cancelled: boolean; newHost?: number }> {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) throw new Error('LOBBY_NOT_FOUND');

  const memberIdx = lobby.members.findIndex(m => m.characterId === characterId);
  if (memberIdx === -1) throw new Error('NOT_IN_LOBBY');

  // Also remove all retainers owned by this player
  const retainersToRemove = lobby.members.filter(
    m => m.isRetainer && m.ownerCharacterId === characterId,
  );
  for (const r of retainersToRemove) {
    const rIdx = lobby.members.indexOf(r);
    if (rIdx !== -1) lobby.members.splice(rIdx, 1);
    characterLobby.delete(r.characterId);
    await db.execute(
      `DELETE FROM combat_lobby_members WHERE lobby_id = ? AND character_id = ?`,
      [lobbyId, r.characterId],
    );
  }

  // Re-find index after retainer removal may have shifted indices
  const updatedIdx = lobby.members.findIndex(m => m.characterId === characterId);
  if (updatedIdx !== -1) lobby.members.splice(updatedIdx, 1);
  characterLobby.delete(characterId);

  await db.execute(
    `DELETE FROM combat_lobby_members WHERE lobby_id = ? AND character_id = ?`,
    [lobbyId, characterId],
  );

  // If no members left, cancel the lobby
  if (lobby.members.length === 0) {
    lobby.status = 'cancelled';
    await db.execute(
      `UPDATE combat_lobbies SET status = 'cancelled' WHERE id = ?`,
      [lobbyId],
    );
    lobbies.delete(lobbyId);
    logger.info(`Lobby ${lobbyId} cancelled — no members remaining`);
    return { lobby: null, cancelled: true };
  }

  // If the host left, promote next non-retainer member
  let newHost: number | undefined;
  if (characterId === lobby.hostCharacterId) {
    const promoted = lobby.members.find(m => !m.isRetainer) ?? lobby.members[0];
    lobby.hostCharacterId = promoted.characterId;
    lobby.hostName = promoted.characterName;
    newHost = promoted.characterId;

    await db.execute(
      `UPDATE combat_lobbies SET host_character_id = ? WHERE id = ?`,
      [promoted.characterId, lobbyId],
    );
    logger.info(`Lobby ${lobbyId} host promoted to ${promoted.characterName} (${promoted.characterId})`);
  }

  return { lobby, cancelled: false, newHost };
}

/**
 * Switch a member's team (1 or 2). Max 5 per team.
 */
export async function switchTeam(
  lobbyId: number,
  characterId: number,
  team: number,
): Promise<LobbyState> {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) throw new Error('LOBBY_NOT_FOUND');
  if (team !== 1 && team !== 2) throw new Error('INVALID_TEAM');

  const member = lobby.members.find(m => m.characterId === characterId);
  if (!member) throw new Error('NOT_IN_LOBBY');

  const teamPlayerCount = lobby.members.filter(m => m.team === team && !m.isRetainer).length;
  if (teamPlayerCount >= 64) throw new Error('TEAM_FULL');

  member.team = team;
  await db.execute(
    `UPDATE combat_lobby_members SET team = ? WHERE lobby_id = ? AND character_id = ?`,
    [team, lobbyId, characterId],
  );

  // Move all retainers owned by this player to the same team
  for (const m of lobby.members) {
    if (m.isRetainer && m.ownerCharacterId === characterId && m.team !== team) {
      m.team = team;
      await db.execute(
        `UPDATE combat_lobby_members SET team = ? WHERE lobby_id = ? AND character_id = ?`,
        [team, lobbyId, m.characterId],
      );
    }
  }

  return lobby;
}

/**
 * Toggle a member's ready status.
 */
export async function setReady(
  lobbyId: number,
  characterId: number,
  ready: boolean,
): Promise<LobbyState> {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) throw new Error('LOBBY_NOT_FOUND');

  const member = lobby.members.find(m => m.characterId === characterId);
  if (!member) throw new Error('NOT_IN_LOBBY');

  member.isReady = ready;
  await db.execute(
    `UPDATE combat_lobby_members SET is_ready = ? WHERE lobby_id = ? AND character_id = ?`,
    [ready, lobbyId, characterId],
  );

  return lobby;
}

/**
 * Validate lobby is ready to start combat. Returns true if all members are ready
 * and there's at least one member on each team.
 */
export function canStart(lobby: LobbyState): boolean {
  if (lobby.members.length < 2) return false;
  const team1 = lobby.members.filter(m => m.team === 1);
  const team2 = lobby.members.filter(m => m.team === 2);
  if (team1.length === 0 || team2.length === 0) return false;
  return lobby.members.every(m => m.isReady);
}

/**
 * Mark a lobby as starting combat. Only the host can do this.
 */
export async function startCombat(
  lobbyId: number,
  hostCharacterId: number,
): Promise<LobbyState> {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) throw new Error('LOBBY_NOT_FOUND');
  if (lobby.hostCharacterId !== hostCharacterId) throw new Error('NOT_HOST');
  if (lobby.status !== 'open') throw new Error('LOBBY_NOT_OPEN');
  if (!canStart(lobby)) throw new Error('NOT_READY');

  lobby.status = 'starting';
  await db.execute(
    `UPDATE combat_lobbies SET status = 'starting', started_at = NOW() WHERE id = ?`,
    [lobbyId],
  );

  return lobby;
}

/**
 * Mark lobby as fully started (session created). Clears character→lobby mappings.
 */
export function markStarted(lobbyId: number): void {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return;

  lobby.status = 'started';
  for (const member of lobby.members) {
    characterLobby.delete(member.characterId);
  }
  lobbies.delete(lobbyId);

  db.execute(
    `UPDATE combat_lobbies SET status = 'started' WHERE id = ?`,
    [lobbyId],
  ).catch(err => logger.error('Failed to mark lobby started:', err));
}

/**
 * Cancel a lobby. Only the host can do this.
 */
export async function cancelLobby(
  lobbyId: number,
  hostCharacterId: number,
): Promise<void> {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) throw new Error('LOBBY_NOT_FOUND');
  if (lobby.hostCharacterId !== hostCharacterId) throw new Error('NOT_HOST');

  lobby.status = 'cancelled';
  for (const member of lobby.members) {
    characterLobby.delete(member.characterId);
  }
  lobbies.delete(lobbyId);

  await db.execute(
    `UPDATE combat_lobbies SET status = 'cancelled' WHERE id = ?`,
    [lobbyId],
  );

  logger.info(`Lobby ${lobbyId} cancelled by host`);
}

/**
 * Get all open lobbies in a region.
 */
export async function getLobbiesInRegion(region: string): Promise<LobbyState[]> {
  return Array.from(lobbies.values()).filter(
    l => l.region === region && l.status === 'open',
  );
}

/**
 * Find which lobby a character is in (if any).
 */
export function findLobbyByCharacter(characterId: number): LobbyState | null {
  const lobbyId = characterLobby.get(characterId);
  if (!lobbyId) return null;
  return lobbies.get(lobbyId) ?? null;
}

/**
 * Get a lobby by ID.
 */
export function getLobby(lobbyId: number): LobbyState | null {
  return lobbies.get(lobbyId) ?? null;
}

/**
 * Find an open lobby hosted by a specific character.
 */
export function findLobbyByHost(hostCharacterId: number): LobbyState | null {
  for (const lobby of lobbies.values()) {
    if (lobby.hostCharacterId === hostCharacterId && lobby.status === 'open') {
      return lobby;
    }
  }
  return null;
}

/**
 * Add an NPC to a lobby. Bypasses proximity check, forces team 2,
 * auto-sets ready, uses a sentinel socketId.
 */
export async function npcJoinLobby(
  lobbyId: number,
  npcCharacterId: number,
  npcCharacterName: string,
): Promise<LobbyState> {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) throw new Error('LOBBY_NOT_FOUND');
  if (lobby.status !== 'open') throw new Error('LOBBY_NOT_OPEN');
  if (characterLobby.has(npcCharacterId)) throw new Error('ALREADY_IN_LOBBY');
  if (lobby.members.length >= lobby.maxPlayers) throw new Error('LOBBY_FULL');

  const member: LobbyMember = {
    characterId: npcCharacterId,
    characterName: npcCharacterName,
    team: 2,
    isReady: true,
    socketId: `npc:${npcCharacterId}`,
    ownerCharacterId: null,
    isRetainer: false,
  };

  await db.insert(
    `INSERT INTO combat_lobby_members (lobby_id, character_id, team, is_ready)
     VALUES (?, ?, 2, TRUE)`,
    [lobbyId, npcCharacterId],
  );

  lobby.members.push(member);
  characterLobby.set(npcCharacterId, lobbyId);

  logger.info(`NPC ${npcCharacterName} (${npcCharacterId}) joined lobby ${lobbyId} on team 2 (auto-ready)`);
  return lobby;
}

/**
 * Handle a member disconnecting — remove from lobby, promote host if needed.
 */
export async function handleDisconnect(
  characterId: number,
): Promise<{ lobbyId: number; lobby: LobbyState | null; cancelled: boolean } | null> {
  const lobbyId = characterLobby.get(characterId);
  if (!lobbyId) return null;

  const result = await leaveLobby(lobbyId, characterId);
  return { lobbyId, ...result };
}

/**
 * Add a retainer to a lobby. Bypasses proximity/capacity checks for players.
 * Retainers auto-ready and join their owner's team.
 */
export async function addRetainerToLobby(
  lobbyId: number,
  retainerCharacterId: number,
  retainerName: string,
  ownerCharacterId: number,
  team: number,
): Promise<LobbyState> {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) throw new Error('LOBBY_NOT_FOUND');
  if (lobby.status !== 'open') throw new Error('LOBBY_NOT_OPEN');
  if (characterLobby.has(retainerCharacterId)) throw new Error('ALREADY_IN_LOBBY');

  const member: LobbyMember = {
    characterId: retainerCharacterId,
    characterName: retainerName,
    team,
    isReady: true,
    socketId: `retainer:${retainerCharacterId}`,
    ownerCharacterId,
    isRetainer: true,
  };

  await db.insert(
    `INSERT INTO combat_lobby_members (lobby_id, character_id, team, is_ready)
     VALUES (?, ?, ?, TRUE)`,
    [lobbyId, retainerCharacterId, team],
  );

  lobby.members.push(member);
  characterLobby.set(retainerCharacterId, lobbyId);

  logger.info(`Retainer ${retainerName} (${retainerCharacterId}) joined lobby ${lobbyId} on team ${team} for owner ${ownerCharacterId}`);
  return lobby;
}

/**
 * Remove a retainer from a lobby. Only the owner can do this.
 */
export async function removeRetainerFromLobby(
  lobbyId: number,
  retainerCharacterId: number,
  ownerCharacterId: number,
): Promise<LobbyState> {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) throw new Error('LOBBY_NOT_FOUND');

  const member = lobby.members.find(m => m.characterId === retainerCharacterId);
  if (!member) throw new Error('NOT_IN_LOBBY');
  if (member.ownerCharacterId !== ownerCharacterId) throw new Error('NOT_YOUR_RETAINER');

  const idx = lobby.members.indexOf(member);
  lobby.members.splice(idx, 1);
  characterLobby.delete(retainerCharacterId);

  await db.execute(
    `DELETE FROM combat_lobby_members WHERE lobby_id = ? AND character_id = ?`,
    [lobbyId, retainerCharacterId],
  );

  logger.info(`Retainer ${retainerCharacterId} removed from lobby ${lobbyId} by owner ${ownerCharacterId}`);
  return lobby;
}

/**
 * Toggle which retainers are in the lobby. Adds/removes based on desired set.
 * All retainers join their owner's team.
 */
export async function toggleRetainers(
  lobbyId: number,
  ownerCharacterId: number,
  retainerIds: number[],
): Promise<LobbyState> {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) throw new Error('LOBBY_NOT_FOUND');
  if (lobby.status !== 'open') throw new Error('LOBBY_NOT_OPEN');

  const ownerMember = lobby.members.find(m => m.characterId === ownerCharacterId);
  if (!ownerMember) throw new Error('NOT_IN_LOBBY');

  // Get currently deployed retainers for this owner
  const currentRetainers = lobby.members.filter(
    m => m.isRetainer && m.ownerCharacterId === ownerCharacterId,
  );
  const currentIds = new Set(currentRetainers.map(m => m.characterId));
  const desiredIds = new Set(retainerIds);

  // Remove retainers no longer in the set
  for (const cur of currentRetainers) {
    if (!desiredIds.has(cur.characterId)) {
      await removeRetainerFromLobby(lobbyId, cur.characterId, ownerCharacterId);
    }
  }

  // Add new retainers
  for (const retainerId of retainerIds) {
    if (!currentIds.has(retainerId)) {
      // Validate ownership via lazy import to avoid circular deps
      const { isRetainerOf } = await import('../retainers/retainer-manager.js');
      const isOwner = await isRetainerOf(retainerId, ownerCharacterId);
      if (!isOwner) continue;

      // Get retainer name from DB
      const row = await db.queryOne<{ name: string }>(
        'SELECT name FROM characters WHERE id = ? AND is_active = TRUE',
        [retainerId],
      );
      if (!row) continue;

      await addRetainerToLobby(lobbyId, retainerId, row.name, ownerCharacterId, ownerMember.team);
    }
  }

  return lobbies.get(lobbyId)!;
}
