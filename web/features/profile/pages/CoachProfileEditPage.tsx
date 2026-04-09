import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { useCurrentUser } from '../../../shared/hooks/useCurrentUser';
import { useCoachProfile } from '../hooks/useCoachProfile';
import { useUpdateCoachProfile } from '../hooks/useUpdateCoachProfile';
import { useAuthStore } from '../../../stores/auth-store';
import type { CoachSpecialty } from '../api/profile-api';
import { TopBar } from '../components/top-bar';
import { CoachBioInput } from '../components/coach-bio-input';
import { SpecialtySelector } from '../components/specialty-selector';
import { CoachGuard } from '../../../shared/components/CoachGuard';
import { ConfirmDialog } from '../components/confirm-dialog';

export function CoachProfileEditPage() {
  const navigate = useNavigate();
  const { data: currentUser, isLoading: isUserLoading } = useCurrentUser();
  const userId = useAuthStore((state) => state.userId);
  const {
    data: coachProfile,
    isLoading: isCoachLoading,
    error: _coachError,
  } = useCoachProfile(userId || '');
  const updateCoachProfile = useUpdateCoachProfile();

  const [bio, setBio] = useState('');
  const [specialties, setSpecialties] = useState<CoachSpecialty[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showConfirm, setShowConfirm] = useState(false);

  const initialValues = useRef<{ bio: string; specialties: CoachSpecialty[] } | null>(null);

  // Fill form when coach profile data arrives
  useEffect(() => {
    if (coachProfile !== undefined) {
      const b = coachProfile?.bio || '';
      const s = coachProfile?.specialties || [];
      setBio(b);
      setSpecialties([...s]);
      initialValues.current = { bio: b, specialties: [...s] };
    }
  }, [coachProfile]);

  // CoachGuard: non-coach users
  if (!isUserLoading && currentUser && !currentUser.isCoach) {
    return <CoachGuard onNavigateToSettings={() => navigate('/settings')} />;
  }

  // Loading state
  if (isUserLoading || isCoachLoading) {
    return <div>加载中...</div>;
  }

  const isDirty =
    initialValues.current !== null &&
    (bio !== initialValues.current.bio ||
      JSON.stringify([...specialties].sort()) !==
        JSON.stringify([...initialValues.current.specialties].sort()));

  function toggleSpecialty(value: CoachSpecialty) {
    setSpecialties((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value],
    );
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (bio.length > 500) {
      newErrors.bio = '简介不能超过 500 个字符';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSave() {
    if (!validate()) return;

    updateCoachProfile.mutate(
      { bio, specialties },
      {
        onSuccess: () => {
          message.success('保存成功');
          initialValues.current = { bio, specialties: [...specialties] };
          navigate(-1);
        },
        onError: (err) => {
          const apiError = err as Error & { code?: string };
          if (apiError.code === 'COACHING_INVALID_BIO') {
            setErrors((prev) => ({ ...prev, bio: '简介不能超过 500 个字符' }));
          } else if (apiError.code === 'COACHING_INVALID_SPECIALTY') {
            setErrors((prev) => ({ ...prev, specialties: '请选择有效的擅长方向' }));
          } else if (apiError.code === 'COACHING_COACH_ROLE_REQUIRED') {
            message.error('请先在设置中开启教练模式');
          } else {
            message.error(apiError.message || '保存失败');
          }
        },
      },
    );
  }

  function handleBack() {
    if (isDirty) {
      setShowConfirm(true);
    } else {
      navigate(-1);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #eef7f1 0%, #f8fafc 220px, #f6f8fb 100%)',
      }}
    >
      <TopBar
        title="教练资料"
        onBack={handleBack}
        onSave={handleSave}
        saveDisabled={updateCoachProfile.isPending}
      />

      <div style={{ padding: '18px 16px 40px', maxWidth: 760, margin: '0 auto' }}>
        <section
          style={{
            padding: 20,
            marginBottom: 16,
            background: 'linear-gradient(135deg, #10261a 0%, #1f5130 100%)',
            borderRadius: 28,
            color: '#fff',
            boxShadow: '0 20px 44px rgba(16, 38, 26, 0.18)',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, opacity: 0.9 }}>Coach Profile</div>
          <div style={{ marginTop: 10, fontSize: 28, fontWeight: 800, lineHeight: 1.2 }}>
            打造你的教练名片
          </div>
          <p
            style={{
              margin: '10px 0 0',
              fontSize: 14,
              lineHeight: 1.7,
              color: 'rgba(255,255,255,0.82)',
            }}
          >
            完善简介和擅长方向后，找教练页会更准确地展示你的教学特点，学员也更容易找到你。
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
            <span
              style={{
                padding: '8px 12px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.14)',
                fontSize: 13,
              }}
            >
              已填写简介 {bio.trim() ? '1/1' : '0/1'}
            </span>
            <span
              style={{
                padding: '8px 12px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.14)',
                fontSize: 13,
              }}
            >
              已选择标签 {specialties.length} 个
            </span>
          </div>
        </section>

        <div style={{ display: 'grid', gap: 16 }}>
          <CoachBioInput value={bio} onChange={setBio} error={errors.bio} />

          <SpecialtySelector
            specialties={specialties}
            onToggle={toggleSpecialty}
            error={errors.specialties}
          />
        </div>
      </div>

      <ConfirmDialog
        visible={showConfirm}
        message="有未保存的修改，确定离开？"
        onConfirm={() => {
          setShowConfirm(false);
          navigate(-1);
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
