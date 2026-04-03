/**
 * Redis-backed device state cache and pub/sub for real-time updates.
 * Mirrors endpoint state from the database for fast reads and publishes
 * state changes to WebSocket subscribers via Redis pub/sub.
 * @module api-server/services/stateCache
 */

import { createClient, type RedisClientType } from 'redis';
import type { NormalizedEndpointState } from '@suitecommand/types';

/** Redis key prefix for endpoint state cache */
const STATE_PREFIX = 'endpoint:state:';
/** Redis channel prefix for group state updates */
const GROUP_CHANNEL_PREFIX = 'group:state:';
/** Default TTL for cached state in seconds */
const STATE_TTL_SECONDS = 300;

/**
 * Redis-backed state cache for device endpoint states.
 * Provides caching, pub/sub for real-time WebSocket updates, and rate limiting.
 */
export class StateCache {
  private client: RedisClientType;
  private subscriber: RedisClientType;
  private isConnected = false;

  /**
   * @param redisUrl - Redis connection URL
   */
  constructor(private readonly redisUrl: string) {
    this.client = createClient({ url: redisUrl }) as RedisClientType;
    this.subscriber = this.client.duplicate() as RedisClientType;
  }

  /**
   * Connect to Redis. Must be called before any operations.
   */
  async connect(): Promise<void> {
    await this.client.connect();
    await this.subscriber.connect();
    this.isConnected = true;
    console.log('[StateCache] Connected to Redis');
  }

  /**
   * Disconnect from Redis. Called during graceful shutdown.
   */
  async disconnect(): Promise<void> {
    await this.client.quit();
    await this.subscriber.quit();
    this.isConnected = false;
    console.log('[StateCache] Disconnected from Redis');
  }

  /**
   * Cache endpoint state and publish update to group subscribers.
   * @param endpointId - Database endpoint UUID
   * @param groupId - Group UUID the endpoint belongs to
   * @param state - Normalized endpoint state
   */
  async setEndpointState(
    endpointId: string,
    groupId: string,
    state: NormalizedEndpointState,
  ): Promise<void> {
    const key = `${STATE_PREFIX}${endpointId}`;
    await this.client.set(key, JSON.stringify(state), { EX: STATE_TTL_SECONDS });

    // Publish state update to group channel for WebSocket fan-out
    const channel = `${GROUP_CHANNEL_PREFIX}${groupId}`;
    const message = JSON.stringify({
      type: 'STATE_UPDATE',
      endpointId,
      state,
    });
    await this.client.publish(channel, message);
  }

  /**
   * Get cached endpoint state.
   * @param endpointId - Database endpoint UUID
   * @returns Cached state or null if not found
   */
  async getEndpointState(endpointId: string): Promise<NormalizedEndpointState | null> {
    const key = `${STATE_PREFIX}${endpointId}`;
    const data = await this.client.get(key);
    return data ? (JSON.parse(data) as NormalizedEndpointState) : null;
  }

  /**
   * Subscribe to state updates for a group (used by WebSocket connections).
   * @param groupId - Group UUID to subscribe to
   * @param callback - Function called with each state update message
   */
  async subscribeToGroup(
    groupId: string,
    callback: (message: string) => void,
  ): Promise<void> {
    const channel = `${GROUP_CHANNEL_PREFIX}${groupId}`;
    await this.subscriber.subscribe(channel, callback);
  }

  /**
   * Unsubscribe from group state updates.
   * @param groupId - Group UUID to unsubscribe from
   */
  async unsubscribeFromGroup(groupId: string): Promise<void> {
    const channel = `${GROUP_CHANNEL_PREFIX}${groupId}`;
    await this.subscriber.unsubscribe(channel);
  }

  /**
   * Check rate limit for a token+IP combination.
   * Implements sliding window: max 10 commands per 10 seconds.
   * @param tokenId - Access token UUID
   * @param ip - Client IP address
   * @returns true if within rate limit, false if exceeded
   */
  async checkRateLimit(tokenId: string, ip: string): Promise<boolean> {
    const key = `ratelimit:${tokenId}:${ip}`;
    const now = Date.now();
    const windowMs = 10_000;
    const maxRequests = 10;

    // Use sorted set with timestamp scores for sliding window
    const multi = this.client.multi();
    multi.zRemRangeByScore(key, 0, now - windowMs);
    multi.zCard(key);
    multi.zAdd(key, { score: now, value: `${now}` });
    multi.expire(key, Math.ceil(windowMs / 1000));

    const results = await multi.exec();
    const count = results[1] as number;

    return count < maxRequests;
  }

  /** Expose the underlying Redis client for health checks */
  get connected(): boolean {
    return this.isConnected;
  }
}
