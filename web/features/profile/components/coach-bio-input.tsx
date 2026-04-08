import React from 'react';

interface CoachBioInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function CoachBioInput({ value, onChange, error }: CoachBioInputProps) {
  return (
    <div>
      <label>教练简介</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="输入教练简介"
      />
      {error && <div style={{ color: 'red' }}>{error}</div>}
    </div>
  );
}
