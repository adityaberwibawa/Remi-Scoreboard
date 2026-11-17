import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker, type MapPressEvent, type Region } from 'react-native-maps';
import { Colors, Radius } from '../theme';
import { haversineMeters } from '../location/geo';
import type { Coordinates } from '../location/types';
import type { MapCanvasProps } from './MapCanvas.types';

const DEFAULT_COORDS: Coordinates = { latitude: -6.2, longitude: 106.816666 };
const CAMERA_DELTA = 0.012;

function toRegion(coords: Coordinates): Region {
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    latitudeDelta: CAMERA_DELTA,
    longitudeDelta: CAMERA_DELTA,
  };
}

function isSamePoint(a: Coordinates, b: Coordinates): boolean {
  return haversineMeters(a, b) < 1;
}

/** Peta native Android/iOS. Komponen web ada di MapCanvas.tsx. */
export function MapCanvas({
  showUserLocation,
  markers,
  draft,
  draftRadiusM,
  camera,
  onPressLocation,
  onDragDraft,
}: MapCanvasProps) {
  const mapRef = useRef<MapView | null>(null);
  const lastCameraKey = useRef<number | null>(null);

  // Initial region hanya dipakai saat mount; perubahan kamera ditangani efek.
  const selectedMarker = markers.find((marker) => marker.selected);
  const initialCoords =
    camera?.coords ?? selectedMarker ?? markers[0] ?? DEFAULT_COORDS;
  const draftSamePoint = !!(draft && selectedMarker && isSamePoint(draft, selectedMarker));
  const draftSameConfig = !!(
    draft &&
    selectedMarker &&
    isSamePoint(draft, selectedMarker) &&
    Math.abs(draftRadiusM - selectedMarker.radiusM) < 1
  );

  useEffect(() => {
    if (!camera || lastCameraKey.current === camera.key) return;
    lastCameraKey.current = camera.key;
    mapRef.current?.animateToRegion(toRegion(camera.coords), 450);
  }, [camera]);

  const handlePress = (event: MapPressEvent) => {
    onPressLocation(event.nativeEvent.coordinate);
  };

  return (
    <View style={styles.wrap}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={toRegion(initialCoords)}
        showsUserLocation={showUserLocation}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        userInterfaceStyle="dark"
        onMapReady={() => {
          if (camera) mapRef.current?.animateToRegion(toRegion(camera.coords), 0);
        }}
        onPress={handlePress}>
        {markers.map((marker) => (
          <Circle
            key={`radius-${marker.id}`}
            center={{ latitude: marker.latitude, longitude: marker.longitude }}
            radius={Math.max(1, marker.radiusM)}
            strokeColor={marker.selected ? Colors.accent : Colors.muted}
            fillColor={
              marker.selected ? 'rgba(52, 211, 153, 0.16)' : 'rgba(154, 165, 173, 0.08)'
            }
            strokeWidth={marker.selected ? 2 : 1}
          />
        ))}
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
            title={marker.title}
            description={marker.address ?? `Radius ${marker.radiusM} m`}
            pinColor={marker.selected ? Colors.accent : Colors.muted}
          />
        ))}
        {draft && !draftSameConfig ? (
          <Circle
            center={draft}
            radius={Math.max(1, draftRadiusM)}
            strokeColor={Colors.gold}
            fillColor="rgba(245, 200, 66, 0.12)"
            strokeWidth={2}
          />
        ) : null}
        {draft && !draftSamePoint ? (
          <Marker
            coordinate={draft}
            title="Titik arena"
            description="Geser pin untuk menyesuaikan lokasi"
            pinColor={Colors.gold}
            draggable
            onDragEnd={(event) => onDragDraft(event.nativeEvent.coordinate)}
          />
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.raised,
  },
});
