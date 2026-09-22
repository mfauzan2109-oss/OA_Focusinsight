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
-- Table structure for table `probation_confirmations`
--

-- This file's original CREATE TABLE (assessment_job_knowledge,
-- overall_recommendation, performance_summary, etc.) did not match the
-- live table - it looks like it was written for a planned redesign that
-- was never actually migrated in. Rewritten below to match the real,
-- currently-running schema (confirmed via DESCRIBE on the live DB,
-- 2026-09-22), with the 5 old assessment columns made nullable per
-- sql/probation_confirmations_migration.sql, since the current form design
-- has the Manager fill those in later via probation-confirmation-detail.html
-- rather than HR filling them in at submission time.

CREATE TABLE `probation_confirmations` (
  `id` int NOT NULL,
  `requested_by` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `request_date` date DEFAULT NULL,
  `department` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `employee_id` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `employee_name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `employee_department` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `position` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `employment_type` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `employment_date` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `probation_period` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `probation_end_date` date NOT NULL,
  `reason_remarks` text COLLATE utf8mb4_general_ci,
  `overall_performance` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `work_performance` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `attendance_punctuality` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `work_attitude_teamwork` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `recommendation` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `justification` text COLLATE utf8mb4_general_ci,
  `supporting_document` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Pending',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `probation_confirmations`
--
ALTER TABLE `probation_confirmations`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `probation_confirmations`
--
ALTER TABLE `probation_confirmations`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
