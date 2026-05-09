export type GeoPoint = {
  lat: number;
  lon: number;
};

export type Resolved2gisLink = {
  inputUrl: string;
  resolvedUrl: string;
  firmId: string;
  citySlug?: string;
  point?: GeoPoint;
};

export type NormalizedPlace = {
  firmId: string;
  name: string;
  address: string | null;
  fullAddress: string | null;
  rating: number | null;
  reviewsCount: number | null;
  schedule: unknown;
  rubrics: unknown[];
  contacts: unknown[];
  point: GeoPoint | null;
  raw: unknown;
};
