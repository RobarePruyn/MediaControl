/**
 * VisionEdge-specific API types.
 * Maps to the Cisco Vision Director Local Control API 3.0 XML response shapes.
 * These types represent parsed XML structures, distinct from shared normalized types.
 * @module bridge-agent/adapters/visionedge/visionEdgeTypes
 */

import type { PlatformConnectionConfig } from '@suitecommand/types';

/** VisionEdge connection config as stored in the controller record */
export interface VisionEdgeConnectionConfig extends PlatformConnectionConfig {
  platform: 'visionedge';
  /** Base URL of the CVD server (e.g., 'https://10.194.175.122') */
  baseUrl: string;
  /** Master PIN for administrative control of all players */
  pin: string;
  /** Optional: scope to a specific control group ID */
  groupId?: string;
}

// ─── Configuration Query Responses ─────────────────────────────────────

/** Parsed from GET config/group → <controlgroups> */
export interface VEControlGroup {
  id: string;
  name: string;
  externalId?: string;
}

/** Parsed from GET config/player → <players> */
export interface VEPlayer {
  id: string;
  name: string;
  location?: string;
  networkAddress?: string;
  macAddress?: string;
  model?: string;
  tvModel?: string;
}

/** Feature names reported by the CVD player features API */
export type VEFeature =
  | 'POWER_STATE'
  | 'VIDEO_INPUT'
  | 'CLOSE_CAPTION'
  | 'MUTING'
  | 'UNMUTING'
  | 'MUTING_TOGGLE'
  | 'VOLUME_CHANGE_ABSOLUTE'
  | 'VOLUME_CHANGE_RELATIVE'
  | 'CHANNEL_CHANGE_ABSOLUTE'
  | 'CHANNEL_CHANGE_RELATIVE';

/** Parsed from GET config/features/player → <playerFeatures> */
export interface VEPlayerFeatures {
  id: string;
  volumeLevels?: number;
  features?: VEFeature[] | { feature?: VEFeature[] };
}

/**
 * Parsed from GET config/inputs/player → <playerInputsList>
 * XML structure: <playerInputs><id/><inputs><input><name/><value/></input>...</inputs></playerInputs>
 * fast-xml-parser parses <inputs> as a wrapper object containing an <input> array.
 */
export interface VEPlayerInputs {
  id: string;
  inputs?: { input?: Array<{ name: string; value: string }> };
}

// ─── Channel Guide Response ────────────────────────────────────────────

/** Parsed from GET channel/guide/{groupId} → <channels> */
export interface VEChannel {
  id: string;
  name: string;
  description?: string;
  shortName?: string;
  longName?: string;
  logicalChannel: string;
  physicalChannel?: string;
  sourceId?: string;
  logoSmall?: string;
  logoMedium?: string;
  logoLarge?: string;
}

// ─── Player Status Response ────────────────────────────────────────────

/**
 * Parsed from GET/POST status/player → <playerStatusList>
 * Fields are optional because the CVD API omits them when state is unknown.
 */
export interface VEPlayerStatus {
  id: string;
  power?: 'on' | 'off';
  muting?: 'on' | 'off';
  volume?: number;
  channel?: string;
  input?: string;
  cc?: 'on' | 'off';
  ccOption?: string;
}

// ─── Command Response ──────────────────────────────────────────────────

/** Parsed from POST control/player/* → <response> */
export interface VECommandResponse {
  success: boolean;
  message?: string;
}
