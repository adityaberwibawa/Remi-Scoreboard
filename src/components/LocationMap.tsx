import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker, type MapPressEvent, type Region } from 'react-native-maps';
import { Colors, Radius } from '../theme';
import type { GeoPoint } from '../location/geo';

interface Props {
  current: GeoPoint | null;
  center: GeoPoint | null;
  radius: number;
  onSelectCenter?: (point: GeoPoint) => void;
}

const DEFAULT_REGION: Region = {
  latitude: -6.2088,
  longitude: 106.8456,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

function toRegion(point: GeoPoint, delta = 0.01): Region {
  return {
    latitude: point.latitude,
    longitude: point.longitude,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
}

export function LocationMap({ current, center, radius, onSelectCenter }: Props) {
  const mapRef = useRef<MapView>(null);
  const centeredRef = useRef(false);

  useEffect(() => {
    if (!current || centeredRef.current) return;
    centeredRef.current = true;
    mapRef.current?.animateToRegion(toRegion(current), 400);
  }, [current]);

  const areaDelta = Math.max(0.005, (radius * 2.4) / 111320);
  const initialRegion = center
    ? toRegion(center, areaDelta)
    : current
      ? toRegion(current)
      : DEFAULT_REGION;

  const handlePress = (event: MapPressEvent) => {
    if (!onSelectCenter) return;
    onSelectCenter(event.nativeEvent.coordinate);
  };

  return (
    <View style={styles.wrap}>
      <MapView
        ref={mapRef}
        accessibilityLabel="Peta lokasi saat ini dan area geofence"
        initialRegion={initialRegion}
        onPress={handlePress}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        style={styles.map}>
        {current ? (
          <Marker
            coordinate={current}
            title="Lokasi saya"
            description={center ? 'Titik lokasi perangkat saat ini' : undefined}
            pinColor={Colors.accent}
          />
        ) : null}
        {center ? (
          <>
            <Marker
              coordinate={center}
              title="Pusat area bermain"
              pinColor={Colors.gold}
            />
            <Circle
              center={center}
              radius={Math.max(1, radius)}
              fillColor="rgba(52, 211, 153, 0.16)"
              strokeColor={Colors.accent}
              strokeWidth={2}
            />
          </>
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 260,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.raised,
  },
  map: { flex: 1 },
});
