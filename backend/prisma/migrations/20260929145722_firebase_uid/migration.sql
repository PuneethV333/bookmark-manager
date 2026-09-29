/*
  Warnings:

  - A unique constraint covering the columns `[firebaseUid,url]` on the table `Bookmark` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[firebaseUid]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `firebaseUid` to the `Bookmark` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firebaseUid` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Bookmark" DROP CONSTRAINT "Bookmark_userId_fkey";

-- DropIndex
DROP INDEX "Bookmark_userId_url_key";

-- AlterTable
ALTER TABLE "Bookmark" ADD COLUMN     "firebaseUid" TEXT NOT NULL,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "firebaseUid" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Bookmark_firebaseUid_idx" ON "Bookmark"("firebaseUid");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_firebaseUid_url_key" ON "Bookmark"("firebaseUid", "url");

-- CreateIndex
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
