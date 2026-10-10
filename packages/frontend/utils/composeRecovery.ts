import { Platform } from 'react-native';

const STORAGE_PREFIX = 'inbox-compose-recovery-v1:';
const MAX_RECOVERY_BODY_LENGTH = 250_000;

export interface ComposeRecoveryAttachment {
  fileId: string;
  /** What the chip shows. Older snapshots carry only the id. */
  name?: string;
  contentType?: string;
  size?: number;
}

export interface ComposeRecoverySnapshot {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  attachments?: ComposeRecoveryAttachment[];
  /** Row id of the message being replied to (a UI lookup key, not a header). */
  replyTo?: string;
  /**
   * The compose session's send key. Restored with the snapshot so a re-send
   * after a crash, a timeout or a queued send is the SAME message to the API.
   */
  idempotencyKey?: string;
  /** The API accepted this message into its delivery queue. */
  queued?: boolean;
}

export interface ComposeRecoveryRecord {
  snapshot: ComposeRecoverySnapshot;
  savedAt: number;
}

export function composeRecoveryStorageKey(
  scope: string | null | undefined,
  identity: string,
): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(scope ?? 'anonymous')}:${encodeURIComponent(identity)}`;
}

function storageKeyForCurrentPlatform(key: string): Storage | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  return window.localStorage;
}

function normalizeSnapshot(value: unknown): ComposeRecoverySnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const textFields = ['to', 'cc', 'bcc', 'subject', 'body'] as const;
  if (textFields.some((field) => typeof candidate[field] !== 'string')) return null;

  const body = candidate.body as string;
  if (body.length > MAX_RECOVERY_BODY_LENGTH) return null;

  const attachments: ComposeRecoveryAttachment[] = Array.isArray(candidate.attachments)
    ? candidate.attachments.flatMap((attachment: unknown) => {
        if (!attachment || typeof attachment !== 'object') return [];
        const { fileId, name, contentType, size } = attachment as Record<string, unknown>;
        if (typeof fileId !== 'string') return [];
        return [{
          fileId,
          ...(typeof name === 'string' ? { name } : {}),
          ...(typeof contentType === 'string' ? { contentType } : {}),
          ...(typeof size === 'number' && Number.isFinite(size) ? { size } : {}),
        }];
      })
    : [];

  return {
    to: candidate.to as string,
    cc: candidate.cc as string,
    bcc: candidate.bcc as string,
    subject: candidate.subject as string,
    body,
    attachments,
    ...(typeof candidate.replyTo === 'string' ? { replyTo: candidate.replyTo } : {}),
    ...(typeof candidate.idempotencyKey === 'string' ? { idempotencyKey: candidate.idempotencyKey } : {}),
    ...(candidate.queued === true ? { queued: true } : {}),
  };
}

function normalizeRecord(value: unknown): ComposeRecoveryRecord | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const snapshot = normalizeSnapshot(candidate.snapshot);
  if (!snapshot || typeof candidate.savedAt !== 'number' || !Number.isFinite(candidate.savedAt)) {
    return null;
  }
  return { snapshot, savedAt: candidate.savedAt };
}

async function readNativeStorage(key: string): Promise<string | null> {
  const AsyncStorage = await import('@react-native-async-storage/async-storage').then((module) => module.default);
  return AsyncStorage.getItem(key);
}

async function writeNativeStorage(key: string, value: string): Promise<void> {
  const AsyncStorage = await import('@react-native-async-storage/async-storage').then((module) => module.default);
  await AsyncStorage.setItem(key, value);
}

async function removeNativeStorage(key: string): Promise<void> {
  const AsyncStorage = await import('@react-native-async-storage/async-storage').then((module) => module.default);
  await AsyncStorage.removeItem(key);
}

export async function loadComposeRecovery(key: string): Promise<ComposeRecoveryRecord | null> {
  try {
    const storage = storageKeyForCurrentPlatform(key);
    const raw = storage ? storage.getItem(key) : await readNativeStorage(key);
    if (!raw) return null;
    return normalizeRecord(JSON.parse(raw));
  } catch (error: unknown) {
    return null;
  }
}

export async function saveComposeRecovery(
  key: string,
  snapshot: ComposeRecoverySnapshot,
): Promise<void> {
  const normalized = normalizeSnapshot(snapshot);
  if (!normalized) return;
  const value = JSON.stringify({ snapshot: normalized, savedAt: Date.now() });

  try {
    const storage = storageKeyForCurrentPlatform(key);
    if (storage) {
      storage.setItem(key, value);
      return;
    }
    await writeNativeStorage(key, value);
  } catch (error: unknown) {
    // Local recovery is best-effort and must never block composing or sending.
  }
}

export async function clearComposeRecovery(key: string): Promise<void> {
  try {
    const storage = storageKeyForCurrentPlatform(key);
    if (storage) {
      storage.removeItem(key);
      return;
    }
    await removeNativeStorage(key);
  } catch (error: unknown) {
    // A failed cleanup is harmless; the next compose session replaces it.
  }
}
