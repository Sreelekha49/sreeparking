# Sreelekha Parking Lot Management System

A full-stack, multipage web application for automated vehicle intake, parking slot allocation, real-time bay occupancy monitoring, duration-based billing calculation, and official tax invoice generation.

---

## 🚀 Quick Start (One-Click)

Simply double-click **`start.bat`** in the project folder!  
It starts the Node.js Express backend and opens `http://localhost:5000` in your default browser.

---

## 🛠️ Manual Run in VS Code / Terminal

### 1. Prerequisites
- **Node.js** (v18 or higher)
- **MySQL Server** (v8.0 or higher)

### 2. Database Setup
1. Open **MySQL Workbench** or command line client.
2. Run the SQL script located at:
   ```bash
   database/parking.sql
   ```
   This creates database `sreelekha_parking`, creates all 4 tables with foreign keys, and seeds sample slots and demo records.

### 3. Configure Database Password
Ensure `backend/.env` has your MySQL password (default is set to `sham`):
```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sham
DB_NAME=sreelekha_parking
```

### 4. Start the Application
Open a terminal in the root or `backend` folder and run:
```bash
cd backend
npm install
npm start
```
Then visit:
```
http://localhost:5000
```
*(If port 5000 is occupied by another application, the system automatically binds to port 5001 without crashing).*

---

## 🌐 Multipage System Structure

| Page | URL | Purpose |
| :--- | :--- | :--- |
| **Welcome** | `index.html` | System landing & portal gateway |
| **Home** | `home.html` | High-level workspace overview & 3-step workflow |
| **Dashboard** | `dashboard.html` | Live occupancy bar, revenue stats & recent movements |
| **Vehicles** | `vehicles.html` | Register vehicle owners, assign slots & search registered vehicles |
| **Parking Slots** | `parking-slots.html` | Multi-floor bay grid (Ground Floor, Basement, First Floor), maintenance toggle, add slot |
| **Records** | `parking-records.html` | Live parking audit log, checkout with printable tax receipts |
| **Users** | `users.html` | Accounts directory (Customers, Security Staff, Admin) |
| **About** | `about.html` | System architecture, ER schema & technical documentation |
| **Contact** | `contact.html` | Operations room helpline, emergency towing & support |

---

## 🗄️ Database Architecture (MySQL)

The system consists of **4 fully normalized tables** with cascade foreign keys:

1. **`users`**
   - `user_id` (INT PK AI)
   - `name` (VARCHAR 100)
   - `phone` (VARCHAR 20)
   - `email` (VARCHAR 120 UNIQUE)
   - `role` (ENUM: `'Admin'`, `'Security Staff'`, `'Customer'`)

2. **`parking_slots`**
   - `slot_id` (INT PK AI)
   - `slot_number` (VARCHAR 20 UNIQUE)
   - `vehicle_type` (ENUM: `'Car'`, `'Bike'`, `'Any'`)
   - `location` (VARCHAR 100)
   - `status` (ENUM: `'Available'`, `'Occupied'`, `'Maintenance'`)

3. **`vehicles`**
   - `vehicle_id` (INT PK AI)
   - `user_id` (INT FK -> `users.user_id`)
   - `vehicle_number` (VARCHAR 20 UNIQUE)
   - `vehicle_type` (ENUM: `'Car'`, `'Bike'`)
   - `vehicle_model` (VARCHAR 100)

4. **`parking_records`**
   - `record_id` (INT PK AI)
   - `vehicle_id` (INT FK -> `vehicles.vehicle_id`)
   - `slot_id` (INT FK -> `parking_slots.slot_id`)
   - `entry_time` (DATETIME DEFAULT CURRENT_TIMESTAMP)
   - `exit_time` (DATETIME NULL)
   - `parking_fee` (DECIMAL 10,2 DEFAULT 0.00)
   - `status` (ENUM: `'Active'`, `'Completed'`)

---

## 🏷️ Tariff Rules & Automated Billing

- **Four-Wheelers (Car):** ₹30.00 / hour
- **Two-Wheelers (Bike):** ₹15.00 / hour
- **Billing Formula:**
  $$\text{Fee} = \max\left(1, \lceil \text{Duration (min)} / 60 \rceil\right) \times \text{Hourly Rate}$$
- Minimum billable time is 1 hour. Any started hour is rounded up to the nearest whole hour.
- Generates an official, printable Tax Invoice & Receipt upon vehicle check-out.

---

## 📡 REST API Summary

- `GET /api/dashboard` – Overall statistics, slot utilization & recent activity
- `GET /api/slots` – List slots with filtering (`status`, `vehicle_type`, `location`)
- `POST /api/slots` – Add a new parking bay
- `PATCH /api/slots/:id/status` – Update slot status (e.g., toggle Maintenance)
- `GET /api/vehicles` – List registered vehicles with active parking states
- `GET /api/vehicles/available-slots?type=Car` – Available slots dropdown
- `POST /api/parking/entry` – Check in vehicle and allocate optimal slot
- `POST /api/parking/exit/:id` – Check out vehicle and calculate bill
- `GET /api/records` – Complete entry & exit audit log
- `GET /api/records/:id` – Single record invoice details
- `GET /api/users` – User accounts directory with vehicle & session counts
- `GET /api/health` – Diagnostic health check
