export type ActivityStatus = 'open' | 'full' | 'in_progress' | 'completed' | 'cancelled';

export interface CreateActivityInput {
  venueId: string;
  title?: string;
  startTime: string;
  endTime: string;
  maxParticipants: number;
}

export interface UpdateActivityInput {
  venueId?: string;
  title?: string;
  startTime?: string;
  endTime?: string;
  maxParticipants?: number;
}

export interface ActivityListQuery {
  page?: number;
  pageSize?: number;
  dateFilter?: 'today' | 'tomorrow' | 'this_week';
  dateStart?: string;
  dateEnd?: string;
  maxDistance?: number;
  latitude?: number;
  longitude?: number;
  hasSlot?: boolean;
  sortBy?: 'time' | 'distance';
}

export interface UserActivitiesQuery {
  page?: number;
  pageSize?: number;
  role?: 'creator' | 'participant';
  status?: ActivityStatus;
}
