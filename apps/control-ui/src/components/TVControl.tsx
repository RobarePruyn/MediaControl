/**
 * TV control panel for a single endpoint.
 * Power, input selection, volume, and channel controls.
 * @module control-ui/components/TVControl
 */

import { useState } from 'react';
import { Power, Volume2, VolumeX, ChevronUp, ChevronDown } from 'lucide-react';
import type { Endpoint, ControlCommandRequest } from '@suitecommand/types';
import { VolumeSlider } from './VolumeSlider.js';
import './TVControl.css';

interface TVControlProps {
  endpoint: Endpoint;
  onCommand: (cmd: ControlCommandRequest) => Promise<void>;
  disabled?: boolean;
}

export function TVControl({ endpoint, onCommand, disabled }: TVControlProps) {
  const state = endpoint.currentState;
  const [sending, setSending] = useState(false);

  const send = async (cmd: ControlCommandRequest) => {
    if (sending || disabled) return;
    setSending(true);
    try {
      await onCommand(cmd);
    } finally {
      setSending(false);
    }
  };

  const powerToggle = () =>
    send({ endpointId: endpoint.id, commandType: 'POWER', payload: { state: 'toggle' } });

  const volumeChange = (level: number) =>
    send({ endpointId: endpoint.id, commandType: 'VOLUME', payload: { level } });

  const muteToggle = () =>
    send({
      endpointId: endpoint.id,
      commandType: 'MUTE',
      payload: { muted: !state?.isMuted },
    });

  const channelUp = () => {
    const current = parseInt(state?.currentChannelNumber ?? '0', 10);
    send({
      endpointId: endpoint.id,
      commandType: 'CHANNEL',
      payload: { channelNumber: String(current + 1) },
    });
  };

  const channelDown = () => {
    const current = parseInt(state?.currentChannelNumber ?? '0', 10);
    if (current > 1) {
      send({
        endpointId: endpoint.id,
        commandType: 'CHANNEL',
        payload: { channelNumber: String(current - 1) },
      });
    }
  };

  const isPoweredOn = state?.isPoweredOn !== false;

  return (
    <div className={`tv-control ${!isPoweredOn ? 'tv-off' : ''}`}>
      <div className="tv-header">
        <span className="tv-name">{endpoint.displayName}</span>
        <button
          className={`tv-power-btn ${isPoweredOn ? 'tv-power-on' : ''}`}
          onClick={powerToggle}
          disabled={disabled || sending}
          title="Toggle Power"
        >
          <Power size={18} />
        </button>
      </div>

      {isPoweredOn && (
        <div className="tv-controls">
          <div className="tv-channel-section">
            <span className="tv-label">Channel</span>
            <div className="tv-channel-controls">
              <button className="tv-ch-btn" onClick={channelUp} disabled={disabled || sending}>
                <ChevronUp size={20} />
              </button>
              <span className="tv-channel-number">{state?.currentChannelNumber ?? '—'}</span>
              <button className="tv-ch-btn" onClick={channelDown} disabled={disabled || sending}>
                <ChevronDown size={20} />
              </button>
            </div>
          </div>

          <div className="tv-volume-section">
            <div className="tv-volume-header">
              <span className="tv-label">Volume</span>
              <button
                className={`tv-mute-btn ${state?.isMuted ? 'tv-muted' : ''}`}
                onClick={muteToggle}
                disabled={disabled || sending}
                title={state?.isMuted ? 'Unmute' : 'Mute'}
              >
                {state?.isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            </div>
            <VolumeSlider
              value={state?.volumeLevel ?? 50}
              onChange={volumeChange}
              disabled={disabled || sending || !!state?.isMuted}
            />
          </div>
        </div>
      )}
    </div>
  );
}
