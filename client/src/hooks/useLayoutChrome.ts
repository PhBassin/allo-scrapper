import { useEffect, useRef, useState } from 'react';

interface UseScrollHeaderOptions {
  topRevealThreshold?: number;
  scrollDeltaThreshold?: number;
}

export function useScrollHeader(options: UseScrollHeaderOptions = {}) {
  const { topRevealThreshold = 80, scrollDeltaThreshold = 8 } = options;
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY <= topRevealThreshold) {
        setIsVisible(true);
        lastScrollYRef.current = currentScrollY;
        return;
      }

      const scrollDelta = currentScrollY - lastScrollYRef.current;

      if (Math.abs(scrollDelta) < scrollDeltaThreshold) {
        return;
      }

      setIsVisible(scrollDelta <= 0);
      lastScrollYRef.current = currentScrollY;
    };

    lastScrollYRef.current = window.scrollY;
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [topRevealThreshold, scrollDeltaThreshold]);

  return isVisible;
}

export function useClickOutside<T extends HTMLElement>(
  isActive: boolean,
  onOutside: () => void
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!isActive) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onOutside();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isActive, onOutside]);

  return ref;
}