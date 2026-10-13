import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRemoteLeaderboard } from '../../api/useRemoteLeaderboard';
import type { RemoteLeaderboardEntry } from '../../api/remoteTypes';
import { AppButton } from '../../components/AppButton';
import { AppHeader } from '../../components/AppHeader';
import { EmptyState } from '../../components/EmptyState';
import { PlayerAvatar } from '../../components/PlayerAvatar';
import { RankBadge } from '../../components/RankBadge';
import { Colors, Common, FontFamily, Radius } from '../../theme';

function toAvatar(name: string, avatarUrl?: string | null) {
  return avatarUrl
    ? { type: 'photo' as const, photoUri: avatarUrl }
    : { type: 'initials' as const, colorStyle: 'emerald' as const };
}

function Row({ item }: { item: RemoteLeaderboardEntry }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`Peringkat ${item.rank}, ${item.name}, ${item.totalScore} poin`}>
      <RankBadge rank={item.rank} />
      <PlayerAvatar name={item.name} avatar={toAvatar(item.name, item.avatarUrl)} size={44} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.sub}>
          {item.wins} menang • {item.gamesPlayed} main
        </Text>
      </View>
      <Text style={styles.score}>{item.totalScore}</Text>
    </View>
  );
}

export default function RemoteScreen() {
  const { data, loading, refreshing, error, refresh } = useRemoteLeaderboard();

  return (
    <View style={Common.screen}>
      <AppHeader title="Papan Peringkat" subtitle="Data dari server" />
      <View style={Common.content}>
        {loading && !refreshing ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.accent} accessibilityLabel="Memuat leaderboard" />
            <Text style={styles.muted}>Memuat data server…</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <EmptyState icon="cloud-off" title="Gagal memuat data" description={error} />
            <AppButton label="Coba lagi" onPress={refresh} hint="Muat ulang leaderboard dari server" />
          </View>
        ) : (
          <FlatList
            data={data}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <Row item={item} />}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.accent} />
            }
            ListEmptyComponent={
              <EmptyState icon="leaderboard" title="Belum ada data" description="Server belum mengembalikan leaderboard." />
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10 },
  row: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  info: { flex: 1 },
  name: { color: Colors.ink, fontFamily: FontFamily.bodySemi, fontSize: 15 },
  sub: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 12, marginTop: 2 },
  score: { color: Colors.accent, fontFamily: FontFamily.display, fontSize: 18 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  muted: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 13 },
});
