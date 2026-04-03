/**
 * Control UI root component.
 * Routes to the control page based on group access token.
 * @module control-ui/App
 */

import { Routes, Route } from 'react-router-dom';
import { ControlPage } from './pages/ControlPage.js';

export function App() {
  return (
    <Routes>
      <Route path="/control/:groupToken" element={<ControlPage />} />
      <Route
        path="*"
        element={
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>SuiteCommand</h1>
            <p>Scan a QR code or use a provided link to access your suite controls.</p>
          </div>
        }
      />
    </Routes>
  );
}
