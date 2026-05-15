const ACTIVE_USER_STORAGE_KEY = 'liev:active-user-id';
const LEGACY_OWNER_STORAGE_KEY = 'liev:legacy-local-owner-user-id';

let activeLocalUserId: string | null = null;

function safeRead(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWrite(key: string, value: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (value) {
      window.localStorage.setItem(key, value);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // storage unavailable
  }
}

export function setActiveLocalUserId(userId: string | null): void {
  activeLocalUserId = userId;
  safeWrite(ACTIVE_USER_STORAGE_KEY, userId);
}

export function getActiveLocalUserId(): string | null {
  if (activeLocalUserId) return activeLocalUserId;
  const stored = safeRead(ACTIVE_USER_STORAGE_KEY);
  if (stored) activeLocalUserId = stored;
  return stored;
}

export function getLegacyLocalOwnerUserId(): string | null {
  return safeRead(LEGACY_OWNER_STORAGE_KEY);
}

export function setLegacyLocalOwnerUserId(userId: string | null): void {
  safeWrite(LEGACY_OWNER_STORAGE_KEY, userId);
}

export function resolveOwnerUserId(ownerUserId?: string | null): string | null {
  return ownerUserId ?? getActiveLocalUserId();
}

export function recordBelongsToUser(ownerUserId: string | null | undefined, userId: string | null): boolean {
  if (!userId) return false;
  if (ownerUserId) return ownerUserId === userId;
  return getLegacyLocalOwnerUserId() === userId;
}

export function recordBelongsToActiveUser(ownerUserId: string | null | undefined): boolean {
  return recordBelongsToUser(ownerUserId, getActiveLocalUserId());
}
