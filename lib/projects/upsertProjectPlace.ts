import { Prisma } from "@prisma/client";
import type { NormalizedPlace } from "@/lib/2gis/types";
import { getDb } from "@/lib/db";
import { slugify, withShortId } from "@/lib/slugify";

function json(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return (value ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull;
}

export async function upsertProjectPlace(input: {
  sourceUrl: string;
  place: NormalizedPlace;
}) {
  const db = getDb();
  const slug = withShortId(slugify(input.place.name), input.place.firmId);

  return db.project.upsert({
    where: {
      slug
    },
    update: {
      sourceUrl: input.sourceUrl,
      place: {
        upsert: {
          create: {
            firmId: input.place.firmId,
            name: input.place.name,
            address: input.place.address,
            fullAddress: input.place.fullAddress,
            rating: input.place.rating,
            reviewsCount: input.place.reviewsCount,
            schedule: json(input.place.schedule),
            rubrics: json(input.place.rubrics),
            contacts: json(input.place.contacts),
            point: json(input.place.point),
            raw: json(input.place.raw)
          },
          update: {
            name: input.place.name,
            address: input.place.address,
            fullAddress: input.place.fullAddress,
            rating: input.place.rating,
            reviewsCount: input.place.reviewsCount,
            schedule: json(input.place.schedule),
            rubrics: json(input.place.rubrics),
            contacts: json(input.place.contacts),
            point: json(input.place.point),
            raw: json(input.place.raw)
          }
        }
      }
    },
    create: {
      slug,
      sourceUrl: input.sourceUrl,
      place: {
        create: {
          firmId: input.place.firmId,
          name: input.place.name,
          address: input.place.address,
          fullAddress: input.place.fullAddress,
          rating: input.place.rating,
          reviewsCount: input.place.reviewsCount,
          schedule: json(input.place.schedule),
          rubrics: json(input.place.rubrics),
          contacts: json(input.place.contacts),
          point: json(input.place.point),
          raw: json(input.place.raw)
        }
      }
    },
    include: {
      place: true
    }
  });
}
