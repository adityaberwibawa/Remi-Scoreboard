import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontFamily, Radius, Soft } from '../theme';
import { formatDateId, ranking } from '../scoring';
import { formatCoords } from '../location/geo';
import { playerName, useStore } from '../store';
import type { GameSession } from '../types';
import { RankBadge } from './RankBadge';

interface Props {
  session: GameSession;
  onOpen: () => void;
  onDelete?: () => void;
}

/** Kartu ringkasan sesi: judul, meta, badge pemenang, mini-leaderboard. */
export function SessionCard({ session, onOpen, onDelete }: Props) {
  const players = useStore((s) => s.players);
  const ranks = ranking(session);
  const activeCount = session.participants.filter((p) => p.isActive).length;
  const winner = session.winnerPlayerId
    ? players.find((p) => p.id === session.winnerPlayerId)
    : undefined;
  const lead = ranks[0] ? players.find((p) => p.id === ranks[0].playerId) : undefined;
  const statusLabel =
    session.status === 'ongoing'
      ? `Sedang berjalan, ${session.rounds.length} ronde`
      : `${session.rounds.length} ronde selesai`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${session.title}. Remi ${activeCount} pemain. ${formatDateId(session.createdAt)}. ${statusLabel}. ${
        winner ? `Pemenang ${winner.name}.` : lead ? `Pemimpin sementara ${lead.name}.` : ''
      }`}
      accessibilityHint="Ketuk untuk membuka sesi ini"
      onPress={onOpen}
      style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {session.title}
            </Text>
            <View style={styles.mode}>
              <Text style={styles.modeText}>Remi {activeCount} Pemain</Text>
            </View>
          </View>
          <View style={styles.meta}>
            <MaterialIcons name="calendar-today" size={14} color={Colors.muted} />
            <Text style={styles.metaText}>{formatDateId(session.createdAt)}</Text>
            <Text style={styles.dot}>•</Text>
            <Text style={[styles.metaText, styles.metaAccent]}>{statusLabel}</Text>
          </View>
          {session.location ? (
            <View
              accessible
              accessibilityLabel={`Lokasi sesi ${
                session.location.address ?? formatCoords(session.location)
              }`}
              style={styles.locationChip}>
              <MaterialIcons name="place" size={13} color={Colors.accent} />
              <Text style={styles.locationText} numberOfLines={1} ellipsizeMode="tail">
                {session.location.address ?? formatCoords(session.location)}
              </Text>
            </View>
          ) : null}
        </View>
        {onDelete ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Hapus ${session.title}`}
            accessibilityHint="Meminta konfirmasi sebelum menghapus"
            onPress={onDelete}
            hitSlop={8}
            style={styles.delete}>
            <MaterialIcons name="delete-outline" size={20} color={Colors.muted} />
          </Pressable>
        ) : null}
      </View>
      {winner ? (
        <View
          accessible
          accessibilityLabel={`Pemenang ${winner.name}`}
          style={styles.winner}>
          <MaterialIcons name="emoji-events" size={16} color={Colors.gold} />
          <Text style={styles.winnerText}>{winner.name} Menang</Text>
        </View>
      ) : session.status === 'ongoing' && lead ? (
        <View accessible accessibilityLabel={`Pemimpin sementara ${lead.name}`} style={styles.live}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>
            {lead.name} memimpin ({ranks[0].total})
          </Text>
        </View>
      ) : null}
      <View style={styles.board}>
        {ranks.slice(0, 4).map((entry) => (
          <View
            key={entry.playerId}
            accessible
            accessibilityLabel={`${playerName(players, entry.playerId)}, peringkat ${
              entry.rank
            }, ${entry.total} poin`}
            style={styles.cell}>
            <View style={styles.cellLeft}>
              <RankBadge rank={entry.rank} size={28} />
              <Text style={styles.cellName} numberOfLines={1}>
                {playerName(players, entry.playerId)}
              </Text>
            </View>
            <Text style={[styles.cellScore, entry.rank === 1 && styles.cellScoreFirst]}>
              {entry.total}
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 12,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  headText: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  title: { color: Colors.ink, fontFamily: FontFamily.display, fontSize: 18, flexShrink: 1 },
  mode: {
    backgroundColor: Colors.raised,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  modeText: { color: Colors.accent, fontFamily: FontFamily.bodyMedium, fontSize: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  metaText: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 13 },
  metaAccent: { color: Colors.accent },
  dot: { color: Colors.muted },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.raised,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  locationText: {
    color: Colors.muted,
    fontFamily: FontFamily.body,
    fontSize: 12,
    flexShrink: 1,
  },
  delete: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  winner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Soft.goldSoft,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  winnerText: { color: Colors.gold, fontFamily: FontFamily.bodySemi, fontSize: 13 },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Soft.accentSoft,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accent },
  liveText: { color: Colors.accent, fontFamily: FontFamily.bodySemi, fontSize: 13 },
  board: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: {
    flexGrow: 1,
    flexBasis: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.raised,
    borderRadius: Radius.md,
    padding: 10,
    gap: 8,
  },
  cellLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  cellName: { color: Colors.ink, fontFamily: FontFamily.bodyMedium, fontSize: 14, flexShrink: 1 },
  cellScore: { color: Colors.ink, fontFamily: FontFamily.display, fontSize: 18 },
  cellScoreFirst: { color: Colors.gold },
});
