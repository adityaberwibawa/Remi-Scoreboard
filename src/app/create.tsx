import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../components/AppButton';
import { AppHeader } from '../components/AppHeader';
import { DataErrorBanner } from '../components/DataErrorBanner';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { StatusBanner } from '../components/StatusBanner';
import { Colors, Common, FontFamily, MIN_TOUCH, Radius, Soft } from '../theme';
import {
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MAX_TARGET,
  MIN_PLAYERS,
  MIN_TARGET,
  TARGET_PRESETS,
  TARGET_STEP,
  validateTargetScore,
} from '../scoring';
import { useStore } from '../store';

export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const players = useStore((s) => s.players);
  const sessions = useStore((s) => s.sessions);
  const addPlayer = useStore((s) => s.addPlayer);
  const createSession = useStore((s) => s.createSession);
  const params = useLocalSearchParams<{
    title?: string;
    minPlayers?: string;
    targetEnabled?: string;
    targetScore?: string;
  }>();

  const templateTitle = typeof params.title === 'string' ? params.title : '';
  const parsedMin = Number.parseInt(String(params.minPlayers ?? ''), 10);
  const templateMinPlayers = Number.isFinite(parsedMin)
    ? Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, parsedMin))
    : MIN_PLAYERS;
  const defaultTargetEnabled = params.targetEnabled !== '0';
  const parsedTarget = Number.parseInt(String(params.targetScore ?? ''), 10);
  const defaultTarget = Number.isFinite(parsedTarget) && parsedTarget > 0 ? parsedTarget : 500;

  const [title, setTitle] = useState(templateTitle);
  const [quickName, setQuickName] = useState('');
  const [quickError, setQuickError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [addingQuick, setAddingQuick] = useState(false);
  const [starting, setStarting] = useState(false);
  const [included, setIncluded] = useState<Record<string, boolean> | null>(null);
  const [dealerId, setDealerId] = useState<string | null>(null);
  const [targetEnabled, setTargetEnabled] = useState(defaultTargetEnabled);
  const [target, setTarget] = useState(String(defaultTarget));

  const inclusion: Record<string, boolean> = useMemo(() => {
    if (included) return included;
    const seed: Record<string, boolean> = {};
    for (const p of players) seed[p.id] = true;
    return seed;
  }, [included, players]);

  const activeDealer = dealerId ?? players.find((p) => p.isDealer)?.id ?? players[0]?.id;
  const readyIds = players.filter((p) => inclusion[p.id] !== false).map((p) => p.id);
  const readyCount = readyIds.length;
  const canStart = readyCount >= templateMinPlayers && readyCount <= MAX_PLAYERS;
  const targetNum = Number.parseInt(target, 10);
  const targetError = targetEnabled ? validateTargetScore(targetNum) : null;

  const toggleInclude = (id: string) => {
    setIncluded({ ...inclusion, [id]: inclusion[id] === false });
  };

  const submitQuickAdd = async () => {
    if (addingQuick) return;
    if (players.length >= MAX_PLAYERS) {
      setQuickError(`Maksimal ${MAX_PLAYERS} pemain dalam satu meja.`);
      return;
    }
    setAddingQuick(true);
    setActionError(null);
    try {
      const error = await addPlayer(quickName, { type: 'initials', colorStyle: 'emerald' });
      if (error) {
        setQuickError(error);
        return;
      }
      setQuickName('');
      setQuickError(null);
    } finally {
      setAddingQuick(false);
    }
  };

  const start = async () => {
    if (!canStart || targetError || starting) return;
    setStarting(true);
    setActionError(null);
    const { id, error } = await createSession({
      title: title.trim() || undefined,
      playerIds: readyIds,
      dealerPlayerId: activeDealer,
      rules: { targetScoreEnabled: targetEnabled, targetScore: targetNum },
    });
    if (error || !id) {
      setActionError(error ?? 'Gagal memulai permainan. Coba lagi.');
      setStarting(false);
      return;
    }
    setTitle('');
    setIncluded(null);
    router.replace(`/game/${id}`);
  };

  return (
    <View style={Common.screen}>
      <AppHeader title="Buat Permainan" subtitle="Atur meja & aturan skor" showBack />
      <DataErrorBanner />
      {actionError ? (
        <StatusBanner
          tone="error"
          text={actionError}
          actionLabel="Tutup"
          onAction={() => setActionError(null)}
          style={styles.banner}
        />
      ) : null}
      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled">
        <View style={Common.content}>
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>Sesi Permainan</Text>
            <TextInput
              accessibilityLabel="Judul sesi permainan"
              accessibilityHint="Opsional. Bila kosong dipakai Game bernomor otomatis."
              value={title}
              onChangeText={setTitle}
              placeholder={`Game #${sessions.length + 1}`}
              placeholderTextColor={Colors.muted}
              returnKeyType="done"
              style={styles.heroInput}
            />
            {templateTitle ? (
              <Text style={styles.templateNote}>
                Aturan dari template “{templateTitle}” — masih bisa diubah sebelum mulai.
              </Text>
            ) : null}
          </View>
          <View style={styles.sectionHead}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Daftar Pemain
            </Text>
            <View style={styles.countPill}>
              <Text style={styles.countText}>
                {readyCount} / {MAX_PLAYERS} Siap
              </Text>
            </View>
          </View>
          <View style={styles.quickRow}>
            <TextInput
              accessibilityLabel="Nama pemain cepat"
              accessibilityHint={`Maksimal ${MAX_NAME_LENGTH} karakter`}
              value={quickName}
              onChangeText={(v) => {
                setQuickName(v);
                setQuickError(null);
              }}
              placeholder="Ketik nama (cth: Eko)"
              placeholderTextColor={Colors.muted}
              maxLength={MAX_NAME_LENGTH}
              returnKeyType="done"
              onSubmitEditing={submitQuickAdd}
              style={styles.quickInput}
            />
            <AppButton
              label="Tambah"
              onPress={submitQuickAdd}
              loading={addingQuick}
              loadingLabel="Menyimpan…"
            />
          </View>
          {quickError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {quickError}
            </Text>
          ) : null}
          <Text style={styles.hint}>Urutan posisi duduk / giliran awal. Min 2, maks 6.</Text>
          {players.map((player, index) => {
            const on = inclusion[player.id] !== false;
            const isDealer = activeDealer === player.id;
            return (
              <View
                key={player.id}
                accessible
                accessibilityLabel={`${player.name}, kursi ${index + 1}${
                  on ? ', ikut main' : ', tidak ikut'
                }${isDealer ? ', dealer awal' : ''}`}
                style={[styles.playerCard, !on && styles.playerOff]}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`Sertakan ${player.name} di permainan`}
                  onPress={() => toggleInclude(player.id)}
                  style={[styles.check, on && styles.checkOn]}>
                  {on ? <MaterialIcons name="check" size={18} color={Colors.onAccent} /> : null}
                </Pressable>
                <PlayerAvatar name={player.name} avatar={player.avatar} size={40} />
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName} numberOfLines={1}>
                    {player.name}
                  </Text>
                  {isDealer ? <Text style={styles.dealerTag}>Dealer Awal</Text> : null}
                </View>
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isDealer }}
                  accessibilityLabel={
                    isDealer
                      ? `${player.name} dealer awal`
                      : `Jadikan ${player.name} dealer awal`
                  }
                  onPress={() => setDealerId(player.id)}
                  style={styles.dealerBtn}>
                  <MaterialIcons
                    name={isDealer ? 'stars' : 'radio-button-unchecked'}
                    size={18}
                    color={isDealer ? Colors.gold : Colors.muted}
                  />
                </Pressable>
              </View>
            );
          })}
          <View style={styles.rules}>
            <View style={styles.rulesHead}>
              <View style={styles.rulesTitle}>
                <Text style={styles.rulesName}>Batas Poin Akhir Game</Text>
                <Text style={styles.rulesDesc}>
                  Otomatis selesai bila seorang pemain mencapai batas ini.
                </Text>
              </View>
              <Switch
                accessibilityLabel="Aktifkan batas poin akhir game"
                value={targetEnabled}
                onValueChange={setTargetEnabled}
                trackColor={{ false: Colors.raised, true: Colors.accent }}
                thumbColor={targetEnabled ? Colors.onAccent : Colors.muted}
              />
            </View>
            {targetEnabled ? (
              <View>
                <View style={styles.presets}>
                  {TARGET_PRESETS.map((preset) => {
                    const active = targetNum === preset;
                    return (
                      <Pressable
                        key={preset}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`Target ${preset} poin`}
                        onPress={() => setTarget(String(preset))}
                        style={[styles.preset, active && styles.presetActive]}>
                        <Text style={[styles.presetText, active && styles.presetTextActive]}>
                          {preset}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.targetRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Kurangi target ${TARGET_STEP} poin`}
                    onPress={() =>
                      setTarget(String(Math.max(MIN_TARGET, (targetNum || 0) - TARGET_STEP)))
                    }
                    style={styles.targetStep}>
                    <MaterialIcons name="remove" size={20} color={Colors.ink} />
                  </Pressable>
                  <TextInput
                    accessibilityLabel="Target skor kustom"
                    accessibilityHint={`Antara ${MIN_TARGET} sampai ${MAX_TARGET}, kelipatan ${TARGET_STEP}`}
                    value={target}
                    onChangeText={setTarget}
                    keyboardType="number-pad"
                    selectTextOnFocus
                    style={styles.targetInput}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Tambah target ${TARGET_STEP} poin`}
                    onPress={() =>
                      setTarget(String(Math.min(MAX_TARGET, (targetNum || 0) + TARGET_STEP)))
                    }
                    style={styles.targetStep}>
                    <MaterialIcons name="add" size={20} color={Colors.ink} />
                  </Pressable>
                </View>
                {targetError ? (
                  <Text accessibilityRole="alert" style={styles.error}>
                    {targetError}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
          <View style={styles.readyRow}>
            <MaterialIcons
              name={canStart ? 'check-circle' : 'warning'}
              size={18}
              color={canStart ? Colors.accent : Colors.danger}
            />
            <Text style={[styles.readyText, !canStart && styles.readyWarn]}>
              {canStart
                ? `${readyCount} Pemain Siap di Meja`
                : `Minimal ${templateMinPlayers} Pemain Diperlukan`}
            </Text>
          </View>
          <AppButton
            label="Mulai Permainan"
            loading={starting}
            loadingLabel="Memulai…"
            disabled={!canStart || !!targetError}
            disabledReason={
              !canStart ? `Pilih minimal ${templateMinPlayers} pemain yang ikut.` : 'Perbaiki target skor dulu.'
            }
            onPress={start}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  hero: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 4,
  },
  heroLabel: { color: Colors.muted, fontFamily: FontFamily.bodyMedium, fontSize: 12 },
  templateNote: {
    color: Colors.accent,
    fontFamily: FontFamily.body,
    fontSize: 12,
    marginTop: 2,
  },
  heroInput: {
    color: Colors.ink,
    fontFamily: FontFamily.display,
    fontSize: 20,
    paddingVertical: 4,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: Colors.ink, fontFamily: FontFamily.display, fontSize: 18 },
  countPill: {
    backgroundColor: Soft.accentSoft,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  countText: { color: Colors.accent, fontFamily: FontFamily.bodySemi, fontSize: 12 },
  quickRow: { flexDirection: 'row', gap: 8 },
  quickInput: {
    flex: 1,
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
  error: { color: Colors.danger, fontFamily: FontFamily.bodyMedium, fontSize: 13 },
  hint: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 12 },
  playerCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playerOff: { opacity: 0.5 },
  check: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.raised,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  playerInfo: { flex: 1 },
  playerName: { color: Colors.ink, fontFamily: FontFamily.bodySemi, fontSize: 15 },
  dealerTag: {
    color: Colors.gold,
    fontFamily: FontFamily.bodySemi,
    fontSize: 11,
    marginTop: 2,
  },
  dealerBtn: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rules: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 12,
  },
  rulesHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rulesTitle: { flex: 1 },
  rulesName: { color: Colors.ink, fontFamily: FontFamily.display, fontSize: 16 },
  rulesDesc: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 12, marginTop: 2 },
  presets: { flexDirection: 'row', gap: 8 },
  preset: {
    flex: 1,
    minHeight: MIN_TOUCH,
    borderRadius: Radius.md,
    backgroundColor: Colors.raised,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetActive: { backgroundColor: Soft.accentSoft, borderColor: Colors.accent },
  presetText: { color: Colors.muted, fontFamily: FontFamily.bodySemi, fontSize: 14 },
  presetTextActive: { color: Colors.accent },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  targetStep: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: Radius.md,
    backgroundColor: Colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetInput: {
    flex: 1,
    minHeight: MIN_TOUCH,
    backgroundColor: Colors.raised,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    color: Colors.ink,
    fontFamily: FontFamily.display,
    fontSize: 18,
    textAlign: 'center',
  },
  readyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  readyText: { color: Colors.accent, fontFamily: FontFamily.bodySemi, fontSize: 14 },
  readyWarn: { color: Colors.danger },
  banner: { marginHorizontal: 16, marginTop: 12 },
});
