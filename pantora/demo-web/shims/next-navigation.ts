import { useSyncExternalStore } from "react";
import { NotFoundSignal, RedirectSignal, router } from "../router-core";

export function useRouter() {
  return { push: router.push, replace: router.replace, refresh: router.refresh, back: router.back, prefetch: () => {} };
}

export function usePathname() {
  useSyncExternalStore(router.subscribe, router.snapshot, router.snapshot);
  return router.location.path;
}

export function useSearchParams() {
  useSyncExternalStore(router.subscribe, router.snapshot, router.snapshot);
  return new URLSearchParams(router.location.search);
}

export function redirect(to: string): never {
  throw new RedirectSignal(to);
}

export function notFound(): never {
  throw new NotFoundSignal();
}
