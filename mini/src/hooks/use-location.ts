import { useState, useCallback } from 'react'
import Taro from '@tarojs/taro'

interface Location {
  latitude: number
  longitude: number
}

export function useLocation() {
  const [location, setLocation] = useState<Location | null>(null)

  const getLocation = useCallback(async (): Promise<Location | null> => {
    try {
      const setting = await Taro.getSetting()
      if (!setting.authSetting['scope.userLocation']) {
        try {
          await Taro.authorize({ scope: 'scope.userLocation' })
        } catch {
          return null
        }
      }
      const res = await Taro.getLocation({ type: 'gcj02' })
      const loc = { latitude: res.latitude, longitude: res.longitude }
      setLocation(loc)
      return loc
    } catch {
      return null
    }
  }, [])

  return { location, getLocation }
}
