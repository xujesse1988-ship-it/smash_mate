import { AppError } from '../../infra/error-handler.js';
import { createModuleLogger } from '../../infra/logger.js';
import { config } from '../../infra/config.js';
import { VenueRepository } from './repository.js';
import type {
  VenueSearchQuery,
  CreateCityInput,
  AdminVenueListQuery,
  AdminCityListQuery,
  VenueInfo,
  SyncResult,
} from './types.js';

const logger = createModuleLogger('venue');

interface MapVenueData {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  mapPoiId: string;
}

/**
 * Fetch venues from the map service API (e.g. Amap POI search) for a given city.
 * Returns an array of venue data with name, address, lat/lng, and mapPoiId.
 * If the API call fails or no API key is configured, returns an empty array.
 */
async function fetchVenuesFromMapService(cityName: string): Promise<MapVenueData[]> {
  const apiKey = config.mapApiKey;
  const baseUrl = config.mapApiBaseUrl;

  if (!apiKey || apiKey.startsWith('your-')) {
    logger.warn('MAP_API_KEY not configured, skipping map service call');
    return [];
  }

  try {
    const url = `${baseUrl}/place/text?key=${apiKey}&keywords=羽毛球&city=${encodeURIComponent(cityName)}&offset=50&extensions=base&output=JSON`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      logger.error({ status: response.status, cityName }, 'Map service returned non-200 status');
      return [];
    }

    const data = (await response.json()) as {
      status: string;
      pois?: Array<{
        id: string;
        name: string;
        address: string;
        location: string; // "longitude,latitude"
      }>;
    };

    if (data.status !== '1' || !data.pois) {
      logger.error({ cityName, apiStatus: data.status }, 'Map service returned error status');
      return [];
    }

    return data.pois.map((poi) => {
      const [lng, lat] = poi.location.split(',').map(Number);
      return {
        name: poi.name,
        address: typeof poi.address === 'string' ? poi.address : '',
        latitude: lat,
        longitude: lng,
        mapPoiId: poi.id,
      };
    });
  } catch (err) {
    logger.error({ error: (err as Error).message, cityName }, 'Map service call failed');
    return [];
  }
}

export class VenueService {
  private repo: VenueRepository;
  private isSyncing = false;

  constructor(repo: VenueRepository) {
    this.repo = repo;
  }

  async searchVenues(query: VenueSearchQuery) {
    // 1. Validate keyword
    const keyword = query.keyword?.trim();
    if (!keyword) {
      throw new AppError(400, 'VENUE_INVALID_KEYWORD', '搜索关键词不能为空');
    }

    // 2. Validate coordinates
    const { latitude, longitude } = query;
    const hasLat = latitude !== undefined && latitude !== null;
    const hasLng = longitude !== undefined && longitude !== null;

    if (hasLat !== hasLng) {
      throw new AppError(400, 'VENUE_INVALID_COORDINATES', '经纬度必须同时提供或同时不提供');
    }

    if (hasLat && hasLng) {
      if (latitude! < -90 || latitude! > 90 || longitude! < -180 || longitude! > 180) {
        throw new AppError(
          400,
          'VENUE_INVALID_COORDINATES',
          '经纬度格式不合法（latitude: -90~90, longitude: -180~180）',
        );
      }
    }

    // 3. Normalize limit
    let limit = query.limit ?? 10;
    if (limit < 1) limit = 10;
    if (limit > 50) limit = 50;

    // 4. Search via repository
    const searchParams = {
      keyword,
      ...(hasLat && hasLng ? { latitude: latitude!, longitude: longitude! } : {}),
      limit,
    };

    const items = await this.repo.searchVenues(searchParams);

    logger.info({ keyword, resultCount: items.length }, '球馆搜索完成');

    return { items };
  }

  async getVenueDetail(id: string) {
    const venue = await this.repo.findVenueById(id);
    if (!venue) {
      throw new AppError(404, 'VENUE_NOT_FOUND', '球馆不存在');
    }

    return {
      id: venue.id,
      name: venue.name,
      address: venue.address,
      latitude: venue.latitude,
      longitude: venue.longitude,
      cityId: venue.cityId,
    };
  }

  async createCity(input: CreateCityInput) {
    // 1. Validate city name
    const name = input.name?.trim();
    if (!name) {
      throw new AppError(400, 'VENUE_INVALID_CITY_NAME', '城市名称不能为空');
    }

    // 2. Check duplicate (case-insensitive)
    const existing = await this.repo.findCityByName(name);
    if (existing) {
      throw new AppError(409, 'VENUE_CITY_DUPLICATE', '城市名称已存在');
    }

    // 3. Create city record
    const city = await this.repo.createCity(name);

    // 4. Fetch venues from map service and upsert
    let venueCount = 0;
    try {
      const venueData = await fetchVenuesFromMapService(name);
      const { newCount } = await this.repo.upsertVenues(city.id, venueData);
      venueCount = newCount;
    } catch (err) {
      logger.error(
        { error: (err as Error).message, cityId: city.id, cityName: name },
        '城市添加后获取球馆数据失败',
      );
      venueCount = 0;
    }

    logger.info({ cityId: city.id, cityName: name, venueCount }, '城市添加完成');

    return {
      id: city.id,
      name: city.name,
      venueCount,
      createdAt: city.createdAt,
    };
  }

  async getCityList(query: AdminCityListQuery) {
    const page = query.page ?? 1;
    let pageSize = query.pageSize ?? 20;
    if (pageSize > 100) pageSize = 100;

    const result = await this.repo.findCities({ page, pageSize });

    return {
      items: result.items,
      total: result.total,
      page,
      pageSize,
    };
  }

  async getAdminVenueList(query: AdminVenueListQuery) {
    const page = query.page ?? 1;
    let pageSize = query.pageSize ?? 20;
    if (pageSize > 100) pageSize = 100;

    const result = await this.repo.findAdminVenues({
      cityId: query.cityId,
      keyword: query.keyword,
      page,
      pageSize,
    });

    return {
      items: result.items,
      total: result.total,
      page,
      pageSize,
    };
  }

  async deleteVenue(id: string) {
    const venue = await this.repo.findVenueById(id);
    if (!venue) {
      throw new AppError(404, 'VENUE_NOT_FOUND', '球馆不存在');
    }

    await this.repo.deleteVenue(id);

    logger.info({ venueId: id, venueName: venue.name }, '球馆已移除');

    return { message: '球馆已移除' };
  }

  async syncVenues(): Promise<{ message: string; syncResults: SyncResult[] }> {
    // Concurrency lock
    if (this.isSyncing) {
      throw new AppError(409, 'VENUE_SYNC_IN_PROGRESS', '上一次同步尚未完成');
    }

    this.isSyncing = true;
    const syncResults: SyncResult[] = [];

    try {
      const cities = await this.repo.getAllCities();

      for (const city of cities) {
        try {
          const venueData = await fetchVenuesFromMapService(city.name);
          const { newCount, updatedCount } = await this.repo.upsertVenues(city.id, venueData);

          const totalVenues = await this.repo.countVenuesByCity(city.id);

          syncResults.push({
            cityId: city.id,
            cityName: city.name,
            newVenues: newCount,
            updatedVenues: updatedCount,
            totalVenues,
          });

          logger.info(
            {
              cityId: city.id,
              cityName: city.name,
              newVenues: newCount,
              updatedVenues: updatedCount,
              totalVenues,
            },
            '城市球馆数据同步完成',
          );
        } catch (err) {
          logger.error(
            { error: (err as Error).message, cityId: city.id, cityName: city.name },
            '城市球馆数据同步失败',
          );

          syncResults.push({
            cityId: city.id,
            cityName: city.name,
            newVenues: 0,
            updatedVenues: 0,
            totalVenues: 0,
          });
        }
      }
    } finally {
      this.isSyncing = false;
    }

    logger.info({ citiesCount: syncResults.length }, '球馆数据同步全部完成');

    return {
      message: '球馆数据更新已触发',
      syncResults,
    };
  }

  // --- Cross-module service methods ---

  async getVenueById(id: string): Promise<VenueInfo | null> {
    const venue = await this.repo.findVenueById(id);
    if (!venue) return null;

    return {
      id: venue.id,
      name: venue.name,
      address: venue.address,
      latitude: venue.latitude,
      longitude: venue.longitude,
    };
  }
}
