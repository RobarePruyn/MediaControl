/**
 * Dashboard page — overview of system status.
 * Shows counts and quick links to key admin areas.
 * @module admin-ui/pages/DashboardPage
 */

import { useState } from 'react';
import { useControllers, useEndpoints, useGroups, useEvents, useVenues } from '../api/hooks.js';
import { Cpu, Monitor, Layers, CalendarDays, Activity, AlertTriangle } from 'lucide-react';
import './pages.css';

export function DashboardPage() {
  const { data: venues } = useVenues();
  const [venueId, setVenueId] = useState('');
  const activeVenueId = venueId || venues?.[0]?.id || '';

  const controllers = useControllers(activeVenueId);
  const endpoints = useEndpoints(activeVenueId);
  const groups = useGroups(activeVenueId);
  const events = useEvents(activeVenueId);

  const stats = [
    {
      label: 'Controllers',
      value: controllers.data?.length ?? '—',
      icon: Cpu,
      color: 'var(--color-primary)',
    },
    {
      label: 'Endpoints',
      value: endpoints.data?.length ?? '—',
      icon: Monitor,
      color: 'var(--color-success)',
    },
    {
      label: 'Groups',
      value: groups.data?.length ?? '—',
      icon: Layers,
      color: 'var(--color-warning)',
    },
    {
      label: 'Events',
      value: events.data?.length ?? '—',
      icon: CalendarDays,
      color: 'var(--color-danger)',
    },
  ];

  const activeControllers = controllers.data?.filter((c) => c.isActive) ?? [];
  const offlineEndpoints = endpoints.data?.filter((e) => {
    if (!e.currentState) return true;
    return e.currentState.isPoweredOn === false;
  }) ?? [];

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Dashboard</h2>
        {venues && venues.length > 1 && (
          <select value={activeVenueId} onChange={(e) => setVenueId(e.target.value)}>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="stats-grid">
        {stats.map((s) => (
          <div key={s.label} className="card stat-card">
            <div className="stat-icon" style={{ color: s.color }}>
              <s.icon size={24} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-panels">
        <div className="card">
          <h3 className="card-title">
            <Activity size={18} /> Active Controllers
          </h3>
          {activeControllers.length === 0 ? (
            <p className="empty-text">No active controllers</p>
          ) : (
            <ul className="simple-list">
              {activeControllers.map((c) => (
                <li key={c.id}>
                  <span>{c.name}</span>
                  <span className="badge badge-success">{c.platformSlug}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h3 className="card-title">
            <AlertTriangle size={18} /> Offline / Powered Off
          </h3>
          {offlineEndpoints.length === 0 ? (
            <p className="empty-text">All endpoints online</p>
          ) : (
            <ul className="simple-list">
              {offlineEndpoints.slice(0, 10).map((e) => (
                <li key={e.id}>
                  <span>{e.displayName}</span>
                  <span className="badge badge-warning">off</span>
                </li>
              ))}
              {offlineEndpoints.length > 10 && (
                <li className="empty-text">+{offlineEndpoints.length - 10} more</li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
