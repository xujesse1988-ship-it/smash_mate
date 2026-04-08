import React from 'react';

interface PhoneDisplayProps {
  phone: string;
}

export function PhoneDisplay({ phone }: PhoneDisplayProps) {
  return (
    <div>
      <span>手机号</span>
      <span>{phone}</span>
    </div>
  );
}
