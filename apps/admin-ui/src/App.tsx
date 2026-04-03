/**
 * Admin UI root application component.
 * Defines route structure and wraps authenticated routes in the layout.
 * @module admin-ui/App
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider.js';
import { Layout } from './components/layout/Layout.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { ControllersPage } from './pages/ControllersPage.js';
import { EndpointsPage } from './pages/EndpointsPage.js';
import { GroupsPage } from './pages/GroupsPage.js';
import { ChannelsPage } from './pages/ChannelsPage.js';
import { BrandingPage } from './pages/BrandingPage.js';
import { EventsPage } from './pages/EventsPage.js';
import { TriggersPage } from './pages/TriggersPage.js';
import { TlsSettingsPage } from './pages/TlsSettingsPage.js';
import { SsoSettingsPage } from './pages/SsoSettingsPage.js';
import { VenuesPage } from './pages/VenuesPage.js';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/venues" element={<VenuesPage />} />
                <Route path="/controllers" element={<ControllersPage />} />
                <Route path="/endpoints" element={<EndpointsPage />} />
                <Route path="/groups" element={<GroupsPage />} />
                <Route path="/channels" element={<ChannelsPage />} />
                <Route path="/branding" element={<BrandingPage />} />
                <Route path="/events" element={<EventsPage />} />
                <Route path="/triggers" element={<TriggersPage />} />
                <Route path="/settings/tls" element={<TlsSettingsPage />} />
                <Route path="/settings/sso" element={<SsoSettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
