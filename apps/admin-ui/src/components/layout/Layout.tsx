/**
 * Main layout with accordion sidebar navigation for the admin UI.
 * Venues are expandable items with sub-navigation for venue-scoped pages.
 * Settings section is role-gated to super_admin and app_admin.
 * @module admin-ui/components/layout/Layout
 */

import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider.js';
import { useVenue } from '../../context/VenueContext.js';
import {
  LayoutDashboard,
  Cpu,
  Monitor,
  Layers,
  Tv,
  Palette,
  CalendarDays,
  Zap,
  ShieldCheck,
  KeyRound,
  Users,
  ChevronRight,
  ChevronDown,
  LogOut,
} from 'lucide-react';
import type { ReactNode } from 'react';
import './Layout.css';

/** Sub-nav items shown under each venue when expanded */
const VENUE_SUB_NAV = [
  { segment: 'controllers', label: 'Controllers', icon: Cpu },
  { segment: 'endpoints', label: 'Endpoints', icon: Monitor },
  { segment: 'groups', label: 'Groups', icon: Layers },
  { segment: 'channels', label: 'Channels', icon: Tv },
  { segment: 'branding', label: 'Branding', icon: Palette },
  { segment: 'events', label: 'Events', icon: CalendarDays },
  { segment: 'triggers', label: 'Triggers', icon: Zap },
] as const;

/** Settings items gated to super_admin and app_admin roles */
const SETTINGS_NAV = [
  { to: '/settings/users', label: 'Users', icon: Users },
  { to: '/settings/tls', label: 'TLS / Certs', icon: ShieldCheck },
  { to: '/settings/sso', label: 'SSO', icon: KeyRound },
] as const;

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout, hasRole } = useAuth();
  const { venues } = useVenue();
  const navigate = useNavigate();
  const { venueId: activeVenueId } = useParams<{ venueId: string }>();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleVenueClick = (venueId: string) => {
    if (activeVenueId === venueId) {
      // Already viewing this venue; navigate to first sub-nav item
      navigate(`/venues/${venueId}/controllers`);
    } else {
      navigate(`/venues/${venueId}/controllers`);
    }
  };

  const showSettings = hasRole('super_admin', 'app_admin');

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="sidebar-logo">SuiteCommand</h1>
          <span className="sidebar-subtitle">Admin</span>
        </div>

        <nav className="sidebar-nav">
          {/* Dashboard */}
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `nav-item ${isActive ? 'nav-item-active' : ''}`
            }
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </NavLink>

          {/* Venues section */}
          <div className="nav-section-label">Venues</div>
          {venues.map((venue) => {
            const isExpanded = activeVenueId === venue.id;
            return (
              <div key={venue.id}>
                <div
                  className={`venue-item ${isExpanded ? 'venue-item-active' : ''}`}
                  onClick={() => handleVenueClick(venue.id)}
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>{venue.name}</span>
                </div>
                {isExpanded && (
                  <div className="venue-subnav">
                    {VENUE_SUB_NAV.map(({ segment, label, icon: Icon }) => (
                      <NavLink
                        key={segment}
                        to={`/venues/${venue.id}/${segment}`}
                        className={({ isActive }) =>
                          `nav-item ${isActive ? 'nav-item-active' : ''}`
                        }
                      >
                        <Icon size={16} />
                        <span>{label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Settings section */}
          {showSettings && (
            <>
              <div className="nav-section-label">Settings</div>
              {SETTINGS_NAV.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? 'nav-item-active' : ''}`
                  }
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </>
          )}
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
