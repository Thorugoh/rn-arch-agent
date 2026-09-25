const DAY_MS = 86_400_000;

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** "Today", "Tomorrow", "Yesterday" or "Mar 4". */
export function formatDueDate(iso: string): string {
  const date = new Date(iso);
  const daysAway = Math.round((startOfDay(date) - startOfDay(new Date())) / DAY_MS);
  if (daysAway === 0) return 'Today';
  if (daysAway === 1) return 'Tomorrow';
  if (daysAway === -1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** "just now", "5m ago", "2h ago", "3d ago". */
export function formatTimeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}

/** An ISO date `daysFromToday` days from now, at `hour` o'clock local time. */
export function dayFromToday(daysFromToday: number, hour = 18): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}
