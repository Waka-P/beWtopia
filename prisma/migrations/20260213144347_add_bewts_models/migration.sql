-- CreateTable
CREATE TABLE `bewts_projects` (
    `f_bewts_project_id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` CHAR(21) NOT NULL,
    `f_project_name` VARCHAR(100) NOT NULL,
    `f_description` TEXT NOT NULL,
    `f_max_members` INTEGER NOT NULL,
    `f_duration_days` INTEGER NULL,
    `f_created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `f_updated_at` DATETIME(3) NOT NULL,
    `f_leader_id` INTEGER NOT NULL,

    UNIQUE INDEX `bewts_projects_publicId_key`(`publicId`),
    INDEX `bewts_projects_f_leader_id_idx`(`f_leader_id`),
    PRIMARY KEY (`f_bewts_project_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bewts_roles` (
    `f_bewts_role_id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_role_name` VARCHAR(50) NOT NULL,
    `f_profit_percentage` INTEGER NOT NULL,
    `f_is_leader` BOOLEAN NOT NULL DEFAULT false,
    `f_bewts_project_id` INTEGER NOT NULL,
    `f_user_id` INTEGER NULL,

    INDEX `bewts_roles_f_bewts_project_id_idx`(`f_bewts_project_id`),
    INDEX `bewts_roles_f_user_id_idx`(`f_user_id`),
    PRIMARY KEY (`f_bewts_role_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bewts_skills` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_bewts_project_id` INTEGER NOT NULL,
    `f_skill_id` CHAR(6) NOT NULL,

    INDEX `bewts_skills_f_skill_id_idx`(`f_skill_id`),
    UNIQUE INDEX `bewts_skills_f_bewts_project_id_f_skill_id_key`(`f_bewts_project_id`, `f_skill_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bewts_rooms` (
    `f_bewts_room_id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_room_name` VARCHAR(50) NOT NULL,
    `f_is_all_room` BOOLEAN NOT NULL DEFAULT false,
    `f_created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `f_bewts_project_id` INTEGER NOT NULL,
    `f_bewts_role_id` INTEGER NULL,

    UNIQUE INDEX `bewts_rooms_f_bewts_role_id_key`(`f_bewts_role_id`),
    INDEX `bewts_rooms_f_bewts_project_id_idx`(`f_bewts_project_id`),
    PRIMARY KEY (`f_bewts_room_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bewts_room_members` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_joined_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `f_bewts_room_id` INTEGER NOT NULL,
    `f_user_id` INTEGER NOT NULL,

    INDEX `bewts_room_members_f_user_id_idx`(`f_user_id`),
    UNIQUE INDEX `bewts_room_members_f_bewts_room_id_f_user_id_key`(`f_bewts_room_id`, `f_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bewts_messages` (
    `f_bewts_message_id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` CHAR(21) NOT NULL,
    `f_content` TEXT NOT NULL,
    `f_created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `f_updated_at` DATETIME(3) NOT NULL,
    `f_bewts_room_id` INTEGER NOT NULL,
    `f_sender_id` INTEGER NOT NULL,

    UNIQUE INDEX `bewts_messages_publicId_key`(`publicId`),
    INDEX `bewts_messages_f_bewts_room_id_f_created_at_idx`(`f_bewts_room_id`, `f_created_at`),
    INDEX `bewts_messages_f_sender_id_idx`(`f_sender_id`),
    PRIMARY KEY (`f_bewts_message_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bewts_message_attachments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_file_url` TEXT NOT NULL,
    `f_file_name` VARCHAR(255) NOT NULL,
    `f_file_type` VARCHAR(100) NOT NULL,
    `f_file_size_bytes` INTEGER NULL,
    `f_display_order` INTEGER NOT NULL,
    `f_bewts_message_id` INTEGER NOT NULL,

    INDEX `bewts_message_attachments_f_bewts_message_id_idx`(`f_bewts_message_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bewts_message_reactions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_emoji` VARCHAR(10) NOT NULL,
    `f_created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `f_bewts_message_id` INTEGER NOT NULL,
    `f_user_id` INTEGER NOT NULL,

    INDEX `bewts_message_reactions_f_bewts_message_id_idx`(`f_bewts_message_id`),
    INDEX `bewts_message_reactions_f_user_id_idx`(`f_user_id`),
    UNIQUE INDEX `bewts_message_reactions_f_bewts_message_id_f_user_id_f_emoji_key`(`f_bewts_message_id`, `f_user_id`, `f_emoji`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bewts_message_reads` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_read_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `f_bewts_message_id` INTEGER NOT NULL,
    `f_user_id` INTEGER NOT NULL,

    INDEX `bewts_message_reads_f_bewts_message_id_idx`(`f_bewts_message_id`),
    INDEX `bewts_message_reads_f_user_id_idx`(`f_user_id`),
    UNIQUE INDEX `bewts_message_reads_f_bewts_message_id_f_user_id_key`(`f_bewts_message_id`, `f_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bewts_permissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_permission_level` ENUM('MEMBER', 'PUBLISHER', 'ADMIN') NOT NULL,
    `f_bewts_project_id` INTEGER NOT NULL,
    `f_user_id` INTEGER NOT NULL,

    INDEX `bewts_permissions_f_bewts_project_id_idx`(`f_bewts_project_id`),
    INDEX `bewts_permissions_f_user_id_idx`(`f_user_id`),
    UNIQUE INDEX `bewts_permissions_f_bewts_project_id_f_user_id_key`(`f_bewts_project_id`, `f_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bewts_gantt_charts` (
    `f_bewts_gantt_id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `f_updated_at` DATETIME(3) NOT NULL,
    `f_bewts_room_id` INTEGER NOT NULL,

    UNIQUE INDEX `bewts_gantt_charts_f_bewts_room_id_key`(`f_bewts_room_id`),
    PRIMARY KEY (`f_bewts_gantt_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bewts_gantt_tasks` (
    `f_task_id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_task_name` VARCHAR(100) NOT NULL,
    `f_start_date` DATETIME(3) NOT NULL,
    `f_end_date` DATETIME(3) NOT NULL,
    `f_progress` INTEGER NOT NULL DEFAULT 0,
    `f_dependencies` TEXT NULL,
    `f_color` VARCHAR(7) NULL,
    `f_display_order` INTEGER NOT NULL,
    `f_bewts_gantt_id` INTEGER NOT NULL,
    `f_assignee_id` INTEGER NULL,

    INDEX `bewts_gantt_tasks_f_bewts_gantt_id_idx`(`f_bewts_gantt_id`),
    INDEX `bewts_gantt_tasks_f_assignee_id_idx`(`f_assignee_id`),
    PRIMARY KEY (`f_task_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bewts_memos` (
    `f_bewts_memo_id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_yjs_doc` LONGBLOB NOT NULL,
    `f_created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `f_updated_at` DATETIME(3) NOT NULL,
    `f_bewts_room_id` INTEGER NOT NULL,

    UNIQUE INDEX `bewts_memos_f_bewts_room_id_key`(`f_bewts_room_id`),
    PRIMARY KEY (`f_bewts_memo_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bewts_projects` ADD CONSTRAINT `bewts_projects_f_leader_id_fkey` FOREIGN KEY (`f_leader_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bewts_roles` ADD CONSTRAINT `bewts_roles_f_bewts_project_id_fkey` FOREIGN KEY (`f_bewts_project_id`) REFERENCES `bewts_projects`(`f_bewts_project_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bewts_roles` ADD CONSTRAINT `bewts_roles_f_user_id_fkey` FOREIGN KEY (`f_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bewts_skills` ADD CONSTRAINT `bewts_skills_f_bewts_project_id_fkey` FOREIGN KEY (`f_bewts_project_id`) REFERENCES `bewts_projects`(`f_bewts_project_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bewts_skills` ADD CONSTRAINT `bewts_skills_f_skill_id_fkey` FOREIGN KEY (`f_skill_id`) REFERENCES `skills`(`f_skill_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bewts_rooms` ADD CONSTRAINT `bewts_rooms_f_bewts_project_id_fkey` FOREIGN KEY (`f_bewts_project_id`) REFERENCES `bewts_projects`(`f_bewts_project_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bewts_rooms` ADD CONSTRAINT `bewts_rooms_f_bewts_role_id_fkey` FOREIGN KEY (`f_bewts_role_id`) REFERENCES `bewts_roles`(`f_bewts_role_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bewts_room_members` ADD CONSTRAINT `bewts_room_members_f_bewts_room_id_fkey` FOREIGN KEY (`f_bewts_room_id`) REFERENCES `bewts_rooms`(`f_bewts_room_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bewts_room_members` ADD CONSTRAINT `bewts_room_members_f_user_id_fkey` FOREIGN KEY (`f_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bewts_messages` ADD CONSTRAINT `bewts_messages_f_bewts_room_id_fkey` FOREIGN KEY (`f_bewts_room_id`) REFERENCES `bewts_rooms`(`f_bewts_room_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bewts_messages` ADD CONSTRAINT `bewts_messages_f_sender_id_fkey` FOREIGN KEY (`f_sender_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bewts_message_attachments` ADD CONSTRAINT `bewts_message_attachments_f_bewts_message_id_fkey` FOREIGN KEY (`f_bewts_message_id`) REFERENCES `bewts_messages`(`f_bewts_message_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bewts_message_reactions` ADD CONSTRAINT `bewts_message_reactions_f_bewts_message_id_fkey` FOREIGN KEY (`f_bewts_message_id`) REFERENCES `bewts_messages`(`f_bewts_message_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bewts_message_reactions` ADD CONSTRAINT `bewts_message_reactions_f_user_id_fkey` FOREIGN KEY (`f_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bewts_message_reads` ADD CONSTRAINT `bewts_message_reads_f_bewts_message_id_fkey` FOREIGN KEY (`f_bewts_message_id`) REFERENCES `bewts_messages`(`f_bewts_message_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bewts_message_reads` ADD CONSTRAINT `bewts_message_reads_f_user_id_fkey` FOREIGN KEY (`f_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bewts_permissions` ADD CONSTRAINT `bewts_permissions_f_bewts_project_id_fkey` FOREIGN KEY (`f_bewts_project_id`) REFERENCES `bewts_projects`(`f_bewts_project_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bewts_permissions` ADD CONSTRAINT `bewts_permissions_f_user_id_fkey` FOREIGN KEY (`f_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bewts_gantt_charts` ADD CONSTRAINT `bewts_gantt_charts_f_bewts_room_id_fkey` FOREIGN KEY (`f_bewts_room_id`) REFERENCES `bewts_rooms`(`f_bewts_room_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bewts_gantt_tasks` ADD CONSTRAINT `bewts_gantt_tasks_f_bewts_gantt_id_fkey` FOREIGN KEY (`f_bewts_gantt_id`) REFERENCES `bewts_gantt_charts`(`f_bewts_gantt_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bewts_gantt_tasks` ADD CONSTRAINT `bewts_gantt_tasks_f_assignee_id_fkey` FOREIGN KEY (`f_assignee_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bewts_memos` ADD CONSTRAINT `bewts_memos_f_bewts_room_id_fkey` FOREIGN KEY (`f_bewts_room_id`) REFERENCES `bewts_rooms`(`f_bewts_room_id`) ON DELETE CASCADE ON UPDATE CASCADE;
