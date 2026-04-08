import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../stores/auth-store';
import { useUserProfile } from '../hooks/useUserProfile';
import { useMatchStats } from '../hooks/useMatchStats';
import { useCurrentUser } from '../../../shared/hooks/useCurrentUser';

export function UserProfilePage() {
  const { id: userId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUserId = useAuthStore((state) => state.userId);

  const isOwnProfile = userId === currentUserId;

  const {
    data: userInfo,
    isLoading: isUserLoading,
    error: userError,
  } = useUserProfile(userId || '');

  const {
    data: matchStats,
    isLoading: _isStatsLoading,
    error: statsError,
  } = useMatchStats(userId || '');

  const { data: currentUser } = useCurrentUser();

  const isCoach = currentUser?.isCoach ?? false;

  // Loading state
  if (isUserLoading) {
    return <div>加载中...</div>;
  }

  // User not found or other error
  if (userError) {
    const err = userError as Error & { code?: string };
    if (err.code === 'USER_NOT_FOUND') {
      return <div>用户不存在</div>;
    }
    return <div>加载失败</div>;
  }

  if (!userInfo) {
    return null;
  }

  return (
    <div>
      {/* UserInfoSection */}
      <div>
        {userInfo.avatarUrl ? (
          <img
            src={userInfo.avatarUrl}
            alt={userInfo.nickname}
            style={{ width: 64, height: 64, borderRadius: '50%' }}
          />
        ) : (
          <img
            src=""
            alt={userInfo.nickname}
            style={{ width: 64, height: 64, borderRadius: '50%' }}
          />
        )}
        <div>{userInfo.nickname}</div>
        {!isOwnProfile && userInfo.bio && <div>{userInfo.bio}</div>}
      </div>

      {/* MatchStatsCard */}
      {statsError ? (
        <div>战绩加载失败</div>
      ) : matchStats ? (
        <div>
          <div>{matchStats.totalMatches}</div>
          <div>{matchStats.wins}</div>
          <div>{matchStats.winRate}%</div>
        </div>
      ) : null}

      {/* QuickLinkList - only when isOwnProfile */}
      {isOwnProfile && (
        <div>
          <div
            role="button"
            onClick={() => navigate('/my-activities?role=initiated')}
          >
            我发起的活动
          </div>
          <div
            role="button"
            onClick={() => navigate('/my-activities?role=participated')}
          >
            我参加的活动
          </div>

          {/* Course links depend on coach status */}
          {isCoach ? (
            <>
              <div
                role="button"
                onClick={() => navigate('/my-enrollments')}
              >
                我的报名
              </div>
              <div
                role="button"
                onClick={() => navigate('/my-courses')}
              >
                课程管理
              </div>
            </>
          ) : (
            <div
              role="button"
              onClick={() => navigate('/my-enrollments')}
            >
              我的课程
            </div>
          )}

          <div
            role="button"
            onClick={() => navigate(`/users/${userId}/match-records`)}
          >
            战绩记录
          </div>
          <div
            role="button"
            onClick={() => navigate('/profile/edit')}
          >
            个人资料
          </div>
          <div
            role="button"
            onClick={() => navigate('/settings')}
          >
            设置
          </div>
        </div>
      )}
    </div>
  );
}
