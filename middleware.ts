import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const reservedSubdomains = new Set(["", "www", "app"]);

function rewriteForSubdomain(request: NextRequest, subdomain: string) {
  if (reservedSubdomains.has(subdomain)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/s/${subdomain}${url.pathname === "/" ? "" : url.pathname}`;
  return NextResponse.rewrite(url);
}

export function middleware(request: NextRequest) {
  const host = (request.headers.get("host") || "").toLowerCase();
  const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000").toLowerCase();

  if (host.endsWith(`.${rootDomain}`)) {
    const subdomain = host.slice(0, -(rootDomain.length + 1));
    return rewriteForSubdomain(request, subdomain);
  }

  const localhostMatch = host.match(/^([a-z0-9-]+)\.localhost(?::\d+)?$/);
  if (localhostMatch?.[1]) {
    return rewriteForSubdomain(request, localhostMatch[1]);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]
};
