/**
 * SSO / Identity Provider settings page.
 * Configure OIDC providers and manage SSO settings.
 * @module admin-ui/pages/SsoSettingsPage
 */

import { useState, useEffect, type FormEvent } from 'react';
import {
  useIdentityProviders,
  useCreateIdentityProvider,
  useUpdateIdentityProvider,
  useSsoConfig,
  useUpsertSsoConfig,
} from '../api/hooks.js';
import { Plus, KeyRound } from 'lucide-react';
import './pages.css';

export function SsoSettingsPage() {
  const { data: providers, isLoading: loadingIdps } = useIdentityProviders();
  const { data: ssoConfig, isLoading: loadingSso } = useSsoConfig();
  const createIdp = useCreateIdentityProvider();
  const updateIdp = useUpdateIdentityProvider();
  const upsertSso = useUpsertSsoConfig();

  const [showCreateIdp, setShowCreateIdp] = useState(false);
  const [idpName, setIdpName] = useState('');
  const [idpSlug, setIdpSlug] = useState('');
  const [idpProtocol, setIdpProtocol] = useState<'oidc' | 'saml' | 'ldap'>('oidc');

  // SSO config form
  const [providerName, setProviderName] = useState('');
  const [issuerUrl, setIssuerUrl] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  useEffect(() => {
    if (ssoConfig) {
      setProviderName(ssoConfig.providerName || '');
      setIssuerUrl(ssoConfig.issuerUrl || '');
      setClientId(ssoConfig.clientId || '');
    }
  }, [ssoConfig]);

  const handleCreateIdp = async (e: FormEvent) => {
    e.preventDefault();
    await createIdp.mutateAsync({
      name: idpName,
      slug: idpSlug,
      protocol: idpProtocol,
      config: {},
    });
    setShowCreateIdp(false);
    setIdpName('');
    setIdpSlug('');
  };

  const handleSaveSso = async (e: FormEvent) => {
    e.preventDefault();
    await upsertSso.mutateAsync({
      providerName,
      issuerUrl,
      clientId,
      clientSecret,
    });
  };

  const toggleIdpActive = (id: string, currentlyActive: boolean) => {
    updateIdp.mutate({ id, isActive: !currentlyActive });
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">SSO Settings</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* OIDC Configuration */}
        <div className="card">
          <h3 className="card-title"><KeyRound size={18} /> OIDC Configuration</h3>
          {loadingSso ? (
            <p className="empty-text">Loading...</p>
          ) : (
            <form onSubmit={handleSaveSso}>
              <div className="form-group">
                <label>Provider Name</label>
                <input value={providerName} onChange={(e) => setProviderName(e.target.value)} placeholder="Okta" required />
              </div>
              <div className="form-group">
                <label>Issuer URL</label>
                <input value={issuerUrl} onChange={(e) => setIssuerUrl(e.target.value)} placeholder="https://dev-xxxx.okta.com" required />
              </div>
              <div className="form-group">
                <label>Client ID</label>
                <input value={clientId} onChange={(e) => setClientId(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Client Secret</label>
                <input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder={ssoConfig?.isActive ? '(unchanged)' : 'Enter client secret'} />
              </div>
              <button type="submit" className="btn-primary" disabled={upsertSso.isPending}>
                {upsertSso.isPending ? 'Saving...' : 'Save SSO Config'}
              </button>
              {ssoConfig?.isActive && (
                <div style={{ marginTop: '0.75rem' }}>
                  <span className="badge badge-success">SSO Active</span>
                  <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    Login URL: <code>/api/auth/sso/{ssoConfig.providerName?.toLowerCase() || 'okta'}</code>
                  </span>
                </div>
              )}
            </form>
          )}
        </div>

        {/* Identity Providers */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 className="card-title" style={{ margin: 0 }}>Identity Providers</h3>
            <button className="btn-ghost" onClick={() => setShowCreateIdp(true)} style={{ padding: '0.25rem 0.5rem' }}>
              <Plus size={14} /> Add
            </button>
          </div>

          {loadingIdps ? (
            <p className="empty-text">Loading...</p>
          ) : !providers?.length ? (
            <p className="empty-text">No identity providers configured.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Protocol</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td><span className="badge badge-info">{p.protocol}</span></td>
                    <td>
                      <button
                        className={`badge ${p.isActive ? 'badge-success' : 'badge-danger'}`}
                        style={{ cursor: 'pointer', border: 'none' }}
                        onClick={() => toggleIdpActive(p.id, p.isActive)}
                      >
                        {p.isActive ? 'active' : 'inactive'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showCreateIdp && (
        <div className="modal-overlay" onClick={() => setShowCreateIdp(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Add Identity Provider</h3>
            <form onSubmit={handleCreateIdp}>
              <div className="form-group">
                <label>Name</label>
                <input value={idpName} onChange={(e) => setIdpName(e.target.value)} required autoFocus />
              </div>
              <div className="form-group">
                <label>Slug</label>
                <input value={idpSlug} onChange={(e) => setIdpSlug(e.target.value)} required pattern="[a-z0-9-]+" placeholder="okta-prod" />
              </div>
              <div className="form-group">
                <label>Protocol</label>
                <select value={idpProtocol} onChange={(e) => setIdpProtocol(e.target.value as typeof idpProtocol)}>
                  <option value="oidc">OIDC</option>
                  <option value="saml">SAML</option>
                  <option value="ldap">LDAP</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setShowCreateIdp(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={createIdp.isPending}>
                  {createIdp.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
