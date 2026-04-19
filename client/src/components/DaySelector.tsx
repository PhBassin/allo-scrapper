import { useMemo, memo } from 'react';

interface DaySelectorProps {
  weekStart: string;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  onNow?: (date: string, afterTime: string) => void;
  isNowActive?: boolean;
}

// ⚡ PERFORMANCE: Cache Intl.DateTimeFormat instances to prevent expensive
// re-initialization during loops or frequent re-renders
const fmtWeekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });
const fmtDay     = new Intl.DateTimeFormat('fr-FR', { day: 'numeric' });

// fr-FR abbreviates weekdays with a trailing period (e.g. "lun.", "mar.")
const stripDot = (s: string) => s.replace(/\.$/, '');

function DaySelector({ weekStart, selectedDate, onSelectDate, onNow, isNowActive = false }: DaySelectorProps) {
  const days = useMemo(() => {
    if (!weekStart) return [];

    const start = new Date(weekStart);
    if (isNaN(start.getTime())) return [];

    const result = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      result.push({
        date: date.toISOString().split('T')[0],
        weekday: stripDot(fmtWeekday.format(date)),
        day:     fmtDay.format(date),
      });
    }

    return result;
  }, [weekStart]);

  const today = new Date().toISOString().split('T')[0];
  const todayInWeek = days.some(d => d.date === today);

  const handleToggleClick = () => {
    if (isNowActive) {
      // bascule vers "Tous les jours"
      onSelectDate(null);
    } else {
      // bascule vers "Maintenant"
      if (!todayInWeek) return;
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      onNow?.(today, `${hh}:${mm}`);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-100 px-2 py-1.5 shadow-sm overflow-x-auto">
      <div className="flex gap-1.5 min-w-max items-center">
        {/* Toggle bi-état: Maintenant ⇄ Tous les jours */}
        <button
          onClick={handleToggleClick}
          disabled={!isNowActive && !todayInWeek}
          data-now-active={isNowActive || undefined}
          data-testid="day-selector-mode-toggle"
          aria-pressed={isNowActive}
          aria-label={
            isNowActive
              ? 'Désactiver le filtre Maintenant et voir tous les jours'
              : 'Filtrer pour voir uniquement les séances à venir aujourd\'hui'
          }
          className={`px-3 py-1.5 text-xs rounded-lg transition font-semibold active:scale-95 flex items-center gap-1.5 whitespace-nowrap ${
            isNowActive
              ? 'bg-teal-500 text-white cursor-pointer'
              : selectedDate === null
                ? 'bg-primary text-black cursor-pointer'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100 cursor-pointer'
          } ${!isNowActive && !todayInWeek ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span>{isNowActive ? '⏱' : '📅'}</span>
          <span>{isNowActive ? 'Maintenant' : 'Tous les jours'}</span>
        </button>

        {/* Séparateur visuel */}
        <div className="w-px h-5 bg-gray-200 flex-shrink-0" />

        {/* Jours de la semaine — format compact "Lun 21" sur une ligne */}
        {days.map((day) => (
          <button
            key={day.date}
            onClick={() => onSelectDate(day.date)}
            className={`px-3 py-1.5 text-xs rounded-lg transition cursor-pointer active:scale-95 flex items-center gap-1 whitespace-nowrap ${
              selectedDate === day.date && !isNowActive
                ? 'bg-primary text-black font-bold'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            }`}
            data-testid={`day-selector-${day.date}`}
          >
            <span className="uppercase font-bold">{day.weekday}</span>
            <span className="font-bold">{day.day}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ⚡ PERFORMANCE: Memoize component to prevent re-renders when parent re-renders
// but selectedDate and weekStart haven't changed.
export default memo(DaySelector);
