// Data hooks on top of TanStack Query. Every mutation refreshes all active queries, which keeps
// counts, queues, lists and the open bug consistent without per-screen bookkeeping.

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ActionItemsResponse,
  AuditResponse,
  AuthStatus,
  BugDetail,
  BugListResponse,
  ContributionsResponse,
  DashboardResponse,
  EngineeringResponse,
  ModulesResponse,
  NotificationsResponse,
  RegressionQueueItem,
  ViewCounts,
} from "../../core/api";
import type { BugListItem, SimilarBug, Workspace } from "../../core/types";
import { useApi, useToast } from "../app/context";
import { ApiError, type ApiClient } from "./client";

const LIVE = 30_000;

export function useAuthStatus() {
  const api = useApi();
  return useQuery({ queryKey: ["auth-status"], queryFn: () => api.get<AuthStatus>("/auth/status"), staleTime: 60_000 });
}

export function useWorkspaceQuery(enabled: boolean) {
  const api = useApi();
  return useQuery({ queryKey: ["workspace"], queryFn: () => api.get<Workspace>("/workspace"), enabled, staleTime: 60_000, retry: false });
}

export function useCounts() {
  const api = useApi();
  return useQuery({ queryKey: ["counts"], queryFn: () => api.get<ViewCounts>("/me/counts"), refetchInterval: LIVE });
}

export type BugListParams = Record<string, string | number | string[] | undefined>;

export function useBugs(params: BugListParams) {
  const api = useApi();
  return useQuery({
    queryKey: ["bugs", params],
    queryFn: () => api.get<BugListResponse>("/bugs", params),
    placeholderData: keepPreviousData,
    refetchInterval: LIVE,
  });
}

export function useBug(ref: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: ["bug", ref],
    queryFn: () => api.get<BugDetail>(`/bugs/${encodeURIComponent(ref!)}`),
    enabled: !!ref,
    refetchInterval: LIVE,
  });
}

export function useSimilarForBug(ref: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: ["similar-bug", ref],
    queryFn: () => api.get<{ items: SimilarBug[] }>(`/bugs/${encodeURIComponent(ref!)}/similar`),
    enabled: !!ref,
    staleTime: 60_000,
  });
}

export function useActionItems() {
  const api = useApi();
  return useQuery({ queryKey: ["action-items"], queryFn: () => api.get<ActionItemsResponse>("/action-items"), refetchInterval: LIVE });
}

export function useRegressionQueue(scope: "mine" | "all") {
  const api = useApi();
  return useQuery({
    queryKey: ["regression", scope],
    queryFn: () => api.get<{ items: RegressionQueueItem[] }>("/regression", { scope }),
    refetchInterval: LIVE,
  });
}

export function useNotifications(limit = 100) {
  const api = useApi();
  return useQuery({
    queryKey: ["notifications", limit],
    queryFn: () => api.get<NotificationsResponse>("/notifications", { limit }),
    refetchInterval: LIVE,
  });
}

export function useSearch(q: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["search", q],
    queryFn: () => api.get<{ items: BugListItem[]; total: number }>("/search", { q }),
    enabled: q.trim().length > 0,
    staleTime: 10_000,
    placeholderData: keepPreviousData,
  });
}

export function useDashboard(params: { project?: string; days: number }) {
  const api = useApi();
  return useQuery({
    queryKey: ["dashboard", params],
    queryFn: () => api.get<DashboardResponse>("/dashboard", params),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}

export function useContributions(params: { project?: string; weeks: number }) {
  const api = useApi();
  return useQuery({
    queryKey: ["contributions", params],
    queryFn: () => api.get<ContributionsResponse>("/analytics/contributions", params),
    placeholderData: keepPreviousData,
  });
}

export function useEngineering(params: { project?: string; days: number }) {
  const api = useApi();
  return useQuery({
    queryKey: ["engineering", params],
    queryFn: () => api.get<EngineeringResponse>("/analytics/engineering", params),
    placeholderData: keepPreviousData,
  });
}

export function useModuleHealth(params: { project?: string }) {
  const api = useApi();
  return useQuery({
    queryKey: ["modules", params],
    queryFn: () => api.get<ModulesResponse>("/analytics/modules", params),
    placeholderData: keepPreviousData,
  });
}

export function useAudit(params: Record<string, string | number | undefined>) {
  const api = useApi();
  return useQuery({
    queryKey: ["audit", params],
    queryFn: () => api.get<AuditResponse>("/admin/audit", params),
    placeholderData: keepPreviousData,
  });
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}

/** A mutation that refreshes everything on success and reports errors as toasts. */
export function useMutate<TArgs, TResult>(
  fn: (api: ApiClient, args: TArgs) => Promise<TResult>,
  opts: { success?: string | ((r: TResult, args: TArgs) => string | null); silentError?: boolean } = {},
) {
  const api = useApi();
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (args: TArgs) => fn(api, args),
    onSuccess: async (result, args) => {
      await qc.invalidateQueries();
      const msg = typeof opts.success === "function" ? opts.success(result, args) : opts.success;
      if (msg) toast(msg);
    },
    onError: (err) => {
      if (!opts.silentError) toast(errorMessage(err), "error");
    },
  });
}
