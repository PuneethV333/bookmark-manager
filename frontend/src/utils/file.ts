export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

/** Returns an error message for an unusable bookmarks export, or null when the file is fine. */
export function validateBookmarkFile(file: File): string | null {
  if (!/\.html?$/i.test(file.name)) {
    return "Choose the .html file exported from your browser.";
  }
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_IMPORT_BYTES) return "That file is larger than 10 MB.";
  return null;
}
