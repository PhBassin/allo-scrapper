import { getShowtimesByTheaterAndWeek } from '../db/showtime-queries.js';
import { createScrapeReport } from '../db/report-queries.js';
import { getTheaters, addTheater, updateTheaterConfig, deleteTheater } from '../db/theater-queries.js';
import { extractTheaterIdFromUrl, cleanTheaterUrl } from '../utils/url.js';
import { getRedisClient } from './redis-client.js';
import { logger } from '../utils/logger.js';
import {
  validateTheaterId,
  validateTheaterName,
  validateTheaterUrl,
  validateOptionalUrl,
  validateAddress,
  validatePostalCode,
  validateCity,
  validateScreenCount,
  validateAtLeastOneField,
} from './theater-validator.js';
import type { DB } from '../db/index.js';

export class TheaterService {
  constructor(private db: DB) {}

  async getAllTheaters() {
    return getTheaters(this.db);
  }

  async getTheaterShowtimes(theaterId: string, weekStart: string) {
    return getShowtimesByTheaterAndWeek(this.db, theaterId, weekStart);
  }

  async addTheaterViaUrl(url: string) {
    validateTheaterUrl(url);

    const theaterId = extractTheaterIdFromUrl(url);
    if (!theaterId) {
      throw new Error('Could not extract theater ID from URL. URL format should be like https://www.allocine.fr/seance/salle_gen_csalle=C0013.html');
    }

    const cleanedUrl = cleanTheaterUrl(url);

    // Insert theater into DB with minimal info
    const theater = await addTheater(this.db, { id: theaterId, name: theaterId, url: cleanedUrl });

    // Publish add_theater job to Redis
    const reportId = await createScrapeReport(this.db, 'manual');
    await getRedisClient().publishAddTheaterJob(reportId, cleanedUrl);
    logger.info(`🎬 add_theater job queued for ${cleanedUrl} (reportId=${reportId})`);

    return theater;
  }

  async addTheaterManual(id: string, name: string, url: string) {
    validateTheaterId(id);
    validateTheaterName(name);
    validateTheaterUrl(url);

    try {
      return await addTheater(this.db, { id, name, url });
    } catch (error: any) {
      if (error.message && error.message.includes('duplicate key')) {
        throw new Error('Theater with this ID already exists');
      }
      throw error;
    }
  }

  async updateTheater(
    theaterId: string, 
    data: { name?: string; url?: string; address?: string; postal_code?: string; city?: string; screen_count?: number }
  ) {
    const { name, url, address, postal_code, city, screen_count } = data;

    validateAtLeastOneField(data, ['name', 'url', 'address', 'postal_code', 'city', 'screen_count']);

    if (name) validateTheaterName(name);
    validateOptionalUrl(url);
    validateAddress(address);
    validatePostalCode(postal_code);
    validateCity(city);
    validateScreenCount(screen_count);

    const updates: any = {};
    if (name) updates.name = name;
    if (url) updates.url = url;
    if (address !== undefined) updates.address = address || undefined;
    if (postal_code !== undefined) updates.postal_code = postal_code || undefined;
    if (city !== undefined) updates.city = city || undefined;
    if (screen_count !== undefined) updates.screen_count = screen_count ?? undefined;

    const theater = await updateTheaterConfig(this.db, theaterId, updates);
    if (!theater) {
      throw new Error(`Theater ${theaterId} not found`);
    }

    return theater;
  }

  async deleteTheater(theaterId: string) {
    const deleted = await deleteTheater(this.db, theaterId);
    if (!deleted) {
      throw new Error(`Theater ${theaterId} not found`);
    }
    return deleted;
  }
}
