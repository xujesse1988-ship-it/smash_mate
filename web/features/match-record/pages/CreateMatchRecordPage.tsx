import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { InputNumber, Switch, Select, Radio, message } from 'antd';
import { useSourceParticipants } from '../hooks/useSourceParticipants';
import { useCreateMatchRecord } from '../hooks/useCreateMatchRecord';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const VALID_SOURCE_TYPES = ['activity', 'group-class', 'private-lesson'] as const;
type SourceType = (typeof VALID_SOURCE_TYPES)[number];
type MatchType = 'singles' | 'doubles';

interface PlayerFormItem {
  isGuest: boolean;
  userId: string | null;
  guestName: string;
}

interface GameFormItem {
  scoreA: number | null;
  scoreB: number | null;
}

// ---------------------------------------------------------------------------
// Error code mapping
// ---------------------------------------------------------------------------

const ERROR_CODE_MAP: Record<string, string> = {
  MATCH_RECORD_INVALID_SOURCE_TYPE: '无效的来源类型',
  MATCH_RECORD_INVALID_MATCH_TYPE: '请选择比赛类型',
  MATCH_RECORD_INVALID_PLAYERS: '选手数量不正确（单打各1人，双打各2人）',
  MATCH_RECORD_INVALID_PLAYER: '选手信息不完整',
  MATCH_RECORD_INVALID_GUEST_NAME: '非平台用户昵称不能为空，且不超过20个字符',
  MATCH_RECORD_INVALID_GAMES: '请至少录入1局比分',
  MATCH_RECORD_INVALID_SCORE: '单局比分需在0-30之间，且不可同时为0',
  MATCH_RECORD_DUPLICATE_PLAYER: '同一选手不能同时出现在两侧',
  MATCH_RECORD_NOT_PARTICIPANT: '你不是该活动/课程的参与者，无法录入战绩',
  MATCH_RECORD_PLAYER_NOT_PARTICIPANT: '所选选手不是该活动/课程的参与者',
  MATCH_RECORD_SOURCE_NOT_FOUND: '关联的活动/课程不存在',
  MATCH_RECORD_SOURCE_NOT_COMPLETED: '活动/课程尚未结束，暂时无法录入战绩',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyPlayer(isGuest = false): PlayerFormItem {
  return { isGuest, userId: null, guestName: '' };
}

function emptyGame(): GameFormItem {
  return { scoreA: null, scoreB: null };
}

function getPlayersPerSide(matchType: MatchType): number {
  return matchType === 'singles' ? 1 : 2;
}

function buildInitialSide(count: number, isGuest: boolean): PlayerFormItem[] {
  return Array.from({ length: count }, () => emptyPlayer(isGuest));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreateMatchRecordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const rawSourceType = searchParams.get('sourceType');
  const sourceId = searchParams.get('sourceId');

  // Validate URL params
  const isValidSourceType = VALID_SOURCE_TYPES.includes(
    rawSourceType as SourceType,
  );
  const sourceType = isValidSourceType ? (rawSourceType as SourceType) : null;

  if (!sourceType || !sourceId) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>请从活动或课程详情页进入战绩录入</p>
        <button type="button" onClick={() => navigate(-1)}>返回</button>
      </div>
    );
  }

  return (
    <CreateMatchRecordForm
      sourceType={sourceType}
      sourceId={sourceId}
      navigate={navigate}
    />
  );
}

// ---------------------------------------------------------------------------
// Form Component (extracted to avoid hooks after early return)
// ---------------------------------------------------------------------------

function CreateMatchRecordForm({
  sourceType,
  sourceId,
  navigate,
}: {
  sourceType: SourceType;
  sourceId: string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const isPrivateLesson = sourceType === 'private-lesson';
  const { participants, isLoading, error } = useSourceParticipants(
    sourceType,
    sourceId,
  );
  const createMutation = useCreateMatchRecord();

  const [matchType, setMatchType] = useState<MatchType>('singles');
  const [sideA, setSideA] = useState<PlayerFormItem[]>(
    buildInitialSide(1, isPrivateLesson),
  );
  const [sideB, setSideB] = useState<PlayerFormItem[]>(
    buildInitialSide(1, isPrivateLesson),
  );
  const [games, setGames] = useState<GameFormItem[]>([emptyGame()]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Collect all selected user IDs for filtering dropdowns
  const selectedUserIds = useMemo(() => {
    const ids = new Set<string>();
    [...sideA, ...sideB].forEach((p) => {
      if (!p.isGuest && p.userId) ids.add(p.userId);
    });
    return ids;
  }, [sideA, sideB]);

  // --- Loading / Error states ---
  if (isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>加载中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>加载失败，请重试</p>
        <button type="button" onClick={() => navigate(-1)}>返回</button>
      </div>
    );
  }

  // --- Handlers ---

  const handleMatchTypeChange = (newType: MatchType) => {
    setMatchType(newType);

    // Adjust sideA
    if (newType === 'doubles' && sideA.length < 2) {
      setSideA([sideA[0], emptyPlayer(isPrivateLesson)]);
    } else if (newType === 'singles' && sideA.length > 1) {
      setSideA([sideA[0]]);
    }

    // Adjust sideB
    if (newType === 'doubles' && sideB.length < 2) {
      setSideB([sideB[0], emptyPlayer(isPrivateLesson)]);
    } else if (newType === 'singles' && sideB.length > 1) {
      setSideB([sideB[0]]);
    }

    setFormErrors({});
  };

  const updatePlayer = (
    side: 'A' | 'B',
    index: number,
    update: Partial<PlayerFormItem>,
  ) => {
    const setter = side === 'A' ? setSideA : setSideB;
    setter((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...update } : p)),
    );
  };

  const addGame = () => {
    setGames((prev) => [...prev, emptyGame()]);
  };

  const removeGame = (index: number) => {
    if (games.length <= 1) return;
    setGames((prev) => prev.filter((_, i) => i !== index));
  };

  const updateGame = (
    index: number,
    field: 'scoreA' | 'scoreB',
    value: number | null,
  ) => {
    setGames((prev) =>
      prev.map((g, i) => (i === index ? { ...g, [field]: value } : g)),
    );
  };

  // --- Validation ---

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    const count = getPlayersPerSide(matchType);

    // Player count validation
    if (sideA.length !== count || sideB.length !== count) {
      errors.players = `选手数量不正确（单打各1人，双打各2人）`;
    }

    // Player info completeness
    const allPlayers = [...sideA, ...sideB];
    for (const p of allPlayers) {
      if (!p.isGuest && !p.userId) {
        errors.players = '请选择所有选手';
        break;
      }
      if (p.isGuest && (!p.guestName || p.guestName.trim().length === 0)) {
        errors.players = '选手信息不完整';
        break;
      }
      if (p.isGuest && p.guestName.length > 20) {
        errors.guestName = '非平台用户昵称不能为空，且不超过20个字符';
        break;
      }
    }

    // Duplicate user check
    const userIds = allPlayers.filter((p) => !p.isGuest && p.userId).map((p) => p.userId!);
    const uniqueIds = new Set(userIds);
    if (uniqueIds.size !== userIds.length) {
      errors.duplicate = '同一选手不能同时出现在两侧';
    }

    // Games validation
    if (games.length === 0) {
      errors.games = '请至少录入1局比分';
    }
    for (let i = 0; i < games.length; i++) {
      const g = games[i];
      if (g.scoreA === null || g.scoreB === null) {
        errors.games = '请填写所有比分';
        break;
      }
      if (
        g.scoreA < 0 ||
        g.scoreA > 30 ||
        g.scoreB < 0 ||
        g.scoreB > 30
      ) {
        errors.games = '单局比分需在0-30之间，且不可同时为0';
        break;
      }
      if (g.scoreA === 0 && g.scoreB === 0) {
        errors.games = '单局比分需在0-30之间，且不可同时为0';
        break;
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const body = {
      sourceType,
      sourceId,
      matchType,
      players: {
        sideA: sideA.map((p) =>
          p.isGuest ? { guestName: p.guestName } : { userId: p.userId ?? '' },
        ),
        sideB: sideB.map((p) =>
          p.isGuest ? { guestName: p.guestName } : { userId: p.userId ?? '' },
        ),
      },
      games: games.map((g) => ({
        scoreA: g.scoreA ?? 0,
        scoreB: g.scoreB ?? 0,
      })),
    };

    createMutation.mutate(body, {
      onSuccess: () => {
        message.success('战绩录入成功');
        if (sourceType === 'activity') {
          navigate(`/activities/${sourceId}`);
        } else if (sourceType === 'group-class') {
          navigate(`/group-classes/${sourceId}`);
        } else {
          navigate(-1);
        }
      },
    });
  };

  // --- API error display ---
  const apiError = createMutation.isError
    ? (createMutation.error as Error & { code?: string })
    : null;
  const apiErrorMessage = apiError?.code
    ? ERROR_CODE_MAP[apiError.code] ?? apiError.message
    : null;

  // --- Render ---

  const renderPlayerSelector = (
    side: 'A' | 'B',
    index: number,
    player: PlayerFormItem,
  ) => {
    const key = `${side}-${index}`;
    const availableParticipants = participants.filter(
      (p) => !selectedUserIds.has(p.userId) || p.userId === player.userId,
    );

    return (
      <div key={key} style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span>非平台用户</span>
          <Switch
            role="switch"
            size="small"
            checked={player.isGuest}
            disabled={isPrivateLesson}
            onChange={(checked) =>
              updatePlayer(side, index, {
                isGuest: checked,
                userId: null,
                guestName: '',
              })
            }
          />
        </div>
        {player.isGuest ? (
          <input
            placeholder="输入昵称"
            value={player.guestName}
            onChange={(e) =>
              updatePlayer(side, index, { guestName: e.target.value })
            }
            style={{ width: '100%', padding: '4px 8px' }}
          />
        ) : (
          <Select
            style={{ width: '100%' }}
            placeholder="请选定参与者"
            value={player.userId ?? undefined}
            onChange={(value) => updatePlayer(side, index, { userId: value })}
            options={availableParticipants.map((p) => ({
              label: p.nickname,
              value: p.userId,
            }))}
          />
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: 16 }}>
      {/* Match Type Selector */}
      <div style={{ marginBottom: 16 }}>
        <Radio.Group
          value={matchType}
          onChange={(e) => handleMatchTypeChange(e.target.value as MatchType)}
          optionType="button"
          buttonStyle="solid"
        >
          <Radio.Button value="singles">单打</Radio.Button>
          <Radio.Button value="doubles">双打</Radio.Button>
        </Radio.Group>
      </div>

      {/* Player Section */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <h4>A 方</h4>
          {sideA.map((p, i) => renderPlayerSelector('A', i, p))}
        </div>
        <div style={{ marginBottom: 12 }}>
          <h4>B 方</h4>
          {sideB.map((p, i) => renderPlayerSelector('B', i, p))}
        </div>
      </div>

      {formErrors.players && (
        <div style={{ color: 'red', marginBottom: 8 }}>{formErrors.players}</div>
      )}
      {formErrors.guestName && (
        <div style={{ color: 'red', marginBottom: 8 }}>{formErrors.guestName}</div>
      )}
      {formErrors.duplicate && (
        <div style={{ color: 'red', marginBottom: 8 }}>{formErrors.duplicate}</div>
      )}

      {/* Score Section */}
      <div style={{ marginBottom: 16 }}>
        {games.map((g, i) => (
          <div
            key={i}
            style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}
          >
            <span>第 {i + 1} 局</span>
            <InputNumber
              min={0}
              max={30}
              value={g.scoreA}
              onChange={(v) => updateGame(i, 'scoreA', v)}
              placeholder="比分A"
            />
            <span>:</span>
            <InputNumber
              min={0}
              max={30}
              value={g.scoreB}
              onChange={(v) => updateGame(i, 'scoreB', v)}
              placeholder="比分B"
            />
            {games.length > 1 && (
              <button type="button" onClick={() => removeGame(i)}>
                删除
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={addGame}>添加一局</button>
      </div>

      {formErrors.games && (
        <div style={{ color: 'red', marginBottom: 8 }}>{formErrors.games}</div>
      )}

      {/* API Error */}
      {apiErrorMessage && (
        <div style={{ color: 'red', marginBottom: 8 }}>{apiErrorMessage}</div>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={createMutation.isPending}
      >
        提交战绩
      </button>
    </div>
  );
}
