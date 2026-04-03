import { Response } from 'express';

export function success(res: Response, data: unknown, statusCode = 200): void {
  res.status(statusCode).json({ data });
}

export function created(res: Response, data: unknown): void {
  res.status(201).json({ data });
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function paginated<T>(res: Response, data: PaginatedData<T>): void {
  res.status(200).json({ data });
}
