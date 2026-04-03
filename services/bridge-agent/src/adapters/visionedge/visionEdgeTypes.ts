/**
 * VisionEdge-specific API types.
 * These types represent raw responses from the WiPro VisionEdge REST API.
 * They are distinct from the shared normalized types in @suitecommand/types.
 * @module bridge-agent/adapters/visionedge/visionEdgeTypes
 */

import type { PlatformConnectionConfig } from '@suitecommand/types';

/** VisionEdge connection config as stored in the controller record */
export interface VisionEdgeConnectionConfig extends PlatformConnectionConfig {
  platform: 'visionedge';
  /** Base URL of the VisionEdge API server (e.g., 'http://192.168.1.100:8080') */
  baseUrl: string;
  /** API authentication token */
  apiKey: string;
  /** Optional target system instance ID */
  systemId?: string;
}

/** Raw endpoint response from the VisionEdge device list API */
export interface VEEndpointResponse {
  id: string;
  name: string;
  type: string;
  status: string;
  inputs: string[];
}

/** Raw device status response from VisionEdge */
export interface VEStatusResponse {
  id: string;
  name: string;
  powerState: string;
  currentInput: string;
  currentChannel: string;
  volume: number;
  muted: boolean;
}

/** Raw command response from VisionEdge */
export interface VECommandResponse {
  success: boolean;
  endpointId: string;
  newState: VEStatusResponse;
}

/** Raw channel entry from VisionEdge channel list */
export interface VEChannelResponse {
  number: string;
  name: string;
  category?: string;
}
