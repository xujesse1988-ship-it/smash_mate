import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../stores/auth-store';
import { useUserProfile } from '../hooks/useUserProfile';
import { useMatchStats } from '../hooks/useMatchStats';
import { useCurrentUser } from '../../../shared/hooks/useCurrentUser';
import { BackButton } from '../../../shared/components/BackButton';
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
    <div style={{ padding: 16, background: '#f5f5f5', minHeight: '100%' }}>
      <div style={{ width: '100%', maxWidth: 560, margin: '0 auto' }}>
        {!isOwnProfile && (
          <BackButton onClick={() => navigate(-1)} style={{ marginBottom: 12, padding: '6px 0' }} />
        )}

        <section
          style={{
            padding: 20,
            background: '#fff',
            border: '1px solid #e8e8e8',
            borderRadius: 18,
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
          }}
        >
          <UserInfoSection
            nickname={userInfo.nickname}
            avatarUrl={userInfo.avatarUrl}
            bio={userInfo.bio}
            showBio={false}
            phone={isOwnProfile ? (currentUser?.phone ?? null) : null}
          />
          <MatchStatsCard stats={matchStats} error={statsError} />
        </section>

        {isOwnProfile ? (
          <QuickLinkList userId={userId || ''} isCoach={isCoach} navigate={navigate} />
        ) : userInfo.bio ? (
          <section
            style={{
              marginTop: 16,
              padding: '16px 18px',
              background: '#fff',
              border: '1px solid #e8e8e8',
              borderRadius: 16,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: '#666', marginBottom: 8 }}>
              个人简介
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.7, color: '#222' }}>{userInfo.bio}</div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
