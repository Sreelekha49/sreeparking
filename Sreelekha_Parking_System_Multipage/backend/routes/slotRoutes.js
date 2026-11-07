const router = require('express').Router();
const db = require('../config/db');

// GET all slots with optional filtering and active vehicle info
router.get('/', async (req, res, next) => {
  try {
    const { status, vehicle_type, location } = req.query;
    let query = `
      SELECT 
        ps.slot_id,
        ps.slot_number,
        ps.vehicle_type,
        ps.location,
        ps.status,
        pr.record_id AS active_record_id,
        v.vehicle_number AS occupied_vehicle_number,
        v.vehicle_model AS occupied_vehicle_model,
        pr.entry_time AS occupied_since
      FROM parking_slots ps
      LEFT JOIN parking_records pr ON pr.slot_id = ps.slot_id AND pr.status = 'Active'
      LEFT JOIN vehicles v ON v.vehicle_id = pr.vehicle_id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'All') {
      query += ' AND ps.status = ?';
      params.push(status);
    }
    if (vehicle_type && vehicle_type !== 'All') {
      query += ' AND ps.vehicle_type = ?';
      params.push(vehicle_type);
    }
    if (location && location !== 'All') {
      query += ' AND ps.location = ?';
      params.push(location);
    }

    query += ' ORDER BY ps.slot_number';
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST create a new slot
router.post('/', async (req, res, next) => {
  try {
    const { slot_number, vehicle_type = 'Any', location } = req.body;
    if (!slot_number || !location) {
      return res.status(400).json({ message: 'Slot number and location are required.' });
    }
    const [result] = await db.execute(
      'INSERT INTO parking_slots (slot_number, vehicle_type, location, status) VALUES (?, ?, ?, ?)',
      [slot_number.trim().toUpperCase(), vehicle_type, location.trim(), 'Available']
    );
    res.status(201).json({
      message: `Slot ${slot_number.trim().toUpperCase()} added successfully.`,
      slotId: result.insertId
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: `Slot number '${req.body.slot_number}' already exists.` });
    }
    next(err);
  }
});

// PATCH update slot status (e.g. set Maintenance or Available)
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['Available', 'Occupied', 'Maintenance'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value.' });
    }
    const [existing] = await db.query('SELECT * FROM parking_slots WHERE slot_id = ?', [req.params.id]);
    if (!existing.length) {
      return res.status(404).json({ message: 'Slot not found.' });
    }
    if (existing[0].status === 'Occupied' && status !== 'Occupied') {
      return res.status(400).json({ message: 'Cannot change status while slot is actively occupied.' });
    }
    await db.execute('UPDATE parking_slots SET status = ? WHERE slot_id = ?', [status, req.params.id]);
    res.json({ message: `Slot status updated to ${status}.` });
  } catch (err) {
    next(err);
  }
});

// DELETE a slot (only if not occupied)
router.delete('/:id', async (req, res, next) => {
  try {
    const [existing] = await db.query('SELECT * FROM parking_slots WHERE slot_id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: 'Slot not found.' });
    if (existing[0].status === 'Occupied') {
      return res.status(400).json({ message: 'Cannot delete an occupied slot.' });
    }
    await db.execute('DELETE FROM parking_slots WHERE slot_id = ?', [req.params.id]);
    res.json({ message: 'Slot deleted successfully.' });
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ message: 'Cannot delete slot because it has associated parking history records.' });
    }
    next(err);
  }
});

module.exports = router;
