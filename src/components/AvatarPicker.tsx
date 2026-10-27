import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontFamily, MIN_TOUCH, Radius, Soft } from '../theme';
import { initialsOf } from '../scoring';
import type { Avatar, AvatarColorStyle } from '../types';
import { AppButton } from './AppButton';
import { pickAndPersistPhoto } from '../photo';

type Tab = 'initials' | 'camera' | 'gallery';

const PRESETS: { style: AvatarColorStyle; label: string }[] = [
  { style: 'emerald', label: 'Emerald' },
  { style: 'gold', label: 'Emas' },
  { style: 'crimson', label: 'Merah' },
  { style: 'slate', label: 'Abu' },
];

const TINT: Record<AvatarColorStyle, { bg: string; fg: string; border: string }> = {
  emerald: { bg: Soft.accentSoft, fg: Colors.accent, border: Colors.accent },
  gold: { bg: Soft.goldSoft, fg: Colors.gold, border: Colors.gold },
  crimson: { bg: Soft.dangerSoft, fg: Colors.danger, border: Colors.danger },
  slate: { bg: Colors.raised, fg: Colors.muted, border: Colors.border },
};

interface Props {
  playerName: string;
  initial: Avatar;
  onApply: (avatar: Avatar) => void;
  onClose: () => void;
}

/**
 * Pemilih avatar: inisial (4 preset) / kamera / galeri asli.
 * Komponen ini di-mount hanya saat dibuka, sehingga state awal selalu segar.
 */
export function AvatarPicker({ playerName, initial, onApply, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('initials');
  const [colorStyle, setColorStyle] = useState<AvatarColorStyle>(
    initial.type === 'initials' ? initial.colorStyle : 'emerald',
  );
  const [photoUri, setPhotoUri] = useState<string | null>(
    initial.type === 'photo' ? initial.photoUri : null,
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const takePhoto = async (source: 'camera' | 'gallery') => {
    setBusy(true);
    setNotice(null);
    const res = await pickAndPersistPhoto(source);
    setBusy(false);
    if (res.denied) {
      setNotice(
        'Izin ditolak. Buka Pengaturan > PentungScore untuk mengizinkan akses ' +
          (source === 'camera' ? 'kamera.' : 'galeri.'),
      );
      return;
    }
    if (res.error) {
      setNotice(res.error);
      return;
    }
    if (res.uri) {
      setPhotoUri(res.uri);
      setNotice('Foto siap dipakai. Tekan Terapkan Avatar.');
    }
  };

  const previewUri = photoUri;
  const tint = TINT[colorStyle];

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal>
      <View style={styles.overlay}>
        <View
          accessibilityLabel={`Foto profil untuk ${playerName}`}
          style={styles.sheet}>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>
              Foto Profil Pemain
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tutup pemilih avatar"
              onPress={onClose}
              style={styles.close}>
              <MaterialIcons name="close" size={20} color={Colors.muted} />
            </Pressable>
          </View>
          <Text style={styles.target}>Untuk {playerName}</Text>
          <View style={styles.previewRow}>
            {previewUri ? (
              <Image
                source={{ uri: previewUri }}
                accessibilityRole="image"
                accessibilityLabel={`Pratinjau foto untuk ${playerName}`}
                style={styles.preview}
              />
            ) : (
              <View
                style={[
                  styles.preview,
                  { backgroundColor: tint.bg, borderColor: tint.border },
                ]}>
                <Text style={[styles.previewText, { color: tint.fg }]}>
                  {initialsOf(playerName)}
                </Text>
              </View>
            )}
            <Text style={styles.previewDesc}>
              {previewUri ? 'Menggunakan foto perangkat' : 'Menggunakan inisial nama pemain'}
            </Text>
          </View>
          <View accessibilityRole="radiogroup" accessibilityLabel="Sumber avatar" style={styles.tabs}>
            {(
              [
                { value: 'initials', label: 'Inisial' },
                { value: 'camera', label: 'Kamera' },
                { value: 'gallery', label: 'Galeri' },
              ] as { value: Tab; label: string }[]
            ).map((t) => (
              <Pressable
                key={t.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: tab === t.value }}
                accessibilityLabel={t.label}
                onPress={() => setTab(t.value)}
                style={[styles.tab, tab === t.value && styles.tabActive]}>
                <Text style={[styles.tabText, tab === t.value && styles.tabTextActive]}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {tab === 'initials' ? (
            <View style={styles.presets}>
              {PRESETS.map((p) => {
                const pt = TINT[p.style];
                const active = colorStyle === p.style;
                return (
                  <Pressable
                    key={p.style}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Warna ${p.label}`}
                    onPress={() => {
                      setColorStyle(p.style);
                      setPhotoUri(null);
                    }}
                    style={[
                      styles.preset,
                      { backgroundColor: pt.bg, borderColor: active ? pt.fg : Colors.border },
                    ]}>
                    <Text style={[styles.presetText, { color: pt.fg }]}>
                      {initialsOf(playerName)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.deviceBox}>
              <MaterialIcons
                name={tab === 'camera' ? 'photo-camera' : 'photo-library'}
                size={28}
                color={Colors.accent}
              />
              <Text style={styles.deviceText}>
                {tab === 'camera'
                  ? 'Ambil foto baru dengan kamera perangkat.'
                  : 'Pilih foto dari galeri perangkat.'}
              </Text>
              <AppButton
                label={busy ? 'Membuka…' : tab === 'camera' ? 'Buka Kamera' : 'Pilih dari Galeri'}
                disabled={busy}
                onPress={() => takePhoto(tab)}
              />
            </View>
          )}
          {notice ? (
            <Text accessibilityRole="alert" style={styles.notice}>
              {notice}
            </Text>
          ) : null}
          <View style={styles.footer}>
            <View style={styles.footerBtn}>
              <AppButton label="Tutup" variant="ghost" onPress={onClose} />
            </View>
            <View style={styles.footerBtn}>
              <AppButton
                label="Terapkan Avatar"
                onPress={() =>
                  onApply(
                    photoUri ? { type: 'photo', photoUri } : { type: 'initials', colorStyle },
                  )
                }
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
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 10,
    maxHeight: '88%',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: Colors.ink, fontFamily: FontFamily.display, fontSize: 17 },
  close: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  target: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 12 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  preview: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewText: { fontFamily: FontFamily.display, fontSize: 20 },
  previewDesc: { flex: 1, color: Colors.muted, fontFamily: FontFamily.body, fontSize: 12 },
  tabs: { flexDirection: 'row', backgroundColor: Colors.base, borderRadius: Radius.md, padding: 4, gap: 4 },
  tab: {
    flex: 1,
    minHeight: MIN_TOUCH,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: { backgroundColor: Colors.raised },
  tabText: { color: Colors.muted, fontFamily: FontFamily.bodyMedium, fontSize: 13 },
  tabTextActive: { color: Colors.accent, fontFamily: FontFamily.bodySemi },
  presets: { flexDirection: 'row', gap: 8 },
  preset: {
    flex: 1,
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetText: { fontFamily: FontFamily.display, fontSize: 15 },
  deviceBox: {
    backgroundColor: Colors.base,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  deviceText: {
    color: Colors.muted,
    fontFamily: FontFamily.body,
    fontSize: 13,
    textAlign: 'center',
  },
  notice: { color: Colors.gold, fontFamily: FontFamily.bodyMedium, fontSize: 13 },
  footer: { flexDirection: 'row', gap: 12 },
  footerBtn: { flex: 1 },
});
