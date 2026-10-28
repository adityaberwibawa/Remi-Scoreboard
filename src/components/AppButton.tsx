import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { Colors, FontFamily, MIN_TOUCH, Radius } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  disabledReason?: string;
  hint?: string;
  icon?: React.ReactNode;
  /** Tampilkan spinner dan cegah tekan ganda selama aksi berjalan. */
  loading?: boolean;
  loadingLabel?: string;
}

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  disabledReason,
  hint,
  icon,
  loading = false,
  loadingLabel,
}: Props) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const isDisabled = !!disabled || loading;
  const spinnerColor = isPrimary ? Colors.onAccent : isDanger ? Colors.coal : Colors.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={disabled && disabledReason ? disabledReason : hint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        isPrimary && styles.primary,
        variant === 'ghost' && styles.ghost,
        isDanger && styles.danger,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}>
      {loading ? <ActivityIndicator size="small" color={spinnerColor} /> : icon}
      <Text
        style={[
          styles.text,
          isPrimary && styles.textOnAccent,
          isDanger && styles.textOnDanger,
          variant === 'ghost' && styles.textGhost,
          isDisabled && styles.textDisabled,
        ]}>
        {loading && loadingLabel ? loadingLabel : label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primary: { backgroundColor: Colors.accent },
  ghost: {
    backgroundColor: Colors.raised,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  danger: { backgroundColor: Colors.danger },
  disabled: { backgroundColor: Colors.raised, opacity: 0.6 },
  pressed: { opacity: 0.85 },
  text: { fontFamily: FontFamily.bodySemi, fontSize: 15 },
  textOnAccent: { color: Colors.onAccent },
  textOnDanger: { color: Colors.coal },
  textGhost: { color: Colors.ink },
  textDisabled: { color: Colors.muted },
});
