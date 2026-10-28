import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontFamily, MIN_TOUCH, Radius, Soft } from '../theme';

export type StatusTone = 'error' | 'success' | 'info' | 'offline';

interface Props {
  tone: StatusTone;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

const TONE = {
  error: { icon: 'error-outline', color: Colors.danger, background: Soft.dangerSoft, border: Colors.danger },
  success: { icon: 'check-circle-outline', color: Colors.accent, background: Soft.accentSoft, border: Colors.accent },
  info: { icon: 'info-outline', color: Colors.muted, background: Colors.raised, border: Colors.border },
  offline: { icon: 'wifi-off', color: Colors.gold, background: Soft.goldSoft, border: Colors.gold },
} as const;

/** Banner status bersama untuk error, sukses, info, dan mode offline. */
export function StatusBanner({ tone, text, actionLabel, onAction, style }: Props) {
  const toneStyle = TONE[tone];
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.banner,
        { backgroundColor: toneStyle.background, borderColor: toneStyle.border },
        style,
      ]}>
      <MaterialIcons name={toneStyle.icon} size={18} color={toneStyle.color} />
      <Text style={[styles.text, { color: toneStyle.color }]}>{text}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          hitSlop={8}
          style={styles.action}>
          <Text style={[styles.actionText, { color: toneStyle.color }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 12,
  },
  text: { flex: 1, fontFamily: FontFamily.bodyMedium, fontSize: 13, lineHeight: 18 },
  action: { minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: 4 },
  actionText: { fontFamily: FontFamily.bodySemi, fontSize: 13 },
});
