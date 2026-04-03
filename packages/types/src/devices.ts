/**
 * Device platform types and adapter interface.
 * Defines the contract that every device platform adapter must implement.
 * @module @suitecommand/types/devices
 */

/** Canonical command types supported across all platforms */
export type ControlCommandType = 'POWER' | 'INPUT' | 'VOLUME' | 'CHANNEL' | 'MUTE';

/** A single control command sent from the API server to the bridge agent */
export interface ControlCommand {
  commandType: ControlCommandType;
  /** Platform-native endpoint ID (from EndpointRecord.platform_endpoint_id) */
  platformEndpointId: string;
  payload: PowerPayload | InputPayload | VolumePayload | ChannelPayload | MutePayload;
}

/** Power control payload */
export interface PowerPayload {
  state: 'on' | 'off' | 'toggle';
}

/** Input selection payload */
export interface InputPayload {
  /** Platform-native input name */
  input: string;
}

/** Volume level payload */
export interface VolumePayload {
  /** Volume level from 0 to 100 */
  level: number;
}

/** Channel selection payload */
export interface ChannelPayload {
  channelNumber: string;
}

/** Mute toggle payload */
export interface MutePayload {
  muted: boolean;
}

/** Normalized state returned by all adapters — platform details are stripped */
export interface NormalizedEndpointState {
  platformEndpointId: string;
  displayName: string;
  isPoweredOn: boolean | null;
  currentInput: string | null;
  currentChannelNumber: string | null;
  /** Volume level from 0 to 100, or null if unsupported */
  volumeLevel: number | null;
  isMuted: boolean | null;
  /** Preserved for debugging; not exposed to end users */
  rawPlatformData?: unknown;
}

/** Discovered endpoint metadata returned during polling */
export interface DiscoveredEndpoint {
  platformEndpointId: string;
  displayName: string;
  /** Device type identifier (e.g., 'tv', 'display', 'projector') */
  deviceType: string;
  capabilities: ControlCommandType[];
  availableInputs: string[];
}

/** Connection config shape — concrete per-platform, but bridge stores as unknown */
export interface PlatformConnectionConfig {
  /** Must match the adapter registry slug */
  platform: string;
  [key: string]: unknown;
}

/**
 * The contract every platform adapter must fulfill.
 * Implement this interface for each new platform (VisionEdge, SITO, etc.)
 */
export interface IPlatformAdapter {
  /** Human-readable platform name */
  readonly platformName: string;
  /** Unique slug used in DB and config (e.g., 'visionedge') */
  readonly platformSlug: string;

  /** Test connectivity with stored credentials. Throws on failure. */
  testConnection(): Promise<void>;

  /** Fetch all discoverable endpoints from the platform */
  discoverEndpoints(): Promise<DiscoveredEndpoint[]>;

  /** Fetch and normalize current state for a single endpoint */
  getEndpointState(platformEndpointId: string): Promise<NormalizedEndpointState>;

  /** Send a control command. Returns updated state after command. */
  sendCommand(command: ControlCommand): Promise<NormalizedEndpointState>;

  /** Optional: Fetch platform-native channel list */
  discoverChannels?(): Promise<Array<{ channelNumber: string; displayName: string }>>;
}
