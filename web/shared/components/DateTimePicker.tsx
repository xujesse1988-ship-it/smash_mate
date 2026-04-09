import React, { useState, useEffect, useRef } from 'react';

// ---------------------------------------------------------------------------
// DateTimePicker — Unified date + time picker component
//   Top: scrollable date selector (today + next 30 days)
//   Bottom: hour and minute scroll columns
// ---------------------------------------------------------------------------

interface DateTimePickerProps {
  value?: string; // ISO string or datetime-local string
  onChange: (isoString: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  style?: React.CSSProperties;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getDayLabel(d: Date, today: Date) {
  if (isSameDay(d, today)) return '今天';
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (isSameDay(d, tomorrow)) return '明天';
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return `周${weekdays[d.getDay()]}`;
}

function generateDates(count: number): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d);
  }
  return dates;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = '选择日期和时间',
  label,
  error,
  style,
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse the current value
  const parsed = value ? new Date(value) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
    if (parsed && !isNaN(parsed.getTime())) {
      const d = new Date(parsed);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    return null;
  });

  const [selectedHour, setSelectedHour] = useState<number>(() => {
    if (parsed && !isNaN(parsed.getTime())) return parsed.getHours();
    return new Date().getHours();
  });

  const [selectedMinute, setSelectedMinute] = useState<number>(() => {
    if (parsed && !isNaN(parsed.getTime())) return parsed.getMinutes();
    return 0;
  });

  // Sync from external value changes
  useEffect(() => {
    if (value) {
      const p = new Date(value);
      if (!isNaN(p.getTime())) {
        const d = new Date(p);
        d.setHours(0, 0, 0, 0);
        setSelectedDate(d);
        setSelectedHour(p.getHours());
        setSelectedMinute(p.getMinutes());
      }
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const dates = generateDates(30);

  const handleConfirm = () => {
    if (!selectedDate) return;
    const result = new Date(selectedDate);
    result.setHours(selectedHour, selectedMinute, 0, 0);
    onChange(result.toISOString());
    setIsOpen(false);
  };

  const displayText = (() => {
    if (!parsed || isNaN(parsed.getTime())) return '';
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const dayLabel = getDayLabel(parsed, new Date());
    const month = parsed.getMonth() + 1;
    const day = parsed.getDate();
    const weekday = `周${weekdays[parsed.getDay()]}`;
    const time = `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
    return `${month}月${day}日 ${isSameDay(parsed, new Date()) || isSameDay(parsed, (() => { const t = new Date(); t.setDate(t.getDate() + 1); return t; })()) ? dayLabel : weekday} ${time}`;
  })();

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      {label && (
        <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>{label}</div>
      )}

      {/* Display input */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '10px 12px',
          border: `1px solid ${error ? '#ff4d4f' : isOpen ? '#00C853' : '#e0e0e0'}`,
          borderRadius: 10,
          fontSize: 14,
          color: displayText ? '#333' : '#bbb',
          cursor: 'pointer',
          background: '#fff',
          boxSizing: 'border-box',
          transition: 'border-color 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>{displayText || placeholder}</span>
        <span style={{ fontSize: 12, color: '#bbb' }}>📅</span>
      </div>

      {error && (
        <div style={{ fontSize: 12, color: '#ff4d4f', marginTop: 4 }}>{error}</div>
      )}

      {/* Dropdown picker */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: '#fff',
            borderRadius: 14,
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            zIndex: 1000,
            overflow: 'hidden',
            border: '1px solid #f0f0f0',
          }}
        >
          {/* Date selector — horizontal scroll */}
          <div style={{ padding: '14px 0 10px 0' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#555', paddingLeft: 16, marginBottom: 10 }}>
              选择日期
            </div>
            <div
              style={{
                display: 'flex',
                overflowX: 'auto',
                gap: 6,
                padding: '0 12px 8px 12px',
                scrollbarWidth: 'none',
              }}
            >
              {dates.map((d) => {
                const isSelected = selectedDate && isSameDay(d, selectedDate);
                const isToday = isSameDay(d, today);
                return (
                  <div
                    key={d.toISOString()}
                    onClick={() => setSelectedDate(d)}
                    style={{
                      flexShrink: 0,
                      width: 56,
                      padding: '8px 0',
                      textAlign: 'center',
                      borderRadius: 10,
                      cursor: 'pointer',
                      background: isSelected ? '#00C853' : isToday ? '#f0faf4' : '#fafafa',
                      color: isSelected ? '#fff' : '#333',
                      border: isSelected ? '1px solid #00C853' : isToday ? '1px solid #c8e6c9' : '1px solid #f0f0f0',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: 11, opacity: isSelected ? 1 : 0.6 }}>
                      {getDayLabel(d, today)}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>
                      {d.getDate()}
                    </div>
                    <div style={{ fontSize: 10, opacity: isSelected ? 1 : 0.5, marginTop: 1 }}>
                      {d.getMonth() + 1}月
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: '#f0f0f0', margin: '0 16px' }} />

          {/* Time selector — hour and minute columns */}
          <div style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 10 }}>
              选择时间
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              {/* Hour column */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#999', textAlign: 'center', marginBottom: 6 }}>时</div>
                <div
                  style={{
                    height: 160,
                    overflowY: 'auto',
                    borderRadius: 10,
                    background: '#fafafa',
                    border: '1px solid #f0f0f0',
                    scrollbarWidth: 'thin',
                  }}
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <div
                      key={i}
                      onClick={() => setSelectedHour(i)}
                      style={{
                        padding: '8px 0',
                        textAlign: 'center',
                        fontSize: 15,
                        fontWeight: selectedHour === i ? 600 : 400,
                        color: selectedHour === i ? '#fff' : '#555',
                        background: selectedHour === i ? '#00C853' : 'transparent',
                        borderRadius: 6,
                        margin: '2px 4px',
                        cursor: 'pointer',
                        transition: 'all 0.1s',
                      }}
                    >
                      {pad(i)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Separator */}
              <div style={{ display: 'flex', alignItems: 'center', fontSize: 20, color: '#ccc', fontWeight: 700 }}>
                :
              </div>

              {/* Minute column */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#999', textAlign: 'center', marginBottom: 6 }}>分</div>
                <div
                  style={{
                    height: 160,
                    overflowY: 'auto',
                    borderRadius: 10,
                    background: '#fafafa',
                    border: '1px solid #f0f0f0',
                    scrollbarWidth: 'thin',
                  }}
                >
                  {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                    <div
                      key={m}
                      onClick={() => setSelectedMinute(m)}
                      style={{
                        padding: '8px 0',
                        textAlign: 'center',
                        fontSize: 15,
                        fontWeight: selectedMinute === m ? 600 : 400,
                        color: selectedMinute === m ? '#fff' : '#555',
                        background: selectedMinute === m ? '#00C853' : 'transparent',
                        borderRadius: 6,
                        margin: '2px 4px',
                        cursor: 'pointer',
                        transition: 'all 0.1s',
                      }}
                    >
                      {pad(m)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Confirm button */}
          <div style={{ padding: '10px 16px 14px 16px' }}>
            <button
              onClick={handleConfirm}
              disabled={!selectedDate}
              style={{
                width: '100%',
                padding: '10px 0',
                background: selectedDate ? '#00C853' : '#e0e0e0',
                color: selectedDate ? '#fff' : '#999',
                border: 'none',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 600,
                cursor: selectedDate ? 'pointer' : 'not-allowed',
                transition: 'background 0.2s',
              }}
            >
              确定 · {selectedDate
                ? `${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日 ${pad(selectedHour)}:${pad(selectedMinute)}`
                : '请先选择日期'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
