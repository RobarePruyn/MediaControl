/**
 * Channels management page.
 * Lists channels, sync from controllers, and reorder.
 * @module admin-ui/pages/ChannelsPage
 */

import { useState, type FormEvent } from 'react';
import {
  useChannels,
  useCreateChannel,
  useSyncChannels,
  useControllers,
  useVenues,
} from '../api/hooks.js';
import { Plus, RefreshCw } from 'lucide-react';
import './pages.css';

export function ChannelsPage() {
  const { data: channels, isLoading } = useChannels();
  const { data: controllers } = useControllers();
  const { data: venues } = useVenues();
  const createChannel = useCreateChannel();
  const syncChannels = useSyncChannels();
  const [showCreate, setShowCreate] = useState(false);
  const [syncControllerId, setSyncControllerId] = useState('');

  const [displayName, setDisplayName] = useState('');
  const [channelNumber, setChannelNumber] = useState('');
  const [platformChannelId, setPlatformChannelId] = useState('');
  const [venueId, setVenueId] = useState('');

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    await createChannel.mutateAsync({
      displayName,
      channelNumber,
      platformChannelId: platformChannelId || channelNumber,
      venueId: venueId || venues?.[0]?.id || '',
    });
    setShowCreate(false);
    setDisplayName('');
    setChannelNumber('');
    setPlatformChannelId('');
  };

  const handleSync = async () => {
    if (!syncControllerId) return;
    await syncChannels.mutateAsync(syncControllerId);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Channels</h2>
        <div className="page-actions">
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Add Channel
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <select value={syncControllerId} onChange={(e) => setSyncControllerId(e.target.value)}>
          <option value="">Select controller to sync...</option>
          {controllers?.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button className="btn-ghost" onClick={handleSync} disabled={!syncControllerId || syncChannels.isPending}>
          <RefreshCw size={14} /> Sync Channels
        </button>
      </div>

      {isLoading ? (
        <p className="empty-text">Loading...</p>
      ) : !channels?.length ? (
        <p className="empty-text">No channels configured. Add manually or sync from a controller.</p>
      ) : (
        <div className="data-table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Category</th>
                <th>Status</th>
                <th>Logo</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((ch) => (
                <tr key={ch.id}>
                  <td>{ch.channelNumber}</td>
                  <td>{ch.displayName}</td>
                  <td>{ch.category || '—'}</td>
                  <td>
                    {ch.isActive ? (
                      <span className="badge badge-success">active</span>
                    ) : (
                      <span className="badge badge-danger">inactive</span>
                    )}
                  </td>
                  <td>
                    {ch.logoUrl ? (
                      <img src={ch.logoUrl} alt="" style={{ height: 24, borderRadius: 4 }} />
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Add Channel</h3>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Display Name</label>
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required autoFocus />
              </div>
              <div className="form-group">
                <label>Channel Number</label>
                <input value={channelNumber} onChange={(e) => setChannelNumber(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Platform Channel ID (optional)</label>
                <input value={platformChannelId} onChange={(e) => setPlatformChannelId(e.target.value)} />
              </div>
              {venues && venues.length > 0 && (
                <div className="form-group">
                  <label>Venue</label>
                  <select value={venueId || venues[0]?.id} onChange={(e) => setVenueId(e.target.value)}>
                    {venues.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={createChannel.isPending}>
                  {createChannel.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
