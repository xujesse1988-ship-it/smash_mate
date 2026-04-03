import { Router } from 'express';

export function createMatchRecordController(): Router {
  const router = Router();

  // POST /api/match-records
  // DELETE /api/match-records/:id
  // GET /api/activities/:id/match-records
  // GET /api/group-classes/:id/match-records
  // GET /api/private-lessons/:id/match-records
  // GET /api/users/:id/match-records
  // GET /api/users/:id/match-stats

  return router;
}
