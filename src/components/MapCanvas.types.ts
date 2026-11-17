import type { Coordinates } from '../location/types';

export interface ArenaMarker {
  /** Id sesi, dipakai juga sebagai identifier region geofence. */
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  address: string | null;
  radiusM: number;
  selected: boolean;
}

export interface MapCamera {
  coords: Coordinates;
  /** Naikkan angka ini untuk memicu animasi kamera. */
  key: number;
}

export interface MapCanvasProps {
  userLocation: Coordinates | null;
  showUserLocation: boolean;
  markers: ArenaMarker[];
  draft: Coordinates | null;
  draftRadiusM: number;
  camera: MapCamera | null;
  onPressLocation: (coords: Coordinates) => void;
  onDragDraft: (coords: Coordinates) => void;
}
