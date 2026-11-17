import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AppButton } from './AppButton';
import { StatusBanner } from './StatusBanner';
import { Colors, Common, FontFamily, Radius } from '../theme';
import type { Coordinates, GeocodedPlace } from '../location/types';

interface Props {
  coords: Coordinates | null;
  accuracy: number | null;
  place: GeocodedPlace | null;
  geocoding: boolean;
  loading: boolean;
  error: string | null;
  canUseAsArena: boolean;
  onRefresh: () => void;
  onUseAsArena: () => void;
}

/** Ringkasan posisi perangkat + aksi menjadikannya titik arena. */
export function CurrentLocationCard({
  coords,
  accuracy,
  place,
  geocoding,
  loading,
  error,
  canUseAsArena,
  onRefresh,
  onUseAsArena,
}: Props) {
  return (
    <View style={[Common.card, styles.card]}>
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <MaterialIcons name="my-location" size={20} color={Colors.accent} />
        </View>
        <View style={styles.headerText}>
          <Text accessibilityRole="header" style={styles.title}>
            Lokasi Anda
          </Text>
          <Text style={styles.subtitle}>
            {loading
              ? 'Memperbarui posisi…'
              : coords
                ? 'Posisi perangkat saat ini'
                : 'Menunggu posisi perangkat'}
          </Text>
        </View>
        {loading ? <ActivityIndicator size="small" color={Colors.accent} /> : null}
      </View>

      {error ? (
        <StatusBanner tone="error" text={error} actionLabel="Coba Lagi" onAction={onRefresh} />
      ) : null}

      {coords ? (
        <View style={styles.positionBox}>
          <Text style={styles.address} numberOfLines={2}>
            {place?.address ??
              (geocoding
                ? 'Mencari alamat…'
                : 'Alamat belum tersedia — gunakan koordinat di bawah.')}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.coords}>
              {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
            </Text>
            {accuracy != null ? (
              <View style={styles.accuracyPill}>
                <MaterialIcons name="gps-fixed" size={12} color={Colors.accent} />
                <Text style={styles.accuracyText}>±{Math.round(accuracy)} m</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : !loading && !error ? (
        <Text style={styles.emptyText}>Posisi belum tersedia. Pastikan GPS aktif.</Text>
      ) : null}

      <View style={styles.actions}>
        <View style={styles.flex}>
          <AppButton
            label="Perbarui"
            variant="ghost"
            loading={loading}
            loadingLabel="Mencari…"
            onPress={onRefresh}
          />
        </View>
        <View style={styles.flex}>
          <AppButton
            label="Jadikan Arena"
            disabled={!coords || !canUseAsArena}
            disabledReason={
              !coords ? 'Posisi belum tersedia.' : 'Pilih sesi yang sedang berjalan terlebih dahulu.'
            }
            onPress={onUseAsArena}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 1 },
  title: { color: Colors.ink, fontFamily: FontFamily.bodySemi, fontSize: 15 },
  subtitle: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 12 },
  positionBox: {
    backgroundColor: Colors.raised,
    borderRadius: Radius.md,
    padding: 12,
    gap: 6,
  },
  address: { color: Colors.ink, fontFamily: FontFamily.bodyMedium, fontSize: 13, lineHeight: 19 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  coords: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 11, flex: 1 },
  accuracyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.card,
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  accuracyText: { color: Colors.accent, fontFamily: FontFamily.bodyMedium, fontSize: 10 },
  emptyText: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
