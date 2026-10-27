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
  /** Bila diisi, template aktif bisa diketuk untuk membuka form permainan. */
  onSelect?: (template: SessionTemplate) => void;
}

export function TemplateSection({ templates, loading, error, onRetry, onSelect }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text accessibilityRole="header" style={styles.title}>
          Template Sesi
        </Text>
        {!loading && !error && templates.length > 0 ? (
          <View style={styles.countPill}>
            <Text style={styles.countText}>{templates.length} tersedia</Text>
          </View>
        ) : null}
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
          {templates.map((t) => {
            const selectable = t.status === 'active' && !!onSelect;
            const rules = [
              `${t.minPlayers} pemain min`,
              t.targetScoreEnabled && t.targetScore > 0 ? `target ${t.targetScore}` : null,
            ]
              .filter(Boolean)
              .join(' • ');
            return (
              <Pressable
                key={t.id}
                accessibilityRole={selectable ? 'button' : undefined}
                accessibilityState={selectable ? { disabled: false } : { disabled: true }}
                accessibilityLabel={`${t.title}. ${t.description}. Status ${t.status}. ${rules}.`}
                accessibilityHint={selectable ? 'Buka form permainan dengan aturan template ini' : undefined}
                disabled={!selectable}
                onPress={() => onSelect?.(t)}
                style={({ pressed }) => [styles.card, pressed && selectable && styles.cardPressed]}>
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
                  <Text style={styles.cardMeta}>{rules}</Text>
                </View>
                <View style={[styles.pill, t.status !== 'active' && styles.pillOff]}>
                  <Text style={[styles.pillText, t.status !== 'active' && styles.pillTextOff]}>
                    {t.status}
                  </Text>
                </View>
                {selectable ? (
                  <MaterialIcons name="chevron-right" size={18} color={Colors.muted} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 4 },
  title: { color: Colors.muted, fontFamily: FontFamily.bodySemi, fontSize: 13 },
  countPill: {
    backgroundColor: Colors.raised,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countText: { color: Colors.muted, fontFamily: FontFamily.bodySemi, fontSize: 11 },
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
  cardPressed: { backgroundColor: Colors.raised },
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
  cardMeta: { color: Colors.muted, fontFamily: FontFamily.bodyMedium, fontSize: 11 },
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
