import {
  queryOptions,
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
import { sessionQueryOptions } from "./useAuth";

export const bookmarkKeys = {
  all: ["bookmarks"] as const,
  list: () => [...bookmarkKeys.all, "list"] as const,
};

export const bookmarksQueryOptions = queryOptions({
  queryKey: bookmarkKeys.list(),
  queryFn: listBookmarks,
});

/** Waits for the guest session, so the cookie exists before the first request. */
export function useBookmarks() {
  const session = useQuery(sessionQueryOptions);

  return useQuery({
    ...bookmarksQueryOptions,
    enabled: session.isSuccess,
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
    mutationFn: async (file: File) => {
      await queryClient.ensureQueryData(sessionQueryOptions);
      return importBookmarks(file);
    },
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
