-- CreateTable
CREATE TABLE `coin_transactions` (
    `f_transaction_id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_amount` INTEGER NOT NULL,
    `f_created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `f_memo` TEXT NULL,
    `f_receiver_user_id` INTEGER NOT NULL,
    `f_sender_user_id` INTEGER NULL,

    INDEX `coin_transactions_f_receiver_user_id_idx`(`f_receiver_user_id`),
    INDEX `coin_transactions_f_sender_user_id_idx`(`f_sender_user_id`),
    PRIMARY KEY (`f_transaction_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `coin_transactions` ADD CONSTRAINT `coin_transactions_f_receiver_user_id_fkey` FOREIGN KEY (`f_receiver_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `coin_transactions` ADD CONSTRAINT `coin_transactions_f_sender_user_id_fkey` FOREIGN KEY (`f_sender_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
