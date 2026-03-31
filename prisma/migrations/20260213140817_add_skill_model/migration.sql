-- CreateTable
CREATE TABLE `skills` (
    `f_skill_id` CHAR(6) NOT NULL,
    `f_skill_name` VARCHAR(10) NOT NULL,

    UNIQUE INDEX `skills_f_skill_name_key`(`f_skill_name`),
    PRIMARY KEY (`f_skill_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_skills` (
    `f_user_id` INTEGER NOT NULL,
    `f_skill_id` CHAR(6) NOT NULL,

    INDEX `user_skills_f_skill_id_idx`(`f_skill_id`),
    PRIMARY KEY (`f_user_id`, `f_skill_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_skills` ADD CONSTRAINT `user_skills_f_user_id_fkey` FOREIGN KEY (`f_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_skills` ADD CONSTRAINT `user_skills_f_skill_id_fkey` FOREIGN KEY (`f_skill_id`) REFERENCES `skills`(`f_skill_id`) ON DELETE CASCADE ON UPDATE CASCADE;
