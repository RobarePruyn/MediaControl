/**
 * Abstract base for all device platform adapters.
 * Every adapter receives its connection config at construction time and
 * implements the IPlatformAdapter contract from @suitecommand/types.
 *
 * Concrete adapters live in subdirectories (e.g., visionedge/) and are
 * registered in the adapter registry by platform slug.
 * @module bridge-agent/adapters/AdapterInterface
 */

import type {
  ControlCommand,
  DiscoveredEndpoint,
  IPlatformAdapter,
  NormalizedEndpointState,
  PlatformConnectionConfig,
} from '@suitecommand/types';

/**
 * Abstract base class that all platform adapters extend.
 * Provides the connection config and enforces the IPlatformAdapter contract.
 */
export abstract class BasePlatformAdapter implements IPlatformAdapter {
  abstract readonly platformName: string;
  abstract readonly platformSlug: string;

  /** The decrypted connection configuration for this controller instance */
  protected readonly connectionConfig: PlatformConnectionConfig;

  /**
   * @param connectionConfig - Decrypted platform connection config
   */
  constructor(connectionConfig: PlatformConnectionConfig) {
    this.connectionConfig = connectionConfig;
  }

  abstract testConnection(): Promise<void>;
  abstract discoverEndpoints(): Promise<DiscoveredEndpoint[]>;
  abstract getEndpointState(platformEndpointId: string): Promise<NormalizedEndpointState>;
  abstract sendCommand(command: ControlCommand): Promise<NormalizedEndpointState>;

  /**
   * Optional channel discovery. Override in adapters that support it.
   */
  async discoverChannels(): Promise<Array<{ channelNumber: string; displayName: string }>> {
    return [];
  }
}
