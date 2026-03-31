-- AlterTable
ALTER TABLE `jobs`
MODIFY `f_job_name` VARCHAR(20) NOT NULL;

-- AlterTable
ALTER TABLE `privacy_categories`
MODIFY `f_category_name` VARCHAR(20) NOT NULL;

-- AlterTable
ALTER TABLE `skills`
MODIFY `f_skill_name` VARCHAR(20) NOT NULL;