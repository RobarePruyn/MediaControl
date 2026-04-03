/**
 * TLS certificate management page.
 * Upload wildcard certs, generate CSRs, view current cert status.
 * @module admin-ui/pages/TlsSettingsPage
 */

import { useState, type FormEvent } from 'react';
import { useTlsStatus, useUploadCert, useGenerateCsr } from '../api/hooks.js';
import { ShieldCheck, Upload, FileText } from 'lucide-react';
import './pages.css';

export function TlsSettingsPage() {
  const { data: status, isLoading } = useTlsStatus();
  const uploadCert = useUploadCert();
  const generateCsr = useGenerateCsr();

  const [showUpload, setShowUpload] = useState(false);
  const [showCsr, setShowCsr] = useState(false);
  const [cert, setCert] = useState('');
  const [key, setKey] = useState('');
  const [csrCommonName, setCsrCommonName] = useState('');
  const [csrSans, setCsrSans] = useState('');
  const [csrResult, setCsrResult] = useState('');

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    await uploadCert.mutateAsync({ certificate: cert, privateKey: key });
    setShowUpload(false);
    setCert('');
    setKey('');
  };

  const handleCsr = async (e: FormEvent) => {
    e.preventDefault();
    const result = await generateCsr.mutateAsync({
      commonName: csrCommonName,
      sans: csrSans.split(',').map((s) => s.trim()).filter(Boolean),
    });
    setCsrResult(result.csr);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">TLS / Certificates</h2>
        <div className="page-actions">
          <button className="btn-primary" onClick={() => setShowUpload(true)}>
            <Upload size={16} /> Upload Certificate
          </button>
          <button className="btn-ghost" onClick={() => setShowCsr(true)}>
            <FileText size={16} /> Generate CSR
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="empty-text">Loading...</p>
      ) : !status ? (
        <div className="card">
          <p className="empty-text">No TLS certificate configured. Upload a wildcard certificate to enable HTTPS.</p>
        </div>
      ) : (
        <div className="card">
          <h3 className="card-title"><ShieldCheck size={18} /> Current Certificate</h3>
          <table>
            <tbody>
              <tr><td style={{ fontWeight: 500 }}>Subject</td><td>{status.subject}</td></tr>
              <tr><td style={{ fontWeight: 500 }}>SANs</td><td>{status.sans.join(', ')}</td></tr>
              <tr><td style={{ fontWeight: 500 }}>Issuer</td><td>{status.issuer}</td></tr>
              <tr>
                <td style={{ fontWeight: 500 }}>Expires</td>
                <td>
                  {new Date(status.expiresAt).toLocaleDateString()}
                  {' '}
                  <span className={`badge ${status.daysUntilExpiry > 30 ? 'badge-success' : status.daysUntilExpiry > 7 ? 'badge-warning' : 'badge-danger'}`}>
                    {status.daysUntilExpiry} days
                  </span>
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 500 }}>Status</td>
                <td>
                  {status.isActive ? (
                    <span className="badge badge-success">Active</span>
                  ) : (
                    <span className="badge badge-danger">Inactive</span>
                  )}
                </td>
              </tr>
              <tr><td style={{ fontWeight: 500 }}>Uploaded</td><td>{new Date(status.uploadedAt).toLocaleString()}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {showUpload && (
        <div className="modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 560 }}>
            <h3 className="modal-title">Upload Certificate</h3>
            <form onSubmit={handleUpload}>
              <div className="form-group">
                <label>Certificate (PEM)</label>
                <textarea
                  value={cert}
                  onChange={(e) => setCert(e.target.value)}
                  rows={6}
                  required
                  placeholder="-----BEGIN CERTIFICATE-----"
                  style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                />
              </div>
              <div className="form-group">
                <label>Private Key (PEM)</label>
                <textarea
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  rows={6}
                  required
                  placeholder="-----BEGIN PRIVATE KEY-----"
                  style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setShowUpload(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={uploadCert.isPending}>
                  {uploadCert.isPending ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCsr && (
        <div className="modal-overlay" onClick={() => setShowCsr(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 560 }}>
            <h3 className="modal-title">Generate CSR</h3>
            <form onSubmit={handleCsr}>
              <div className="form-group">
                <label>Common Name</label>
                <input value={csrCommonName} onChange={(e) => setCsrCommonName(e.target.value)} required placeholder="*.example.com" />
              </div>
              <div className="form-group">
                <label>Subject Alternative Names (comma-separated)</label>
                <input value={csrSans} onChange={(e) => setCsrSans(e.target.value)} placeholder="*.example.com, example.com" />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setShowCsr(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={generateCsr.isPending}>
                  {generateCsr.isPending ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </form>
            {csrResult && (
              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label>CSR Output</label>
                <textarea
                  value={csrResult}
                  readOnly
                  rows={8}
                  style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
