import { useState, useCallback, useRef } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Input, Button } from '@nutui/nutui-react-taro'
import { createMatchRecord, type MatchType, type PlayerInput, type GameInput } from '../../apis/match-record'
import { searchUsers, type UserSearchResult } from '../../apis/user'
import { useLoginCheck } from '../../hooks/use-login-check'
import styles from './index.module.scss'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PlayerType = 'user' | 'guest'

interface PlayerState {
  type: PlayerType
  keyword: string
  selectedUser: UserSearchResult | null
  guestName: string
  searchResults: UserSearchResult[]
  showDropdown: boolean
}

function createEmptyPlayer(): PlayerState {
  return {
    type: 'user',
    keyword: '',
    selectedUser: null,
    guestName: '',
    searchResults: [],
    showDropdown: false,
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MatchRecordCreatePage() {
  const isLoggedIn = useLoginCheck()
  const router = useRouter()
  const sourceType = (router.params.sourceType || '') as string
  const sourceId = (router.params.sourceId || '') as string

  // Match type
  const [matchType, setMatchType] = useState<MatchType>('singles')

  // Players: sideA[0..1], sideB[0..1]
  const [sideA, setSideA] = useState<PlayerState[]>([createEmptyPlayer()])
  const [sideB, setSideB] = useState<PlayerState[]>([createEmptyPlayer()])

  // Games
  const [games, setGames] = useState<{ scoreA: string; scoreB: string }[]>([
    { scoreA: '', scoreB: '' },
  ])

  // State
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // Search debounce refs
  const searchTimerRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // ---------------------------------------------------------------------------
  // Match type change
  // ---------------------------------------------------------------------------

  const handleMatchTypeChange = useCallback((type: MatchType) => {
    setMatchType(type)
    if (type === 'singles') {
      setSideA((prev) => [prev[0] || createEmptyPlayer()])
      setSideB((prev) => [prev[0] || createEmptyPlayer()])
    } else {
      setSideA((prev) => prev.length < 2 ? [...prev, createEmptyPlayer()] : prev)
      setSideB((prev) => prev.length < 2 ? [...prev, createEmptyPlayer()] : prev)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Player search
  // ---------------------------------------------------------------------------

  const updatePlayer = useCallback(
    (side: 'A' | 'B', index: number, update: Partial<PlayerState>) => {
      const setter = side === 'A' ? setSideA : setSideB
      setter((prev) => {
        const next = [...prev]
        next[index] = { ...next[index], ...update }
        return next
      })
    },
    [],
  )

  const handlePlayerSearch = useCallback(
    (side: 'A' | 'B', index: number, keyword: string) => {
      const key = `${side}-${index}`
      updatePlayer(side, index, { keyword })

      if (searchTimerRefs.current[key]) {
        clearTimeout(searchTimerRefs.current[key])
      }

      const trimmed = keyword.trim()
      if (!trimmed) {
        updatePlayer(side, index, { searchResults: [], showDropdown: false })
        return
      }

      searchTimerRefs.current[key] = setTimeout(async () => {
        try {
          const result = await searchUsers(trimmed)
          updatePlayer(side, index, { searchResults: result.items, showDropdown: true })
        } catch {
          updatePlayer(side, index, { searchResults: [], showDropdown: false })
        }
      }, 300)
    },
    [updatePlayer],
  )

  const handleSelectUser = useCallback(
    (side: 'A' | 'B', index: number, user: UserSearchResult) => {
      updatePlayer(side, index, {
        selectedUser: user,
        keyword: '',
        searchResults: [],
        showDropdown: false,
      })
    },
    [updatePlayer],
  )

  const handleClearUser = useCallback(
    (side: 'A' | 'B', index: number) => {
      updatePlayer(side, index, { selectedUser: null, keyword: '' })
    },
    [updatePlayer],
  )

  const handlePlayerTypeChange = useCallback(
    (side: 'A' | 'B', index: number, type: PlayerType) => {
      updatePlayer(side, index, {
        type,
        selectedUser: null,
        keyword: '',
        guestName: '',
        searchResults: [],
        showDropdown: false,
      })
    },
    [updatePlayer],
  )

  // ---------------------------------------------------------------------------
  // Games
  // ---------------------------------------------------------------------------

  const handleAddGame = useCallback(() => {
    if (games.length >= 5) return
    setGames((prev) => [...prev, { scoreA: '', scoreB: '' }])
  }, [games.length])

  const handleRemoveGame = useCallback((index: number) => {
    setGames((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleScoreChange = useCallback(
    (index: number, field: 'scoreA' | 'scoreB', value: string) => {
      setGames((prev) => {
        const next = [...prev]
        next[index] = { ...next[index], [field]: value }
        return next
      })
    },
    [],
  )

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  function validatePlayer(player: PlayerState, label: string): string | null {
    if (player.type === 'user') {
      if (!player.selectedUser) return `${label}请选择用户`
    } else {
      if (!player.guestName.trim()) return `${label}请输入昵称`
    }
    return null
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {}

    if (!sourceType || !sourceId) {
      newErrors.source = '缺少来源信息'
    }

    // Validate players
    const expectedCount = matchType === 'singles' ? 1 : 2
    for (let i = 0; i < expectedCount; i++) {
      const errA = validatePlayer(sideA[i], `A方选手${i + 1}`)
      if (errA) newErrors[`sideA-${i}`] = errA
      const errB = validatePlayer(sideB[i], `B方选手${i + 1}`)
      if (errB) newErrors[`sideB-${i}`] = errB
    }

    // Validate games
    if (games.length === 0) {
      newErrors.games = '至少需要 1 局比分'
    }
    for (let i = 0; i < games.length; i++) {
      const g = games[i]
      const a = parseInt(g.scoreA, 10)
      const b = parseInt(g.scoreB, 10)
      if (g.scoreA === '' || isNaN(a) || a < 0 || a > 30) {
        newErrors[`game-${i}-scoreA`] = `第 ${i + 1} 局 A 方得分无效`
      }
      if (g.scoreB === '' || isNaN(b) || b < 0 || b > 30) {
        newErrors[`game-${i}-scoreB`] = `第 ${i + 1} 局 B 方得分无效`
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  function buildPlayerInput(player: PlayerState): PlayerInput {
    if (player.type === 'user' && player.selectedUser) {
      return { userId: player.selectedUser.id }
    }
    return { guestName: player.guestName.trim() }
  }

  async function handleSubmit() {
    if (submitting) return
    if (!validate()) return

    setSubmitting(true)
    try {
      const expectedCount = matchType === 'singles' ? 1 : 2
      const playersA: PlayerInput[] = sideA.slice(0, expectedCount).map(buildPlayerInput)
      const playersB: PlayerInput[] = sideB.slice(0, expectedCount).map(buildPlayerInput)

      const gameInputs: GameInput[] = games.map((g) => ({
        scoreA: parseInt(g.scoreA, 10),
        scoreB: parseInt(g.scoreB, 10),
      }))

      await createMatchRecord({
        sourceType: sourceType as 'activity' | 'group-class' | 'private-lesson',
        sourceId,
        matchType,
        players: { sideA: playersA, sideB: playersB },
        games: gameInputs,
      })

      Taro.showToast({ title: '录入成功', icon: 'success' })
      setTimeout(() => {
        Taro.navigateBack()
      }, 500)
    } catch (err) {
      const apiError = err as Error
      Taro.showToast({ title: apiError.message || '录入失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function renderPlayerCard(side: 'A' | 'B', index: number, player: PlayerState) {
    const errorKey = `side${side}-${index}`
    return (
      <View className={styles.playerCard} key={`${side}-${index}`}>
        {/* Player type selection */}
        <View className={styles.playerTypeRow}>
          <View
            className={`${styles.playerTypeBtn} ${player.type === 'user' ? styles.playerTypeBtnActive : ''}`}
            onClick={() => handlePlayerTypeChange(side, index, 'user')}
          >
            <Text>平台用户</Text>
          </View>
          <View
            className={`${styles.playerTypeBtn} ${player.type === 'guest' ? styles.playerTypeBtnActive : ''}`}
            onClick={() => handlePlayerTypeChange(side, index, 'guest')}
          >
            <Text>临时选手</Text>
          </View>
        </View>

        {/* User search mode */}
        {player.type === 'user' && !player.selectedUser && (
          <View className={styles.searchWrap}>
            <View className={styles.inputWrap}>
              <Input
                placeholder="输入昵称搜索用户"
                value={player.keyword}
                onChange={(val) => handlePlayerSearch(side, index, val)}
              />
            </View>
            {player.showDropdown && (
              <View className={styles.dropdown}>
                {player.searchResults.length > 0 ? (
                  player.searchResults.map((user) => (
                    <View
                      key={user.id}
                      className={styles.dropdownItem}
                      onClick={() => handleSelectUser(side, index, user)}
                    >
                      <Text className={styles.dropdownName}>{user.nickname}</Text>
                      <Text className={styles.dropdownPhone}>****{user.phoneLast4}</Text>
                    </View>
                  ))
                ) : (
                  <View className={styles.dropdownEmpty}>
                    <Text>未找到用户</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Selected user display */}
        {player.type === 'user' && player.selectedUser && (
          <View className={styles.selectedUser}>
            <Text className={styles.selectedNickname}>{player.selectedUser.nickname}</Text>
            <Text className={styles.clearBtn} onClick={() => handleClearUser(side, index)}>
              清除
            </Text>
          </View>
        )}

        {/* Guest name input */}
        {player.type === 'guest' && (
          <View className={styles.inputWrap}>
            <Input
              placeholder="输入临时选手昵称"
              value={player.guestName}
              onChange={(val) => updatePlayer(side, index, { guestName: val })}
            />
          </View>
        )}

        {errors[errorKey] && <Text className={styles.errorText}>{errors[errorKey]}</Text>}
      </View>
    )
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  if (!isLoggedIn) return null

  const playerCount = matchType === 'singles' ? 1 : 2

  return (
    <View className={styles.container}>
      {/* 来源信息不足提示 */}
      {errors.source && <Text className={styles.errorText}>{errors.source}</Text>}

      {/* 比赛类型 */}
      <View className={styles.fieldGroup}>
        <Text className={styles.label}>比赛类型</Text>
        <View className={styles.tabRow}>
          <View
            className={`${styles.tabItem} ${matchType === 'singles' ? styles.tabItemActive : ''}`}
            onClick={() => handleMatchTypeChange('singles')}
          >
            <Text>单打</Text>
          </View>
          <View
            className={`${styles.tabItem} ${matchType === 'doubles' ? styles.tabItemActive : ''}`}
            onClick={() => handleMatchTypeChange('doubles')}
          >
            <Text>双打</Text>
          </View>
        </View>
      </View>

      {/* A 方选手 */}
      <View className={styles.fieldGroup}>
        <View className={styles.sideHeader}>
          <Text className={styles.sideLabel}>A 方选手</Text>
        </View>
        {sideA.slice(0, playerCount).map((player, i) => renderPlayerCard('A', i, player))}
      </View>

      {/* B 方选手 */}
      <View className={styles.fieldGroup}>
        <View className={styles.sideHeader}>
          <Text className={styles.sideLabel}>B 方选手</Text>
        </View>
        {sideB.slice(0, playerCount).map((player, i) => renderPlayerCard('B', i, player))}
      </View>

      {/* 比分录入 */}
      <View className={styles.fieldGroup}>
        <Text className={styles.label}>比分</Text>
        {games.map((game, i) => (
          <View className={styles.gameRow} key={i}>
            <Text className={styles.gameLabel}>第 {i + 1} 局</Text>
            <View className={styles.scoreInputWrap}>
              <Input
                placeholder="A"
                type="number"
                value={game.scoreA}
                onChange={(val) => handleScoreChange(i, 'scoreA', val)}
              />
            </View>
            <Text className={styles.scoreSeparator}>:</Text>
            <View className={styles.scoreInputWrap}>
              <Input
                placeholder="B"
                type="number"
                value={game.scoreB}
                onChange={(val) => handleScoreChange(i, 'scoreB', val)}
              />
            </View>
            {i > 0 && (
              <Text className={styles.removeGameBtn} onClick={() => handleRemoveGame(i)}>
                删除
              </Text>
            )}
          </View>
        ))}
        {errors.games && <Text className={styles.errorText}>{errors.games}</Text>}
        {games.length < 5 && (
          <Text className={styles.addGameBtn} onClick={handleAddGame}>
            + 添加一局
          </Text>
        )}
      </View>

      {/* 提交按钮 */}
      <Button
        type="primary"
        block
        className={styles.submitBtn}
        disabled={submitting}
        onClick={handleSubmit}
        style={{ background: '#4ADE80', borderColor: '#4ADE80' }}
      >
        {submitting ? '提交中...' : '提交战绩'}
      </Button>
    </View>
  )
}
