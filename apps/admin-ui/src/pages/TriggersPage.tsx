/**
 * Triggers management page.
 * Create, configure, execute, and monitor automation triggers.
 * @module admin-ui/pages/TriggersPage
 */

import { useState, type FormEvent } from 'react';
import {
  useTriggers,
  useCreateTrigger,
  useDeleteTrigger,
  useExecuteTrigger,
  useTriggerExecutions,
  useCancelExecution,
  useVenues,
} from '../api/hooks.js';
import { Plus, Play, Trash2, XCircle, Clock } from 'lucide-react';
import type { Trigger } from '@suitecommand/types';
import './pages.css';

export function TriggersPage() {
  const { data: triggers, isLoading } = useTriggers();
  const { data: venues } = useVenues();
  const createTrigger = useCreateTrigger();
  const deleteTrigger = useDeleteTrigger();
  const executeTrigger = useExecuteTrigger();
  const [showCreate, setShowCreate] = useState(false);
  const [execTrigger, setExecTrigger] = useState<Trigger | null>(null);

  const [name, setName] = useState('');
  const [venueId, setVenueId] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    await createTrigger.mutateAsync({
      name,
      venueId: venueId || venues?.[0]?.id || '',
      description: description || undefined,
    });
    setShowCreate(false);
    setName('');
    setDescription('');
  };

  const handleExecute = async (id: string) => {
    await executeTrigger.mutateAsync(id);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Triggers</h2>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Add Trigger
        </button>
      </div>

      {isLoading ? (
        <p className="empty-text">Loading...</p>
      ) : !triggers?.length ? (
        <p className="empty-text">No triggers configured.</p>
      ) : (
        <div className="data-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {triggers.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{t.description || '—'}</td>
                  <td>
                    <span className={`status-dot ${t.isActive ? 'status-dot-active' : 'status-dot-inactive'}`} />
                    {t.isActive ? 'Active' : 'Inactive'}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="btn-primary" style={{ padding: '0.25rem 0.625rem' }} onClick={() => handleExecute(t.id)} title="Execute">
                        <Play size={14} />
                      </button>
                      <button className="btn-ghost" onClick={() => setExecTrigger(t)} title="Executions">
                        <Clock size={14} />
                      </button>
                      <button className="btn-ghost" onClick={() => deleteTrigger.mutate(t.id)} title="Delete">
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
            <h3 className="modal-title">Add Trigger</h3>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
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
                <button type="submit" className="btn-primary" disabled={createTrigger.isPending}>
                  {createTrigger.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {execTrigger && (
        <ExecutionsModal trigger={execTrigger} onClose={() => setExecTrigger(null)} />
      )}
    </div>
  );
}

function ExecutionsModal({ trigger, onClose }: { trigger: Trigger; onClose: () => void }) {
  const { data: executions, isLoading } = useTriggerExecutions(trigger.id);
  const cancelExecution = useCancelExecution();

  const stateColor: Record<string, string> = {
    running: 'badge-info',
    completed: 'badge-success',
    failed: 'badge-danger',
    cancelled: 'badge-warning',
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 650 }}>
        <h3 className="modal-title">Executions: {trigger.name}</h3>

        {isLoading ? (
          <p className="empty-text">Loading...</p>
        ) : !executions?.length ? (
          <p className="empty-text">No executions recorded.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Started</th>
                <th>State</th>
                <th>Completed</th>
                <th>Error</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {executions.map((ex) => (
                <tr key={ex.id}>
                  <td>{new Date(ex.startedAt).toLocaleString()}</td>
                  <td><span className={`badge ${stateColor[ex.state] || 'badge-info'}`}>{ex.state}</span></td>
                  <td>{ex.completedAt ? new Date(ex.completedAt).toLocaleString() : '—'}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.errorMessage || '—'}</td>
                  <td>
                    {ex.state === 'running' && (
                      <button
                        className="btn-ghost"
                        onClick={() => cancelExecution.mutate({ triggerId: trigger.id, executionId: ex.id })}
                        title="Cancel"
                      >
                        <XCircle size={14} />
                      </button>
                    )}
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
