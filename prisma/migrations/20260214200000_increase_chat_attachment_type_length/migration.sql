-- Manually added migration: extend chat_message_attachments.f_type to VARCHAR(100)
ALTER TABLE `chat_message_attachments`
  MODIFY COLUMN `f_type` VARCHAR(100) NOT NULL DEFAULT 'image';
