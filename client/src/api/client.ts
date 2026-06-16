export { ApiError } from './core';
export { default } from './core';

export {
  getWeeklyMovies,
  getMoviesByDate,
  getMovieById,
  searchMovies,
} from './movies';

export {
  getTheaters,
  getTheaterSchedule,
  addTheater,
} from './theaters';

export {
  triggerScrape,
  triggerTheaterScrape,
  getScrapeStatus,
  subscribeToProgress,
} from './scraper';

export {
  getSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
} from './schedules';

export type { CreateSchedulePayload, UpdateSchedulePayload } from './schedules';

export {
  getScrapeReports,
  getScrapeReportById,
  getReportDetails,
  resumeScrape,
} from './reports';
