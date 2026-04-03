import { create } from 'zustand';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  permission: 'granted' | 'denied' | 'prompt';
  loading: boolean;
  setLocation: (latitude: number, longitude: number) => void;
  setPermission: (permission: 'granted' | 'denied' | 'prompt') => void;
  setLoading: (loading: boolean) => void;
}

export const useGeolocationStore = create<GeolocationState>((set) => ({
  latitude: null,
  longitude: null,
  permission: 'prompt',
  loading: false,
  setLocation: (latitude: number, longitude: number) =>
    set({ latitude, longitude, permission: 'granted', loading: false }),
  setPermission: (permission: 'granted' | 'denied' | 'prompt') => set({ permission }),
  setLoading: (loading: boolean) => set({ loading }),
}));
