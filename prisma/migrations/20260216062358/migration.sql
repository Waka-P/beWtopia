-- CreateTable
CREATE TABLE `app_favorites` (
    `f_app_id` INTEGER NOT NULL,
    `f_user_id` INTEGER NOT NULL,

    INDEX `app_favorites_f_user_id_idx`(`f_user_id`),
    PRIMARY KEY (`f_app_id`, `f_user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bewts_permission_capabilities` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_bewts_project_id` INTEGER NOT NULL,
    `f_user_id` INTEGER NOT NULL,
    `f_capability` ENUM('ADMIN', 'PUBLISH', 'APPROVE_JOIN_REQUEST', 'DECLINE_JOIN_REQUEST', 'UNDO_JOIN_APPROVAL', 'INVITE_MEMBER', 'ASSIGN_ROLE', 'VIEW_ALL_ROLES', 'MANAGE_GANTT') NOT NULL,

    INDEX `bewts_permission_capabilities_f_bewts_project_id_idx`(`f_bewts_project_id`),
    INDEX `bewts_permission_capabilities_f_user_id_idx`(`f_user_id`),
    UNIQUE INDEX `bewts_permission_capabilities_f_bewts_project_id_f_user_id_f_key`(`f_bewts_project_id`, `f_user_id`, `f_capability`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `app_favorites` ADD CONSTRAINT `app_favorites_f_app_id_fkey` FOREIGN KEY (`f_app_id`) REFERENCES `apps`(`f_app_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `app_favorites` ADD CONSTRAINT `app_favorites_f_user_id_fkey` FOREIGN KEY (`f_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bewts_permission_capabilities` ADD CONSTRAINT `bewts_permission_capabilities_f_bewts_project_id_fkey` FOREIGN KEY (`f_bewts_project_id`) REFERENCES `bewts_projects`(`f_bewts_project_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bewts_permission_capabilities` ADD CONSTRAINT `bewts_permission_capabilities_f_user_id_fkey` FOREIGN KEY (`f_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
