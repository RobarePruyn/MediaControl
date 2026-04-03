/**
 * HTTP client for the WiPro VisionEdge REST API.
 * Thin Axios wrapper that handles authentication headers, base URL,
 * and error normalization. All VisionEdge HTTP calls go through this client.
 * @module bridge-agent/adapters/visionedge/visionEdgeClient
 */

import axios, { type AxiosInstance, type AxiosError } from 'axios';

import type { VisionEdgeConnectionConfig } from './visionEdgeTypes.js';

/**
 * Create a configured Axios instance for a VisionEdge server.
 * @param config - VisionEdge connection configuration
 * @returns Configured Axios instance with auth headers and base URL
 */
export function createVisionEdgeClient(config: VisionEdgeConnectionConfig): AxiosInstance {
  const client = axios.create({
    baseURL: config.baseUrl,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
  });

  // Normalize errors into a consistent shape
  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      const status = error.response?.status;
      const message = error.response?.data
        ? JSON.stringify(error.response.data)
        : error.message;

      throw new Error(
        `VisionEdge API error (HTTP ${status ?? 'unknown'}): ${message}`,
      );
    },
  );

  return client;
}
