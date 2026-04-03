/**
 * HTTP client for communicating with the Bridge Agent service.
 * All device platform operations (test, discover, command, state) are proxied
 * through the bridge agent. This client handles the internal auth header.
 * @module api-server/services/bridgeClient
 */

import type {
  BridgeCommandRequest,
  ControlCommand,
  DiscoveredEndpoint,
  NormalizedEndpointState,
  PlatformConnectionConfig,
} from '@suitecommand/types';

/** Internal header name for bridge agent authentication */
const INTERNAL_SECRET_HEADER = 'X-Internal-Secret';

/** Response shape from bridge agent endpoints */
interface BridgeResponse<T> {
  success: boolean;
  error?: { code: string; message: string };
  endpoints?: T;
  channels?: T;
  state?: T;
}

/**
 * Client for the Bridge Agent internal API.
 * Handles HTTP calls with the shared internal secret for authentication.
 */
export class BridgeClient {
  private readonly baseUrl: string;
  private readonly secret: string;

  /**
   * @param baseUrl - Bridge agent base URL (e.g., "http://bridge-agent:4001")
   * @param secret - Shared internal secret for authentication
   */
  constructor(baseUrl: string, secret: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.secret = secret;
  }

  /**
   * Test connectivity for a controller's platform credentials.
   * @param controllerId - Controller UUID
   * @param platformSlug - Platform adapter slug
   * @param connectionConfig - Decrypted connection config
   */
  async testConnection(
    controllerId: string,
    platformSlug: string,
    connectionConfig: PlatformConnectionConfig,
  ): Promise<void> {
    const res = await this.post(`/bridge/test/${controllerId}`, {
      platformSlug,
      connectionConfig,
    });

    if (!res.success) {
      throw new Error(res.error?.message ?? 'Connection test failed');
    }
  }

  /**
   * Discover endpoints from a controller's platform.
   * @param controllerId - Controller UUID
   * @param platformSlug - Platform adapter slug
   * @param connectionConfig - Decrypted connection config
   * @returns Array of discovered endpoints
   */
  async discoverEndpoints(
    controllerId: string,
    platformSlug: string,
    connectionConfig: PlatformConnectionConfig,
  ): Promise<DiscoveredEndpoint[]> {
    const res = await this.post<DiscoveredEndpoint[]>(`/bridge/discover/${controllerId}`, {
      platformSlug,
      connectionConfig,
    });

    return res.endpoints ?? [];
  }

  /**
   * Discover channels from a controller's platform.
   * @param controllerId - Controller UUID
   * @param platformSlug - Platform adapter slug
   * @param connectionConfig - Decrypted connection config
   * @returns Array of discovered channels
   */
  async discoverChannels(
    controllerId: string,
    platformSlug: string,
    connectionConfig: PlatformConnectionConfig,
  ): Promise<Array<{ channelNumber: string; displayName: string }>> {
    const res = await this.post<Array<{ channelNumber: string; displayName: string }>>(
      `/bridge/channels/${controllerId}`,
      { platformSlug, connectionConfig },
    );

    return res.channels ?? [];
  }

  /**
   * Fetch current state for all endpoints from a controller in a single call.
   * @param controllerId - Controller UUID
   * @param platformSlug - Platform adapter slug
   * @param connectionConfig - Decrypted connection config
   * @returns Array of normalized endpoint states
   */
  async getAllEndpointStates(
    controllerId: string,
    platformSlug: string,
    connectionConfig: PlatformConnectionConfig,
  ): Promise<NormalizedEndpointState[]> {
    const res = await this.post<NormalizedEndpointState[]>(`/bridge/status/${controllerId}`, {
      platformSlug,
      connectionConfig,
    });

    return (res as unknown as { states?: NormalizedEndpointState[] }).states ?? [];
  }

  /**
   * Get live state for a single endpoint.
   * @param controllerId - Controller UUID
   * @param platformEndpointId - Platform-native endpoint ID
   * @param platformSlug - Platform adapter slug
   * @param connectionConfig - Decrypted connection config
   * @returns Normalized endpoint state
   */
  async getEndpointState(
    controllerId: string,
    platformEndpointId: string,
    platformSlug: string,
    connectionConfig: PlatformConnectionConfig,
  ): Promise<NormalizedEndpointState> {
    const res = await this.post<NormalizedEndpointState>(
      `/bridge/state/${controllerId}/${platformEndpointId}`,
      { platformSlug, connectionConfig },
    );

    if (!res.state) {
      throw new Error('No state returned from bridge agent');
    }

    return res.state;
  }

  /**
   * Execute a control command against an endpoint.
   * @param controllerId - Controller UUID
   * @param command - The control command to execute
   * @param platformSlug - Platform adapter slug
   * @param connectionConfig - Decrypted connection config
   * @returns Updated endpoint state after command execution
   */
  async sendCommand(
    controllerId: string,
    command: ControlCommand,
    platformSlug: string,
    connectionConfig: PlatformConnectionConfig,
  ): Promise<NormalizedEndpointState> {
    const body: BridgeCommandRequest = {
      platformEndpointId: command.platformEndpointId,
      commandType: command.commandType,
      payload: command.payload as unknown as Record<string, unknown>,
      connectionConfig: connectionConfig as Record<string, unknown>,
      platformSlug,
    };

    const res = await this.post<NormalizedEndpointState>(
      `/bridge/command/${controllerId}`,
      body,
    );

    if (!res.state) {
      throw new Error('No state returned from bridge agent');
    }

    return res.state;
  }

  /**
   * Make an authenticated POST request to the bridge agent.
   */
  private async post<T>(path: string, body: unknown): Promise<BridgeResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [INTERNAL_SECRET_HEADER]: this.secret,
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as BridgeResponse<T>;

    if (!response.ok && !data.success) {
      throw new Error(data.error?.message ?? `Bridge agent error: HTTP ${response.status}`);
    }

    return data;
  }
}
