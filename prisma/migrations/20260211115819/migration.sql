-- CreateTable
CREATE TABLE `user_blocks` (
    `f_blocked_id` INTEGER NOT NULL,
    `f_blocker_id` INTEGER NOT NULL,

    INDEX `user_blocks_f_blocker_id_idx`(`f_blocker_id`),
    PRIMARY KEY (`f_blocked_id`, `f_blocker_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_blocks` ADD CONSTRAINT `user_blocks_f_blocked_id_fkey` FOREIGN KEY (`f_blocked_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_blocks` ADD CONSTRAINT `user_blocks_f_blocker_id_fkey` FOREIGN KEY (`f_blocker_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
