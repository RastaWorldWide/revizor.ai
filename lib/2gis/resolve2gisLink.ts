import { z } from "zod";
import type { GeoPoint, Resolved2gisLink } from "./types";

const allowedHosts = new Set(["2gis.ru", "go.2gis.com"]);

const urlSchema = z.string().url();

function isAllowed2gisHost(hostname: string): boolean {
  return allowedHosts.has(hostname) || hostname.endsWith(".2gis.ru") || hostname.endsWith(".2gis.com");
}

async function followRedirects(inputUrl: string): Promise<string> {
  const response = await fetch(inputUrl, {
    method: "GET",
    redirect: "follow",
    headers: {
      "user-agent": "revizor.ai link resolver"
    }
  });

  return response.url || inputUrl;
}

function extractFirmId(url: URL): string | null {
  const pathname = decodeURIComponent(url.pathname);
  const match = pathname.match(/\/firm\/(\d+)/);

  if (match?.[1]) {
    return match[1];
  }

  const queryId = url.searchParams.get("firmId") || url.searchParams.get("id");
  return queryId && /^\d+$/.test(queryId) ? queryId : null;
}

function extractCitySlug(url: URL): string | undefined {
  const parts = url.pathname.split("/").filter(Boolean);
  const firmIndex = parts.findIndex((part) => part === "firm");

  if (firmIndex > 0) {
    return parts[firmIndex - 1];
  }

  if (parts[0] && parts[0] !== "firm" && !parts[0].includes(".")) {
    return parts[0];
  }

  return undefined;
}

function toPoint(lon: string, lat: string): GeoPoint | undefined {
  const parsedLon = Number(lon);
  const parsedLat = Number(lat);

  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLon)) {
    return undefined;
  }

  return {
    lat: parsedLat,
    lon: parsedLon
  };
}

function extractCoordinates(url: URL): GeoPoint | undefined {
  const centerMatch = decodeURIComponent(url.pathname).match(/\/center\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (centerMatch?.[1] && centerMatch[2]) {
    return toPoint(centerMatch[1], centerMatch[2]);
  }

  const m = url.searchParams.get("m");
  const mMatch = m?.match(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (mMatch?.[1] && mMatch[2]) {
    return toPoint(mMatch[1], mMatch[2]);
  }

  const ll = url.searchParams.get("ll");
  const llMatch = ll?.match(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (llMatch?.[1] && llMatch[2]) {
    return toPoint(llMatch[1], llMatch[2]);
  }

  return undefined;
}

export async function resolve2gisLink(inputUrl: string): Promise<Resolved2gisLink> {
  const parsedInput = new URL(urlSchema.parse(inputUrl));

  if (!isAllowed2gisHost(parsedInput.hostname)) {
    throw new Error("Only 2GIS links are supported");
  }

  const resolvedUrl = parsedInput.hostname === "go.2gis.com" ? await followRedirects(inputUrl) : inputUrl;
  const parsedResolved = new URL(resolvedUrl);

  if (!isAllowed2gisHost(parsedResolved.hostname)) {
    throw new Error("2GIS short link resolved to an unsupported host");
  }

  const firmId = extractFirmId(parsedResolved);

  if (!firmId) {
    throw new Error("Could not extract firmId from 2GIS link");
  }

  return {
    inputUrl,
    resolvedUrl,
    firmId,
    citySlug: extractCitySlug(parsedResolved),
    point: extractCoordinates(parsedResolved)
  };
}
