import { useState, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

interface ScrapeButtonProps {
  onTrigger: () => Promise<void>;
  onScrapeStart?: () => void;
  className?: string;
  buttonText?: string;
  loadingText?: string;
  successText?: string;
  testId?: string;
}

interface AxiosLikeError {
  response?: {
    status?: number;
    data?: {
      error?: string;
    };
  };
}

export default function ScrapeButton({
  onTrigger,
  onScrapeStart,
  className = '',
  buttonText = '🔄 Lancer le scraping manuel',
  loadingText = 'Scraping en cours...',
  successText = 'Scraping démarré !',
  testId,
}: ScrapeButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { isAuthenticated, hasPermission } = useContext(AuthContext);

  if (!isAuthenticated || !hasPermission('scraper:trigger')) {
    return null;
  }

  const handleClick = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await onTrigger();

      setSuccess(true);
      if (onScrapeStart) {
        onScrapeStart();
      }

      // Reset success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      const axiosError = err as AxiosLikeError;
      if (axiosError.response) {
        if (axiosError.response.status === 409) {
          // Scrape already running, just show progress
          if (onScrapeStart) {
            onScrapeStart();
          }
        } else {
          setError(axiosError.response.data?.error || 'Erreur lors du démarrage du scraping');
        }
      } else {
        setError('Erreur lors du démarrage du scraping');
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
        data-testid={testId}
        className={`
          px-6 py-3 rounded-lg font-semibold text-black
          transition-all duration-200 
          ${isLoading
            ? 'bg-gray-300 cursor-not-allowed'
            : 'bg-primary hover:bg-yellow-500 active:scale-95 cursor-pointer'
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
            {loadingText}
          </span>
        ) : success ? (
          <span className="flex items-center gap-2">
            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {successText}
          </span>
        ) : (
          buttonText
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
