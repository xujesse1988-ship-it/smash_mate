import { View, Text } from '@tarojs/components'
import styles from './index.module.scss'

export default function Index() {
  return (
    <View className={styles.container}>
      <Text className={styles.title}>羽约 SmashMate</Text>
      <Text className={styles.subtitle}>约球列表即将上线</Text>
    </View>
  )
}
