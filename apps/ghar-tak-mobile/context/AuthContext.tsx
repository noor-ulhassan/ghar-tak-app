import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { auth, hasFirebaseConfig } from "@/lib/firebase";

interface GuestUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isGuest: true;
}

export type AppUser = FirebaseUser | GuestUser;

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  firebaseReady: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  guestSignIn: () => void;
  isGuest: boolean;
}

const GUEST_USER_KEY = 'ghar_tak_guest_user';

function createGuestUser(): GuestUser {
  return {
    uid: `guest-${Date.now()}`,
    email: 'guest@ghartak.app',
    displayName: 'Guest',
    photoURL: null,
    isGuest: true,
  };
}

// AsyncStorage keeps the guest session on Android and iOS too; localStorage only exists in browsers.
// On web it stores under the same key, so guests already signed in there stay signed in.
async function loadGuestUser(): Promise<GuestUser | null> {
  try {
    const raw = await AsyncStorage.getItem(GUEST_USER_KEY);
    if (raw) return JSON.parse(raw) as GuestUser;
  } catch { /* ignore */ }
  return null;
}

function saveGuestUser(user: GuestUser | null) {
  const saved = user
    ? AsyncStorage.setItem(GUEST_USER_KEY, JSON.stringify(user))
    : AsyncStorage.removeItem(GUEST_USER_KEY);
  saved.catch(() => { /* the session still works until the app closes */ });
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: false,
  firebaseReady: false,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  guestSignIn: () => {},
  isGuest: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    (async () => {
      const guest = await loadGuestUser();
      if (cancelled) return;
      if (guest) {
        setUser(guest);
        setLoading(false);
        return;
      }
      if (!hasFirebaseConfig || !auth) {
        setLoading(false);
        return;
      }
      unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        setUser(firebaseUser);
        setLoading(false);
      });
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!hasFirebaseConfig || !auth) {
      throw new Error("Firebase is not configured. Please set EXPO_PUBLIC_FIREBASE_* environment variables.");
    }
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!hasFirebaseConfig || !auth) {
      throw new Error("Firebase is not configured. Please set EXPO_PUBLIC_FIREBASE_* environment variables.");
    }
    await createUserWithEmailAndPassword(auth, email, password);
  }, []);

  const signOut = useCallback(async () => {
    if (user && 'isGuest' in user) {
      saveGuestUser(null);
      setUser(null);
      return;
    }
    if (!hasFirebaseConfig || !auth) return;
    await firebaseSignOut(auth);
  }, [user]);

  const guestSignIn = useCallback(() => {
    const guest = createGuestUser();
    saveGuestUser(guest);
    setUser(guest);
  }, []);

  const isGuest = user !== null && 'isGuest' in user;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      firebaseReady: hasFirebaseConfig && auth !== null,
      signIn,
      signUp,
      signOut,
      guestSignIn,
      isGuest,
    }),
    [user, loading, signIn, signUp, signOut, guestSignIn, isGuest],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
