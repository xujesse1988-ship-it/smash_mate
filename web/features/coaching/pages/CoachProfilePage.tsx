import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../stores/auth-store';
import { useCoachProfile } from '../hooks/useCoachProfile';
import { useCoachRating } from '../hooks/useCoachRating';
import { useCoachReviews } from '../hooks/useCoachReviews';
import { useSubmitReview } from '../hooks/useSubmitReview';

const SPECIALTY_MAP: Record<string, string> = {
  singles: '单打',
  doubles: '双打',
  footwork: '步法',
  fitness: '体能',
  tactics: '战术',
};

export function CoachProfilePage() {
  const { id: coachId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUserId = useAuthStore((state) => state.userId);

  const { data: coach, isLoading: isCoachLoading, error: coachError } = useCoachProfile(coachId || '');
  const { data: rating, isLoading: _isRatingLoading } = useCoachRating(coachId || '');
  const {
    data: reviewsData,
    isLoading: _isReviewsLoading,
    hasNextPage: _hasNextReviewPage,
    fetchNextPage: _fetchNextReviewPage,
  } = useCoachReviews(coachId || '');
  const submitReview = useSubmitReview(coachId || '');

  const [activeTab, setActiveTab] = useState<'courses' | 'reviews'>('courses');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedCourseType, setSelectedCourseType] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  if (isCoachLoading) return <div>加载中...</div>;
  if (coachError) return <div>加载失败：教练不存在</div>;
  if (!coach) return null;

  const isCurrentUserCoach = currentUserId === coach.userId;

  const completedClasses = coach.groupClasses.filter(
    (gc) => gc.status === 'completed',
  );

  const allReviews = reviewsData?.pages?.flatMap((page) => page.items) ?? [];

  const handleSubmitReview = () => {
    if (!selectedCourseId || !selectedCourseType) return;
    submitReview.mutate(
      {
        coachId: coachId!,
        courseType: selectedCourseType,
        courseId: selectedCourseId,
        rating: reviewRating,
        comment: reviewComment || undefined,
      },
      {
        onSuccess: () => {
          setShowReviewModal(false);
          setSelectedCourseType('');
          setSelectedCourseId('');
          setReviewRating(5);
          setReviewComment('');
        },
      },
    );
  };

  return (
    <div style={{ padding: '16px' }}>
      {/* Coach Info Header */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px' }}>
        {coach.avatarUrl ? (
          <img
            src={coach.avatarUrl}
            alt={coach.nickname}
            style={{ width: 64, height: 64, borderRadius: '50%' }}
          />
        ) : (
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: '#e0e0e0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
          }}>
            {coach.nickname.charAt(0)}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{coach.nickname}</div>
          {coach.bio && <div style={{ color: '#666', marginTop: 4 }}>{coach.bio}</div>}
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: 4 }}>
            {coach.specialties.map((s) => (
              <span key={s} style={{
                fontSize: 11,
                padding: '1px 6px',
                borderRadius: '4px',
                background: '#e8f5e9',
                color: '#2e7d32',
              }}>
                {SPECIALTY_MAP[s] || s}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '24px', marginBottom: '16px' }}>
        <div>
          {rating && rating.averageRating !== null ? (
            <span style={{ fontWeight: 600, color: '#ff9800' }}>
              {rating.averageRating} <span style={{ fontSize: 12, color: '#999' }}>({rating.totalCount}条评价)</span>
            </span>
          ) : (
            <span style={{ color: '#999' }}>暂无评价</span>
          )}
        </div>
        <div>
          <span style={{ color: '#666' }}>{coach.studentCount} 名学员</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0', marginBottom: '16px' }}>
        <button
          onClick={() => setActiveTab('courses')}
          style={{
            flex: 1,
            padding: '8px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'courses' ? '2px solid #00C853' : '2px solid transparent',
            fontWeight: activeTab === 'courses' ? 600 : 400,
          }}
        >
          课程
        </button>
        <button
          onClick={() => setActiveTab('reviews')}
          style={{
            flex: 1,
            padding: '8px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'reviews' ? '2px solid #00C853' : '2px solid transparent',
            fontWeight: activeTab === 'reviews' ? 600 : 400,
          }}
        >
          评价
        </button>
      </div>

      {/* Courses Tab */}
      {activeTab === 'courses' && (
        <div>
          {/* Group Classes */}
          {coach.groupClasses.length === 0 && coach.privateLessonSlots.length === 0 && (
            <div style={{ color: '#999', textAlign: 'center', padding: '24px' }}>暂无课程</div>
          )}
          {coach.groupClasses.map((gc) => (
            <div
              key={gc.id}
              data-testid={`group-class-card-${gc.id}`}
              onClick={() => navigate(`/group-classes/${gc.id}`)}
              style={{
                padding: '12px',
                border: '1px solid #f0f0f0',
                borderRadius: '8px',
                marginBottom: '8px',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 600 }}>{gc.title}</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                {gc.venue?.name || '地点待定'}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 12 }}>
                <span>{gc.currentParticipants}/{gc.maxParticipants}人</span>
                {gc.feeDescription && <span>{gc.feeDescription}</span>}
                <span style={{
                  padding: '1px 6px',
                  borderRadius: '4px',
                  background: gc.status === 'open' ? '#e8f5e9' : gc.status === 'completed' ? '#e3f2fd' : '#f5f5f5',
                  color: gc.status === 'open' ? '#2e7d32' : gc.status === 'completed' ? '#1565c0' : '#999',
                }}>
                  {gc.status === 'open' ? '报名中' : gc.status === 'full' ? '已满员' : gc.status === 'in_progress' ? '进行中' : gc.status === 'completed' ? '已结束' : '已取消'}
                </span>
              </div>
            </div>
          ))}

          {/* Private Lesson Section */}
          {coach.privateLessonSlots.length > 0 && (
            <div style={{
              padding: '12px',
              border: '1px solid #f0f0f0',
              borderRadius: '8px',
              marginTop: '16px',
            }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>私教</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{coach.privateLessonSlots.length} 个可预约时间段</span>
                <button
                  onClick={() => navigate(`/coaches/${coachId}/private-lessons`)}
                  style={{
                    padding: '4px 12px',
                    background: '#00C853',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  预约私教
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reviews Tab */}
      {activeTab === 'reviews' && (
        <div>
          {!isCurrentUserCoach && (
            <button
              onClick={() => setShowReviewModal(true)}
              style={{
                padding: '6px 16px',
                background: '#00C853',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                marginBottom: '16px',
              }}
            >
              写评价
            </button>
          )}

          {allReviews.length === 0 && (
            <div style={{ color: '#999', textAlign: 'center', padding: '24px' }}>暂无评价</div>
          )}
          {allReviews.map((review) => (
            <div key={review.id} style={{
              padding: '12px',
              border: '1px solid #f0f0f0',
              borderRadius: '8px',
              marginBottom: '8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 600 }}>{review.reviewer.nickname}</span>
                <span style={{ color: '#ff9800' }}>{'★'.repeat(review.rating)}</span>
              </div>
              {review.comment && (
                <div style={{ marginTop: 4, color: '#333' }}>{review.comment}</div>
              )}
              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                {new Date(review.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <div style={{
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
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            width: '90%',
            maxWidth: '400px',
          }}>
            <h3>提交评价</h3>
            <div style={{ marginBottom: '12px' }}>
              <label>选择课程</label>
              <select
                value={`${selectedCourseType}:${selectedCourseId}`}
                onChange={(e) => {
                  const [type, id] = e.target.value.split(':');
                  setSelectedCourseType(type);
                  setSelectedCourseId(id);
                }}
                style={{ width: '100%', padding: '8px', marginTop: '4px' }}
              >
                <option value=":">请选择</option>
                {completedClasses.map((gc) => (
                  <option key={gc.id} value={`group-class:${gc.id}`}>
                    {gc.title}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label>评分</label>
              <div style={{ marginTop: '4px' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    onClick={() => setReviewRating(star)}
                    style={{
                      cursor: 'pointer',
                      fontSize: 24,
                      color: star <= reviewRating ? '#ff9800' : '#e0e0e0',
                    }}
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label>评价内容（可选）</label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                maxLength={500}
                style={{ width: '100%', padding: '8px', marginTop: '4px', minHeight: '80px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowReviewModal(false)}
                style={{ padding: '6px 16px', border: '1px solid #d9d9d9', borderRadius: '6px', background: 'white', cursor: 'pointer' }}
              >
                取消
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={submitReview.isPending}
                style={{
                  padding: '6px 16px',
                  background: '#00C853',
                  color: 'white',
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
    </div>
  );
}
