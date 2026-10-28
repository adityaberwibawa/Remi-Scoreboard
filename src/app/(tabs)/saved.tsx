import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/AppHeader';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { DataErrorBanner } from '../../components/DataErrorBanner';
import { EmptyState } from '../../components/EmptyState';
import { FilterTabs } from '../../components/FilterTabs';
import { SessionCard } from '../../components/SessionCard';
import { StatusBanner } from '../../components/StatusBanner';
import { Colors, Common, MIN_TOUCH, Radius } from '../../theme';
import { playerName, useStore } from '../../store';
import type { GameSession } from '../../types';

type Filter = 'all' | 'ongoing' | 'completed';

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const players = useStore((s) => s.players);
  const sessions = useStore((s) => s.sessions);
  const loadAll = useStore((s) => s.loadAll);
  const deleteSession = useStore((s) => s.deleteSession);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<GameSession | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadAll().catch(() => undefined);
    }, [loadAll]),
  );

  const confirmDelete = async () => {
    if (!deleting) return;
    const id = deleting.id;
    setDeleting(null);
    const error = await deleteSession(id);
    if (error) setActionError(error);
  };

  const counts = useMemo(
    () => ({
      all: sessions.length,
      ongoing: sessions.filter((s) => s.status === 'ongoing').length,
      completed: sessions.filter((s) => s.status === 'completed').length,
    }),
    [sessions],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter((s) => {
      if (filter !== 'all' && s.status !== filter) return false;
      if (!q) return true;
      if (s.title.toLowerCase().includes(q)) return true;
      return s.participants.some((p) =>
        playerName(players, p.playerId).toLowerCase().includes(q),
      );
    });
  }, [sessions, filter, query, players]);

  return (
    <View style={Common.screen}>
      <AppHeader
        title="Game Tersimpan"
        subtitle={`${counts.all} riwayat sesi permainan`}
      />
      <DataErrorBanner />
      {actionError ? (
        <StatusBanner
          tone="error"
          text={actionError}
          actionLabel="Tutup"
          onAction={() => setActionError(null)}
          style={styles.banner}
        />
      ) : null}
      <View style={styles.searchWrap}>
        <View style={Common.content}>
          <TextInput
            accessibilityRole="search"
            accessibilityLabel="Cari sesi game atau pemain"
            value={query}
            onChangeText={setQuery}
            placeholder="Cari sesi game atau pemain…"
            placeholderTextColor={Colors.muted}
            returnKeyType="search"
            style={styles.search}
          />
          <FilterTabs<Filter>
            label="Filter status sesi"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'Semua', count: counts.all },
              { value: 'completed', label: 'Selesai', count: counts.completed },
              { value: 'ongoing', label: 'Berjalan', count: counts.ongoing },
            ]}
          />
        </View>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(s) => s.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        ListEmptyComponent={
          <EmptyState
            icon="history"
            title={query ? 'Tidak ketemu' : 'Belum ada game tersimpan'}
            description={
              query
                ? 'Coba kata kunci lain.'
                : 'Mulai permainan baru dari Home untuk mencatat skor.'
            }
          />
        }
        renderItem={({ item }) => (
          <View style={Common.content}>
            <SessionCard
              session={item}
              onOpen={() => router.push(`/game/${item.id}`)}
              onDelete={() => setDeleting(item)}
            />
          </View>
        )}
      />
      <ConfirmSheet
        visible={deleting !== null}
        title="Hapus Sesi?"
        message={`${deleting?.title ?? ''} beserta semua ronde skornya akan dihapus permanen dari perangkat.`}
        confirmLabel="Hapus"
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  searchWrap: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  search: {
    minHeight: MIN_TOUCH,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    color: Colors.ink,
    fontSize: 15,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  list: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  banner: { marginHorizontal: 16, marginTop: 12 },
});
