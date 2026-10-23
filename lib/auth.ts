import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

// Shared authentication state
let globalSession: Session | null = null;
let globalLoading = true;
let initialized = false;

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function setAuth(session: Session | null) {
  globalSession = session;
  globalLoading = false;
  initialized = true;
  notify();
}

// Initialize Supabase authentication only once
if (!initialized) {
  initialized = true;

  supabase.auth.onAuthStateChange((_event, session) => {
    setAuth(session);
  });

  supabase.auth
    .getSession()
    .then(({ data, error }) => {
      if (error) {
        console.error('[AUTH INIT ERROR]', error.message);
        setAuth(null);
        return;
      }

      setAuth(data.session);
    })
    .catch((error: unknown) => {
      console.error('[AUTH INIT ERROR]', error);
      setAuth(null);
    });
}

export function useAuth(): AuthState {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener = () => {
      forceRender((value) => value + 1);
    };

    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    session: globalSession,
    user: globalSession?.user ?? null,
    loading: globalLoading,
  };
}

export type SignUpProfile = {
  full_name: string;
  role: 'student' | 'teacher';
};

export async function signUp(
  email: string,
  password: string,
  profile?: SignUpProfile
) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        full_name: profile?.full_name ?? '',
        role: profile?.role ?? 'student',
      },
    },
  });

  if (error) return { data, error };

  if (data.session?.user && profile) {
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: data.session.user.id,
        email: email.trim(),
        full_name: profile.full_name,
        role: profile.role,
      });

    if (profileError) {
      console.error(
        '[PROFILE INSERT ERROR]',
        profileError.message
      );
    }
  }

  return { data, error };
}

export async function signIn(
  email: string,
  password: string
) {
  const { data, error } =
    await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('[SIGN OUT ERROR]', error.message);
  }

  return { error: error?.message ?? null };
}
