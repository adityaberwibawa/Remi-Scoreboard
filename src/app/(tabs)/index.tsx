import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/AppHeader';
import { EmptyState } from '../../components/EmptyState';
import { SessionCard } from '../../components/SessionCard';
import { TemplateSection } from '../../components/TemplateSection';
import { useSessionTemplates } from '../../api/useSessionTemplates';
import { Colors, Common, FontFamily, Radius } from '../../theme';
import { useStore } from '../../store';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const players = useStore((s) => s.players);
  const sessions = useStore((s) => s.sessions);
  const loadAll = useStore((s) => s.loadAll);
  const { templates, loading, error, retry } = useSessionTemplates();
  const ongoing = sessions.find((s) => s.status === 'ongoing');

  useFocusEffect(
    useCallback(() => {
      loadAll().catch(() => undefined);
    }, [loadAll]),
  );

  return (
    <View style={Common.screen}>
      <AppHeader title="PentungScore" subtitle="Pencatat skor kartu" />
      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}>
        <View style={Common.content}>
          <View style={styles.ctaGroup}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mulai Permainan Baru"
              accessibilityHint="Buat sesi baru dan pilih 2 sampai 6 pemain"
              onPress={() => router.push('/create')}
              style={styles.primaryCta}>
              <View style={styles.ctaIcon}>
                <MaterialIcons name="add-circle" size={28} color={Colors.onAccent} />
              </View>
              <View style={styles.ctaText}>
                <Text style={styles.ctaTitle}>Mulai Permainan Baru</Text>
                <Text style={styles.ctaSub}>Buat sesi baru & tambah 2–6 pemain</Text>
              </View>
              <MaterialIcons name="arrow-forward" size={22} color={Colors.onAccent} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Kelola Pemain"
              accessibilityHint="Buka daftar pemain tetap, profil, dan avatar"
              onPress={() => router.push('/(tabs)/players')}
              style={styles.secondaryCta}>
              <View style={styles.ctaIconGhost}>
                <MaterialIcons name="group" size={22} color={Colors.accent} />
              </View>
              <View style={styles.ctaText}>
                <Text style={styles.ctaTitleGhost}>Kelola Pemain</Text>
                <Text style={styles.ctaSubGhost}>Daftar pemain tetap & profil</Text>
              </View>
              <View style={styles.rosterPill}>
                <Text style={styles.rosterPillText}>
                  {players.length} pemain
                </Text>
              </View>
            </Pressable>
          </View>
          <TemplateSection
            templates={templates}
            loading={loading}
            error={error}
            onRetry={retry}
            onSelect={(t) =>
              router.push({
                pathname: '/create',
                params: {
                  title: t.title,
                  minPlayers: String(t.minPlayers),
                  targetEnabled: t.targetScoreEnabled ? '1' : '0',
                  targetScore: String(t.targetScore > 0 ? t.targetScore : 500),
                },
              })
            }
          />
          {ongoing ? (
            <View style={styles.saved}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                Game tersimpan
              </Text>
              <SessionCard session={ongoing} onOpen={() => router.push(`/game/${ongoing.id}`)} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Lihat hasil detail sesi ini"
                onPress={() => router.push(`/game/${ongoing.id}`)}
                style={styles.detailLink}>
                <Text style={styles.detailLinkText}>Lihat Hasil Detail Sesi Ini</Text>
                <MaterialIcons name="trending-flat" size={18} color={Colors.accent} />
              </Pressable>
            </View>
          ) : (
            <EmptyState
              icon="style"
              title="Belum ada game berjalan"
              description="Mulai permainan baru untuk mencatat skor ronde."
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },
  ctaGroup: { gap: 12 },
  primaryCta: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.lg,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 76,
  },
  ctaIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(5, 46, 34, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { flex: 1 },
  ctaTitle: { color: Colors.onAccent, fontFamily: FontFamily.display, fontSize: 18 },
  ctaSub: { color: Colors.onAccent, fontFamily: FontFamily.body, fontSize: 13, marginTop: 2 },
  secondaryCta: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
  },
  ctaIconGhost: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTitleGhost: { color: Colors.ink, fontFamily: FontFamily.bodySemi, fontSize: 15 },
  ctaSubGhost: { color: Colors.muted, fontFamily: FontFamily.body, fontSize: 12, marginTop: 2 },
  rosterPill: {
    backgroundColor: Colors.raised,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  rosterPillText: { color: Colors.accent, fontFamily: FontFamily.bodySemi, fontSize: 12 },
  saved: { gap: 8 },
  sectionTitle: {
    color: Colors.muted,
    fontFamily: FontFamily.bodySemi,
    fontSize: 13,
    marginLeft: 4,
  },
  detailLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.raised,
    borderRadius: Radius.md,
    minHeight: 44,
  },
  detailLinkText: { color: Colors.accent, fontFamily: FontFamily.bodySemi, fontSize: 14 },
});

