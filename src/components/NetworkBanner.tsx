import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { Colors, FontFamily, Radius } from '../theme';

/** Indikator offline yang tidak menghalangi interaksi dan tidak mendorong layout. */
export function NetworkBanner() {
  const status = useNetworkStatus();
  const insets = useSafeAreaInsets();
  if (status !== 'offline') return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 68 }]}>
      <View accessibilityRole="alert" style={styles.pill}>
        <MaterialIcons name="wifi-off" size={14} color={Colors.gold} />
        <Text style={styles.text}>Mode offline — data lokal tetap tersedia</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 20 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.gold,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  text: { color: Colors.gold, fontFamily: FontFamily.bodyMedium, fontSize: 12 },
});
