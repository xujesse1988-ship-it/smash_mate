export async function createCity(_name: string) {
  throw new Error('Not implemented');
}

export async function getCities(_params: { page?: number; pageSize?: number }) {
  throw new Error('Not implemented');
}

export async function getAdminVenues(_params: {
  cityId?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}) {
  throw new Error('Not implemented');
}

export async function deleteVenue(_id: string) {
  throw new Error('Not implemented');
}

export async function syncVenues() {
  throw new Error('Not implemented');
}
