import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  checkAllBookmarks,
  checkBookmark,
  importBookmarks,
  listBookmarks,
} from "../api/bookmark.api";
import { useFirebaseUid } from "./useAuth";

export const bookmarkKeys = {
  all: ["bookmarks"] as const,
  // Keyed by uid so a cached library can never leak across accounts.
  list: (uid: string) => [...bookmarkKeys.all, uid, "list"] as const,
};

/** Only runs once a Firebase user exists, so the request carries a valid token. */
export function useBookmarks() {
  const { uid } = useFirebaseUid();

  return useQuery({
    queryKey: bookmarkKeys.list(uid ?? ""),
    queryFn: listBookmarks,
    enabled: uid !== null,
  });
}

/**
 * Import, check-one and check-all all change stored data, so they are
 * mutations even though the check routes are GETs. Each one refreshes the
 * bookmark list when it succeeds.
 */
export function useImportBookmarks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => importBookmarks(file),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.all }),
  });
}

export function useCheckBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => checkBookmark(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.all }),
  });
}

export function useCheckAllBookmarks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: checkAllBookmarks,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.all }),
  });
}
