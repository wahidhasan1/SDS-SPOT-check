// Runs Pantora's API route handlers inside the page. `fetch("/api/...")` calls
// from the UI are dispatched here, so the hosted demo uses the exact same
// validation, business rules, and database code as the full app.
import * as onboarding from "@/app/api/onboarding/route";
import * as demoStart from "@/app/api/demo/start/route";
import * as signout from "@/app/api/auth/signout/route";
import * as notificationsRead from "@/app/api/notifications/read/route";
import * as settings from "@/app/api/settings/route";
import * as account from "@/app/api/account/route";
import * as match from "@/app/api/match/route";
import * as transcribe from "@/app/api/transcribe/route";
import * as coach from "@/app/api/coach/route";
import * as battles from "@/app/api/battles/route";
import * as freeTalk from "@/app/api/sessions/free-talk/route";
import * as topicFavorite from "@/app/api/topics/[id]/favorite/route";
import * as feedbackReview from "@/app/api/feedback/[id]/review/route";
import * as questClaim from "@/app/api/quests/[id]/claim/route";
import * as entryReview from "@/app/api/transcript-entries/[id]/review/route";
import * as savedSentences from "@/app/api/saved-sentences/route";
import * as savedSentence from "@/app/api/saved-sentences/[id]/route";
import * as safetyReport from "@/app/api/safety/report/route";
import * as safetyBlock from "@/app/api/safety/block/route";
import * as helpFeedback from "@/app/api/help/feedback/route";
import * as adminAccess from "@/app/api/admin/access/route";
import * as adminReset from "@/app/api/admin/reset/route";
import * as adminReport from "@/app/api/admin/reports/[id]/route";
import { saveNow } from "./browser-db";

type Handler = (request: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
type RouteModule = Partial<Record<"GET" | "POST" | "PATCH" | "DELETE", Handler>>;

const ROUTES: [RegExp, RouteModule, string[]][] = [
  [/^\/api\/onboarding$/, onboarding, []],
  [/^\/api\/demo\/start$/, demoStart, []],
  [/^\/api\/auth\/signout$/, signout, []],
  [/^\/api\/notifications\/read$/, notificationsRead, []],
  [/^\/api\/settings$/, settings, []],
  [/^\/api\/account$/, account, []],
  [/^\/api\/match$/, match, []],
  [/^\/api\/transcribe$/, transcribe as unknown as RouteModule, []],
  [/^\/api\/coach$/, coach, []],
  [/^\/api\/battles$/, battles, []],
  [/^\/api\/sessions\/free-talk$/, freeTalk, []],
  [/^\/api\/topics\/([^/]+)\/favorite$/, topicFavorite, ["id"]],
  [/^\/api\/feedback\/([^/]+)\/review$/, feedbackReview, ["id"]],
  [/^\/api\/quests\/([^/]+)\/claim$/, questClaim, ["id"]],
  [/^\/api\/transcript-entries\/([^/]+)\/review$/, entryReview, ["id"]],
  [/^\/api\/saved-sentences$/, savedSentences, []],
  [/^\/api\/saved-sentences\/([^/]+)$/, savedSentence, ["id"]],
  [/^\/api\/safety\/report$/, safetyReport, []],
  [/^\/api\/safety\/block$/, safetyBlock, []],
  [/^\/api\/help\/feedback$/, helpFeedback, []],
  [/^\/api\/admin\/access$/, adminAccess, []],
  [/^\/api\/admin\/reset$/, adminReset, []],
  [/^\/api\/admin\/reports\/([^/]+)$/, adminReport, ["id"]],
];

export async function dispatch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = new Request(new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, "https://pantora.demo"), init);
  const { pathname } = new URL(request.url);
  const method = request.method.toUpperCase() as "GET" | "POST" | "PATCH" | "DELETE";
  for (const [re, mod, names] of ROUTES) {
    const m = re.exec(pathname);
    if (!m) continue;
    const fn = mod[method];
    if (!fn) return Response.json({ error: "Method not allowed." }, { status: 405 });
    const params = Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(m[i + 1])]));
    const res = await fn(request, { params: Promise.resolve(params as { id: string }) });
    if (method !== "GET") void saveNow();
    return res;
  }
  return Response.json({ error: "Not available in the hosted demo." }, { status: 404 });
}

/** Routes same-origin `/api/...` fetches to the in-page handlers. */
export function installFetchRouter() {
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith("/api/")) return dispatch(input, init);
    return original(input, init);
  };
}
