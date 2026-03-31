-- CreateTable
CREATE TABLE `chat_rooms` (
    `f_room_id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`f_room_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_room_members` (
    `f_room_id` INTEGER NOT NULL,
    `f_user_id` INTEGER NOT NULL,

    INDEX `chat_room_members_f_user_id_idx`(`f_user_id`),
    PRIMARY KEY (`f_room_id`, `f_user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_messages` (
    `f_message_id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_msg_body` TEXT NULL,
    `f_created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `f_room_id` INTEGER NOT NULL,
    `f_user_id` INTEGER NOT NULL,

    INDEX `chat_messages_f_room_id_idx`(`f_room_id`),
    INDEX `chat_messages_f_user_id_idx`(`f_user_id`),
    PRIMARY KEY (`f_message_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_message_attachments` (
    `f_msg_img_id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_img_url` TEXT NOT NULL,
    `f_type` VARCHAR(20) NOT NULL DEFAULT 'image',
    `f_name` VARCHAR(255) NULL,
    `f_message_id` INTEGER NOT NULL,

    INDEX `chat_message_attachments_f_message_id_idx`(`f_message_id`),
    PRIMARY KEY (`f_msg_img_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_message_reactions` (
    `f_reaction_id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_emoji` VARCHAR(10) NOT NULL,
    `f_created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `f_message_id` INTEGER NOT NULL,
    `f_user_id` INTEGER NOT NULL,

    INDEX `chat_message_reactions_f_message_id_idx`(`f_message_id`),
    INDEX `chat_message_reactions_f_user_id_idx`(`f_user_id`),
    UNIQUE INDEX `chat_message_reactions_f_message_id_f_user_id_f_emoji_key`(`f_message_id`, `f_user_id`, `f_emoji`),
    PRIMARY KEY (`f_reaction_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `chat_room_members` ADD CONSTRAINT `chat_room_members_f_room_id_fkey` FOREIGN KEY (`f_room_id`) REFERENCES `chat_rooms`(`f_room_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_room_members` ADD CONSTRAINT `chat_room_members_f_user_id_fkey` FOREIGN KEY (`f_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_f_room_id_fkey` FOREIGN KEY (`f_room_id`) REFERENCES `chat_rooms`(`f_room_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_f_user_id_fkey` FOREIGN KEY (`f_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_message_attachments` ADD CONSTRAINT `chat_message_attachments_f_message_id_fkey` FOREIGN KEY (`f_message_id`) REFERENCES `chat_messages`(`f_message_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_message_reactions` ADD CONSTRAINT `chat_message_reactions_f_message_id_fkey` FOREIGN KEY (`f_message_id`) REFERENCES `chat_messages`(`f_message_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_message_reactions` ADD CONSTRAINT `chat_message_reactions_f_user_id_fkey` FOREIGN KEY (`f_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
