import { logger } from '../utils/logger.js';

// Maps session ID (int) → socket ID
const sessionToSocket = new Map<number, string>();
// Maps socket ID → session ID
const socketToSession = new Map<string, number>();
// Maps socket ID → character name
const socketToCharacter = new Map<string, { characterId: number; characterName: string }>();

/**
 * Assign the lowest available session ID to a socket.
 */
export function assignSessionId(socketId: string, characterId: number, characterName: string): number {
  // Release any existing session for this socket
  releaseSessionId(socketId);

  // Find lowest available ID starting at 1
  let id = 1;
  while (sessionToSocket.has(id)) {
    id++;
  }

  sessionToSocket.set(id, socketId);
  socketToSession.set(socketId, id);
  socketToCharacter.set(socketId, { characterId, characterName });

  logger.debug(`Session ID ${id} assigned to socket ${socketId} (${characterName})`);
  return id;
}

/**
 * Release a session ID when a player disconnects.
 */
export function releaseSessionId(socketId: string): void {
  const sessionId = socketToSession.get(socketId);
  if (sessionId !== undefined) {
    sessionToSocket.delete(sessionId);
    socketToSession.delete(socketId);
    socketToCharacter.delete(socketId);
    logger.debug(`Session ID ${sessionId} released from socket ${socketId}`);
  }
}

/**
 * Get the socket ID for a given session ID.
 */
export function getSocketIdBySession(sessionId: number): string | undefined {
  return sessionToSocket.get(sessionId);
}

/**
 * Get the session ID for a given socket ID.
 */
export function getSessionIdBySocket(socketId: string): number | undefined {
  return socketToSession.get(socketId);
}

/**
 * Get the full player list for broadcasting to clients.
 */
export function getAllSessions(): Array<{ sessionId: number; characterId: number; characterName: string }> {
  const list: Array<{ sessionId: number; characterId: number; characterName: string }> = [];
  for (const [sessionId, socketId] of sessionToSocket) {
    const charInfo = socketToCharacter.get(socketId);
    if (charInfo) {
      list.push({ sessionId, characterId: charInfo.characterId, characterName: charInfo.characterName });
    }
  }
  return list.sort((a, b) => a.sessionId - b.sessionId);
}
