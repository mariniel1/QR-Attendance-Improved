import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { signIn } from '@/lib/auth';
import { getProfile } from '@/lib/profiles';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  

const handleLogin = async () => {
  setError(null);
  setLoading(true);

  try {
    console.log('[LOGIN STEP 1] Starting sign in');

    const { data, error: authError } = await signIn(
      email.trim(),
      password
    );

    console.log('[LOGIN STEP 2] Authentication result', {
      hasSession: !!data.session,
      userId: data.user?.id,
      error: authError?.message,
    });

    if (authError) {
      setError(authError.message);
      return;
    }

    const userId = data.session?.user?.id ?? data.user?.id;

    if (!userId) {
      setError('No user session was returned. Please try signing in again.');
      return;
    }

    console.log('[LOGIN STEP 3] Loading profile for', userId);

    const profile = await Promise.race([
      getProfile(userId),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('Profile loading timed out. Please try again.')),
          10000
        );
      }),
    ]);

    console.log('[LOGIN STEP 4] Profile result', profile);

    if (!profile) {
      setError(
        'Your profile could not be found. Please contact the system administrator.'
      );
      return;
    }

    console.log('[LOGIN STEP 5] Navigating with role', profile.role);

    if (profile.role === 'admin') {
      router.replace('/admin');
    } else {
      router.replace('/(tabs)');
    }
  } catch (err: unknown) {
    console.error('[LOGIN ERROR]', err);

    setError(
      err instanceof Error ? err.message : 'Unexpected error'
    );
  } finally {
    setLoading(false);
  }
};


  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerContainer}>
              <Header title="QR Attendance" />
            </View>

            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to record your attendance</Text>

            <View style={styles.form}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your.email@school.edu"
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={COLORS.textSecondary}
                secureTextEntry
                editable={!loading}
              />

              {error && <Text style={styles.error}>{error}</Text>}

              {loading ? (
                <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
              ) : (
                <AppButton
                  theme="primary"
                  title="Sign In"
                  icon="log-in-outline"
                  onPress={handleLogin}
                />
              )}
            </View>

            <Link href="/register" style={styles.link}>
              Don't have an account? Sign Up
            </Link>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  headerContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  form: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,

  },
  input: {
    backgroundColor: COLORS.card,   
    borderColor: COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
 
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 12,

  },
  error: {
    fontSize: 14,
    color: '#C62828',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  loader: {
    marginVertical: 16,
  },
  link: {
    fontSize: 14,
    color: COLORS.primary,
    textAlign: 'center',
    fontWeight: '600',
  },
});
