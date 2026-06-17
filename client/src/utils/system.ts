const STATUS_COLOR_MAP: Record<string, string> = {
  healthy: 'text-green-600 bg-green-50',
  degraded: 'text-yellow-600 bg-yellow-50',
  error: 'text-red-600 bg-red-50',
};

export function getStatusColor(status: string): string {
  return STATUS_COLOR_MAP[status] ?? 'text-gray-600 bg-gray-50';
}

export function formatBuildDate(buildDate: string): string {
  return buildDate.split('T')[0];
}