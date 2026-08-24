interface PendingClarification {
  originalMessage: string;
  expiresAt: number;
}

const TTL_MS = 5 * 60 * 1000;
const pending = new Map<string, PendingClarification>();

function key(channelId: string, userId: string): string {
  return `${channelId}:${userId}`;
}

export function getPendingClarification(channelId: string, userId: string): string | null {
  const entry = pending.get(key(channelId, userId));
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    pending.delete(key(channelId, userId));
    return null;
  }
  return entry.originalMessage;
}

export function setPendingClarification(channelId: string, userId: string, originalMessage: string): void {
  pending.set(key(channelId, userId), { originalMessage, expiresAt: Date.now() + TTL_MS });
}

export function clearPendingClarification(channelId: string, userId: string): void {
  pending.delete(key(channelId, userId));
}
