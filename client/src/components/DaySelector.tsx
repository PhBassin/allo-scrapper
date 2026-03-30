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
const fmtMonth   = new Intl.DateTimeFormat('fr-FR', { month: 'short' });

// fr-FR abbreviates weekdays/months with a trailing period (e.g. "lun.", "mars.")
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
        month:   stripDot(fmtMonth.format(date)),
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
      <div className="flex gap-2 min-w-max items-stretch">
        {/* Maintenant button — always first */}
        <button
          onClick={handleNowClick}
          disabled={!todayInWeek}
          data-now-active={isNowActive || undefined}
          className={`px-3 py-2 text-sm rounded-lg transition font-semibold active:scale-95 flex flex-col items-center justify-center min-w-[68px] ${
            isNowActive
              ? 'bg-teal-500 text-white cursor-pointer'
              : 'bg-gray-50 text-gray-700 hover:bg-gray-100 cursor-pointer'
          } ${!todayInWeek ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span className="text-base leading-none">⏱</span>
          <span className="text-[11px] font-bold mt-0.5">Maintenant</span>
        </button>

        <button
          onClick={() => onSelectDate(null)}
          className={`px-3 py-2 text-sm rounded-lg transition font-semibold cursor-pointer active:scale-95 flex flex-col items-center justify-center min-w-[68px] ${
            selectedDate === null && !isNowActive
              ? 'bg-primary text-black'
              : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
          }`}
          data-testid="day-selector-all"
        >
          <span className="text-[11px] font-bold leading-tight text-center">Tous les jours</span>
        </button>

        {days.map((day) => (
          <button
            key={day.date}
            onClick={() => onSelectDate(day.date)}
            className={`px-2 py-2 rounded-lg transition cursor-pointer active:scale-95 flex flex-col items-center justify-center min-w-[52px] ${
              selectedDate === day.date && !isNowActive
                ? 'bg-primary text-black'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            }`}
            data-testid={`day-selector-${day.date}`}
          >
            <span className={`text-[10px] uppercase font-bold ${selectedDate === day.date && !isNowActive ? 'text-black' : 'text-gray-400'}`}>
              {day.weekday}
            </span>
            <span className="text-base font-bold leading-none my-0.5">{day.day}</span>
            <span className={`text-[10px] ${selectedDate === day.date && !isNowActive ? 'text-black' : 'text-gray-400'}`}>
              {day.month}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ⚡ PERFORMANCE: Memoize component to prevent re-renders when parent re-renders
// but selectedDate and weekStart haven't changed.
export default memo(DaySelector);
