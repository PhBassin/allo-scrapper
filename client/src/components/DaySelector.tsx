import { useMemo } from 'react';

interface DaySelectorProps {
  weekStart: string;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

export default function DaySelector({ weekStart, selectedDate, onSelectDate }: DaySelectorProps) {
  const days = useMemo(() => {
    if (!weekStart) return [];
    
    const start = new Date(weekStart);
    const result = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      result.push({
        date: date.toISOString().split('T')[0],
        label: date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
      });
    }
    
    return result;
  }, [weekStart]);

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <h2 className="text-xs font-bold text-gray-400 uppercase mb-3 px-1">Filtrer par jour</h2>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onSelectDate(null)}
          className={`px-3 py-1.5 text-sm rounded-lg transition font-semibold ${
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
            className={`px-3 py-1.5 text-sm rounded-lg transition font-semibold capitalize ${
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
