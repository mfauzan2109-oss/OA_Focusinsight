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
-- Table structure for table `resignations`
--

CREATE TABLE `resignations` (
  `id` int NOT NULL,
  `requested_by` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `request_date` date DEFAULT NULL,
  `request_department` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `employee_id` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `employee_name` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `department` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `position` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `employment_type` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `employment_date` date DEFAULT NULL,
  `last_working_date` date DEFAULT NULL,
  `notice_date` date DEFAULT NULL,
  `notice_period` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `reason` text COLLATE utf8mb4_general_ci,
  `hr_remarks` text COLLATE utf8mb4_general_ci,
  `supporting_document` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Pending',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `resignations`
--

INSERT INTO `resignations` (`id`, `requested_by`, `request_date`, `request_department`, `employee_id`, `employee_name`, `department`, `position`, `employment_type`, `employment_date`, `last_working_date`, `notice_date`, `notice_period`, `reason`, `hr_remarks`, `supporting_document`, `status`, `created_at`) VALUES
(1, 'Fauzan kedah', '2026-08-28', 'Human Resources', 'mgr002', 'Puan Noraini', 'Human Resources', 'Manager', 'Full Time', '2024-01-01', '2026-08-28', '2026-08-28', '1 month', 'fdf', 'dsfsd', NULL, 'Pending', '2026-08-28 16:07:55');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `resignations`
--
ALTER TABLE `resignations`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `resignations`
--
ALTER TABLE `resignations`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
