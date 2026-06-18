import ScrapeButton from '../ScrapeButton';
import Button from '../ui/Button';

interface TheatersToolbarProps {
  canScrapeAll: boolean;
  canCreate: boolean;
  onScrapeAll: () => Promise<void>;
  onScrapeStart: () => void;
  onAdd: () => void;
}

export function TheatersToolbar({
  canScrapeAll,
  canCreate,
  onScrapeAll,
  onScrapeStart,
  onAdd,
}: TheatersToolbarProps) {
  return (
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-3xl font-bold text-gray-900">Theater Management</h1>
      <div className="flex items-center gap-3">
        {canScrapeAll && (
          <ScrapeButton
            onTrigger={onScrapeAll}
            onScrapeStart={onScrapeStart}
            buttonText="Scraper tous les cinémas"
            loadingText="Scraping..."
            successText="Scraping démarré !"
            testId="scrape-all-button"
          />
        )}
        {canCreate && (
          <Button
            onClick={onAdd}
            data-testid="add-theater-button"
          >
            Add Theater
          </Button>
        )}
      </div>
    </div>
  );
}