/**
 * Control command types for the end-user control interface.
 * Defines request/response shapes for sending commands and receiving state updates.
 * @module @suitecommand/types/control
 */

import type { ControlCommandType, NormalizedEndpointState } from './devices.js';
import type { BrandingConfig, Channel, Endpoint, Group } from './tenant.js';

/** Request body for sending a control command via the control API */
export interface ControlCommandRequest {
  endpointId: string;
  commandType: ControlCommandType;
  payload: Record<string, unknown>;
}

/** Response from the control command API */
export interface ControlCommandResponse {
  success: boolean;
  endpointId: string;
  state: NormalizedEndpointState | null;
  error?: string;
}

/** Full group configuration returned to the control UI on page load */
export interface GroupControlConfig {
  group: Pick<Group, 'id' | 'name' | 'type'>;
  endpoints: Array<Pick<Endpoint, 'id' | 'platformEndpointId' | 'displayName' | 'deviceType' | 'currentState'>>;
  channels: Array<Pick<Channel, 'id' | 'displayName' | 'logoUrl' | 'channelNumber' | 'category'>>;
  branding: BrandingConfig | null;
}

/** WebSocket message types sent from server to client */
export type WsMessageType = 'STATE_UPDATE' | 'CONNECTION_ACK' | 'ERROR';

/** WebSocket message: state update for a single endpoint */
export interface WsStateUpdateMessage {
  type: 'STATE_UPDATE';
  endpointId: string;
  state: NormalizedEndpointState;
}

/** WebSocket message: connection acknowledged */
export interface WsConnectionAckMessage {
  type: 'CONNECTION_ACK';
  groupId: string;
  endpointStates: Array<{
    endpointId: string;
    state: NormalizedEndpointState;
  }>;
}

/** WebSocket message: error notification */
export interface WsErrorMessage {
  type: 'ERROR';
  message: string;
  code?: string;
}

/** Union of all WebSocket messages */
export type WsMessage = WsStateUpdateMessage | WsConnectionAckMessage | WsErrorMessage;
