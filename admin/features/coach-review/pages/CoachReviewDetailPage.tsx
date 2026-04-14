import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Avatar, Tag, Modal, Input, Image, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useApplicationDetail } from '../hooks/useApplicationDetail';
import { useReviewApplication } from '../hooks/useReviewApplication';

function formatDate(iso: string): string {
  return iso.slice(0, 16).replace('T', ' ');
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '待审核', color: 'gold' },
  approved: { label: '已通过', color: 'green' },
  rejected: { label: '已拒绝', color: 'red' },
};

export function CoachReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: application, isLoading, error } = useApplicationDetail(id || '');
  const reviewMutation = useReviewApplication();

  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  function handleApprove() {
    if (!id) return;
    reviewMutation.mutate(
      { id, input: { status: 'approved' } },
      {
        onSuccess: () => {
          message.success('已通过审核');
          navigate('/coach-review');
        },
        onError: (err) => {
          const apiError = err as Error & { code?: string };
          if (apiError.code === 'COACHING_APPLICATION_ALREADY_REVIEWED') {
            message.error('该申请已审核过');
          } else {
            message.error(apiError.message || '操作失败');
          }
        },
      },
    );
  }

  function handleReject() {
    if (!id) return;
    if (rejectReason.trim().length < 5) {
      message.error('拒绝原因至少 5 个字符');
      return;
    }
    reviewMutation.mutate(
      { id, input: { status: 'rejected', rejectReason: rejectReason.trim() } },
      {
        onSuccess: () => {
          message.success('已拒绝申请');
          setRejectModalVisible(false);
          navigate('/coach-review');
        },
        onError: (err) => {
          const apiError = err as Error & { code?: string };
          if (apiError.code === 'COACHING_APPLICATION_ALREADY_REVIEWED') {
            message.error('该申请已审核过');
          } else {
            message.error(apiError.message || '操作失败');
          }
        },
      },
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ textAlign: 'center', padding: 48 }}>加载中...</div>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ textAlign: 'center', padding: 48 }}>加载失败，请刷新重试</div>
      </div>
    );
  }

  const statusConfig = STATUS_MAP[application.status] || {
    label: application.status,
    color: 'default',
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          type="link"
          onClick={() => navigate('/coach-review')}
          style={{ paddingLeft: 0 }}
        >
          返回列表
        </Button>
      </div>

      <h2 style={{ marginBottom: 24 }}>审核详情</h2>

      {/* Applicant Info */}
      <div
        style={{
          background: '#fafafa',
          borderRadius: 8,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <Avatar src={application.avatarUrl} size={52}>
            {application.nickname?.charAt(0)}
          </Avatar>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{application.nickname}</div>
            <div style={{ fontSize: 13, color: '#888' }}>
              {application.phone} | 提交于 {formatDate(application.createdAt)}
            </div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <Tag color={statusConfig.color}>{statusConfig.label}</Tag>
          </div>
        </div>
        {application.description && (
          <div style={{ fontSize: 14, color: '#555', lineHeight: 1.6 }}>
            {application.description}
          </div>
        )}
      </div>

      {/* Certificates */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 12 }}>
          上传的证书（{application.certificateUrls.length}张）
        </h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Image.PreviewGroup>
            {application.certificateUrls.map((url, i) => (
              <Image
                key={i}
                src={url}
                alt={`证书 ${i + 1}`}
                width={120}
                height={90}
                style={{ objectFit: 'cover', borderRadius: 8 }}
              />
            ))}
          </Image.PreviewGroup>
        </div>
      </div>

      {/* Reject reason (for already rejected) */}
      {application.status === 'rejected' && application.rejectReason && (
        <div
          style={{
            background: '#fff2f0',
            border: '1px solid #ffccc7',
            borderRadius: 8,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>拒绝原因</div>
          <div style={{ fontSize: 14, color: '#cf1322' }}>{application.rejectReason}</div>
        </div>
      )}

      {/* Review timestamp */}
      {application.reviewedAt && (
        <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
          审核时间：{formatDate(application.reviewedAt)}
        </div>
      )}

      {/* Action buttons (only for pending) */}
      {application.status === 'pending' && (
        <div style={{ display: 'flex', gap: 12 }}>
          <Button
            type="primary"
            onClick={handleApprove}
            loading={reviewMutation.isPending}
            disabled={reviewMutation.isPending}
            autoInsertSpace={false}
          >
            通过
          </Button>
          <Button
            danger
            onClick={() => setRejectModalVisible(true)}
            disabled={reviewMutation.isPending}
            autoInsertSpace={false}
          >
            拒绝
          </Button>
        </div>
      )}

      {/* Reject Modal */}
      <Modal
        title="拒绝申请"
        open={rejectModalVisible}
        onOk={handleReject}
        onCancel={() => setRejectModalVisible(false)}
        okText="确定拒绝"
        cancelText="取消"
        okButtonProps={{
          danger: true,
          loading: reviewMutation.isPending,
          autoInsertSpace: false,
        }}
      >
        <div style={{ marginBottom: 8, fontSize: 13, color: '#888' }}>
          请填写拒绝原因（至少 5 个字符）
        </div>
        <Input.TextArea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="请填写拒绝原因"
          rows={3}
        />
      </Modal>
    </div>
  );
}
