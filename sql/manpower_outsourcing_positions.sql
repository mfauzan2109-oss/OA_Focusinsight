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
-- Table structure for table `manpower_outsourcing_positions`
--

CREATE TABLE `manpower_outsourcing_positions` (
  `id` int NOT NULL,
  `request_id` int NOT NULL,
  `outsourcing_agency` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `job_title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `period` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `num_workers` int NOT NULL DEFAULT '1',
  `working_hours` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `work_location` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `reason_for_outsourcing` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `job_description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `key_responsibilities` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `min_qualification` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `required_skills` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `required_experience` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `est_monthly_cost_per_worker` decimal(10,2) DEFAULT NULL,
  `est_monthly_manpower_cost` decimal(12,2) DEFAULT NULL,
  `budget_cost_center` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `estimated_cost` decimal(12,2) DEFAULT NULL,
  `request_priority` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `supporting_document` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `manpower_outsourcing_positions`
--
ALTER TABLE `manpower_outsourcing_positions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `request_id` (`request_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `manpower_outsourcing_positions`
--
ALTER TABLE `manpower_outsourcing_positions`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `manpower_outsourcing_positions`
--
ALTER TABLE `manpower_outsourcing_positions`
  ADD CONSTRAINT `manpower_outsourcing_positions_ibfk_1` FOREIGN KEY (`request_id`) REFERENCES `manpower_outsourcing_requests` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
