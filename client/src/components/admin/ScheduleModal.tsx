import React, { useState, useEffect, useMemo } from 'react';
import type { ScrapeSchedule } from '../../types';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    description: string | null;
    cron_expression: string;
    enabled: boolean;
  }) => Promise<void>;
  schedule?: ScrapeSchedule | null;
}

type Frequency = 'daily' | 'weekly' | 'monthly';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: i.toString().padStart(2, '0'),
}));

const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => ({
  value: m,
  label: m.toString().padStart(2, '0'),
}));

const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1}`,
}));

function parseCronToSimple(cron: string): {
  frequency: Frequency;
  hour: number;
  minute: number;
  weekdays: number[];
  monthDay: number;
} | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [minute, hour, monthDay, , weekdays] = parts;

  // Determine frequency
  let frequency: Frequency = 'daily';
  let weekdaysArr: number[] = [];
  let monthDayNum = 1;

  if (weekdays !== '*') {
    frequency = 'weekly';
    weekdaysArr = weekdays.split(',').map((w) => parseInt(w, 10));
  } else if (monthDay !== '*') {
    frequency = 'monthly';
    monthDayNum = parseInt(monthDay, 10);
  }

  const hourNum = hour === '*' ? 0 : parseInt(hour, 10);
  const minuteNum = minute === '*' ? 0 : parseInt(minute, 10);

  return {
    frequency,
    hour: hourNum,
    minute: minuteNum,
    weekdays: weekdaysArr,
    monthDay: monthDayNum,
  };
}

function buildCron(
  frequency: Frequency,
  hour: number,
  minute: number,
  weekdays: number[],
  monthDay: number
): string {
  switch (frequency) {
    case 'daily':
      return `${minute} ${hour} * * *`;
    case 'weekly': {
      const days = weekdays.length > 0 ? weekdays.join(',') : '*';
      return `${minute} ${hour} * * ${days}`;
    }
    case 'monthly':
      return `${minute} ${hour} ${monthDay} * *`;
    default:
      return `${minute} ${hour} * * *`;
  }
}

function formatCronDescription(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;

  const [minute, hour, monthDay, , weekdays] = parts;

  const timeStr = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;

  if (weekdays !== '*') {
    const days = weekdays.split(',').map((d) => {
      const dayNum = parseInt(d, 10);
      const day = DAYS_OF_WEEK.find((x) => x.value === dayNum || x.value === (dayNum === 7 ? 0 : dayNum));
      return day?.label || d;
    });
    return `Every ${days.join(', ')} at ${timeStr}`;
  }

  if (monthDay !== '*') {
    return `Monthly on day ${monthDay} at ${timeStr}`;
  }

  return `Daily at ${timeStr}`;
}

const CRON_PRESETS = [
  { label: 'Every day at 3am', value: '0 3 * * *' },
  { label: 'Every Wednesday at 3am', value: '0 3 * * 3' },
  { label: 'Every Monday at 3am', value: '0 3 * * 1' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Every 12 hours', value: '0 */12 * * *' },
  { label: '1st of month at 3am', value: '0 3 1 * *' },
];

function validateCron(expression: string): string | null {
  if (!expression) {
    return 'Cron expression is required';
  }
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return 'Cron expression must have 5 parts';
  }
  return null;
}

const ScheduleModal: React.FC<ScheduleModalProps> = ({ isOpen, onClose, onSave, schedule }) => {
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cronExpression, setCronExpression] = useState('0 3 * * 3');
  const [enabled, setEnabled] = useState(true);
  const [errors, setErrors] = useState<{ name?: string; cron?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Simple mode state
  const [frequency, setFrequency] = useState<Frequency>('weekly');
  const [hour, setHour] = useState(3);
  const [minute, setMinute] = useState(0);
  const [weekdays, setWeekdays] = useState<number[]>([3]); // Default Wednesday
  const [monthDay, setMonthDay] = useState(1);

  // Sync simple mode to cron
  const simpleCron = useMemo(
    () => buildCron(frequency, hour, minute, weekdays, monthDay),
    [frequency, hour, minute, weekdays, monthDay]
  );

  // Sync cron to simple mode when switching to simple
  const syncFromCron = (cron: string) => {
    const parsed = parseCronToSimple(cron);
    if (parsed) {
      setFrequency(parsed.frequency);
      setHour(parsed.hour);
      setMinute(parsed.minute);
      setWeekdays(parsed.weekdays.length > 0 ? parsed.weekdays : [3]);
      setMonthDay(parsed.monthDay);
    } else {
      // Default to weekly Wednesday 3am if can't parse
      setFrequency('weekly');
      setHour(3);
      setMinute(0);
      setWeekdays([3]);
      setMonthDay(1);
    }
  };

  useEffect(() => {
    if (schedule) {
      setName(schedule.name);
      setDescription(schedule.description || '');
      setCronExpression(schedule.cron_expression);
      setEnabled(schedule.enabled);
      syncFromCron(schedule.cron_expression);
      setMode('simple');
    } else {
      setName('');
      setDescription('');
      setCronExpression('0 3 * * 3');
      setEnabled(true);
      setFrequency('weekly');
      setHour(3);
      setMinute(0);
      setWeekdays([3]);
      setMonthDay(1);
      setMode('simple');
    }
    setErrors({});
    setSubmitError(null);
  }, [schedule, isOpen]);

  // Update cron when simple mode changes
  useEffect(() => {
    if (mode === 'simple') {
      setCronExpression(simpleCron);
    }
  }, [simpleCron, mode]);

  const handlePresetClick = (cron: string) => {
    setCronExpression(cron);
    syncFromCron(cron);
    setMode('simple');
  };

  const handleCronChange = (value: string) => {
    setCronExpression(value);
    if (mode === 'simple') {
      syncFromCron(value);
    }
  };

  const toggleWeekday = (day: number) => {
    if (weekdays.includes(day)) {
      setWeekdays(weekdays.filter((d) => d !== day));
    } else {
      setWeekdays([...weekdays, day].sort());
    }
  };

  if (!isOpen) return null;

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const newErrors: { name?: string; cron?: string } = {};
    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }
    const cronError = validateCron(cronExpression);
    if (cronError) {
      newErrors.cron = cronError;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        cron_expression: cronExpression.trim(),
        enabled,
      };
      await onSave(payload);
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to save schedule');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={handleClose} />
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
          <h2 className="text-xl font-semibold mb-4">
            {schedule ? 'Edit Schedule' : 'Create Schedule'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="e.g., Weekly Wednesday Scrape"
                disabled={isSubmitting}
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Optional description"
                rows={2}
                disabled={isSubmitting}
              />
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Schedule
                </label>
                <div className="flex bg-gray-100 rounded-md p-0.5">
                  <button
                    type="button"
                    onClick={() => setMode('simple')}
                    className={`px-3 py-1 text-xs rounded ${mode === 'simple' ? 'bg-white shadow text-gray-900' : 'text-gray-600'}`}
                  >
                    Simple
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('advanced')}
                    className={`px-3 py-1 text-xs rounded ${mode === 'advanced' ? 'bg-white shadow text-gray-900' : 'text-gray-600'}`}
                  >
                    Advanced
                  </button>
                </div>
              </div>

              {mode === 'simple' ? (
                <div className="space-y-3">
                  {/* Frequency */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Frequency</label>
                    <select
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value as Frequency)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      disabled={isSubmitting}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>

                  {/* Time */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Hour</label>
                      <select
                        value={hour}
                        onChange={(e) => setHour(parseInt(e.target.value, 10))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        disabled={isSubmitting}
                      >
                        {HOURS.map((h) => (
                          <option key={h.value} value={h.value}>
                            {h.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Minute</label>
                      <select
                        value={minute}
                        onChange={(e) => setMinute(parseInt(e.target.value, 10))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        disabled={isSubmitting}
                      >
                        {MINUTES.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Weekdays */}
                  {frequency === 'weekly' && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Days</label>
                      <div className="flex flex-wrap gap-1">
                        {DAYS_OF_WEEK.map((day) => (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => toggleWeekday(day.value)}
                            className={`px-2 py-1 text-xs rounded border ${
                              weekdays.includes(day.value)
                                ? 'bg-primary text-white border-primary'
                                : 'bg-white text-gray-700 border-gray-300'
                            }`}
                            disabled={isSubmitting}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Month Day */}
                  {frequency === 'monthly' && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Day of Month</label>
                      <select
                        value={monthDay}
                        onChange={(e) => setMonthDay(parseInt(e.target.value, 10))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        disabled={isSubmitting}
                      >
                        {MONTH_DAYS.map((d) => (
                          <option key={d.value} value={d.value}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Preview */}
                  <div className="p-2 bg-gray-50 rounded-md text-xs text-gray-600">
                    <span className="font-mono">{cronExpression}</span>
                    <span className="ml-2">→ {formatCronDescription(cronExpression)}</span>
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    value={cronExpression}
                    onChange={(e) => handleCronChange(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md font-mono text-sm ${errors.cron ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="0 3 * * 3"
                    disabled={isSubmitting}
                  />
                  {errors.cron && <p className="text-red-500 text-sm mt-1">{errors.cron}</p>}
                  <p className="text-xs text-gray-500 mt-1">
                    Format: minute hour day month weekday (0-7, 0 and 7 = Sunday)
                  </p>
                </div>
              )}
            </div>

            {/* Presets */}
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-1">Quick presets:</p>
              <div className="flex flex-wrap gap-1">
                {CRON_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => handlePresetClick(preset.value)}
                    className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                    disabled={isSubmitting}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="h-4 w-4 text-primary border-gray-300 rounded"
                  disabled={isSubmitting}
                />
                <span className="ml-2 text-sm text-gray-700">Enabled</span>
              </label>
            </div>

            {submitError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{submitError}</p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-white hover:bg-yellow-500 rounded-md disabled:opacity-50"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : schedule ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ScheduleModal;
