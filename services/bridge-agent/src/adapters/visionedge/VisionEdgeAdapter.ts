/**
 * VisionEdge platform adapter — WiPro VisionEdge IPTV control.
 * Implements IPlatformAdapter for endpoint discovery, state polling, and command dispatch.
 *
 * STUB IMPLEMENTATION: Returns mock data for development and testing.
 * Replace with real VisionEdge API calls in build step 11 after reviewing API docs.
 * @module bridge-agent/adapters/visionedge/VisionEdgeAdapter
 */

import type {
  ControlCommand,
  DiscoveredEndpoint,
  NormalizedEndpointState,
  PlatformConnectionConfig,
} from '@suitecommand/types';

import { BasePlatformAdapter } from '../AdapterInterface.js';
import type { VisionEdgeConnectionConfig } from './visionEdgeTypes.js';

/** Number of mock endpoints returned by the stub */
const MOCK_ENDPOINT_COUNT = 4;

/**
 * WiPro VisionEdge adapter.
 * Currently returns mock data; will be replaced with real API calls.
 */
export class VisionEdgeAdapter extends BasePlatformAdapter {
  readonly platformName = 'WiPro VisionEdge';
  readonly platformSlug = 'visionedge';

  /** Typed access to the VisionEdge-specific connection config */
  private get veConfig(): VisionEdgeConnectionConfig {
    return this.connectionConfig as VisionEdgeConnectionConfig;
  }

  /**
   * @param connectionConfig - Decrypted VisionEdge connection config
   */
  constructor(connectionConfig: PlatformConnectionConfig) {
    super(connectionConfig);
  }

  /**
   * Test connectivity to the VisionEdge server.
   * STUB: Validates that baseUrl and apiKey are present.
   */
  async testConnection(): Promise<void> {
    const { baseUrl, apiKey } = this.veConfig;
    if (!baseUrl || !apiKey) {
      throw new Error('VisionEdge connection config missing baseUrl or apiKey');
    }
    // STUB: In real implementation, make a health-check GET to the VisionEdge API
    console.log(`[VisionEdge STUB] testConnection to ${baseUrl} — OK`);
  }

  /**
   * Discover all endpoints (TVs/displays) from VisionEdge.
   * STUB: Returns mock endpoints.
   */
  async discoverEndpoints(): Promise<DiscoveredEndpoint[]> {
    console.log(`[VisionEdge STUB] discoverEndpoints from ${this.veConfig.baseUrl}`);

    return Array.from({ length: MOCK_ENDPOINT_COUNT }, (_, i) => ({
      platformEndpointId: `ve-endpoint-${i + 1}`,
      displayName: `Suite TV ${i + 1}`,
      deviceType: 'tv',
      capabilities: ['POWER', 'INPUT', 'VOLUME', 'CHANNEL', 'MUTE'] as const,
      availableInputs: ['HDMI1', 'HDMI2', 'HDMI3', 'COAX'],
    }));
  }

  /**
   * Fetch current state of a single endpoint.
   * STUB: Returns mock powered-on state.
   * @param platformEndpointId - Native VisionEdge endpoint ID
   */
  async getEndpointState(platformEndpointId: string): Promise<NormalizedEndpointState> {
    console.log(`[VisionEdge STUB] getEndpointState for ${platformEndpointId}`);

    return {
      platformEndpointId,
      displayName: `Endpoint ${platformEndpointId}`,
      isPoweredOn: true,
      currentInput: 'HDMI1',
      currentChannelNumber: '100',
      volumeLevel: 25,
      isMuted: false,
      rawPlatformData: { stub: true },
    };
  }

  /**
   * Send a control command to a VisionEdge endpoint.
   * STUB: Echoes back a mock state reflecting the command.
   * @param command - The control command to execute
   */
  async sendCommand(command: ControlCommand): Promise<NormalizedEndpointState> {
    console.log(
      `[VisionEdge STUB] sendCommand ${command.commandType} to ${command.platformEndpointId}`,
    );

    // Build a mock state that reflects the command
    const baseState: NormalizedEndpointState = {
      platformEndpointId: command.platformEndpointId,
      displayName: `Endpoint ${command.platformEndpointId}`,
      isPoweredOn: true,
      currentInput: 'HDMI1',
      currentChannelNumber: '100',
      volumeLevel: 25,
      isMuted: false,
      rawPlatformData: { stub: true, lastCommand: command.commandType },
    };

    switch (command.commandType) {
      case 'POWER':
        if ('state' in command.payload) {
          const powerState = command.payload.state;
          baseState.isPoweredOn =
            powerState === 'toggle' ? !baseState.isPoweredOn : powerState === 'on';
        }
        break;
      case 'INPUT':
        if ('input' in command.payload) {
          baseState.currentInput = command.payload.input;
        }
        break;
      case 'VOLUME':
        if ('level' in command.payload) {
          baseState.volumeLevel = command.payload.level;
        }
        break;
      case 'CHANNEL':
        if ('channelNumber' in command.payload) {
          baseState.currentChannelNumber = command.payload.channelNumber;
        }
        break;
      case 'MUTE':
        if ('muted' in command.payload) {
          baseState.isMuted = command.payload.muted;
        }
        break;
    }

    return baseState;
  }

  /**
   * Discover available channels from VisionEdge.
   * STUB: Returns a small set of mock channels.
   */
  async discoverChannels(): Promise<Array<{ channelNumber: string; displayName: string }>> {
    console.log(`[VisionEdge STUB] discoverChannels from ${this.veConfig.baseUrl}`);

    return [
      { channelNumber: '2', displayName: 'CBS' },
      { channelNumber: '4', displayName: 'NBC' },
      { channelNumber: '5', displayName: 'FOX' },
      { channelNumber: '7', displayName: 'ABC' },
      { channelNumber: '11', displayName: 'CNN' },
      { channelNumber: '206', displayName: 'ESPN' },
      { channelNumber: '209', displayName: 'ESPN2' },
      { channelNumber: '219', displayName: 'NFL Network' },
      { channelNumber: '245', displayName: 'TNT Sports' },
    ];
  }
}
