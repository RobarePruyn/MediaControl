/**
 * Channel picker grid.
 * Displays available channels as a tappable grid with logos.
 * @module control-ui/components/ChannelGrid
 */

import type { Channel } from '@suitecommand/types';
import './ChannelGrid.css';

interface ChannelGridProps {
  channels: Channel[];
  currentChannel: string | null;
  onSelect: (channelNumber: string) => void;
  disabled?: boolean;
}

export function ChannelGrid({ channels, currentChannel, onSelect, disabled }: ChannelGridProps) {
  if (!channels.length) {
    return <p className="cg-empty">No channels available.</p>;
  }

  return (
    <div className="channel-grid">
      {channels
        .filter((ch) => ch.isActive)
        .map((ch) => (
          <button
            key={ch.id}
            className={`channel-tile ${ch.channelNumber === currentChannel ? 'channel-active' : ''}`}
            onClick={() => onSelect(ch.channelNumber)}
            disabled={disabled}
            title={ch.displayName}
          >
            {ch.logoUrl ? (
              <img src={ch.logoUrl} alt={ch.displayName} className="channel-logo" />
            ) : (
              <span className="channel-number">{ch.channelNumber}</span>
            )}
            <span className="channel-name">{ch.displayName}</span>
          </button>
        ))}
    </div>
  );
}
