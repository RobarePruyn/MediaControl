/**
 * Events management page.
 * CRUD for venue events that drive token rotation.
 * @module admin-ui/pages/EventsPage
 */

import { useState, type FormEvent } from 'react';
import { useEvents, useCreateEvent, useDeleteEvent, useVenues } from '../api/hooks.js';
import { Plus, Trash2 } from 'lucide-react';
import './pages.css';

export function EventsPage() {
  const { data: events, isLoading } = useEvents();
  const { data: venues } = useVenues();
  const createEvent = useCreateEvent();
  const deleteEvent = useDeleteEvent();
  const [showCreate, setShowCreate] = useState(false);

  const [name, setName] = useState('');
  const [venueId, setVenueId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [preAccessMinutes, setPreAccessMinutes] = useState(60);
  const [postAccessMinutes, setPostAccessMinutes] = useState(30);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    await createEvent.mutateAsync({
      name,
      venueId: venueId || venues?.[0]?.id || '',
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      preAccessMinutes,
      postAccessMinutes,
    });
    setShowCreate(false);
    setName('');
    setStartsAt('');
    setEndsAt('');
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Events</h2>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Add Event
        </button>
      </div>

      {isLoading ? (
        <p className="empty-text">Loading...</p>
      ) : !events?.length ? (
        <p className="empty-text">No events scheduled.</p>
      ) : (
        <div className="data-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Starts</th>
                <th>Ends</th>
                <th>Pre-Access</th>
                <th>Post-Access</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td>{ev.name}</td>
                  <td>{new Date(ev.startsAt).toLocaleString()}</td>
                  <td>{new Date(ev.endsAt).toLocaleString()}</td>
                  <td>{ev.preAccessMinutes} min</td>
                  <td>{ev.postAccessMinutes} min</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn-ghost" onClick={() => deleteEvent.mutate(ev.id)} title="Delete">
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
            <h3 className="modal-title">Add Event</h3>
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
                <label>Starts At</label>
                <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Ends At</label>
                <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Pre-Access (minutes)</label>
                <input type="number" value={preAccessMinutes} onChange={(e) => setPreAccessMinutes(Number(e.target.value))} min={0} />
              </div>
              <div className="form-group">
                <label>Post-Access (minutes)</label>
                <input type="number" value={postAccessMinutes} onChange={(e) => setPostAccessMinutes(Number(e.target.value))} min={0} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={createEvent.isPending}>
                  {createEvent.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
