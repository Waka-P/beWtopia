/*
  Warnings:

  - You are about to drop the `bewts_gantt_tasks` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `bewts_gantt_tasks` DROP FOREIGN KEY `bewts_gantt_tasks_f_assignee_id_fkey`;

-- DropForeignKey
ALTER TABLE `bewts_gantt_tasks` DROP FOREIGN KEY `bewts_gantt_tasks_f_bewts_gantt_id_fkey`;

-- DropTable
DROP TABLE `bewts_gantt_tasks`;

-- CreateTable
CREATE TABLE `BewtsGanttTask` (
    `f_task_id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_task_name` VARCHAR(100) NOT NULL,
    `f_progress` INTEGER NOT NULL DEFAULT 0,
    `f_display_order` INTEGER NOT NULL,
    `f_bewts_gantt_id` INTEGER NOT NULL,
    `f_assignee_id` INTEGER NULL,

    INDEX `BewtsGanttTask_f_bewts_gantt_id_idx`(`f_bewts_gantt_id`),
    PRIMARY KEY (`f_task_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BewtsGanttTaskSegment` (
    `f_segment_id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_start_at` DATETIME(3) NOT NULL,
    `f_end_at` DATETIME(3) NOT NULL,
    `f_color` VARCHAR(7) NULL,
    `f_order` INTEGER NOT NULL DEFAULT 0,
    `f_bewts_task_id` INTEGER NOT NULL,

    INDEX `BewtsGanttTaskSegment_f_bewts_task_id_idx`(`f_bewts_task_id`),
    PRIMARY KEY (`f_segment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BewtsGanttTaskDependency` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fromTaskId` INTEGER NOT NULL,
    `toTaskId` INTEGER NOT NULL,

    UNIQUE INDEX `BewtsGanttTaskDependency_fromTaskId_toTaskId_key`(`fromTaskId`, `toTaskId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BewtsGanttTask` ADD CONSTRAINT `BewtsGanttTask_f_bewts_gantt_id_fkey` FOREIGN KEY (`f_bewts_gantt_id`) REFERENCES `bewts_gantt_charts`(`f_bewts_gantt_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BewtsGanttTask` ADD CONSTRAINT `BewtsGanttTask_f_assignee_id_fkey` FOREIGN KEY (`f_assignee_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BewtsGanttTaskSegment` ADD CONSTRAINT `BewtsGanttTaskSegment_f_bewts_task_id_fkey` FOREIGN KEY (`f_bewts_task_id`) REFERENCES `BewtsGanttTask`(`f_task_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BewtsGanttTaskDependency` ADD CONSTRAINT `BewtsGanttTaskDependency_fromTaskId_fkey` FOREIGN KEY (`fromTaskId`) REFERENCES `BewtsGanttTask`(`f_task_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BewtsGanttTaskDependency` ADD CONSTRAINT `BewtsGanttTaskDependency_toTaskId_fkey` FOREIGN KEY (`toTaskId`) REFERENCES `BewtsGanttTask`(`f_task_id`) ON DELETE CASCADE ON UPDATE CASCADE;
