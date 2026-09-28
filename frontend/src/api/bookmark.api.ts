import { z } from "zod";
import { batchCheckResultSchema, bookmarkSchema, checkResultSchema, importResultSchema, type BatchCheckResult, type Bookmark, type CheckResult, type ImportResult } from "../type/bookmark.type";
import { api } from "./apiInstance.api";

export async function listBookmarks(): Promise<Bookmark[]> {
  const { data } = await api.get("/bookmark");
  return z.array(bookmarkSchema).parse(data);
}

/**
 * POST /bookmark/import
 * Uploads a browser bookmarks export (.html). The server scrapes the latest
 * chapter for every supported link, so large files can take a while.
 */
export async function importBookmarks(file: File): Promise<ImportResult> {
  const body = new FormData();
  body.append("bookmarksFile", file);
  const { data } = await api.post("/bookmark/import", body, {
    timeout: 120_000,
  });
  return importResultSchema.parse(data);
}

/** GET /bookmark/:id/check: scrape one bookmark and update it if newer. */
export async function checkBookmark(id: string): Promise<CheckResult> {
  const { data } = await api.get(`/bookmark/${encodeURIComponent(id)}/check`);
  return checkResultSchema.parse(data);
}

/** GET /bookmark/check-all: check every bookmark (recently checked ones are skipped). */
export async function checkAllBookmarks(): Promise<BatchCheckResult> {
  const { data } = await api.get("/bookmark/check-all", { timeout: 120_000 });
  return batchCheckResultSchema.parse(data);
}
