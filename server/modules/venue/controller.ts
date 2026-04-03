import { Router } from 'express';

export function createVenueController(): Router {
  const router = Router();

  // GET /api/venues/search
  // GET /api/venues/:id
  // POST /api/admin/cities
  // GET /api/admin/cities
  // GET /api/admin/venues
  // DELETE /api/admin/venues/:id
  // POST /api/admin/venues/sync

  return router;
}
