import { useEffect, useState, useRef } from 'react';

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);
  const rafId = useRef(0);

  useEffect(() => {
    const toggleVisibility = () => {
      // Throttle with requestAnimationFrame — at most one check per frame
      if (rafId.current) return;
      rafId.current = requestAnimationFrame(() => {
        rafId.current = 0;
        setIsVisible(window.scrollY > 200);
      });
    };

    // Listen for scroll events with passive flag for better performance
    window.addEventListener('scroll', toggleVisibility, { passive: true });

    // Clean up
    return () => {
      window.removeEventListener('scroll', toggleVisibility);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!isVisible) {
    return null;
  }

  return (
    <button
      onClick={scrollToTop}
      aria-label="Retour en haut"
      className="fixed bottom-8 right-8 z-50 w-12 h-12 bg-primary hover:bg-yellow-500 text-black rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group active:scale-95"
    >
      <svg
        className="w-6 h-6 transform group-hover:-translate-y-0.5 transition-transform"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.5}
          d="M5 10l7-7m0 0l7 7m-7-7v18"
        />
      </svg>
    </button>
  );
}
