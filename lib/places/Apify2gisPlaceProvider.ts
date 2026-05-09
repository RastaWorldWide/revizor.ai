import { runApifyActor } from "@/lib/apify/client";
import type { GeoPoint, NormalizedPlace } from "@/lib/2gis/types";
import type { GetPlaceInput, PlaceProvider } from "./PlaceProvider";

const actorId = "zen-studio~2gis-places-scraper-api";

function getString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function getNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }

  return null;
}

function getArray(record: Record<string, unknown>, keys: string[]): unknown[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function getNestedRecord(record: Record<string, unknown>, keys: string[]): Record<string, unknown> | null {
  for (const key of keys) {
    const value = record[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }

  return null;
}

function getPoint(record: Record<string, unknown>, fallback?: GeoPoint): GeoPoint | null {
  const direct = getNestedRecord(record, ["point", "location", "coordinates"]);
  const pointSource = direct ?? record;

  const lat = getNumber(pointSource, ["lat", "latitude"]);
  const lon = getNumber(pointSource, ["lon", "lng", "longitude"]);

  if (lat !== null && lon !== null) {
    return { lat, lon };
  }

  return fallback ?? null;
}

function getReviewsCount(record: Record<string, unknown>): number | null {
  const reviews = getNestedRecord(record, ["reviews"]);
  const fromNested = reviews ? getNumber(reviews, ["count", "total", "reviewsCount"]) : null;

  return fromNested ?? getNumber(record, ["reviewsCount", "reviews_count", "reviewCount", "reviews"]);
}

function getRating(record: Record<string, unknown>): number | null {
  const reviews = getNestedRecord(record, ["reviews"]);
  const fromNested = reviews ? getNumber(reviews, ["general_rating", "rating", "score"]) : null;

  return fromNested ?? getNumber(record, ["rating", "stars", "score"]);
}

function normalizePlace(item: unknown, input: GetPlaceInput): NormalizedPlace {
  if (!item || typeof item !== "object") {
    throw new Error("Apify place item has invalid format");
  }

  const record = item as Record<string, unknown>;
  const firmId = getString(record, ["firmId", "firm_id", "id", "placeId", "2gisId", "dgisId"]) ?? input.resolved.firmId;
  const name = getString(record, ["name", "title", "companyName", "organizationName"]);

  if (!name) {
    throw new Error("Apify place item does not contain place name");
  }

  return {
    firmId,
    name,
    address: getString(record, ["address", "addressName", "address_name"]),
    fullAddress: getString(record, ["fullAddress", "full_address_name", "fullAddressName"]),
    rating: getRating(record),
    reviewsCount: getReviewsCount(record),
    schedule: record.schedule ?? record.workingHours ?? record.openingHours ?? null,
    rubrics: getArray(record, ["rubrics", "categories", "rubric"]),
    contacts: getArray(record, ["contacts", "contactGroups", "contact_groups", "phones"]),
    point: getPoint(record, input.resolved.point),
    raw: item
  };
}

export class Apify2gisPlaceProvider implements PlaceProvider {
  async getPlace(input: GetPlaceInput): Promise<NormalizedPlace> {
    const items = await runApifyActor<unknown>(actorId, {
      startUrls: [{ url: input.placeUrl }],
      maxItems: 1,
      maxPlaces: 1,
      includeReviews: false
    });

    const item = items[0];
    if (!item) {
      throw new Error("Apify did not return place data");
    }

    return normalizePlace(item, input);
  }
}
