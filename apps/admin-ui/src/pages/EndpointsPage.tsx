/**
 * Endpoints management page.
 * Lists discovered endpoints with filtering, bulk assignment, and status polling.
 * Venue ID is derived from the URL route parameter.
 * @module admin-ui/pages/EndpointsPage
 */

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useEndpoints, useGroups, useControllers, useBulkAssignEndpoints, usePollEndpointStatus } from '../api/hooks.js';
import { RefreshCw } from 'lucide-react';
import './pages.css';

export function EndpointsPage() {
  const { venueId } = useParams<{ venueId: string }>();

  const [filterController, setFilterController] = useState('');
  const [filterAssigned, setFilterAssigned] = useState('');
  const { data: endpoints, isLoading } = useEndpoints(venueId!, {
    controllerId: filterController || undefined,
    assigned: filterAssigned || undefined,
  });
  const { data: groups } = useGroups(venueId!);
  const { data: controllers } = useControllers(venueId!);
  const bulkAssign = useBulkAssignEndpoints(venueId!);
  const pollStatus = usePollEndpointStatus(venueId!);

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignGroupId, setAssignGroupId] = useState('');
  const [pollResult, setPollResult] = useState<string | null>(null);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!filteredEndpoints) return;
    if (selected.size === filteredEndpoints.length) setSelected(new Set());
    else setSelected(new Set(filteredEndpoints.map((e) => e.id)));
  };

  const handleBulkAssign = async () => {
    if (!assignGroupId || selected.size === 0) return;
    await bulkAssign.mutateAsync({ endpointIds: [...selected], groupId: assignGroupId });
    setSelected(new Set());
    setAssignGroupId('');
  };

  const handlePollStatus = async () => {
    setPollResult('polling...');
    try {
      const result = await pollStatus.mutateAsync();
      setPollResult(`updated ${(result as { updated?: number })?.updated ?? 0} endpoints`);
    } catch (err) {
      setPollResult(err instanceof Error ? err.message : 'poll failed');
    }
  };

  const searchLower = search.toLowerCase();
  const filteredEndpoints = endpoints?.filter((ep) =>
    !search ||
    ep.displayName.toLowerCase().includes(searchLower) ||
    ep.deviceType.toLowerCase().includes(searchLower)
  );

  // Determine which state columns have data across all endpoints
  const hasAnyPower = filteredEndpoints?.some(ep => ep.currentState?.isPoweredOn != null) ?? false;
  const hasAnyChannel = filteredEndpoints?.some(ep => ep.currentState?.currentChannelNumber != null) ?? false;
  const hasAnyVolume = filteredEndpoints?.some(ep => ep.currentState?.volumeLevel != null) ?? false;
  const hasAnyInput = filteredEndpoints?.some(ep => ep.currentState?.currentInput != null) ?? false;
  const hasAnyMute = filteredEndpoints?.some(ep => ep.currentState?.isMuted != null) ?? false;

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Endpoints</h2>
        <div className="page-actions">
          <button
            className="btn-primary"
            onClick={handlePollStatus}
            disabled={pollStatus.isPending}
          >
            <RefreshCw size={16} className={pollStatus.isPending ? 'spin' : ''} />
            {pollStatus.isPending ? 'Polling...' : 'Refresh Status'}
          </button>
          {pollResult && pollResult !== 'polling...' && (
            <span className={`badge ${pollResult.startsWith('updated') ? 'badge-success' : 'badge-danger'}`}>
              {pollResult}
            </span>
          )}
        </div>
      </div>

      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search endpoints..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 200 }}
        />
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
              <option value="">Assign to controller...</option>
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
        <p className="empty-text">No endpoints discovered. Poll a connection to discover devices.</p>
      ) : !filteredEndpoints?.length ? (
        <p className="empty-text">No endpoints match your search.</p>
      ) : (
        <div className="data-table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  <input type="checkbox" checked={selected.size === filteredEndpoints.length && filteredEndpoints.length > 0} onChange={toggleAll} />
                </th>
                <th>Display Name</th>
                <th>Device Type</th>
                {hasAnyPower && <th>Power</th>}
                {hasAnyChannel && <th>Channel</th>}
                {hasAnyInput && <th>Input</th>}
                {hasAnyVolume && <th>Volume</th>}
                {hasAnyMute && <th>Mute</th>}
                <th>Assigned</th>
                <th>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {filteredEndpoints.map((ep) => (
                <tr key={ep.id}>
                  <td>
                    <input type="checkbox" checked={selected.has(ep.id)} onChange={() => toggleSelect(ep.id)} />
                  </td>
                  <td>{ep.displayName}</td>
                  <td><span className="badge badge-info">{ep.deviceType}</span></td>
                  {hasAnyPower && (
                    <td>
                      {ep.currentState?.isPoweredOn == null ? (
                        <span className="badge">—</span>
                      ) : ep.currentState.isPoweredOn ? (
                        <span className="badge badge-success">on</span>
                      ) : (
                        <span className="badge badge-danger">off</span>
                      )}
                    </td>
                  )}
                  {hasAnyChannel && (
                    <td>{ep.currentState?.currentChannelNumber ?? '—'}</td>
                  )}
                  {hasAnyInput && (
                    <td>{ep.currentState?.currentInput ?? '—'}</td>
                  )}
                  {hasAnyVolume && (
                    <td>{ep.currentState?.volumeLevel != null ? `${ep.currentState.volumeLevel}%` : '—'}</td>
                  )}
                  {hasAnyMute && (
                    <td>
                      {ep.currentState?.isMuted == null ? '—' : ep.currentState.isMuted ? 'muted' : 'unmuted'}
                    </td>
                  )}
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
