-- CreateTable
CREATE TABLE `user_follows` (
    `f_follower_id` INTEGER NOT NULL,
    `f_following_id` INTEGER NOT NULL,

    INDEX `user_follows_f_following_id_idx`(`f_following_id`),
    PRIMARY KEY (`f_follower_id`, `f_following_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_follows` ADD CONSTRAINT `user_follows_f_follower_id_fkey` FOREIGN KEY (`f_follower_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_follows` ADD CONSTRAINT `user_follows_f_following_id_fkey` FOREIGN KEY (`f_following_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
