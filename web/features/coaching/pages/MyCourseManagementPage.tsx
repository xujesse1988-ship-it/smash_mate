import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../stores/auth-store';
import { useCurrentUser } from '../../../shared/hooks/useCurrentUser';
import { CoachGuard } from '../../../shared/components/CoachGuard';
import { useCoachProfile } from '../hooks/useCoachProfile';
import { useCoachAvailability } from '../hooks/useCoachAvailability';
import { useCoachPrivateLessons } from '../hooks/useCoachPrivateLessons';
import { useCreateGroupClass } from '../hooks/useCreateGroupClass';
import { useUpdateGroupClass } from '../hooks/useUpdateGroupClass';
import { useCancelGroupClass } from '../hooks/useCancelGroupClass';
import { useSetAvailability } from '../hooks/useSetAvailability';
import { useCancelPrivateLesson } from '../hooks/useCancelPrivateLesson';
import { DateTimePicker } from '../../../shared/components/DateTimePicker';
import { VenueSearchInput } from '../../activity/components/venue-search-input';
import type { VenueSearchItem } from '../../activity/api/venue-api';
import { StudentClassListView } from '../components/StudentClassListView';

export function MyCourseManagementPage() {
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.userId);
  const { data: currentUser, isLoading: isUserLoading } = useCurrentUser();

  const { data: coachProfile, isLoading: isProfileLoading } = useCoachProfile(userId || '');
  const { data: availability } = useCoachAvailability(userId || '');
  const { data: privateLessonsData } = useCoachPrivateLessons(userId || '');

  const createGroupClassMutation = useCreateGroupClass();
  const updateGroupClassMutation = useUpdateGroupClass();
  const cancelGroupClassMutation = useCancelGroupClass();
  const setAvailabilityMutation = useSetAvailability();
  const cancelPrivateLessonMutation = useCancelPrivateLesson();

  const [activeTab, setActiveTab] = useState<
    'group-classes' | 'private-schedule' | 'private-lessons' | 'student-classes'
  >('group-classes');
  const [showCreateClassModal, setShowCreateClassModal] = useState(false);
  const [showEditClassModal, setShowEditClassModal] = useState(false);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [showCancelClassConfirm, setShowCancelClassConfirm] = useState(false);
  const [cancellingClassId, setCancellingClassId] = useState<string | null>(null);
  const [showAddSlotModal, setShowAddSlotModal] = useState(false);
  const [showCancelLessonConfirm, setShowCancelLessonConfirm] = useState(false);
  const [cancellingLessonId, setCancellingLessonId] = useState<string | null>(null);

  // Form states for create/edit group class
  const [formTitle, setFormTitle] = useState('');
  const [formVenue, setFormVenue] = useState<VenueSearchItem | null>(null);
  const [formStartTime, setFormStartTime] = useState('');
  const [formEndTime, setFormEndTime] = useState('');
  const [formMaxParticipants, setFormMaxParticipants] = useState(10);
  const [formFeeDescription, setFormFeeDescription] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Form states for add slot (batch support)
  const [slotFormItems, setSlotFormItems] = useState<
    Array<{
      startTime: string;
      endTime: string;
      feeDescription: string;
    }>
  >([{ startTime: '', endTime: '', feeDescription: '' }]);

  if (isUserLoading || isProfileLoading) return <div>加载中...</div>;
  if (currentUser && !currentUser.isCoach) {
    return (
      <CoachGuard onNavigateToSettings={() => navigate('/settings')} message="请先开启教练角色" />
    );
  }

  const groupClasses = coachProfile?.groupClasses ?? [];
  const slots = availability?.slots ?? [];
  const privateLessons = privateLessonsData?.items ?? [];

  const resetCreateForm = () => {
    setFormTitle('');
    setFormVenue(null);
    setFormStartTime('');
    setFormEndTime('');
    setFormMaxParticipants(10);
    setFormFeeDescription('');
    setFormErrors({});
  };

  const handleCreateGroupClass = () => {
    const errors: Record<string, string> = {};
    if (!formTitle.trim()) {
      errors.title = '请输入课程名称';
    }
    if (!formVenue) {
      errors.venueId = '请选择球馆';
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    createGroupClassMutation.mutate(
      {
        venueId: formVenue!.id,
        title: formTitle,
        startTime: formStartTime ? new Date(formStartTime).toISOString() : '',
        endTime: formEndTime ? new Date(formEndTime).toISOString() : '',
        maxParticipants: formMaxParticipants,
        feeDescription: formFeeDescription || undefined,
      },
      {
        onSuccess: () => {
          setShowCreateClassModal(false);
          resetCreateForm();
        },
      },
    );
  };

  const handleUpdateGroupClass = () => {
    const errors: Record<string, string> = {};
    if (!editingClassId) return;
    if (!formTitle.trim()) {
      errors.title = '请输入课程名称';
    }
    if (!formVenue) {
      errors.venueId = '请选择球馆';
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    updateGroupClassMutation.mutate(
      {
        id: editingClassId,
        data: {
          title: formTitle,
          venueId: formVenue!.id,
          startTime: formStartTime ? new Date(formStartTime).toISOString() : undefined,
          endTime: formEndTime ? new Date(formEndTime).toISOString() : undefined,
          maxParticipants: formMaxParticipants,
          feeDescription: formFeeDescription || undefined,
        },
      },
      {
        onSuccess: () => {
          setShowEditClassModal(false);
          setEditingClassId(null);
          resetCreateForm();
        },
      },
    );
  };

  const handleCancelGroupClass = () => {
    if (cancellingClassId) {
      cancelGroupClassMutation.mutate(cancellingClassId);
      setShowCancelClassConfirm(false);
      setCancellingClassId(null);
    }
  };

  const handleAddSlot = () => {
    // Validate all slot items have required fields
    const validSlots = slotFormItems.filter((item) => item.startTime && item.endTime);
    if (validSlots.length === 0) return;

    setAvailabilityMutation.mutate(
      {
        slots: validSlots.map((item) => ({
          startTime: new Date(item.startTime).toISOString(),
          endTime: new Date(item.endTime).toISOString(),
          feeDescription: item.feeDescription || undefined,
        })),
      },
      {
        onSuccess: () => {
          setShowAddSlotModal(false);
          setSlotFormItems([{ startTime: '', endTime: '', feeDescription: '' }]);
        },
      },
    );
  };

  const handleAddMoreSlot = () => {
    setSlotFormItems((prev) => [...prev, { startTime: '', endTime: '', feeDescription: '' }]);
  };

  const handleRemoveSlotItem = (index: number) => {
    setSlotFormItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateSlotItem = (
    index: number,
    field: 'startTime' | 'endTime' | 'feeDescription',
    value: string,
  ) => {
    setSlotFormItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const handleCancelPrivateLesson = () => {
    if (cancellingLessonId) {
      cancelPrivateLessonMutation.mutate(cancellingLessonId);
      setShowCancelLessonConfirm(false);
      setCancellingLessonId(null);
    }
  };

  return (
    <div style={{ padding: '16px' }}>
      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--surface-2)',
          marginBottom: '16px',
        }}
      >
        <button
          onClick={() => setActiveTab('group-classes')}
          style={{
            flex: 1,
            padding: '8px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom:
              activeTab === 'group-classes' ? '2px solid var(--primary)' : '2px solid transparent',
            fontWeight: activeTab === 'group-classes' ? 600 : 400,
            color: activeTab === 'group-classes' ? 'var(--text-1)' : 'var(--text-3)',
          }}
        >
          团课
        </button>
        <button
          onClick={() => setActiveTab('private-schedule')}
          style={{
            flex: 1,
            padding: '8px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom:
              activeTab === 'private-schedule'
                ? '2px solid var(--primary)'
                : '2px solid transparent',
            fontWeight: activeTab === 'private-schedule' ? 600 : 400,
            color: activeTab === 'private-schedule' ? 'var(--text-1)' : 'var(--text-3)',
          }}
        >
          私教时间
        </button>
        <button
          onClick={() => setActiveTab('private-lessons')}
          style={{
            flex: 1,
            padding: '8px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom:
              activeTab === 'private-lessons'
                ? '2px solid var(--primary)'
                : '2px solid transparent',
            fontWeight: activeTab === 'private-lessons' ? 600 : 400,
            color: activeTab === 'private-lessons' ? 'var(--text-1)' : 'var(--text-3)',
          }}
        >
          私教预约
        </button>
        <button
          onClick={() => setActiveTab('student-classes')}
          style={{
            flex: 1,
            padding: '8px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom:
              activeTab === 'student-classes'
                ? '2px solid var(--primary)'
                : '2px solid transparent',
            fontWeight: activeTab === 'student-classes' ? 600 : 400,
            color: activeTab === 'student-classes' ? 'var(--text-1)' : 'var(--text-3)',
          }}
        >
          学员班
        </button>
      </div>

      {/* Group Classes Tab */}
      {activeTab === 'group-classes' && (
        <div>
          <button
            onClick={() => {
              resetCreateForm();
              setShowCreateClassModal(true);
            }}
            style={{
              marginBottom: '16px',
              padding: '8px 16px',
              background: 'var(--primary)',
              color: '#052e16',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            发布团课
          </button>

          {groupClasses.length === 0 && (
            <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: '24px' }}>
              暂无团课
            </div>
          )}

          {groupClasses.map((gc) => (
            <div
              key={gc.id}
              data-testid={`manageable-group-class-${gc.id}`}
              onClick={() => navigate(`/group-classes/${gc.id}`)}
              style={{
                padding: '12px',
                border: '1px solid var(--surface-2)',
                borderRadius: '8px',
                marginBottom: '8px',
                cursor: 'pointer',
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{gc.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
                  {gc.venue?.name || '地点待定'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                  {gc.currentParticipants}/{gc.maxParticipants}人 |{' '}
                  {gc.status === 'open'
                    ? '报名中'
                    : gc.status === 'full'
                      ? '已满员'
                      : gc.status === 'cancelled'
                        ? '已取消'
                        : gc.status}
                </div>
              </div>
              {(gc.status === 'open' || gc.status === 'full') && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingClassId(gc.id);
                      setFormTitle(gc.title);
                      setFormVenue(gc.venue ? { ...gc.venue } : null);
                      setFormStartTime(
                        gc.startTime ? new Date(gc.startTime).toISOString().slice(0, 16) : '',
                      );
                      setFormEndTime(
                        gc.endTime ? new Date(gc.endTime).toISOString().slice(0, 16) : '',
                      );
                      setFormMaxParticipants(gc.maxParticipants);
                      setFormFeeDescription(gc.feeDescription || '');
                      setFormErrors({});
                      setShowEditClassModal(true);
                    }}
                    style={{
                      fontSize: 12,
                      padding: '4px 12px',
                      border: '1px solid var(--surface-2)',
                      borderRadius: '4px',
                      background: 'var(--surface-2)',
                      color: 'var(--text-1)',
                      cursor: 'pointer',
                    }}
                  >
                    修改
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCancellingClassId(gc.id);
                      setShowCancelClassConfirm(true);
                    }}
                    style={{
                      fontSize: 12,
                      padding: '4px 12px',
                      border: '1px solid var(--danger)',
                      borderRadius: '4px',
                      background: 'transparent',
                      color: 'var(--danger)',
                      cursor: 'pointer',
                    }}
                  >
                    取消
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Private Schedule Tab */}
      {activeTab === 'private-schedule' && (
        <div>
          <button
            onClick={() => setShowAddSlotModal(true)}
            style={{
              marginBottom: '16px',
              padding: '8px 16px',
              background: 'var(--primary)',
              color: '#052e16',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            添加时间段
          </button>

          {slots.length === 0 && (
            <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: '24px' }}>
              暂无时间段
            </div>
          )}

          {slots.map((slot) => (
            <div
              key={slot.id}
              style={{
                padding: '12px',
                border: '1px solid var(--surface-2)',
                borderRadius: '8px',
                marginBottom: '8px',
              }}
            >
              <div>
                {new Date(slot.startTime).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {' - '}
                {new Date(slot.endTime).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
              {slot.feeDescription && (
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
                  {slot.feeDescription}
                </div>
              )}
              <span
                style={{
                  fontSize: 12,
                  padding: '1px 6px',
                  borderRadius: '4px',
                  marginTop: 4,
                  display: 'inline-block',
                  background: slot.isBooked ? 'rgba(248,113,113,0.15)' : 'var(--primary-dim)',
                  color: slot.isBooked ? 'var(--danger)' : 'var(--primary)',
                }}
              >
                {slot.isBooked ? '已预约' : '空闲'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Private Lessons Tab */}
      {activeTab === 'private-lessons' && (
        <div>
          {privateLessons.length === 0 && (
            <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: '24px' }}>
              暂无预约
            </div>
          )}

          {privateLessons.map((lesson) => (
            <div
              key={lesson.id}
              style={{
                padding: '12px',
                border: '1px solid var(--surface-2)',
                borderRadius: '8px',
                marginBottom: '8px',
              }}
            >
              <div style={{ fontWeight: 600 }}>{lesson.student.nickname}</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
                {new Date(lesson.slot.startTime).toLocaleString()} -{' '}
                {new Date(lesson.slot.endTime).toLocaleTimeString()}
              </div>
              {lesson.venue && (
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
                  {lesson.venue.name}
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                {lesson.status === 'scheduled'
                  ? '待上课'
                  : lesson.status === 'completed'
                    ? '已结束'
                    : lesson.status === 'cancelled'
                      ? '已取消'
                      : lesson.status}
              </div>
              {lesson.status === 'scheduled' && (
                <button
                  onClick={() => {
                    setCancellingLessonId(lesson.id);
                    setShowCancelLessonConfirm(true);
                  }}
                  style={{
                    marginTop: '8px',
                    fontSize: 12,
                    padding: '4px 12px',
                    border: '1px solid var(--danger)',
                    borderRadius: '4px',
                    background: 'transparent',
                    color: 'var(--danger)',
                    cursor: 'pointer',
                  }}
                >
                  取消
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Student Classes Tab */}
      {activeTab === 'student-classes' && <StudentClassListView />}

      {/* Create Group Class Modal */}
      {showCreateClassModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: '12px',
              padding: '24px',
              width: '90%',
              maxWidth: '400px',
              maxHeight: '85vh',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <h3>发布团课</h3>
            <div style={{ marginBottom: '12px' }}>
              <label>课程名称</label>
              <input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="请输入课程名称"
                style={{ width: '100%', padding: '8px', marginTop: '4px', boxSizing: 'border-box' }}
              />
              {formErrors.title && (
                <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                  {formErrors.title}
                </div>
              )}
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label>球馆</label>
              <VenueSearchInput
                selectedVenue={formVenue}
                onChangeSelection={(venue) => {
                  setFormVenue(venue);
                  if (venue) {
                    setFormErrors((prev) => {
                      const next = { ...prev };
                      delete next.venueId;
                      return next;
                    });
                  }
                }}
                placeholder="搜索球馆"
                helperText="输入球馆名称后，从搜索结果中选择"
                error={formErrors.venueId}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <DateTimePicker
                label="开始时间"
                value={formStartTime || undefined}
                onChange={(iso) => setFormStartTime(iso)}
                placeholder="选择开始时间"
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <DateTimePicker
                label="结束时间"
                value={formEndTime || undefined}
                onChange={(iso) => setFormEndTime(iso)}
                placeholder="选择结束时间"
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label>限定人数</label>
              <input
                type="number"
                value={formMaxParticipants}
                onChange={(e) => setFormMaxParticipants(Number(e.target.value))}
                min={2}
                max={30}
                style={{ width: '100%', padding: '8px', marginTop: '4px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label>费用说明（选填）</label>
              <input
                value={formFeeDescription}
                onChange={(e) => setFormFeeDescription(e.target.value)}
                placeholder="如：200元/人"
                style={{ width: '100%', padding: '8px', marginTop: '4px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCreateClassModal(false)}
                style={{
                  padding: '6px 16px',
                  border: '1px solid var(--surface-2)',
                  borderRadius: '6px',
                  background: 'var(--surface-2)',
                  color: 'var(--text-1)',
                  cursor: 'pointer',
                }}
              >
                取消
              </button>
              <button
                onClick={handleCreateGroupClass}
                disabled={createGroupClassMutation.isPending}
                style={{
                  padding: '6px 16px',
                  background: 'var(--primary)',
                  color: '#052e16',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                提交
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Group Class Modal */}
      {showEditClassModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: '12px',
              padding: '24px',
              width: '90%',
              maxWidth: '400px',
              maxHeight: '85vh',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <h3>修改团课</h3>
            <div style={{ marginBottom: '12px' }}>
              <label>课程名称</label>
              <input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="请输入课程名称"
                style={{ width: '100%', padding: '8px', marginTop: '4px', boxSizing: 'border-box' }}
              />
              {formErrors.title && (
                <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                  {formErrors.title}
                </div>
              )}
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label>球馆</label>
              <VenueSearchInput
                selectedVenue={formVenue}
                onChangeSelection={(venue) => {
                  setFormVenue(venue);
                  if (venue) {
                    setFormErrors((prev) => {
                      const next = { ...prev };
                      delete next.venueId;
                      return next;
                    });
                  }
                }}
                placeholder="搜索球馆"
                helperText="输入球馆名称后，从搜索结果中选择"
                error={formErrors.venueId}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <DateTimePicker
                label="开始时间"
                value={formStartTime || undefined}
                onChange={(iso) => setFormStartTime(iso)}
                placeholder="选择开始时间"
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <DateTimePicker
                label="结束时间"
                value={formEndTime || undefined}
                onChange={(iso) => setFormEndTime(iso)}
                placeholder="选择结束时间"
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label>限定人数</label>
              <input
                type="number"
                value={formMaxParticipants}
                onChange={(e) => setFormMaxParticipants(Number(e.target.value))}
                min={2}
                max={30}
                style={{ width: '100%', padding: '8px', marginTop: '4px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label>费用说明（选填）</label>
              <input
                value={formFeeDescription}
                onChange={(e) => setFormFeeDescription(e.target.value)}
                placeholder="如：200元/人"
                style={{ width: '100%', padding: '8px', marginTop: '4px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowEditClassModal(false)}
                style={{
                  padding: '6px 16px',
                  border: '1px solid var(--surface-2)',
                  borderRadius: '6px',
                  background: 'var(--surface-2)',
                  color: 'var(--text-1)',
                  cursor: 'pointer',
                }}
              >
                取消
              </button>
              <button
                onClick={handleUpdateGroupClass}
                disabled={updateGroupClassMutation.isPending}
                style={{
                  padding: '6px 16px',
                  background: 'var(--primary)',
                  color: '#052e16',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                提交
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Slot Modal (batch support) */}
      {showAddSlotModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: '12px',
              padding: '24px',
              width: '90%',
              maxWidth: '400px',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >
            <h3>添加私教时间段</h3>
            {slotFormItems.map((item, index) => (
              <div
                key={index}
                style={{
                  marginBottom: '16px',
                  padding: '12px',
                  border: '1px solid var(--surface-2)',
                  borderRadius: '8px',
                  position: 'relative',
                }}
              >
                {slotFormItems.length > 1 && (
                  <button
                    onClick={() => handleRemoveSlotItem(index)}
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-3)',
                      fontSize: 16,
                    }}
                  >
                    x
                  </button>
                )}
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>
                  时间段 {index + 1}
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <DateTimePicker
                    label="开始时间"
                    value={item.startTime || undefined}
                    onChange={(iso) => handleUpdateSlotItem(index, 'startTime', iso)}
                    placeholder="选择开始时间"
                  />
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <DateTimePicker
                    label="结束时间"
                    value={item.endTime || undefined}
                    onChange={(iso) => handleUpdateSlotItem(index, 'endTime', iso)}
                    placeholder="选择结束时间"
                  />
                </div>
                <div>
                  <label>费用说明（选填）</label>
                  <input
                    value={item.feeDescription}
                    onChange={(e) => handleUpdateSlotItem(index, 'feeDescription', e.target.value)}
                    placeholder="如：300元/小时"
                    style={{
                      width: '100%',
                      padding: '8px',
                      marginTop: '4px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
            ))}
            <button
              onClick={handleAddMoreSlot}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px dashed var(--surface-3)',
                borderRadius: '8px',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--primary)',
                marginBottom: '16px',
              }}
            >
              + 再添加一个时间段
            </button>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowAddSlotModal(false);
                  setSlotFormItems([{ startTime: '', endTime: '', feeDescription: '' }]);
                }}
                style={{
                  padding: '6px 16px',
                  border: '1px solid var(--surface-2)',
                  borderRadius: '6px',
                  background: 'var(--surface-2)',
                  color: 'var(--text-1)',
                  cursor: 'pointer',
                }}
              >
                取消
              </button>
              <button
                onClick={handleAddSlot}
                disabled={setAvailabilityMutation.isPending}
                style={{
                  padding: '6px 16px',
                  background: 'var(--primary)',
                  color: '#052e16',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                提交
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Group Class Confirm */}
      {showCancelClassConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: '12px',
              padding: '24px',
              width: '80%',
              maxWidth: '360px',
            }}
          >
            <p>是否取消该团课？</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowCancelClassConfirm(false);
                  setCancellingClassId(null);
                }}
                style={{
                  padding: '6px 16px',
                  border: '1px solid var(--surface-2)',
                  borderRadius: '6px',
                  background: 'var(--surface-2)',
                  color: 'var(--text-1)',
                  cursor: 'pointer',
                }}
              >
                返回
              </button>
              <button
                onClick={handleCancelGroupClass}
                style={{
                  padding: '6px 16px',
                  background: 'var(--danger)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Private Lesson Confirm */}
      {showCancelLessonConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: '12px',
              padding: '24px',
              width: '80%',
              maxWidth: '360px',
            }}
          >
            <p>是否取消该私教预约？</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowCancelLessonConfirm(false);
                  setCancellingLessonId(null);
                }}
                style={{
                  padding: '6px 16px',
                  border: '1px solid var(--surface-2)',
                  borderRadius: '6px',
                  background: 'var(--surface-2)',
                  color: 'var(--text-1)',
                  cursor: 'pointer',
                }}
              >
                返回
              </button>
              <button
                onClick={handleCancelPrivateLesson}
                style={{
                  padding: '6px 16px',
                  background: 'var(--danger)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
