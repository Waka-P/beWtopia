-- CreateTable
CREATE TABLE `jobs` (
    `f_job_id` CHAR(6) NOT NULL,
    `f_job_name` VARCHAR(10) NOT NULL,

    UNIQUE INDEX `jobs_f_job_name_key`(`f_job_name`),
    PRIMARY KEY (`f_job_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_jobs` (
    `f_user_id` INTEGER NOT NULL,
    `f_job_id` CHAR(6) NOT NULL,

    INDEX `user_jobs_f_job_id_idx`(`f_job_id`),
    PRIMARY KEY (`f_user_id`, `f_job_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_jobs` ADD CONSTRAINT `user_jobs_f_user_id_fkey` FOREIGN KEY (`f_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_jobs` ADD CONSTRAINT `user_jobs_f_job_id_fkey` FOREIGN KEY (`f_job_id`) REFERENCES `jobs`(`f_job_id`) ON DELETE CASCADE ON UPDATE CASCADE;
