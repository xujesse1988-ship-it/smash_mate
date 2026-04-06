export async function getActivities(_params: {
  page?: number;
  pageSize?: number;
  dateFilter?: string;
  dateStart?: string;
  dateEnd?: string;
  maxDistance?: number;
  latitude?: number;
  longitude?: number;
  hasSlot?: boolean;
  sortBy?: string;
}) {
  throw new Error('Not implemented');
}

export async function getActivityDetail(_id: string) {
  throw new Error('Not implemented');
}

export async function createActivity(_data: {
  venueId: string;
  title?: string;
  startTime: string;
  endTime: string;
  maxParticipants: number;
}) {
  throw new Error('Not implemented');
}

export async function joinActivity(_id: string) {
  throw new Error('Not implemented');
}

export async function leaveActivity(_id: string) {
  throw new Error('Not implemented');
}

export async function updateActivity(
  _id: string,
  _data: {
    venueId?: string;
    title?: string;
    startTime?: string;
    endTime?: string;
    maxParticipants?: number;
  },
) {
  throw new Error('Not implemented');
}

export async function cancelActivity(_id: string) {
  throw new Error('Not implemented');
}

export async function getUserActivities(
  _userId: string,
  _params: { page?: number; pageSize?: number; role?: string; status?: string },
) {
  throw new Error('Not implemented');
}
