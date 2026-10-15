import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, isOpenPath } from "@/lib/access";
import { accessCode, hasAccess } from "@/server/access";

// Private-test gate. When PANTORA_ACCESS_CODE is set, every page and API call
// needs the access code first, and search engines are told not to index the
// site. Without the variable (local development, tests) this does nothing.

const NO_INDEX = "noindex, nofollow, noarchive";

export function proxy(request: NextRequest) {
  const code = accessCode();
  if (!code) return NextResponse.next();
  const { pathname, search } = request.nextUrl;

  if (pathname === "/robots.txt") {
    return new NextResponse("User-agent: *\nDisallow: /\n", { headers: { "content-type": "text/plain", "X-Robots-Tag": NO_INDEX } });
  }

  if (!isOpenPath(pathname) && !hasAccess(request.cookies.get(ACCESS_COOKIE)?.value, code)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "This is a private test. Enter the access code first." }, { status: 401, headers: { "X-Robots-Tag": NO_INDEX } });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/access";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    const res = NextResponse.redirect(url);
    res.headers.set("X-Robots-Tag", NO_INDEX);
    return res;
  }

  const res = NextResponse.next();
  res.headers.set("X-Robots-Tag", NO_INDEX);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
