/**
 * Controllers management page.
 * Controllers are user-facing control interfaces (suites/rooms/zones)
 * where endpoints are aggregated for guest or staff control via QR code.
 * @module admin-ui/pages/ControllersPage
 */

import { useState, useEffect, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  useGroups,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
  useGroupTokens,
  useCreateGroupToken,
  useRotateGroupToken,
  useRevokeGroupToken,
} from '../api/hooks.js';
import { Plus, Pencil, Key, Trash2, RefreshCw, Copy } from 'lucide-react';
import type { AccessTier, Group, GroupAccessToken } from '@suitecommand/types';
import './pages.css';

export function ControllersPage() {
  const { venueId } = useParams<{ venueId: string }>();

  const { data: groups, isLoading } = useGroups(venueId!);
  const createGroup = useCreateGroup(venueId!);
  const deleteGroup = useDeleteGroup(venueId!);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [tokenGroupId, setTokenGroupId] = useState<string | null>(null);

  const updateGroup = useUpdateGroup(venueId!, editing?.id ?? '');

  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<'suite' | 'room' | 'zone' | 'boh'>('suite');
  const [editDescription, setEditDescription] = useState('');

  useEffect(() => {
    if (editing) {
      setEditName(editing.name);
      setEditType(editing.type as 'suite' | 'room' | 'zone' | 'boh');
      setEditDescription(editing.description || '');
    }
  }, [editing]);

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    await updateGroup.mutateAsync({
      name: editName,
      type: editType,
      description: editDescription || undefined,
    });
    setEditing(null);
  };

  const [search, setSearch] = useState('');

  const [name, setName] = useState('');
  const [type, setType] = useState<'suite' | 'room' | 'zone' | 'boh'>('suite');
  const [description, setDescription] = useState('');

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    await createGroup.mutateAsync({
      name,
      type,
      venueId: venueId!,
      description: description || undefined,
    });
    setShowCreate(false);
    setName('');
    setDescription('');
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Controllers</h2>
        <div className="page-actions">
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Add Controller
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search controllers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 200 }}
        />
      </div>

      {isLoading ? (
        <p className="empty-text">Loading...</p>
      ) : !groups?.length ? (
        <p className="empty-text">No controllers created yet. Add one to set up a control page for a suite or zone.</p>
      ) : (() => {
        const searchLower = search.toLowerCase();
        const filtered = groups.filter((g) =>
          !search ||
          g.name.toLowerCase().includes(searchLower) ||
          g.type.toLowerCase().includes(searchLower) ||
          (g.description || '').toLowerCase().includes(searchLower)
        );
        return !filtered.length ? (
          <p className="empty-text">No controllers match your search.</p>
        ) : (
        <div className="data-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <tr key={g.id}>
                  <td>{g.name}</td>
                  <td><span className="badge badge-info">{g.type}</span></td>
                  <td>{g.description || '—'}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn-ghost" onClick={() => setEditing(g)} title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button className="btn-ghost" onClick={() => setTokenGroupId(g.id)} title="Manage Tokens">
                        <Key size={14} />
                      </button>
                      <button className="btn-ghost" onClick={() => deleteGroup.mutate(g.id)} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        );
      })()}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Add Controller</h3>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
              </div>
              <div className="form-group">
                <label>Type</label>
                <select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
                  <option value="suite">Suite</option>
                  <option value="room">Room</option>
                  <option value="zone">Zone</option>
                  <option value="boh">Back of House</option>
                </select>
              </div>
              <div className="form-group">
                <label>Description (optional)</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={createGroup.isPending}>
                  {createGroup.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Edit Controller</h3>
            <form onSubmit={handleEdit}>
              <div className="form-group">
                <label>Name</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} required autoFocus />
              </div>
              <div className="form-group">
                <label>Type</label>
                <select value={editType} onChange={(e) => setEditType(e.target.value as typeof editType)}>
                  <option value="suite">Suite</option>
                  <option value="room">Room</option>
                  <option value="zone">Zone</option>
                  <option value="boh">Back of House</option>
                </select>
              </div>
              <div className="form-group">
                <label>Description (optional)</label>
                <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={updateGroup.isPending}>
                  {updateGroup.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {tokenGroupId && (
        <TokenModal venueId={venueId!} groupId={tokenGroupId} onClose={() => setTokenGroupId(null)} />
      )}
    </div>
  );
}

function TokenModal({ venueId, groupId, onClose }: { venueId: string; groupId: string; onClose: () => void }) {
  const { data: tokens, isLoading } = useGroupTokens(venueId, groupId);
  const createToken = useCreateGroupToken(venueId);
  const rotateToken = useRotateGroupToken(venueId);
  const revokeToken = useRevokeGroupToken(venueId);
  const [tier, setTier] = useState<AccessTier>('event');

  const handleCreate = async () => {
    await createToken.mutateAsync({ groupId, accessTier: tier });
  };

  const copyUrl = (token: GroupAccessToken) => {
    const url = `${window.location.origin}/control/${token.token}`;
    navigator.clipboard.writeText(url);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 600 }}>
        <h3 className="modal-title">Access Tokens</h3>

        <div className="filter-bar" style={{ marginBottom: '1rem' }}>
          <select value={tier} onChange={(e) => setTier(e.target.value as AccessTier)}>
            <option value="event">Event</option>
            <option value="seasonal">Seasonal</option>
            <option value="permanent">Permanent</option>
          </select>
          <button className="btn-primary" onClick={handleCreate} disabled={createToken.isPending}>
            <Plus size={14} /> Create Token
          </button>
        </div>

        {isLoading ? (
          <p className="empty-text">Loading...</p>
        ) : !tokens?.length ? (
          <p className="empty-text">No access tokens for this group.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Token</th>
                <th>Tier</th>
                <th>Status</th>
                <th>Valid Until</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((t) => (
                <tr key={t.id}>
                  <td><code>{t.token.slice(0, 12)}...</code></td>
                  <td><span className="badge badge-info">{t.accessTier}</span></td>
                  <td>
                    {t.isActive ? (
                      <span className="badge badge-success">active</span>
                    ) : (
                      <span className="badge badge-danger">revoked</span>
                    )}
                  </td>
                  <td>{t.validUntil ? new Date(t.validUntil).toLocaleString() : 'No expiry'}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn-ghost" onClick={() => copyUrl(t)} title="Copy URL">
                        <Copy size={14} />
                      </button>
                      {t.isActive && (
                        <>
                          <button className="btn-ghost" onClick={() => rotateToken.mutate({ groupId, tokenId: t.id })} title="Rotate">
                            <RefreshCw size={14} />
                          </button>
                          <button className="btn-ghost" onClick={() => revokeToken.mutate({ groupId, tokenId: t.id })} title="Revoke">
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
