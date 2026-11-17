import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AppButton } from './AppButton';
import { StatusBanner } from './StatusBanner';
import { Colors, Common, FontFamily, Radius } from '../theme';
import type { LocationPermissionState } from '../location/types';

interface Props {
  foreground: LocationPermissionState;
  servicesEnabled: boolean | null;
  canAskForeground: boolean;
  error: string | null;
  requesting: boolean;
  onRequest: () => void;
  onOpenSettings: () => void;
}

/** Kartu izin lokasi yang hanya tampil saat akses belum siap. */
export function LocationPermissionCard({
  foreground,
  servicesEnabled,
  canAskForeground,
  error,
  requesting,
  onRequest,
  onOpenSettings,
}: Props) {
  if (foreground === 'checking') return null;
  if (foreground === 'granted' && servicesEnabled !== false) return null;

  const servicesOff = servicesEnabled === false;
  const permanentlyDenied = foreground === 'denied' && !canAskForeground;
  const title = servicesOff
    ? 'Lokasi perangkat nonaktif'
    : permanentlyDenied
      ? 'Izin lokasi ditolak'
      : foreground === 'denied'
        ? 'Izin lokasi diperlukan'
        : 'Aktifkan lokasi';
  const description = servicesOff
    ? 'Nyalakan GPS/lokasi perangkat agar PentungScore bisa menampilkan posisi dan arena sesi.'
    : permanentlyDenied
      ? 'Izinkan lokasi lewat pengaturan perangkat untuk menampilkan posisi dan mengaktifkan pengingat area.'
      : 'PentungScore memakai lokasi hanya di perangkat ini untuk menandai arena sesi dan menghitung jarak.';

  return (
    <View style={[Common.card, styles.card]}>
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <MaterialIcons name="my-location" size={22} color={Colors.accent} />
        </View>
        <View style={styles.headerText}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      </View>

      {error ? <StatusBanner tone="error" text={error} /> : null}

      <View style={styles.actions}>
        {servicesOff || permanentlyDenied ? (
          <AppButton label="Buka Pengaturan" onPress={onOpenSettings} />
        ) : (
          <AppButton
            label={foreground === 'denied' ? 'Coba Izin Lagi' : 'Izinkan Lokasi'}
            loading={requesting}
            loadingLabel="Meminta izin…"
            onPress={onRequest}
          />
        )}
      </View>
      <Text style={styles.privacy}>
        Koordinat arena dan riwayat area disimpan lokal di perangkat, tidak diunggah ke server.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 14 },
  header: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 3 },
  title: { color: Colors.ink, fontFamily: FontFamily.bodySemi, fontSize: 15 },
  description: {
    color: Colors.muted,
    fontFamily: FontFamily.body,
    fontSize: 13,
    lineHeight: 19,
  },
  actions: { gap: 8 },
  privacy: {
    color: Colors.muted,
    fontFamily: FontFamily.body,
    fontSize: 11,
    lineHeight: 16,
    borderRadius: Radius.sm,
  },
});
