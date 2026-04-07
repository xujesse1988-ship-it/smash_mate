import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../stores/auth-store';
import { useCurrentUser } from '../../../shared/hooks/useCurrentUser';
import { useCoachProfile } from '../hooks/useCoachProfile';
import { useCoachAvailability } from '../hooks/useCoachAvailability';
import { useCoachPrivateLessons } from '../hooks/useCoachPrivateLessons';
import { useCreateGroupClass } from '../hooks/useCreateGroupClass';
import { useUpdateGroupClass } from '../hooks/useUpdateGroupClass';
import { useCancelGroupClass } from '../hooks/useCancelGroupClass';
import { useSetAvailability } from '../hooks/useSetAvailability';
import { useCancelPrivateLesson } from '../hooks/useCancelPrivateLesson';

export function MyCourseManagementPage() {
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.userId);
  const { data: currentUser, isLoading: isUserLoading } = useCurrentUser();

  const { data: coachProfile, isLoading: isProfileLoading } = useCoachProfile(userId || '');
  const { data: availability } = useCoachAvailability(userId || '');
  const { data: privateLessonsData } = useCoachPrivateLessons(userId || '');

  const _createGroupClassMutation = useCreateGroupClass();
  const _updateGroupClassMutation = useUpdateGroupClass();
  const cancelGroupClassMutation = useCancelGroupClass();
  const _setAvailabilityMutation = useSetAvailability();
  const cancelPrivateLessonMutation = useCancelPrivateLesson();

  const [activeTab, setActiveTab] = useState<'group-classes' | 'private-schedule' | 'private-lessons'>('group-classes');
  const [showCreateClassModal, setShowCreateClassModal] = useState(false);
  const [showEditClassModal, setShowEditClassModal] = useState(false);
  const [_editingClassId, setEditingClassId] = useState<string | null>(null);
  const [showCancelClassConfirm, setShowCancelClassConfirm] = useState(false);
  const [cancellingClassId, setCancellingClassId] = useState<string | null>(null);
  const [showAddSlotModal, setShowAddSlotModal] = useState(false);
  const [showCancelLessonConfirm, setShowCancelLessonConfirm] = useState(false);
  const [cancellingLessonId, setCancellingLessonId] = useState<string | null>(null);

  // Form states for create/edit
  const [formTitle, setFormTitle] = useState('');

  if (isUserLoading || isProfileLoading) return <div>加载中...</div>;
  if (currentUser && !currentUser.isCoach) return <div>请先开启教练角色</div>;

  const groupClasses = coachProfile?.groupClasses ?? [];
  const slots = availability?.slots ?? [];
  const privateLessons = privateLessonsData?.items ?? [];

  const handleCancelGroupClass = () => {
    if (cancellingClassId) {
      cancelGroupClassMutation.mutate(cancellingClassId);
      setShowCancelClassConfirm(false);
      setCancellingClassId(null);
    }
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
      <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0', marginBottom: '16px' }}>
        <button
          onClick={() => setActiveTab('group-classes')}
          style={{
            flex: 1, padding: '8px', border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: activeTab === 'group-classes' ? '2px solid #00C853' : '2px solid transparent',
            fontWeight: activeTab === 'group-classes' ? 600 : 400,
          }}
        >
          团课
        </button>
        <button
          onClick={() => setActiveTab('private-schedule')}
          style={{
            flex: 1, padding: '8px', border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: activeTab === 'private-schedule' ? '2px solid #00C853' : '2px solid transparent',
            fontWeight: activeTab === 'private-schedule' ? 600 : 400,
          }}
        >
          私教时间
        </button>
        <button
          onClick={() => setActiveTab('private-lessons')}
          style={{
            flex: 1, padding: '8px', border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: activeTab === 'private-lessons' ? '2px solid #00C853' : '2px solid transparent',
            fontWeight: activeTab === 'private-lessons' ? 600 : 400,
          }}
        >
          私教预约
        </button>
      </div>

      {/* Group Classes Tab */}
      {activeTab === 'group-classes' && (
        <div>
          <button
            onClick={() => {
              setFormTitle('');
              setShowCreateClassModal(true);
            }}
            style={{ marginBottom: '16px', padding: '8px 16px', background: '#00C853', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
          >
            发布团课
          </button>

          {groupClasses.length === 0 && (
            <div style={{ color: '#999', textAlign: 'center', padding: '24px' }}>暂无团课</div>
          )}

          {groupClasses.map((gc) => (
            <div
              key={gc.id}
              data-testid={`manageable-group-class-${gc.id}`}
              onClick={() => navigate(`/group-classes/${gc.id}`)}
              style={{ padding: '12px', border: '1px solid #f0f0f0', borderRadius: '8px', marginBottom: '8px', cursor: 'pointer' }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{gc.title}</div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                  {gc.venue?.name || '地点待定'}
                </div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                  {gc.currentParticipants}/{gc.maxParticipants}人 | {gc.status === 'open' ? '报名中' : gc.status === 'full' ? '已满员' : gc.status === 'cancelled' ? '已取消' : gc.status}
                </div>
              </div>
              {(gc.status === 'open' || gc.status === 'full') && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingClassId(gc.id);
                      setFormTitle(gc.title);
                      setShowEditClassModal(true);
                    }}
                    style={{ fontSize: 12, padding: '4px 12px', border: '1px solid #d9d9d9', borderRadius: '4px', background: 'white', cursor: 'pointer' }}
                  >
                    修改
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCancellingClassId(gc.id);
                      setShowCancelClassConfirm(true);
                    }}
                    style={{ fontSize: 12, padding: '4px 12px', border: '1px solid #ff5252', borderRadius: '4px', background: 'white', color: '#ff5252', cursor: 'pointer' }}
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
            style={{ marginBottom: '16px', padding: '8px 16px', background: '#00C853', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
          >
            添加时间段
          </button>

          {slots.length === 0 && (
            <div style={{ color: '#999', textAlign: 'center', padding: '24px' }}>暂无时间段</div>
          )}

          {slots.map((slot) => (
            <div key={slot.id} style={{ padding: '12px', border: '1px solid #f0f0f0', borderRadius: '8px', marginBottom: '8px' }}>
              <div>
                {new Date(slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {' - '}
                {new Date(slot.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              {slot.feeDescription && <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{slot.feeDescription}</div>}
              <span style={{
                fontSize: 12,
                padding: '1px 6px',
                borderRadius: '4px',
                marginTop: 4,
                display: 'inline-block',
                background: slot.isBooked ? '#ffebee' : '#e8f5e9',
                color: slot.isBooked ? '#c62828' : '#2e7d32',
              }}>
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
            <div style={{ color: '#999', textAlign: 'center', padding: '24px' }}>暂无预约</div>
          )}

          {privateLessons.map((lesson) => (
            <div key={lesson.id} style={{ padding: '12px', border: '1px solid #f0f0f0', borderRadius: '8px', marginBottom: '8px' }}>
              <div style={{ fontWeight: 600 }}>{lesson.student.nickname}</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                {new Date(lesson.slot.startTime).toLocaleString()} - {new Date(lesson.slot.endTime).toLocaleTimeString()}
              </div>
              {lesson.venue && <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{lesson.venue.name}</div>}
              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                {lesson.status === 'scheduled' ? '待上课' : lesson.status === 'completed' ? '已结束' : lesson.status === 'cancelled' ? '已取消' : lesson.status}
              </div>
              {lesson.status === 'scheduled' && (
                <button
                  onClick={() => {
                    setCancellingLessonId(lesson.id);
                    setShowCancelLessonConfirm(true);
                  }}
                  style={{ marginTop: '8px', fontSize: 12, padding: '4px 12px', border: '1px solid #ff5252', borderRadius: '4px', background: 'white', color: '#ff5252', cursor: 'pointer' }}
                >
                  取消
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Group Class Modal */}
      {showCreateClassModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', width: '90%', maxWidth: '400px' }}>
            <h3>发布团课</h3>
            <div style={{ marginBottom: '12px' }}>
              <label>课程名称</label>
              <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '4px' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCreateClassModal(false)} style={{ padding: '6px 16px', border: '1px solid #d9d9d9', borderRadius: '6px', background: 'white', cursor: 'pointer' }}>取消</button>
              <button onClick={() => { /* Submit logic */ }} style={{ padding: '6px 16px', background: '#00C853', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>提交</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Group Class Modal */}
      {showEditClassModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', width: '90%', maxWidth: '400px' }}>
            <h3>修改团课</h3>
            <div style={{ marginBottom: '12px' }}>
              <label>课程名称</label>
              <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '4px' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowEditClassModal(false)} style={{ padding: '6px 16px', border: '1px solid #d9d9d9', borderRadius: '6px', background: 'white', cursor: 'pointer' }}>取消</button>
              <button onClick={() => { /* Update logic */ }} style={{ padding: '6px 16px', background: '#00C853', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>提交</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Slot Modal */}
      {showAddSlotModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', width: '90%', maxWidth: '400px' }}>
            <h3>添加私教时间段</h3>
            <div style={{ marginBottom: '12px' }}>
              <label>开始时间</label>
              <input type="datetime-local" style={{ width: '100%', padding: '8px', marginTop: '4px' }} />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label>结束时间</label>
              <input type="datetime-local" style={{ width: '100%', padding: '8px', marginTop: '4px' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAddSlotModal(false)} style={{ padding: '6px 16px', border: '1px solid #d9d9d9', borderRadius: '6px', background: 'white', cursor: 'pointer' }}>取消</button>
              <button onClick={() => { /* Submit logic */ }} style={{ padding: '6px 16px', background: '#00C853', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>提交</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Group Class Confirm */}
      {showCancelClassConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', width: '80%', maxWidth: '360px' }}>
            <p>是否取消该团课？</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowCancelClassConfirm(false); setCancellingClassId(null); }} style={{ padding: '6px 16px', border: '1px solid #d9d9d9', borderRadius: '6px', background: 'white', cursor: 'pointer' }}>返回</button>
              <button onClick={handleCancelGroupClass} style={{ padding: '6px 16px', background: '#ff5252', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>确认</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Private Lesson Confirm */}
      {showCancelLessonConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', width: '80%', maxWidth: '360px' }}>
            <p>是否取消该私教预约？</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowCancelLessonConfirm(false); setCancellingLessonId(null); }} style={{ padding: '6px 16px', border: '1px solid #d9d9d9', borderRadius: '6px', background: 'white', cursor: 'pointer' }}>返回</button>
              <button onClick={handleCancelPrivateLesson} style={{ padding: '6px 16px', background: '#ff5252', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>确认</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
