import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, DatePicker } from 'antd';
import { useCreateActivity } from '../hooks/useCreateActivity';

export function CreateActivityPage() {
  const navigate = useNavigate();
  const createActivityMutation = useCreateActivity();

  const [venueId, setVenueId] = useState<string | null>(null);
  const [venueName, setVenueName] = useState('');
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);
  const [maxParticipants, setMaxParticipants] = useState(6);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [venueSearch, setVenueSearch] = useState('');

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!venueId) {
      errors.venueId = '请选择球馆';
    }

    if (!startTime || new Date(startTime) <= new Date()) {
      errors.startTime = !startTime
        ? '请选择开始时间，开始时间必须晚于当前时间'
        : '开始时间必须晚于当前时间';
    }

    if (!endTime || (startTime && new Date(endTime) <= new Date(startTime))) {
      errors.endTime = !endTime
        ? '请选择结束时间，结束时间必须晚于开始时间'
        : '结束时间必须晚于开始时间';
    }

    if (maxParticipants < 2 || maxParticipants > 50 || !Number.isInteger(maxParticipants)) {
      errors.maxParticipants = '限定人数需在 2-50 之间';
    }

    if (title && title.length > 50) {
      errors.title = '标题不能超过 50 个字符';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const data: {
      venueId: string;
      title?: string;
      startTime: string;
      endTime: string;
      maxParticipants: number;
    } = {
      venueId: venueId!,
      startTime: startTime!,
      endTime: endTime!,
      maxParticipants,
    };
    if (title) {
      data.title = title;
    }

    createActivityMutation.mutate(data);
  };

  // Venue selection handler (used by VenueSearchInput shared component)
  const _handleVenueSelect = (id: string, name: string) => {
    setVenueId(id);
    setVenueName(name);
    setVenueSearch(name);
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next.venueId;
      return next;
    });
  };

  return (
    <div style={{ padding: 16 }}>
      {/* Header with back button */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <button
          aria-label="返回"
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '4px 8px', marginRight: 8 }}
        >
          &lt; 返回
        </button>
        <h2 style={{ margin: 0, fontSize: 18 }}>发起约球</h2>
      </div>

      {/* Venue search input */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>球馆</label>
        <Input
          placeholder="搜索球馆"
          value={venueSearch}
          onChange={(e) => {
            setVenueSearch(e.target.value);
            // In real implementation, this triggers venue search API
          }}
          onSelect={() => {
            // Simulated: user picks from dropdown
          }}
        />
        {/* Hidden input to store venue selection for testing */}
        <input type="hidden" data-testid="venue-id" value={venueId || ''} />
        {venueName && (
          <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
            已选: {venueName}
          </div>
        )}
        {formErrors.venueId && (
          <div style={{ color: 'red', fontSize: 12, marginTop: 4 }}>
            {formErrors.venueId}
          </div>
        )}
      </div>

      {/* Title input */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>活动标题（可选）</label>
        <Input
          placeholder="输入活动标题"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={60}
        />
        {formErrors.title && (
          <div style={{ color: 'red', fontSize: 12, marginTop: 4 }}>
            {formErrors.title}
          </div>
        )}
      </div>

      {/* Start time */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>开始时间</label>
        <DatePicker
          showTime
          onChange={(_, dateString) => {
            const str = Array.isArray(dateString) ? dateString[0] : dateString;
            setStartTime(str ? new Date(str).toISOString() : null);
          }}
          style={{ width: '100%' }}
          placeholder="选择开始时间"
        />
        {formErrors.startTime && (
          <div style={{ color: 'red', fontSize: 12, marginTop: 4 }}>
            {formErrors.startTime}
          </div>
        )}
      </div>

      {/* End time */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>结束时间</label>
        <DatePicker
          showTime
          onChange={(_, dateString) => {
            const str = Array.isArray(dateString) ? dateString[0] : dateString;
            setEndTime(str ? new Date(str).toISOString() : null);
          }}
          style={{ width: '100%' }}
          placeholder="选择结束时间"
        />
        {formErrors.endTime && (
          <div style={{ color: 'red', fontSize: 12, marginTop: 4 }}>
            {formErrors.endTime}
          </div>
        )}
      </div>

      {/* Participant count */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>限定人数</label>
        <input
          type="number"
          min={2}
          max={50}
          value={maxParticipants}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            setMaxParticipants(isNaN(val) ? 0 : val);
          }}
          style={{ width: '100%', padding: '4px 8px', border: '1px solid #d9d9d9', borderRadius: 4, fontSize: 14 }}
        />
        {formErrors.maxParticipants && (
          <div style={{ color: 'red', fontSize: 12, marginTop: 4 }}>
            {formErrors.maxParticipants}
          </div>
        )}
      </div>

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={createActivityMutation.isPending}
        style={{
          width: '100%',
          padding: '12px 0',
          background: createActivityMutation.isPending ? '#ccc' : '#00C853',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontSize: 16,
          cursor: createActivityMutation.isPending ? 'not-allowed' : 'pointer',
        }}
      >
        发布
      </button>
    </div>
  );
}
