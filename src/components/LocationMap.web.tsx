import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontFamily, Radius } from '../theme';
import type { GeoPoint } from '../location/geo';

interface Props {
  current: GeoPoint | null;
  center: GeoPoint | null;
  radius: number;
  onSelectCenter?: (point: GeoPoint) => void;
}

function formatCoordinate(value: number): string {
  return value.toFixed(5);
}

export function LocationMap({ current, center, radius }: Props) {
  const point = center ?? current;
  const openMap = () => {
    if (!point) return;
    const url = `https://www.openstreetmap.org/?mlat=${point.latitude}&mlon=${point.longitude}#map=16/${point.latitude}/${point.longitude}`;
    void Linking.openURL(url);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.icon}>
        <MaterialIcons name="map" size={32} color={Colors.accent} />
      </View>
      <Text style={styles.title}>Peta interaktif tersedia di Android & iOS</Text>
      {point ? (
        <Text style={styles.text}>
          {formatCoordinate(point.latitude)}, {formatCoordinate(point.longitude)}
          {center ? ` • radius ${radius} m` : ''}
        </Text>
      ) : (
        <Text style={styles.text}>Lokasi belum tersedia.</Text>
      )}
      <Text style={styles.hint}>
        Di web, lokasi bisa diambil lewat browser dan dicek terhadap area geofence. Pilih pusat area
        dari lokasi saat ini.
      </Text>
      {point ? (
        <Pressable accessibilityRole="link" accessibilityLabel="Buka lokasi di OpenStreetMap" onPress={openMap} style={styles.link}>
          <MaterialIcons name="open-in-new" size={16} color={Colors.accent} />
          <Text style={styles.linkText}>Buka di OpenStreetMap</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 220,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 20,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: Colors.ink,
    fontFamily: FontFamily.bodySemi,
    fontSize: 15,
    textAlign: 'center',
  },
  text: {
    color: Colors.muted,
    fontFamily: FontFamily.body,
    fontSize: 13,
    textAlign: 'center',
  },
  hint: {
    color: Colors.muted,
    fontFamily: FontFamily.body,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  linkText: { color: Colors.accent, fontFamily: FontFamily.bodySemi, fontSize: 13 },
});
