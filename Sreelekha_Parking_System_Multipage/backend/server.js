const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const db = require('./config/db');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Mount API routes
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/vehicles', require('./routes/vehicleRoutes'));
app.use('/api/slots', require('./routes/slotRoutes'));
app.use('/api/records', require('./routes/recordRoutes'));

// GET /api/dashboard - Aggregated summary stats and recent activities
app.get('/api/dashboard', async (req, res, next) => {
  try {
    const [[slots]] = await db.query(`
      SELECT 
        COUNT(*) AS total,
        COALESCE(SUM(status = 'Available'), 0) AS available,
        COALESCE(SUM(status = 'Occupied'), 0) AS occupied,
        COALESCE(SUM(status = 'Maintenance'), 0) AS maintenance
      FROM parking_slots
    `);

    const [[records]] = await db.query(`
      SELECT 
        COUNT(*) AS total,
        COALESCE(SUM(status = 'Active'), 0) AS active,
        COALESCE(SUM(status = 'Completed'), 0) AS completed,
        COALESCE(SUM(CASE WHEN status = 'Completed' THEN parking_fee ELSE 0 END), 0) AS revenue
      FROM parking_records
    `);

    const [[vehicles]] = await db.query(`SELECT COUNT(*) AS total FROM vehicles`);
    const [[users]] = await db.query(`SELECT COUNT(*) AS total FROM users`);

    const [recent] = await db.query(`
      SELECT 
        pr.record_id,
        v.vehicle_number,
        v.vehicle_type,
        v.vehicle_model,
        u.name AS owner_name,
        ps.slot_number,
        ps.location,
        pr.entry_time,
        pr.exit_time,
        pr.parking_fee,
        pr.status,
        TIMESTAMPDIFF(MINUTE, pr.entry_time, COALESCE(pr.exit_time, NOW())) AS elapsed_minutes,
        GREATEST(1, CEIL(TIMESTAMPDIFF(MINUTE, pr.entry_time, COALESCE(pr.exit_time, NOW())) / 60)) AS billed_hours
      FROM parking_records pr
      JOIN vehicles v ON v.vehicle_id = pr.vehicle_id
      JOIN users u ON u.user_id = v.user_id
      JOIN parking_slots ps ON ps.slot_id = pr.slot_id
      ORDER BY pr.record_id DESC
      LIMIT 8
    `);

    res.json({
      slots: {
        total: Number(slots.total) || 0,
        available: Number(slots.available) || 0,
        occupied: Number(slots.occupied) || 0,
        maintenance: Number(slots.maintenance) || 0
      },
      records: {
        total: Number(records.total) || 0,
        active: Number(records.active) || 0,
        completed: Number(records.completed) || 0,
        revenue: Number(records.revenue) || 0
      },
      vehicles: {
        total: Number(vehicles.total) || 0
      },
      users: {
        total: Number(users.total) || 0
      },
      recent
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/parking/entry - Register owner, vehicle & assign parking slot
app.post('/api/parking/entry', async (req, res, next) => {
  const { name, phone, email, vehicleNumber, vehicleType, vehicleModel, slotId } = req.body;

  // Validation
  if (!name || !phone || !email || !vehicleNumber || !vehicleType || !vehicleModel) {
    return res.status(400).json({ message: 'All registration fields are required.' });
  }

  const cleanType = vehicleType.trim();
  if (!['Car', 'Bike'].includes(cleanType)) {
    return res.status(400).json({ message: 'Vehicle type must be Car or Bike.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanVehicleNo = vehicleNumber.trim().toUpperCase().replace(/\s+/g, ' ');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Find or create user
    let [userRows] = await conn.execute(
      'SELECT user_id FROM users WHERE email = ? FOR UPDATE',
      [cleanEmail]
    );

    let userId;
    if (userRows.length > 0) {
      userId = userRows[0].user_id;
      await conn.execute(
        'UPDATE users SET name = ?, phone = ? WHERE user_id = ?',
        [name.trim(), phone.trim(), userId]
      );
    } else {
      const [insertUser] = await conn.execute(
        'INSERT INTO users (name, phone, email, role) VALUES (?, ?, ?, ?)',
        [name.trim(), phone.trim(), cleanEmail, 'Customer']
      );
      userId = insertUser.insertId;
    }

    // 2. Find or create vehicle
    let [vehicleRows] = await conn.execute(
      'SELECT vehicle_id FROM vehicles WHERE vehicle_number = ? FOR UPDATE',
      [cleanVehicleNo]
    );

    let vehicleId;
    if (vehicleRows.length > 0) {
      vehicleId = vehicleRows[0].vehicle_id;
      await conn.execute(
        'UPDATE vehicles SET user_id = ?, vehicle_type = ?, vehicle_model = ? WHERE vehicle_id = ?',
        [userId, cleanType, vehicleModel.trim(), vehicleId]
      );
    } else {
      const [insertVehicle] = await conn.execute(
        'INSERT INTO vehicles (user_id, vehicle_number, vehicle_type, vehicle_model) VALUES (?, ?, ?, ?)',
        [userId, cleanVehicleNo, cleanType, vehicleModel.trim()]
      );
      vehicleId = insertVehicle.insertId;
    }

    // 3. Ensure vehicle is not already parked actively
    const [activeRecords] = await conn.execute(
      "SELECT record_id, slot_id FROM parking_records WHERE vehicle_id = ? AND status = 'Active'",
      [vehicleId]
    );
    if (activeRecords.length > 0) {
      throw new Error(`Vehicle ${cleanVehicleNo} already has an active parking session.`);
    }

    // 4. Assign slot: either specified slot or auto-assign best available
    let chosenSlot;
    if (slotId) {
      const [selectedSlotRows] = await conn.execute(
        "SELECT slot_id, slot_number, location, vehicle_type FROM parking_slots WHERE slot_id = ? AND status = 'Available' FOR UPDATE",
        [slotId]
      );
      if (!selectedSlotRows.length) {
        throw new Error('Selected parking slot is no longer available.');
      }
      chosenSlot = selectedSlotRows[0];
    } else {
      const [autoSlots] = await conn.execute(
        `SELECT slot_id, slot_number, location, vehicle_type 
         FROM parking_slots 
         WHERE status = 'Available' AND vehicle_type IN (?, 'Any') 
         ORDER BY (vehicle_type = ?) DESC, slot_number 
         LIMIT 1 FOR UPDATE`,
        [cleanType, cleanType]
      );
      if (!autoSlots.length) {
        throw new Error(`No available parking slot found for ${cleanType}.`);
      }
      chosenSlot = autoSlots[0];
    }

    // 5. Create parking record
    const [recordResult] = await conn.execute(
      "INSERT INTO parking_records (vehicle_id, slot_id, entry_time, status) VALUES (?, ?, NOW(), 'Active')",
      [vehicleId, chosenSlot.slot_id]
    );

    // 6. Mark slot Occupied
    await conn.execute(
      "UPDATE parking_slots SET status = 'Occupied' WHERE slot_id = ?",
      [chosenSlot.slot_id]
    );

    await conn.commit();

    res.status(201).json({
      message: `Vehicle registered. Assigned slot ${chosenSlot.slot_number} (${chosenSlot.location}).`,
      recordId: recordResult.insertId,
      slot: chosenSlot.slot_number,
      location: chosenSlot.location,
      vehicleNumber: cleanVehicleNo,
      ownerName: name.trim()
    });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Duplicate record exists in database.' });
    }
    if (err.message.includes('already has an active') || err.message.includes('No available')) {
      return res.status(409).json({ message: err.message });
    }
    next(err);
  } finally {
    conn.release();
  }
});

// POST /api/parking/exit/:id - Checkout vehicle and calculate bill
app.post('/api/parking/exit/:id', async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      `SELECT 
        pr.*, 
        v.vehicle_number, 
        v.vehicle_type, 
        v.vehicle_model, 
        u.name AS owner_name, 
        u.phone AS owner_phone,
        ps.slot_number, 
        ps.location
       FROM parking_records pr 
       JOIN vehicles v ON v.vehicle_id = pr.vehicle_id 
       JOIN users u ON u.user_id = v.user_id
       JOIN parking_slots ps ON ps.slot_id = pr.slot_id 
       WHERE pr.record_id = ? FOR UPDATE`,
      [req.params.id]
    );

    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ message: 'Parking record not found.' });
    }

    const record = rows[0];
    if (record.status !== 'Active') {
      await conn.rollback();
      return res.status(409).json({ message: 'This vehicle has already checked out.' });
    }

    // Calculate hours: minimum 1 hour, rounding up fractional hours
    const [durationResult] = await conn.query(
      'SELECT TIMESTAMPDIFF(MINUTE, ?, NOW()) AS total_minutes, GREATEST(1, CEIL(TIMESTAMPDIFF(MINUTE, ?, NOW()) / 60)) AS billable_hours',
      [record.entry_time, record.entry_time]
    );

    const totalMinutes = Math.max(1, Number(durationResult[0].total_minutes) || 1);
    const billableHours = Number(durationResult[0].billable_hours);
    const hourlyRate = record.vehicle_type === 'Car' ? 30 : 15;
    const totalFee = (billableHours * hourlyRate).toFixed(2);

    // Update record
    await conn.execute(
      "UPDATE parking_records SET exit_time = NOW(), parking_fee = ?, status = 'Completed' WHERE record_id = ?",
      [totalFee, record.record_id]
    );

    // Release slot to Available
    await conn.execute(
      "UPDATE parking_slots SET status = 'Available' WHERE slot_id = ?",
      [record.slot_id]
    );

    // Fetch updated record with exact exit_time string
    const [updatedRows] = await conn.query(
      'SELECT entry_time, exit_time FROM parking_records WHERE record_id = ?',
      [record.record_id]
    );

    await conn.commit();

    res.json({
      message: 'Vehicle checked out successfully.',
      recordId: record.record_id,
      vehicleNumber: record.vehicle_number,
      vehicleType: record.vehicle_type,
      vehicleModel: record.vehicle_model,
      ownerName: record.owner_name,
      ownerPhone: record.owner_phone,
      slotNumber: record.slot_number,
      location: record.location,
      entryTime: updatedRows[0].entry_time,
      exitTime: updatedRows[0].exit_time,
      totalMinutes,
      billableHours,
      hourlyRate,
      fee: totalFee
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// GET /api/health - Diagnostic check
app.get('/api/health', async (req, res, next) => {
  try {
    await db.query('SELECT 1');
    res.json({
      ok: true,
      service: 'Sreelekha Parking System',
      database: 'MySQL connected successfully'
    });
  } catch (err) {
    next(err);
  }
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(500).json({
    message: err.message || 'Internal server error. Please check MySQL server connection.'
  });
});

// Port listening with graceful port fallback
let TARGET_PORT = Number(process.env.PORT) || 5000;

function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`====================================================`);
    console.log(`🚗 Sreelekha Parking Management System running!`);
    console.log(`🌐 URL: http://localhost:${port}`);
    console.log(`====================================================`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} is in use, trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(TARGET_PORT);
