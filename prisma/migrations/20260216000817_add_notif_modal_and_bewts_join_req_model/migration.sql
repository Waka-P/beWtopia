-- AlterTable
ALTER TABLE `bewts_projects` MODIFY `f_started_at` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `bewts_join_requests` (
    `f_request_id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_message` TEXT NULL,
    `f_status` ENUM('PENDING', 'APPROVED', 'DECLINED') NOT NULL DEFAULT 'PENDING',
    `f_created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `f_updated_at` DATETIME(3) NOT NULL,
    `f_bewts_project_id` INTEGER NOT NULL,
    `f_user_id` INTEGER NOT NULL,

    INDEX `bewts_join_requests_f_bewts_project_id_idx`(`f_bewts_project_id`),
    INDEX `bewts_join_requests_f_user_id_idx`(`f_user_id`),
    UNIQUE INDEX `bewts_join_requests_f_bewts_project_id_f_user_id_key`(`f_bewts_project_id`, `f_user_id`),
    PRIMARY KEY (`f_request_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `f_notification_id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_type` ENUM('FOLLOW', 'BEWT', 'PURCHASE', 'CHAT', 'SCOUT', 'BEWTS_JOIN_REQUEST', 'BEWTS_JOIN_APPROVED', 'BEWTS_JOIN_DECLINED', 'SYSTEM') NOT NULL,
    `f_title` VARCHAR(200) NOT NULL,
    `f_message` TEXT NULL,
    `f_redirect_url` TEXT NULL,
    `f_is_read` BOOLEAN NOT NULL DEFAULT false,
    `f_read_at` DATETIME(3) NULL,
    `f_created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `f_user_id` INTEGER NOT NULL,
    `f_actor_id` INTEGER NULL,
    `f_app_id` INTEGER NULL,
    `f_chat_room_id` INTEGER NULL,
    `f_bewts_project_id` INTEGER NULL,
    `f_join_request_id` INTEGER NULL,

    INDEX `notifications_f_user_id_f_created_at_idx`(`f_user_id`, `f_created_at`),
    INDEX `notifications_f_actor_id_idx`(`f_actor_id`),
    PRIMARY KEY (`f_notification_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_user_id` INTEGER NOT NULL,
    `f_follow_enabled` BOOLEAN NOT NULL DEFAULT true,
    `f_bewt_enabled` BOOLEAN NOT NULL DEFAULT true,
    `f_purchase_enabled` BOOLEAN NOT NULL DEFAULT true,
    `f_chat_enabled` BOOLEAN NOT NULL DEFAULT true,
    `f_scout_enabled` BOOLEAN NOT NULL DEFAULT true,
    `f_bewts_join_enabled` BOOLEAN NOT NULL DEFAULT true,
    `f_email_notification_enabled` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `notification_settings_f_user_id_key`(`f_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bewts_join_requests` ADD CONSTRAINT `bewts_join_requests_f_bewts_project_id_fkey` FOREIGN KEY (`f_bewts_project_id`) REFERENCES `bewts_projects`(`f_bewts_project_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bewts_join_requests` ADD CONSTRAINT `bewts_join_requests_f_user_id_fkey` FOREIGN KEY (`f_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_f_user_id_fkey` FOREIGN KEY (`f_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_f_actor_id_fkey` FOREIGN KEY (`f_actor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_f_app_id_fkey` FOREIGN KEY (`f_app_id`) REFERENCES `apps`(`f_app_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_f_chat_room_id_fkey` FOREIGN KEY (`f_chat_room_id`) REFERENCES `chat_rooms`(`f_room_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_f_bewts_project_id_fkey` FOREIGN KEY (`f_bewts_project_id`) REFERENCES `bewts_projects`(`f_bewts_project_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_f_join_request_id_fkey` FOREIGN KEY (`f_join_request_id`) REFERENCES `bewts_join_requests`(`f_request_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_settings` ADD CONSTRAINT `notification_settings_f_user_id_fkey` FOREIGN KEY (`f_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
