import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { BackButton } from '../../../shared/components/BackButton';
import { useCoachApplication, useSubmitApplication } from '../hooks/useCoachApplication';
import { useCurrentUser } from '../../../shared/hooks/useCurrentUser';
import { resolveUrl } from '../../../shared/utils/api-client';

// ---------------------------------------------------------------------------
// Helper: upload certificate image (reuses the same upload endpoint as avatar)
// ---------------------------------------------------------------------------

async function uploadCertificate(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('avatar', file);

  const token =
    typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(resolveUrl('/api/upload/avatar'), {
    method: 'POST',
    headers,
    body: formData,
  });

  const body = await response.json();
  if (!response.ok) {
    const err = new Error(body.error?.message || '上传失败') as Error & { code: string };
    err.code = body.error?.code || 'UPLOAD_ERROR';
    throw err;
  }
  return body.data.avatarUrl;
}

// ---------------------------------------------------------------------------
// Helper: format date
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return iso.slice(0, 16).replace('T', ' ');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CoachApplicationPage() {
  const navigate = useNavigate();
  const { data: currentUser } = useCurrentUser();
  const { data: application, isLoading, error } = useCoachApplication();
  const submitMutation = useSubmitApplication();

  const [certificateUrls, setCertificateUrls] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // If approved, redirect to coach profile edit
  if (currentUser?.isCoach && application?.status === 'approved') {
    return (
      <div style={{ padding: 16, background: 'var(--bg)', minHeight: '100%' }}>
        <div style={{ width: '100%', maxWidth: 560, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '8px 0 24px' }}>
            <BackButton onClick={() => navigate(-1)} style={{ marginRight: 8 }} />
            <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-1)' }}>教练资质</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#x2705;</div>
            <span className="badge badge-green" style={{ fontSize: 14, padding: '6px 16px', marginBottom: 12 }}>已通过</span>
            <div style={{ fontSize: 14, color: 'var(--text-2)', textAlign: 'center', lineHeight: 1.6, marginBottom: 24 }}>
              你的教练资质审核已通过，可以使用全部教练功能
            </div>
            <button
              className="btn-dark btn-primary btn-lg"
              style={{ minWidth: 200 }}
              onClick={() => navigate('/profile/coach-edit')}
            >
              管理教练资料
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: 16, background: 'var(--bg)', minHeight: '100%' }}>
        <div style={{ textAlign: 'center', paddingTop: 120, color: 'var(--text-2)' }}>加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 16, background: 'var(--bg)', minHeight: '100%' }}>
        <div style={{ textAlign: 'center', paddingTop: 120, color: 'var(--danger)' }}>加载失败，请重试</div>
      </div>
    );
  }

  // Pending state
  if (application?.status === 'pending') {
    return (
      <div style={{ padding: 16, background: 'var(--bg)', minHeight: '100%' }}>
        <div style={{ width: '100%', maxWidth: 560, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '8px 0 24px' }}>
            <BackButton onClick={() => navigate(-1)} style={{ marginRight: 8 }} />
            <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-1)' }}>教练资质</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#x23F3;</div>
            <span className="badge badge-yellow" style={{ fontSize: 14, padding: '6px 16px', marginBottom: 12 }}>审核中</span>
            <div style={{ fontSize: 14, color: 'var(--text-2)', textAlign: 'center', lineHeight: 1.6, marginBottom: 24 }}>
              你的教练资质正在审核中<br />通常 1-3 个工作日内完成
            </div>
            <div className="dark-card" style={{ width: '100%' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 8 }}>提交的证书</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {application.certificateUrls.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`证书 ${i + 1}`}
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 8,
                      objectFit: 'cover',
                      background: 'var(--surface-2)',
                    }}
                  />
                ))}
              </div>
              {application.description && (
                <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-2)' }}>
                  {application.description}
                </div>
              )}
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-3)' }}>
                提交时间：{formatDate(application.createdAt)}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Rejected state — show rejection reason + allow resubmission
  const isRejected = application?.status === 'rejected';

  function handleAddFile() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    // Validate MIME type (JPG/PNG only)
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      message.error('仅支持 JPG/PNG 格式');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      message.error('图片大小不能超过 5MB');
      return;
    }

    if (certificateUrls.length >= 5) {
      message.error('最多上传 5 张证书');
      return;
    }

    setUploading(true);
    try {
      const url = await uploadCertificate(file);
      setCertificateUrls((prev) => [...prev, url]);
    } catch {
      message.error('上传失败，请重试');
    } finally {
      setUploading(false);
    }
  }

  function handleRemoveCertificate(index: number) {
    setCertificateUrls((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit() {
    if (certificateUrls.length === 0) {
      message.error('请至少上传 1 张证书');
      return;
    }

    const input: { certificateUrls: string[]; description?: string } = {
      certificateUrls,
    };
    if (description.trim()) {
      input.description = description.trim();
    }

    submitMutation.mutate(input, {
      onSuccess: () => {
        message.success('申请已提交');
      },
      onError: (err) => {
        const apiError = err as Error & { code?: string };
        if (apiError.code === 'COACHING_APPLICATION_PENDING') {
          message.error('你已有一个审核中的申请');
        } else if (apiError.code === 'COACHING_ALREADY_COACH') {
          message.error('你已经是教练了');
        } else {
          message.error(apiError.message || '提交失败，请重试');
        }
      },
    });
  }

  return (
    <div style={{ padding: 16, background: 'var(--bg)', minHeight: '100%' }}>
      <div style={{ width: '100%', maxWidth: 560, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 0 24px' }}>
          <BackButton onClick={() => navigate(-1)} style={{ marginRight: 8 }} />
          <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-1)' }}>申请成为教练</span>
        </div>

        {/* Rejected reason */}
        {isRejected && application && (
          <div className="dark-card" style={{ marginBottom: 16, borderColor: 'rgba(248,113,113,.3)' }}>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 4 }}>拒绝原因</div>
            <div style={{ fontSize: 14, color: 'var(--danger)', lineHeight: 1.5 }}>
              {application.rejectReason}
            </div>
          </div>
        )}

        {/* Upload section */}
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 8 }}>上传证书/奖状</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
          至少 1 张，最多 5 张（JPG/PNG，单张不超过 5MB）
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          {certificateUrls.map((url, i) => (
            <div
              key={i}
              style={{
                width: 64,
                height: 64,
                borderRadius: 8,
                background: 'var(--surface-2)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <img
                src={url}
                alt={`证书 ${i + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <button
                onClick={() => handleRemoveCertificate(i)}
                aria-label={`删除证书 ${i + 1}`}
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: 'var(--danger)',
                  color: '#fff',
                  fontSize: 12,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                x
              </button>
            </div>
          ))}
          {certificateUrls.length < 5 && (
            <button
              onClick={handleAddFile}
              disabled={uploading}
              aria-label="添加证书"
              style={{
                width: 64,
                height: 64,
                borderRadius: 8,
                border: '2px dashed var(--surface-2)',
                background: 'transparent',
                color: 'var(--text-3)',
                fontSize: 24,
                cursor: uploading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {uploading ? '...' : '+'}
            </button>
          )}
        </div>

        {/* Description */}
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 8 }}>补充说明</div>
        <textarea
          placeholder="简要描述你的教练资历（选填，最多200字）"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
          style={{
            width: '100%',
            minHeight: 80,
            background: 'var(--surface)',
            border: '1.5px solid var(--surface-2)',
            borderRadius: 10,
            padding: '12px 14px',
            color: 'var(--text-1)',
            fontSize: 14,
            resize: 'vertical',
            outline: 'none',
          }}
        />
        <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'right', marginTop: 4 }}>
          {description.length}/200
        </div>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={submitMutation.isPending || certificateUrls.length === 0}
          className="btn-dark btn-primary btn-lg"
          style={{ width: '100%', marginTop: 16 }}
        >
          {submitMutation.isPending ? '提交中...' : isRejected ? '重新提交申请' : '提交申请'}
        </button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png"
          style={{ display: 'none' }}
          onChange={handleFileSelected}
        />
      </div>
    </div>
  );
}
