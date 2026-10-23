
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '@/constants/colors';
import { useAuth, signOut } from '@/lib/auth';
import { getProfile } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';

type DashboardCounts = {
  users: number;
  events: number;
  attendance: number;
};

export default function AdminScreen() {
  const router = useRouter();
  const { session } = useAuth();

  const [counts, setCounts] = useState<DashboardCounts>({
    users: 0,
    events: 0,
    attendance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      if (!session?.user?.id) {
        router.replace('/login');
        return;
      }

      try {
        const profile = await getProfile(session.user.id);

        if (!profile || profile.role !== 'admin') {
          router.replace('/(tabs)');
          return;
        }

        const [usersResult, eventsResult, attendanceResult] =
          await Promise.all([
            supabase
              .from('profiles')
              .select('*', { count: 'exact', head: true }),
            supabase
              .from('events')
              .select('*', { count: 'exact', head: true }),
            supabase
              .from('attendance')
              .select('*', { count: 'exact', head: true }),
          ]);

        if (usersResult.error) throw usersResult.error;
        if (eventsResult.error) throw eventsResult.error;
        if (attendanceResult.error) throw attendanceResult.error;

        if (active) {
          setCounts({
            users: usersResult.count ?? 0,
            events: eventsResult.count ?? 0,
            attendance: attendanceResult.count ?? 0,
          });
          setError(null);
        }
      } catch (err: unknown) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load dashboard data.'
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  const handleLogout = async () => {

const result = await signOut();

if (result?.error) {
  Alert.alert(
    'Sign out failed',
    typeof result.error === 'string'
      ? result.error
      : 'Unable to sign out. Please try again.'
  );
  return;
}

router.replace('/login');


    router.replace('/login');
  };

  const StatCard = ({
    title,
    value,
    icon,
  }: {
    title: string;
    value: number;
    icon: string;
  }) => (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>
        <Text style={styles.statIconText}>{icon}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>QR-ATT</Text>
            <Text style={styles.heading}>Admin Dashboard</Text>
            <Text style={styles.subtitle}>
              Attendance management overview
            </Text>
          </View>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Text style={styles.logoutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeTitle}>Welcome, Administrator</Text>
          <Text style={styles.welcomeText}>
            Monitor users, school events, and attendance records.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>System Overview</Text>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
            style={styles.loader}
          />
        ) : (
          <View style={styles.statsGrid}>
            <StatCard
              title="Registered Users"
              value={counts.users}
              icon="U"
            />
            <StatCard
              title="Events"
              value={counts.events}
              icon="E"
            />
            <StatCard
              title="Attendance Records"
              value={counts.attendance}
              icon="A"
            />
          </View>
        )}

        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>
              Could not load all dashboard data
            </Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => router.replace('/admin')}
            >
              <Text style={styles.retryText}>Reload dashboard</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.sectionTitle}>Admin Modules</Text>


        <TouchableOpacity
        style={styles.moduleCard}
        onPress={() => router.push('/admin/students')}
        >
        <Text style={styles.moduleTitle}>Student Management</Text>
        <Text style={styles.moduleDescription}>
            View and search student accounts.
        </Text>
        </TouchableOpacity>



        <TouchableOpacity
        style={styles.moduleCard}
        onPress={() => router.push('/admin/teachers')}
        >
        <Text style={styles.moduleTitle}>Teacher Management</Text>
        <Text style={styles.moduleDescription}>
            View and search teacher accounts.
        </Text>
        </TouchableOpacity>


        <TouchableOpacity
        style={styles.moduleCard}
        onPress={() => router.push('/admin/attendance')}
        >
        <Text style={styles.moduleTitle}>Attendance Records</Text>
        <Text style={styles.moduleDescription}>
            View and search student attendance records.
        </Text>
        </TouchableOpacity>



        <TouchableOpacity
        style={styles.moduleCard}
        onPress={() => router.push('/admin/events')}
        >
        <Text style={styles.moduleTitle}>QR Code & Events</Text>
        <Text style={styles.moduleDescription}>
            Create events and display attendance QR codes.
        </Text>
        </TouchableOpacity>


        <TouchableOpacity style={styles.moduleCard}onPress={() => router.push('/admin/reports')}>
          <Text style={styles.moduleTitle}>Reports</Text>
          <Text style={styles.moduleDescription}>
            View attendance summaries and system totals.
          </Text>
        </TouchableOpacity >

        <Text style={styles.footer}>
          QR-ATT · Administrator Panel
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    padding: 20,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  eyebrow: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 4,
  },
  heading: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  logoutButton: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  logoutText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  welcomeCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    padding: 20,
    marginBottom: 26,
  },
  welcomeTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 8,
  },
  welcomeText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 21,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
  },
  statsGrid: {
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#E6F0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statIconText: {
    color: COLORS.primary,
    fontSize: 17,
    fontWeight: '800',
  },
  statValue: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '800',
  },
  statTitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  loader: {
    marginVertical: 28,
  },
  errorCard: {
    borderWidth: 1,
    borderColor: '#E7A4A4',
    backgroundColor: '#FFF5F5',
    padding: 14,
    borderRadius: 12,
    marginBottom: 24,
  },
  errorTitle: {
    color: '#A61B1B',
    fontWeight: '800',
    marginBottom: 6,
  },
  errorText: {
    color: '#7A2525',
    fontSize: 13,
  },
  retryButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
    backgroundColor: '#A61B1B',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  moduleCard: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  moduleTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  moduleDescription: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  footer: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
  },
});
