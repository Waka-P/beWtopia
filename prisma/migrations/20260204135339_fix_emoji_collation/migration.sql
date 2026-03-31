-- AlterTable
ALTER TABLE `request_reactions` MODIFY `f_emoji` VARCHAR(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL;

-- AlterTable
ALTER TABLE `user_emoji_stats` MODIFY `f_emoji` VARCHAR(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL;
