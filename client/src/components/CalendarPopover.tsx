// fallow-ignore-file security-sink
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Showtime, Movie, Theater } from '../types';
import { buildGoogleCalendarUrl, downloadIcsFile } from '../utils/calendar';

interface CalendarPopoverProps {
  showtime: Showtime;
  movie: Movie;
  theater: Theater;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}

export default function CalendarPopover({ showtime, movie, theater, anchorRef, onClose }: CalendarPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });

  // Position the popover below the anchor button using getBoundingClientRect
  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      zIndex: 9999,
    });
  }, [anchorRef]);

  // Close on outside click
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        popoverRef.current && !popoverRef.current.contains(target) &&
        anchorRef.current && !anchorRef.current.contains(target)
      ) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose, anchorRef]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function handleGoogleCalendar() {
    const url = buildGoogleCalendarUrl(showtime, movie, theater);
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  }

  function handleDownloadIcs() {
    downloadIcsFile(showtime, movie, theater);
    onClose();
  }

  return createPortal(
    <div
      ref={popoverRef}
      role="menu"
      aria-label="Ajouter au calendrier"
      style={style}
      className="bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[200px] animate-in fade-in zoom-in-95 duration-150"
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
        onClick={handleDownloadIcs}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition cursor-pointer"
      >
        <span className="text-base leading-none" aria-hidden="true">📁</span>
        <div className="flex flex-col">
          <span className="font-medium">Apple / Outlook</span>
          <span className="text-xs text-gray-400">Télécharger le fichier .ics</span>
        </div>
      </button>
    </div>,
    document.body
  );
}
