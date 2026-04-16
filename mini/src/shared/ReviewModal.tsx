import { useState, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Textarea, Button } from '@tarojs/components'
import { submitReview } from '../apis/review'
import styles from './ReviewModal.module.scss'

interface ReviewModalProps {
  visible: boolean
  coachId: string
  sourceType: 'group-class' | 'private-lesson'
  sourceId: string
  onClose: () => void
  onSuccess: () => void
}

const STAR_LABELS = ['很差', '较差', '一般', '不错', '很好']

export default function ReviewModal({
  visible,
  coachId,
  sourceType,
  sourceId,
  onClose,
  onSuccess,
}: ReviewModalProps) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (rating === 0) {
      Taro.showToast({ title: '请选择评分', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await submitReview({
        coachId,
        courseType: sourceType,
        courseId: sourceId,
        rating,
        comment: comment.trim() || undefined,
      })
      Taro.showToast({ title: '评价成功', icon: 'success' })
      setRating(0)
      setComment('')
      onSuccess()
    } catch (err) {
      const e = err as Error
      Taro.showToast({ title: e.message || '提交失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }, [coachId, sourceType, sourceId, rating, comment, onSuccess])

  const handleClose = useCallback(() => {
    if (submitting) return
    setRating(0)
    setComment('')
    onClose()
  }, [submitting, onClose])

  if (!visible) return null

  return (
    <View className={styles.overlay} onClick={handleClose}>
      <View className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <View className={styles.header}>
          <Text className={styles.title}>评价教练</Text>
          <View className={styles.closeBtn} onClick={handleClose}>
            <Text className={styles.closeBtnText}>X</Text>
          </View>
        </View>

        {/* Star rating */}
        <View className={styles.ratingSection}>
          <View className={styles.stars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <View
                key={star}
                className={styles.starWrapper}
                onClick={() => setRating(star)}
              >
                <Text
                  className={`${styles.star} ${star <= rating ? styles.starActive : styles.starInactive}`}
                >
                  {star <= rating ? '\u2605' : '\u2606'}
                </Text>
              </View>
            ))}
          </View>
          {rating > 0 && (
            <Text className={styles.ratingLabel}>{STAR_LABELS[rating - 1]}</Text>
          )}
        </View>

        {/* Comment textarea */}
        <View className={styles.commentSection}>
          <Textarea
            className={styles.textarea}
            placeholder='写下你的评价（选填，最多500字）'
            placeholderClass={styles.textareaPlaceholder}
            value={comment}
            onInput={(e) => setComment(e.detail.value)}
            maxlength={500}
          />
          <Text className={styles.charCount}>{comment.length}/500</Text>
        </View>

        {/* Submit button */}
        <Button
          className={`${styles.submitBtn} ${rating === 0 || submitting ? styles.submitBtnDisabled : ''}`}
          onClick={handleSubmit}
          disabled={rating === 0 || submitting}
        >
          {submitting ? '提交中...' : '提交评价'}
        </Button>
      </View>
    </View>
  )
}
