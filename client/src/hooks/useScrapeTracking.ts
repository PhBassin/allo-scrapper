import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { triggerScrape, triggerTheaterScrape, getScrapeStatus } from '../api/client';

/**
 * Tracks the visibility of the scrape progress panel and orchestrates the
 * single-/all-theater scrape actions.
 *
 * On mount, restores the panel if a scrape is already running server-side so
 * the user doesn't lose visibility into an in-flight job.
 */
export function useScrapeTracking() {
  const queryClient = useQueryClient();
  const [showProgress, setShowProgress] = useState(false);

  // Restore panel if a scrape is already running when the page mounts
  useEffect(() => {
    getScrapeStatus()
      .then((status) => {
        if (status.isRunning) setShowProgress(true);
      })
      .catch(() => {
        // Non-critical — ignore errors checking status
      });
  }, []);

  const handleScrapeStart = useCallback(() => {
    setShowProgress(true);
  }, []);

  const handleScrapeComplete = useCallback(() => {
    setTimeout(() => {
      setShowProgress(false);
      queryClient.invalidateQueries({ queryKey: ['theaters'] });
    }, 2000);
  }, [queryClient]);

  const triggerAll = async () => {
    await triggerScrape();
  };

  const triggerSingle = async (theaterId: string) => {
    await triggerTheaterScrape(theaterId).then(() => handleScrapeStart());
  };

  return {
    showProgress,
    setShowProgress,
    handleScrapeStart,
    handleScrapeComplete,
    triggerAll,
    triggerSingle,
  };
}