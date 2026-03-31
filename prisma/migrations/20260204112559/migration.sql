-- CreateTable
CREATE TABLE `privacy_categories` (
    `f_privacy_category_id` CHAR(6) NOT NULL,
    `f_category_name` VARCHAR(10) NOT NULL,

    PRIMARY KEY (`f_privacy_category_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `privacy_settings` (
    `f_privacy_setting_id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_is_enabled` BOOLEAN NOT NULL DEFAULT true,
    `f_privacy_category_id` CHAR(6) NOT NULL,
    `f_user_id` INTEGER NOT NULL,

    INDEX `privacy_settings_f_privacy_category_id_idx`(`f_privacy_category_id`),
    INDEX `privacy_settings_f_user_id_idx`(`f_user_id`),
    UNIQUE INDEX `privacy_settings_f_user_id_f_privacy_category_id_key`(`f_user_id`, `f_privacy_category_id`),
    PRIMARY KEY (`f_privacy_setting_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `privacy_settings` ADD CONSTRAINT `privacy_settings_f_privacy_category_id_fkey` FOREIGN KEY (`f_privacy_category_id`) REFERENCES `privacy_categories`(`f_privacy_category_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `privacy_settings` ADD CONSTRAINT `privacy_settings_f_user_id_fkey` FOREIGN KEY (`f_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
