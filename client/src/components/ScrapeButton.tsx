import { useState } from 'react';
import { triggerScrape } from '../api/client';

interface ScrapeButtonProps {
  onScrapeStart?: () => void;
  className?: string;
}

export default function ScrapeButton({ onScrapeStart, className = '' }: ScrapeButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await triggerScrape();
      
      setSuccess(true);
      if (onScrapeStart) {
        onScrapeStart();
      }
      
      // Reset success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      if (err.response?.status === 409) {
        setError('Un scraping est déjà en cours');
      } else {
        setError(err.response?.data?.error || 'Erreur lors du démarrage du scraping');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={`
          px-6 py-3 rounded-lg font-semibold text-black
          transition-all duration-200 
          ${isLoading 
            ? 'bg-gray-300 cursor-not-allowed' 
            : 'bg-primary hover:bg-yellow-500 active:scale-95'
          }
          ${success ? 'ring-2 ring-green-500' : ''}
        `}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Scraping en cours...
          </span>
        ) : success ? (
          <span className="flex items-center gap-2">
            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Scraping démarré !
          </span>
        ) : (
          '🔄 Lancer le scraping manuel'
        )}
      </button>

      {error && (
        <div className="text-red-600 text-sm bg-red-50 px-4 py-2 rounded border border-red-200">
          {error}
        </div>
      )}
    </div>
  );
}
