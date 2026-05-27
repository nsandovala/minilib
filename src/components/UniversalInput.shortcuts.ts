export function shouldSubmitFromComposerKey(event: { key: string; metaKey: boolean; ctrlKey: boolean }): boolean {
  return event.key === 'Enter' && (event.metaKey || event.ctrlKey);
}
