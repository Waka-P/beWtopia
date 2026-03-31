-- AlterTable
ALTER TABLE `chat_room_members` ADD COLUMN `f_deleted_at` DATETIME(3) NULL,
    ADD COLUMN `f_is_hidden` BOOLEAN NOT NULL DEFAULT false;
