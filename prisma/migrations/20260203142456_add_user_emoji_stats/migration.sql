-- CreateTable
CREATE TABLE `user_emoji_stats` (
    `f_stats_id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_emoji` VARCHAR(10) NOT NULL,
    `f_use_count` INTEGER NOT NULL DEFAULT 0,
    `f_updated_at` DATETIME(3) NOT NULL,
    `f_user_id` INTEGER NOT NULL,

    INDEX `user_emoji_stats_f_user_id_f_use_count_idx`(`f_user_id`, `f_use_count`),
    UNIQUE INDEX `user_emoji_stats_f_user_id_f_emoji_key`(`f_user_id`, `f_emoji`),
    PRIMARY KEY (`f_stats_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_emoji_stats` ADD CONSTRAINT `user_emoji_stats_f_user_id_fkey` FOREIGN KEY (`f_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
