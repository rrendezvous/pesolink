-- ============================================================
-- PESO-Link MisOr - MySQL Schema
-- IT323 Applications Development and Emerging Technology
-- ============================================================

CREATE DATABASE IF NOT EXISTS peso_link_misor
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE peso_link_misor;

-- Drop tables (idempotent for re-running seed)
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS application_status_history;
DROP TABLE IF EXISTS job_applications;
DROP TABLE IF EXISTS job_required_skills;
DROP TABLE IF EXISTS job_posts;
DROP TABLE IF EXISTS job_seeker_skills;
DROP TABLE IF EXISTS skills;
DROP TABLE IF EXISTS uploaded_nsrp_forms;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS peso_admins;
DROP TABLE IF EXISTS employers;
DROP TABLE IF EXISTS job_seekers;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. users (authentication base table)
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('job_seeker', 'employer', 'admin') NOT NULL,
  account_status ENUM('active', 'pending', 'suspended') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Note: the column is named `account_status` (renamed for consistency).

-- 2. job_seekers (NSRP profile fields)
CREATE TABLE job_seekers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  first_name VARCHAR(100),
  middle_name VARCHAR(100),
  last_name VARCHAR(100),
  date_of_birth DATE,
  gender ENUM('male', 'female', 'other'),
  civil_status ENUM('single', 'married', 'widowed', 'separated'),
  contact_number VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  province VARCHAR(100),
  education_level VARCHAR(100),
  course VARCHAR(100),
  years_of_experience INT DEFAULT 0,
  employment_status ENUM('unemployed', 'underemployed', 'employed'),
  preferred_occupation VARCHAR(255),
  nsrp_full_data JSON,
  profile_completed BOOLEAN DEFAULT FALSE,
  referral_status ENUM('draft', 'submitted', 'needs_revision', 'referral_ready') DEFAULT 'draft',
  referral_review_notes TEXT,
  referral_reviewed_by INT,
  referral_reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (referral_reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 3. employers (with PESO Admin approval)
CREATE TABLE employers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  company_address TEXT,
  contact_person VARCHAR(100),
  contact_number VARCHAR(20),
  business_type VARCHAR(100),
  company_size ENUM('small', 'medium', 'large'),
  approval_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  approved_by INT,
  approved_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 4. peso_admins
CREATE TABLE peso_admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  position VARCHAR(100),
  contact_number VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. skills (master list)
CREATE TABLE skills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  skill_name VARCHAR(100) UNIQUE NOT NULL,
  category VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. job_seeker_skills
CREATE TABLE job_seeker_skills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_seeker_id INT NOT NULL,
  skill_id INT NOT NULL,
  proficiency_level ENUM('beginner', 'intermediate', 'advanced', 'expert') DEFAULT 'beginner',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_seeker_id) REFERENCES job_seekers(id) ON DELETE CASCADE,
  FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
  UNIQUE KEY unique_seeker_skill (job_seeker_id, skill_id)
);

-- 7. job_posts
CREATE TABLE job_posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employer_id INT NOT NULL,
  job_title VARCHAR(255) NOT NULL,
  job_description TEXT NOT NULL,
  job_type ENUM('full-time', 'part-time', 'contract', 'temporary') DEFAULT 'full-time',
  salary_min DECIMAL(10, 2),
  salary_max DECIMAL(10, 2),
  location VARCHAR(255),
  vacancies INT DEFAULT 1,
  requirements TEXT,
  status ENUM('active', 'closed', 'draft') DEFAULT 'active',
  posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closing_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employer_id) REFERENCES employers(id) ON DELETE CASCADE
);

-- 8. job_required_skills
CREATE TABLE job_required_skills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_post_id INT NOT NULL,
  skill_id INT NOT NULL,
  required_level ENUM('beginner', 'intermediate', 'advanced', 'expert') DEFAULT 'beginner',
  is_required BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_post_id) REFERENCES job_posts(id) ON DELETE CASCADE,
  FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
  UNIQUE KEY unique_job_skill (job_post_id, skill_id)
);

-- 9. job_applications
CREATE TABLE job_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_post_id INT NOT NULL,
  job_seeker_id INT NOT NULL,
  application_status ENUM('submitted', 'pending', 'for_review', 'for_interview', 'hired', 'rejected', 'closed') DEFAULT 'submitted',
  cover_letter TEXT,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (job_post_id) REFERENCES job_posts(id) ON DELETE CASCADE,
  FOREIGN KEY (job_seeker_id) REFERENCES job_seekers(id) ON DELETE CASCADE,
  UNIQUE KEY unique_application (job_post_id, job_seeker_id)
);

-- 10. application_status_history
CREATE TABLE application_status_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  changed_by INT,
  notes TEXT,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES job_applications(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 11. notifications
CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50),
  is_read BOOLEAN DEFAULT FALSE,
  related_id INT,
  related_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 12. uploaded_nsrp_forms
CREATE TABLE uploaded_nsrp_forms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_seeker_id INT NOT NULL,
  image_base64 LONGTEXT NOT NULL,
  ocr_extracted_data JSON,
  ocr_confirmed BOOLEAN DEFAULT FALSE,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_seeker_id) REFERENCES job_seekers(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_jobs_status ON job_posts(status);
CREATE INDEX idx_applications_status ON job_applications(application_status);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
