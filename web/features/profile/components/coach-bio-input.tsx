import React from 'react';

interface CoachBioInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function CoachBioInput({ value, onChange, error }: CoachBioInputProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr', alignItems: 'start', gap: 16 }}>
      <label
        htmlFor="coach-bio"
        style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)', paddingTop: 10 }}
      >
        教练简介
      </label>
      <div>
        <textarea
          id="coach-bio"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="介绍一下自己"
          rows={6}
          style={{
            width: '100%',
            padding: '10px 12px',
            border: error ? '1px solid var(--danger)' : '1px solid var(--surface-3)',
            borderRadius: 0,
            boxSizing: 'border-box',
            fontSize: 16,
            lineHeight: 1.5,
            resize: 'vertical',
            minHeight: 160,
            background: 'var(--surface-2)',
            color: 'var(--text-1)',
          }}
        />
        {error && (
          <div style={{ marginTop: 6, color: 'var(--danger)', fontSize: 12 }}>{error}</div>
        )}
      </div>
    </div>
  );
}
