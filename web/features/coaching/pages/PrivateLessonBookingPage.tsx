import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useCoachAvailability } from '../hooks/useCoachAvailability';
import { useBookPrivateLesson } from '../hooks/useBookPrivateLesson';
import type { AvailabilitySlot } from '../api/coaching-api';

export function PrivateLessonBookingPage() {
  const { id: coachId } = useParams<{ id: string }>();

  const { data, isLoading, error } = useCoachAvailability(coachId || '');
  const bookMutation = useBookPrivateLesson();

  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [showBookingConfirm, setShowBookingConfirm] = useState(false);

  if (isLoading) return <div>加载中...</div>;
  if (error) return <div>加载失败：教练不存在</div>;

  const slots = data?.slots ?? [];

  const handleSelectSlot = (slot: AvailabilitySlot) => {
    if (slot.isBooked) return;
    setSelectedSlot(slot);
    // Auto-select venue if only one
    if (slot.venues.length === 1) {
      setSelectedVenueId(slot.venues[0].id);
    } else if (slot.venues.length === 0) {
      setSelectedVenueId(null);
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
      <div style={{ marginBottom: '16px', color: '#666' }}>日期范围</div>

      {slots.length === 0 && !isLoading && (
        <div style={{ color: '#999', textAlign: 'center', padding: '24px' }}>暂无可预约时间段</div>
      )}

      {slots.map((slot) => (
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
                {new Date(slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {' - '}
                {new Date(slot.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
      {selectedSlot && canConfirm && (
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
            <p>确认预约？</p>
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
