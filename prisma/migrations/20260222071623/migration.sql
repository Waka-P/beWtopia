-- CreateTable
CREATE TABLE `app_trial_usages` (
    `f_trial_usage_id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `f_app_id` INTEGER NOT NULL,
    `f_user_id` INTEGER NOT NULL,

    INDEX `app_trial_usages_f_user_id_idx`(`f_user_id`),
    UNIQUE INDEX `app_trial_usages_f_app_id_f_user_id_key`(`f_app_id`, `f_user_id`),
    PRIMARY KEY (`f_trial_usage_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `app_trial_usages` ADD CONSTRAINT `app_trial_usages_f_app_id_fkey` FOREIGN KEY (`f_app_id`) REFERENCES `apps`(`f_app_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `app_trial_usages` ADD CONSTRAINT `app_trial_usages_f_user_id_fkey` FOREIGN KEY (`f_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
