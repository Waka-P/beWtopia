-- CreateTable
CREATE TABLE `chat_message_reads` (
    `f_message_id` INTEGER NOT NULL,
    `f_user_id` INTEGER NOT NULL,
    `f_read_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `chat_message_reads_f_message_id_idx`(`f_message_id`),
    INDEX `chat_message_reads_f_user_id_idx`(`f_user_id`),
    PRIMARY KEY (`f_message_id`, `f_user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `chat_message_reads` ADD CONSTRAINT `chat_message_reads_f_message_id_fkey` FOREIGN KEY (`f_message_id`) REFERENCES `chat_messages`(`f_message_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_message_reads` ADD CONSTRAINT `chat_message_reads_f_user_id_fkey` FOREIGN KEY (`f_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
