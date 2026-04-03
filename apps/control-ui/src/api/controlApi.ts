/**
 * API client for the control UI.
 * Fetches group config and sends control commands.
 * @module control-ui/api/controlApi
 */

import type { GroupControlConfig, ControlCommandRequest, ControlCommandResponse } from '@suitecommand/types';

const API_BASE = '/api';

/** Fetch group configuration, endpoints, and branding */
export async function fetchGroupConfig(groupToken: string): Promise<GroupControlConfig> {
  const res = await fetch(`${API_BASE}/control/${groupToken}`);
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message ?? `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data.data as GroupControlConfig;
}

/** Send a control command to an endpoint */
export async function sendCommand(
  groupToken: string,
  command: ControlCommandRequest,
): Promise<ControlCommandResponse> {
  const res = await fetch(`${API_BASE}/control/${groupToken}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `Command failed (${res.status})`);
  }
  return data.data as ControlCommandResponse;
}
