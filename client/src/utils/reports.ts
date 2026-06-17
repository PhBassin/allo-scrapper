import { useMemo } from 'react';

const DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function useDateFormatter() {
  return useMemo(() => DATE_FORMATTER, []);
}

export function formatDate(dateStr: string | undefined | null, formatter: Intl.DateTimeFormat): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return formatter.format(date);
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

const STATUS_COLOR_MAP: Record<string, string> = {
  success: 'bg-green-100 text-green-800 border-green-300',
  partial_success: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  failed: 'bg-red-100 text-red-800 border-red-300',
  running: 'bg-blue-100 text-blue-800 border-blue-300',
  rate_limited: 'bg-orange-100 text-orange-800 border-orange-300',
};

export function getStatusColor(status: string): string {
  return STATUS_COLOR_MAP[status] ?? 'bg-gray-100 text-gray-800 border-gray-300';
}

const STATUS_LABEL_MAP: Record<string, string> = {
  success: 'Succès',
  partial_success: 'Succès partiel',
  failed: 'Échec',
  running: 'En cours',
  rate_limited: 'Rate limité',
};

export function getStatusLabel(status: string): string {
  return STATUS_LABEL_MAP[status] ?? status;
}

export function getTriggerTypeLabel(type: 'manual' | 'cron'): string {
  return type === 'manual' ? 'Manuel' : 'Cron';
}

export function getFullTriggerTypeLabel(type: 'manual' | 'cron'): string {
  return type === 'manual' ? 'Manuel' : 'Automatique (cron)';
}

const ATTEMPT_STATUS_COLOR_MAP: Record<string, string> = {
  success: 'bg-green-100 text-green-800 border-green-300',
  failed: 'bg-red-100 text-red-800 border-red-300',
  rate_limited: 'bg-orange-100 text-orange-800 border-orange-300',
  not_attempted: 'bg-gray-100 text-gray-800 border-gray-300',
  pending: 'bg-blue-100 text-blue-800 border-blue-300',
};

export function getAttemptStatusColor(status: string): string {
  return ATTEMPT_STATUS_COLOR_MAP[status] ?? 'bg-gray-100 text-gray-800 border-gray-300';
}
