-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Sep 10, 2026 at 02:53 AM
-- Server version: 8.0.46
-- PHP Version: 8.2.32

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `portal_oa`
--

-- --------------------------------------------------------

--
-- Table structure for table `recruitment_positions`
--

CREATE TABLE `recruitment_positions` (
  `id` int NOT NULL,
  `request_id` int NOT NULL,
  `position_title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `recruitment_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `employee_being_replaced` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `vacancies` int NOT NULL DEFAULT '1',
  `employment_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `work_location` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `required_start_date` date DEFAULT NULL,
  `reason_for_recruitment` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `job_description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `key_responsibilities` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `qualification` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `skills` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `experience` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `salary_range` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `budget_cost_center` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `hiring_priority` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `recruitment_source` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `supporting_document` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `recruitment_positions`
--
ALTER TABLE `recruitment_positions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `request_id` (`request_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `recruitment_positions`
--
ALTER TABLE `recruitment_positions`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `recruitment_positions`
--
ALTER TABLE `recruitment_positions`
  ADD CONSTRAINT `recruitment_positions_ibfk_1` FOREIGN KEY (`request_id`) REFERENCES `recruitment_requests` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
