-- CreateTable
CREATE TABLE `requests` (
    `f_request_id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` CHAR(21) NOT NULL,
    `f_title` VARCHAR(50) NOT NULL,
    `f_content` TEXT NOT NULL,
    `f_created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `f_updated_at` DATETIME(3) NOT NULL,
    `f_user_id` INTEGER NOT NULL,

    UNIQUE INDEX `requests_publicId_key`(`publicId`),
    INDEX `requests_f_user_id_idx`(`f_user_id`),
    PRIMARY KEY (`f_request_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `request_tags` (
    `f_request_id` INTEGER NOT NULL,
    `f_tag_id` INTEGER NOT NULL,

    PRIMARY KEY (`f_request_id`, `f_tag_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `request_reactions` (
    `f_reaction_id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_emoji` VARCHAR(10) NOT NULL,
    `f_created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `f_request_id` INTEGER NOT NULL,
    `f_user_id` INTEGER NOT NULL,

    INDEX `request_reactions_f_request_id_idx`(`f_request_id`),
    INDEX `request_reactions_f_user_id_idx`(`f_user_id`),
    UNIQUE INDEX `request_reactions_f_request_id_f_user_id_f_emoji_key`(`f_request_id`, `f_user_id`, `f_emoji`),
    PRIMARY KEY (`f_reaction_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `requests` ADD CONSTRAINT `requests_f_user_id_fkey` FOREIGN KEY (`f_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `request_tags` ADD CONSTRAINT `request_tags_f_request_id_fkey` FOREIGN KEY (`f_request_id`) REFERENCES `requests`(`f_request_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `request_tags` ADD CONSTRAINT `request_tags_f_tag_id_fkey` FOREIGN KEY (`f_tag_id`) REFERENCES `tags`(`f_tag_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `request_reactions` ADD CONSTRAINT `request_reactions_f_request_id_fkey` FOREIGN KEY (`f_request_id`) REFERENCES `requests`(`f_request_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `request_reactions` ADD CONSTRAINT `request_reactions_f_user_id_fkey` FOREIGN KEY (`f_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
