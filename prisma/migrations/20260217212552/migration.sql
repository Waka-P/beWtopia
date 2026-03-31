-- AlterTable
ALTER TABLE `apps` ADD COLUMN `f_bewts_project_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `apps` ADD CONSTRAINT `apps_f_bewts_project_id_fkey` FOREIGN KEY (`f_bewts_project_id`) REFERENCES `bewts_projects`(`f_bewts_project_id`) ON DELETE SET NULL ON UPDATE CASCADE;
