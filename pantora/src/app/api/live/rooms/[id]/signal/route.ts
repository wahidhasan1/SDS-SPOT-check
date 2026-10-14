import { z } from "zod";
import { config } from "@/server/config";
import { HttpError, apiUser, handler, ok, parseBody } from "@/server/http";
import { addSignal, assertRoomMember, readSignals } from "@/server/live";

type Ctx = { params: Promise<{ id: string }> };

async function member(ctx: Ctx) {
  if (!config.live.enabled) throw new HttpError(404, "Live matching is not enabled on this server.");
  const user = await apiUser();
  const { id } = await ctx.params;
  const room = assertRoomMember(id, user.id);
  if (!room) throw new HttpError(404, "Room not found.");
  return { user, id, room };
}

export const POST = handler(async (request: Request, ctx: Ctx) => {
  const { user, id } = await member(ctx);
  const body = await parseBody(request, z.object({ kind: z.enum(["offer", "answer", "candidate", "bye"]), payload: z.unknown() }));
  if (JSON.stringify(body.payload ?? null).length > 20_000) throw new HttpError(413, "Signal too large.");
  addSignal(id, user.id, body.kind, body.payload);
  return ok({ sent: true });
});

export const GET = handler(async (request: Request, ctx: Ctx) => {
  const { user, id, room } = await member(ctx);
  const after = Number(new URL(request.url).searchParams.get("after") ?? 0) || 0;
  return ok({ status: room.status, signals: readSignals(id, user.id, after) });
});
