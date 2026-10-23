
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';
import { buildQRPayload } from '@/lib/qr';

type EventRow = {
  id: string;
  event_code: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
};

export default function AdminEventsScreen() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();

  const [events, setEvents] = useState<EventRow[]>([]);
  const [title, setTitle] = useState('');
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadEvents() {
      if (authLoading) return;

      if (!session?.user?.id) {
        router.replace('/login');
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const profile = await getProfile(session.user.id);

        if (!profile || profile.role !== 'admin') {
          router.replace('/(tabs)');
          return;
        }

        const { data, error: queryError } = await supabase
          .from('events')
          .select(
            'id, event_code, title, start_time, end_time, created_at'
          )
          .order('created_at', { ascending: false });

        if (queryError) throw queryError;

        if (active) {
          const loadedEvents = (data ?? []) as EventRow[];
          setEvents(loadedEvents);

          if (
            selectedCode &&
            !loadedEvents.some((event) => event.event_code === selectedCode)
          ) {
            setSelectedCode(null);
          }
        }
      } catch (err: unknown) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load events.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadEvents();

    return () => {
      active = false;
    };
  }, [session?.user?.id, authLoading, reloadKey, router]);

  async function handleCreateEvent() {
    const cleanTitle = title.trim();

    if (!cleanTitle) {
      Alert.alert('Missing event title', 'Please enter an event title.');
      return;
    }

    if (!session?.user?.id) {
      Alert.alert('Session expired', 'Please log in again.');
      router.replace('/login');
      return;
    }

    try {
      setCreating(true);

      // Generate a unique event code for the QR attendance system.
      const eventCode =
        `EVT-${Date.now().toString(36).toUpperCase()}`;

      const { data, error: insertError } = await supabase
        .from('events')
        .insert({
          event_code: eventCode,
          title: cleanTitle,
          created_by: session.user.id,
        })
        .select(
          'id, event_code, title, start_time, end_time, created_at'
        )
        .single();

      if (insertError) throw insertError;

      setTitle('');
      setSelectedCode(data.event_code);
      setReloadKey((key) => key + 1);

      Alert.alert(
        'Event created',
        `${data.title} was created successfully.`
      );
    } catch (err: unknown) {
      Alert.alert(
        'Could not create event',
        err instanceof Error ? err.message : 'Please try again.'
      );
    } finally {
      setCreating(false);
    }
  }

  function formatDate(value: string | null) {
    if (!value) return 'Not set';

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleString();
  }

  const selectedEvent = events.find(
    (event) => event.event_code === selectedCode
  );

  const qrValue = selectedEvent
    ? buildQRPayload({
        eventId: selectedEvent.event_code,
        title: selectedEvent.title,
        start: selectedEvent.start_time ?? undefined,
        end: selectedEvent.end_time ?? undefined,
      })
    : '';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          onPress={() => router.replace('/admin')}
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹ Dashboard</Text>
        </TouchableOpacity>

        <Text style={styles.title}>QR Code & Events</Text>
        <Text style={styles.subtitle}>
          Create events and display attendance QR codes.
        </Text>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Create New Event</Text>

          <Text style={styles.label}>Event Title</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. School Intramurals 2026"
            placeholderTextColor={COLORS.textSecondary}
            value={title}
            onChangeText={setTitle}
            maxLength={120}
          />

          <TouchableOpacity
            style={[
              styles.primaryButton,
              creating && styles.disabledButton,
            ]}
            onPress={handleCreateEvent}
            disabled={creating}
          >
            {creating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                + Create Event
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {selectedEvent && (
          <View style={styles.qrCard}>
            <Text style={styles.sectionTitle}>Event QR Code</Text>
            <Text style={styles.qrEventTitle}>
              {selectedEvent.title}
            </Text>
            <Text style={styles.eventCode}>
              Code: {selectedEvent.event_code}
            </Text>

            <View style={styles.qrContainer}>
              <QRCode value={qrValue} size={210} />
            </View>

            <Text style={styles.qrHint}>
              Have students scan this QR code using the attendance
              scanner in your app.
            </Text>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setSelectedCode(null)}
            >
              <Text style={styles.secondaryButtonText}>
                Hide QR Code
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>Existing Events</Text>
          <TouchableOpacity
            onPress={() => setReloadKey((key) => key + 1)}
          >
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
            style={styles.loader}
          />
        ) : error ? (
          <View style={styles.messageCard}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              onPress={() => setReloadKey((key) => key + 1)}
            >
              <Text style={styles.refreshText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : events.length === 0 ? (
          <View style={styles.messageCard}>
            <Text style={styles.emptyText}>
              No events yet. Create your first event above.
            </Text>
          </View>
        ) : (
          events.map((event) => (
            <View key={event.id} style={styles.eventCard}>
              <Text style={styles.eventTitle}>{event.title}</Text>

              <Text style={styles.eventCode}>
                Code: {event.event_code}
              </Text>

              <Text style={styles.eventDetail}>
                Starts: {formatDate(event.start_time)}
              </Text>
              <Text style={styles.eventDetail}>
                Ends: {formatDate(event.end_time)}
              </Text>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setSelectedCode(event.event_code)}
              >
                <Text style={styles.secondaryButtonText}>
                  Show QR Code
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 20,
    paddingBottom: 36,
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
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 6,
    marginBottom: 22,
  },
  formCard: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  label: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 18,
    marginBottom: 7,
  },
  input: {
    backgroundColor: COLORS.background,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  disabledButton: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  qrCard: {
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  qrEventTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
  eventCode: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 5,
  },
  qrContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginTop: 18,
  },
  qrHint: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 16,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 9,
    paddingHorizontal: 13,
    paddingVertical: 10,
    marginTop: 13,
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  refreshText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  eventCard: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  eventTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  eventDetail: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 8,
  },
  loader: {
    marginTop: 28,
  },
  messageCard: {
    padding: 18,
    backgroundColor: COLORS.card,
    borderRadius: 12,
  },
  errorText: {
    color: '#C62828',
    fontSize: 14,
    marginBottom: 12,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
});
