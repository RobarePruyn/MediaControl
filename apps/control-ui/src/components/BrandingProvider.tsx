/**
 * Branding provider that injects CSS custom properties from venue config.
 * Applied at page load before first render.
 * @module control-ui/components/BrandingProvider
 */

import { useEffect, type ReactNode } from 'react';
import type { BrandingConfig } from '@suitecommand/types';

interface BrandingProviderProps {
  branding: BrandingConfig | null;
  children: ReactNode;
}

export function BrandingProvider({ branding, children }: BrandingProviderProps) {
  useEffect(() => {
    if (!branding) return;

    const root = document.documentElement;
    root.style.setProperty('--brand-primary', branding.primaryColor);
    root.style.setProperty('--brand-secondary', branding.secondaryColor);
    root.style.setProperty('--brand-accent', branding.accentColor);
    root.style.setProperty('--brand-text-on-primary', branding.textOnPrimary);
    root.style.setProperty('--brand-text-on-secondary', branding.textOnSecondary);
    root.style.setProperty('--brand-font-family', branding.fontFamily);
    root.style.setProperty('--brand-button-radius', branding.buttonRadius);
    if (branding.logoUrl) {
      root.style.setProperty('--brand-logo-url', `url(${branding.logoUrl})`);
    }

    if (branding.customCss) {
      const style = document.createElement('style');
      style.id = 'brand-custom-css';
      style.textContent = branding.customCss;
      document.head.appendChild(style);
      return () => {
        document.getElementById('brand-custom-css')?.remove();
      };
    }
  }, [branding]);

  return <>{children}</>;
}
