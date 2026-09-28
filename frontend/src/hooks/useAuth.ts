import { useQuery } from "@tanstack/react-query";
import { ensureSession } from "../api/auth.api";

export const useSession = () => {
  return useQuery({
    queryKey: ["auth", "session"],
    queryFn: ensureSession,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
};
