import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BackButton } from '../../../shared/components/BackButton';
import { Chip } from '../../../shared/components/Chip';
import { useStudentClassDetail } from '../hooks/useStudentClassDetail';
import { useStudentNotes } from '../hooks/useStudentNotes';
import { useStudentTags } from '../hooks/useStudentTags';
import { useAddStudentNote } from '../hooks/useAddStudentNote';
import { useSetStudentTags } from '../hooks/useSetStudentTags';

export function ClassStudentProfilePage() {
  const { classId, studentId } = useParams<{ classId: string; studentId: string }>();
  const navigate = useNavigate();

  const { data: classDetail, isLoading: isDetailLoading } = useStudentClassDetail(classId || '');
  const { data: notesData } = useStudentNotes(classId || '', studentId || '');
  const { data: tagsData } = useStudentTags(classId || '', studentId || '');
  const addNoteMutation = useAddStudentNote();
  const setTagsMutation = useSetStudentTags();

  const [noteInput, setNoteInput] = useState('');
  const [tagInput, setTagInput] = useState('');

  if (isDetailLoading) return <div style={{ padding: 16 }}>加载中...</div>;

  const member = classDetail?.members?.find((m) => m.studentId === studentId);
  if (!member) return <div style={{ padding: 16 }}>学员不存在</div>;

  const notes = notesData?.items ?? [];
  const tags = tagsData?.tags ?? [];

  const handleAddNote = () => {
    if (!classId || !studentId || !noteInput.trim()) return;
    addNoteMutation.mutate(
      { classId, studentId, content: noteInput.trim() },
      {
        onSuccess: () => {
          setNoteInput('');
        },
      },
    );
  };

  const handleAddTag = () => {
    if (!classId || !studentId || !tagInput.trim()) return;
    if (tags.length >= 10) return;
    const newTag = tagInput.trim();
    if (tags.includes(newTag)) {
      setTagInput('');
      return;
    }
    setTagsMutation.mutate(
      { classId, studentId, tags: [...tags, newTag] },
      {
        onSuccess: () => {
          setTagInput('');
        },
      },
    );
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!classId || !studentId) return;
    setTagsMutation.mutate({
      classId,
      studentId,
      tags: tags.filter((t) => t !== tagToRemove),
    });
  };

  return (
    <div style={{ padding: 16 }}>
      <BackButton onClick={() => navigate(`/my-student-classes/${classId}`)} />

      {/* Student Info Header */}
      <div style={{ margin: '16px 0', padding: 16, background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--surface-2)', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'var(--surface-2)',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {member.avatarUrl && (
            <img src={member.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{member.nickname}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
            {new Date(member.joinedAt).toLocaleDateString()} 加入
          </div>
        </div>
      </div>

      {/* Tags Section */}
      <div style={{ marginBottom: 16, padding: 16, background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--surface-2)' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>标签</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {tags.length === 0 ? (
            <span style={{ color: 'var(--text-3)', fontSize: 13 }}>暂无标签</span>
          ) : (
            tags.map((tag) => (
              <Chip key={tag} active>
                {tag}
                <span
                  onClick={() => handleRemoveTag(tag)}
                  style={{ marginLeft: 6, cursor: 'pointer', fontWeight: 700 }}
                >
                  x
                </span>
              </Chip>
            ))
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
            placeholder="输入标签（最多20字）"
            maxLength={20}
            style={{
              flex: 1,
              padding: 10,
              boxSizing: 'border-box',
              border: '1px solid var(--surface-2)',
              borderRadius: 8,
              background: 'var(--surface-2)',
              color: 'var(--text-1)',
              fontSize: 14,
            }}
          />
          <button
            onClick={handleAddTag}
            disabled={setTagsMutation.isPending || tags.length >= 10}
            style={{
              padding: '8px 16px',
              background: 'var(--primary)',
              color: '#052e16',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            添加
          </button>
        </div>
      </div>

      {/* Notes Section */}
      <div style={{ marginBottom: 16, padding: 16, background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--surface-2)' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>学员笔记</h3>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
            placeholder="输入笔记内容"
            style={{
              flex: 1,
              padding: 10,
              boxSizing: 'border-box',
              border: '1px solid var(--surface-2)',
              borderRadius: 8,
              background: 'var(--surface-2)',
              color: 'var(--text-1)',
              fontSize: 14,
            }}
          />
          <button
            onClick={handleAddNote}
            disabled={addNoteMutation.isPending || !noteInput.trim()}
            style={{
              padding: '8px 16px',
              background: 'var(--primary)',
              color: '#052e16',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            添加
          </button>
        </div>

        {notes.length === 0 ? (
          <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 12 }}>暂无笔记</div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              style={{
                padding: '10px 0',
                borderBottom: '1px solid var(--surface-2)',
              }}
            >
              <div style={{ fontSize: 14, color: 'var(--text-1)', lineHeight: 1.5 }}>{note.content}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                {new Date(note.createdAt).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
