import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../../components/AppButton';
import { AppHeader } from '../../components/AppHeader';
import { ArenaCard } from '../../components/ArenaCard';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { CurrentLocationCard } from '../../components/CurrentLocationCard';
import { DataErrorBanner } from '../../components/DataErrorBanner';
import { EmptyState } from '../../components/EmptyState';
import { GeofenceHistory } from '../../components/GeofenceHistory';
import { LocationPermissionCard } from '../../components/LocationPermissionCard';
import { MapCanvas } from '../../components/MapCanvas';
import type { ArenaMarker, MapCamera } from '../../components/MapCanvas.types';
import { StatusBanner, type StatusTone } from '../../components/StatusBanner';
import { useStore } from '../../store';
import { haversineMeters } from '../../location/geo';
import { useCurrentLocation } from '../../location/useCurrentLocation';
import { useLocationPermissions } from '../../location/useLocationPermissions';
import { useReverseGeocode } from '../../location/useReverseGeocode';
import type {
  ArenaStatus,
  Coordinates,
  GeocodedPlace,
  SessionLocation,
} from '../../location/types';
import { Colors, Common, FontFamily, Radius, Soft } from '../../theme';

interface DraftEdit {
  sessionId: string;
  coords: Coordinates;
  radiusM: number;
}

export default function MapScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const mapHeight = Math.min(420, Math.max(250, windowHeight * 0.36));

  const sessions = useStore((s) => s.sessions);
  const locations = useStore((s) => s.sessionLocations);
  const geofenceEvents = useStore((s) => s.geofenceEvents);
  const loadAll = useStore((s) => s.loadAll);
  const saveSessionLocation = useStore((s) => s.saveSessionLocation);
  const removeSessionLocation = useStore((s) => s.removeSessionLocation);
  const setGeofenceEnabled = useStore((s) => s.setGeofenceEnabled);
  const loadGeofenceEvents = useStore((s) => s.loadGeofenceEvents);
  const recordGeofenceEvent = useStore((s) => s.recordGeofenceEvent);

  const permissions = useLocationPermissions();
  const locationEnabled =
    permissions.foreground === 'granted' && permissions.servicesEnabled !== false;
  const current = useCurrentLocation(locationEnabled);

  const routeSessionId = typeof sessionId === 'string' ? sessionId : null;
  const [manualSelection, setManualSelection] = useState<{
    route: string | null;
    id: string;
  } | null>(null);
  const [edited, setEdited] = useState<DraftEdit | null>(null);
  const [camera, setCamera] = useState<MapCamera | null>(null);
  const [notice, setNotice] = useState<{ tone: StatusTone; text: string } | null>(null);
  const [permissionRequesting, setPermissionRequesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [geofenceBusy, setGeofenceBusy] = useState(false);
  const [showBackgroundSheet, setShowBackgroundSheet] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const hasCenteredOnUser = useRef(false);
  const lastSavedBaseline = useRef<Record<string, string>>({});
  const lastSavedStatus = useRef<Record<string, ArenaStatus>>({});
  const lastForegroundEventAt = useRef<Record<string, number>>({});
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback((text: string, tone: StatusTone = 'info') => {
    setNotice({ tone, text });
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4500);
  }, []);

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  const selectableSessions = useMemo(
    () => sessions.filter((session) => session.status === 'ongoing' || !!locations[session.id]),
    [sessions, locations],
  );

  const manualSelectedId =
    manualSelection && manualSelection.route === routeSessionId ? manualSelection.id : null;
  const fallbackSelectedId = useMemo(() => {
    const next =
      selectableSessions.find((session) => session.status === 'ongoing') ?? selectableSessions[0];
    return next?.id ?? null;
  }, [selectableSessions]);
  const selectedId: string | null =
    manualSelectedId && selectableSessions.some((session) => session.id === manualSelectedId)
      ? manualSelectedId
      : routeSessionId && selectableSessions.some((session) => session.id === routeSessionId)
        ? routeSessionId
        : fallbackSelectedId;

  useFocusEffect(
    useCallback(() => {
      loadAll().catch(() => undefined);
      if (selectedId) loadGeofenceEvents(selectedId).catch(() => undefined);
    }, [loadAll, loadGeofenceEvents, selectedId]),
  );

  // Event background baru ditulis ke SQLite saat app tertutup/background.
  // Muat ulang saat app kembali aktif agar riwayat langsung terlihat.
  const refreshCurrentLocation = current.refresh;
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void refreshCurrentLocation();
      if (!selectedId) return;
      loadAll().catch(() => undefined);
      loadGeofenceEvents(selectedId).catch(() => undefined);
    });
    return () => subscription.remove();
  }, [loadAll, loadGeofenceEvents, refreshCurrentLocation, selectedId]);

  const selectedSession = sessions.find((session) => session.id === selectedId);
  const saved = selectedId ? locations[selectedId] : undefined;
  const editable = selectedSession?.status === 'ongoing';

  const activeEdit = edited && edited.sessionId === selectedId ? edited : null;
  const draft: Coordinates | null =
    activeEdit?.coords ??
    (saved ? { latitude: saved.latitude, longitude: saved.longitude } : null);
  const radiusM = activeEdit?.radiusM ?? saved?.radiusM ?? 100;
  const draftMatchesSaved = !!(
    draft &&
    saved &&
    haversineMeters(draft, saved) < 1
  );
  const dirty = !!(
    draft &&
    (!saved || haversineMeters(draft, saved) > 1 || radiusM !== saved.radiusM)
  );

  const draftGeocode = useReverseGeocode(draft, {
    digits: 4,
    debounceMs: activeEdit ? 350 : 0,
  });
  const draftPlace: GeocodedPlace | null =
    draftGeocode.place ??
    (draftMatchesSaved && saved?.address
      ? { address: saved.address, placeName: saved.placeName }
      : null);

  const currentGeocode = useReverseGeocode(current.coords, { digits: 3 });

  const distanceM =
    current.coords && draft ? haversineMeters(current.coords, draft) : null;
  const status: ArenaStatus =
    distanceM == null ? 'unknown' : distanceM <= radiusM ? 'inside' : 'outside';

  const savedStatus: ArenaStatus = useMemo(() => {
    if (!current.coords || !saved) return 'unknown';
    return haversineMeters(current.coords, saved) <= saved.radiusM ? 'inside' : 'outside';
  }, [current.coords, saved]);

  const visibleEvents = useMemo(
    () => (selectedId ? geofenceEvents.filter((event) => event.sessionId === selectedId) : []),
    [geofenceEvents, selectedId],
  );

  const markers = useMemo<ArenaMarker[]>(
    () =>
      sessions.flatMap((session) => {
        const location = locations[session.id];
        if (!location) return [];
        return [
          {
            id: session.id,
            latitude: location.latitude,
            longitude: location.longitude,
            title: session.title,
            address: location.address,
            radiusM: location.radiusM,
            selected: session.id === selectedId,
          },
        ];
      }),
    [locations, selectedId, sessions],
  );

  useEffect(() => {
    if (!current.coords || hasCenteredOnUser.current) return;
    hasCenteredOnUser.current = true;
    setCamera({ coords: current.coords, key: 1 });
  }, [current.coords]);

  useEffect(() => {
    if (!selectedSession || selectedSession.status !== 'ongoing') return;
    if (!saved || savedStatus === 'unknown') return;
    if (!selectedId || !current.coords) return;

    // Perubahan arena/radius/geofence hanya menetapkan baseline baru; bukan
    // perpindahan pengguna, jadi tidak boleh menghasilkan event.
    const baseline = `${saved.updatedAt}:${saved.geofenceEnabled ? 'on' : 'off'}`;
    if (lastSavedBaseline.current[selectedId] !== baseline) {
      lastSavedBaseline.current[selectedId] = baseline;
      lastSavedStatus.current[selectedId] = savedStatus;
      return;
    }
    if (!saved.geofenceEnabled) {
      lastSavedStatus.current[selectedId] = savedStatus;
      return;
    }

    const previous = lastSavedStatus.current[selectedId];
    lastSavedStatus.current[selectedId] = savedStatus;
    if (!previous || previous === savedStatus) return;

    // Event background mungkin sudah tercatat saat aplikasi tertutup. Jangan
    // tulis event yang sama lagi ketika riwayat baru dimuat setelah resume.
    const expectedType = savedStatus === 'inside' ? 'enter' : 'exit';
    if (visibleEvents[0]?.type === expectedType) return;

    const key = `${selectedId}:${savedStatus}`;
    const now = Date.now();
    if (now - (lastForegroundEventAt.current[key] ?? 0) < 60_000) return;
    lastForegroundEventAt.current[key] = now;

    void recordGeofenceEvent({
      sessionId: selectedId,
      type: savedStatus === 'inside' ? 'enter' : 'exit',
      source: 'foreground',
      latitude: current.coords.latitude,
      longitude: current.coords.longitude,
      occurredAt: new Date().toISOString(),
    });
  }, [
    current.coords,
    recordGeofenceEvent,
    saved,
    savedStatus,
    selectedId,
    selectedSession,
    visibleEvents,
  ]);

  const announcePermission = async () => {
    if (permissionRequesting) return;
    setPermissionRequesting(true);
    const state = await permissions.requestForeground();
    setPermissionRequesting(false);
    if (state === 'granted') {
      announce('Izin lokasi diberikan. Mencari posisi perangkat…', 'success');
    } else {
      announce('Izin lokasi belum diberikan.', 'error');
    }
  };

  const recenter = () => {
    const target = current.coords ?? draft;
    if (!target) {
      announce('Belum ada lokasi untuk dipusatkan.', 'info');
      return;
    }
    setCamera((previous) => ({
      coords: target,
      key: (previous?.key ?? 0) + 1,
    }));
  };

  const handleMapPress = (coords: Coordinates) => {
    if (!selectedSession) {
      announce('Pilih sesi terlebih dahulu untuk menandai arena.', 'info');
      return;
    }
    if (!editable) {
      announce('Sesi ini sudah selesai. Arena tidak bisa diubah.', 'info');
      return;
    }
    setEdited((previous) => ({
      sessionId: selectedSession.id,
      coords,
      radiusM:
        previous && previous.sessionId === selectedSession.id ? previous.radiusM : radiusM,
    }));
  };

  const handleUseCurrent = () => {
    if (!selectedSession || !editable) {
      announce('Pilih sesi yang sedang berjalan terlebih dahulu.', 'info');
      return;
    }
    if (!current.coords) {
      announce('Posisi perangkat belum tersedia. Coba perbarui lokasi.', 'error');
      return;
    }
    setEdited({
      sessionId: selectedSession.id,
      coords: current.coords,
      radiusM,
    });
    setCamera((previous) => ({
      coords: current.coords!,
      key: (previous?.key ?? 0) + 1,
    }));
  };

  const handleRadiusChange = (radius: number) => {
    if (!selectedSession || !draft) return;
    setEdited({
      sessionId: selectedSession.id,
      coords: draft,
      radiusM: radius,
    });
  };

  const handleSave = async () => {
    if (!selectedSession || !draft || saving) return;
    if (!editable) {
      announce('Sesi ini sudah selesai. Arena tidak bisa diubah.', 'info');
      return;
    }

    setSaving(true);
    const fallbackPlace: GeocodedPlace | null =
      draftMatchesSaved && saved?.address
        ? { address: saved.address, placeName: saved.placeName }
        : null;
    const place = draftPlace ?? fallbackPlace;
    const location: SessionLocation = {
      sessionId: selectedSession.id,
      latitude: draft.latitude,
      longitude: draft.longitude,
      address: place?.address ?? null,
      placeName: place?.placeName ?? null,
      radiusM,
      geofenceEnabled: saved?.geofenceEnabled ?? false,
      updatedAt: new Date().toISOString(),
    };

    const error = await saveSessionLocation(location);
    setSaving(false);
    if (error) {
      announce(error, 'error');
      return;
    }
    setEdited(null);
    announce(saved ? 'Arena sesi diperbarui.' : 'Arena sesi disimpan.', 'success');
  };

  const enableGeofence = async (sessionToUpdate: string, backgroundReady = true) => {
    setGeofenceBusy(true);
    const error = await setGeofenceEnabled(sessionToUpdate, true);
    setGeofenceBusy(false);
    if (error) {
      announce(error, 'error');
      return;
    }
    announce(
      backgroundReady
        ? 'Pengingat area aktif. Event dicatat saat masuk atau keluar radius.'
        : 'Pengingat aktif saat aplikasi terbuka. Izin “Selalu” diperlukan untuk latar belakang.',
      backgroundReady ? 'success' : 'info',
    );
  };

  const handleToggleGeofence = async (value: boolean) => {
    if (!selectedSession || !saved || geofenceBusy) return;

    if (!value) {
      setGeofenceBusy(true);
      const error = await setGeofenceEnabled(selectedSession.id, false);
      setGeofenceBusy(false);
      if (error) {
        announce(error, 'error');
        return;
      }
      announce('Pengingat area dimatikan.', 'info');
      return;
    }

    if (!editable) {
      announce('Sesi ini sudah selesai.', 'info');
      return;
    }

    if (permissions.foreground !== 'granted') {
      const state = await permissions.requestForeground();
      if (state !== 'granted') {
        announce('Izin lokasi diperlukan untuk mengaktifkan pengingat area.', 'error');
        return;
      }
    }

    if (permissions.background !== 'granted') {
      setShowBackgroundSheet(true);
      return;
    }

    await enableGeofence(selectedSession.id, true);
  };

  const handleEnableBackground = async () => {
    setShowBackgroundSheet(false);
    if (!selectedSession) return;

    setGeofenceBusy(true);
    const state = await permissions.requestBackground();
    setGeofenceBusy(false);
    // Izin background bisa ditolak di Expo Go/Android 11. Tetap aktifkan
    // fallback foreground agar demo jarak tetap berjalan saat aplikasi terbuka.
    await enableGeofence(selectedSession.id, state === 'granted');
    await permissions.refresh().catch(() => undefined);
  };

  const handleClearArena = async () => {
    setConfirmClear(false);
    if (!selectedSession) return;
    const error = await removeSessionLocation(selectedSession.id);
    if (error) {
      announce(error, 'error');
      return;
    }
    setEdited(null);
    announce('Arena sesi dan riwayat areanya dihapus.', 'success');
  };

  const canUseAsArena = !!selectedSession && editable;

  return (
    <View style={Common.screen}>
      <AppHeader title="Peta Arena" subtitle="Lokasi main, alamat, dan pengingat area" />
      <DataErrorBanner />
      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}>
        <View style={Common.content}>
          <View style={[styles.mapWrap, { height: mapHeight }]}>
            <MapCanvas
              userLocation={current.coords}
              showUserLocation={locationEnabled}
              markers={markers}
              draft={draft}
              draftRadiusM={radiusM}
              camera={camera}
              onPressLocation={handleMapPress}
              onDragDraft={handleMapPress}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Pusatkan peta ke lokasi saya"
              accessibilityState={{ disabled: !(current.coords ?? draft) }}
              disabled={!(current.coords ?? draft)}
              onPress={recenter}
              style={({ pressed }) => [
                styles.locateButton,
                !(current.coords ?? draft) && styles.locateButtonDisabled,
                pressed && styles.locateButtonPressed,
              ]}>
              <MaterialIcons name="my-location" size={21} color={Colors.accent} />
            </Pressable>
            {editable && Platform.OS !== 'web' ? (
              <View pointerEvents="none" style={styles.mapHint}>
                <MaterialIcons name="touch-app" size={13} color={Colors.accent} />
                <Text style={styles.mapHintText}>Ketuk peta untuk memilih arena</Text>
              </View>
            ) : null}
          </View>

          {notice ? (
            <StatusBanner
              tone={notice.tone}
              text={notice.text}
              actionLabel="Tutup"
              onAction={() => setNotice(null)}
            />
          ) : null}

          <LocationPermissionCard
            foreground={permissions.foreground}
            servicesEnabled={permissions.servicesEnabled}
            canAskForeground={permissions.canAskForeground}
            error={permissions.error}
            requesting={permissionRequesting}
            onRequest={() => void announcePermission()}
            onOpenSettings={permissions.openSettings}
          />

          {locationEnabled ? (
            <CurrentLocationCard
              coords={current.coords}
              accuracy={current.accuracy}
              place={currentGeocode.place}
              geocoding={currentGeocode.geocoding}
              loading={current.loading}
              error={current.error}
              canUseAsArena={canUseAsArena}
              onRefresh={() => void current.refresh()}
              onUseAsArena={handleUseCurrent}
            />
          ) : null}

          {selectableSessions.length > 0 ? (
            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                Pilih Sesi
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sessionChips}>
                {selectableSessions.map((session) => {
                  const active = session.id === selectedId;
                  const hasArena = !!locations[session.id];
                  return (
                    <Pressable
                      key={session.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Pilih sesi ${session.title}`}
                      accessibilityState={{ selected: active }}
                      onPress={() => {
                        if (session.id === selectedId) return;
                        setEdited(null);
                        setManualSelection({ route: routeSessionId, id: session.id });
                      }}
                      style={[styles.sessionChip, active && styles.sessionChipActive]}>
                      <View style={[styles.sessionChipIcon, active && styles.sessionChipIconActive]}>
                        <MaterialIcons
                          name="place"
                          size={18}
                          color={active ? Colors.accent : Colors.muted}
                        />
                      </View>
                      <View style={styles.sessionChipText}>
                        <Text
                          style={[
                            styles.sessionChipTitle,
                            active && styles.sessionChipTitleActive,
                          ]}
                          numberOfLines={1}>
                          {session.title}
                        </Text>
                        <Text style={styles.sessionChipMeta} numberOfLines={1}>
                          {session.status === 'ongoing' ? 'Berjalan' : 'Selesai'}
                          {hasArena ? ' • Arena tersimpan' : ''}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : (
            <View style={[Common.card, styles.emptyCard]}>
              <EmptyState
                icon="place"
                title="Belum ada sesi untuk dipetakan"
                description="Mulai permainan baru, lalu tandai lokasi arena di peta."
              />
              <AppButton label="Mulai Permainan" onPress={() => router.push('/create')} />
            </View>
          )}

          {selectedSession ? (
            <>
              <ArenaCard
                session={selectedSession}
                saved={saved}
                draft={draft}
                radiusM={radiusM}
                address={draftPlace}
                geocoding={draftGeocode.geocoding}
                status={status}
                distanceM={distanceM}
                editable={editable}
                saving={saving}
                geofenceBusy={geofenceBusy}
                geofenceBackgroundReady={permissions.background === 'granted'}
                dirty={dirty}
                canUseCurrent={!!current.coords}
                onUseCurrent={handleUseCurrent}
                onRadiusChange={handleRadiusChange}
                onSave={() => void handleSave()}
                onToggleGeofence={(value) => void handleToggleGeofence(value)}
                onOpenSession={() => router.push(`/game/${selectedSession.id}`)}
                onClear={() => setConfirmClear(true)}
              />
              <GeofenceHistory events={visibleEvents} />
            </>
          ) : null}

          <View style={[Common.card, styles.privacyCard]}>
            <MaterialIcons name="lock-outline" size={17} color={Colors.muted} />
            <Text style={styles.privacyText}>
              Lokasi, arena, dan riwayat area disimpan lokal di perangkat ini. Data tidak
              dikirim ke server.
            </Text>
          </View>
        </View>
      </ScrollView>

      <ConfirmSheet
        visible={showBackgroundSheet}
        title="Aktifkan pengingat area?"
        message="PentungScore memerlukan izin lokasi “Selalu” agar dapat mencatat saat Anda masuk atau keluar arena ketika aplikasi di latar belakang. Izin bisa diubah lagi di pengaturan perangkat."
        confirmLabel="Izinkan"
        onConfirm={handleEnableBackground}
        onCancel={() => setShowBackgroundSheet(false)}
      />

      <ConfirmSheet
        visible={confirmClear}
        title="Hapus arena sesi?"
        message={`Titik arena dan riwayat area “${selectedSession?.title ?? ''}” akan dihapus dari perangkat.`}
        confirmLabel="Hapus Arena"
        destructive
        onConfirm={handleClearArena}
        onCancel={() => setConfirmClear(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingTop: 16, gap: 14 },
  mapWrap: { borderRadius: Radius.lg, overflow: 'hidden' },
  locateButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locateButtonDisabled: { opacity: 0.45 },
  locateButtonPressed: { opacity: 0.75 },
  mapHint: {
    position: 'absolute',
    top: 12,
    left: 12,
    maxWidth: '82%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 20, 21, 0.88)',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mapHintText: { color: Colors.ink, fontFamily: FontFamily.bodyMedium, fontSize: 10 },
  section: { gap: 8 },
  sectionTitle: {
    color: Colors.muted,
    fontFamily: FontFamily.bodySemi,
    fontSize: 13,
    marginLeft: 4,
  },
  sessionChips: { gap: 8, paddingRight: 4 },
  sessionChip: {
    width: 210,
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 10,
  },
  sessionChipActive: { borderColor: Colors.accent, backgroundColor: Soft.accentSoft },
  sessionChipIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionChipIconActive: { backgroundColor: Colors.card },
  sessionChipText: { flex: 1, gap: 2 },
  sessionChipTitle: { color: Colors.ink, fontFamily: FontFamily.bodySemi, fontSize: 13 },
  sessionChipTitleActive: { color: Colors.accent },
  sessionChipMeta: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 10 },
  emptyCard: { padding: 16, gap: 8 },
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    padding: 14,
  },
  privacyText: {
    flex: 1,
    color: Colors.muted,
    fontFamily: FontFamily.body,
    fontSize: 11,
    lineHeight: 16,
  },
});
