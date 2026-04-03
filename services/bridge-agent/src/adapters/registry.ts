/**
 * Adapter registry — maps platform slugs to their adapter constructors.
 * The bridge agent uses this registry to instantiate the correct adapter
 * for each controller based on its platform_slug.
 * @module bridge-agent/adapters/registry
 */

import type { PlatformConnectionConfig } from '@suitecommand/types';

import type { BasePlatformAdapter } from './AdapterInterface.js';
import { VisionEdgeAdapter } from './visionedge/VisionEdgeAdapter.js';

/** Constructor signature for platform adapters */
type AdapterConstructor = new (config: PlatformConnectionConfig) => BasePlatformAdapter;

/** Map of platform slug → adapter constructor */
const adapterRegistry = new Map<string, AdapterConstructor>();

/**
 * Register a platform adapter by its slug.
 * @param slug - Platform identifier (e.g., 'visionedge')
 * @param constructor - Adapter class constructor
 */
export function registerAdapter(slug: string, constructor: AdapterConstructor): void {
  adapterRegistry.set(slug, constructor);
}

/**
 * Create an adapter instance for the given platform slug and connection config.
 * @param platformSlug - The platform identifier
 * @param connectionConfig - Decrypted connection configuration
 * @returns An instantiated adapter ready for use
 * @throws Error if no adapter is registered for the given slug
 */
export function createAdapter(
  platformSlug: string,
  connectionConfig: PlatformConnectionConfig,
): BasePlatformAdapter {
  const Constructor = adapterRegistry.get(platformSlug);
  if (!Constructor) {
    throw new Error(`No adapter registered for platform: ${platformSlug}`);
  }
  return new Constructor(connectionConfig);
}

/**
 * Get all registered platform slugs.
 * @returns Array of registered platform slug strings
 */
export function getRegisteredPlatforms(): string[] {
  return Array.from(adapterRegistry.keys());
}

// ─── Register built-in adapters ────────────────────────────────────────

registerAdapter('visionedge', VisionEdgeAdapter);
