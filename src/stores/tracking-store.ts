import { create } from 'zustand';

interface TrackingState {
  isOnline: boolean;
  isConnected: boolean;
  gpsEnabled: boolean | null;
  permission: 'undetermined' | 'granted' | 'denied';
  lastSync: string | null;
  setTracking: (patch: Partial<Omit<TrackingState, 'setTracking'>>) => void;
}

export const useTrackingStore = create<TrackingState>((set) => ({
  isOnline: false, isConnected: true, gpsEnabled: null, permission: 'undetermined', lastSync: null,
  setTracking: (patch) => set(patch),
}));
