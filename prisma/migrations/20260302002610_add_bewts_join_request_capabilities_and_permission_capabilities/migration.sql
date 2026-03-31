-- AlterTable
ALTER TABLE `bewts_permission_capabilities` MODIFY `f_capability` ENUM('ADMIN', 'PUBLISH', 'SCOUT', 'MANAGE_APP', 'MANAGE_PROJECT', 'GRANT_PERMISSION', 'APPROVE_JOIN_REQUEST', 'DECLINE_JOIN_REQUEST', 'UNDO_JOIN_APPROVAL', 'INVITE_MEMBER', 'ASSIGN_ROLE', 'VIEW_ALL_ROLES', 'MANAGE_GANTT') NOT NULL;

-- CreateTable
CREATE TABLE `bewts_join_request_capabilities` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_join_request_id` INTEGER NOT NULL,
    `f_capability` ENUM('ADMIN', 'PUBLISH', 'SCOUT', 'MANAGE_APP', 'MANAGE_PROJECT', 'GRANT_PERMISSION', 'APPROVE_JOIN_REQUEST', 'DECLINE_JOIN_REQUEST', 'UNDO_JOIN_APPROVAL', 'INVITE_MEMBER', 'ASSIGN_ROLE', 'VIEW_ALL_ROLES', 'MANAGE_GANTT') NOT NULL,

    INDEX `bewts_join_request_capabilities_f_capability_idx`(`f_capability`),
    UNIQUE INDEX `bewts_join_request_capabilities_f_join_request_id_f_capabili_key`(`f_join_request_id`, `f_capability`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bewts_join_request_capabilities` ADD CONSTRAINT `bewts_join_request_capabilities_f_join_request_id_fkey` FOREIGN KEY (`f_join_request_id`) REFERENCES `bewts_join_requests`(`f_request_id`) ON DELETE CASCADE ON UPDATE CASCADE;
