import { getShowtimesByTheaterAndWeek } from '../db/showtime-queries.js';
import { createScrapeReport } from '../db/report-queries.js';
import { getTheaters, addTheater, updateTheaterConfig, deleteTheater } from '../db/theater-queries.js';
import { isValidAllocineUrl, extractTheaterIdFromUrl, cleanTheaterUrl } from '../utils/url.js';
import { getRedisClient } from './redis-client.js';
import { logger } from '../utils/logger.js';
import type { DB } from '../db/client.js';

export class TheaterService {
  constructor(private db: DB) {}

  async getAllTheaters() {
    return getTheaters(this.db);
  }

  async getTheaterShowtimes(theaterId: string, weekStart: string) {
    return getShowtimesByTheaterAndWeek(this.db, theaterId, weekStart);
  }

  async addTheaterViaUrl(url: string) {
    if (url.length > 2048) {
      throw new Error('URL is too long (max 2048 characters)');
    }

    if (!isValidAllocineUrl(url)) {
      throw new Error('Invalid Allocine URL. Must be https://www.allocine.fr/...');
    }

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
    if (typeof id !== 'string' || !/^[A-Za-z0-9]+$/.test(id)) {
      throw new Error('Invalid ID format. Must be alphanumeric string.');
    }

    if (id.length > 20) {
      throw new Error('ID is too long (max 20 characters)');
    }

    if (typeof name !== 'string' || name.length > 100) {
      throw new Error('Name must be a string between 1 and 100 characters');
    }

    if (typeof url !== 'string' || url.length > 2048) {
      throw new Error('URL is too long (max 2048 characters)');
    }

    if (!isValidAllocineUrl(url)) {
      throw new Error('Invalid Allocine URL. Must be https://www.allocine.fr/...');
    }

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

    if (!name && !url && !address && postal_code === undefined && !city && screen_count === undefined) {
      throw new Error('At least one field must be provided: name, url, address, postal_code, city, screen_count');
    }

    if (name && (typeof name !== 'string' || name.length > 100)) {
      throw new Error('Name must be a string between 1 and 100 characters');
    }

    if (url && (typeof url !== 'string' || url.length > 2048)) {
      throw new Error('URL is too long (max 2048 characters)');
    }

    if (url && !isValidAllocineUrl(url)) {
      throw new Error('Invalid Allocine URL. Must be https://www.allocine.fr/...');
    }

    if (address !== undefined && (typeof address !== 'string' || address.length > 200)) {
      throw new Error('Address must be at most 200 characters');
    }

    if (postal_code !== undefined) {
      if (typeof postal_code !== 'string' || postal_code.length > 10) {
        throw new Error('Postal code must be at most 10 characters');
      }
      if (postal_code && !/^[a-zA-Z0-9]+$/.test(postal_code)) {
        throw new Error('Postal code must be alphanumeric');
      }
    }

    if (city !== undefined && (typeof city !== 'string' || city.length > 100)) {
      throw new Error('City must be at most 100 characters');
    }

    if (screen_count !== undefined && screen_count !== null) {
      if (typeof screen_count !== 'number') {
        throw new Error('Screen count must be a number');
      }
      if (!Number.isInteger(screen_count)) {
        throw new Error('Screen count must be an integer');
      }
      if (screen_count < 1 || screen_count > 50) {
        throw new Error('Screen count must be between 1 and 50');
      }
    }

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
