import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../stores/auth-store';
import { useUserProfile } from '../hooks/useUserProfile';
import { useMatchStats } from '../hooks/useMatchStats';
import { useCurrentUser } from '../../../shared/hooks/useCurrentUser';
import { UserInfoSection } from '../components/user-info-section';
import { MatchStatsCard } from '../components/match-stats-card';
import { QuickLinkList } from '../components/quick-link-list';

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
      {/* TopBar */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px' }}>
        {!isOwnProfile && (
          <button aria-label="返回" onClick={() => navigate(-1)}>
            返回
          </button>
        )}
      </div>

      {/* UserInfoSection */}
      <UserInfoSection
        nickname={userInfo.nickname}
        avatarUrl={userInfo.avatarUrl}
        bio={userInfo.bio}
        showBio={!isOwnProfile}
      />

      {/* MatchStatsCard */}
      <MatchStatsCard stats={matchStats} error={statsError} />

      {/* QuickLinkList - only when isOwnProfile */}
      {isOwnProfile && (
        <QuickLinkList
          userId={userId || ''}
          isCoach={isCoach}
          navigate={navigate}
        />
      )}
    </div>
  );
}
