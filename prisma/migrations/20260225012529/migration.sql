-- AlterTable
ALTER TABLE `chat_orders` ADD COLUMN `f_price_unit` ENUM('YEN', 'W', 'BOTH') NOT NULL DEFAULT 'W';
