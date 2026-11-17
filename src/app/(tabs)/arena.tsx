import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
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
import { DataErrorBanner } from '../../components/DataErrorBanner';
import { StatusBanner } from '../../components/StatusBanner';
import type { StatusTone } from '../../components/StatusBanner';
import { AppMap } from '../../components/location/AppMap';
import { useStore } from '../../store';
import type { Arena } from '../../types';
import { DEFAULT_RADIUS_M, formatCoords, formatDistance } from '../../location/geo';
import {
  isArenaMonitoringActive,
  isBackgroundGeofenceSupported,
  startArenaMonitoring,
  stopArenaMonitoring,
} from '../../location/geofence';
import type { BackgroundGeofenceSupport } from '../../location/geofence';
import { openInMaps } from '../../location/mapsLink';
import { useCurrentPlace } from '../../location/useCurrentPlace';
import { Colors, Common, FontFamily, MIN_TOUCH, Radius, Soft } from '../../theme';

const RADIUS_OPTIONS = [100, 150, 250, 500, 1000];

function formatEventTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function ArenaScreen() {
  const insets = useSafeAreaInsets();
  const arena = useStore((s) => s.arena);
  const geofenceEvents = useStore((s) => s.geofenceEvents);
  const saveArena = useStore((s) => s.saveArena);
  const deleteArena = useStore((s) => s.deleteArena);
  const setArenaMonitoring = useStore((s) => s.setArenaMonitoring);
  const refreshGeofenceEvents = useStore((s) => s.refreshGeofenceEvents);
  const clearGeofenceHistory = useStore((s) => s.clearGeofenceHistory);

  const {
    status,
    place,
    error,
    mocked,
    tracking,
    distanceToArena,
    insideFence,
    refresh,
    startTracking,
    stopTracking,
  } = useCurrentPlace({ auto: true });

  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [radiusDraft, setRadiusDraft] = useState<number | null>(null);
  const name = nameDraft ?? arena?.name ?? '';
  const radius = radiusDraft ?? arena?.radiusM ?? DEFAULT_RADIUS_M;
  const [busy, setBusy] = useState<
    'refresh' | 'save' | 'monitor' | 'delete' | 'history' | null
  >(null);
  const [notice, setNotice] = useState<{ tone: StatusTone; text: string } | null>(null);
  const [support, setSupport] = useState<BackgroundGeofenceSupport | null>(null);
  const [monitoringActive, setMonitoringActive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const statusRef = useRef(status);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void refreshGeofenceEvents();
      isBackgroundGeofenceSupported()
        .then((result) => {
          if (active) setSupport(result);
        })
        .catch(() => undefined);
      isArenaMonitoringActive()
        .then((isActive) => {
          if (active) setMonitoringActive(isActive);
        })
        .catch(() => undefined);
      if (statusRef.current === 'ready') void refresh();
      return () => {
        active = false;
        stopTracking();
      };
    }, [refresh, refreshGeofenceEvents, stopTracking]),
  );

  const mapCenter = place ?? arena;

  const handleRefresh = async () => {
    if (busy) return;
    setBusy('refresh');
    setNotice(null);
    await refresh();
    setBusy(null);
  };

  const buildArena = (from: { latitude: number; longitude: number; address: string | null }): Arena => ({
    name: name.trim() || arena?.name || 'Arena Permainan',
    latitude: from.latitude,
    longitude: from.longitude,
    radiusM: radius,
    address: from.address,
    monitoring: arena?.monitoring ?? false,
    updatedAt: new Date().toISOString(),
  });

  const handleSaveArena = async () => {
    if (busy) return;
    if (!place) {
      setNotice({ tone: 'error', text: 'Ambil lokasi Anda dulu sebelum menyimpan arena.' });
      return;
    }
    setBusy('save');
    setNotice(null);
    const next = buildArena(place);
    const saveError = await saveArena(next);
    if (saveError) {
      setBusy(null);
      setNotice({ tone: 'error', text: saveError });
      return;
    }
    if (next.monitoring) {
      const result = await startArenaMonitoring(next);
      setMonitoringActive(result.ok);
      if (!result.ok) {
        await setArenaMonitoring(false);
        setNotice({ tone: 'error', text: result.error ?? 'Gagal memperbarui geofence.' });
      } else {
        setNotice({
          tone: result.warning ? 'info' : 'success',
          text: result.warning ?? 'Arena dan radius geofence diperbarui.',
        });
      }
    } else {
      setNotice({ tone: 'success', text: 'Arena berhasil disimpan di perangkat.' });
    }
    setBusy(null);
  };

  const handleToggleMonitoring = async (value: boolean) => {
    if (busy) return;
    if (!arena) {
      setNotice({ tone: 'error', text: 'Simpan arena dulu sebelum mengaktifkan geofence.' });
      return;
    }
    setBusy('monitor');
    setNotice(null);
    if (!value) {
      await stopArenaMonitoring();
      const storeError = await setArenaMonitoring(false);
      setMonitoringActive(false);
      setBusy(null);
      setNotice(
        storeError
          ? { tone: 'error', text: storeError }
          : { tone: 'info', text: 'Pemantauan arena di latar belakang dimatikan.' },
      );
      return;
    }
    const result = await startArenaMonitoring(arena);
    if (!result.ok) {
      setBusy(null);
      setMonitoringActive(false);
      setNotice({ tone: 'error', text: result.error ?? 'Gagal mengaktifkan geofence.' });
      return;
    }
    const storeError = await setArenaMonitoring(true);
    setMonitoringActive(true);
    setBusy(null);
    setNotice(
      storeError
        ? { tone: 'error', text: storeError }
        : { tone: result.warning ? 'info' : 'success', text: result.warning ?? 'Geofence arena aktif.' },
    );
  };

  const handleDeleteArena = async () => {
    setConfirmDelete(false);
    setBusy('delete');
    await stopArenaMonitoring();
    await setArenaMonitoring(false);
    const deleteError = await deleteArena();
    setMonitoringActive(false);
    setNameDraft(null);
    setRadiusDraft(null);
    setBusy(null);
    setNotice(
      deleteError
        ? { tone: 'error', text: deleteError }
        : { tone: 'info', text: 'Arena dihapus. Lokasi sesi lama tetap tersimpan.' },
    );
  };

  const handleClearHistory = async () => {
    if (busy) return;
    setBusy('history');
    const clearError = await clearGeofenceHistory();
    setBusy(null);
    setNotice(
      clearError
        ? { tone: 'error', text: clearError }
        : { tone: 'info', text: 'Riwayat geofence dihapus.' },
    );
  };

  const toggleTracking = async () => {
    if (tracking) {
      stopTracking();
      return;
    }
    await startTracking();
  };

  const fenceLabel =
    insideFence == null
      ? 'Arena belum diatur'
      : insideFence
        ? 'Di dalam arena'
        : 'Di luar arena';

  const fenceColor =
    insideFence == null ? Colors.muted : insideFence ? Colors.accent : Colors.danger;

  return (
    <View style={Common.screen}>
      <AppHeader title="Arena & Lokasi" subtitle="Peta, alamat, dan geofence permainan" />
      <DataErrorBanner />
      {notice ? (
        <StatusBanner
          tone={notice.tone}
          text={notice.text}
          actionLabel="Tutup"
          onAction={() => setNotice(null)}
          style={styles.banner}
        />
      ) : null}
      {error && !notice ? (
        <StatusBanner
          tone="error"
          text={error}
          actionLabel="Tutup"
          onAction={() => setNotice(null)}
          style={styles.banner}
        />
      ) : null}
      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled">
        <View style={Common.content}>
          <View style={styles.mapCard}>
            {mapCenter ? (
              <AppMap
                center={mapCenter}
                user={place ?? undefined}
                marker={arena ? { point: arena, label: arena.name, tone: 'arena' } : undefined}
                fence={arena ? { point: arena, radiusM: arena.radiusM } : undefined}
                height={220}
                accessibilityLabel={
                  arena
                    ? `Peta arena ${arena.name} dengan radius ${arena.radiusM} meter`
                    : 'Peta lokasi Anda saat ini'
                }
              />
            ) : (
              <View style={styles.mapPlaceholder}>
                <MaterialIcons name="map" size={32} color={Colors.muted} />
                <Text style={styles.mapPlaceholderTitle}>Peta menunggu lokasi</Text>
                <Text style={styles.mapPlaceholderText}>
                  Aktifkan izin lokasi untuk melihat posisi dan arena pada peta.
                </Text>
              </View>
            )}
            <View style={styles.mapMeta}>
              <View style={[styles.fencePill, { borderColor: fenceColor }]}>
                <MaterialIcons
                  name={insideFence == null ? 'remove' : insideFence ? 'check-circle' : 'wrong-location'}
                  size={14}
                  color={fenceColor}
                />
                <Text style={[styles.fencePillText, { color: fenceColor }]}>{fenceLabel}</Text>
              </View>
              {distanceToArena != null ? (
                <Text style={styles.mapMetaText}>{formatDistance(distanceToArena)} dari pusat</Text>
              ) : null}
            </View>
          </View>

          {status === 'denied' || status === 'unavailable' ? (
            <StatusBanner
              tone="error"
              text={
                error ??
                'Lokasi tidak tersedia. Aktifkan izin lokasi dan GPS perangkat lalu coba lagi.'
              }
            />
          ) : null}

          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.cardTitleRow}>
                <MaterialIcons name="my-location" size={18} color={Colors.accent} />
                <Text style={styles.cardTitle}>Lokasi Saat Ini</Text>
              </View>
              {mocked ? (
                <View style={styles.mockPill}>
                  <Text style={styles.mockPillText}>Lokasi simulasi</Text>
                </View>
              ) : null}
            </View>
            {status === 'locating' ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={Colors.accent} />
                <Text style={styles.hint}>Mengambil lokasi dan alamat…</Text>
              </View>
            ) : place ? (
              <>
                <Text style={styles.address}>{place.address ?? 'Alamat belum tersedia'}</Text>
                <Text style={styles.coords}>{formatCoords(place)}</Text>
                <Text style={styles.hint}>
                  Akurasi {formatDistance(place.accuracy)}
                  {place.address ? '' : ' • Alamat butuh internet/geocoder perangkat'}
                </Text>
              </>
            ) : (
              <Text style={styles.hint}>
                Tekan “Ambil Lokasi” untuk meminta izin dan membaca posisi perangkat.
              </Text>
            )}
            <View style={styles.actions}>
              <View style={styles.actionGrow}>
                <AppButton
                  label={place ? 'Perbarui Lokasi' : 'Ambil Lokasi'}
                  loading={busy === 'refresh'}
                  loadingLabel="Mengambil…"
                  onPress={handleRefresh}
                />
              </View>
              {place ? (
                <View style={styles.actionGrow}>
                  <AppButton
                    label={tracking ? 'Stop Lacak' : 'Lacak Langsung'}
                    variant="ghost"
                    onPress={toggleTracking}
                  />
                </View>
              ) : null}
            </View>
            <View style={styles.actions}>
              {place ? (
                <View style={styles.actionGrow}>
                  <AppButton
                    label="Buka di Peta"
                    variant="ghost"
                    onPress={() => void openInMaps(place, place.address)}
                  />
                </View>
              ) : null}
              <View style={styles.actionGrow}>
                <AppButton
                  label="Pengaturan Izin"
                  variant="ghost"
                  onPress={() => void Linking.openSettings().catch(() => undefined)}
                />
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.cardTitleRow}>
                <MaterialIcons name="place" size={18} color={Colors.accent} />
                <Text style={styles.cardTitle}>Arena Permainan</Text>
              </View>
              {arena ? (
                <View style={styles.radiusPill}>
                  <Text style={styles.radiusPillText}>{arena.radiusM} m</Text>
                </View>
              ) : null}
            </View>
            {arena ? (
              <>
                <TextInput
                  accessibilityLabel="Nama arena"
                  value={name}
                  onChangeText={setNameDraft}
                  maxLength={80}
                  placeholder="Contoh: Rumah Bowo"
                  placeholderTextColor={Colors.muted}
                  style={styles.input}
                />
                <Text style={styles.hint}>Radius geofence</Text>
                <View style={styles.radiusRow}>
                  {RADIUS_OPTIONS.map((option) => {
                    const active = radius === option;
                    return (
                      <Pressable
                        key={option}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`Radius ${option} meter`}
                        onPress={() => setRadiusDraft(option)}
                        style={[styles.radiusOption, active && styles.radiusOptionActive]}>
                        <Text style={[styles.radiusText, active && styles.radiusTextActive]}>
                          {option} m
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.hint}>
                  {arena.address ?? 'Alamat arena belum tersedia.'} • {formatCoords(arena)}
                </Text>
                <View style={styles.actions}>
                  <View style={styles.actionGrow}>
                    <AppButton
                      label="Simpan Arena"
                      loading={busy === 'save'}
                      loadingLabel="Menyimpan…"
                      disabled={!place}
                      disabledReason="Ambil lokasi Anda dulu untuk memindahkan arena ke sini."
                      onPress={handleSaveArena}
                    />
                  </View>
                  <View style={styles.actionGrow}>
                    <AppButton
                      label="Hapus Arena"
                      variant="danger"
                      disabled={busy === 'delete'}
                      onPress={() => setConfirmDelete(true)}
                    />
                  </View>
                </View>
                {!place ? (
                  <Text style={styles.hint}>
                    Tombol simpan memindahkan arena ke lokasi Anda saat ini.
                  </Text>
                ) : null}
              </>
            ) : (
              <>
                <Text style={styles.hint}>
                  Tandai lokasi bermain tetap agar aplikasi bisa memantau apakah Anda masih berada
                  di arena.
                </Text>
                <AppButton
                  label="Jadikan Lokasi Ini Arena"
                  loading={busy === 'save'}
                  loadingLabel="Menyimpan…"
                  disabled={!place}
                  disabledReason="Ambil lokasi Anda dulu sebelum menyimpan arena."
                  onPress={handleSaveArena}
                />
              </>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.cardTitleRow}>
                <MaterialIcons name="notifications-active" size={18} color={Colors.accent} />
                <Text style={styles.cardTitle}>Geofence Latar Belakang</Text>
              </View>
              {busy === 'monitor' ? <ActivityIndicator size="small" color={Colors.accent} /> : null}
            </View>
            {support && !support.supported ? (
              <Text style={styles.hint}>{support.reason}</Text>
            ) : (
              <Text style={styles.hint}>
                Dapatkan notifikasi saat masuk atau keluar radius arena, meski aplikasi tertutup.
              </Text>
            )}
            <View style={styles.switchRow}>
              <View style={styles.switchText}>
                <Text style={styles.switchLabel}>Pantau arena di latar belakang</Text>
                <Text style={styles.hint}>
                  {arena
                    ? `Radius ${arena.radiusM} m • ${arena.name}`
                    : 'Simpan arena terlebih dahulu.'}
                </Text>
              </View>
              <Switch
                accessibilityLabel="Pantau arena di latar belakang"
                value={monitoringActive}
                disabled={!arena || busy === 'monitor' || (support != null && !support.supported)}
                onValueChange={(value) => void handleToggleMonitoring(value)}
                trackColor={{ false: Colors.raised, true: Colors.accent }}
                thumbColor={monitoringActive ? Colors.onAccent : Colors.muted}
              />
            </View>
            <Text style={styles.hint}>
              Butuh izin lokasi “Selalu izinkan”. Android 11+ akan membuka halaman Pengaturan.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.cardTitleRow}>
                <MaterialIcons name="history" size={18} color={Colors.accent} />
                <Text style={styles.cardTitle}>Riwayat Geofence</Text>
              </View>
              {geofenceEvents.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Hapus riwayat geofence"
                  onPress={() => void handleClearHistory()}
                  hitSlop={8}
                  style={styles.clearBtn}>
                  <Text style={styles.clearText}>Hapus</Text>
                </Pressable>
              ) : null}
            </View>
            {geofenceEvents.length === 0 ? (
              <Text style={styles.hint}>
                Belum ada event. Event masuk/keluar arena akan muncul di sini setelah geofence
                aktif.
              </Text>
            ) : (
              geofenceEvents.map((event) => (
                <View
                  key={`${event.at}-${event.type}`}
                  accessible
                  accessibilityLabel={`${event.type === 'enter' ? 'Masuk' : 'Keluar'} ${event.arenaName} pada ${formatEventTime(event.at)}`}
                  style={styles.eventRow}>
                  <MaterialIcons
                    name={event.type === 'enter' ? 'login' : 'logout'}
                    size={18}
                    color={event.type === 'enter' ? Colors.accent : Colors.gold}
                  />
                  <View style={styles.eventText}>
                    <Text style={styles.eventTitle}>
                      {event.type === 'enter' ? 'Masuk arena' : 'Keluar arena'} • {event.arenaName}
                    </Text>
                    <Text style={styles.hint}>{formatEventTime(event.at)}</Text>
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={styles.disclaimer}>
            <MaterialIcons name="privacy-tip" size={16} color={Colors.muted} />
            <Text style={styles.disclaimerText}>
              Koordinat disimpan di perangkat. Alamat diambil dari geocoder perangkat atau layanan
              reverse geocoding dan tidak dikirim ke server PentungScore.
            </Text>
          </View>
        </View>
      </ScrollView>
      <ConfirmSheet
        visible={confirmDelete}
        title="Hapus Arena?"
        message="Arena dan pemantauan geofence akan dihapus. Lokasi pada sesi permainan lama tetap tersimpan."
        confirmLabel="Hapus Arena"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void handleDeleteArena()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  banner: { marginHorizontal: 16, marginTop: 12 },
  mapCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 10,
    gap: 10,
  },
  mapPlaceholder: {
    height: 200,
    borderRadius: Radius.lg,
    backgroundColor: Colors.raised,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 20,
  },
  mapPlaceholderTitle: { color: Colors.ink, fontFamily: FontFamily.bodySemi, fontSize: 15 },
  mapPlaceholderText: {
    color: Colors.muted,
    fontFamily: FontFamily.body,
    fontSize: 12,
    textAlign: 'center',
  },
  mapMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  mapMetaText: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 12 },
  fencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  fencePillText: { fontFamily: FontFamily.bodySemi, fontSize: 12 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 10,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  cardTitle: { color: Colors.ink, fontFamily: FontFamily.display, fontSize: 16 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  address: { color: Colors.ink, fontFamily: FontFamily.bodyMedium, fontSize: 15, lineHeight: 21 },
  coords: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 12 },
  hint: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionGrow: { flexGrow: 1, flexBasis: '40%' },
  mockPill: {
    backgroundColor: Soft.goldSoft,
    borderWidth: 1,
    borderColor: Colors.gold,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  mockPillText: { color: Colors.gold, fontFamily: FontFamily.bodySemi, fontSize: 11 },
  radiusPill: {
    backgroundColor: Soft.accentSoft,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  radiusPillText: { color: Colors.accent, fontFamily: FontFamily.bodySemi, fontSize: 12 },
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
  radiusRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  radiusOption: {
    flexGrow: 1,
    minHeight: MIN_TOUCH,
    minWidth: 62,
    borderRadius: Radius.md,
    backgroundColor: Colors.raised,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radiusOptionActive: { backgroundColor: Soft.accentSoft, borderColor: Colors.accent },
  radiusText: { color: Colors.muted, fontFamily: FontFamily.bodySemi, fontSize: 13 },
  radiusTextActive: { color: Colors.accent },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchText: { flex: 1, gap: 2 },
  switchLabel: { color: Colors.ink, fontFamily: FontFamily.bodyMedium, fontSize: 14 },
  clearBtn: { minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: 4 },
  clearText: { color: Colors.danger, fontFamily: FontFamily.bodySemi, fontSize: 13 },
  eventRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  eventText: { flex: 1, gap: 2 },
  eventTitle: { color: Colors.ink, fontFamily: FontFamily.bodyMedium, fontSize: 13 },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  disclaimerText: {
    flex: 1,
    color: Colors.muted,
    fontFamily: FontFamily.body,
    fontSize: 11,
    lineHeight: 16,
  },
});
