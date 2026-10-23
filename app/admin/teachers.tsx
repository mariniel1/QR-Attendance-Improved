
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';

type Teacher = {
  id: string;
  email: string;
  full_name: string | null;
};

export default function TeacherManagementScreen() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadTeachers() {
      if (authLoading) return;

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

        const { data, error: queryError } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .eq('role', 'teacher')
          .order('full_name', { ascending: true });

        if (queryError) throw queryError;

        if (active) {
          setTeachers((data ?? []) as Teacher[]);
          setError(null);
        }
      } catch (err: unknown) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load teacher accounts.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadTeachers();

    return () => {
      active = false;
    };
  }, [session?.user?.id, authLoading]);

  const filteredTeachers = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return teachers;

    return teachers.filter((teacher) =>
      `${teacher.full_name ?? ''} ${teacher.email}`
        .toLowerCase()
        .includes(term)
    );
  }, [teachers, search]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('/admin')}
        >
          <Text style={styles.backText}>‹ Dashboard</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Teacher Management</Text>
        <Text style={styles.subtitle}>
          {teachers.length} teacher account
          {teachers.length === 1 ? '' : 's'}
        </Text>
      </View>

      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name or email"
        placeholderTextColor={COLORS.textSecondary}
        autoCapitalize="none"
      />

      {loading ? (
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
          style={styles.loader}
        />
      ) : error ? (
        <View style={styles.message}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity
            onPress={() => router.replace('/admin/teachers')}
          >
            <Text style={styles.retry}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredTeachers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>No teacher accounts found.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.teacherCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(item.full_name?.trim() || item.email)
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              </View>

              <View style={styles.teacherInfo}>
                <Text style={styles.teacherName}>
                  {item.full_name?.trim() || 'Unnamed teacher'}
                </Text>
                <Text style={styles.teacherEmail}>{item.email}</Text>
                <Text style={styles.teacherRole}>Teacher</Text>
              </View>
            </View>
          )}
        />
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
    marginBottom: 20,
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
  search: {
    marginHorizontal: 20,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: COLORS.card,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    fontSize: 14,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    flexGrow: 1,
  },
  teacherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 15,
    marginBottom: 10,
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E6F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.primary,
    fontWeight: '800',
    fontSize: 18,
  },
  teacherInfo: {
    flex: 1,
  },
  teacherName: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  teacherEmail: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 3,
  },
  teacherRole: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5,
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
  empty: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    padding: 28,
  },
});
