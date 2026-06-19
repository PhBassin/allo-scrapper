import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getTheaters, getTheaterSchedule } from '../api/client.js';
import { LoadingSpinner, ErrorMessage } from '../components/ui/PageStates.js';
import { TheaterContent } from '../components/theater/TheaterContent.js';
import { createDateLabelFormatter } from '../utils/theaterSchedule.js';

export default function TheaterPage() {
  const { id } = useParams<{ id: string }>();

  const theatersQuery = useQuery({
    queryKey: ['theaters'],
    queryFn: getTheaters,
  });
  const scheduleQuery = useQuery({
    queryKey: ['theater-schedule', id],
    queryFn: () => getTheaterSchedule(id!),
    enabled: !!id,
  });

  const isLoading = theatersQuery.isLoading || scheduleQuery.isLoading;
  const queryError = theatersQuery.error || scheduleQuery.error;
  const error = queryError instanceof Error
    ? queryError.message
    : queryError ? 'Failed to load theater data' : null;

  const theater = theatersQuery.data?.find((c) => c.id === id) || null;
  const showtimes = scheduleQuery.data?.showtimes || [];
  const hasNoTheater = !theater && !theatersQuery.isLoading && !!theatersQuery.data;

  if (isLoading) return <LoadingSpinner />;
  if (error || !theater || hasNoTheater) {
    return <ErrorMessage message={error || 'Theater not found'} />;
  }

  return (
    <TheaterContent
      theater={theater}
      showtimes={showtimes}
      formatDateLabel={createDateLabelFormatter()}
    />
  );
}