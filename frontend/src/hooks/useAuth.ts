import { queryOptions, useQuery } from "@tanstack/react-query";
import { ensureSession } from "../api/auth.api";

export const authKeys = {
  session: ["auth", "session"] as const,
};

export const sessionQueryOptions = queryOptions({
  queryKey: authKeys.session,
  queryFn: ensureSession,
  staleTime: Infinity,
  gcTime: Infinity,
  retry: 1,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
});

export const useSession = () => useQuery(sessionQueryOptions);