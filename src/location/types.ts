/** Tipe data fitur lokasi & arena sesi. */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface SessionLocation {
  sessionId: string;
  latitude: number;
  longitude: number;
  address: string | null;
  placeName: string | null;
  radiusM: number;
  geofenceEnabled: boolean;
  updatedAt: string;
}

export type GeofenceEventType = 'enter' | 'exit';
export type GeofenceEventSource = 'background' | 'foreground';

export interface GeofenceEvent {
  id: number;
  sessionId: string;
  type: GeofenceEventType;
  source: GeofenceEventSource;
  latitude: number | null;
  longitude: number | null;
  occurredAt: string;
}

export interface GeocodedPlace {
  address: string;
  placeName: string | null;
}

export type LocationPermissionState = 'checking' | 'granted' | 'denied' | 'undetermined';

export type ArenaStatus = 'inside' | 'outside' | 'unknown';
