-- CreateTable
CREATE TABLE `hidden_apps` (
    `f_user_id` INTEGER NOT NULL,
    `f_hidden_app_id` INTEGER NOT NULL,

    INDEX `hidden_apps_f_hidden_app_id_idx`(`f_hidden_app_id`),
    PRIMARY KEY (`f_user_id`, `f_hidden_app_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hidden_users` (
    `f_user_id` INTEGER NOT NULL,
    `f_hidden_user_id` INTEGER NOT NULL,

    INDEX `hidden_users_f_hidden_user_id_idx`(`f_hidden_user_id`),
    PRIMARY KEY (`f_user_id`, `f_hidden_user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `hidden_apps` ADD CONSTRAINT `hidden_apps_f_user_id_fkey` FOREIGN KEY (`f_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hidden_apps` ADD CONSTRAINT `hidden_apps_f_hidden_app_id_fkey` FOREIGN KEY (`f_hidden_app_id`) REFERENCES `apps`(`f_app_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hidden_users` ADD CONSTRAINT `hidden_users_f_user_id_fkey` FOREIGN KEY (`f_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hidden_users` ADD CONSTRAINT `hidden_users_f_hidden_user_id_fkey` FOREIGN KEY (`f_hidden_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
