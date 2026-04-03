/**
 * Channels management page.
 * Lists channels, sync from controllers, and reorder.
 * Venue ID is derived from the URL route parameter.
 * @module admin-ui/pages/ChannelsPage
 */

import { useState, useEffect, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  useChannels,
  useCreateChannel,
  useUpdateChannel,
  useDeleteChannel,
  useSyncChannels,
  useControllers,
} from '../api/hooks.js';
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import type { Channel } from '@suitecommand/types';
import './pages.css';

export function ChannelsPage() {
  const { venueId } = useParams<{ venueId: string }>();

  const { data: channels, isLoading } = useChannels(venueId!);
  const { data: controllers } = useControllers(venueId!);
  const createChannel = useCreateChannel(venueId!);
  const syncChannels = useSyncChannels(venueId!);
  const updateChannel = useUpdateChannel(venueId!);
  const deleteChannel = useDeleteChannel(venueId!);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Channel | null>(null);
  const [syncControllerId, setSyncControllerId] = useState('');

  const [editDisplayName, setEditDisplayName] = useState('');
  const [editLogoUrl, setEditLogoUrl] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  useEffect(() => {
    if (editing) {
      setEditDisplayName(editing.displayName);
      setEditLogoUrl(editing.logoUrl || '');
      setEditCategory(editing.category || '');
      setEditIsActive(editing.isActive);
    }
  }, [editing]);

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    await updateChannel.mutateAsync({
      id: editing!.id,
      displayName: editDisplayName,
      logoUrl: editLogoUrl || undefined,
      category: editCategory || undefined,
      isActive: editIsActive,
    });
    setEditing(null);
  };

  const [displayName, setDisplayName] = useState('');
  const [channelNumber, setChannelNumber] = useState('');
  const [platformChannelId, setPlatformChannelId] = useState('');

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    await createChannel.mutateAsync({
      displayName,
      channelNumber,
      platformChannelId: platformChannelId || channelNumber,
      venueId: venueId!,
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
          <option value="">Select connection to sync...</option>
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
        <p className="empty-text">No channels configured. Add manually or sync from a connection.</p>
      ) : (
        <div className="data-table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Category</th>
                <th>Source</th>
                <th>Status</th>
                <th>Logo</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((ch) => (
                <tr key={ch.id}>
                  <td>{ch.channelNumber}</td>
                  <td>{ch.displayName}</td>
                  <td>{ch.category || '—'}</td>
                  <td>
                    <span className={`badge ${ch.source === 'synced' ? 'badge-info' : 'badge-warning'}`}>
                      {ch.source ?? 'manual'}
                    </span>
                  </td>
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
                  <td>
                    <div className="row-actions">
                      <button className="btn-ghost" onClick={() => setEditing(ch)} title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button className="btn-ghost" onClick={() => deleteChannel.mutate(ch.id)} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
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
      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Edit Channel</h3>
            <form onSubmit={handleEdit}>
              <div className="form-group">
                <label>Display Name</label>
                <input value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} required autoFocus />
              </div>
              <div className="form-group">
                <label>Logo URL (optional)</label>
                <input value={editLogoUrl} onChange={(e) => setEditLogoUrl(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Category (optional)</label>
                <input value={editCategory} onChange={(e) => setEditCategory(e.target.value)} />
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    style={{ width: 'auto' }}
                  />
                  Active
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={updateChannel.isPending}>
                  {updateChannel.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
