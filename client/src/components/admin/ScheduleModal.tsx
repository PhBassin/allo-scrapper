import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { ScrapeSchedule } from '../../types/index.js';
import {
  parseCronToSimple,
  buildCron,
  formatCronDescription,
  validateCron,
  DAYS_OF_WEEK,
  HOURS,
  MINUTES,
  MONTH_DAYS,
  CRON_PRESETS,
  type Frequency,
  type CronParts,
} from '../../utils/cron.js';

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

interface SimpleScheduleState {
  frequency: Frequency;
  hour: number;
  minute: number;
  weekdays: number[];
  monthDay: number;
}

const DEFAULT_SIMPLE_STATE: SimpleScheduleState = {
  frequency: 'weekly',
  hour: 3,
  minute: 0,
  weekdays: [3],
  monthDay: 1,
};

function cronPartsToState(parts: CronParts): SimpleScheduleState {
  return {
    frequency: parts.frequency,
    hour: parts.hour,
    minute: parts.minute,
    weekdays: parts.weekdays.length > 0 ? parts.weekdays : [3],
    monthDay: parts.monthDay,
  };
}

function useSimpleSchedule(initialCron?: string) {
  const [state, setState] = useState<SimpleScheduleState>(DEFAULT_SIMPLE_STATE);

  const syncFromCron = useCallback((cron: string) => {
    const parsed = parseCronToSimple(cron);
    setState(parsed ? cronPartsToState(parsed) : DEFAULT_SIMPLE_STATE);
  }, []);

  useEffect(() => {
    if (initialCron !== undefined) syncFromCron(initialCron);
  }, [initialCron, syncFromCron]);

  const cron = useMemo(() => buildCron(state.frequency, state.hour, state.minute, state.weekdays, state.monthDay), [state]);

  return { state, setState, cron, syncFromCron };
}

const ScheduleModal: React.FC<ScheduleModalProps> = ({ isOpen, onClose, onSave, schedule }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cronExpression, setCronExpression] = useState('0 3 * * 3');
  const [enabled, setEnabled] = useState(true);
  const [errors, setErrors] = useState<{ name?: string; cron?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');

  const simple = useSimpleSchedule();

  useEffect(() => {
    if (!isOpen) return;
    if (schedule) {
      setName(schedule.name);
      setDescription(schedule.description || '');
      setCronExpression(schedule.cron_expression);
      setEnabled(schedule.enabled);
      simple.syncFromCron(schedule.cron_expression);
    } else {
      setName('');
      setDescription('');
      setCronExpression('0 3 * * 3');
      setEnabled(true);
      simple.syncFromCron('0 3 * * 3');
    }
    setErrors({});
    setSubmitError(null);
    setMode('simple');
  }, [schedule, isOpen]);

  useEffect(() => {
    if (mode === 'simple') setCronExpression(simple.cron);
  }, [simple.cron, mode]);

  const handlePresetClick = (cron: string) => {
    setCronExpression(cron);
    simple.syncFromCron(cron);
    setMode('simple');
  };

  const handleCronChange = (value: string) => {
    setCronExpression(value);
    if (mode === 'simple') simple.syncFromCron(value);
  };

  const toggleWeekday = (day: number) => {
    const current = simple.state.weekdays;
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort();
    simple.setState({ ...simple.state, weekdays: next });
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
    if (!name.trim()) newErrors.name = 'Name is required';
    const cronError = validateCron(cronExpression);
    if (cronError) newErrors.cron = cronError;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        cron_expression: cronExpression.trim(),
        enabled,
      });
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
            <NameField value={name} error={errors.name} disabled={isSubmitting} onChange={setName} />
            <DescriptionField value={description} disabled={isSubmitting} onChange={setDescription} />

            <ScheduleEditor
              mode={mode}
              onChangeMode={setMode}
              cronExpression={cronExpression}
              onCronChange={handleCronChange}
              simple={simple.state}
              onFrequencyChange={(frequency) => simple.setState({ ...simple.state, frequency })}
              onHourChange={(hour) => simple.setState({ ...simple.state, hour })}
              onMinuteChange={(minute) => simple.setState({ ...simple.state, minute })}
              onToggleWeekday={toggleWeekday}
              onMonthDayChange={(monthDay) => simple.setState({ ...simple.state, monthDay })}
              onPresetClick={handlePresetClick}
              cronError={errors.cron}
              disabled={isSubmitting}
            />

            <EnabledToggle enabled={enabled} disabled={isSubmitting} onChange={setEnabled} />

            {submitError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{submitError}</p>
              </div>
            )}

            <ModalActions
              isEdit={!!schedule}
              isSubmitting={isSubmitting}
              onCancel={handleClose}
            />
          </form>
        </div>
      </div>
    </div>
  );
};

interface NameFieldProps {
  value: string;
  error?: string;
  disabled: boolean;
  onChange: (v: string) => void;
}

function NameField({ value, error, disabled, onChange }: NameFieldProps) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-3 py-2 border rounded-md ${error ? 'border-red-500' : 'border-gray-300'}`}
        placeholder="e.g., Weekly Wednesday Scrape"
        disabled={disabled}
      />
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
}

interface DescriptionFieldProps {
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
}

function DescriptionField({ value, disabled, onChange }: DescriptionFieldProps) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md"
        placeholder="Optional description"
        rows={2}
        disabled={disabled}
      />
    </div>
  );
}

interface ScheduleEditorProps {
  mode: 'simple' | 'advanced';
  onChangeMode: (mode: 'simple' | 'advanced') => void;
  cronExpression: string;
  onCronChange: (value: string) => void;
  simple: SimpleScheduleState;
  onFrequencyChange: (frequency: Frequency) => void;
  onHourChange: (hour: number) => void;
  onMinuteChange: (minute: number) => void;
  onToggleWeekday: (day: number) => void;
  onMonthDayChange: (day: number) => void;
  onPresetClick: (cron: string) => void;
  cronError?: string;
  disabled: boolean;
}

function ScheduleEditor({
  mode,
  onChangeMode,
  cronExpression,
  onCronChange,
  simple,
  onFrequencyChange,
  onHourChange,
  onMinuteChange,
  onToggleWeekday,
  onMonthDayChange,
  onPresetClick,
  cronError,
  disabled,
}: ScheduleEditorProps) {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <label className="block text-sm font-medium text-gray-700">Schedule</label>
        <ModeTabs mode={mode} onChange={onChangeMode} />
      </div>

      {mode === 'simple' ? (
        <SimpleEditor
          simple={simple}
          cronExpression={cronExpression}
          onFrequencyChange={onFrequencyChange}
          onHourChange={onHourChange}
          onMinuteChange={onMinuteChange}
          onToggleWeekday={onToggleWeekday}
          onMonthDayChange={onMonthDayChange}
          onPresetClick={onPresetClick}
          disabled={disabled}
        />
      ) : (
        <AdvancedEditor
          cronExpression={cronExpression}
          onCronChange={onCronChange}
          cronError={cronError}
          disabled={disabled}
        />
      )}
    </div>
  );
}

function ModeTabs({ mode, onChange }: { mode: 'simple' | 'advanced'; onChange: (m: 'simple' | 'advanced') => void }) {
  return (
    <div className="flex bg-gray-100 rounded-md p-0.5">
      {(['simple', 'advanced'] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`px-3 py-1 text-xs rounded ${mode === m ? 'bg-white shadow text-gray-900' : 'text-gray-600'}`}
        >
          {m === 'simple' ? 'Simple' : 'Advanced'}
        </button>
      ))}
    </div>
  );
}

interface SimpleEditorProps {
  simple: SimpleScheduleState;
  cronExpression: string;
  onFrequencyChange: (frequency: Frequency) => void;
  onHourChange: (hour: number) => void;
  onMinuteChange: (minute: number) => void;
  onToggleWeekday: (day: number) => void;
  onMonthDayChange: (day: number) => void;
  onPresetClick: (cron: string) => void;
  disabled: boolean;
}

function SimpleEditor({
  simple,
  cronExpression,
  onFrequencyChange,
  onHourChange,
  onMinuteChange,
  onToggleWeekday,
  onMonthDayChange,
  onPresetClick,
  disabled,
}: SimpleEditorProps) {
  return (
    <div className="space-y-3">
      <FrequencySelect value={simple.frequency} onChange={onFrequencyChange} disabled={disabled} />
      <TimeSelectors hour={simple.hour} minute={simple.minute} onHourChange={onHourChange} onMinuteChange={onMinuteChange} disabled={disabled} />
      {simple.frequency === 'weekly' && (
        <WeekdayPicker weekdays={simple.weekdays} onToggle={onToggleWeekday} disabled={disabled} />
      )}
      {simple.frequency === 'monthly' && (
        <MonthDaySelect value={simple.monthDay} onChange={onMonthDayChange} disabled={disabled} />
      )}
      <PresetPicker onSelect={onPresetClick} />
      <CronPreview cronExpression={cronExpression} />
    </div>
  );
}

function FrequencySelect({ value, onChange, disabled }: { value: Frequency; onChange: (v: Frequency) => void; disabled: boolean }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">Frequency</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Frequency)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
        disabled={disabled}
      >
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
      </select>
    </div>
  );
}

function TimeSelectors({ hour, minute, onHourChange, onMinuteChange, disabled }: {
  hour: number;
  minute: number;
  onHourChange: (hour: number) => void;
  onMinuteChange: (minute: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex gap-2">
      <div className="flex-1">
        <label className="block text-xs text-gray-500 mb-1">Hour</label>
        <select
          value={hour}
          onChange={(e) => onHourChange(parseInt(e.target.value, 10))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          disabled={disabled}
        >
          {HOURS.map((h) => (
            <option key={h.value} value={h.value}>{h.label}</option>
          ))}
        </select>
      </div>
      <div className="flex-1">
        <label className="block text-xs text-gray-500 mb-1">Minute</label>
        <select
          value={minute}
          onChange={(e) => onMinuteChange(parseInt(e.target.value, 10))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          disabled={disabled}
        >
          {MINUTES.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function WeekdayPicker({ weekdays, onToggle, disabled }: {
  weekdays: number[];
  onToggle: (day: number) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">Days</label>
      <div className="flex flex-wrap gap-1">
        {DAYS_OF_WEEK.map((day) => (
          <button
            key={day.value}
            type="button"
            onClick={() => onToggle(day.value)}
            className={`px-2 py-1 text-xs rounded border ${
              weekdays.includes(day.value)
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-gray-700 border-gray-300'
            }`}
            disabled={disabled}
          >
            {day.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MonthDaySelect({ value, onChange, disabled }: {
  value: number;
  onChange: (day: number) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">Day of Month</label>
      <select
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
        disabled={disabled}
      >
        {MONTH_DAYS.map((d) => (
          <option key={d.value} value={d.value}>{d.label}</option>
        ))}
      </select>
    </div>
  );
}

function PresetPicker({ onSelect }: { onSelect: (cron: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">Quick Presets</label>
      <div className="flex flex-wrap gap-1">
        {CRON_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => onSelect(preset.value)}
            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CronPreview({ cronExpression }: { cronExpression: string }) {
  return (
    <div className="p-2 bg-gray-50 rounded-md text-xs text-gray-600">
      <span className="font-mono">{cronExpression}</span>
      <span className="ml-2">→ {formatCronDescription(cronExpression)}</span>
    </div>
  );
}

interface AdvancedEditorProps {
  cronExpression: string;
  onCronChange: (value: string) => void;
  cronError?: string;
  disabled: boolean;
}

function AdvancedEditor({ cronExpression, onCronChange, cronError, disabled }: AdvancedEditorProps) {
  return (
    <div>
      <input
        type="text"
        value={cronExpression}
        onChange={(e) => onCronChange(e.target.value)}
        className={`w-full px-3 py-2 border rounded-md font-mono text-sm ${cronError ? 'border-red-500' : 'border-gray-300'}`}
        placeholder="0 3 * * 3"
        disabled={disabled}
      />
      {cronError && <p className="text-red-500 text-sm mt-1">{cronError}</p>}
      <p className="text-xs text-gray-500 mt-1">
        Format: minute hour day month weekday (0-7, 0 and 7 = Sunday)
      </p>
    </div>
  );
}

function EnabledToggle({ enabled, disabled, onChange }: {
  enabled: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="mb-4">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        Enabled
      </label>
    </div>
  );
}

function ModalActions({ isEdit, isSubmitting, onCancel }: {
  isEdit: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex justify-end gap-2 pt-4">
      <button
        type="button"
        onClick={onCancel}
        disabled={isSubmitting}
        className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isSubmitting}
        className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {isEdit ? 'Save' : 'Create'}
      </button>
    </div>
  );
}

export default ScheduleModal;