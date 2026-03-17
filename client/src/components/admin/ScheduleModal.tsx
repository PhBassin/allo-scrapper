import React, { useState, useEffect } from 'react';
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

const CRON_PRESETS = [
  { label: 'Every day at 3am', value: '0 3 * * *' },
  { label: 'Every Wednesday at 3am', value: '0 3 * * 3' },
  { label: 'Every Monday at 3am', value: '0 3 * * 1' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Every 12 hours', value: '0 */12 * * *' },
  { label: 'Weekly on Sunday', value: '0 3 * * 0' },
];

function validateCron(expression: string): string | null {
  if (!expression) {
    return 'Cron expression is required';
  }
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return 'Cron expression must have 5 parts (minute hour day month weekday)';
  }
  return null;
}

const ScheduleModal: React.FC<ScheduleModalProps> = ({ isOpen, onClose, onSave, schedule }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cronExpression, setCronExpression] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [errors, setErrors] = useState<{ name?: string; cron?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (schedule) {
      setName(schedule.name);
      setDescription(schedule.description || '');
      setCronExpression(schedule.cron_expression);
      setEnabled(schedule.enabled);
    } else {
      setName('');
      setDescription('');
      setCronExpression('0 3 * * 3');
      setEnabled(true);
    }
    setErrors({});
    setSubmitError(null);
  }, [schedule, isOpen]);

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
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cron Expression *
              </label>
              <input
                type="text"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md font-mono text-sm ${errors.cron ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="0 3 * * 3"
                disabled={isSubmitting}
              />
              {errors.cron && <p className="text-red-500 text-sm mt-1">{errors.cron}</p>}
              <div className="mt-2">
                <p className="text-xs text-gray-500 mb-1">Presets:</p>
                <div className="flex flex-wrap gap-1">
                  {CRON_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setCronExpression(preset.value)}
                      className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                      disabled={isSubmitting}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
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
