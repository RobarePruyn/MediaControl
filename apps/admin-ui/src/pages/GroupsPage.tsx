/**
 * Groups management page.
 * CRUD for suites/rooms/zones with access token management.
 * @module admin-ui/pages/GroupsPage
 */

import { useState, type FormEvent } from 'react';
import {
  useGroups,
  useCreateGroup,
  useDeleteGroup,
  useGroupTokens,
  useCreateGroupToken,
  useRotateGroupToken,
  useRevokeGroupToken,
  useVenues,
} from '../api/hooks.js';
import { Plus, Key, Trash2, RefreshCw, Copy } from 'lucide-react';
import type { AccessTier, GroupAccessToken } from '@suitecommand/types';
import './pages.css';

export function GroupsPage() {
  const { data: groups, isLoading } = useGroups();
  const { data: venues } = useVenues();
  const createGroup = useCreateGroup();
  const deleteGroup = useDeleteGroup();
  const [showCreate, setShowCreate] = useState(false);
  const [tokenGroupId, setTokenGroupId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<'suite' | 'room' | 'zone' | 'boh'>('suite');
  const [venueId, setVenueId] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    await createGroup.mutateAsync({
      name,
      type,
      venueId: venueId || venues?.[0]?.id || '',
      description: description || undefined,
    });
    setShowCreate(false);
    setName('');
    setDescription('');
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Groups</h2>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Add Group
        </button>
      </div>

      {isLoading ? (
        <p className="empty-text">Loading...</p>
      ) : !groups?.length ? (
        <p className="empty-text">No groups created yet.</p>
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
              {groups.map((g) => (
                <tr key={g.id}>
                  <td>{g.name}</td>
                  <td><span className="badge badge-info">{g.type}</span></td>
                  <td>{g.description || '—'}</td>
                  <td>
                    <div className="row-actions">
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
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Add Group</h3>
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

      {tokenGroupId && (
        <TokenModal groupId={tokenGroupId} onClose={() => setTokenGroupId(null)} />
      )}
    </div>
  );
}

function TokenModal({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const { data: tokens, isLoading } = useGroupTokens(groupId);
  const createToken = useCreateGroupToken();
  const rotateToken = useRotateGroupToken();
  const revokeToken = useRevokeGroupToken();
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
