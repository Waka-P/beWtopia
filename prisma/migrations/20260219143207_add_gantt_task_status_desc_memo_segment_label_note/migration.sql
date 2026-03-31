/*
  Warnings:

  - You are about to drop the `BewtsGanttTask` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BewtsGanttTaskDependency` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BewtsGanttTaskSegment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `BewtsGanttTask` DROP FOREIGN KEY `BewtsGanttTask_f_assignee_id_fkey`;

-- DropForeignKey
ALTER TABLE `BewtsGanttTask` DROP FOREIGN KEY `BewtsGanttTask_f_bewts_gantt_id_fkey`;

-- DropForeignKey
ALTER TABLE `BewtsGanttTaskDependency` DROP FOREIGN KEY `BewtsGanttTaskDependency_fromTaskId_fkey`;

-- DropForeignKey
ALTER TABLE `BewtsGanttTaskDependency` DROP FOREIGN KEY `BewtsGanttTaskDependency_toTaskId_fkey`;

-- DropForeignKey
ALTER TABLE `BewtsGanttTaskSegment` DROP FOREIGN KEY `BewtsGanttTaskSegment_f_bewts_task_id_fkey`;

-- DropTable
DROP TABLE `BewtsGanttTask`;

-- DropTable
DROP TABLE `BewtsGanttTaskDependency`;

-- DropTable
DROP TABLE `BewtsGanttTaskSegment`;

-- CreateTable
CREATE TABLE `bewts_gantt_tasks` (
    `f_task_id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_task_name` VARCHAR(100) NOT NULL,
    `f_description` TEXT NULL,
    `f_progress` INTEGER NOT NULL DEFAULT 0,
    `f_status` VARCHAR(20) NOT NULL DEFAULT '未着手',
    `f_memo` TEXT NULL,
    `f_display_order` INTEGER NOT NULL,
    `f_bewts_gantt_id` INTEGER NOT NULL,
    `f_assignee_id` INTEGER NULL,

    INDEX `bewts_gantt_tasks_f_bewts_gantt_id_idx`(`f_bewts_gantt_id`),
    PRIMARY KEY (`f_task_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bewts_gantt_task_segments` (
    `f_segment_id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_start_at` DATETIME(3) NOT NULL,
    `f_end_at` DATETIME(3) NOT NULL,
    `f_color` VARCHAR(7) NULL,
    `f_label` VARCHAR(50) NULL,
    `f_note` VARCHAR(255) NULL,
    `f_order` INTEGER NOT NULL DEFAULT 0,
    `f_bewts_task_id` INTEGER NOT NULL,

    INDEX `bewts_gantt_task_segments_f_bewts_task_id_idx`(`f_bewts_task_id`),
    PRIMARY KEY (`f_segment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bewts_gantt_task_dependencies` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fromTaskId` INTEGER NOT NULL,
    `toTaskId` INTEGER NOT NULL,

    UNIQUE INDEX `bewts_gantt_task_dependencies_fromTaskId_toTaskId_key`(`fromTaskId`, `toTaskId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bewts_gantt_tasks` ADD CONSTRAINT `bewts_gantt_tasks_f_bewts_gantt_id_fkey` FOREIGN KEY (`f_bewts_gantt_id`) REFERENCES `bewts_gantt_charts`(`f_bewts_gantt_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bewts_gantt_tasks` ADD CONSTRAINT `bewts_gantt_tasks_f_assignee_id_fkey` FOREIGN KEY (`f_assignee_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bewts_gantt_task_segments` ADD CONSTRAINT `bewts_gantt_task_segments_f_bewts_task_id_fkey` FOREIGN KEY (`f_bewts_task_id`) REFERENCES `bewts_gantt_tasks`(`f_task_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bewts_gantt_task_dependencies` ADD CONSTRAINT `bewts_gantt_task_dependencies_fromTaskId_fkey` FOREIGN KEY (`fromTaskId`) REFERENCES `bewts_gantt_tasks`(`f_task_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bewts_gantt_task_dependencies` ADD CONSTRAINT `bewts_gantt_task_dependencies_toTaskId_fkey` FOREIGN KEY (`toTaskId`) REFERENCES `bewts_gantt_tasks`(`f_task_id`) ON DELETE CASCADE ON UPDATE CASCADE;
