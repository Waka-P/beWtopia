-- CreateTable
CREATE TABLE `carts` (
    `f_cart_id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_user_id` INTEGER NOT NULL,

    PRIMARY KEY (`f_cart_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cart_items` (
    `f_cart_item_id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_cart_id` INTEGER NOT NULL,
    `f_app_id` INTEGER NOT NULL,
    `f_sales_type_id` ENUM('P', 'S') NOT NULL,

    INDEX `cart_items_f_cart_id_idx`(`f_cart_id`),
    INDEX `cart_items_f_app_id_idx`(`f_app_id`),
    PRIMARY KEY (`f_cart_item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `carts` ADD CONSTRAINT `carts_f_user_id_fkey` FOREIGN KEY (`f_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_f_cart_id_fkey` FOREIGN KEY (`f_cart_id`) REFERENCES `carts`(`f_cart_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_f_app_id_fkey` FOREIGN KEY (`f_app_id`) REFERENCES `apps`(`f_app_id`) ON DELETE CASCADE ON UPDATE CASCADE;
