import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontFamily, MIN_TOUCH, Radius } from '../theme';
import { AppButton } from './AppButton';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  children?: React.ReactNode;
}

/** Dialog konfirmasi: fokus modal, batal selalu tersedia, aman untuk aksi async. */
export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  destructive,
  onConfirm,
  onCancel,
  children,
}: Props) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      accessibilityViewIsModal>
      <Pressable
        accessibilityLabel="Tutup dialog"
        onPress={busy ? undefined : onCancel}
        style={styles.overlay}>
        <Pressable
          accessibilityRole="alert"
          accessibilityLabel={`${title}. ${message}`}
          style={styles.sheet}>
          <View style={styles.iconBox}>
            <MaterialIcons
              name={destructive ? 'warning' : 'help-outline'}
              size={24}
              color={destructive ? Colors.danger : Colors.accent}
            />
          </View>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <Text style={styles.message}>{message}</Text>
          {children}
          <View style={styles.actions}>
            <View style={styles.action}>
              <AppButton label="Batal" variant="ghost" disabled={busy} onPress={onCancel} />
            </View>
            <View style={styles.action}>
              <AppButton
                label={confirmLabel}
                variant={destructive ? 'danger' : 'primary'}
                loading={busy}
                loadingLabel="Memproses…"
                disabled={busy}
                onPress={() => void handleConfirm()}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
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
    padding: 20,
    gap: 8,
  },
  iconBox: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: Radius.md,
    backgroundColor: Colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { color: Colors.ink, fontFamily: FontFamily.display, fontSize: 18 },
  message: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  action: { flex: 1 },
});
