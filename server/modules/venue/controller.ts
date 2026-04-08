import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../infra/auth.js';
import { adminAuthMiddleware } from '../../infra/admin-auth.js';
import { success, created } from '../../infra/response.js';
import { VenueService } from './service.js';
import { VenueRepository } from './repository.js';

export function createVenueController(): Router {
  const router = Router();
  const repo = new VenueRepository();
  const service = new VenueService(repo);

  // Register scheduled tasks (weekly venue data sync)
  service.registerScheduledTasks();

  // GET /api/venues/search
  router.get(
    '/venues/search',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const keyword = req.query.keyword as string | undefined;
        const latitude = req.query.latitude !== undefined ? Number(req.query.latitude) : undefined;
        const longitude =
          req.query.longitude !== undefined ? Number(req.query.longitude) : undefined;
        const limit = req.query.limit !== undefined ? Number(req.query.limit) : undefined;

        const result = await service.searchVenues({
          keyword: keyword ?? '',
          latitude: latitude !== undefined && !isNaN(latitude) ? latitude : undefined,
          longitude: longitude !== undefined && !isNaN(longitude) ? longitude : undefined,
          limit,
        });

        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/venues/:id
  router.get(
    '/venues/:id',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await service.getVenueDetail(req.params.id);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /api/admin/cities
  router.post(
    '/admin/cities',
    authMiddleware,
    adminAuthMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await service.createCity({ name: req.body.name });
        created(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/admin/cities
  router.get(
    '/admin/cities',
    authMiddleware,
    adminAuthMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const page = req.query.page !== undefined ? Number(req.query.page) : undefined;
        const pageSize = req.query.pageSize !== undefined ? Number(req.query.pageSize) : undefined;

        const result = await service.getCityList({ page, pageSize });
        success(res, { ...result });
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/admin/venues
  router.get(
    '/admin/venues',
    authMiddleware,
    adminAuthMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const cityId = req.query.cityId as string | undefined;
        const keyword = req.query.keyword as string | undefined;
        const page = req.query.page !== undefined ? Number(req.query.page) : undefined;
        const pageSize = req.query.pageSize !== undefined ? Number(req.query.pageSize) : undefined;

        const result = await service.getAdminVenueList({ cityId, keyword, page, pageSize });
        success(res, { ...result });
      } catch (err) {
        next(err);
      }
    },
  );

  // DELETE /api/admin/venues/:id
  router.delete(
    '/admin/venues/:id',
    authMiddleware,
    adminAuthMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await service.deleteVenue(req.params.id);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /api/admin/cities/:id/sync
  router.post(
    '/admin/cities/:id/sync',
    authMiddleware,
    adminAuthMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await service.syncCityVenues(req.params.id);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /api/admin/venues/sync
  router.post(
    '/admin/venues/sync',
    authMiddleware,
    adminAuthMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await service.syncVenues();
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
