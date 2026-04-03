/**
 * Volume slider component with debounced updates.
 * Uses the brand primary color for the filled portion.
 * @module control-ui/components/VolumeSlider
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import './VolumeSlider.css';

interface VolumeSliderProps {
  value: number;
  onChange: (level: number) => void;
  disabled?: boolean;
}

const DEBOUNCE_MS = 300;

export function VolumeSlider({ value, onChange, disabled }: VolumeSliderProps) {
  const [localValue, setLocalValue] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback(
    (newVal: number) => {
      setLocalValue(newVal);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onChange(newVal);
      }, DEBOUNCE_MS);
    },
    [onChange],
  );

  return (
    <div className="volume-slider">
      <input
        type="range"
        min={0}
        max={100}
        value={localValue}
        onChange={(e) => handleChange(Number(e.target.value))}
        disabled={disabled}
        className="volume-range"
        style={{
          background: `linear-gradient(to right, var(--brand-primary) ${localValue}%, var(--color-border) ${localValue}%)`,
        }}
      />
      <span className="volume-value">{localValue}%</span>
    </div>
  );
}
