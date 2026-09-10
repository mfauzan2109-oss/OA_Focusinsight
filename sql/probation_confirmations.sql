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

CREATE TABLE `probation_confirmations` (
  `id` int NOT NULL,
  `requested_by` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `request_date` date DEFAULT NULL,
  `department` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `employee_id` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `employee_name` varchar(150) COLLATE utf8mb4_general_ci NOT NULL,
  `employee_department` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `position` varchar(150) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `employment_type` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `employment_date` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `probation_period` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `probation_end_date` date DEFAULT NULL,
  `assessment_job_knowledge` tinyint DEFAULT NULL,
  `assessment_quality_of_work` tinyint DEFAULT NULL,
  `assessment_work_productivity` tinyint DEFAULT NULL,
  `assessment_communication_skills` tinyint DEFAULT NULL,
  `assessment_teamwork_collaboration` tinyint DEFAULT NULL,
  `assessment_problem_solving_initiative` tinyint DEFAULT NULL,
  `assessment_attendance_punctuality` tinyint DEFAULT NULL,
  `assessment_adaptability_learning` tinyint DEFAULT NULL,
  `assessment_responsibility_attitude` tinyint DEFAULT NULL,
  `assessment_compliance_policies` tinyint DEFAULT NULL,
  `total_points` tinyint DEFAULT NULL,
  `passing_points` tinyint DEFAULT '40',
  `overall_recommendation` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `proposed_confirmation_date` date DEFAULT NULL,
  `extended_probation_period` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `performance_summary` text COLLATE utf8mb4_general_ci,
  `status` varchar(50) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Pending',
  `last_reminder_sent` datetime DEFAULT NULL,
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
