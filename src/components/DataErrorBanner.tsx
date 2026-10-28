import { StyleSheet } from 'react-native';
import { useStore } from '../store';
import { StatusBanner } from './StatusBanner';

/** Banner non-blocking saat refresh data lokal gagal setelah aplikasi pernah memuat data. */
export function DataErrorBanner() {
  const loadError = useStore((s) => s.loadError);
  const loadAll = useStore((s) => s.loadAll);
  if (!loadError) return null;
  return (
    <StatusBanner
      tone="error"
      text={loadError}
      actionLabel="Muat Ulang"
      onAction={() => void loadAll()}
      style={styles.banner}
    />
  );
}

const styles = StyleSheet.create({
  banner: { marginHorizontal: 16, marginTop: 12 },
});
