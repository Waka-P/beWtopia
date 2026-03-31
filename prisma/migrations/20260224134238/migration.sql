-- CreateTable
CREATE TABLE `chat_orders` (
    `f_chat_order_id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` CHAR(21) NOT NULL,
    `f_title` VARCHAR(100) NOT NULL,
    `f_description` TEXT NOT NULL,
    `f_price` INTEGER NULL,
    `f_deadline` DATETIME(3) NULL,
    `f_status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `f_requester_user_id` INTEGER NOT NULL,
    `f_target_user_id` INTEGER NOT NULL,
    `f_message_id` INTEGER NOT NULL,
    `f_created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `f_updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `chat_orders_publicId_key`(`publicId`),
    UNIQUE INDEX `chat_orders_f_message_id_key`(`f_message_id`),
    INDEX `chat_orders_f_requester_user_id_idx`(`f_requester_user_id`),
    INDEX `chat_orders_f_target_user_id_idx`(`f_target_user_id`),
    PRIMARY KEY (`f_chat_order_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `chat_orders` ADD CONSTRAINT `chat_orders_f_requester_user_id_fkey` FOREIGN KEY (`f_requester_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_orders` ADD CONSTRAINT `chat_orders_f_target_user_id_fkey` FOREIGN KEY (`f_target_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_orders` ADD CONSTRAINT `chat_orders_f_message_id_fkey` FOREIGN KEY (`f_message_id`) REFERENCES `chat_messages`(`f_message_id`) ON DELETE CASCADE ON UPDATE CASCADE;
