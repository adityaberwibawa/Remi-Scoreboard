/** Task 03 — Section dinamis: tampilkan data API pada UI yang sudah ada (tanpa merombak). */
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { SessionTemplate } from '../api/dto';
import { Colors, FontFamily, MIN_TOUCH, Radius } from '../theme';

interface Props {
  templates: SessionTemplate[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function TemplateSection({ templates, loading, error, onRetry }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text accessibilityRole="header" style={styles.title}>
          Template dari API
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Dynamic</Text>
        </View>
      </View>

      {loading ? (
        <View accessible accessibilityLabel="Memuat template" style={styles.state}>
          <ActivityIndicator color={Colors.accent} />
          <Text style={styles.stateText}>Mengambil data dari API…</Text>
        </View>
      ) : error ? (
        <View style={styles.state}>
          <MaterialIcons name="cloud-off" size={24} color={Colors.muted} />
          <Text style={styles.stateText}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Coba lagi memuat template"
            onPress={onRetry}
            style={styles.retry}>
            <Text style={styles.retryText}>Coba Lagi</Text>
          </Pressable>
        </View>
      ) : templates.length === 0 ? (
        <View style={styles.state}>
          <MaterialIcons name="cloud-queue" size={24} color={Colors.muted} />
          <Text style={styles.stateText}>Belum ada template dari server.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {templates.map((t) => (
            <View
              key={t.id}
              accessible
              accessibilityLabel={`${t.title}. ${t.description}. Status ${t.status}.`}
              style={styles.card}>
              <View style={styles.iconBox}>
                <MaterialIcons
                  name={t.status === 'active' ? 'cloud-done' : 'cloud-off'}
                  size={20}
                  color={t.status === 'active' ? Colors.accent : Colors.muted}
                />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {t.title}
                </Text>
                <Text style={styles.cardDesc} numberOfLines={2}>
                  {t.description}
                </Text>
              </View>
              <View style={[styles.pill, t.status !== 'active' && styles.pillOff]}>
                <Text style={[styles.pillText, t.status !== 'active' && styles.pillTextOff]}>
                  {t.status}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 4 },
  title: { color: Colors.muted, fontFamily: FontFamily.bodySemi, fontSize: 13 },
  badge: {
    backgroundColor: Colors.raised,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { color: Colors.accent, fontFamily: FontFamily.bodySemi, fontSize: 11 },
  state: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  stateText: {
    color: Colors.muted,
    fontFamily: FontFamily.body,
    fontSize: 13,
    textAlign: 'center',
  },
  retry: {
    minHeight: MIN_TOUCH,
    justifyContent: 'center',
    backgroundColor: Colors.raised,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
  },
  retryText: { color: Colors.accent, fontFamily: FontFamily.bodySemi, fontSize: 14 },
  list: { gap: 8 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { color: Colors.ink, fontFamily: FontFamily.bodySemi, fontSize: 14 },
  cardDesc: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 12 },
  pill: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pillOff: { backgroundColor: Colors.raised },
  pillText: { color: Colors.accent, fontFamily: FontFamily.bodySemi, fontSize: 11 },
  pillTextOff: { color: Colors.muted },
});
