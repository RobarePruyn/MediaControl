/**
 * HTTP client for the Cisco Vision Director Local Control API 3.0.
 * Handles PIN-based Basic Auth, XML content negotiation, and response parsing.
 * All CVD HTTP calls go through this client.
 * @module bridge-agent/adapters/visionedge/visionEdgeClient
 */

import axios, { type AxiosInstance, type AxiosError } from 'axios';
import { Agent as HttpsAgent } from 'node:https';
import { XMLParser } from 'fast-xml-parser';

import type { VisionEdgeConnectionConfig } from './visionEdgeTypes.js';

/** Base path for the CVD Local Control REST API */
const API_BASE_PATH = '/sv-openapi/ws/rest/localcontrol';

/** XML parser configured for CVD response shapes */
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  isArray: (tagName) => {
    // These elements should always be arrays even when there's only one child
    const arrayTags = [
      'controlgroup', 'player', 'playerFeature', 'feature',
      'playerInputs', 'input', 'channel', 'playerStatus',
      'closedCaption', 'playerAlbum', 'album',
    ];
    return arrayTags.includes(tagName);
  },
  parseTagValue: true,
  trimValues: true,
});

/**
 * Build a Basic Auth header from a CVD PIN.
 * Per the API docs: base64 of "pin:" (PIN as username, empty password).
 * @param pin - The CVD control PIN
 */
function buildBasicAuth(pin: string): string {
  const encoded = Buffer.from(`${pin}:`).toString('base64');
  return `Basic ${encoded}`;
}

/**
 * Build XML target body for POST commands.
 * @param type - Target type: 'PLAYER' or 'GROUP'
 * @param ids - One or more target IDs
 */
export function buildTargetXml(type: 'PLAYER' | 'GROUP', ids: string[]): string {
  const idElements = ids.map((id) => `<id>${id}</id>`).join('');
  return `<target><type>${type}</type>${idElements}</target>`;
}

/** Parsed response wrapper with raw XML preserved for debugging */
export interface CvdResponse<T> {
  data: T;
  rawXml: string;
}

/**
 * Create a configured HTTP client for a Cisco Vision Director server.
 * @param config - VisionEdge connection configuration with baseUrl and pin
 * @returns Object with typed methods for each API category
 */
export function createVisionEdgeClient(config: VisionEdgeConnectionConfig) {
  // Normalize baseUrl — accept plain IP/FQDN and prepend https:// if no protocol
  const rawUrl = config.baseUrl.trim();
  const baseUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

  const httpClient: AxiosInstance = axios.create({
    baseURL: `${baseUrl.replace(/\/$/, '')}${API_BASE_PATH}`,
    timeout: 15000,
    headers: {
      'Accept': 'application/xml',
      'Authorization': buildBasicAuth(config.pin),
    },
    // CVD may use self-signed certs on-prem
    httpsAgent: new HttpsAgent({ rejectUnauthorized: false }),
  });

  // Normalize errors
  httpClient.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      const status = error.response?.status;
      const body = typeof error.response?.data === 'string'
        ? error.response.data.slice(0, 500)
        : error.message;

      if (status === 401) {
        throw new Error('VisionEdge: Invalid PIN — authentication failed');
      }
      if (status === 403) {
        throw new Error('VisionEdge: PIN not authorized for the requested resource');
      }
      if (status === 404) {
        throw new Error('VisionEdge: Resource not found on the server');
      }

      throw new Error(`VisionEdge API error (HTTP ${status ?? 'unknown'}): ${body}`);
    },
  );

  /**
   * Execute a GET request and parse the XML response.
   * @param path - API path relative to the localcontrol base
   */
  async function get<T>(path: string): Promise<CvdResponse<T>> {
    const response = await httpClient.get(path, { responseType: 'text' });
    const rawXml = response.data as string;
    const parsed = xmlParser.parse(rawXml) as T;
    return { data: parsed, rawXml };
  }

  /**
   * Execute a POST request with an XML body and parse the XML response.
   * @param path - API path relative to the localcontrol base
   * @param xmlBody - XML string to send as the request body
   */
  async function post<T>(path: string, xmlBody: string): Promise<CvdResponse<T>> {
    const response = await httpClient.post(path, xmlBody, {
      headers: { 'Content-Type': 'application/xml' },
      responseType: 'text',
    });
    const rawXml = response.data as string;
    const parsed = xmlParser.parse(rawXml) as T;
    return { data: parsed, rawXml };
  }

  /**
   * Execute a GET command (fire-and-forget style control commands).
   * Returns the parsed <response> element.
   * @param path - Control API path
   */
  async function command(path: string): Promise<{ success: boolean; message?: string }> {
    const { data } = await get<{ response?: { success?: string | boolean; message?: string } }>(path);
    const resp = data.response;
    return {
      success: String(resp?.success) === 'true',
      message: resp?.message,
    };
  }

  return { get, post, command, httpClient };
}

/** Type returned by createVisionEdgeClient */
export type VisionEdgeClient = ReturnType<typeof createVisionEdgeClient>;
