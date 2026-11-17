import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AppButton } from './AppButton';
import { StatusBanner } from './StatusBanner';
import { Colors, Common, FontFamily, Radius, Soft } from '../theme';
import { formatCoordinate, formatDistance, RADIUS_PRESETS } from '../location/geo';
import type {
  ArenaStatus,
  Coordinates,
  GeocodedPlace,
  SessionLocation,
} from '../location/types';
import type { GameSession } from '../types';

interface Props {
  session: GameSession;
  saved: SessionLocation | undefined;
  draft: Coordinates | null;
  radiusM: number;
  address: GeocodedPlace | null;
  geocoding: boolean;
  status: ArenaStatus;
  distanceM: number | null;
  editable: boolean;
  saving: boolean;
  geofenceBusy: boolean;
  geofenceBackgroundReady: boolean;
  dirty: boolean;
  canUseCurrent: boolean;
  onUseCurrent: () => void;
  onRadiusChange: (radius: number) => void;
  onSave: () => void;
  onToggleGeofence: (value: boolean) => void;
  onOpenSession: () => void;
  onClear: () => void;
}

const STATUS_META = {
  unknown: {
    label: 'Belum ada titik',
    icon: 'location-searching' as const,
    color: Colors.muted,
    background: Colors.raised,
    border: Colors.border,
  },
  inside: {
    label: 'Di dalam arena',
    icon: 'check-circle' as const,
    color: Colors.accent,
    background: Soft.accentSoft,
    border: Colors.accent,
  },
  outside: {
    label: 'Di luar arena',
    icon: 'location-off' as const,
    color: Colors.danger,
    background: Soft.dangerSoft,
    border: Colors.danger,
  },
} as const;

/** Kartu pengaturan arena: titik, radius, status jarak, dan geofence. */
export function ArenaCard({
  session,
  saved,
  draft,
  radiusM,
  address,
  geocoding,
  status,
  distanceM,
  editable,
  saving,
  geofenceBusy,
  geofenceBackgroundReady,
  dirty,
  canUseCurrent,
  onUseCurrent,
  onRadiusChange,
  onSave,
  onToggleGeofence,
  onOpenSession,
  onClear,
}: Props) {
  const meta = STATUS_META[status];
  // Alamat dari titik draft. Jangan fallback ke alamat arena lama saat pin
  // sudah digeser; layar Peta sudah mengirim alamat tersimpan bila titik sama.
  const displayAddress = address?.address ?? null;
  const emptyAddressText = draft
    ? geocoding
      ? 'Mencari alamat titik ini…'
      : 'Alamat tidak tersedia. Titik tetap disimpan dengan koordinat.'
    : 'Ketuk peta untuk memilih titik arena.';
  const geofenceEnabled = saved?.geofenceEnabled ?? false;
  const controlsDisabled = !editable || geofenceBusy;

  return (
    <View style={[Common.card, styles.card]}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <View style={styles.iconBox}>
            <MaterialIcons name="place" size={20} color={Colors.accent} />
          </View>
          <View style={styles.titleText}>
            <Text accessibilityRole="header" style={styles.title}>
              Arena Sesi
            </Text>
            <Text style={styles.sessionTitle} numberOfLines={1}>
              {session.title}
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Buka sesi ini"
          onPress={onOpenSession}
          hitSlop={8}
          style={styles.openLink}>
          <Text style={styles.openLinkText}>Buka Sesi</Text>
          <MaterialIcons name="chevron-right" size={18} color={Colors.accent} />
        </Pressable>
      </View>

      {!editable ? (
        <StatusBanner
          tone="info"
          text="Sesi ini sudah selesai. Arena hanya bisa dilihat, bukan diubah."
        />
      ) : null}

      <View style={styles.pointBox}>
        <View style={styles.pointRow}>
          <MaterialIcons name="pin-drop" size={17} color={Colors.accent} />
          <Text style={styles.pointLabel}>Titik arena</Text>
          {geocoding ? <ActivityIndicator size="small" color={Colors.accent} /> : null}
        </View>
        <Text style={styles.address} numberOfLines={3}>
          {displayAddress ?? emptyAddressText}
        </Text>
        {draft ? (
          <Text style={styles.coords}>{formatCoordinate(draft)}</Text>
        ) : saved ? (
          <Text style={styles.coords}>
            {saved.latitude.toFixed(5)}, {saved.longitude.toFixed(5)}
          </Text>
        ) : null}
      </View>

      <View style={styles.radiusSection}>
        <View style={styles.radiusHeader}>
          <Text style={styles.label}>Radius area</Text>
          <Text style={styles.radiusValue}>{radiusM} m</Text>
        </View>
        <View style={styles.radiusRow}>
          {RADIUS_PRESETS.map((preset) => {
            const active = radiusM === preset;
            const disabled = !editable || !draft;
            return (
              <Pressable
                key={preset}
                accessibilityRole="button"
                accessibilityLabel={`Radius ${preset} meter`}
                accessibilityState={{ selected: active, disabled }}
                disabled={disabled}
                onPress={() => onRadiusChange(preset)}
                style={[
                  styles.radiusChip,
                  active && styles.radiusChipActive,
                  disabled && styles.radiusChipDisabled,
                ]}>
                <Text style={[styles.radiusChipText, active && styles.radiusChipTextActive]}>
                  {preset} m
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.hint}>
          Area di sekitar titik arena. Radius 100–500 m disarankan agar geofence stabil.
        </Text>
      </View>

      <View style={[styles.statusChip, { backgroundColor: meta.background, borderColor: meta.border }]}>
        <MaterialIcons name={meta.icon} size={16} color={meta.color} />
        <Text style={[styles.statusText, { color: meta.color }]}>
          {meta.label}
          {status !== 'unknown' && distanceM != null
            ? ` • ${formatDistance(distanceM)} dari titik`
            : ''}
        </Text>
      </View>

      <View style={styles.geofenceRow}>
        <View style={styles.geofenceText}>
          <View style={styles.geofenceTitleRow}>
            <MaterialIcons name="notifications-active" size={17} color={Colors.gold} />
            <Text style={styles.label}>Pengingat area</Text>
            {geofenceBusy ? <ActivityIndicator size="small" color={Colors.gold} /> : null}
          </View>
          <Text style={styles.hint}>
            Catat saat Anda masuk atau keluar radius arena. Saat aplikasi terbuka selalu
            berjalan; latar belakang membutuhkan izin lokasi “Selalu”.
          </Text>
        </View>
        <Switch
          accessibilityLabel="Pengingat area"
          accessibilityHint="Mencatat event saat masuk atau keluar radius arena"
          value={geofenceEnabled}
          disabled={!saved || controlsDisabled}
          onValueChange={onToggleGeofence}
          trackColor={{ false: Colors.raised, true: Colors.accent }}
          thumbColor={Colors.ink}
          ios_backgroundColor={Colors.raised}
        />
      </View>

      {geofenceEnabled && !geofenceBackgroundReady ? (
        <View style={styles.fallbackNote}>
          <MaterialIcons name="info-outline" size={14} color={Colors.gold} />
          <Text style={styles.fallbackText}>
            Pengingat berjalan saat aplikasi terbuka. Izinkan lokasi “Selalu” agar event
            tetap tercatat di latar belakang.
          </Text>
        </View>
      ) : null}

      {dirty ? (
        <View style={styles.dirtyRow}>
          <MaterialIcons name="edit" size={14} color={Colors.gold} />
          <Text style={styles.dirtyText}>Perubahan arena belum disimpan.</Text>
        </View>
      ) : null}

      {editable ? (
        <View style={styles.actionStack}>
          <View style={styles.actionRow}>
            <View style={styles.flex}>
              <AppButton
                label="Lokasi Saya"
                variant="ghost"
                disabled={!canUseCurrent}
                disabledReason="Posisi perangkat belum tersedia."
                onPress={onUseCurrent}
              />
            </View>
            <View style={styles.flex}>
              <AppButton
                label={saved ? 'Perbarui Arena' : 'Simpan Arena'}
                loading={saving}
                loadingLabel="Menyimpan…"
                disabled={!draft || geocoding}
                disabledReason="Pilih titik arena di peta terlebih dahulu."
                onPress={onSave}
              />
            </View>
          </View>
          {saved ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Hapus arena sesi"
              onPress={onClear}
              style={styles.clearButton}>
              <MaterialIcons name="delete-outline" size={16} color={Colors.danger} />
              <Text style={styles.clearText}>Hapus Arena</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: { flex: 1, gap: 1 },
  title: { color: Colors.ink, fontFamily: FontFamily.bodySemi, fontSize: 15 },
  sessionTitle: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 12 },
  openLink: { flexDirection: 'row', alignItems: 'center', minHeight: 36 },
  openLinkText: { color: Colors.accent, fontFamily: FontFamily.bodySemi, fontSize: 12 },
  pointBox: {
    backgroundColor: Colors.raised,
    borderRadius: Radius.md,
    padding: 12,
    gap: 4,
  },
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pointLabel: {
    color: Colors.muted,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    flex: 1,
  },
  address: { color: Colors.ink, fontFamily: FontFamily.bodyMedium, fontSize: 13, lineHeight: 19 },
  coords: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 11 },
  radiusSection: { gap: 6 },
  radiusHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: Colors.ink, fontFamily: FontFamily.bodyMedium, fontSize: 13 },
  radiusValue: { color: Colors.accent, fontFamily: FontFamily.bodySemi, fontSize: 13 },
  radiusRow: { flexDirection: 'row', gap: 8 },
  radiusChip: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radiusChipActive: { backgroundColor: Soft.accentSoft, borderColor: Colors.accent },
  radiusChipDisabled: { opacity: 0.55 },
  radiusChipText: { color: Colors.muted, fontFamily: FontFamily.bodyMedium, fontSize: 12 },
  radiusChipTextActive: { color: Colors.accent, fontFamily: FontFamily.bodySemi },
  hint: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 11, lineHeight: 16 },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  statusText: { fontFamily: FontFamily.bodyMedium, fontSize: 12 },
  geofenceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  geofenceText: { flex: 1, gap: 3 },
  geofenceTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fallbackNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: Soft.goldSoft,
    borderRadius: Radius.sm,
    padding: 9,
  },
  fallbackText: {
    flex: 1,
    color: Colors.gold,
    fontFamily: FontFamily.body,
    fontSize: 11,
    lineHeight: 16,
  },
  dirtyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dirtyText: { color: Colors.gold, fontFamily: FontFamily.bodyMedium, fontSize: 12 },
  actionStack: { gap: 8 },
  actionRow: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  clearButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  clearText: { color: Colors.danger, fontFamily: FontFamily.bodyMedium, fontSize: 12 },
});
