-- CreateTable
CREATE TABLE `checkout_sessions` (
    `f_checkout_id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_stripe_session_id` VARCHAR(191) NULL,
    `f_status` ENUM('CREATED', 'COMPLETED', 'CANCELED') NOT NULL DEFAULT 'CREATED',
    `f_mode` ENUM('P', 'S') NOT NULL,
    `f_created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `f_updated_at` DATETIME(3) NOT NULL,
    `f_user_id` INTEGER NOT NULL,

    UNIQUE INDEX `checkout_sessions_f_stripe_session_id_key`(`f_stripe_session_id`),
    INDEX `checkout_sessions_f_user_id_idx`(`f_user_id`),
    PRIMARY KEY (`f_checkout_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `checkout_items` (
    `f_checkout_item_id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_checkout_id` INTEGER NOT NULL,
    `f_app_id` INTEGER NOT NULL,
    `f_sales_plan_id` INTEGER NOT NULL,
    `f_cart_item_id` INTEGER NULL,

    INDEX `checkout_items_f_checkout_id_idx`(`f_checkout_id`),
    PRIMARY KEY (`f_checkout_item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `checkout_sessions` ADD CONSTRAINT `checkout_sessions_f_user_id_fkey` FOREIGN KEY (`f_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `checkout_items` ADD CONSTRAINT `checkout_items_f_checkout_id_fkey` FOREIGN KEY (`f_checkout_id`) REFERENCES `checkout_sessions`(`f_checkout_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `checkout_items` ADD CONSTRAINT `checkout_items_f_app_id_fkey` FOREIGN KEY (`f_app_id`) REFERENCES `apps`(`f_app_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `checkout_items` ADD CONSTRAINT `checkout_items_f_sales_plan_id_fkey` FOREIGN KEY (`f_sales_plan_id`) REFERENCES `app_sales_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `checkout_items` ADD CONSTRAINT `checkout_items_f_cart_item_id_fkey` FOREIGN KEY (`f_cart_item_id`) REFERENCES `cart_items`(`f_cart_item_id`) ON DELETE SET NULL ON UPDATE CASCADE;
