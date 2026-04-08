import React from 'react';
import type { CoachSpecialty } from '../api/profile-api';

const SPECIALTY_OPTIONS: { value: CoachSpecialty; label: string }[] = [
  { value: 'singles', label: '单打' },
  { value: 'doubles', label: '双打' },
  { value: 'footwork', label: '步法' },
  { value: 'fitness', label: '体能' },
  { value: 'tactics', label: '战术' },
];

interface SpecialtySelectorProps {
  specialties: CoachSpecialty[];
  onToggle: (value: CoachSpecialty) => void;
  error?: string;
}

export function SpecialtySelector({ specialties, onToggle, error }: SpecialtySelectorProps) {
  return (
    <div>
      <label>擅长方向</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {SPECIALTY_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onToggle(option.value)}
            style={{
              background: specialties.includes(option.value) ? '#00C853' : '#f0f0f0',
              color: specialties.includes(option.value) ? '#fff' : '#333',
              border: 'none',
              borderRadius: 16,
              padding: '4px 12px',
              cursor: 'pointer',
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
      {error && <div style={{ color: 'red' }}>{error}</div>}
    </div>
  );
}
