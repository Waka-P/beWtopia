-- CreateTable
CREATE TABLE `bewts_join_request_roles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_join_request_id` INTEGER NOT NULL,
    `f_bewts_role_id` INTEGER NOT NULL,

    INDEX `bewts_join_request_roles_f_bewts_role_id_idx`(`f_bewts_role_id`),
    UNIQUE INDEX `bewts_join_request_roles_f_join_request_id_f_bewts_role_id_key`(`f_join_request_id`, `f_bewts_role_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bewts_join_request_roles` ADD CONSTRAINT `bewts_join_request_roles_f_join_request_id_fkey` FOREIGN KEY (`f_join_request_id`) REFERENCES `bewts_join_requests`(`f_request_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bewts_join_request_roles` ADD CONSTRAINT `bewts_join_request_roles_f_bewts_role_id_fkey` FOREIGN KEY (`f_bewts_role_id`) REFERENCES `bewts_roles`(`f_bewts_role_id`) ON DELETE CASCADE ON UPDATE CASCADE;
