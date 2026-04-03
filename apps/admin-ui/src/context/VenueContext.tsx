/**
 * Venue selection context for the admin UI.
 * Tracks the currently selected venue, persists to localStorage,
 * and auto-selects the first available venue when needed.
 * @module admin-ui/context/VenueContext
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import type { Venue } from '@suitecommand/types';
import { useVenues } from '../api/hooks.js';

const STORAGE_KEY = 'sc_selected_venue';

interface VenueContextState {
  venues: Venue[];
  selectedVenueId: string | null;
  selectedVenue: Venue | null;
  setSelectedVenueId: (id: string) => void;
  isLoading: boolean;
}

const VenueContext = createContext<VenueContextState | null>(null);

/**
 * Provider that manages venue selection state for the admin UI.
 * Wraps children with venue context and handles auto-selection logic.
 */
export function VenueProvider({ children }: { children: ReactNode }) {
  const { data: venues = [], isLoading } = useVenues();

  const [selectedVenueId, setSelectedVenueIdRaw] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY),
  );

  const setSelectedVenueId = useCallback((id: string) => {
    setSelectedVenueIdRaw(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  // Auto-select first venue if none stored or stored one no longer available
  useEffect(() => {
    if (isLoading || venues.length === 0) return;

    const storedId = selectedVenueId;
    const isValid = storedId && venues.some((v) => v.id === storedId);

    if (!isValid) {
      const firstId = venues[0].id;
      setSelectedVenueIdRaw(firstId);
      localStorage.setItem(STORAGE_KEY, firstId);
    }
  }, [venues, isLoading, selectedVenueId]);

  const selectedVenue = useMemo(
    () => venues.find((v) => v.id === selectedVenueId) ?? null,
    [venues, selectedVenueId],
  );

  return (
    <VenueContext.Provider
      value={{
        venues,
        selectedVenueId,
        selectedVenue,
        setSelectedVenueId,
        isLoading,
      }}
    >
      {children}
    </VenueContext.Provider>
  );
}

/** Hook to access venue selection state and methods */
export function useVenue() {
  const ctx = useContext(VenueContext);
  if (!ctx) throw new Error('useVenue must be used within VenueProvider');
  return ctx;
}
