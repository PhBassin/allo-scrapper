import { useEffect, useRef } from 'react';
import type { Showtime, Film, Cinema } from '../types';
import { buildGoogleCalendarUrl, downloadIcsFile, openIcsInCalendar } from '../utils/calendar';

interface CalendarPopoverProps {
  showtime: Showtime;
  film: Film;
  cinema: Cinema;
  onClose: () => void;
}

export default function CalendarPopover({ showtime, film, cinema, onClose }: CalendarPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [onClose]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function handleGoogleCalendar() {
    const url = buildGoogleCalendarUrl(showtime, film, cinema);
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  }

  function handleAppleCalendar() {
    openIcsInCalendar(showtime, film, cinema);
    onClose();
  }

  function handleDownloadIcs() {
    downloadIcsFile(showtime, film, cinema);
    onClose();
  }

  return (
    <div
      ref={popoverRef}
      role="menu"
      aria-label="Ajouter au calendrier"
      className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[200px] animate-in fade-in zoom-in-95 duration-150"
    >
      <button
        role="menuitem"
        onClick={handleGoogleCalendar}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition cursor-pointer"
      >
        <span className="text-base leading-none" aria-hidden="true">📅</span>
        <span className="font-medium">Google Calendar</span>
      </button>

      <button
        role="menuitem"
        onClick={handleAppleCalendar}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition cursor-pointer"
      >
        <span className="text-base leading-none" aria-hidden="true">🍎</span>
        <span className="font-medium">Apple Calendar</span>
      </button>

      <div className="my-1 border-t border-gray-100" />

      <button
        role="menuitem"
        onClick={handleDownloadIcs}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition cursor-pointer"
      >
        <span className="text-base leading-none" aria-hidden="true">⬇️</span>
        <span className="font-medium">Télécharger .ics</span>
      </button>
    </div>
  );
}
