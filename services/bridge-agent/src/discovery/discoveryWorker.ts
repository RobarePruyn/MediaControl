/**
 * Discovery worker — periodic polling of device platforms for endpoints.
 * In Phase 1, discovery is triggered on-demand by the API server via the
 * bridge agent's /bridge/discover/:controllerId route. This worker provides
 * the infrastructure for automatic periodic polling when configured.
 * @module bridge-agent/discovery/discoveryWorker
 */

import type { DiscoveredEndpoint, PlatformConnectionConfig } from '@suitecommand/types';

import { createAdapter } from '../adapters/registry.js';

/** Active polling intervals keyed by controller ID */
const activePollers = new Map<string, ReturnType<typeof setInterval>>();

/**
 * Start periodic discovery polling for a controller.
 * @param controllerId - Controller UUID
 * @param platformSlug - Platform adapter slug
 * @param connectionConfig - Decrypted connection config
 * @param intervalSeconds - Polling interval in seconds
 * @param onDiscovery - Callback invoked with discovered endpoints
 */
export function startPolling(
  controllerId: string,
  platformSlug: string,
  connectionConfig: PlatformConnectionConfig,
  intervalSeconds: number,
  onDiscovery: (controllerId: string, endpoints: DiscoveredEndpoint[]) => void,
): void {
  // Stop any existing poller for this controller
  stopPolling(controllerId);

  const intervalMs = intervalSeconds * 1000;

  const poll = async () => {
    try {
      const adapter = createAdapter(platformSlug, connectionConfig);
      const endpoints = await adapter.discoverEndpoints();
      onDiscovery(controllerId, endpoints);
    } catch (error) {
      console.error(
        `[DiscoveryWorker] Polling failed for controller ${controllerId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  };

  // Run once immediately, then on interval
  void poll();
  const timer = setInterval(() => void poll(), intervalMs);
  activePollers.set(controllerId, timer);

  console.log(
    `[DiscoveryWorker] Started polling controller ${controllerId} every ${intervalSeconds}s`,
  );
}

/**
 * Stop polling for a controller.
 * @param controllerId - Controller UUID
 */
export function stopPolling(controllerId: string): void {
  const timer = activePollers.get(controllerId);
  if (timer) {
    clearInterval(timer);
    activePollers.delete(controllerId);
    console.log(`[DiscoveryWorker] Stopped polling controller ${controllerId}`);
  }
}

/**
 * Stop all active pollers. Called during graceful shutdown.
 */
export function stopAllPolling(): void {
  for (const [controllerId, timer] of activePollers) {
    clearInterval(timer);
    console.log(`[DiscoveryWorker] Stopped polling controller ${controllerId}`);
  }
  activePollers.clear();
}
