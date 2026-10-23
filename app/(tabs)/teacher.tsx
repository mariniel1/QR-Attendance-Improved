
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { createEvent } from '@/lib/events';
import { getProfile } from '@/lib/profiles';
import { useAuth } from '@/lib/auth';
import { buildQRPayload } from '@/lib/qr';

function toLocalISO(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
  );
}

function formatDateTime(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' });

  return `${month} ${pad(date.getDate())}, ${date.getFullYear()} at ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

const QUICK_END_OPTIONS = [
  { label: '+30 min', ms: 30 * 60 * 1000 },
  { label: '+1 hour', ms: 60 * 60 * 1000 },
  { label: '+2 hours', ms: 2 * 60 * 60 * 1000 },
];

type EditTarget = 'start' | 'end';

export default function TeacherScreen() {
  const { user } = useAuth();

  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [roleLoading, setRoleLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [eventId, setEventId] = useState('');

  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(
    () => new Date(Date.now() + 60 * 60 * 1000)
  );

  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editingPart, setEditingPart] = useState<'date' | 'time'>('date');
  const [payload, setPayload] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error'>('error');
  const [creating, setCreating] = useState(false);

  const isAndroid = Platform.OS === 'android';

  // Check the user's role when this screen is focused.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (!user) {
        setRole('student');
        setRoleLoading(false);

        return () => {
          active = false;
        };
      }

      setRoleLoading(true);

      getProfile(user.id)
        .then((profile) => {
          if (!active) return;

          setRole(profile?.role === 'teacher' ? 'teacher' : 'student');
        })
        .catch((error) => {
          console.error('Failed to load profile:', error);

          if (active) {
            setRole('student');
          }
        })
        .finally(() => {
          if (active) {
            setRoleLoading(false);
          }
        });

      return () => {
        active = false;
      };
    }, [user?.id])
  );

  const showMessage = (
    text: string,
    type: 'success' | 'error' = 'error'
  ) => {
    setMessage(text);
    setMessageType(type);
  };

  const openPicker = (target: EditTarget) => {
    setMessage(null);
    setEditTarget(target);
    setEditingPart('date');
  };

  const onPickerChange = (
    event: DateTimePickerEvent,
    selected?: Date
  ) => {
    if (!editTarget) return;

    if (event.type === 'dismissed' || !selected) {
      setEditTarget(null);
      setEditingPart('date');
      return;
    }

    const current = editTarget === 'start' ? startDate : endDate;
    const next = new Date(current);

    if (isAndroid && editingPart === 'date') {
      next.setFullYear(
        selected.getFullYear(),
        selected.getMonth(),
        selected.getDate()
      );
    } else {
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    }

    if (editTarget === 'start') {
      setStartDate(next);
    } else {
      setEndDate(next);
    }

    if (isAndroid && editingPart === 'date') {
      setEditingPart('time');
    } else {
      setEditTarget(null);
      setEditingPart('date');
    }
  };

  const handleQuickEnd = (ms: number) => {
    setMessage(null);
    setEndDate(new Date(startDate.getTime() + ms));
  };

  // Generate a suggested event code.
  const generateEventCode = () => {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();

    setEventId(`EVT-${datePart}-${randomPart}`);
    setMessage(null);
  };

  // Reset the form for a new event.
  const resetForm = () => {
    setTitle('');
    setEventId('');
    setPayload(null);
    setMessage(null);
    setEditTarget(null);
    setEditingPart('date');
    setStartDate(new Date());
    setEndDate(new Date(Date.now() + 60 * 60 * 1000));
  };

  const handleCreateEvent = async () => {
    if (creating) return;

    setMessage(null);

    const eventData = {
      eventId: eventId.trim(),
      title: title.trim(),
      start: toLocalISO(startDate),
      end: toLocalISO(endDate),
    };

    if (!eventData.title || !eventData.eventId) {
      showMessage('Please enter an event title and event code.');
      return;
    }

    if (eventData.title.length < 3) {
      showMessage('The event title must contain at least 3 characters.');
      return;
    }

    if (endDate.getTime() <= startDate.getTime()) {
      showMessage('The end time must be after the start time.');
      return;
    }

    setCreating(true);

    try {
      const { error } = await createEvent(eventData);

      if (error) {
        console.error('Failed to create event:', error);
        showMessage(
          'Could not save the event. Check the event code and try again.'
        );
        return;
      }

      setPayload(buildQRPayload(eventData));
      showMessage('Event created successfully!', 'success');
    } catch (error) {
      console.error('Failed to create event:', error);
      showMessage('Something went wrong. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const durationMinutes = Math.max(
    0,
    Math.round((endDate.getTime() - startDate.getTime()) / 60000)
  );

  // Loading screen while checking account access.
  if (roleLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Checking your account...</Text>
      </View>
    );
  }

  // Prevent non-teacher accounts from using this screen.
  if (role !== 'teacher') {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.lockIcon}>
          <Ionicons
            name="lock-closed-outline"
            size={42}
            color={COLORS.primary}
          />
        </View>

        <Text style={styles.lockTitle}>Teachers Only</Text>

        <Text style={styles.lockSubtitle}>
          Only teacher accounts can create events and generate attendance QR
          codes.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons
            name="qr-code-outline"
            size={28}
            color={COLORS.primary}
          />
        </View>

        <View style={styles.headerText}>
          <Text style={styles.title}>Create Event QR</Text>
          <Text style={styles.subtitle}>
            Set up an event and generate its attendance QR code.
          </Text>
        </View>
      </View>

      {/* Event details */}
      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Ionicons
            name="clipboard-outline"
            size={20}
            color={COLORS.primary}
          />
          <Text style={styles.sectionTitle}>Event Details</Text>
        </View>

        <Text style={styles.label}>Event Title *</Text>

        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Founders Day Assembly"
          placeholderTextColor={COLORS.textSecondary}
          maxLength={80}
          returnKeyType="next"
        />

        <Text style={styles.inputHint}>Maximum 80 characters.</Text>

        <Text style={styles.label}>Event Code *</Text>

        <TextInput
          style={styles.input}
          value={eventId}
          onChangeText={setEventId}
          placeholder="e.g. EVT-2026-0002"
          placeholderTextColor={COLORS.textSecondary}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={40}
        />

        <Pressable
          style={styles.generateCodeButton}
          onPress={generateEventCode}
        >
          <Ionicons
            name="sparkles-outline"
            size={17}
            color={COLORS.primary}
          />
          <Text style={styles.generateCodeText}>Generate event code</Text>
        </Pressable>

        <Text style={styles.inputHint}>
          Make sure each event code is unique in your database.
        </Text>
      </View>

      {/* Schedule */}
      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Ionicons
            name="calendar-outline"
            size={20}
            color={COLORS.primary}
          />
          <Text style={styles.sectionTitle}>Event Schedule</Text>
        </View>

        <Text style={styles.label}>Start Date and Time</Text>

        <PickerField
          value={formatDateTime(startDate)}
          icon="play-circle-outline"
          onPress={() => openPicker('start')}
        />

        <Text style={styles.label}>End Date and Time</Text>

        <PickerField
          value={formatDateTime(endDate)}
          icon="stop-circle-outline"
          onPress={() => openPicker('end')}
        />

        <Text style={styles.inputHint}>Quickly set the event duration:</Text>

        <View style={styles.chipRow}>
          {QUICK_END_OPTIONS.map((option) => (
            <Pressable
              key={option.label}
              style={styles.chip}
              onPress={() => handleQuickEnd(option.ms)}
            >
              <Text style={styles.chipText}>{option.label}</Text>
            </Pressable>
          ))}
        </View>

        {editTarget && (
          <View style={styles.pickerContainer}>
            {isAndroid && (
              <Text style={styles.pickerHint}>
                {editingPart === 'date' ? 'Choose a date' : 'Choose a time'}
              </Text>
            )}

            <DateTimePicker
              value={editTarget === 'start' ? startDate : endDate}
              mode={isAndroid ? editingPart : 'datetime'}
              display={isAndroid ? 'default' : 'spinner'}
              onChange={onPickerChange}
            />
          </View>
        )}
      </View>

      {/* Live event summary */}
      <View style={styles.summaryCard}>
        <View style={styles.sectionHeader}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={COLORS.primary}
          />
          <Text style={styles.sectionTitle}>Event Summary</Text>
        </View>

        <Text style={styles.summaryName}>
          {title.trim() || 'Your event title will appear here'}
        </Text>

        <View style={styles.summaryRow}>
          <Ionicons
            name="key-outline"
            size={16}
            color={COLORS.textSecondary}
          />
          <Text style={styles.summaryDetail}>
            Code: {eventId.trim() || 'Not set'}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Ionicons
            name="time-outline"
            size={16}
            color={COLORS.textSecondary}
          />
          <Text style={styles.summaryDetail}>
            Duration: {durationMinutes} minutes
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Ionicons
            name="calendar-outline"
            size={16}
            color={COLORS.textSecondary}
          />
          <Text style={styles.summaryDetail}>
            Starts: {formatDateTime(startDate)}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Ionicons
            name="flag-outline"
            size={16}
            color={COLORS.textSecondary}
          />
          <Text style={styles.summaryDetail}>
            Ends: {formatDateTime(endDate)}
          </Text>
        </View>
      </View>

      {/* Status message */}
      {message && (
        <View
          style={[
            styles.messageBox,
            messageType === 'success'
              ? styles.successMessage
              : styles.errorMessage,
          ]}
        >
          <Ionicons
            name={
              messageType === 'success'
                ? 'checkmark-circle-outline'
                : 'alert-circle-outline'
            }
            size={20}
            color={
              messageType === 'success'
                ? COLORS.success
                : COLORS.danger
            }
          />
          <Text
            style={[
              styles.messageText,
              {
                color:
                  messageType === 'success'
                    ? COLORS.success
                    : COLORS.danger,
              },
            ]}
          >
            {message}
          </Text>
        </View>
      )}

      {/* Actions */}
      <AppButton
        theme="primary"
        title={creating ? 'Saving Event...' : 'Create Event & QR Code'}
        icon="qr-code-outline"
        onPress={handleCreateEvent}
      />

      {!payload && (
        <Pressable
          style={styles.resetButton}
          onPress={resetForm}
          disabled={creating}
        >
          <Ionicons
            name="refresh-outline"
            size={17}
            color={COLORS.textSecondary}
          />
          <Text style={styles.resetButtonText}>Clear Form</Text>
        </Pressable>
      )}

      {/* Generated QR code */}
      {payload && (
        <View style={styles.resultCard}>
          <View style={styles.successIcon}>
            <Ionicons
              name="checkmark-circle"
              size={30}
              color={COLORS.success}
            />
          </View>

          <Text style={styles.resultTitle}>QR Code Ready!</Text>

          <Text style={styles.resultSubtitle}>
            Your event was saved. Students can scan this code using the Scan
            tab.
          </Text>

          <View style={styles.qrBox}>
            <QRCode
              value={payload}
              size={210}
              backgroundColor="#FFFFFF"
              color="#142333"
            />
          </View>

          <Text style={styles.qrEventName}>
            {title.trim() || 'Attendance Event'}
          </Text>

          <Text style={styles.qrEventCode}>
            Event Code: {eventId.trim()}
          </Text>

          <View style={styles.payloadBox}>
            <Text style={styles.payloadLabel}>QR Payload</Text>
            <Text selectable style={styles.payloadText}>
              {payload}
            </Text>
          </View>

          <Pressable
            style={styles.newEventButton}
            onPress={resetForm}
          >
            <Ionicons
              name="add-circle-outline"
              size={19}
              color={COLORS.primary}
            />
            <Text style={styles.newEventText}>Create Another Event</Text>
          </Pressable>
        </View>
      )}

      <Text style={styles.footerText}>
        QR Attendance App · Teacher Dashboard
      </Text>
    </ScrollView>
  );
}

type PickerFieldProps = {
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

function PickerField({ value, icon, onPress }: PickerFieldProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.pickerField,
        pressed && styles.pickerFieldPressed,
      ]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={21} color={COLORS.primary} />

      <Text style={styles.pickerValue}>{value}</Text>

      <Ionicons
        name="chevron-down-outline"
        size={18}
        color={COLORS.textSecondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },
  headerIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 23,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 7,
    marginTop: 10,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  inputHint: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 6,
    lineHeight: 16,
  },
  generateCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    marginTop: 9,
  },
  generateCodeText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  pickerField: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 13,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerFieldPressed: {
    opacity: 0.75,
  },
  pickerValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginHorizontal: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  pickerContainer: {
    marginTop: 14,
    padding: 10,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
  },
  pickerHint: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 8,
  },
  summaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 7,
  },
  summaryDetail: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  successMessage: {
    backgroundColor: '#E7F5EC',
  },
  errorMessage: {
    backgroundColor: '#FCE8E6',
  },
  messageText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    marginTop: 4,
  },
  resetButtonText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  resultCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    marginTop: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  successIcon: {
    marginBottom: 5,
  },
  resultTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  resultSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 7,
    marginBottom: 16,
  },
  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
  },
  qrEventName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  qrEventCode: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 5,
  },
  payloadBox: {
    width: '100%',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  payloadLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 5,
  },
  payloadText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  newEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    marginTop: 15,
  },
  newEventText: {
    color: COLORS.primary,
    fontWeight: '800',
    fontSize: 13,
  },
  footerText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 24,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 26,
  },
  lockIcon: {
    width: 82,
    height: 82,
    borderRadius: 26,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  lockTitle: {
    fontSize: 23,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 18,
  },
  lockSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 9,
    lineHeight: 21,
  },
});
