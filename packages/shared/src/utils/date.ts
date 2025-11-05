/**
 * Date formatting utilities for consistent date display across the application
 */

export type DateInput = Date | string | number;

/**
 * Validates and converts input to a Date object
 * @param date - The date to validate and convert
 * @returns A valid Date object
 * @throws Error if the date is invalid
 */
function toValidDate(date: DateInput): Date {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) {
    throw new Error('Invalid date provided');
  }
  return d;
}

/**
 * Format a date to an absolute date string
 * @param date - The date to format (Date object, ISO string, or timestamp)
 * @returns Formatted date string in format "Jan 1, 2024"
 * @throws Error if the date is invalid
 * @example
 * formatDate(new Date('2024-01-15')) // "Jan 15, 2024"
 * formatDate('2024-01-15') // "Jan 15, 2024"
 * formatDate(1705276800000) // "Jan 15, 2024"
 */
export function formatDate(date: DateInput): string {
  const d = toValidDate(date);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

/**
 * Format a date to an absolute date string with time
 * @param date - The date to format (Date object, ISO string, or timestamp)
 * @returns Formatted date string in format "Jan 1, 2024, 02:30 PM"
 * @throws Error if the date is invalid
 * @example
 * formatDateTime(new Date('2024-01-15T14:30:00')) // "Jan 15, 2024, 02:30 PM"
 * formatDateTime('2024-01-15T14:30:00') // "Jan 15, 2024, 02:30 PM"
 */
export function formatDateTime(date: DateInput): string {
  const d = toValidDate(date);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Format a date to a relative time string (short format)
 * @param date - The date to format (Date object, ISO string, or timestamp)
 * @returns Relative time string in format "2h ago", "3d ago", or "Just now"
 * @throws Error if the date is invalid
 * @example
 * formatRelativeTime(new Date(Date.now() - 7200000)) // "2h ago" (2 hours ago)
 * formatRelativeTime(new Date(Date.now() - 300000)) // "5m ago" (5 minutes ago)
 * formatRelativeTime(new Date(Date.now() - 30000)) // "Just now" (30 seconds ago)
 */
export function formatRelativeTime(date: DateInput): string {
  const d = toValidDate(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

/**
 * Format a date to a relative time string (full word format)
 * @param date - The date to format (Date object, ISO string, or timestamp)
 * @returns Relative time string in format "2 hours ago", "3 days ago", or "Just now"
 * @throws Error if the date is invalid
 * @example
 * formatRelativeTimeFull(new Date(Date.now() - 7200000)) // "2 hours ago"
 * formatRelativeTimeFull(new Date(Date.now() - 3600000)) // "1 hour ago"
 * formatRelativeTimeFull(new Date(Date.now() - 60000)) // "1 minute ago"
 */
export function formatRelativeTimeFull(date: DateInput): string {
  const d = toValidDate(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
}
