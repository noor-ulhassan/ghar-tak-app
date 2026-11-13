import { useState, useEffect, useCallback } from "react";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, hasFirebaseConfig } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ASYNC_STORAGE_KEY = "ghar_tak_guest_favourites";

// Favourites saved on the device are shared by every screen using this hook, so a
// heart tapped on a store page shows on the Stores tab and the Favorites screen too
// (and one screen's stale copy can't overwrite another's change).
let localFavourites: Set<string> | null = null;
let localLoad: Promise<Set<string>> | null = null;
const localListeners = new Set<(ids: Set<string>) => void>();

function loadLocalFavourites(): Promise<Set<string>> {
  if (localFavourites) return Promise.resolve(localFavourites);
  if (!localLoad) {
    localLoad = (async () => {
      let ids = new Set<string>();
      try {
        const raw = await AsyncStorage.getItem(ASYNC_STORAGE_KEY);
        if (raw) ids = new Set(JSON.parse(raw) as string[]);
      } catch { /* ignore */ }
      // A toggle made while this was loading wins.
      localFavourites ??= ids;
      return localFavourites;
    })();
  }
  return localLoad;
}

function setLocalFavourites(ids: Set<string>) {
  localFavourites = ids;
  localListeners.forEach((listener) => listener(ids));
  AsyncStorage.setItem(ASYNC_STORAGE_KEY, JSON.stringify([...ids])).catch(() => { /* ignore */ });
}

function subscribeLocal(listener: (ids: Set<string>) => void) {
  localListeners.add(listener);
  loadLocalFavourites().then((ids) => {
    if (localListeners.has(listener)) listener(ids);
  });
  return () => {
    localListeners.delete(listener);
  };
}

export function useFavorites() {
  const { user, isGuest } = useAuth();
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      setFavouriteIds(new Set());
      return;
    }

    if (isGuest || !hasFirebaseConfig || !db) {
      return subscribeLocal(setFavouriteIds);
    }

    let unsubscribeLocal: (() => void) | null = null;
    const favRef = collection(db, "users", user.uid, "favourites");
    const unsubscribe = onSnapshot(
      favRef,
      (snapshot) => {
        const ids = new Set<string>();
        snapshot.forEach((d) => ids.add(d.id));
        setFavouriteIds(ids);
      },
      () => {
        unsubscribeLocal ??= subscribeLocal(setFavouriteIds);
      }
    );

    return () => {
      unsubscribe();
      unsubscribeLocal?.();
    };
  }, [user, isGuest]);

  const toggleFavourite = useCallback(
    async (storeId: string) => {
      if (!user) return;

      if (isGuest || !hasFirebaseConfig || !db) {
        const current = await loadLocalFavourites();
        const next = new Set(current);
        if (next.has(storeId)) next.delete(storeId);
        else next.add(storeId);
        setLocalFavourites(next);
        return;
      }

      const isFav = favouriteIds.has(storeId);
      const docRef = doc(db, "users", user.uid, "favourites", storeId);
      try {
        if (isFav) {
          await deleteDoc(docRef);
        } else {
          await setDoc(docRef, { storeId, addedAt: serverTimestamp() });
        }
      } catch (err) {
        console.error("Failed to toggle favourite:", err);
      }
    },
    [user, isGuest, favouriteIds]
  );

  return { favouriteIds, toggleFavourite };
}
