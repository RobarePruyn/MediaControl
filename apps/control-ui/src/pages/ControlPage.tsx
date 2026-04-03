/**
 * Main control page for end-user device interaction.
 * Loaded via /control/:groupToken from a QR code or direct link.
 * @module control-ui/pages/ControlPage
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { fetchGroupConfig, sendCommand } from '../api/controlApi.js';
import { useWebSocket } from '../api/useWebSocket.js';
import { BrandingProvider } from '../components/BrandingProvider.js';
import { TVControl } from '../components/TVControl.js';
import { ChannelGrid } from '../components/ChannelGrid.js';
import type { GroupControlConfig, ControlCommandRequest } from '@suitecommand/types';
import type { NormalizedEndpointState, Endpoint } from '@suitecommand/types';
import './ControlPage.css';

export function ControlPage() {
  const { groupToken } = useParams<{ groupToken: string }>();
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get('embed') === 'true';

  const [config, setConfig] = useState<GroupControlConfig | null>(null);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState<string | null>(null);

  useEffect(() => {
    if (!groupToken) return;
    setLoading(true);
    fetchGroupConfig(groupToken)
      .then((cfg) => {
        setConfig(cfg);
        setEndpoints(cfg.endpoints as Endpoint[]);
        if (cfg.endpoints.length > 0) {
          setSelectedEndpoint(cfg.endpoints[0].id);
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.message.includes('expired')) {
          setTokenExpired(true);
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load controls');
        }
      })
      .finally(() => setLoading(false));
  }, [groupToken]);

  const handleStateUpdate = useCallback((endpointId: string, state: NormalizedEndpointState) => {
    setEndpoints((prev) =>
      prev.map((ep) =>
        ep.id === endpointId
          ? {
              ...ep,
              currentState: {
                isPoweredOn: state.isPoweredOn,
                currentInput: state.currentInput,
                currentChannelNumber: state.currentChannelNumber,
                volumeLevel: state.volumeLevel,
                isMuted: state.isMuted,
              },
            }
          : ep,
      ),
    );
  }, []);

  useWebSocket({
    groupToken: groupToken || '',
    onStateUpdate: handleStateUpdate,
    onTokenExpired: () => setTokenExpired(true),
    enabled: !!groupToken && !!config && !tokenExpired,
  });

  const handleCommand = async (cmd: ControlCommandRequest) => {
    if (!groupToken) return;
    await sendCommand(groupToken, cmd);
  };

  const handleChannelSelect = (channelNumber: string) => {
    if (!selectedEndpoint || !groupToken) return;
    sendCommand(groupToken, {
      endpointId: selectedEndpoint,
      commandType: 'CHANNEL',
      payload: { channelNumber },
    });
  };

  if (loading) {
    return (
      <div className="control-loading">
        <div className="control-spinner" />
        <p>Loading controls...</p>
      </div>
    );
  }

  if (tokenExpired) {
    return (
      <div className="control-error">
        <h2>Access Expired</h2>
        <p>This control link has expired. Please scan the latest QR code or request a new link.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="control-error">
        <h2>Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!config) return null;

  const currentEndpoint = endpoints.find((e) => e.id === selectedEndpoint);

  return (
    <BrandingProvider branding={config.branding}>
      <div className={`control-page ${isEmbed ? 'control-embed' : ''}`}>
        {!isEmbed && (
          <header className="control-header">
            {config.branding?.logoUrl && (
              <img src={config.branding.logoUrl} alt="" className="control-logo" />
            )}
            <h1 className="control-title">{config.group.name}</h1>
          </header>
        )}

        {endpoints.length > 1 && (
          <div className="control-endpoint-tabs">
            {endpoints.map((ep) => (
              <button
                key={ep.id}
                className={`control-tab ${ep.id === selectedEndpoint ? 'control-tab-active' : ''}`}
                onClick={() => setSelectedEndpoint(ep.id)}
              >
                {ep.displayName}
              </button>
            ))}
          </div>
        )}

        {currentEndpoint && (
          <TVControl
            endpoint={currentEndpoint}
            onCommand={handleCommand}
          />
        )}

        {config.channels.length > 0 && (
          <section className="control-channels">
            <h2 className="control-section-title">Channels</h2>
            <ChannelGrid
              channels={config.channels as any}
              currentChannel={currentEndpoint?.currentState?.currentChannelNumber ?? null}
              onSelect={handleChannelSelect}
            />
          </section>
        )}
      </div>
    </BrandingProvider>
  );
}
