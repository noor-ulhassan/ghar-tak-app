import { useCallback, useSyncExternalStore } from 'react';
import { useUser } from '@clerk/react';

const KEY_PREFIX = 'ghar_tak_favourites';

function storageKey(userId: string | null | undefined) {
  return userId ? `${KEY_PREFIX}_${userId}` : `${KEY_PREFIX}_guest`;
}

function loadFavourites(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch { /* ignore */ }
  return new Set();
}

function saveFavourites(key: string, ids: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

// One shared copy per list: every heart on the page reads and writes the same set,
// so favouriting a second store can't overwrite the first.
const lists = new Map<string, Set<string>>();
const listeners = new Set<() => void>();

function readList(key: string): Set<string> {
  let ids = lists.get(key);
  if (!ids) {
    ids = loadFavourites(key);
    lists.set(key, ids);
  }
  return ids;
}

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Another browser tab changed the favourites: drop our copies and re-read.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === null || event.key.startsWith(KEY_PREFIX)) {
      lists.clear();
      notify();
    }
  });
}

export function useFavorites() {
  const { user } = useUser();
  const key = storageKey(user?.id);
  const favouriteIds = useSyncExternalStore(subscribe, () => readList(key));

  const toggleFavourite = useCallback(
    (providerId: string) => {
      const next = new Set(readList(key));
      if (next.has(providerId)) next.delete(providerId);
      else next.add(providerId);
      lists.set(key, next);
      saveFavourites(key, next);
      notify();
    },
    [key],
  );

  return { favouriteIds, toggleFavourite };
}
