
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
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

type AttendanceRow = {
  id: string;
  student_id: string;
  event_id: string;
  scanned_at: string;
};

type StudentProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
};

type EventRow = {
  id: string;
  title: string;
  event_code: string;
};

type AttendanceItem = AttendanceRow & {
  studentName: string;
  studentEmail: string;
  eventTitle: string;
  eventCode: string;
};

type EditorMode = 'edit' | 'student' | 'event' | null;

export default function AdminAttendanceScreen() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();

  const [records, setRecords] = useState<AttendanceItem[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [editingRecord, setEditingRecord] =
    useState<AttendanceItem | null>(null);
  const [editStudentId, setEditStudentId] = useState('');
  const [editEventId, setEditEventId] = useState('');
  const [editScannedAt, setEditScannedAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAttendance() {
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

        const [attendanceResult, profilesResult, eventsResult] =
          await Promise.all([
            supabase
              .from('attendance')
              .select('id, student_id, event_id, scanned_at')
              .order('scanned_at', { ascending: false }),
            supabase
              .from('profiles')
              .select('id, email, full_name, role'),
            supabase
              .from('events')
              .select('id, title, event_code'),
          ]);

        if (attendanceResult.error) throw attendanceResult.error;
        if (profilesResult.error) throw profilesResult.error;
        if (eventsResult.error) throw eventsResult.error;

        const profileRows = (profilesResult.data ?? []) as StudentProfile[];
        const eventRows = (eventsResult.data ?? []) as EventRow[];
        const attendanceRows = (attendanceResult.data ?? []) as AttendanceRow[];

        const profileMap = new Map(
          profileRows.map((student) => [student.id, student])
        );

        const eventMap = new Map(
          eventRows.map((event) => [event.id, event])
        );

        const mappedRecords: AttendanceItem[] = attendanceRows.map(
          (record) => {
            const student = profileMap.get(record.student_id);
            const event = eventMap.get(record.event_id);

            return {
              ...record,
              studentName: student?.full_name?.trim() || 'Unknown student',
              studentEmail: student?.email || 'No email available',
              eventTitle: event?.title || 'Unknown event',
              eventCode: event?.event_code || 'N/A',
            };
          }
        );

        if (active) {
          setStudents(profileRows.filter((p) => p.role === 'student'));
          setEvents(eventRows);
          setRecords(mappedRecords);
        }
      } catch (err: unknown) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load attendance records.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadAttendance();

    return () => {
      active = false;
    };
  }, [session?.user?.id, authLoading, reloadKey]);

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return records;

    return records.filter((record) =>
      [
        record.studentName,
        record.studentEmail,
        record.eventTitle,
        record.eventCode,
      ]
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [records, search]);

  const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  // Convert a stored timestamp to a value suitable for the local editor.
  const toLocalInput = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const pad = (number: number) => String(number).padStart(2, '0');

    return (
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-` +
      `${pad(date.getDate())}T${pad(date.getHours())}:` +
      pad(date.getMinutes())
    );
  };

  const openEditor = (record: AttendanceItem) => {
    setEditingRecord(record);
    setEditStudentId(record.student_id);
    setEditEventId(record.event_id);
    setEditScannedAt(toLocalInput(record.scanned_at));
    setEditorMode('edit');
  };

  const closeEditor = () => {
    if (saving) return;
    setEditorMode(null);
    setEditingRecord(null);
  };

  const saveAttendance = async () => {
    if (!editingRecord || saving) return;

    if (!editStudentId || !editEventId || !editScannedAt.trim()) {
      Alert.alert('Missing information', 'Please complete all fields.');
      return;
    }

    // Accept a local date/time such as 2026-10-14T09:30.
    const normalizedDate = editScannedAt.trim().replace(' ', 'T');
    const parsedDate = new Date(normalizedDate);

    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalizedDate) ||
      Number.isNaN(parsedDate.getTime())
    ) {
      Alert.alert(
        'Invalid date or time',
        'Use the format YYYY-MM-DDTHH:mm, for example 2026-10-14T09:30.'
      );
      return;
    }

    // Reject normalized values that JavaScript silently rolls into
    // another date, such as an impossible day of the month.
    const pad = (number: number) => String(number).padStart(2, '0');
    const normalizedBack =
      `${parsedDate.getFullYear()}-${pad(parsedDate.getMonth() + 1)}-` +
      `${pad(parsedDate.getDate())}T${pad(parsedDate.getHours())}:` +
      pad(parsedDate.getMinutes());

    if (normalizedBack !== normalizedDate) {
      Alert.alert('Invalid date or time', 'Please enter a valid date and time.');
      return;
    }

    if (!students.some((student) => student.id === editStudentId)) {
      Alert.alert('Invalid student', 'Please select a valid student.');
      return;
    }

    if (!events.some((event) => event.id === editEventId)) {
      Alert.alert('Invalid event', 'Please select a valid event.');
      return;
    }

    // Check the unique (student_id, event_id) combination before saving.
    const { data: duplicate, error: duplicateError } = await supabase
      .from('attendance')
      .select('id')
      .eq('student_id', editStudentId)
      .eq('event_id', editEventId)
      .neq('id', editingRecord.id)
      .maybeSingle();

    if (duplicateError) {
      Alert.alert('Could not validate attendance', duplicateError.message);
      return;
    }

    if (duplicate) {
      Alert.alert(
        'Duplicate attendance',
        'This student already has an attendance record for this event.'
      );
      return;
    }

    setSaving(true);

    try {
      const { data, error: updateError } = await supabase
        .from('attendance')
        .update({
          student_id: editStudentId,
          event_id: editEventId,
          scanned_at: parsedDate.toISOString(),
        })
        .eq('id', editingRecord.id)
        .select('id, student_id, event_id, scanned_at')
        .maybeSingle();

      if (updateError) throw updateError;

      if (!data) {
        throw new Error(
          'No record was updated. Check your administrator permissions and Supabase RLS policies.'
        );
      }

      const updated = data as AttendanceRow;
      const student = students.find((p) => p.id === updated.student_id);
      const event = events.find((e) => e.id === updated.event_id);

      const updatedItem: AttendanceItem = {
        ...updated,
        studentName: student?.full_name?.trim() || 'Unknown student',
        studentEmail: student?.email || 'No email available',
        eventTitle: event?.title || 'Unknown event',
        eventCode: event?.event_code || 'N/A',
      };

      setRecords((current) =>
        current
          .map((record) =>
            record.id === updated.id ? updatedItem : record
          )
          .sort(
            (a, b) =>
              new Date(b.scanned_at).getTime() -
              new Date(a.scanned_at).getTime()
          )
      );

      setEditorMode(null);
      setEditingRecord(null);
      Alert.alert('Success', 'Attendance record updated.');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unable to update attendance.';
      Alert.alert('Update failed', message);
    } finally {
      setSaving(false);
    }
  };


const deleteAttendance = (record: AttendanceItem) => {
  const message =
    `Remove ${record.studentName}'s attendance for ` +
    `"${record.eventTitle}"? This cannot be undone.`;

  // Expo web: use the browser's confirmation dialog.
  if (Platform.OS === 'web') {
    const confirmed =
      typeof window !== 'undefined' && window.confirm(message);

    if (confirmed) {
      void confirmDelete(record);
    }

    return;
  }

  // Android and iOS: use the native confirmation dialog.
  Alert.alert('Delete attendance record?', message, [
    {
      text: 'Cancel',
      style: 'cancel',
    },
    {
      text: 'Delete',
      style: 'destructive',
      onPress: () => {
        void confirmDelete(record);
      },
    },
  ]);
};


  const confirmDelete = async (record: AttendanceItem) => {
    if (deletingId) return;

    setDeletingId(record.id);

    try {
      const { data, error: deleteError } = await supabase
        .from('attendance')
        .delete()
        .eq('id', record.id)
        .select('id');

      if (deleteError) throw deleteError;

      if (!data || data.length === 0) {
        throw new Error(
          'No record was deleted. Check your administrator permissions and Supabase RLS policies.'
        );
      }

      setRecords((current) =>
        current.filter((item) => item.id !== record.id)
      );

      Alert.alert('Success', 'Attendance record deleted.');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unable to delete attendance.';
      Alert.alert('Delete failed', message);
    } finally {
      setDeletingId(null);
    }
  };

  const selectStudent = (student: StudentProfile) => {
    setEditStudentId(student.id);
    setEditorMode('edit');
  };

  const selectEvent = (event: EventRow) => {
    setEditEventId(event.id);
    setEditorMode('edit');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.replace('/admin')}
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹ Dashboard</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Attendance Records</Text>
        <Text style={styles.subtitle}>
          {records.length} total record{records.length === 1 ? '' : 's'}
        </Text>
      </View>

      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Search student, email, or event"
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
          <TouchableOpacity onPress={() => setReloadKey((key) => key + 1)}>
            <Text style={styles.retry}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredRecords}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={() => setReloadKey((key) => key + 1)}
          ListEmptyComponent={
            <Text style={styles.empty}>No attendance records found.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.recordCard}>
              <View style={styles.recordHeader}>
                <Text style={styles.studentName}>{item.studentName}</Text>
                <Text style={styles.recordBadge}>Present</Text>
              </View>

              <Text style={styles.email}>{item.studentEmail}</Text>
              <View style={styles.divider} />

              <Text style={styles.label}>Event</Text>
              <Text style={styles.value}>{item.eventTitle}</Text>

              <Text style={styles.label}>Event Code</Text>
              <Text style={styles.value}>{item.eventCode}</Text>

              <Text style={styles.label}>Scanned At</Text>
              <Text style={styles.value}>{formatDate(item.scanned_at)}</Text>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => openEditor(item)}
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.deleteButton,
                    deletingId === item.id && styles.disabledButton,
                  ]}
                  disabled={deletingId !== null}
                  onPress={() => deleteAttendance(item)}
                >
                  {deletingId === item.id ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      <Modal
        visible={editorMode !== null}
        transparent
        animationType="slide"
        onRequestClose={closeEditor}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {editorMode === 'edit' && editingRecord ? (
              <>
                <Text style={styles.modalTitle}>Edit Attendance</Text>
                <Text style={styles.modalHint}>
                  Choose the student and event, then correct the local date/time.
                </Text>

                <Text style={styles.label}>Student</Text>
                <TouchableOpacity
                  style={styles.selector}
                  onPress={() => setEditorMode('student')}
                >
                  <Text style={styles.selectorText}>
                    {students.find((s) => s.id === editStudentId)?.full_name ||
                      students.find((s) => s.id === editStudentId)?.email ||
                      'Select student'}
                  </Text>
                  <Text style={styles.selectorArrow}>Change ›</Text>
                </TouchableOpacity>

                <Text style={styles.label}>Event</Text>
                <TouchableOpacity
                  style={styles.selector}
                  onPress={() => setEditorMode('event')}
                >
                  <Text style={styles.selectorText}>
                    {events.find((e) => e.id === editEventId)?.title ||
                      'Select event'}
                  </Text>
                  <Text style={styles.selectorArrow}>Change ›</Text>
                </TouchableOpacity>

                <Text style={styles.label}>Scanned At (local time)</Text>
                <TextInput
                  style={styles.input}
                  value={editScannedAt}
                  onChangeText={setEditScannedAt}
                  placeholder="YYYY-MM-DDTHH:mm"
                  placeholderTextColor={COLORS.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={styles.modalHint}>
                  Example: 2026-10-14T09:30
                </Text>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    disabled={saving}
                    onPress={closeEditor}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.saveButton}
                    disabled={saving}
                    onPress={() => void saveAttendance()}
                  >
                    {saving ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveText}>Save Changes</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : editorMode === 'student' ? (
              <>
                <Text style={styles.modalTitle}>Select Student</Text>
                <FlatList
                  data={students}
                  keyExtractor={(item) => item.id}
                  style={styles.pickerList}
                  ListEmptyComponent={
                    <Text style={styles.empty}>No student profiles found.</Text>
                  }
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.pickerItem}
                      onPress={() => selectStudent(item)}
                    >
                      <Text style={styles.pickerName}>
                        {item.full_name?.trim() || 'Unnamed student'}
                      </Text>
                      <Text style={styles.email}>{item.email}</Text>
                    </TouchableOpacity>
                  )}
                />
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setEditorMode('edit')}
                >
                  <Text style={styles.cancelText}>Back</Text>
                </TouchableOpacity>
              </>
            ) : editorMode === 'event' ? (
              <>
                <Text style={styles.modalTitle}>Select Event</Text>
                <FlatList
                  data={events}
                  keyExtractor={(item) => item.id}
                  style={styles.pickerList}
                  ListEmptyComponent={
                    <Text style={styles.empty}>No events found.</Text>
                  }
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.pickerItem}
                      onPress={() => selectEvent(item)}
                    >
                      <Text style={styles.pickerName}>{item.title}</Text>
                      <Text style={styles.email}>Code: {item.event_code}</Text>
                    </TouchableOpacity>
                  )}
                />
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setEditorMode('edit')}
                >
                  <Text style={styles.cancelText}>Back</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
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
  recordCard: {
    padding: 16,
    marginBottom: 12,
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  studentName: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  recordBadge: {
    color: '#176B45',
    backgroundColor: '#E2F5E9',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    fontSize: 11,
    fontWeight: '700',
  },
  email: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 5,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 8,
  },
  value: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 3,
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
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  editButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#E8F1FF',
  },
  editButtonText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  deleteButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#C62828',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalCard: {
    maxHeight: '90%',
    padding: 20,
    borderRadius: 16,
    backgroundColor: COLORS.card,
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  modalHint: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 5,
    marginBottom: 8,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: 12,
    marginTop: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
  },
  selectorText: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  selectorArrow: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  input: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: '#EEF0F4',
  },
  cancelText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  saveButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  saveText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  pickerList: {
    flexGrow: 0,
    marginTop: 10,
    maxHeight: 400,
  },
  pickerItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerName: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
});
