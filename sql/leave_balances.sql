-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Sep 24, 2026 at 01:44 AM
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
-- Table structure for table `leave_balances`
--

CREATE TABLE `leave_balances` (
  `id` int NOT NULL,
  `employee_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `leave_type` enum('Annual Leave','Sick Leave','Hospitalization','Maternity','Paternity') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `year` int NOT NULL,
  `entitlement` decimal(5,1) NOT NULL DEFAULT '0.0',
  `carried_forward` decimal(5,1) NOT NULL DEFAULT '0.0',
  `carried_forward_expires` date DEFAULT NULL COMMENT 'e.g. 2026-06-30 — after this date the carried_forward amount should be treated as 0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `leave_balances`
--

INSERT INTO `leave_balances` (`id`, `employee_id`, `leave_type`, `year`, `entitlement`, `carried_forward`, `carried_forward_expires`, `created_at`, `updated_at`) VALUES
(1, 'EMP001', 'Hospitalization', 2026, 60.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(2, 'EMP002', 'Hospitalization', 2026, 60.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(3, 'EMP007', 'Hospitalization', 2026, 60.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(4, 'MGR003', 'Hospitalization', 2026, 60.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(5, 'EMP004', 'Hospitalization', 2026, 60.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(6, 'MGR002', 'Hospitalization', 2026, 60.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(7, 'EMP003', 'Hospitalization', 2026, 60.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(8, 'EMP561', 'Hospitalization', 2026, 60.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(9, 'MGR001', 'Hospitalization', 2026, 60.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(10, 'EMP666', 'Hospitalization', 2026, 60.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(11, 'EMP889', 'Hospitalization', 2026, 60.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(12, 'EMP0555', 'Hospitalization', 2026, 60.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(13, 'FIS-813292', 'Hospitalization', 2026, 60.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(14, 'EMP891', 'Hospitalization', 2026, 60.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(15, 'EMP890', 'Hospitalization', 2026, 60.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(16, 'EMP001', 'Maternity', 2026, 98.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(17, 'EMP002', 'Maternity', 2026, 98.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(18, 'EMP007', 'Maternity', 2026, 98.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(19, 'MGR003', 'Maternity', 2026, 98.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(20, 'EMP004', 'Maternity', 2026, 98.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(21, 'MGR002', 'Maternity', 2026, 98.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(22, 'EMP003', 'Maternity', 2026, 98.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(23, 'EMP561', 'Maternity', 2026, 98.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(24, 'MGR001', 'Maternity', 2026, 98.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(25, 'EMP666', 'Maternity', 2026, 98.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(26, 'EMP889', 'Maternity', 2026, 98.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(27, 'EMP0555', 'Maternity', 2026, 98.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(28, 'FIS-813292', 'Maternity', 2026, 98.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(29, 'EMP891', 'Maternity', 2026, 98.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(30, 'EMP890', 'Maternity', 2026, 98.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(31, 'EMP001', 'Paternity', 2026, 7.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(32, 'EMP002', 'Paternity', 2026, 7.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(33, 'EMP007', 'Paternity', 2026, 7.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(34, 'MGR003', 'Paternity', 2026, 7.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(35, 'EMP004', 'Paternity', 2026, 7.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(36, 'MGR002', 'Paternity', 2026, 7.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(37, 'EMP003', 'Paternity', 2026, 7.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(38, 'EMP561', 'Paternity', 2026, 7.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(39, 'MGR001', 'Paternity', 2026, 7.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(40, 'EMP666', 'Paternity', 2026, 7.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(41, 'EMP889', 'Paternity', 2026, 7.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(42, 'EMP0555', 'Paternity', 2026, 7.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(43, 'FIS-813292', 'Paternity', 2026, 7.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(44, 'EMP891', 'Paternity', 2026, 7.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51'),
(45, 'EMP890', 'Paternity', 2026, 7.0, 0.0, NULL, '2026-09-18 03:35:51', '2026-09-18 03:35:51');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `leave_balances`
--
ALTER TABLE `leave_balances`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_emp_type_year` (`employee_id`,`leave_type`,`year`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `leave_balances`
--
ALTER TABLE `leave_balances`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=46;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
