import { useMemo, memo } from 'react';

interface DaySelectorProps {
  weekStart: string;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

// ⚡ PERFORMANCE: Cache Intl.DateTimeFormat instance to prevent expensive
// re-initialization during loops or frequent re-renders
const formatterDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

function DaySelector({ weekStart, selectedDate, onSelectDate }: DaySelectorProps) {
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

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
      <h2 className="text-xs font-bold text-gray-400 uppercase mb-2 px-1">Filtrer par jour</h2>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onSelectDate(null)}
          className={`px-3 py-1.5 text-sm rounded-lg transition font-semibold cursor-pointer active:scale-95 ${
            selectedDate === null
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
              selectedDate === day.date
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
