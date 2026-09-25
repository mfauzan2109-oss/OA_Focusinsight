-- Add profile picture support to existing OA System databases.

ALTER TABLE users
ADD COLUMN profile_picture VARCHAR(500) NULL
AFTER basic_salary;