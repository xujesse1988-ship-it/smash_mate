import { useCallback } from 'react';
import { useGeolocationStore } from '../../stores/geolocation-store';

interface UseGeolocationReturn {
  latitude: number | null;
  longitude: number | null;
  permission: 'granted' | 'denied' | 'prompt';
  loading: boolean;
  requestLocation: () => void;
}

export function useGeolocation(): UseGeolocationReturn {
  const latitude = useGeolocationStore((s) => s.latitude);
  const longitude = useGeolocationStore((s) => s.longitude);
  const permission = useGeolocationStore((s) => s.permission);
  const loading = useGeolocationStore((s) => s.loading);
  const setLocation = useGeolocationStore((s) => s.setLocation);
  const setPermission = useGeolocationStore((s) => s.setPermission);
  const setLoading = useGeolocationStore((s) => s.setLoading);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setPermission('denied');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation(position.coords.latitude, position.coords.longitude);
      },
      () => {
        setPermission('denied');
        setLoading(false);
      },
    );
  }, [setLocation, setPermission, setLoading]);

  return {
    latitude,
    longitude,
    permission,
    loading,
    requestLocation,
  };
}
