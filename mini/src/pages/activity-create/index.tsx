import { useState, useCallback, useRef } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Picker } from '@tarojs/components'
import { Input, Button } from '@nutui/nutui-react-taro'
import { createActivity } from '../../apis/activity'
import { searchVenues, type VenueSearchItem } from '../../apis/venue'
import { useLoginCheck } from '../../hooks/use-login-check'
import styles from './index.module.scss'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function padTwo(n: number): string {
  return String(n).padStart(2, '0')
}

function getToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${padTwo(d.getMonth() + 1)}-${padTwo(d.getDate())}`
}

function buildISO(date: string, time: string): string {
  // date: "YYYY-MM-DD", time: "HH:mm"
  return `${date}T${time}:00`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ActivityCreatePage() {
  const isLoggedIn = useLoginCheck()

  // Venue search
  const [venueKeyword, setVenueKeyword] = useState('')
  const [venueResults, setVenueResults] = useState<VenueSearchItem[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedVenue, setSelectedVenue] = useState<VenueSearchItem | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Form fields
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [maxParticipants, setMaxParticipants] = useState('')

  // State
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // ---------------------------------------------------------------------------
  // Venue search with debounce
  // ---------------------------------------------------------------------------

  const handleVenueSearch = useCallback((keyword: string) => {
    setVenueKeyword(keyword)
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current)
    }

    const trimmed = keyword.trim()
    if (!trimmed) {
      setVenueResults([])
      setShowDropdown(false)
      return
    }

    searchTimerRef.current = setTimeout(async () => {
      try {
        const result = await searchVenues({ keyword: trimmed, pageSize: 10 })
        setVenueResults(result.items)
        setShowDropdown(true)
      } catch {
        setVenueResults([])
      }
    }, 300)
  }, [])

  const handleSelectVenue = useCallback((venue: VenueSearchItem) => {
    setSelectedVenue(venue)
    setVenueKeyword('')
    setVenueResults([])
    setShowDropdown(false)
  }, [])

  const handleClearVenue = useCallback(() => {
    setSelectedVenue(null)
  }, [])

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  function validate(): boolean {
    const newErrors: Record<string, string> = {}

    if (!date) {
      newErrors.date = '请选择日期'
    }
    if (!startTime) {
      newErrors.startTime = '请选择开始时间'
    }
    if (!endTime) {
      newErrors.endTime = '请选择结束时间'
    }

    if (date && startTime) {
      const startISO = buildISO(date, startTime)
      const startDate = new Date(startISO)
      if (startDate <= new Date()) {
        newErrors.startTime = '开始时间不能早于当前时间'
      }
    }

    if (date && startTime && endTime) {
      const startISO = buildISO(date, startTime)
      const endISO = buildISO(date, endTime)
      if (endISO <= startISO) {
        newErrors.endTime = '结束时间必须晚于开始时间'
      }
    }

    const participants = parseInt(maxParticipants, 10)
    if (!maxParticipants || isNaN(participants)) {
      newErrors.maxParticipants = '请输入参与人数'
    } else if (participants < 2 || participants > 50) {
      newErrors.maxParticipants = '参与人数需在 2-50 之间'
    }

    if (title.length > 50) {
      newErrors.title = '标题不能超过 50 个字'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  async function handleSubmit() {
    if (submitting) return
    if (!validate()) return

    setSubmitting(true)
    try {
      const startISO = buildISO(date, startTime)
      const endISO = buildISO(date, endTime)

      const result = await createActivity({
        venueId: selectedVenue?.id,
        title: title.trim() || undefined,
        startTime: startISO,
        endTime: endISO,
        maxParticipants: parseInt(maxParticipants, 10),
      })

      Taro.showToast({ title: '创建成功', icon: 'success' })
      setTimeout(() => {
        Taro.navigateTo({ url: `/pages/activity-detail/index?id=${result.id}` })
      }, 500)
    } catch (err) {
      const apiError = err as Error
      Taro.showToast({ title: apiError.message || '创建失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!isLoggedIn) return null

  const today = getToday()

  return (
    <View className={styles.container}>
      {/* 场馆选择（可选） */}
      <View className={styles.fieldGroup}>
        <Text className={styles.label}>场馆（选填）</Text>
        {!selectedVenue && (
          <View className={styles.searchWrap}>
            <View className={styles.inputWrap}>
              <Input
                placeholder="搜索场馆名称"
                value={venueKeyword}
                onChange={(val) => handleVenueSearch(val)}
              />
            </View>
            {showDropdown && (
              <View className={styles.dropdown}>
                {venueResults.length > 0 ? (
                  venueResults.map((venue) => (
                    <View
                      key={venue.id}
                      className={styles.dropdownItem}
                      onClick={() => handleSelectVenue(venue)}
                    >
                      <Text className={styles.dropdownName}>{venue.name}</Text>
                      <Text className={styles.dropdownAddress}>{venue.address}</Text>
                    </View>
                  ))
                ) : (
                  <View className={styles.dropdownEmpty}>
                    <Text>未找到相关场馆</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
        {selectedVenue && (
          <View className={styles.selectedVenue}>
            <View className={styles.selectedInfo}>
              <Text className={styles.selectedName}>{selectedVenue.name}</Text>
              <Text className={styles.selectedAddress}>{selectedVenue.address}</Text>
            </View>
            <Text className={styles.clearBtn} onClick={handleClearVenue}>
              清除
            </Text>
          </View>
        )}
      </View>

      {/* 活动标题（可选） */}
      <View className={styles.fieldGroup}>
        <Text className={styles.label}>活动标题（选填，最多 50 字）</Text>
        <View className={`${styles.inputWrap} ${errors.title ? styles.inputError : ''}`}>
          <Input
            placeholder="例如：周末双打约战"
            maxLength={50}
            value={title}
            onChange={(val) => {
              setTitle(val)
              if (errors.title) {
                setErrors((prev) => {
                  const { title: _, ...rest } = prev
                  return rest
                })
              }
            }}
          />
        </View>
        {errors.title && <Text className={styles.errorText}>{errors.title}</Text>}
      </View>

      {/* 日期选择 */}
      <View className={styles.fieldGroup}>
        <Text className={styles.label}>日期</Text>
        <Picker mode="date" start={today} value={date || today} onChange={(e) => setDate(e.detail.value)}>
          <View className={`${styles.pickerRow} ${errors.date ? styles.inputError : ''}`}>
            {date ? (
              <Text className={styles.pickerValue}>{date}</Text>
            ) : (
              <Text className={styles.pickerPlaceholder}>请选择日期</Text>
            )}
            <Text className={styles.pickerArrow}>{'>'}</Text>
          </View>
        </Picker>
        {errors.date && <Text className={styles.errorText}>{errors.date}</Text>}
      </View>

      {/* 开始/结束时间 */}
      <View className={styles.fieldGroup}>
        <Text className={styles.label}>时间</Text>
        <View className={styles.timeRow}>
          <View className={styles.timeCol}>
            <Text className={styles.timeLabel}>开始</Text>
            <Picker mode="time" value={startTime || '08:00'} onChange={(e) => {
              setStartTime(e.detail.value)
              if (errors.startTime) {
                setErrors((prev) => {
                  const { startTime: _, ...rest } = prev
                  return rest
                })
              }
            }}>
              <View className={`${styles.pickerRow} ${errors.startTime ? styles.inputError : ''}`}>
                {startTime ? (
                  <Text className={styles.pickerValue}>{startTime}</Text>
                ) : (
                  <Text className={styles.pickerPlaceholder}>开始时间</Text>
                )}
                <Text className={styles.pickerArrow}>{'>'}</Text>
              </View>
            </Picker>
            {errors.startTime && <Text className={styles.errorText}>{errors.startTime}</Text>}
          </View>
          <View className={styles.timeCol}>
            <Text className={styles.timeLabel}>结束</Text>
            <Picker mode="time" value={endTime || '10:00'} onChange={(e) => {
              setEndTime(e.detail.value)
              if (errors.endTime) {
                setErrors((prev) => {
                  const { endTime: _, ...rest } = prev
                  return rest
                })
              }
            }}>
              <View className={`${styles.pickerRow} ${errors.endTime ? styles.inputError : ''}`}>
                {endTime ? (
                  <Text className={styles.pickerValue}>{endTime}</Text>
                ) : (
                  <Text className={styles.pickerPlaceholder}>结束时间</Text>
                )}
                <Text className={styles.pickerArrow}>{'>'}</Text>
              </View>
            </Picker>
            {errors.endTime && <Text className={styles.errorText}>{errors.endTime}</Text>}
          </View>
        </View>
      </View>

      {/* 最大参与人数 */}
      <View className={styles.fieldGroup}>
        <Text className={styles.label}>最大参与人数</Text>
        <View className={`${styles.numberInputWrap} ${errors.maxParticipants ? styles.inputError : ''}`}>
          <Input
            placeholder="请输入人数"
            type="number"
            value={maxParticipants}
            onChange={(val) => {
              setMaxParticipants(val)
              if (errors.maxParticipants) {
                setErrors((prev) => {
                  const { maxParticipants: _, ...rest } = prev
                  return rest
                })
              }
            }}
          />
        </View>
        <Text className={styles.numberHint}>2-50 人</Text>
        {errors.maxParticipants && <Text className={styles.errorText}>{errors.maxParticipants}</Text>}
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
        {submitting ? '创建中...' : '发起约球'}
      </Button>
    </View>
  )
}
