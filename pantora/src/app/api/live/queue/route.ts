import { z } from "zod";
import { config } from "@/server/config";
import { HttpError, apiUser, handler, ok, parseBody } from "@/server/http";
import { joinQueue, leaveQueue, pollQueue } from "@/server/live";

function ensureEnabled() {
  if (!config.live.enabled) throw new HttpError(404, "Live matching is not enabled on this server.");
}

export const POST = handler(async (request: Request) => {
  ensureEnabled();
  const user = await apiUser();
  const body = await parseBody(request, z.object({ topicId: z.string().max(80).nullable(), durationMinutes: z.union([z.literal(5), z.literal(10), z.literal(15)]) }));
  return ok(joinQueue(user, body));
});

export const GET = handler(async () => {
  ensureEnabled();
  const user = await apiUser();
  return ok({ ...pollQueue(user.id), iceServers: config.live.iceServers });
});

export const DELETE = handler(async () => {
  ensureEnabled();
  const user = await apiUser();
  leaveQueue(user.id);
  return ok({ left: true });
});
