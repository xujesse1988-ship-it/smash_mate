export async function getCoaches(_params: {
  page?: number;
  pageSize?: number;
  specialty?: string;
}) {
  throw new Error('Not implemented');
}

export async function getCoachProfile(_id: string) {
  throw new Error('Not implemented');
}

export async function updateCoachProfile(_data: { bio?: string; specialties?: string[] }) {
  throw new Error('Not implemented');
}

export async function createGroupClass(_data: {
  venueId: string;
  title: string;
  startTime: string;
  endTime: string;
  maxParticipants: number;
  feeDescription?: string;
}) {
  throw new Error('Not implemented');
}

export async function getGroupClassDetail(_id: string) {
  throw new Error('Not implemented');
}

export async function updateGroupClass(
  _id: string,
  _data: {
    title?: string;
    startTime?: string;
    endTime?: string;
    maxParticipants?: number;
    feeDescription?: string;
  },
) {
  throw new Error('Not implemented');
}

export async function cancelGroupClass(_id: string) {
  throw new Error('Not implemented');
}

export async function enrollGroupClass(_id: string) {
  throw new Error('Not implemented');
}

export async function cancelEnrollment(_id: string) {
  throw new Error('Not implemented');
}

export async function setAvailability(_data: {
  startTime: string;
  endTime: string;
  venueIds?: string[];
  feeDescription?: string;
}) {
  throw new Error('Not implemented');
}

export async function getCoachAvailability(_coachId: string) {
  throw new Error('Not implemented');
}

export async function bookPrivateLesson(_data: { slotId: string; venueId?: string }) {
  throw new Error('Not implemented');
}

export async function cancelPrivateLesson(_id: string) {
  throw new Error('Not implemented');
}

export async function getUserEnrollments(
  _userId: string,
  _params: { page?: number; pageSize?: number },
) {
  throw new Error('Not implemented');
}

export async function getCoachPrivateLessons(
  _coachId: string,
  _params: { page?: number; pageSize?: number; status?: string },
) {
  throw new Error('Not implemented');
}
