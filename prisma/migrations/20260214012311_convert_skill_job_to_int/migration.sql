/*
  Warnings:

  - You are about to alter the column `f_skill_id` on the `bewts_skills` table. The data in that column could be lost. The data in that column will be cast from `Char(6)` to `Int`.
  - The primary key for the `jobs` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `f_job_id` on the `jobs` table. The data in that column could be lost. The data in that column will be cast from `Char(6)` to `Int`.
  - The primary key for the `skills` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `f_skill_id` on the `skills` table. The data in that column could be lost. The data in that column will be cast from `Char(6)` to `Int`.
  - The primary key for the `user_jobs` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `f_job_id` on the `user_jobs` table. The data in that column could be lost. The data in that column will be cast from `Char(6)` to `Int`.
  - The primary key for the `user_skills` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `f_skill_id` on the `user_skills` table. The data in that column could be lost. The data in that column will be cast from `Char(6)` to `Int`.

*/
-- DropForeignKey
ALTER TABLE `bewts_skills` DROP FOREIGN KEY `bewts_skills_f_skill_id_fkey`;

-- DropForeignKey
ALTER TABLE `user_jobs` DROP FOREIGN KEY `user_jobs_f_job_id_fkey`;

-- DropForeignKey
ALTER TABLE `user_skills` DROP FOREIGN KEY `user_skills_f_skill_id_fkey`;

-- AlterTable
ALTER TABLE `bewts_skills` MODIFY `f_skill_id` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `jobs` DROP PRIMARY KEY,
    MODIFY `f_job_id` INTEGER NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`f_job_id`);

-- AlterTable
ALTER TABLE `skills` DROP PRIMARY KEY,
    MODIFY `f_skill_id` INTEGER NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`f_skill_id`);

-- AlterTable
ALTER TABLE `user_jobs` DROP PRIMARY KEY,
    MODIFY `f_job_id` INTEGER NOT NULL,
    ADD PRIMARY KEY (`f_user_id`, `f_job_id`);

-- AlterTable
ALTER TABLE `user_skills` DROP PRIMARY KEY,
    MODIFY `f_skill_id` INTEGER NOT NULL,
    ADD PRIMARY KEY (`f_user_id`, `f_skill_id`);

-- AddForeignKey
ALTER TABLE `user_jobs` ADD CONSTRAINT `user_jobs_f_job_id_fkey` FOREIGN KEY (`f_job_id`) REFERENCES `jobs`(`f_job_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_skills` ADD CONSTRAINT `user_skills_f_skill_id_fkey` FOREIGN KEY (`f_skill_id`) REFERENCES `skills`(`f_skill_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bewts_skills` ADD CONSTRAINT `bewts_skills_f_skill_id_fkey` FOREIGN KEY (`f_skill_id`) REFERENCES `skills`(`f_skill_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
