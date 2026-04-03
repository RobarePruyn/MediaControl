/**
 * Controllers management page.
 * Lists, creates, tests, and polls device controllers.
 * Venue ID is derived from the URL route parameter.
 * @module admin-ui/pages/ControllersPage
 */

import { useState, useEffect, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  useControllers,
  useCreateController,
  useUpdateController,
  useDeleteController,
  useTestController,
  usePollController,
} from '../api/hooks.js';
import { Plus, Pencil, Plug, RefreshCw, Trash2 } from 'lucide-react';
import type { Controller } from '@suitecommand/types';
import './pages.css';

export function ControllersPage() {
  const { venueId } = useParams<{ venueId: string }>();

  const { data: controllers, isLoading } = useControllers(venueId!);
  const createController = useCreateController(venueId!);
  const deleteController = useDeleteController(venueId!);
  const testController = useTestController(venueId!);
  const pollController = usePollController(venueId!);
  const [showCreate, setShowCreate] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  const [name, setName] = useState('');
  const [platformSlug, setPlatformSlug] = useState('visionedge');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');

  const [editing, setEditing] = useState<Controller | null>(null);
  const updateController = useUpdateController(venueId!, editing?.id ?? '');
  const [editName, setEditName] = useState('');
  const [editBaseUrl, setEditBaseUrl] = useState('');
  const [editApiKey, setEditApiKey] = useState('');
  const [editActive, setEditActive] = useState(true);

  useEffect(() => {
    if (editing) {
      setEditName(editing.name);
      setEditBaseUrl('');
      setEditApiKey('');
      setEditActive(editing.isActive);
    }
  }, [editing]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    await createController.mutateAsync({
      name,
      platformSlug,
      venueId: venueId!,
      connectionConfig: { platform: platformSlug, baseUrl, apiKey },
    });
    setShowCreate(false);
    setName('');
    setBaseUrl('');
    setApiKey('');
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const body: Record<string, unknown> = { name: editName, isActive: editActive };
    if (editBaseUrl || editApiKey) {
      body.connectionConfig = {
        platform: editing.platformSlug,
        baseUrl: editBaseUrl || undefined,
        apiKey: editApiKey || undefined,
      };
    }
    await updateController.mutateAsync(body);
    setEditing(null);
  };

  const handleTest = async (id: string) => {
    setTestResult((prev) => ({ ...prev, [id]: 'testing...' }));
    try {
      await testController.mutateAsync(id);
      setTestResult((prev) => ({ ...prev, [id]: 'success' }));
    } catch (err) {
      setTestResult((prev) => ({ ...prev, [id]: err instanceof Error ? err.message : 'failed' }));
    }
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

      {isLoading ? (
        <p className="empty-text">Loading...</p>
      ) : !controllers?.length ? (
        <p className="empty-text">No controllers configured. Add one to start discovering endpoints.</p>
      ) : (
        <div className="data-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Platform</th>
                <th>Status</th>
                <th>Last Polled</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {controllers.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td><span className="badge badge-info">{c.platformSlug}</span></td>
                  <td>
                    <span className={`status-dot ${c.isActive ? 'status-dot-active' : 'status-dot-inactive'}`} />
                    {c.isActive ? 'Active' : 'Inactive'}
                  </td>
                  <td>{c.lastPolledAt ? new Date(c.lastPolledAt).toLocaleString() : 'Never'}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn-ghost" onClick={() => setEditing(c)} title="Edit Controller">
                        <Pencil size={14} />
                      </button>
                      <button className="btn-ghost" onClick={() => handleTest(c.id)} title="Test Connection">
                        <Plug size={14} />
                      </button>
                      <button className="btn-ghost" onClick={() => pollController.mutate(c.id)} title="Poll Endpoints">
                        <RefreshCw size={14} />
                      </button>
                      <button className="btn-ghost" onClick={() => deleteController.mutate(c.id)} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {testResult[c.id] && (
                      <span className={`badge ${testResult[c.id] === 'success' ? 'badge-success' : testResult[c.id] === 'testing...' ? 'badge-info' : 'badge-danger'}`} style={{ marginTop: 4, display: 'inline-block' }}>
                        {testResult[c.id]}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
                <label>Base URL</label>
                <input
                  value={editBaseUrl}
                  onChange={(e) => setEditBaseUrl(e.target.value)}
                  placeholder="Leave blank to keep current"
                />
              </div>
              <div className="form-group">
                <label>API Key</label>
                <input
                  type="password"
                  value={editApiKey}
                  onChange={(e) => setEditApiKey(e.target.value)}
                  placeholder="Leave blank to keep current"
                />
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={editActive}
                    onChange={(e) => setEditActive(e.target.checked)}
                  />
                  Active
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={updateController.isPending}>
                  {updateController.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                <label>Platform</label>
                <select value={platformSlug} onChange={(e) => setPlatformSlug(e.target.value)}>
                  <option value="visionedge">WiPro VisionEdge</option>
                </select>
              </div>
              <div className="form-group">
                <label>Base URL</label>
                <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} required placeholder="http://192.168.1.100:8080" />
              </div>
              <div className="form-group">
                <label>API Key</label>
                <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} required />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={createController.isPending}>
                  {createController.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
