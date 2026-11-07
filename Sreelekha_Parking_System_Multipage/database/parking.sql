-- ====================================================================
-- SREELEKHA PARKING MANAGEMENT SYSTEM
-- MySQL Database Script
-- ====================================================================

CREATE DATABASE IF NOT EXISTS sreelekha_parking;
USE sreelekha_parking;

-- --------------------------------------------------------------------
-- TABLE 1: USERS
-- Stores parking customers, security staff, and administrators.
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  role ENUM('Admin', 'Security Staff', 'Customer') NOT NULL DEFAULT 'Customer'
);

-- --------------------------------------------------------------------
-- TABLE 2: PARKING SLOTS
-- Stores physical parking spaces, floor location, vehicle type, and status.
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS parking_slots (
  slot_id INT AUTO_INCREMENT PRIMARY KEY,
  slot_number VARCHAR(20) NOT NULL UNIQUE,
  vehicle_type ENUM('Car', 'Bike', 'Any') NOT NULL DEFAULT 'Any',
  location VARCHAR(100) NOT NULL,
  status ENUM('Available', 'Occupied', 'Maintenance') NOT NULL DEFAULT 'Available'
);

-- --------------------------------------------------------------------
-- TABLE 3: VEHICLES
-- Stores registered vehicles linked to user accounts.
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vehicles (
  vehicle_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  vehicle_number VARCHAR(20) NOT NULL UNIQUE,
  vehicle_type ENUM('Car', 'Bike') NOT NULL,
  vehicle_model VARCHAR(100) NOT NULL,
  CONSTRAINT fk_vehicle_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- --------------------------------------------------------------------
-- TABLE 4: PARKING RECORDS
-- Logs check-in, check-out, duration, and calculated billing fees.
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS parking_records (
  record_id INT AUTO_INCREMENT PRIMARY KEY,
  vehicle_id INT NOT NULL,
  slot_id INT NOT NULL,
  entry_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  exit_time DATETIME NULL,
  parking_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status ENUM('Active', 'Completed') NOT NULL DEFAULT 'Active',
  CONSTRAINT fk_record_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
  CONSTRAINT fk_record_slot FOREIGN KEY (slot_id) REFERENCES parking_slots(slot_id) ON DELETE CASCADE
);

-- --------------------------------------------------------------------
-- SAMPLE DATA SEEDING
-- --------------------------------------------------------------------

-- 1. Insert Initial Slots across multiple levels
INSERT INTO parking_slots (slot_number, vehicle_type, location, status) VALUES
('A-01', 'Car',  'Ground Floor - Zone A', 'Available'),
('A-02', 'Car',  'Ground Floor - Zone A', 'Available'),
('A-03', 'Any',  'Ground Floor - Zone A', 'Available'),
('A-04', 'Bike', 'Ground Floor - Zone A', 'Available'),
('B-01', 'Bike', 'Basement - Level 1',     'Available'),
('B-02', 'Bike', 'Basement - Level 1',     'Available'),
('B-03', 'Any',  'Basement - Level 1',     'Available'),
('B-04', 'Car',  'Basement - Level 1',     'Available'),
('C-01', 'Car',  'First Floor - Zone C',   'Available'),
('C-02', 'Bike', 'First Floor - Zone C',   'Available'),
('C-03', 'Car',  'First Floor - Zone C',   'Available'),
('C-04', 'Any',  'First Floor - Zone C',   'Available')
ON DUPLICATE KEY UPDATE location = VALUES(location);

-- 2. Insert Sample System Users
INSERT INTO users (name, phone, email, role) VALUES
('Sreelekha', '9876543210', 'admin@sreelekha.com', 'Admin'),
('Ramesh Kumar', '9848022334', 'ramesh.k@gmail.com', 'Customer'),
('Priya Sharma', '9891234567', 'priya.sharma@outlook.com', 'Customer'),
('Venkat Rao', '9988776655', 'venkat.rao@yahoo.com', 'Customer')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 3. Insert Sample Vehicles
INSERT INTO vehicles (user_id, vehicle_number, vehicle_type, vehicle_model) VALUES
(2, 'AP 09 CD 5678', 'Car', 'Honda City'),
(3, 'TS 07 EA 1234', 'Car', 'Hyundai Creta'),
(4, 'AP 21 BF 9988', 'Bike', 'Royal Enfield Classic 350')
ON DUPLICATE KEY UPDATE vehicle_model = VALUES(vehicle_model);

-- 4. Insert Sample Parking Records
-- Record 1: Completed parking session
INSERT INTO parking_records (record_id, vehicle_id, slot_id, entry_time, exit_time, parking_fee, status)
VALUES (1, 1, 1, DATE_SUB(NOW(), INTERVAL 3 HOUR), DATE_SUB(NOW(), INTERVAL 1 HOUR), 60.00, 'Completed')
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- Record 2: Active parking session for vehicle 2 in slot A-02
INSERT INTO parking_records (record_id, vehicle_id, slot_id, entry_time, exit_time, parking_fee, status)
VALUES (2, 2, 2, DATE_SUB(NOW(), INTERVAL 45 MINUTE), NULL, 0.00, 'Active')
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- Mark slot A-02 as Occupied
UPDATE parking_slots SET status = 'Occupied' WHERE slot_number = 'A-02';

-- Record 3: Active parking session for bike in slot B-01
INSERT INTO parking_records (record_id, vehicle_id, slot_id, entry_time, exit_time, parking_fee, status)
VALUES (3, 3, 5, DATE_SUB(NOW(), INTERVAL 90 MINUTE), NULL, 0.00, 'Active')
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- Mark slot B-01 as Occupied
UPDATE parking_slots SET status = 'Occupied' WHERE slot_number = 'B-01';

-- --------------------------------------------------------------------
-- VERIFICATION
-- --------------------------------------------------------------------
SHOW TABLES;
SELECT 'Slots Count' AS Metric, COUNT(*) AS Value FROM parking_slots
UNION ALL
SELECT 'Users Count', COUNT(*) FROM users
UNION ALL
SELECT 'Vehicles Count', COUNT(*) FROM vehicles
UNION ALL
SELECT 'Records Count', COUNT(*) FROM parking_records;
