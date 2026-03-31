-- CreateTable
CREATE TABLE `bewts_gantt_task_assignments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_bewts_task_id` INTEGER NOT NULL,
    `f_user_id` INTEGER NOT NULL,

    INDEX `bewts_gantt_task_assignments_f_user_id_idx`(`f_user_id`),
    UNIQUE INDEX `bewts_gantt_task_assignments_f_bewts_task_id_f_user_id_key`(`f_bewts_task_id`, `f_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bewts_gantt_task_assignments` ADD CONSTRAINT `bewts_gantt_task_assignments_f_bewts_task_id_fkey` FOREIGN KEY (`f_bewts_task_id`) REFERENCES `bewts_gantt_tasks`(`f_task_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bewts_gantt_task_assignments` ADD CONSTRAINT `bewts_gantt_task_assignments_f_user_id_fkey` FOREIGN KEY (`f_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
