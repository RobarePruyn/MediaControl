/**
 * Controllers management page.
 * Lists, creates, tests, and polls device controllers.
 * @module admin-ui/pages/ControllersPage
 */

import { useState, type FormEvent } from 'react';
import {
  useControllers,
  useCreateController,
  useDeleteController,
  useTestController,
  usePollController,
  useVenues,
} from '../api/hooks.js';
import { Plus, Plug, RefreshCw, Trash2 } from 'lucide-react';
import './pages.css';

export function ControllersPage() {
  const { data: controllers, isLoading } = useControllers();
  const { data: venues } = useVenues();
  const createController = useCreateController();
  const deleteController = useDeleteController();
  const testController = useTestController();
  const pollController = usePollController();
  const [showCreate, setShowCreate] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  const [name, setName] = useState('');
  const [platformSlug, setPlatformSlug] = useState('visionedge');
  const [venueId, setVenueId] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    await createController.mutateAsync({
      name,
      platformSlug,
      venueId: venueId || venues?.[0]?.id || '',
      connectionConfig: { platform: platformSlug, baseUrl, apiKey },
    });
    setShowCreate(false);
    setName('');
    setBaseUrl('');
    setApiKey('');
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
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Add Controller
        </button>
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
