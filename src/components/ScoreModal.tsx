import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontFamily, MIN_TOUCH, Radius } from '../theme';
import type { Player } from '../types';
import { AppButton } from './AppButton';
import { NumberStepper } from './NumberStepper';
import { PlayerAvatar } from './PlayerAvatar';

export interface ScoreModalPlayer {
  player: Player;
  total: number;
  initial: number;
}

interface Props {
  title: string;
  subtitle: string;
  players: ScoreModalPlayer[];
  saveLabel: string;
  onSave: (scores: Record<string, number>) => void;
  onClose: () => void;
  /** Spinner pada tombol simpan; mencegah tekan ganda. */
  saving?: boolean;
}

/**
 * Modal input skor: satu stepper per pemain. Nilai awal = skor tersimpan.
 * Komponen di-mount hanya saat dibuka agar nilai awal selalu sesuai ronde.
 */
export function ScoreModal({ title, subtitle, players, saveLabel, onSave, onClose, saving }: Props) {
  const insets = useSafeAreaInsets();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const p of players) seed[p.player.id] = String(p.initial);
    return seed;
  });
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => {
    const out: Record<string, number> = {};
    for (const p of players) {
      const raw = (values[p.player.id] ?? '').trim().replace(',', '.');
      const num = Number(raw);
      if (raw === '' || !Number.isFinite(num)) return null;
      out[p.player.id] = Math.trunc(num);
    }
    return out;
  }, [values, players]);

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <MaterialIcons name="edit-note" size={22} color={Colors.accent} />
            </View>
            <View style={styles.headerText}>
              <Text accessibilityRole="header" style={styles.title}>
                {title}
              </Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tutup input skor"
              onPress={onClose}
              style={styles.close}>
              <MaterialIcons name="close" size={20} color={Colors.muted} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled">
            {players.map(({ player, total }) => (
              <View key={player.id} style={styles.row}>
                <View style={styles.identity}>
                  <PlayerAvatar name={player.name} avatar={player.avatar} size={40} />
                  <View style={styles.nameWrap}>
                    <Text style={styles.name} numberOfLines={1}>
                      {player.name}
                    </Text>
                    <Text style={styles.total}>Total: {total} pts</Text>
                  </View>
                </View>
                <View style={styles.stepper}>
                  <NumberStepper
                    label={player.name}
                    value={values[player.id] ?? ''}
                    onChange={(v) => setValues((prev) => ({ ...prev, [player.id]: v }))}
                    hint="boleh negatif untuk pentung"
                  />
                </View>
              </View>
            ))}
          </ScrollView>
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <View style={styles.footer}>
            <View style={styles.footerBtn}>
              <AppButton label="Batal" variant="ghost" onPress={onClose} />
            </View>
            <View style={[styles.footerBtn, styles.footerMain]}>
              <AppButton
                label={saveLabel}
                loading={saving}
                loadingLabel="Menyimpan…"
                disabled={saving}
                onPress={() => {
                  if (!parsed) {
                    setError('Semua skor harus berupa angka. Tulis 0 bila tanpa skor.');
                    return;
                  }
                  onSave(parsed);
                }}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    borderTopWidth: 1,
    borderColor: Colors.border,
    paddingTop: 12,
    paddingHorizontal: 16,
    maxHeight: '92%',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 12 },
  headerIcon: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: Radius.md,
    backgroundColor: Colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: { color: Colors.ink, fontFamily: FontFamily.display, fontSize: 18 },
  subtitle: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 13, marginTop: 2 },
  close: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { flexGrow: 0 },
  listContent: { gap: 12, paddingBottom: 4 },
  row: {
    backgroundColor: Colors.base,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 12,
    gap: 10,
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameWrap: { flex: 1 },
  name: { color: Colors.ink, fontFamily: FontFamily.bodySemi, fontSize: 15 },
  total: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 12, marginTop: 2 },
  stepper: {},
  error: { color: Colors.danger, fontFamily: FontFamily.bodyMedium, fontSize: 13, marginTop: 8 },
  footer: { flexDirection: 'row', gap: 12, marginTop: 12 },
  footerBtn: { flex: 1 },
  footerMain: { flex: 2 },
});
