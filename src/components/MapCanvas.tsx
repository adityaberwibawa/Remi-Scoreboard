import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontFamily, Radius } from '../theme';
import type { MapCanvasProps } from './MapCanvas.types';

/**
 * Fallback web. react-native-maps tidak mendukung web, jadi tab Peta tetap
 * menampilkan ringkasan koordinat dan tautan ke OpenStreetMap.
 */
export function MapCanvas({
  userLocation,
  markers,
  draft,
  draftRadiusM,
  onPressLocation,
}: MapCanvasProps) {
  const selected = markers.find((marker) => marker.selected);
  const point = draft ?? userLocation ?? selected ?? null;
  const label = draft
    ? 'Titik arena yang dipilih'
    : userLocation
      ? 'Lokasi Anda saat ini'
      : selected
        ? `Arena ${selected.title}`
        : 'Belum ada titik lokasi';

  const openStreetMap = () => {
    if (!point) return;
    const url = `https://www.openstreetmap.org/?mlat=${point.latitude}&mlon=${point.longitude}#map=16/${point.latitude}/${point.longitude}`;
    void Linking.openURL(url).catch(() => undefined);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.placeholder}>
        <View style={styles.iconBox}>
          <MaterialIcons name="map" size={34} color={Colors.accent} />
        </View>
        <Text style={styles.title}>Peta interaktif tersedia di Android & iOS</Text>
        <Text style={styles.subtitle}>
          Di web, ketuk tombol di bawah untuk membuka titik ini di OpenStreetMap.
        </Text>
        <Text style={styles.label}>{label}</Text>
        {point ? (
          <Text style={styles.coords}>
            {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
          </Text>
        ) : null}
        {draft ? <Text style={styles.radius}>Radius {draftRadiusM} m</Text> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Buka lokasi di OpenStreetMap"
          disabled={!point}
          onPress={openStreetMap}
          style={[styles.button, !point && styles.buttonDisabled]}>
          <MaterialIcons name="open-in-new" size={18} color={Colors.onAccent} />
          <Text style={styles.buttonText}>Buka di OpenStreetMap</Text>
        </Pressable>
        {!draft && point ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Gunakan titik ini sebagai arena"
            onPress={() => onPressLocation(point)}
            style={styles.ghostButton}>
            <Text style={styles.ghostButtonText}>Gunakan titik ini</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    overflow: 'hidden',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 20,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.raised,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 4,
  },
  title: {
    color: Colors.ink,
    fontFamily: FontFamily.bodySemi,
    fontSize: 15,
    textAlign: 'center',
  },
  subtitle: {
    color: Colors.muted,
    fontFamily: FontFamily.body,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 340,
  },
  label: {
    color: Colors.accent,
    fontFamily: FontFamily.bodySemi,
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  coords: {
    color: Colors.ink,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    textAlign: 'center',
  },
  radius: {
    color: Colors.gold,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
  },
  button: {
    marginTop: 6,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: Colors.onAccent, fontFamily: FontFamily.bodySemi, fontSize: 13 },
  ghostButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  ghostButtonText: { color: Colors.accent, fontFamily: FontFamily.bodySemi, fontSize: 13 },
});
