/**
 * WebSocket hook for real-time endpoint state updates.
 * Connects to the control WebSocket and dispatches state changes.
 * @module control-ui/api/useWebSocket
 */

import { useEffect, useRef, useCallback } from 'react';
import type { NormalizedEndpointState } from '@suitecommand/types';

interface WsOptions {
  groupToken: string;
  onStateUpdate: (endpointId: string, state: NormalizedEndpointState) => void;
  onTokenExpired?: () => void;
  enabled?: boolean;
}

const HEARTBEAT_INTERVAL_MS = 25_000;
const RECONNECT_DELAY_MS = 3_000;
const MAX_RECONNECT_ATTEMPTS = 10;

export function useWebSocket({ groupToken, onStateUpdate, onTokenExpired, enabled = true }: WsOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const connect = useCallback(() => {
    if (!enabled || !groupToken) return;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws/control/${groupToken}`);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttempts.current = 0;
      heartbeatTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'PING' }));
        }
      }, HEARTBEAT_INTERVAL_MS);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'STATE_UPDATE' && msg.endpointId && msg.state) {
          onStateUpdate(msg.endpointId, msg.state);
        } else if (msg.type === 'TOKEN_EXPIRED') {
          onTokenExpired?.();
        }
      } catch { /* ignore parse errors */ }
    };

    ws.onclose = () => {
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
      if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS && enabled) {
        reconnectAttempts.current++;
        setTimeout(connect, RECONNECT_DELAY_MS);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [groupToken, onStateUpdate, onTokenExpired, enabled]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
    };
  }, [connect]);
}
