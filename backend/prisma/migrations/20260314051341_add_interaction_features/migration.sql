/*
  Warnings:

  - You are about to drop the column `rating` on the `Comic` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Comic` table. All the data in the column will be lost.
  - You are about to drop the column `chapterId` on the `Comment` table. All the data in the column will be lost.
  - You are about to drop the column `parentId` on the `Comment` table. All the data in the column will be lost.
  - You are about to drop the column `preferences` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `User` table. All the data in the column will be lost.
  - The `role` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `ChapterImage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Genre` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Message` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_ComicToGenre` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `description` on table `Comic` required. This step will fail if there are existing NULL values in that column.
  - Made the column `comicId` on table `Comment` required. This step will fail if there are existing NULL values in that column.
  - Changed the type of `type` on the `Transaction` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `description` on table `Transaction` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "ChapterImage" DROP CONSTRAINT "ChapterImage_chapterId_fkey";

-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_chapterId_fkey";

-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_parentId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_receiverId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_senderId_fkey";

-- DropForeignKey
ALTER TABLE "_ComicToGenre" DROP CONSTRAINT "_ComicToGenre_A_fkey";

-- DropForeignKey
ALTER TABLE "_ComicToGenre" DROP CONSTRAINT "_ComicToGenre_B_fkey";

-- AlterTable
ALTER TABLE "Comic" DROP COLUMN "rating",
DROP COLUMN "status",
ADD COLUMN     "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "description" SET NOT NULL;

-- AlterTable
ALTER TABLE "Comment" DROP COLUMN "chapterId",
DROP COLUMN "parentId",
ALTER COLUMN "comicId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "type",
ADD COLUMN     "type" TEXT NOT NULL,
ALTER COLUMN "description" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "preferences",
DROP COLUMN "updatedAt",
DROP COLUMN "role",
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'USER';

-- DropTable
DROP TABLE "ChapterImage";

-- DropTable
DROP TABLE "Genre";

-- DropTable
DROP TABLE "Message";

-- DropTable
DROP TABLE "_ComicToGenre";

-- DropEnum
DROP TYPE "ComicStatus";

-- DropEnum
DROP TYPE "Role";

-- DropEnum
DROP TYPE "TxType";

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "comicId" TEXT NOT NULL,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "review" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "comicId" TEXT NOT NULL,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ComicToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ComicToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_comicId_key" ON "Favorite"("userId", "comicId");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_userId_comicId_key" ON "Rating"("userId", "comicId");

-- CreateIndex
CREATE INDEX "_ComicToTag_B_index" ON "_ComicToTag"("B");

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_comicId_fkey" FOREIGN KEY ("comicId") REFERENCES "Comic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_comicId_fkey" FOREIGN KEY ("comicId") REFERENCES "Comic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ComicToTag" ADD CONSTRAINT "_ComicToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Comic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ComicToTag" ADD CONSTRAINT "_ComicToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
