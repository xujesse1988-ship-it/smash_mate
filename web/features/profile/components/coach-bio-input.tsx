import React from 'react';

interface CoachBioInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function CoachBioInput({ value, onChange, error }: CoachBioInputProps) {
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
      <div style={{ marginBottom: 14 }}>
        <label
          htmlFor="coach-bio"
          style={{ display: 'block', fontSize: 20, fontWeight: 700, color: '#111' }}
        >
          教练简介
        </label>
        <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.6, color: '#6b7280' }}>
          用几句话介绍你的教学经验、擅长风格和适合的学员类型。
        </p>
      </div>

      <textarea
        id="coach-bio"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="输入教练简介"
        style={{
          width: '100%',
          minHeight: 144,
          padding: '16px 18px',
          borderRadius: 18,
          border: error ? '1px solid #ef4444' : '1px solid #dbe1ea',
          background: error ? '#fff7f7' : '#f8fafc',
          boxSizing: 'border-box',
          fontSize: 15,
          lineHeight: 1.7,
          color: '#111',
          resize: 'vertical',
          outline: 'none',
        }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginTop: 10,
        }}
      >
        <span style={{ fontSize: 12, color: error ? '#dc2626' : '#94a3b8' }}>
          {error || '简介越具体，学员越容易了解你的教学特点'}
        </span>
        <span style={{ fontSize: 12, color: value.length > 450 ? '#f59e0b' : '#94a3b8' }}>
          {value.length}/500
        </span>
      </div>
    </section>
  );
}
