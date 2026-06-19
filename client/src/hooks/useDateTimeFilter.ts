import { useCallback, useState } from 'react';

export interface DateTimeFilter {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  afterTime: string | null;
  setAfterTime: (time: string | null) => void;
  selectDate: (date: string) => void;
  selectNow: (date: string, time: string) => void;
}

export function useDateTimeFilter(initialDate = ''): DateTimeFilter {
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [afterTime, setAfterTime] = useState<string | null>(null);

  const selectDate = useCallback((date: string) => {
    setSelectedDate(date);
    setAfterTime(null);
  }, []);

  const selectNow = useCallback((date: string, time: string) => {
    setSelectedDate(date);
    setAfterTime(time);
  }, []);

  return { selectedDate, setSelectedDate, afterTime, setAfterTime, selectDate, selectNow };
}