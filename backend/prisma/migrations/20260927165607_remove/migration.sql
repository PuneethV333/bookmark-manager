/*
  Warnings:

  - Made the column `comicProfilePic` on table `Bookmark` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Bookmark" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "comicProfilePic" TEXT NOT NULL,
    "title" TEXT,
    "site" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "lastChapter" REAL,
    "lastCheckedAt" DATETIME,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Bookmark" ("comicProfilePic", "createdAt", "id", "lastChapter", "lastCheckedAt", "site", "slug", "title", "updatedAt", "url", "userId") SELECT "comicProfilePic", "createdAt", "id", "lastChapter", "lastCheckedAt", "site", "slug", "title", "updatedAt", "url", "userId" FROM "Bookmark";
DROP TABLE "Bookmark";
ALTER TABLE "new_Bookmark" RENAME TO "Bookmark";
CREATE UNIQUE INDEX "Bookmark_userId_url_key" ON "Bookmark"("userId", "url");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
