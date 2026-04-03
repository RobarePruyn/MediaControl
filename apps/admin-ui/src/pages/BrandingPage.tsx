/**
 * Branding configuration page.
 * Allows admins to customize the end-user control UI appearance.
 * Venue ID is derived from the URL route parameter.
 * @module admin-ui/pages/BrandingPage
 */

import { useState, useEffect, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useBranding, useUpdateBranding } from '../api/hooks.js';
import './pages.css';

export function BrandingPage() {
  const { venueId } = useParams<{ venueId: string }>();

  const { data: branding, isLoading } = useBranding(venueId!);
  const updateBranding = useUpdateBranding(venueId!);

  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [secondaryColor, setSecondaryColor] = useState('#1e1b4b');
  const [accentColor, setAccentColor] = useState('#22c55e');
  const [textOnPrimary, setTextOnPrimary] = useState('#ffffff');
  const [textOnSecondary, setTextOnSecondary] = useState('#e1e4ed');
  const [fontFamily, setFontFamily] = useState('Inter, sans-serif');
  const [buttonRadius, setButtonRadius] = useState('8px');

  useEffect(() => {
    if (branding) {
      setPrimaryColor(branding.primaryColor);
      setSecondaryColor(branding.secondaryColor);
      setAccentColor(branding.accentColor);
      setTextOnPrimary(branding.textOnPrimary);
      setTextOnSecondary(branding.textOnSecondary);
      setFontFamily(branding.fontFamily);
      setButtonRadius(branding.buttonRadius);
    }
  }, [branding]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    await updateBranding.mutateAsync({
      primaryColor,
      secondaryColor,
      accentColor,
      textOnPrimary,
      textOnSecondary,
      fontFamily,
      buttonRadius,
    });
  };

  if (isLoading) return <div className="page"><p className="empty-text">Loading...</p></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Branding</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div className="card">
          <h3 className="card-title">Configuration</h3>
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label>Primary Color</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} style={{ width: 40, height: 32, padding: 0 }} />
                <input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} style={{ flex: 1 }} />
              </div>
            </div>
            <div className="form-group">
              <label>Secondary Color</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} style={{ width: 40, height: 32, padding: 0 }} />
                <input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} style={{ flex: 1 }} />
              </div>
            </div>
            <div className="form-group">
              <label>Accent Color</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} style={{ width: 40, height: 32, padding: 0 }} />
                <input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} style={{ flex: 1 }} />
              </div>
            </div>
            <div className="form-group">
              <label>Text on Primary</label>
              <input value={textOnPrimary} onChange={(e) => setTextOnPrimary(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Text on Secondary</label>
              <input value={textOnSecondary} onChange={(e) => setTextOnSecondary(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Font Family</label>
              <input value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Button Radius</label>
              <input value={buttonRadius} onChange={(e) => setButtonRadius(e.target.value)} placeholder="8px" />
            </div>
            <button type="submit" className="btn-primary" disabled={updateBranding.isPending}>
              {updateBranding.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>

        <div className="card">
          <h3 className="card-title">Preview</h3>
          <div
            style={{
              background: secondaryColor,
              borderRadius: 'var(--radius)',
              padding: '1.5rem',
              fontFamily,
            }}
          >
            <h4 style={{ color: textOnSecondary, marginBottom: '1rem' }}>Control Panel</h4>
            <button
              style={{
                background: primaryColor,
                color: textOnPrimary,
                border: 'none',
                borderRadius: buttonRadius,
                padding: '0.5rem 1.25rem',
                fontFamily,
                fontSize: '0.875rem',
                cursor: 'pointer',
                marginRight: '0.5rem',
              }}
            >
              Channel Up
            </button>
            <button
              style={{
                background: accentColor,
                color: '#fff',
                border: 'none',
                borderRadius: buttonRadius,
                padding: '0.5rem 1.25rem',
                fontFamily,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Power On
            </button>
            <div style={{ marginTop: '1rem', color: textOnSecondary, fontSize: '0.8rem' }}>
              Volume: <span style={{ color: primaryColor, fontWeight: 600 }}>65%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
