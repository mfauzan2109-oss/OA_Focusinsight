-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Sep 15, 2026
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
-- Database: `fis_os_system`
--

-- --------------------------------------------------------

--
-- Table structure for table `india_visa_applications`
--
-- Columns mirror the INSERT in routes/legacy-forms.routes.js
-- (POST /api/submit-india-visa-application).
--

CREATE TABLE `india_visa_applications` (
  `id` int NOT NULL,
  `employee_id` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `full_name` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `department` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `position` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `ic_passport_no` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `phone_no` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `company_email` varchar(150) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `religion` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `edu_qualification` varchar(150) COLLATE utf8mb4_general_ci NOT NULL,
  `course_qualification` varchar(150) COLLATE utf8mb4_general_ci NOT NULL,
  `port_of_arrival` varchar(150) COLLATE utf8mb4_general_ci NOT NULL,
  `present_address` text COLLATE utf8mb4_general_ci NOT NULL,
  `permanent_address` text COLLATE utf8mb4_general_ci,
  `father_full_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `father_nationality` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `father_prev_nationality` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `father_place_of_birth` varchar(150) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `father_country_of_birth` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `mother_full_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `mother_nationality` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `mother_prev_nationality` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `mother_place_of_birth` varchar(150) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `mother_country_of_birth` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `marital_status` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `spouse_name` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `spouse_nationality` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `spouse_prev_nationality` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `spouse_place_of_birth` varchar(150) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `spouse_country_of_birth` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `visited_india_before` varchar(3) COLLATE utf8mb4_general_ci NOT NULL,
  `address_of_stay` text COLLATE utf8mb4_general_ci,
  `city_visited` varchar(150) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `visa_no` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `visa_type` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `place_of_issue` varchar(150) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `date_of_issue` date DEFAULT NULL,
  `permission_refused` varchar(3) COLLATE utf8mb4_general_ci NOT NULL,
  `control_no` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `refusal_date` date DEFAULT NULL,
  `refused_by_authority` varchar(150) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `refusal_remarks` text COLLATE utf8mb4_general_ci,
  `photo_document` varchar(500) COLLATE utf8mb4_general_ci NOT NULL,
  `passport_page_document` varchar(500) COLLATE utf8mb4_general_ci NOT NULL,
  `invitation_letter_document` varchar(500) COLLATE utf8mb4_general_ci NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Pending',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `india_visa_applications`
--
ALTER TABLE `india_visa_applications`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `india_visa_applications`
--
ALTER TABLE `india_visa_applications`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;