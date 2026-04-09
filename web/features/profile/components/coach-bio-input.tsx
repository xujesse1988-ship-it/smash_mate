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
        style={{ fontSize: 16, fontWeight: 500, color: '#111', paddingTop: 10 }}
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
            border: error ? '1px solid #ff4d4f' : '1px solid #cfcfcf',
            borderRadius: 0,
            boxSizing: 'border-box',
            fontSize: 16,
            lineHeight: 1.5,
            resize: 'vertical',
            minHeight: 160,
          }}
        />
        {error && (
          <div style={{ marginTop: 6, color: '#ff4d4f', fontSize: 12 }}>{error}</div>
        )}
      </div>
    </div>
  );
}
