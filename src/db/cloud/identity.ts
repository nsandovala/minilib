export function scopeCloudId(userId: string, localId: string): string {
  return `${userId}:${localId}`;
}

export function extractLocalId(userId: string, scopedOrLegacyId: string): string {
  const prefix = `${userId}:`;
  return scopedOrLegacyId.startsWith(prefix)
    ? scopedOrLegacyId.slice(prefix.length)
    : scopedOrLegacyId;
}
