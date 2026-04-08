import { Prisma } from '@prisma/client';
import { prisma } from '../../infra/database.js';

export interface SearchVenuesParams {
  keyword: string;
  latitude?: number;
  longitude?: number;
  limit: number;
}

export interface FindAdminVenuesParams {
  cityId?: string;
  keyword?: string;
  page: number;
  pageSize: number;
}

export interface FindCitiesParams {
  page: number;
  pageSize: number;
}

export class VenueRepository {
  async findVenueById(id: string) {
    return prisma.venue.findUnique({
      where: { id },
      include: { city: { select: { name: true } } },
    });
  }

  async searchVenues(query: SearchVenuesParams) {
    const { keyword, latitude, longitude, limit } = query;

    if (latitude !== undefined && longitude !== undefined) {
      // Use raw SQL for Haversine distance calculation and sorting
      const results = await prisma.$queryRaw<
        Array<{
          id: string;
          name: string;
          address: string;
          latitude: number;
          longitude: number;
          cityName: string;
          distance: number;
        }>
      >(
        Prisma.sql`
          SELECT
            v.id,
            v.name,
            v.address,
            v.latitude,
            v.longitude,
            c.name AS "cityName",
            ROUND(
              (6371 * 2 * ASIN(SQRT(
                POWER(SIN(RADIANS(v.latitude - ${latitude}) / 2), 2) +
                COS(RADIANS(${latitude})) * COS(RADIANS(v.latitude)) *
                POWER(SIN(RADIANS(v.longitude - ${longitude}) / 2), 2)
              )))::numeric, 1
            )::float AS distance
          FROM "Venue" v
          JOIN "City" c ON v."cityId" = c.id
          WHERE v.name ILIKE ${'%' + keyword + '%'}
          ORDER BY distance ASC
          LIMIT ${limit}
        `,
      );
      return results;
    }

    // No coordinates: sort by name
    const venues = await prisma.venue.findMany({
      where: {
        name: { contains: keyword, mode: 'insensitive' },
      },
      include: { city: { select: { name: true } } },
      orderBy: { name: 'asc' },
      take: limit,
    });

    return venues.map((v) => ({
      id: v.id,
      name: v.name,
      address: v.address,
      latitude: v.latitude,
      longitude: v.longitude,
      cityName: v.city.name,
      distance: null as number | null,
    }));
  }

  async createCity(name: string) {
    return prisma.city.create({
      data: { name },
    });
  }

  async findCityById(id: string) {
    return prisma.city.findUnique({ where: { id } });
  }

  async findCityByName(name: string) {
    return prisma.city.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
      },
    });
  }

  async findCities(query: FindCitiesParams) {
    const { page, pageSize } = query;
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.city.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { venues: true },
          },
        },
      }),
      prisma.city.count(),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        venueCount: item._count.venues,
      })),
      total,
    };
  }

  async findAdminVenues(query: FindAdminVenuesParams) {
    const { cityId, keyword, page, pageSize } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.VenueWhereInput = {};
    if (cityId) where.cityId = cityId;
    if (keyword) where.name = { contains: keyword, mode: 'insensitive' };

    const [items, total] = await Promise.all([
      prisma.venue.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { city: { select: { name: true } } },
      }),
      prisma.venue.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        address: item.address,
        latitude: item.latitude,
        longitude: item.longitude,
        cityId: item.cityId,
        cityName: item.city.name,
        createdAt: item.createdAt,
      })),
      total,
    };
  }

  async deleteVenue(id: string) {
    await prisma.venue.delete({ where: { id } });
  }

  async upsertVenues(
    cityId: string,
    venues: Array<{
      name: string;
      address: string;
      latitude: number;
      longitude: number;
      mapPoiId: string;
    }>,
  ) {
    let newCount = 0;
    let updatedCount = 0;

    for (const venue of venues) {
      const existing = await prisma.venue.findUnique({
        where: { mapPoiId: venue.mapPoiId },
      });

      if (existing) {
        await prisma.venue.update({
          where: { mapPoiId: venue.mapPoiId },
          data: {
            name: venue.name,
            address: venue.address,
          },
        });
        updatedCount++;
      } else {
        await prisma.venue.create({
          data: {
            name: venue.name,
            address: venue.address,
            latitude: venue.latitude,
            longitude: venue.longitude,
            cityId,
            mapPoiId: venue.mapPoiId,
          },
        });
        newCount++;
      }
    }

    return { newCount, updatedCount };
  }

  async getAllCities() {
    return prisma.city.findMany();
  }

  async countVenuesByCity(cityId: string) {
    return prisma.venue.count({ where: { cityId } });
  }
}
