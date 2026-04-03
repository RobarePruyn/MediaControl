/**
 * Connections management page.
 * Lists, creates, tests, and polls connections to device platforms.
 * Platforms are organized by category (IPTV, Audio, Video, Lighting, BMS).
 * Connection config fields are platform-specific.
 * @module admin-ui/pages/ConnectionsPage
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
import type { Controller, ControllerCategory } from '@suitecommand/types';
import './pages.css';

// ─── Platform Registry ───────────────────────────────────────────────
//
// To add a new platform:
//   1. Add an entry to PLATFORMS with the correct category
//   2. Add connection config fields to PLATFORM_FIELDS
//   3. Implement the adapter in services/bridge-agent/src/adapters/
//   4. Register the adapter in the adapter registry
//
// Categories:
//   iptv     — IPTV / TV control
//   audio    — Overhead / zone audio
//   video    — Video routing / switching
//   lighting — Lighting control
//   bms      — Building management / environmental
// ─────────────────────────────────────────────────────────────────────

/** Platform definition with its category and display name */
interface PlatformDef {
  slug: string;
  label: string;
  category: ControllerCategory;
}

/** All supported platforms, grouped by category */
const PLATFORMS: PlatformDef[] = [
  // ── IPTV ──
  { slug: 'visionedge', label: 'WiPro VisionEdge', category: 'iptv' },
  // Future: { slug: 'vitec',       label: 'VITEC',              category: 'iptv' },
  // Future: { slug: 'tripleplay',  label: 'TriplePlay',         category: 'iptv' },

  // ── Audio ──
  // Future: { slug: 'qsys',        label: 'Q-SYS',             category: 'audio' },
  // Future: { slug: 'omni',        label: 'Omni',              category: 'audio' },

  // ── Video ──
  // Future: { slug: 'crestron',    label: 'Crestron',          category: 'video' },
  // Future: { slug: 'extron',      label: 'Extron',            category: 'video' },

  // ── Lighting ──
  // Future: { slug: 'lutron',      label: 'Lutron',            category: 'lighting' },
  // Future: { slug: 'etc',         label: 'ETC',               category: 'lighting' },

  // ── BMS ──
  // Future: { slug: 'generic-bms', label: 'Generic BMS',       category: 'bms' },
];

/** Human-readable labels for each category */
const CATEGORY_LABELS: Record<ControllerCategory, string> = {
  iptv: 'IPTV',
  audio: 'Audio',
  video: 'Video',
  lighting: 'Lighting',
  bms: 'BMS',
};

/** Categories that currently have platforms available */
const AVAILABLE_CATEGORIES = [...new Set(PLATFORMS.map(p => p.category))];

/**
 * Per-platform connection config field definitions.
 * Each field maps to a key in the encrypted connectionConfig JSON.
 *
 * To add fields for a new platform, add an entry here keyed by platform slug.
 */
const PLATFORM_FIELDS: Record<string, Array<{
  key: string;
  label: string;
  type: string;
  placeholder: string;
  required: boolean;
}>> = {
  visionedge: [
    { key: 'baseUrl', label: 'Server Address', type: 'text', placeholder: '10.193.1.111', required: true },
    { key: 'pin', label: 'PIN', type: 'password', placeholder: 'Controller PIN', required: true },
    { key: 'groupId', label: 'Group ID (optional)', type: 'text', placeholder: 'Scope to a specific control group', required: false },
  ],
  // Future platforms — uncomment and adjust when adapters are built:
  // vitec: [
  //   { key: 'baseUrl', label: 'Server Address', type: 'text', placeholder: 'http://192.168.1.100', required: true },
  //   { key: 'apiKey',  label: 'API Key',        type: 'password', placeholder: 'API authentication key', required: true },
  // ],
  // tripleplay: [
  //   { key: 'baseUrl',  label: 'Server Address', type: 'text', placeholder: 'http://192.168.1.100', required: true },
  //   { key: 'username', label: 'Username',       type: 'text', placeholder: 'API username',           required: true },
  //   { key: 'password', label: 'Password',       type: 'password', placeholder: 'API password',       required: true },
  // ],
  // qsys: [
  //   { key: 'baseUrl', label: 'Core Address', type: 'text', placeholder: 'http://192.168.1.100', required: true },
  //   { key: 'pin',     label: 'PIN',          type: 'password', placeholder: 'Core PIN',          required: false },
  // ],
};

export function ConnectionsPage() {
  const { venueId } = useParams<{ venueId: string }>();

  const { data: controllers, isLoading } = useControllers(venueId!);
  const createController = useCreateController(venueId!);
  const deleteController = useDeleteController(venueId!);
  const testController = useTestController(venueId!);
  const pollController = usePollController(venueId!);
  const [showCreate, setShowCreate] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, string>>({});
  const [pollResult, setPollResult] = useState<Record<string, string>>({});

  // Create form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ControllerCategory>('iptv');
  const [platformSlug, setPlatformSlug] = useState('visionedge');
  const [configFields, setConfigFields] = useState<Record<string, string>>({});

  // Edit form state
  const [editing, setEditing] = useState<Controller | null>(null);
  const updateController = useUpdateController(venueId!, editing?.id ?? '');
  const [editName, setEditName] = useState('');
  const [editConfigFields, setEditConfigFields] = useState<Record<string, string>>({});
  const [editActive, setEditActive] = useState(true);

  // Filter platforms by selected category
  const platformsForCategory = PLATFORMS.filter(p => p.category === category);

  // Reset platform and config when category changes
  useEffect(() => {
    const first = PLATFORMS.find(p => p.category === category);
    if (first) setPlatformSlug(first.slug);
    setConfigFields({});
  }, [category]);

  // Reset config when platform changes
  useEffect(() => {
    setConfigFields({});
  }, [platformSlug]);

  useEffect(() => {
    if (editing) {
      setEditName(editing.name);
      setEditConfigFields({});
      setEditActive(editing.isActive);
    }
  }, [editing]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const connectionConfig: Record<string, unknown> = { platform: platformSlug };
    for (const [key, value] of Object.entries(configFields)) {
      if (value) connectionConfig[key] = value;
    }
    await createController.mutateAsync({
      name,
      category,
      platformSlug,
      venueId: venueId!,
      connectionConfig,
    });
    setShowCreate(false);
    setName('');
    setConfigFields({});
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const body: Record<string, unknown> = { name: editName, isActive: editActive };
    const hasConfigChanges = Object.values(editConfigFields).some(v => v);
    if (hasConfigChanges) {
      const connectionConfig: Record<string, unknown> = { platform: editing.platformSlug };
      for (const [key, value] of Object.entries(editConfigFields)) {
        if (value) connectionConfig[key] = value;
      }
      body.connectionConfig = connectionConfig;
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

  const handlePoll = async (id: string) => {
    setPollResult((prev) => ({ ...prev, [id]: 'polling...' }));
    try {
      const result = await pollController.mutateAsync(id);
      const count = (result as { endpoints?: unknown[] })?.endpoints?.length ?? 0;
      setPollResult((prev) => ({ ...prev, [id]: `discovered ${count} endpoint${count !== 1 ? 's' : ''}` }));
    } catch (err) {
      setPollResult((prev) => ({ ...prev, [id]: err instanceof Error ? err.message : 'poll failed' }));
    }
  };

  const currentCreateFields = PLATFORM_FIELDS[platformSlug] ?? [];
  const currentEditFields = editing ? (PLATFORM_FIELDS[editing.platformSlug] ?? []) : [];

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Connections</h2>
        <div className="page-actions">
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Add Connection
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="empty-text">Loading...</p>
      ) : !controllers?.length ? (
        <p className="empty-text">No connections configured. Add one to start discovering endpoints.</p>
      ) : (
        <div className="data-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
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
                  <td><span className="badge">{CATEGORY_LABELS[c.category] ?? c.category}</span></td>
                  <td><span className="badge badge-info">{PLATFORMS.find(p => p.slug === c.platformSlug)?.label ?? c.platformSlug}</span></td>
                  <td>
                    <span className={`status-dot ${c.isActive ? 'status-dot-active' : 'status-dot-inactive'}`} />
                    {c.isActive ? 'Active' : 'Inactive'}
                  </td>
                  <td>{c.lastPolledAt ? new Date(c.lastPolledAt).toLocaleString() : 'Never'}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn-ghost" onClick={() => setEditing(c)} title="Edit Connection">
                        <Pencil size={14} />
                      </button>
                      <button className="btn-ghost" onClick={() => handleTest(c.id)} title="Test Connection">
                        <Plug size={14} />
                      </button>
                      <button className="btn-ghost" onClick={() => handlePoll(c.id)} title="Poll Endpoints" disabled={pollResult[c.id] === 'polling...'}>
                        <RefreshCw size={14} className={pollResult[c.id] === 'polling...' ? 'spin' : ''} />
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
                    {pollResult[c.id] && (
                      <span className={`badge ${pollResult[c.id] === 'polling...' ? 'badge-info' : pollResult[c.id].startsWith('discovered') ? 'badge-success' : 'badge-danger'}`} style={{ marginTop: 4, display: 'inline-block' }}>
                        {pollResult[c.id]}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Edit Connection</h3>
            <form onSubmit={handleEdit}>
              <div className="form-group">
                <label>Name</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} required autoFocus />
              </div>
              {currentEditFields.map((field) => (
                <div className="form-group" key={field.key}>
                  <label>{field.label}</label>
                  <input
                    type={field.type}
                    value={editConfigFields[field.key] ?? ''}
                    onChange={(e) => setEditConfigFields(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder="Leave blank to keep current"
                  />
                </div>
              ))}
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

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Add Connection</h3>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value as ControllerCategory)}>
                  {AVAILABLE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Platform</label>
                <select value={platformSlug} onChange={(e) => setPlatformSlug(e.target.value)}>
                  {platformsForCategory.map((p) => (
                    <option key={p.slug} value={p.slug}>{p.label}</option>
                  ))}
                </select>
              </div>
              {currentCreateFields.map((field) => (
                <div className="form-group" key={field.key}>
                  <label>{field.label}</label>
                  <input
                    type={field.type}
                    value={configFields[field.key] ?? ''}
                    onChange={(e) => setConfigFields(prev => ({ ...prev, [field.key]: e.target.value }))}
                    required={field.required}
                    placeholder={field.placeholder}
                  />
                </div>
              ))}
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
