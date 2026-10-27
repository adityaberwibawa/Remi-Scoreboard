import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../../components/AppButton';
import { AppHeader } from '../../components/AppHeader';
import { AvatarPicker } from '../../components/AvatarPicker';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { EmptyState } from '../../components/EmptyState';
import { PlayerAvatar } from '../../components/PlayerAvatar';
import { Colors, Common, FontFamily, MIN_TOUCH, Radius } from '../../theme';
import { MAX_PLAYERS, MAX_NAME_LENGTH } from '../../scoring';
import { useStore } from '../../store';
import type { Avatar, Player } from '../../types';

export default function PlayersScreen() {
  const insets = useSafeAreaInsets();
  const players = useStore((s) => s.players);
  const addPlayer = useStore((s) => s.addPlayer);
  const renamePlayer = useStore((s) => s.renamePlayer);
  const updateAvatar = useStore((s) => s.updateAvatar);
  const cycleSuit = useStore((s) => s.cycleSuit);
  const setDealer = useStore((s) => s.setDealer);
  const removePlayer = useStore((s) => s.removePlayer);
  const movePlayer = useStore((s) => s.movePlayer);

  const [name, setName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [avatarDraft, setAvatarDraft] = useState<Avatar>({
    type: 'initials',
    colorStyle: 'emerald',
  });
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<Player | null>(null);
  const [editName, setEditName] = useState('');
  const [deleting, setDeleting] = useState<Player | null>(null);

  const submitAdd = async () => {
    if (players.length >= MAX_PLAYERS) {
      setFormError(`Maksimal ${MAX_PLAYERS} pemain dalam satu daftar.`);
      return;
    }
    const error = await addPlayer(name, avatarDraft);
    if (error) {
      setFormError(error);
      return;
    }
    setName('');
    setFormError(null);
  };

  const submitRename = async () => {
    if (!editing) return;
    const error = await renamePlayer(editing.id, editName);
    if (error) {
      Alert.alert('Nama tidak valid', error);
      return;
    }
    setEditing(null);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const error = await removePlayer(deleting.id);
    setDeleting(null);
    if (error) Alert.alert('Tidak bisa menghapus', error);
  };

  return (
    <View style={Common.screen}>
      <AppHeader title="Kelola Pemain" subtitle={`${players.length} / ${MAX_PLAYERS} pemain`} />
      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled">
        <View style={Common.content}>
          <View style={styles.form}>
            <Text accessibilityRole="header" style={styles.formTitle}>
              Tambah Pemain Baru
            </Text>
            <View style={styles.avatarRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Pilih avatar pemain baru"
                accessibilityHint="Buka pemilih avatar: inisial, kamera, atau galeri"
                onPress={() => setPickerFor('new')}
                style={styles.avatarBtn}>
                <PlayerAvatar name={name || '?'} avatar={avatarDraft} size={48} />
                <View style={styles.avatarBadge}>
                  <MaterialIcons name="photo-camera" size={12} color={Colors.onAccent} />
                </View>
              </Pressable>
              <Text style={styles.avatarHint}>Ketuk avatar untuk memilih foto atau warna</Text>
            </View>
            <View style={styles.inputRow}>
              <TextInput
                accessibilityLabel="Nama pemain baru"
                accessibilityHint={`Maksimal ${MAX_NAME_LENGTH} karakter, tidak boleh sama dengan pemain lain`}
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  setFormError(null);
                }}
                placeholder="Masukkan nama pemain…"
                placeholderTextColor={Colors.muted}
                maxLength={MAX_NAME_LENGTH}
                returnKeyType="done"
                onSubmitEditing={submitAdd}
                style={styles.input}
              />
              <View style={styles.addBtn}>
                <AppButton label="Tambah" onPress={submitAdd} />
              </View>
            </View>
            {formError ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {formError}
              </Text>
            ) : null}
          </View>
          {players.length === 0 ? (
            <EmptyState
              icon="group"
              title="Belum ada pemain"
              description="Tambahkan minimal 2 pemain untuk memulai permainan."
            />
          ) : (
            <View style={styles.roster}>
              {players.map((player, index) => (
                <View
                  key={player.id}
                  accessible
                  accessibilityLabel={`${player.name}, posisi ${index + 1}${
                    player.isDealer ? ', dealer awal' : ''
                  }`}
                  style={styles.playerCard}>
                  <Text style={styles.seat}>{index + 1}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Ubah avatar ${player.name}`}
                    onPress={() => setPickerFor(player.id)}
                    hitSlop={4}>
                    <PlayerAvatar name={player.name} avatar={player.avatar} size={44} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Lambang ${player.name}: ${player.suit}. Ketuk untuk ganti.`}
                    onPress={() => cycleSuit(player.id)}
                    style={styles.suit}>
                    <Text
                      style={[
                        styles.suitGlyph,
                        (player.suit === '♥' || player.suit === '♦') && styles.suitRed,
                      ]}>
                      {player.suit}
                    </Text>
                  </Pressable>
                  <View style={styles.info}>
                    <Text style={styles.playerName} numberOfLines={1}>
                      {player.name}
                    </Text>
                    <View style={styles.subRow}>
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ selected: player.isDealer }}
                        accessibilityLabel={
                          player.isDealer
                            ? `${player.name} adalah dealer awal`
                            : `Jadikan ${player.name} dealer awal`
                        }
                        onPress={() => setDealer(player.id)}
                        style={styles.dealerBtn}>
                        <MaterialIcons
                          name={player.isDealer ? 'stars' : 'radio-button-unchecked'}
                          size={14}
                          color={player.isDealer ? Colors.gold : Colors.muted}
                        />
                        <Text style={[styles.dealerText, player.isDealer && styles.dealerActive]}>
                          {player.isDealer ? 'Dealer Awal' : 'Jadikan Dealer'}
                        </Text>
                      </Pressable>
                      <Text style={styles.stats}>
                        • {player.gamesPlayed} game{player.wins > 0 ? `, ${player.wins} menang` : ''}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.actions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Pindahkan ${player.name} naik`}
                      disabled={index === 0}
                      onPress={() => movePlayer(player.id, -1)}
                      style={styles.iconBtn}>
                      <MaterialIcons
                        name="arrow-upward"
                        size={18}
                        color={index === 0 ? Colors.border : Colors.muted}
                      />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Pindahkan ${player.name} turun`}
                      disabled={index === players.length - 1}
                      onPress={() => movePlayer(player.id, 1)}
                      style={styles.iconBtn}>
                      <MaterialIcons
                        name="arrow-downward"
                        size={18}
                        color={index === players.length - 1 ? Colors.border : Colors.muted}
                      />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Ubah nama ${player.name}`}
                      onPress={() => {
                        setEditing(player);
                        setEditName(player.name);
                      }}
                      style={styles.iconBtn}>
                      <MaterialIcons name="edit" size={18} color={Colors.muted} />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Hapus ${player.name}`}
                      accessibilityHint="Meminta konfirmasi sebelum menghapus"
                      onPress={() => setDeleting(player)}
                      style={styles.iconBtn}>
                      <MaterialIcons name="delete-outline" size={18} color={Colors.muted} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      {pickerFor !== null ? (
        <AvatarPicker
          playerName={pickerFor === 'new' ? name.trim() || 'Pemain Baru' : (players.find((p) => p.id === pickerFor)?.name ?? '')}
          initial={
            pickerFor === 'new'
              ? avatarDraft
              : (players.find((p) => p.id === pickerFor)?.avatar ?? avatarDraft)
          }
          onClose={() => setPickerFor(null)}
          onApply={(avatar) => {
            if (pickerFor === 'new') {
              setAvatarDraft(avatar);
            } else if (pickerFor) {
              updateAvatar(pickerFor, avatar).catch(() =>
                Alert.alert('Gagal', 'Avatar gagal disimpan.'),
              );
            }
            setPickerFor(null);
          }}
        />
      ) : null}
      <ConfirmSheet
        visible={editing !== null}
        title="Ubah Nama Pemain"
        message={`Nama baru untuk ${editing?.name ?? ''} (maksimal ${MAX_NAME_LENGTH} karakter).`}
        confirmLabel="Simpan"
        onCancel={() => setEditing(null)}
        onConfirm={submitRename}>
        <TextInput
          accessibilityLabel="Nama baru pemain"
          value={editName}
          onChangeText={setEditName}
          maxLength={MAX_NAME_LENGTH}
          autoFocus={editing !== null}
          returnKeyType="done"
          onSubmitEditing={submitRename}
          style={styles.input}
        />
      </ConfirmSheet>
      <ConfirmSheet
        visible={deleting !== null}
        title="Hapus Pemain?"
        message={`${deleting?.name ?? ''} akan dikeluarkan dari daftar. Pemain yang ikut game berjalan tidak bisa dihapus.`}
        confirmLabel="Hapus"
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },
  form: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 12,
  },
  formTitle: { color: Colors.muted, fontFamily: FontFamily.bodySemi, fontSize: 13 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarBtn: { width: 48, height: 48 },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: { flex: 1, color: Colors.muted, fontFamily: FontFamily.body, fontSize: 12 },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: {
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
  addBtn: { justifyContent: 'center' },
  error: { color: Colors.danger, fontFamily: FontFamily.bodyMedium, fontSize: 13 },
  roster: { gap: 8 },
  playerCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  seat: {
    color: Colors.muted,
    fontFamily: FontFamily.display,
    fontSize: 12,
    width: 20,
    textAlign: 'center',
  },
  suit: {
    width: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    borderRadius: Radius.md,
    backgroundColor: Colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suitGlyph: { color: Colors.ink, fontFamily: FontFamily.display, fontSize: 18 },
  suitRed: { color: Colors.danger },
  info: { flex: 1, gap: 4 },
  playerName: { color: Colors.ink, fontFamily: FontFamily.bodySemi, fontSize: 15 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  dealerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  dealerText: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 12 },
  dealerActive: { color: Colors.gold, fontFamily: FontFamily.bodySemi },
  stats: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 12 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
});
