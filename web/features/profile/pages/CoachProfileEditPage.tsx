import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { useCurrentUser } from '../../../shared/hooks/useCurrentUser';
import { useCoachProfile } from '../hooks/useCoachProfile';
import { useUpdateCoachProfile } from '../hooks/useUpdateCoachProfile';
import { useAuthStore } from '../../../stores/auth-store';

const SPECIALTY_OPTIONS: { value: string; label: string }[] = [
  { value: 'singles', label: '单打' },
  { value: 'doubles', label: '双打' },
  { value: 'footwork', label: '步法' },
  { value: 'fitness', label: '体能' },
  { value: 'tactics', label: '战术' },
];

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
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showConfirm, setShowConfirm] = useState(false);

  const initialValues = useRef<{ bio: string; specialties: string[] } | null>(null);

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
    return (
      <div>
        <p>请先在设置中开启教练模式</p>
        <button onClick={() => navigate('/settings')}>设置</button>
      </div>
    );
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

  function toggleSpecialty(value: string) {
    setSpecialties((prev) =>
      prev.includes(value)
        ? prev.filter((s) => s !== value)
        : [...prev, value],
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
    <div>
      {/* TopBar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
        <button aria-label="返回" onClick={handleBack}>
          返回
        </button>
        <span>教练资料</span>
        <button
          onClick={handleSave}
          disabled={updateCoachProfile.isPending}
        >
          保存
        </button>
      </div>

      {/* CoachBioInput */}
      <div>
        <label>教练简介</label>
        <input
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="输入教练简介"
        />
        {errors.bio && <div style={{ color: 'red' }}>{errors.bio}</div>}
      </div>

      {/* SpecialtySelector */}
      <div>
        <label>擅长方向</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {SPECIALTY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => toggleSpecialty(option.value)}
              style={{
                background: specialties.includes(option.value) ? '#00C853' : '#f0f0f0',
                color: specialties.includes(option.value) ? '#fff' : '#333',
                border: 'none',
                borderRadius: 16,
                padding: '4px 12px',
                cursor: 'pointer',
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
        {errors.specialties && <div style={{ color: 'red' }}>{errors.specialties}</div>}
      </div>

      {/* Unsaved changes confirm dialog */}
      {showConfirm && (
        <div role="dialog">
          <p>有未保存的修改，确定离开？</p>
          <button
            onClick={() => {
              setShowConfirm(false);
              navigate(-1);
            }}
          >
            确认
          </button>
          <button onClick={() => setShowConfirm(false)}>取消</button>
        </div>
      )}
    </div>
  );
}
