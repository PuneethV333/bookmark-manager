import type { Bookmark } from "../type/bookmark.type";
import { humanizeSlug } from "./format";

export type BookmarkStatus = "idle" | "new" | "checking" | "issue";
export type LibraryFilter = "all" | Exclude<BookmarkStatus, "idle">;
export type SortKey = "recent" | "title" | "chapter";

export const ALL_SITES = "all";

export interface LibraryView {
  query: string;
  site: string;
  filter: LibraryFilter;
  sort: SortKey;
}

export function bookmarkTitle(bookmark: Pick<Bookmark, "title" | "slug">): string {
  return bookmark.title?.trim() || humanizeSlug(bookmark.slug);
}

export function getSites(bookmarks: Bookmark[]): string[] {
  return [...new Set(bookmarks.map((bookmark) => bookmark.site))].sort();
}

export function countByStatus(
  bookmarks: Bookmark[],
  statusOf: (id: string) => BookmarkStatus,
): Record<LibraryFilter, number> {
  const counts: Record<LibraryFilter, number> = {
    all: bookmarks.length,
    new: 0,
    checking: 0,
    issue: 0,
  };
  for (const bookmark of bookmarks) {
    const status = statusOf(bookmark.id);
    if (status !== "idle") counts[status] += 1;
  }
  return counts;
}

/** Larger numbers first; nulls always last. */
function compareDescNullsLast(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

function checkedTime(bookmark: Bookmark): number | null {
  return bookmark.lastCheckedAt ? Date.parse(bookmark.lastCheckedAt) : null;
}

export function applyLibraryView(
  bookmarks: Bookmark[],
  { query, site, filter, sort }: LibraryView,
  statusOf: (id: string) => BookmarkStatus,
): Bookmark[] {
  const needle = query.trim().toLowerCase();

  const matches = bookmarks.filter((bookmark) => {
    if (site !== ALL_SITES && bookmark.site !== site) return false;
    if (filter !== "all" && statusOf(bookmark.id) !== filter) return false;
    if (!needle) return true;
    return (
      bookmarkTitle(bookmark).toLowerCase().includes(needle) ||
      bookmark.slug.toLowerCase().includes(needle)
    );
  });

  return matches.sort((a, b) => {
    if (sort === "title") return bookmarkTitle(a).localeCompare(bookmarkTitle(b));
    if (sort === "chapter") return compareDescNullsLast(a.lastChapter, b.lastChapter);
    return compareDescNullsLast(checkedTime(a), checkedTime(b));
  });
}

/** Most recent lastCheckedAt across the library, or null if nothing was checked yet. */
export function latestCheck(bookmarks: Bookmark[]): string | null {
  let latest: string | null = null;
  for (const { lastCheckedAt } of bookmarks) {
    if (lastCheckedAt && (!latest || Date.parse(lastCheckedAt) > Date.parse(latest))) {
      latest = lastCheckedAt;
    }
  }
  return latest;
}
