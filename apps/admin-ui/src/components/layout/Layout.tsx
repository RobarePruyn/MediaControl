/**
 * Main layout with sidebar navigation for the admin UI.
 * @module admin-ui/components/layout/Layout
 */

import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider.js';
import {
  LayoutDashboard,
  Building2,
  Cpu,
  Monitor,
  Layers,
  Tv,
  Palette,
  CalendarDays,
  Zap,
  ShieldCheck,
  KeyRound,
  LogOut,
} from 'lucide-react';
import type { ReactNode } from 'react';
import './Layout.css';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/venues', label: 'Venues', icon: Building2 },
  { to: '/controllers', label: 'Controllers', icon: Cpu },
  { to: '/endpoints', label: 'Endpoints', icon: Monitor },
  { to: '/groups', label: 'Groups', icon: Layers },
  { to: '/channels', label: 'Channels', icon: Tv },
  { to: '/branding', label: 'Branding', icon: Palette },
  { to: '/events', label: 'Events', icon: CalendarDays },
  { to: '/triggers', label: 'Triggers', icon: Zap },
  { to: '/settings/tls', label: 'TLS / Certs', icon: ShieldCheck },
  { to: '/settings/sso', label: 'SSO', icon: KeyRound },
] as const;

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="sidebar-logo">SuiteCommand</h1>
          <span className="sidebar-subtitle">Admin</span>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'nav-item-active' : ''}`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          {user && (
            <div className="sidebar-user">
              <span className="sidebar-user-email">{user.email}</span>
              <span className="sidebar-user-role badge badge-info">{user.role}</span>
            </div>
          )}
          <button className="btn-ghost sidebar-logout" onClick={handleLogout}>
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
