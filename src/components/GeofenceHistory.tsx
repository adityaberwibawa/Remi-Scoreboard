import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Common, FontFamily, Radius, Soft } from '../theme';
import type { GeofenceEvent } from '../location/types';

interface Props {
  events: GeofenceEvent[];
}

function formatEventTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Riwayat masuk/keluar arena, mencakup event dari task background. */
export function GeofenceHistory({ events }: Props) {
  return (
    <View style={[Common.card, styles.card]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="timeline" size={19} color={Colors.accent} />
          <Text accessibilityRole="header" style={styles.title}>
            Riwayat Area
          </Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{events.length} event</Text>
        </View>
      </View>

      {events.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="notifications-none" size={22} color={Colors.muted} />
          <Text style={styles.emptyText}>
            Belum ada event. Aktifkan pengingat area lalu masuk/keluar radius arena.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {events.slice(0, 6).map((event) => {
            const entering = event.type === 'enter';
            const color = entering ? Colors.accent : Colors.danger;
            return (
              <View
                key={event.id}
                accessible
                accessibilityLabel={`${entering ? 'Masuk' : 'Keluar'} arena, ${formatEventTime(
                  event.occurredAt,
                )}, ${event.source === 'background' ? 'latar belakang' : 'aplikasi terbuka'}`}
                style={styles.row}>
                <View
                  style={[
                    styles.eventIcon,
                    { backgroundColor: entering ? Soft.accentSoft : Soft.dangerSoft },
                  ]}>
                  <MaterialIcons
                    name={entering ? 'login' : 'logout'}
                    size={16}
                    color={color}
                  />
                </View>
                <View style={styles.eventText}>
                  <Text style={[styles.eventTitle, { color }]}>
                    {entering ? 'Masuk arena' : 'Keluar arena'}
                  </Text>
                  <Text style={styles.eventMeta}>
                    {formatEventTime(event.occurredAt)} •{' '}
                    {event.source === 'background' ? 'Latar belakang' : 'Aplikasi terbuka'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
      {events.some((event) => event.source === 'background') ? (
        <Text style={styles.footnote}>
          Event latar belakang tercatat oleh sistem dan muncul saat aplikasi dibuka kembali.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: Colors.ink, fontFamily: FontFamily.bodySemi, fontSize: 15 },
  countPill: {
    backgroundColor: Colors.raised,
    borderRadius: Radius.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  countText: { color: Colors.muted, fontFamily: FontFamily.bodyMedium, fontSize: 11 },
  empty: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: Colors.raised,
    borderRadius: Radius.md,
    padding: 12,
  },
  emptyText: {
    flex: 1,
    color: Colors.muted,
    fontFamily: FontFamily.body,
    fontSize: 12,
    lineHeight: 18,
  },
  list: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52 },
  eventIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventText: { flex: 1, gap: 2 },
  eventTitle: { fontFamily: FontFamily.bodySemi, fontSize: 13 },
  eventMeta: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 11 },
  footnote: {
    color: Colors.muted,
    fontFamily: FontFamily.body,
    fontSize: 10,
    lineHeight: 15,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
  },
});
