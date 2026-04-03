/**
 * VisionEdge platform adapter — Cisco Vision Director IPTV control.
 * Implements IPlatformAdapter against the CVD Local Control API 3.0.
 *
 * The CVD API is XML-based with PIN-based HTTP Basic Auth. Players (DMPs)
 * are the controllable endpoints, organized into suites (control groups).
 * Commands are sent via GET (single player) or POST with XML target (multi-player).
 *
 * @module bridge-agent/adapters/visionedge/VisionEdgeAdapter
 */

import type {
  ControlCommand,
  ControlCommandType,
  DiscoveredEndpoint,
  NormalizedEndpointState,
  PlatformConnectionConfig,
} from '@suitecommand/types';

import { BasePlatformAdapter } from '../AdapterInterface.js';
import { createVisionEdgeClient, buildTargetXml } from './visionEdgeClient.js';
import type {
  VisionEdgeConnectionConfig,
  VEControlGroup,
  VEPlayer,
  VEPlayerFeatures,
  VEPlayerInputs,
  VEPlayerStatus,
  VEChannel,
  VEFeature,
} from './visionEdgeTypes.js';

/**
 * Map CVD feature names to our canonical ControlCommandType.
 * Used during endpoint discovery to report capabilities.
 */
function mapFeatureToCommandType(feature: VEFeature): ControlCommandType | null {
  switch (feature) {
    case 'POWER_STATE': return 'POWER';
    case 'VIDEO_INPUT': return 'INPUT';
    case 'VOLUME_CHANGE_ABSOLUTE':
    case 'VOLUME_CHANGE_RELATIVE': return 'VOLUME';
    case 'CHANNEL_CHANGE_ABSOLUTE':
    case 'CHANNEL_CHANGE_RELATIVE': return 'CHANNEL';
    case 'MUTING':
    case 'UNMUTING':
    case 'MUTING_TOGGLE': return 'MUTE';
    default: return null;
  }
}

/**
 * WiPro VisionEdge / Cisco Vision Director adapter.
 * Communicates with CVD's Local Control REST API (XML over HTTPS, PIN auth).
 */
export class VisionEdgeAdapter extends BasePlatformAdapter {
  readonly platformName = 'WiPro VisionEdge';
  readonly platformSlug = 'visionedge';

  private client: ReturnType<typeof createVisionEdgeClient>;

  /** Typed access to the VisionEdge-specific connection config */
  private get veConfig(): VisionEdgeConnectionConfig {
    return this.connectionConfig as VisionEdgeConnectionConfig;
  }

  constructor(connectionConfig: PlatformConnectionConfig) {
    super(connectionConfig);
    this.client = createVisionEdgeClient(this.veConfig);
  }

  /**
   * Test connectivity to the CVD server.
   * Queries the accessible control groups — if the PIN is valid, this returns 200.
   */
  async testConnection(): Promise<void> {
    const { pin, baseUrl } = this.veConfig;
    if (!baseUrl || !pin) {
      throw new Error('VisionEdge connection config missing baseUrl or pin');
    }
    // Attempt to list groups — validates both network connectivity and PIN auth
    await this.client.get('config/group');
  }

  /**
   * Discover all players (endpoints) accessible by the configured PIN.
   * Also fetches per-player features and available A/V inputs.
   */
  async discoverEndpoints(): Promise<DiscoveredEndpoint[]> {
    // 1. Fetch all accessible players
    const { data: playersData } = await this.client.get<{
      players?: { player?: VEPlayer[] };
    }>('config/player');

    const players = playersData.players?.player ?? [];
    if (players.length === 0) return [];

    // 2. Fetch features for all players in parallel
    const { data: featuresData } = await this.client.get<{
      playerFeatures?: { playerFeature?: VEPlayerFeatures[] };
    }>('config/features/player');

    const featuresMap = new Map<string, VEPlayerFeatures>();
    for (const pf of featuresData.playerFeatures?.playerFeature ?? []) {
      featuresMap.set(String(pf.id), pf);
    }

    // 3. Fetch inputs for all players
    const { data: inputsData } = await this.client.get<{
      playerInputsList?: { playerInputs?: VEPlayerInputs[] };
    }>('config/inputs/player');

    const inputsMap = new Map<string, string[]>();
    for (const pi of inputsData.playerInputsList?.playerInputs ?? []) {
      // XML parses as <inputs><input>...</input></inputs> → { input: [...] }
      const rawInputs = pi.inputs?.input ?? [];
      inputsMap.set(
        String(pi.id),
        rawInputs.map((inp) => inp.name),
      );
    }

    // 4. Map to normalized DiscoveredEndpoint
    return players.map((player) => {
      const playerId = String(player.id);
      const features = featuresMap.get(playerId);
      const capabilities = new Set<ControlCommandType>();

      // XML parses as <features><feature>X</feature></features> — may be array or wrapper object
      const rawFeatures = features?.features;
      const featureList: VEFeature[] = Array.isArray(rawFeatures)
        ? rawFeatures
        : (rawFeatures as { feature?: VEFeature[] } | undefined)?.feature ?? [];
      for (const feat of featureList) {
        const cmd = mapFeatureToCommandType(String(feat) as VEFeature);
        if (cmd) capabilities.add(cmd);
      }

      return {
        platformEndpointId: playerId,
        displayName: player.name || `Player ${playerId}`,
        deviceType: player.model?.toLowerCase().includes('dmp') ? 'dmp' : 'tv',
        capabilities: [...capabilities],
        availableInputs: inputsMap.get(playerId) ?? [],
      };
    });
  }

  /**
   * Fetch the current state of a single player.
   * Uses GET status/player/{id} which returns the last-known snapshot (polled ~5 min by CVD).
   */
  async getEndpointState(platformEndpointId: string): Promise<NormalizedEndpointState> {
    const { data } = await this.client.get<{
      playerStatusList?: { playerStatus?: VEPlayerStatus[] };
    }>(`status/player/${platformEndpointId}`);

    const statuses = data.playerStatusList?.playerStatus ?? [];
    const status = statuses.find((s) => String(s.id) === platformEndpointId);

    return this.normalizeStatus(platformEndpointId, status);
  }

  /**
   * Fetch current state for all players in a single API call.
   * Much more efficient than calling getEndpointState per-player.
   */
  async getAllEndpointStates(): Promise<NormalizedEndpointState[]> {
    const { data } = await this.client.get<{
      playerStatusList?: { playerStatus?: VEPlayerStatus[] };
    }>('status/player');

    const statuses = data.playerStatusList?.playerStatus ?? [];
    return statuses.map((s) => this.normalizeStatus(String(s.id), s));
  }

  /**
   * Send a control command to a CVD player via the GET API flavor.
   * After the command, fetches updated state and returns it.
   */
  async sendCommand(command: ControlCommand): Promise<NormalizedEndpointState> {
    const playerId = command.platformEndpointId;
    const path = this.buildCommandPath(command);

    await this.client.command(path);

    // Fetch updated state after a brief delay (CVD commands are async)
    await new Promise((resolve) => setTimeout(resolve, 500));

    return this.getEndpointState(playerId);
  }

  /**
   * Discover the channel guide for the first accessible control group,
   * or the group specified in the connection config.
   */
  async discoverChannels(): Promise<Array<{ channelNumber: string; displayName: string }>> {
    // Determine which group to pull channels from
    let groupId = this.veConfig.groupId;

    if (!groupId) {
      // Default to first accessible group
      const { data: groupsData } = await this.client.get<{
        controlgroups?: { controlgroup?: VEControlGroup[] };
      }>('config/group');

      const groups = groupsData.controlgroups?.controlgroup ?? [];
      if (groups.length === 0) return [];
      groupId = String(groups[0].id);
    }

    const { data } = await this.client.get<{
      channels?: { name?: string; channel?: VEChannel[] };
    }>(`channel/guide/${groupId}`);

    const channels = data.channels?.channel ?? [];

    return channels.map((ch) => ({
      channelNumber: String(ch.logicalChannel),
      displayName: ch.name || ch.shortName || ch.longName || `Ch ${ch.logicalChannel}`,
      logoUrl: ch.logoSmall || ch.logoMedium || ch.logoLarge || undefined,
    }));
  }

  /**
   * Normalize a CVD player status into the platform-agnostic shape.
   * Handles missing fields gracefully — CVD omits fields when state is unknown.
   */
  private normalizeStatus(
    platformEndpointId: string,
    status?: VEPlayerStatus,
  ): NormalizedEndpointState {
    return {
      platformEndpointId,
      displayName: `Player ${platformEndpointId}`,
      isPoweredOn: status?.power ? status.power === 'on' : null,
      currentInput: status?.input ?? null,
      currentChannelNumber: status?.channel ? String(status.channel) : null,
      volumeLevel: status?.volume != null ? Number(status.volume) : null,
      isMuted: status?.muting ? status.muting === 'on' : null,
      rawPlatformData: status ?? undefined,
    };
  }

  /**
   * Build the CVD REST path for a control command.
   * Uses the HTTP GET flavor (single player target in the URL).
   */
  private buildCommandPath(command: ControlCommand): string {
    const playerId = command.platformEndpointId;
    const base = 'control/player';

    switch (command.commandType) {
      case 'POWER': {
        const payload = command.payload as { state: 'on' | 'off' | 'toggle' };
        // CVD doesn't have toggle — we must query state first
        if (payload.state === 'toggle') {
          // Default to 'on' — caller should pre-resolve toggle before calling
          return `${base}/power/on/${playerId}`;
        }
        return `${base}/power/${payload.state}/${playerId}`;
      }

      case 'CHANNEL': {
        const payload = command.payload as { channelNumber: string };
        return `${base}/channel/${payload.channelNumber}/${playerId}`;
      }

      case 'VOLUME': {
        const payload = command.payload as { level: number };
        const level = Math.max(0, Math.min(100, Math.round(payload.level)));
        return `${base}/volume/${level}/${playerId}`;
      }

      case 'MUTE': {
        const payload = command.payload as { muted: boolean };
        return `${base}/muting/${payload.muted ? 'on' : 'off'}/${playerId}`;
      }

      case 'INPUT': {
        const payload = command.payload as { input: string };
        // The input value from CVD uses the numeric value, not the name
        return `${base}/input/${payload.input}/${playerId}`;
      }

      default:
        throw new Error(`Unsupported command type: ${command.commandType}`);
    }
  }
}
