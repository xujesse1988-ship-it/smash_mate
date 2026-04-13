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
    <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr', alignItems: 'start', gap: 16 }}>
      <label style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', paddingTop: 10 }}>
        教学方向
      </label>
      <div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 4 }}>
          {SPECIALTY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onToggle(option.value)}
              aria-pressed={specialties.includes(option.value)}
              style={{
                background: specialties.includes(option.value)
                  ? 'var(--primary)'
                  : 'var(--surface-2)',
                color: specialties.includes(option.value) ? '#052e16' : 'var(--text-3)',
                border: 'none',
                borderRadius: 18,
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
                transition: 'all 0.2s ease',
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
        {error && (
          <div style={{ marginTop: 6, color: 'var(--danger)', fontSize: 12 }}>{error}</div>
        )}
      </div>
    </div>
  );
}
