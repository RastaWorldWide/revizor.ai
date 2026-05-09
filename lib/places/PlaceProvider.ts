import type { Resolved2gisLink, NormalizedPlace } from "@/lib/2gis/types";

export type GetPlaceInput = {
  placeUrl: string;
  resolved: Resolved2gisLink;
};

export interface PlaceProvider {
  getPlace(input: GetPlaceInput): Promise<NormalizedPlace>;
}
