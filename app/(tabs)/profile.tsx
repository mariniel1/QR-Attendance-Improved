
import { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Alert,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';

import { COLORS } from '@/constants/colors';
import { useAuth, signOut } from '@/lib/auth';
import {
  getProfile,
  type Profile,
  updateProfile,
} from '@/lib/profiles';

export default function ProfileScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [draftName, setDraftName] = useState('');
  const [editing, setEditing] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const loadProfile = useCallback(async (isRefresh = false) => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await getProfile(user.id);

      setProfile(data);

      if (!editing) {
        setDraftName(data?.full_name ?? '');
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Something went wrong while loading your profile.';

      Alert.alert('Unable to Load Profile', errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, editing]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile])
  );

  const handleRefresh = () => {
    void loadProfile(true);
  };

  const handleStartEditing = () => {
    setDraftName(profile?.full_name ?? '');
    setEditing(true);
  };

  const handleCancelEdit = () => {
    Keyboard.dismiss();
    setDraftName(profile?.full_name ?? '');
    setEditing(false);
  };

  const handleSaveName = async () => {
    if (!user || saving) return;

    const trimmedName = draftName.trim();

    if (!trimmedName) {
      Alert.alert('Invalid Name', 'Please enter your full name.');
      return;
    }

    if (trimmedName.length < 2) {
      Alert.alert(
        'Name Too Short',
        'Your name must contain at least 2 characters.'
      );
      return;
    }

    if (trimmedName.length > 80) {
      Alert.alert(
        'Name Too Long',
        'Your name must not exceed 80 characters.'
      );
      return;
    }

    if (trimmedName === (profile?.full_name ?? '').trim()) {
      setEditing(false);
      Keyboard.dismiss();
      return;
    }

    setSaving(true);

    try {
      const { error } = await updateProfile(user.id, {
        full_name: trimmedName,
      });

      if (error) {
        Alert.alert('Update Failed', error);
        return;
      }

      setProfile((previous) =>
        previous
          ? { ...previous, full_name: trimmedName }
          : previous
      );

      setDraftName(trimmedName);
      setEditing(false);
      Keyboard.dismiss();

      Alert.alert('Success', 'Your name has been updated.');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to update your name. Please try again.';

      Alert.alert('Update Failed', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    if (signingOut) return;

    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of your account?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            if (signingOut) return;

            setSigningOut(true);

            try {
              await signOut();
              router.replace('/login');
            } catch (error: unknown) {
              const errorMessage =
                error instanceof Error
                  ? error.message
                  : 'Failed to sign out. Please try again.';

              Alert.alert('Sign Out Failed', errorMessage);
            } finally {
              setSigningOut(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingIcon}>
          <Ionicons
            name="person-circle-outline"
            size={42}
            color={COLORS.primary}
          />
        </View>

        <ActivityIndicator
          size="large"
          color={COLORS.primary}
          style={styles.loadingSpinner}
        />

        <Text style={styles.loadingText}>
          Loading your profile...
        </Text>
      </View>
    );
  }

  const fullName = profile?.full_name?.trim() || 'User';
  const email = profile?.email || user?.email || 'No email available';
  const role = profile?.role === 'teacher' ? 'teacher' : 'student';
  const userId = profile?.id || user?.id || 'Not available';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={COLORS.primary}
          colors={[COLORS.primary]}
        />
      }
    >
      {/* Page Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My Profile</Text>
          <Text style={styles.subtitle}>
            Manage your account information
          </Text>
        </View>

        <Pressable
          onPress={handleRefresh}
          disabled={refreshing}
          accessibilityRole="button"
          accessibilityLabel="Refresh profile"
          style={styles.refreshButton}
        >
          {refreshing ? (
            <ActivityIndicator
              size="small"
              color={COLORS.primary}
            />
          ) : (
            <Ionicons
              name="refresh-outline"
              size={22}
              color={COLORS.primary}
            />
          )}
        </Pressable>
      </View>

      {/* Profile Overview */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Ionicons
            name="person"
            size={38}
            color="#FFFFFF"
          />
        </View>

        <View style={styles.profileHeaderInfo}>
          <Text
            style={styles.profileName}
            numberOfLines={2}
          >
            {fullName}
          </Text>

          <Text
            style={styles.profileEmail}
            numberOfLines={2}
          >
            {email}
          </Text>

          <View
            style={[
              styles.roleBadge,
              role === 'teacher'
                ? styles.teacherBadge
                : styles.studentBadge,
            ]}
          >
            <Ionicons
              name={
                role === 'teacher'
                  ? 'school-outline'
                  : 'person-outline'
              }
              size={14}
              color="#FFFFFF"
            />

            <Text style={styles.roleBadgeText}>
              {role === 'teacher' ? 'Teacher Account' : 'Student Account'}
            </Text>
          </View>
        </View>
      </View>

      {/* Personal Information */}
      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>
            Personal Information
          </Text>

          <Text style={styles.sectionCaption}>
            Your account details
          </Text>
        </View>

        <View style={styles.infoCard}>
          {/* Full Name */}
          <View style={styles.infoItem}>
            <View style={styles.iconBox}>
              <Ionicons
                name="person-outline"
                size={21}
                color={COLORS.primary}
              />
            </View>

            <View style={styles.infoContent}>
              <Text style={styles.label}>Full Name</Text>

              {editing ? (
                <TextInput
                  value={draftName}
                  onChangeText={setDraftName}
                  placeholder="Enter your full name"
                  placeholderTextColor={COLORS.textSecondary}
                  style={styles.textInput}
                  autoFocus
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={80}
                  editable={!saving}
                  returnKeyType="done"
                  onSubmitEditing={handleSaveName}
                />
              ) : (
                <Text style={styles.value}>
                  {fullName}
                </Text>
              )}

              {editing && (
                <Text style={styles.characterCount}>
                  {draftName.length}/80 characters
                </Text>
              )}
            </View>

            {!editing && (
              <Pressable
                onPress={handleStartEditing}
                style={styles.editButton}
                accessibilityRole="button"
                accessibilityLabel="Edit full name"
              >
                <Ionicons
                  name="create-outline"
                  size={20}
                  color={COLORS.primary}
                />
              </Pressable>
            )}
          </View>

          {/* Edit Actions */}
          {editing && (
            <View style={styles.editActions}>
              <Pressable
                onPress={handleCancelEdit}
                disabled={saving}
                style={[
                  styles.cancelButton,
                  saving && styles.disabledButton,
                ]}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={handleSaveName}
                disabled={saving}
                style={[
                  styles.saveButton,
                  saving && styles.disabledButton,
                ]}
              >
                {saving ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={18}
                      color="#FFFFFF"
                    />
                    <Text style={styles.saveText}>Save Changes</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          <View style={styles.divider} />

          {/* Email */}
          <InfoRow
            icon="mail-outline"
            label="Email Address"
            value={email}
          />

          <View style={styles.divider} />

          {/* User ID */}
          <InfoRow
            icon="finger-print-outline"
            label="User ID"
            value={userId}
            small
          />
        </View>
      </View>

      {/* Account Information */}
      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>
            Account Information
          </Text>
          <Text style={styles.sectionCaption}>
            Your access and account type
          </Text>
        </View>

        <View style={styles.accountCard}>
          <View style={styles.accountIcon}>
            <Ionicons
              name="shield-checkmark-outline"
              size={23}
              color={COLORS.primary}
            />
          </View>

          <View style={styles.accountInfo}>
            <Text style={styles.accountTitle}>
              Account Role
            </Text>

            <Text style={styles.accountDescription}>
              {role === 'teacher'
                ? 'Your account is registered with the teacher role.'
                : 'Your account is registered with the student role.'}
            </Text>
          </View>

          <Ionicons
            name="checkmark-circle"
            size={21}
            color={COLORS.success}
          />
        </View>

        <View style={styles.accountCard}>
          <View style={styles.accountIcon}>
            <Ionicons
              name="lock-closed-outline"
              size={23}
              color={COLORS.primary}
            />
          </View>

          <View style={styles.accountInfo}>
            <Text style={styles.accountTitle}>
              Account Security
            </Text>

            <Text style={styles.accountDescription}>
              Keep your login credentials private and sign out when using a
              shared device.
            </Text>
          </View>
        </View>
      </View>

      {/* Sign Out */}
      <View style={styles.logoutSection}>
        <Text style={styles.sectionTitle}>
          Account Actions
        </Text>

        <Pressable
          onPress={handleSignOut}
          disabled={signingOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out of your account"
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.buttonPressed,
            signingOut && styles.disabledButton,
          ]}
        >
          {signingOut ? (
            <ActivityIndicator
              size="small"
              color="#FFFFFF"
            />
          ) : (
            <>
              <Ionicons
                name="log-out-outline"
                size={22}
                color="#FFFFFF"
              />

              <Text style={styles.logoutText}>
                Sign Out
              </Text>

              <View style={styles.logoutSpacer} />

              <Ionicons
                name="chevron-forward-outline"
                size={19}
                color="#FFFFFF"
              />
            </>
          )}
        </Pressable>

        <Text style={styles.logoutHint}>
          You will need to sign in again to access your account.
        </Text>
      </View>

      <View style={styles.footer}>
        <Ionicons
          name="heart-outline"
          size={14}
          color={COLORS.textSecondary}
        />
        <Text style={styles.footerText}>
          QR Attendance App
        </Text>
      </View>
    </ScrollView>
  );
}

type InfoRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  small?: boolean;
};

function InfoRow({
  icon,
  label,
  value,
  small = false,
}: InfoRowProps) {
  return (
    <View style={styles.infoItem}>
      <View style={styles.iconBox}>
        <Ionicons
          name={icon}
          size={21}
          color={COLORS.primary}
        />
      </View>

      <View style={styles.infoContent}>
        <Text style={styles.label}>{label}</Text>

        <Text
          selectable
          style={[styles.value, small && styles.userId]}
        >
          {value}
        </Text>

        {small && (
          <Text style={styles.inputHint}>
            You can select this text to copy your ID.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 24,
  },

  loadingIcon: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingSpinner: {
    marginTop: 18,
  },

  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },

  title: {
    fontSize: 27,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },

  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 5,
  },

  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  profileCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  avatar: {
    width: 70,
    height: 70,
    borderRadius: 23,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },

  profileHeaderInfo: {
    flex: 1,
  },

  profileName: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },

  profileEmail: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 10,
  },

  roleBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
  },

  teacherBadge: {
    backgroundColor: '#4A78B8',
  },

  studentBadge: {
    backgroundColor: '#27845F',
  },

  roleBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  section: {
    marginBottom: 24,
  },

  sectionHeading: {
    marginBottom: 11,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },

  sectionCaption: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 17,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },

  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  infoContent: {
    flex: 1,
    minWidth: 0,
  },

  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 5,
  },

  value: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },

  userId: {
    fontSize: 11,
    lineHeight: 17,
  },

  inputHint: {
    marginTop: 5,
    fontSize: 11,
    lineHeight: 15,
    color: COLORS.textSecondary,
  },

  characterCount: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 5,
    textAlign: 'right',
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
  },

  editButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  textInput: {
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },

  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 9,
    paddingBottom: 14,
  },

  cancelButton: {
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cancelText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 12,
  },

  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    minWidth: 120,
  },

  saveText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },

  disabledButton: {
    opacity: 0.6,
  },

  accountCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  accountIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  accountInfo: {
    flex: 1,
    marginRight: 8,
  },

  accountTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },

  accountDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },

  logoutSection: {
    marginTop: 2,
  },

  logoutButton: {
    minHeight: 53,
    borderRadius: 14,
    backgroundColor: COLORS.danger,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 17,
    marginTop: 12,
  },

  logoutText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  logoutSpacer: {
    flex: 1,
  },

  buttonPressed: {
    opacity: 0.78,
  },

  logoutHint: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 9,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 27,
  },

  footerText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
});
