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
    <section
      style={{
        padding: 20,
        background: '#fff',
        border: '1px solid rgba(17, 17, 17, 0.06)',
        borderRadius: 24,
        boxShadow: '0 14px 40px rgba(17, 17, 17, 0.05)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: 20, fontWeight: 700, color: '#111' }}>
            擅长方向
          </label>
          <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.6, color: '#6b7280' }}>
            选择你的训练专长，找教练页会按这些标签展示和筛选。
          </p>
        </div>
        <span
          style={{
            flexShrink: 0,
            padding: '6px 10px',
            borderRadius: 999,
            background: specialties.length > 0 ? '#ecfdf3' : '#f3f4f6',
            color: specialties.length > 0 ? '#15803d' : '#6b7280',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          已选 {specialties.length} 项
        </span>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {SPECIALTY_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onToggle(option.value)}
            aria-pressed={specialties.includes(option.value)}
            style={{
              background: specialties.includes(option.value)
                ? 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)'
                : '#f8fafc',
              color: specialties.includes(option.value) ? '#fff' : '#1f2937',
              border: specialties.includes(option.value)
                ? '1px solid transparent'
                : '1px solid #dbe1ea',
              borderRadius: 999,
              padding: '10px 16px',
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: 600,
              boxShadow: specialties.includes(option.value)
                ? '0 10px 20px rgba(34, 197, 94, 0.24)'
                : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: error ? '#dc2626' : '#94a3b8' }}>
        {error || '支持多选，建议至少选择 2 项来提升曝光度'}
      </div>
    </section>
  );
}
