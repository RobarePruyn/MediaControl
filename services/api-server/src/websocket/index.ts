/**
 * WebSocket hub for real-time device state updates.
 * Guests connect to /ws/control/:groupToken and receive state updates
 * for all endpoints in the group via Redis pub/sub.
 * @module api-server/websocket
 */

import type { WebSocket } from 'ws';
import { eq, and, isNull } from 'drizzle-orm';

import type { Database } from '../db/client.js';
import type { StateCache } from '../services/stateCache.js';
import { groupAccessTokens, groups, venues } from '../db/schema.js';
import { isTokenCurrentlyValid, isWithinWsGraceWindow } from '../utils/tokenValidity.js';

/** Heartbeat interval in milliseconds */
const HEARTBEAT_INTERVAL_MS = 30_000;

/** Extended WebSocket with connection metadata */
interface ControlSocket extends WebSocket {
  isAlive: boolean;
  groupId: string;
  tokenId: string;
  connectedAt: Date;
}

/**
 * Initialize the WebSocket hub.
 * Sets up connection handling, token validation, Redis subscription, and heartbeat.
 * @param db - Database client
 * @param stateCache - Redis state cache for pub/sub
 */
export function initWebSocketHub(db: Database, stateCache: StateCache) {
  /** Track active connections by group */
  const connections = new Map<string, Set<ControlSocket>>();

  /**
   * Handle a new WebSocket connection for a group control session.
   * @param ws - WebSocket connection
   * @param groupToken - The access token from the URL path
   */
  async function handleConnection(ws: WebSocket, groupToken: string): Promise<void> {
    const socket = ws as ControlSocket;
    socket.isAlive = true;
    socket.connectedAt = new Date();

    // Validate token
    const [tokenRecord] = await db
      .select()
      .from(groupAccessTokens)
      .where(eq(groupAccessTokens.token, groupToken));

    if (!tokenRecord) {
      socket.send(JSON.stringify({ type: 'ERROR', message: 'Invalid access token', code: 'TOKEN_INVALID' }));
      socket.close(4001, 'Invalid token');
      return;
    }

    // Get venue timezone for validity check
    const [group] = await db.select().from(groups).where(eq(groups.id, tokenRecord.groupId));
    if (!group) {
      socket.close(4002, 'Group not found');
      return;
    }

    const [venue] = await db.select().from(venues).where(eq(venues.id, group.venueId));
    if (!venue) {
      socket.close(4003, 'Venue not found');
      return;
    }

    const tokenForValidation = {
      ...tokenRecord,
      accessTier: tokenRecord.accessTier as 'event' | 'seasonal' | 'permanent',
      validFrom: tokenRecord.validFrom?.toISOString() ?? null,
      validUntil: tokenRecord.validUntil?.toISOString() ?? null,
      rotatedAt: tokenRecord.rotatedAt?.toISOString() ?? null,
      eventId: tokenRecord.eventId,
      createdAt: tokenRecord.createdAt.toISOString(),
    };

    if (!isTokenCurrentlyValid(tokenForValidation, venue.timezone)) {
      socket.send(JSON.stringify({ type: 'ERROR', message: 'Access has expired', code: 'TOKEN_EXPIRED' }));
      socket.close(4004, 'Token expired');
      return;
    }

    socket.groupId = group.id;
    socket.tokenId = tokenRecord.id;

    // Add to connection tracking
    if (!connections.has(group.id)) {
      connections.set(group.id, new Set());
      // Subscribe to Redis channel for this group
      await stateCache.subscribeToGroup(group.id, (message) => {
        const groupSockets = connections.get(group.id);
        if (groupSockets) {
          for (const s of groupSockets) {
            if (s.readyState === s.OPEN) {
              s.send(message);
            }
          }
        }
      });
    }
    connections.get(group.id)!.add(socket);

    // Send connection acknowledgement with current states
    socket.send(JSON.stringify({
      type: 'CONNECTION_ACK',
      groupId: group.id,
      endpointStates: [],
    }));

    // Handle pong for heartbeat
    socket.on('pong', () => {
      socket.isAlive = true;
    });

    // Handle disconnect
    socket.on('close', async () => {
      const groupSockets = connections.get(socket.groupId);
      if (groupSockets) {
        groupSockets.delete(socket);
        if (groupSockets.size === 0) {
          connections.delete(socket.groupId);
          await stateCache.unsubscribeFromGroup(socket.groupId);
        }
      }
    });
  }

  // Heartbeat: ping every 30 seconds, close dead connections
  const heartbeat = setInterval(() => {
    for (const [, groupSockets] of connections) {
      for (const socket of groupSockets) {
        if (!socket.isAlive) {
          socket.terminate();
          continue;
        }
        socket.isAlive = false;
        socket.ping();
      }
    }
  }, HEARTBEAT_INTERVAL_MS);

  return {
    handleConnection,
    /** Stop the heartbeat timer during shutdown */
    shutdown() {
      clearInterval(heartbeat);
      for (const [, groupSockets] of connections) {
        for (const socket of groupSockets) {
          socket.close(1001, 'Server shutting down');
        }
      }
      connections.clear();
    },
  };
}
