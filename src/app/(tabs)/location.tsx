import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../../components/AppButton';
import { AppHeader } from '../../components/AppHeader';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { LocationMap } from '../../components/LocationMap';
import { StatusBanner } from '../../components/StatusBanner';
import { useCurrentLocation } from '../../hooks/useCurrentLocation';
import { useGeofence } from '../../hooks/useGeofence';
import { useReverseGeocode } from '../../hooks/useReverseGeocode';
import {
  GEOFENCE_RADIUS_PRESETS,
  clampRadius,
  formatDistance,
  type GeoPoint,
} from '../../location/geo';
import type { GeofenceMonitoringResult } from '../../location/geofenceTask';
import type { GeofenceEvent, GeofenceZone } from '../../types';
import {
  Colors,
  Common,
  FontFamily,
  MIN_TOUCH,
  Radius,
  Soft,
} from '../../theme';

type ConfirmAction = 'delete' | 'clear' | null;

function formatCoordinate(value: number): string {
  return value.toFixed(5);
}

function formatClock(timestamp: number | null | undefined): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function formatEventTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

function radiusLabel(value: number): string {
  return value >= 1000 ? `${value / 1000} km` : `${value} m`;
}

function monitoringLabel(result: GeofenceMonitoringResult): string {
  if (result.mode === 'background') return 'Latar belakang aktif';
  if (result.mode === 'off') return 'Nonaktif';
  if (result.reason === 'expo-go') return 'Hanya saat aplikasi terbuka (Expo Go)';
  if (result.reason === 'permission') {
    return 'Hanya saat aplikasi terbuka (izin latar belakang belum ada)';
  }
  if (result.reason === 'unsupported') {
    return 'Hanya saat aplikasi terbuka (perangkat tidak mendukung latar belakang)';
  }
  return 'Hanya saat aplikasi terbuka';
}

function eventLabel(type: GeofenceEvent['type']): string {
  return type === 'enter' ? 'Masuk area' : 'Keluar area';
}

export default function LocationScreen() {
  const insets = useSafeAreaInsets();
  const [focused, setFocused] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [backgroundBusy, setBackgroundBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmAction>(null);
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [centerOverride, setCenterOverride] = useState<GeoPoint | null>(null);
  const [radiusOverride, setRadiusOverride] = useState<number | null>(null);
  const [radiusInputOverride, setRadiusInputOverride] = useState<string | null>(null);
  const [enabledOverride, setEnabledOverride] = useState<boolean | null>(null);

  const currentLocation = useCurrentLocation(focused);
  const currentLatitude = currentLocation.location?.coords.latitude;
  const currentLongitude = currentLocation.location?.coords.longitude;
  const currentAccuracy = currentLocation.location?.coords.accuracy;
  const currentTimestamp = currentLocation.location?.timestamp;
  const currentPoint = useMemo<GeoPoint | null>(
    () =>
      typeof currentLatitude === 'number' && typeof currentLongitude === 'number'
        ? { latitude: currentLatitude, longitude: currentLongitude }
        : null,
    [currentLatitude, currentLongitude],
  );
  const reverse = useReverseGeocode(currentPoint);
  const geofence = useGeofence(currentPoint);
  const reloadGeofence = geofence.reload;
  const checkPermission = currentLocation.checkPermission;

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      void reloadGeofence();
      return () => setFocused(false);
    }, [reloadGeofence]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void checkPermission();
      void reloadGeofence();
    });
    return () => subscription.remove();
  }, [checkPermission, reloadGeofence]);

  const saved = geofence.zone;
  const savedCenter = saved
    ? { latitude: saved.latitude, longitude: saved.longitude }
    : null;
  const draftName = nameOverride ?? saved?.name ?? 'Area bermain';
  const draftCenter = centerOverride ?? savedCenter ?? currentPoint;
  const draftRadius = radiusOverride ?? saved?.radius ?? 250;
  const draftEnabled = enabledOverride ?? saved?.enabled ?? true;
  const radiusInput = radiusInputOverride ?? String(draftRadius);
  const trimName = draftName.trim();
  const canSave = !!draftCenter && trimName.length >= 2 && !geofence.saving;
  const draftDirty = useMemo(() => {
    const saved = geofence.zone;
    if (!saved || !draftCenter) return true;
    return (
      saved.name !== trimName ||
      saved.latitude !== draftCenter.latitude ||
      saved.longitude !== draftCenter.longitude ||
      saved.radius !== draftRadius ||
      saved.enabled !== draftEnabled
    );
  }, [draftCenter, draftEnabled, draftRadius, geofence.zone, trimName]);

  const handlePermission = async () => {
    setRequesting(true);
    if (currentLocation.permission === 'denied' && !currentLocation.canAskAgain && Platform.OS !== 'web') {
      await Linking.openSettings().catch(() => undefined);
    } else {
      await currentLocation.requestPermission();
    }
    setRequesting(false);
  };

  const saveArea = async () => {
    if (!draftCenter || trimName.length < 2) return;
    const radius = clampRadius(Number(radiusInput) || draftRadius);
    setRadiusOverride(radius);
    setRadiusInputOverride(String(radius));
    const next: GeofenceZone = {
      name: trimName,
      latitude: draftCenter.latitude,
      longitude: draftCenter.longitude,
      radius,
      enabled: draftEnabled,
      updatedAt: new Date().toISOString(),
    };
    await geofence.save(next);
  };

  const resetDraft = () => {
    setNameOverride(null);
    setCenterOverride(null);
    setRadiusOverride(null);
    setRadiusInputOverride(null);
    setEnabledOverride(null);
  };

  const askBackground = async () => {
    if (currentLocation.permission !== 'granted') {
      setBackgroundBusy(true);
      const granted = await currentLocation.requestPermission();
      setBackgroundBusy(false);
      if (!granted) return;
    }
    setBackgroundBusy(true);
    await geofence.requestBackground();
    setBackgroundBusy(false);
  };

  const permissionNeedsSettings =
    currentLocation.permission === 'denied' &&
    !currentLocation.canAskAgain &&
    Platform.OS !== 'web';
  const permissionActionLabel =
    currentLocation.permission === 'unavailable'
      ? 'Coba Lagi'
      : permissionNeedsSettings
        ? 'Buka Pengaturan'
        : 'Izinkan Lokasi';
  const accuracyText =
    typeof currentAccuracy === 'number' ? `akurasi ±${Math.round(currentAccuracy)} m` : '';
  const updatedText = formatClock(currentTimestamp);
  const status = geofence.status;
  const monitoringColor =
    geofence.monitoring.mode === 'background'
      ? Colors.accent
      : geofence.monitoring.mode === 'foreground'
        ? Colors.gold
        : Colors.muted;
  const showBackgroundAction =
    !!saved?.enabled &&
    geofence.monitoring.mode !== 'background' &&
    Platform.OS !== 'web' &&
    currentLocation.permission === 'granted';

  return (
    <View style={Common.screen}>
      <AppHeader title="Lokasi" subtitle="Peta, alamat, dan area bermain" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled">
        <View style={Common.content}>
          {currentLocation.error && currentLocation.permission === 'granted' ? (
            <StatusBanner
              tone="error"
              text={currentLocation.error}
              actionLabel="Coba Lagi"
              onAction={() => void currentLocation.refresh()}
              style={styles.banner}
            />
          ) : null}
          {geofence.error ? (
            <StatusBanner
              tone="error"
              text={geofence.error}
              actionLabel="Tutup"
              onAction={() => geofence.setError(null)}
              style={styles.banner}
            />
          ) : null}
          {geofence.notice ? (
            <StatusBanner
              tone="info"
              text={geofence.notice}
              actionLabel="Tutup"
              onAction={() => geofence.setNotice(null)}
              style={styles.banner}
            />
          ) : null}

          {currentLocation.permission !== 'granted' ? (
            <View style={styles.card}>
              <View style={styles.iconBox}>
                <MaterialIcons name="location-off" size={26} color={Colors.gold} />
              </View>
              {currentLocation.permission === 'checking' ? (
                <>
                  <Text style={styles.cardTitle}>Memeriksa izin lokasi…</Text>
                  <ActivityIndicator color={Colors.accent} />
                </>
              ) : (
                <>
                  <Text accessibilityRole="header" style={styles.cardTitle}>
                    Izin lokasi diperlukan
                  </Text>
                  <Text style={styles.mutedText}>
                    {permissionNeedsSettings
                      ? 'Izin lokasi ditolak permanen. Buka pengaturan aplikasi atau situs untuk mengizinkan lokasi.'
                      : 'PentungScore memakai lokasi untuk menampilkan posisi, memberi alamat, dan mengecek area bermain.'}
                  </Text>
                  <AppButton
                    label={permissionActionLabel}
                    loading={requesting}
                    loadingLabel="Meminta izin…"
                    onPress={() => void handlePermission()}
                  />
                </>
              )}
            </View>
          ) : null}

          {currentPoint || draftCenter ? (
            <>
              <LocationMap
                current={currentPoint}
                center={draftCenter}
                radius={draftRadius}
                onSelectCenter={(point) => setCenterOverride(point)}
              />
              {Platform.OS !== 'web' ? (
                <Text style={styles.mapHint}>Ketuk peta untuk memilih pusat area bermain.</Text>
              ) : null}
            </>
          ) : null}

          {currentLocation.permission === 'granted' ? (
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text accessibilityRole="header" style={styles.cardTitle}>
                  Lokasi Saat Ini
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Perbarui lokasi saat ini"
                  disabled={currentLocation.refreshing || currentLocation.loading}
                  onPress={() => void currentLocation.refresh()}
                  style={styles.refreshButton}>
                  {currentLocation.refreshing ? (
                    <ActivityIndicator size="small" color={Colors.accent} />
                  ) : (
                    <MaterialIcons name="refresh" size={18} color={Colors.accent} />
                  )}
                  <Text style={styles.refreshText}>Perbarui</Text>
                </Pressable>
              </View>

              {currentPoint ? (
                <>
                  <View style={styles.addressRow}>
                    <MaterialIcons name="place" size={20} color={Colors.accent} />
                    <Text style={styles.address}>
                      {reverse.address ||
                        (reverse.loading ? 'Mencari alamat…' : 'Alamat belum tersedia.')}
                    </Text>
                  </View>
                  {reverse.error ? <Text style={styles.hint}>{reverse.error}</Text> : null}
                  <Text style={styles.coords}>
                    {formatCoordinate(currentPoint.latitude)}, {formatCoordinate(currentPoint.longitude)}
                    {accuracyText ? ` • ${accuracyText}` : ''}
                    {updatedText ? ` • ${updatedText}` : ''}
                  </Text>
                  {reverse.address ? (
                    <AppButton
                      label="Perbarui Alamat"
                      variant="ghost"
                      loading={reverse.loading}
                      loadingLabel="Memuat alamat…"
                      disabled={reverse.loading}
                      onPress={() => void reverse.refresh()}
                    />
                  ) : reverse.error ? (
                    <AppButton
                      label="Coba Lagi Alamat"
                      variant="ghost"
                      loading={reverse.loading}
                      loadingLabel="Memuat alamat…"
                      disabled={reverse.loading}
                      onPress={() => void reverse.refresh()}
                    />
                  ) : null}
                </>
              ) : currentLocation.loading ? (
                <View style={styles.centered}>
                  <ActivityIndicator color={Colors.accent} />
                  <Text style={styles.mutedText}>Mengambil lokasi…</Text>
                </View>
              ) : (
                <Text style={styles.mutedText}>
                  Lokasi belum tersedia. Aktifkan GPS lalu tekan Perbarui.
                </Text>
              )}
            </View>
          ) : null}

          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.cardTitle}>
              Area Bermain
            </Text>
            <Text style={styles.mutedText}>
              Tentukan area bermain. Geofence mencatat saat kamu masuk atau keluar dari area ini.
            </Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Nama area</Text>
              <TextInput
                accessibilityLabel="Nama area bermain"
                value={draftName}
                onChangeText={setNameOverride}
                placeholder="Contoh: Lapangan dekat rumah"
                placeholderTextColor={Colors.muted}
                maxLength={60}
                returnKeyType="done"
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Pusat area</Text>
              <Text style={styles.coords}>
                {draftCenter
                  ? `${formatCoordinate(draftCenter.latitude)}, ${formatCoordinate(draftCenter.longitude)}`
                  : 'Belum dipilih'}
              </Text>
              <AppButton
                label="Pakai Lokasi Saat Ini"
                variant="ghost"
                icon={<MaterialIcons name="my-location" size={18} color={Colors.ink} />}
                disabled={!currentPoint}
                disabledReason="Lokasi saat ini belum tersedia."
                onPress={() => {
                  if (currentPoint) setCenterOverride(currentPoint);
                }}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Radius area</Text>
              <View style={styles.presetRow}>
                {GEOFENCE_RADIUS_PRESETS.map((preset) => {
                  const selected = draftRadius === preset;
                  return (
                    <Pressable
                      key={preset}
                      accessibilityRole="button"
                      accessibilityLabel={`Radius ${radiusLabel(preset)}`}
                      accessibilityState={{ selected }}
                      onPress={() => {
                        setRadiusOverride(preset);
                        setRadiusInputOverride(String(preset));
                      }}
                      style={[styles.preset, selected && styles.presetActive]}>
                      <Text style={[styles.presetText, selected && styles.presetTextActive]}>
                        {radiusLabel(preset)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                accessibilityLabel="Radius area dalam meter"
                accessibilityHint="Isi antara 100 sampai 5000 meter"
                value={radiusInput}
                onChangeText={(value) => {
                  const digits = value.replace(/[^0-9]/g, '').slice(0, 4);
                  setRadiusInputOverride(digits);
                  const parsed = Number(digits);
                  if (digits && Number.isFinite(parsed)) setRadiusOverride(clampRadius(parsed));
                }}
                onBlur={() => {
                  const next = clampRadius(Number(radiusInput) || draftRadius);
                  setRadiusOverride(next);
                  setRadiusInputOverride(String(next));
                }}
                keyboardType="number-pad"
                maxLength={4}
                placeholder="250"
                placeholderTextColor={Colors.muted}
                style={styles.input}
              />
              <Text style={styles.hint}>100–5000 meter. Area saat ini {formatDistance(draftRadius)}.</Text>
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.flex}>
                <Text style={styles.toggleLabel}>Aktifkan geofence</Text>
                <Text style={styles.hint}>
                  Dicek saat aplikasi terbuka. Latar belakang aktif bila izinnya diberikan.
                </Text>
              </View>
              <Switch
                accessibilityLabel="Aktifkan geofence area bermain"
                value={draftEnabled}
                onValueChange={setEnabledOverride}
                trackColor={{ false: Colors.border, true: Soft.accentSoft }}
                thumbColor={draftEnabled ? Colors.accent : Colors.muted}
              />
            </View>

            {saved && draftDirty ? (
              <Text style={styles.dirtyHint}>Ada perubahan yang belum disimpan.</Text>
            ) : null}

            <AppButton
              label="Simpan Area"
              loading={geofence.saving}
              loadingLabel="Menyimpan…"
              disabled={!canSave}
              disabledReason={
                !draftCenter
                  ? 'Pilih pusat area terlebih dahulu.'
                  : trimName.length < 2
                    ? 'Nama area minimal 2 karakter.'
                    : 'Tunggu proses sebelumnya selesai.'
              }
              onPress={() => void saveArea()}
            />
            {saved ? (
              <AppButton
                label="Hapus Area"
                variant="danger"
                disabled={geofence.saving}
                disabledReason="Tunggu proses sebelumnya selesai."
                onPress={() => setConfirm('delete')}
              />
            ) : null}
          </View>

          {saved ? (
            <View style={styles.card}>
              <Text accessibilityRole="header" style={styles.cardTitle}>
                Status Geofence
              </Text>
              {!saved.enabled ? (
                <Text style={styles.mutedText}>
                  Geofence nonaktif. Aktifkan lalu simpan untuk mulai memantau area ini.
                </Text>
              ) : status ? (
                <View
                  style={[
                    styles.statusBox,
                    status.inside ? styles.statusInside : styles.statusOutside,
                  ]}>
                  <View style={styles.statusHeader}>
                    <MaterialIcons
                      name={status.inside ? 'check-circle' : 'radio-button-unchecked'}
                      size={20}
                      color={status.inside ? Colors.accent : Colors.gold}
                    />
                    <Text
                      style={[
                        styles.statusTitle,
                        { color: status.inside ? Colors.accent : Colors.gold },
                      ]}>
                      {status.inside ? 'Di dalam area' : 'Di luar area'}
                    </Text>
                  </View>
                  <Text style={styles.statusText}>
                    {formatDistance(status.distance)} dari pusat, {formatDistance(status.edgeDistance)}{' '}
                    dari batas radius.
                  </Text>
                </View>
              ) : (
                <Text style={styles.mutedText}>Menunggu lokasi saat ini untuk mengecek area…</Text>
              )}

              <View style={styles.monitoringRow}>
                <View style={[styles.monitoringDot, { backgroundColor: monitoringColor }]} />
                <Text style={[styles.monitoringText, { color: monitoringColor }]}>
                  {monitoringLabel(geofence.monitoring)}
                </Text>
              </View>

              {saved.enabled && Platform.OS !== 'web' ? (
                <View style={styles.notificationRow}>
                  <MaterialIcons
                    name={
                      geofence.notificationPermission === 'granted'
                        ? 'notifications-active'
                        : 'notifications-off'
                    }
                    size={18}
                    color={
                      geofence.notificationPermission === 'granted'
                        ? Colors.accent
                        : Colors.gold
                    }
                  />
                  <View style={styles.flex}>
                    <Text style={styles.monitoringText}>
                      {geofence.notificationPermission === 'granted'
                        ? 'Notifikasi aktif'
                        : geofence.notificationPermission === 'unavailable'
                          ? 'Notifikasi tidak tersedia'
                          : 'Notifikasi belum aktif'}
                    </Text>
                    {geofence.notificationPermission !== 'granted' &&
                    geofence.notificationPermission !== 'unavailable' ? (
                      <Text style={styles.hint}>
                        Dapatkan pemberitahuan saat masuk atau keluar area.
                      </Text>
                    ) : null}
                  </View>
                  {geofence.notificationPermission !== 'granted' &&
                  geofence.notificationPermission !== 'unavailable' ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        geofence.notificationPermission === 'denied'
                          ? 'Buka pengaturan notifikasi'
                          : 'Aktifkan notifikasi area bermain'
                      }
                      onPress={() => {
                        if (geofence.notificationPermission === 'denied') {
                          void Linking.openSettings().catch(() => undefined);
                        } else {
                          void geofence.requestNotifications();
                        }
                      }}
                      style={styles.notificationAction}>
                      <Text style={styles.notificationActionText}>
                        {geofence.notificationPermission === 'denied'
                          ? 'Pengaturan'
                          : 'Aktifkan'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {showBackgroundAction ? (
                <AppButton
                  label="Aktifkan Latar Belakang"
                  variant="ghost"
                  loading={backgroundBusy}
                  loadingLabel="Meminta izin…"
                  onPress={() => void askBackground()}
                />
              ) : null}

              {Platform.OS !== 'web' ? (
                <Text style={styles.hint}>
                  Pantauan latar belakang membutuhkan development build dan izin lokasi “Selalu”.
                  Tanpa itu, area hanya dicek saat aplikasi terbuka.
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text accessibilityRole="header" style={styles.cardTitle}>
                Riwayat Geofence
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Bersihkan riwayat geofence"
                disabled={geofence.events.length === 0 || geofence.saving}
                onPress={() => setConfirm('clear')}
                style={styles.clearButton}>
                <Text
                  style={[
                    styles.clearText,
                    (geofence.events.length === 0 || geofence.saving) && styles.clearTextDisabled,
                  ]}>
                  Bersihkan
                </Text>
              </Pressable>
            </View>

            {geofence.events.length === 0 ? (
              <Text style={styles.mutedText}>
                Belum ada aktivitas masuk atau keluar area yang tercatat.
              </Text>
            ) : (
              <View style={styles.eventList}>
                {geofence.events.map((event) => {
                  const enter = event.type === 'enter';
                  return (
                    <View key={event.id} style={styles.eventRow}>
                      <View
                        style={[
                          styles.eventIcon,
                          { backgroundColor: enter ? Soft.accentSoft : Soft.goldSoft },
                        ]}>
                        <MaterialIcons
                          name={enter ? 'login' : 'logout'}
                          size={18}
                          color={enter ? Colors.accent : Colors.gold}
                        />
                      </View>
                      <View style={styles.flex}>
                        <Text style={styles.eventTitle}>{eventLabel(event.type)}</Text>
                        <Text style={styles.eventMeta}>
                          {formatEventTime(event.occurredAt)} • {formatCoordinate(event.latitude)},{' '}
                          {formatCoordinate(event.longitude)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <ConfirmSheet
        visible={confirm === 'delete'}
        title="Hapus area bermain?"
        message="Area, pengaturan geofence, dan seluruh riwayat aktivitasnya akan dihapus dari perangkat ini."
        confirmLabel="Hapus"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          setConfirm(null);
          const removed = await geofence.remove();
          if (removed) resetDraft();
        }}
      />
      <ConfirmSheet
        visible={confirm === 'clear'}
        title="Bersihkan riwayat?"
        message="Semua catatan masuk dan keluar area akan dihapus. Area geofence tetap tersimpan."
        confirmLabel="Bersihkan"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          setConfirm(null);
          await geofence.clearHistory();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingTop: 12, paddingHorizontal: 16 },
  banner: { marginBottom: 12 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 12,
    marginBottom: 12,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Soft.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { color: Colors.ink, fontFamily: FontFamily.display, fontSize: 16 },
  mutedText: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 13, lineHeight: 19 },
  hint: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 12, lineHeight: 18 },
  dirtyHint: { color: Colors.gold, fontFamily: FontFamily.bodyMedium, fontSize: 12 },
  flex: { flex: 1 },
  centered: { alignItems: 'center', paddingVertical: 16, gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  mapHint: {
    color: Colors.muted,
    fontFamily: FontFamily.body,
    fontSize: 12,
    marginTop: -4,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: MIN_TOUCH,
    paddingHorizontal: 8,
  },
  refreshText: { color: Colors.accent, fontFamily: FontFamily.bodySemi, fontSize: 13 },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  address: {
    flex: 1,
    color: Colors.ink,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  coords: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 12, lineHeight: 18 },
  field: { gap: 6 },
  fieldLabel: { color: Colors.muted, fontFamily: FontFamily.bodyMedium, fontSize: 12 },
  input: {
    minHeight: MIN_TOUCH,
    backgroundColor: Colors.raised,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    color: Colors.ink,
    fontFamily: FontFamily.body,
    fontSize: 15,
    paddingHorizontal: 12,
  },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: {
    minHeight: MIN_TOUCH,
    minWidth: 72,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetActive: { borderColor: Colors.accent, backgroundColor: Soft.accentSoft },
  presetText: { color: Colors.muted, fontFamily: FontFamily.bodyMedium, fontSize: 13 },
  presetTextActive: { color: Colors.accent, fontFamily: FontFamily.bodySemi },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel: { color: Colors.ink, fontFamily: FontFamily.bodyMedium, fontSize: 14, marginBottom: 2 },
  statusBox: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 12,
    gap: 6,
  },
  statusInside: { borderColor: Colors.accent, backgroundColor: Soft.accentSoft },
  statusOutside: { borderColor: Colors.gold, backgroundColor: Soft.goldSoft },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusTitle: { fontFamily: FontFamily.bodySemi, fontSize: 14 },
  statusText: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 12, lineHeight: 18 },
  monitoringRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monitoringDot: { width: 8, height: 8, borderRadius: 4 },
  monitoringText: { flex: 1, fontFamily: FontFamily.bodyMedium, fontSize: 12, lineHeight: 18 },
  notificationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notificationAction: {
    minHeight: MIN_TOUCH,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notificationActionText: { color: Colors.accent, fontFamily: FontFamily.bodySemi, fontSize: 13 },
  clearButton: {
    minHeight: MIN_TOUCH,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  clearText: { color: Colors.danger, fontFamily: FontFamily.bodySemi, fontSize: 13 },
  clearTextDisabled: { color: Colors.muted },
  eventList: { gap: 12 },
  eventRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  eventIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventTitle: { color: Colors.ink, fontFamily: FontFamily.bodyMedium, fontSize: 13 },
  eventMeta: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 11, lineHeight: 16 },
});
