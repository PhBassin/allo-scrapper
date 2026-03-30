import { useMemo, memo } from 'react';

interface DaySelectorProps {
  weekStart: string;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  onNow?: (date: string, afterTime: string) => void;
  isNowActive?: boolean;
}

// ⚡ PERFORMANCE: Cache Intl.DateTimeFormat instance to prevent expensive
// re-initialization during loops or frequent re-renders
const formatterDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

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
        label: formatterDay.format(date)
      });
    }
    
    return result;
  }, [weekStart]);

  const today = new Date().toISOString().split('T')[0];
  const todayInWeek = days.some(d => d.date === today);

  const handleNowClick = () => {
    if (!todayInWeek) return;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    onNow?.(today, `${hh}:${mm}`);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm overflow-x-auto">
      <div className="flex gap-2 min-w-max">
        {/* Maintenant button — always first */}
        <button
          onClick={handleNowClick}
          disabled={!todayInWeek}
          data-now-active={isNowActive || undefined}
          className={`px-3 py-1.5 text-sm rounded-lg transition font-semibold active:scale-95 ${
            isNowActive
              ? 'bg-teal-500 text-white cursor-pointer'
              : 'bg-gray-50 text-gray-700 hover:bg-gray-100 cursor-pointer'
          } ${!todayInWeek ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          ⏱ Maintenant
        </button>

        <button
          onClick={() => onSelectDate(null)}
          className={`px-3 py-1.5 text-sm rounded-lg transition font-semibold cursor-pointer active:scale-95 ${
            selectedDate === null && !isNowActive
              ? 'bg-primary text-black'
              : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
          }`}
          data-testid="day-selector-all"
        >
          Tous les jours
        </button>
        {days.map((day) => (
          <button
            key={day.date}
            onClick={() => onSelectDate(day.date)}
            className={`px-3 py-1.5 text-sm rounded-lg transition font-semibold capitalize cursor-pointer active:scale-95 ${
              selectedDate === day.date && !isNowActive
                ? 'bg-primary text-black'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            }`}
            data-testid={`day-selector-${day.date}`}
          >
            {day.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ⚡ PERFORMANCE: Memoize component to prevent re-renders when parent re-renders
// but selectedDate and weekStart haven't changed.
export default memo(DaySelector);
