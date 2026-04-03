/**
 * Endpoints management page.
 * Lists discovered endpoints with filtering and bulk assignment.
 * @module admin-ui/pages/EndpointsPage
 */

import { useState } from 'react';
import { useEndpoints, useGroups, useControllers, useBulkAssignEndpoints } from '../api/hooks.js';
import './pages.css';

export function EndpointsPage() {
  const [filterController, setFilterController] = useState('');
  const [filterAssigned, setFilterAssigned] = useState('');
  const { data: endpoints, isLoading } = useEndpoints({
    controllerId: filterController || undefined,
    assigned: filterAssigned || undefined,
  });
  const { data: groups } = useGroups();
  const { data: controllers } = useControllers();
  const bulkAssign = useBulkAssignEndpoints();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignGroupId, setAssignGroupId] = useState('');

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!endpoints) return;
    if (selected.size === endpoints.length) setSelected(new Set());
    else setSelected(new Set(endpoints.map((e) => e.id)));
  };

  const handleBulkAssign = async () => {
    if (!assignGroupId || selected.size === 0) return;
    await bulkAssign.mutateAsync({ endpointIds: [...selected], groupId: assignGroupId });
    setSelected(new Set());
    setAssignGroupId('');
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Endpoints</h2>
      </div>

      <div className="filter-bar">
        <select value={filterController} onChange={(e) => setFilterController(e.target.value)}>
          <option value="">All Controllers</option>
          {controllers?.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select value={filterAssigned} onChange={(e) => setFilterAssigned(e.target.value)}>
          <option value="">All</option>
          <option value="true">Assigned</option>
          <option value="false">Unassigned</option>
        </select>

        {selected.size > 0 && groups && groups.length > 0 && (
          <>
            <select value={assignGroupId} onChange={(e) => setAssignGroupId(e.target.value)}>
              <option value="">Assign to group...</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <button className="btn-primary" onClick={handleBulkAssign} disabled={!assignGroupId || bulkAssign.isPending}>
              Assign {selected.size} endpoint{selected.size > 1 ? 's' : ''}
            </button>
          </>
        )}
      </div>

      {isLoading ? (
        <p className="empty-text">Loading...</p>
      ) : !endpoints?.length ? (
        <p className="empty-text">No endpoints discovered. Poll a controller to discover devices.</p>
      ) : (
        <div className="data-table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  <input type="checkbox" checked={selected.size === endpoints.length && endpoints.length > 0} onChange={toggleAll} />
                </th>
                <th>Display Name</th>
                <th>Device Type</th>
                <th>Power</th>
                <th>Channel</th>
                <th>Volume</th>
                <th>Assigned</th>
                <th>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((ep) => (
                <tr key={ep.id}>
                  <td>
                    <input type="checkbox" checked={selected.has(ep.id)} onChange={() => toggleSelect(ep.id)} />
                  </td>
                  <td>{ep.displayName}</td>
                  <td><span className="badge badge-info">{ep.deviceType}</span></td>
                  <td>
                    {ep.currentState?.isPoweredOn == null ? (
                      <span className="badge badge-warning">unknown</span>
                    ) : ep.currentState.isPoweredOn ? (
                      <span className="badge badge-success">on</span>
                    ) : (
                      <span className="badge badge-danger">off</span>
                    )}
                  </td>
                  <td>{ep.currentState?.currentChannelNumber ?? '—'}</td>
                  <td>{ep.currentState?.volumeLevel != null ? `${ep.currentState.volumeLevel}%` : '—'}</td>
                  <td>
                    {ep.isAssigned ? (
                      <span className="badge badge-success">yes</span>
                    ) : (
                      <span className="badge badge-warning">no</span>
                    )}
                  </td>
                  <td>{ep.lastSeenAt ? new Date(ep.lastSeenAt).toLocaleString() : 'Never'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
