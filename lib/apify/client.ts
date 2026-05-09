import { requireEnv } from "@/lib/env";

export type ApifyRun = {
  id: string;
  status: string;
  defaultDatasetId?: string;
};

type ApifyRunResponse = {
  data: ApifyRun;
};

function apiUrl(path: string, token: string): string {
  const url = new URL(`https://api.apify.com/v2/${path}`);
  url.searchParams.set("token", token);
  return url.toString();
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Apify API failed: ${response.status} ${details}`);
  }

  return (await response.json()) as T;
}

export async function startApifyActor(actorId: string, input: Record<string, unknown>): Promise<ApifyRun> {
  const token = requireEnv("APIFY_TOKEN");
  const response = await fetch(apiUrl(`acts/${actorId}/runs`, token), {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = await readJson<ApifyRunResponse>(response);

  return payload.data;
}

export async function waitForApifyRun(runId: string): Promise<ApifyRun> {
  const token = requireEnv("APIFY_TOKEN");

  for (let attempt = 0; attempt < 120; attempt += 1) {
    const response = await fetch(apiUrl(`actor-runs/${runId}`, token), {
      cache: "no-store"
    });
    const payload = await readJson<ApifyRunResponse>(response);

    if (payload.data.status === "SUCCEEDED") {
      return payload.data;
    }

    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(payload.data.status)) {
      throw new Error(`Apify run finished with status: ${payload.data.status}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  throw new Error("Apify run timed out");
}

export async function getApifyDatasetItems<T>(datasetId: string): Promise<T[]> {
  const token = requireEnv("APIFY_TOKEN");
  const response = await fetch(apiUrl(`datasets/${datasetId}/items`, token), {
    cache: "no-store"
  });

  return readJson<T[]>(response);
}

export async function runApifyActor<T>(actorId: string, input: Record<string, unknown>): Promise<T[]> {
  const started = await startApifyActor(actorId, input);
  const run = await waitForApifyRun(started.id);

  if (!run.defaultDatasetId) {
    throw new Error("Apify run did not return defaultDatasetId");
  }

  return getApifyDatasetItems<T>(run.defaultDatasetId);
}
