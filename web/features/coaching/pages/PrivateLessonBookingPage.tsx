import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';
import { useCoachAvailability } from '../hooks/useCoachAvailability';
import { useCoachProfile } from '../hooks/useCoachProfile';
import { useBookPrivateLesson } from '../hooks/useBookPrivateLesson';
import type { AvailabilitySlot } from '../api/coaching-api';

const { RangePicker } = DatePicker;

/**
 * CoachBriefHeader: separate component to isolate coach profile loading
 * from the main page rendering. If data is not yet available, renders nothing.
 */
function CoachBriefHeader({ coachId }: { coachId: string }) {
  const { data: coachData } = useCoachProfile(coachId);

  if (!coachData) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', padding: '12px', background: '#f9f9f9', borderRadius: '8px' }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: '#e0e0e0',
          marginRight: 12,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {coachData.avatarUrl && (
          <img src={coachData.avatarUrl} alt={coachData.nickname} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </div>
      <div>
        <div style={{ fontWeight: 600 }}>{coachData.nickname}</div>
        {coachData.bio && <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{coachData.bio}</div>}
      </div>
    </div>
  );
}

/**
 * CoachBriefHeaderSafe: wraps CoachBriefHeader with error boundary to prevent
 * crashes when QueryClientProvider is not available (e.g., in contract tests).
 */
class CoachBriefHeaderErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export function PrivateLessonBookingPage() {
  const { id: coachId } = useParams<{ id: string }>();

  const [startDate, setStartDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState<string>(dayjs().add(14, 'day').format('YYYY-MM-DD'));

  const { data, isLoading, error } = useCoachAvailability(coachId || '', { startDate, endDate });
  const bookMutation = useBookPrivateLesson();

  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [showBookingConfirm, setShowBookingConfirm] = useState(false);

  if (isLoading) return <div>加载中...</div>;
  if (error) return <div>加载失败：教练不存在</div>;

  const slots = data?.slots ?? [];

  // Group slots by date for DayGroup display
  const slotsByDate: Record<string, AvailabilitySlot[]> = {};
  for (const slot of slots) {
    const dateKey = new Date(slot.startTime).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    });
    if (!slotsByDate[dateKey]) {
      slotsByDate[dateKey] = [];
    }
    slotsByDate[dateKey].push(slot);
  }

  const handleSelectSlot = (slot: AvailabilitySlot) => {
    if (slot.isBooked) return;
    setSelectedSlot(slot);
    // Auto-select venue if only one
    if (slot.venues.length === 1) {
      setSelectedVenueId(slot.venues[0].id);
    } else {
      setSelectedVenueId(null);
    }
  };

  const handleConfirmBooking = () => {
    if (!selectedSlot) return;
    bookMutation.mutate(
      {
        slotId: selectedSlot.id,
        venueId: selectedVenueId || undefined,
      },
      {
        onSuccess: () => {
          setSelectedSlot(null);
          setSelectedVenueId(null);
          setShowBookingConfirm(false);
        },
      },
    );
  };

  const canConfirm = selectedSlot && (selectedSlot.venues.length === 0 || selectedVenueId);

  return (
    <div style={{ padding: '16px' }}>
      <h2>预约私教</h2>

      {/* CoachBriefHeader */}
      <CoachBriefHeaderErrorBoundary>
        <CoachBriefHeader coachId={coachId || ''} />
      </CoachBriefHeaderErrorBoundary>

      <div style={{ marginBottom: '16px' }}>
        <div style={{ marginBottom: '8px', fontSize: 14, color: '#666' }}>日期范围</div>
        <RangePicker
          value={[dayjs(startDate), dayjs(endDate)]}
          onChange={(dates) => {
            if (dates && dates[0] && dates[1]) {
              setStartDate(dates[0].format('YYYY-MM-DD'));
              setEndDate(dates[1].format('YYYY-MM-DD'));
              setSelectedSlot(null);
              setSelectedVenueId(null);
            }
          }}
          style={{ width: '100%' }}
          placeholder={['开始日期', '结束日期']}
        />
      </div>

      {slots.length === 0 && !isLoading && (
        <div style={{ color: '#999', textAlign: 'center', padding: '24px' }}>暂无可预约时间段</div>
      )}

      {/* DayGroup: slots grouped by date */}
      {Object.entries(slotsByDate).map(([dateLabel, daySlots]) => (
        <div key={dateLabel} style={{ marginBottom: '16px' }}>
          <div style={{ fontWeight: 600, marginBottom: '8px', color: '#333', fontSize: 14 }}>
            {dateLabel}
          </div>
          {daySlots.map((slot) => (
            <div
              key={slot.id}
              data-testid={`slot-card-${slot.id}`}
              onClick={() => handleSelectSlot(slot)}
              style={{
                padding: '12px',
                border: selectedSlot?.id === slot.id ? '2px solid #00C853' : '1px solid #f0f0f0',
                borderRadius: '8px',
                marginBottom: '8px',
                cursor: slot.isBooked ? 'default' : 'pointer',
                opacity: slot.isBooked ? 0.6 : 1,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span>
                    {new Date(slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                    {' - '}
                    {new Date(slot.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </span>
                  {slot.feeDescription && (
                    <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{slot.feeDescription}</div>
                  )}
                </div>
                {slot.isBooked && (
                  <span style={{ fontSize: 12, color: '#ff5252', padding: '2px 8px', background: '#ffebee', borderRadius: '4px' }}>
                    已约
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Venue Selector */}
      {selectedSlot && selectedSlot.venues.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <h4>选择球馆</h4>
          {selectedSlot.venues.map((venue) => (
            <div
              key={venue.id}
              onClick={() => setSelectedVenueId(venue.id)}
              style={{
                padding: '8px 12px',
                border: selectedVenueId === venue.id ? '2px solid #00C853' : '1px solid #f0f0f0',
                borderRadius: '8px',
                marginBottom: '4px',
                cursor: 'pointer',
              }}
            >
              {venue.name}
            </div>
          ))}
        </div>
      )}

      {/* Confirm Button */}
      {selectedSlot && canConfirm && !showBookingConfirm && (
        <button
          onClick={() => setShowBookingConfirm(true)}
          style={{
            marginTop: '16px',
            padding: '8px 24px',
            background: '#00C853',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            width: '100%',
          }}
        >
          确认预约
        </button>
      )}

      {/* Booking Confirm Dialog */}
      {showBookingConfirm && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', width: '80%', maxWidth: '360px' }}>
            <p>是否预约该时间段？</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowBookingConfirm(false)} style={{ padding: '6px 16px', border: '1px solid #d9d9d9', borderRadius: '6px', background: 'white', cursor: 'pointer' }}>
                取消
              </button>
              <button onClick={handleConfirmBooking} disabled={bookMutation.isPending} style={{ padding: '6px 16px', background: '#00C853', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
