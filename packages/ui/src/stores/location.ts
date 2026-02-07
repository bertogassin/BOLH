import { createStore } from 'solid-js/store';
import { createContext, useContext } from 'solid-js';

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
}

export interface LocationState {
  current: Coordinates | null;
  isLoading: boolean;
  error: string | null;
  permissionStatus: 'granted' | 'denied' | 'prompt' | null;
  watchId: number | null;
}

const initialState: LocationState = {
  current: null,
  isLoading: false,
  error: null,
  permissionStatus: null,
  watchId: null,
};

const [state, setState] = createStore<LocationState>(initialState);

export const locationStore = {
  get state() {
    return state;
  },

  async checkPermission(): Promise<'granted' | 'denied' | 'prompt'> {
    if (!navigator.permissions) {
      return 'prompt';
    }
    
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      setState('permissionStatus', result.state as any);
      return result.state as 'granted' | 'denied' | 'prompt';
    } catch {
      return 'prompt';
    }
  },

  async getCurrentPosition(): Promise<Coordinates | null> {
    if (!navigator.geolocation) {
      setState('error', 'Geolocation is not supported');
      return null;
    }

    setState('isLoading', true);
    setState('error', null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords: Coordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude ?? undefined,
            heading: position.coords.heading ?? undefined,
            speed: position.coords.speed ?? undefined,
          };
          setState('current', coords);
          setState('isLoading', false);
          setState('permissionStatus', 'granted');
          resolve(coords);
        },
        (error) => {
          const errorMessages: Record<number, string> = {
            1: 'Permission denied',
            2: 'Position unavailable',
            3: 'Request timeout',
          };
          setState('error', errorMessages[error.code] || 'Unknown error');
          setState('isLoading', false);
          if (error.code === 1) {
            setState('permissionStatus', 'denied');
          }
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  },

  startWatching(onUpdate?: (coords: Coordinates) => void) {
    if (!navigator.geolocation) {
      setState('error', 'Geolocation is not supported');
      return;
    }

    if (state.watchId !== null) {
      this.stopWatching();
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const coords: Coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude ?? undefined,
          heading: position.coords.heading ?? undefined,
          speed: position.coords.speed ?? undefined,
        };
        setState('current', coords);
        setState('error', null);
        setState('permissionStatus', 'granted');
        onUpdate?.(coords);
      },
      (error) => {
        const errorMessages: Record<number, string> = {
          1: 'Permission denied',
          2: 'Position unavailable',
          3: 'Request timeout',
        };
        setState('error', errorMessages[error.code] || 'Unknown error');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000,
      }
    );

    setState('watchId', watchId);
  },

  stopWatching() {
    if (state.watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(state.watchId);
      setState('watchId', null);
    }
  },

  setCoordinates(coords: Coordinates) {
    setState('current', coords);
  },
};

export const LocationContext = createContext(locationStore);

export function useLocation() {
  return useContext(LocationContext);
}
