/*
Warnings:

- You are about to alter the column `f_privacy_category_id` on the `privacy_settings` table. The data in that column could be lost. The data in that column will be cast from `CHAR(6)` to `INT`.
- The primary key for the `privacy_categories` table will be changed. If it partially fails, the table could be left without primary key constraint.
- You are about to alter the column `f_privacy_category_id` on the `privacy_categories` table. The data in that column could be lost. The data in that column will be cast from `CHAR(6)` to `INT`.

 */
-- DropForeignKey
ALTER TABLE `privacy_settings`
DROP FOREIGN KEY `privacy_settings_f_privacy_category_id_fkey`;

-- AlterTable
ALTER TABLE `privacy_settings`
MODIFY `f_privacy_category_id` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `privacy_categories`
DROP PRIMARY KEY,
MODIFY `f_privacy_category_id` INTEGER NOT NULL AUTO_INCREMENT,
ADD PRIMARY KEY (`f_privacy_category_id`);

-- AddForeignKey
ALTER TABLE `privacy_settings`
ADD CONSTRAINT `privacy_settings_f_privacy_category_id_fkey` FOREIGN KEY (`f_privacy_category_id`) REFERENCES `privacy_categories` (`f_privacy_category_id`) ON DELETE CASCADE ON UPDATE CASCADE;