/**
 * Admin UI root application component.
 * Defines venue-scoped route structure and wraps authenticated routes in the layout.
 * @module admin-ui/App
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider.js';
import { VenueProvider } from './context/VenueContext.js';
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
import { UsersPage } from './pages/UsersPage.js';

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
            <VenueProvider>
              <Layout>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/venues" element={<VenuesPage />} />
                  <Route path="/venues/:venueId/controllers" element={<ControllersPage />} />
                  <Route path="/venues/:venueId/endpoints" element={<EndpointsPage />} />
                  <Route path="/venues/:venueId/groups" element={<GroupsPage />} />
                  <Route path="/venues/:venueId/channels" element={<ChannelsPage />} />
                  <Route path="/venues/:venueId/branding" element={<BrandingPage />} />
                  <Route path="/venues/:venueId/events" element={<EventsPage />} />
                  <Route path="/venues/:venueId/triggers" element={<TriggersPage />} />
                  <Route path="/settings/users" element={<UsersPage />} />
                  <Route path="/settings/tls" element={<TlsSettingsPage />} />
                  <Route path="/settings/sso" element={<SsoSettingsPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </VenueProvider>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
