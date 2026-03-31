-- CreateTable
CREATE TABLE `apps` (
    `f_app_id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_app_name` VARCHAR(50) NOT NULL,
    `f_description` TEXT NOT NULL,
    `f_summary` VARCHAR(50) NOT NULL,
    `f_rating` DECIMAL(2, 1) NOT NULL,
    `f_payment_method` ENUM('W', 'C') NOT NULL,
    `f_app_file_url` TEXT NOT NULL,
    `f_app_icon_url` TEXT NULL,
    `f_created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ownerId` INTEGER NULL,

    PRIMARY KEY (`f_app_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `app_sales_plans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_sales_format_id` ENUM('P', 'S') NOT NULL,
    `f_price` INTEGER NOT NULL,
    `f_app_id` INTEGER NOT NULL,

    UNIQUE INDEX `app_sales_plans_f_app_id_f_sales_format_id_key`(`f_app_id`, `f_sales_format_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `app_trials` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_trial_days` INTEGER NOT NULL,
    `f_trial_file_url` TEXT NOT NULL,
    `f_app_id` INTEGER NOT NULL,

    UNIQUE INDEX `app_trials_f_app_id_key`(`f_app_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `app_images` (
    `f_app_img_id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_display_order` INTEGER NOT NULL,
    `f_img_url` TEXT NOT NULL,
    `f_app_id` INTEGER NOT NULL,

    INDEX `app_images_f_app_id_idx`(`f_app_id`),
    PRIMARY KEY (`f_app_img_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_histories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `purchasedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` INTEGER NOT NULL,
    `appId` INTEGER NOT NULL,
    `salesPlanId` INTEGER NOT NULL,

    INDEX `purchase_histories_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `app_reviews` (
    `f_app_review_id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_app_review_body` TEXT NOT NULL,
    `f_app_rating` DECIMAL(2, 1) NOT NULL,
    `f_app_id` INTEGER NOT NULL,
    `f_user_id` INTEGER NOT NULL,

    UNIQUE INDEX `app_reviews_f_app_id_f_user_id_key`(`f_app_id`, `f_user_id`),
    PRIMARY KEY (`f_app_review_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tags` (
    `f_tag_id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(30) NOT NULL,

    PRIMARY KEY (`f_tag_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `app_tags` (
    `f_app_id` INTEGER NOT NULL,
    `f_tag_id` INTEGER NOT NULL,

    PRIMARY KEY (`f_app_id`, `f_tag_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_tags` (
    `f_user_id` INTEGER NOT NULL,
    `f_tag_id` INTEGER NOT NULL,

    PRIMARY KEY (`f_user_id`, `f_tag_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `app_templates` (
    `f_template_id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_template_name` VARCHAR(10) NOT NULL,
    `f_template_body` TEXT NOT NULL,
    `f_user_id` INTEGER NOT NULL,

    PRIMARY KEY (`f_template_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `apps` ADD CONSTRAINT `apps_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `app_sales_plans` ADD CONSTRAINT `app_sales_plans_f_app_id_fkey` FOREIGN KEY (`f_app_id`) REFERENCES `apps`(`f_app_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `app_trials` ADD CONSTRAINT `app_trials_f_app_id_fkey` FOREIGN KEY (`f_app_id`) REFERENCES `apps`(`f_app_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `app_images` ADD CONSTRAINT `app_images_f_app_id_fkey` FOREIGN KEY (`f_app_id`) REFERENCES `apps`(`f_app_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_histories` ADD CONSTRAINT `purchase_histories_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_histories` ADD CONSTRAINT `purchase_histories_appId_fkey` FOREIGN KEY (`appId`) REFERENCES `apps`(`f_app_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_histories` ADD CONSTRAINT `purchase_histories_salesPlanId_fkey` FOREIGN KEY (`salesPlanId`) REFERENCES `app_sales_plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `app_reviews` ADD CONSTRAINT `app_reviews_f_app_id_fkey` FOREIGN KEY (`f_app_id`) REFERENCES `apps`(`f_app_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `app_reviews` ADD CONSTRAINT `app_reviews_f_user_id_fkey` FOREIGN KEY (`f_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `app_tags` ADD CONSTRAINT `app_tags_f_app_id_fkey` FOREIGN KEY (`f_app_id`) REFERENCES `apps`(`f_app_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `app_tags` ADD CONSTRAINT `app_tags_f_tag_id_fkey` FOREIGN KEY (`f_tag_id`) REFERENCES `tags`(`f_tag_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_tags` ADD CONSTRAINT `user_tags_f_user_id_fkey` FOREIGN KEY (`f_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_tags` ADD CONSTRAINT `user_tags_f_tag_id_fkey` FOREIGN KEY (`f_tag_id`) REFERENCES `tags`(`f_tag_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `app_templates` ADD CONSTRAINT `app_templates_f_user_id_fkey` FOREIGN KEY (`f_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
