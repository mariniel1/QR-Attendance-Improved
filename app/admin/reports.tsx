
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';

type AttendanceRow = {
  id: string;
  student_id: string;
  event_id: string;
  scanned_at: string;
};

type StudentRow = {
  id: string;
  role: string;
};

type EventRow = {
  id: string;
  title: string;
  event_code: string;
};

type EventReport = {
  id: string;
  title: string;
  eventCode: string;
  attendanceCount: number;
};

export default function AdminReportsScreen() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();

  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [eventReports, setEventReports] = useState<EventReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    if (authLoading) return;

    if (!session?.user?.id) {
      router.replace('/login');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const profile = await getProfile(session.user.id);

      if (!profile || profile.role !== 'admin') {
        router.replace('/(tabs)');
        return;
      }

      const [attendanceResult, profilesResult, eventsResult] =
        await Promise.all([
          supabase
            .from('attendance')
            .select('id, student_id, event_id, scanned_at'),
          supabase
            .from('profiles')
            .select('id, role')
            .eq('role', 'student'),
          supabase
            .from('events')
            .select('id, title, event_code'),
        ]);

      if (attendanceResult.error) throw attendanceResult.error;
      if (profilesResult.error) throw profilesResult.error;
      if (eventsResult.error) throw eventsResult.error;

      const attendanceRows =
        (attendanceResult.data ?? []) as AttendanceRow[];
      const studentRows = (profilesResult.data ?? []) as StudentRow[];
      const eventRows = (eventsResult.data ?? []) as EventRow[];

      const counts = new Map<string, number>();

      for (const record of attendanceRows) {
        counts.set(
          record.event_id,
          (counts.get(record.event_id) ?? 0) + 1
        );
      }

      const reports = eventRows
        .map((event) => ({
          id: event.id,
          title: event.title,
          eventCode: event.event_code,
          attendanceCount: counts.get(event.id) ?? 0,
        }))
        .sort((a, b) => b.attendanceCount - a.attendanceCount);

      setAttendance(attendanceRows);
      setStudents(studentRows);
      setEventReports(reports);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load reports.'
      );
    } finally {
      setLoading(false);
    }
  }, [authLoading, session?.user?.id, router]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const today = new Date().toDateString();

  const todayCount = attendance.filter(
    (record) => new Date(record.scanned_at).toDateString() === today
  ).length;

  const maxAttendance = Math.max(
    1,
    ...eventReports.map((event) => event.attendanceCount)
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.replace('/admin')}
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹ Dashboard</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Reports & Analytics</Text>
        <Text style={styles.subtitle}>
          Attendance overview and event participation
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
          style={styles.loader}
        />
      ) : error ? (
        <View style={styles.message}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity onPress={() => void loadReports()}>
            <Text style={styles.retry}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Attendance Records</Text>
              <Text style={styles.statValue}>{attendance.length}</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Registered Students</Text>
              <Text style={styles.statValue}>{students.length}</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total Events</Text>
              <Text style={styles.statValue}>{eventReports.length}</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Scans Today</Text>
              <Text style={styles.statValue}>{todayCount}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Attendance by Event</Text>
            <Text style={styles.sectionSubtitle}>
              Number of attendance records for each event
            </Text>

            {eventReports.length === 0 ? (
              <Text style={styles.empty}>No events found.</Text>
            ) : (
              eventReports.map((event) => (
                <View key={event.id} style={styles.eventRow}>
                  <View style={styles.eventHeading}>
                    <View style={styles.eventInfo}>
                      <Text style={styles.eventTitle}>
                        {event.title}
                      </Text>
                      <Text style={styles.eventCode}>
                        Code: {event.eventCode}
                      </Text>
                    </View>
                    <Text style={styles.eventCount}>
                      {event.attendanceCount}
                    </Text>
                  </View>

                  <View style={styles.barBackground}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width:
                            `${(event.attendanceCount / maxAttendance) * 100}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))
            )}
          </View>

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() => void loadReports()}
          >
            <Text style={styles.refreshText}>Refresh Reports</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 18,
  },
  backText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 5,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '48%',
    flexGrow: 1,
    flexBasis: '40%',
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.card,
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  statValue: {
    color: COLORS.primary,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 8,
  },
  section: {
    marginTop: 22,
    padding: 16,
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 5,
    marginBottom: 18,
  },
  eventRow: {
    marginBottom: 20,
  },
  eventHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 9,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  eventCode: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  eventCount: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  barBackground: {
    height: 9,
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: '#E8EDF5',
  },
  barFill: {
    height: '100%',
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  empty: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: 20,
  },
  loader: {
    marginTop: 40,
  },
  message: {
    padding: 20,
  },
  error: {
    color: '#C62828',
    fontSize: 14,
  },
  retry: {
    color: COLORS.primary,
    fontWeight: '700',
    marginTop: 12,
  },
  refreshButton: {
    marginTop: 18,
    alignItems: 'center',
    padding: 14,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
  },
  refreshText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
