CREATE TABLE IF NOT EXISTS `announcements` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(150) NOT NULL,
  `message` TEXT NOT NULL,
  `target_audience` VARCHAR(20) NOT NULL,
  `publish_date` DATE NOT NULL,
  `expiry_date` DATE NOT NULL,
  `created_by` VARCHAR(50),
  `status` VARCHAR(20) DEFAULT 'Active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
);
