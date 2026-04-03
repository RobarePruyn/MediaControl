/**
 * Venues management page.
 * Lists venues and allows creating new ones.
 * @module admin-ui/pages/VenuesPage
 */

import { useState, type FormEvent } from 'react';
import { useVenues, useCreateVenue } from '../api/hooks.js';
import { Plus } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider.js';
import './pages.css';

export function VenuesPage() {
  const { data: venues, isLoading } = useVenues();
  const createVenue = useCreateVenue();
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    await createVenue.mutateAsync({ name, slug, tenantId: user!.tenantId, timezone });
    setShowCreate(false);
    setName('');
    setSlug('');
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Venues</h2>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Add Venue
        </button>
      </div>

      {isLoading ? (
        <p className="empty-text">Loading...</p>
      ) : !venues?.length ? (
        <p className="empty-text">No venues configured yet.</p>
      ) : (
        <div className="data-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Timezone</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {venues.map((v) => (
                <tr key={v.id}>
                  <td>{v.name}</td>
                  <td><code>{v.slug}</code></td>
                  <td>{v.timezone}</td>
                  <td>{new Date(v.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Add Venue</h3>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
              </div>
              <div className="form-group">
                <label>Slug</label>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  required
                  placeholder="venue-slug"
                  pattern="[a-z0-9-]+"
                />
              </div>
              <div className="form-group">
                <label>Timezone</label>
                <input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="America/New_York"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={createVenue.isPending}>
                  {createVenue.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
