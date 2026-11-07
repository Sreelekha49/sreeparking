const router = require('express').Router();
const db = require('../config/db');

// GET all registered vehicles with owner info and active parking status
router.get('/', async (req, res, next) => {
  try {
    const { search } = req.query;
    let query = `
      SELECT 
        v.vehicle_id,
        v.user_id,
        u.name AS owner_name,
        u.phone,
        u.email,
        v.vehicle_number,
        v.vehicle_type,
        v.vehicle_model,
        pr.record_id AS active_record_id,
        ps.slot_number AS current_slot,
        ps.location AS slot_location,
        pr.entry_time AS parked_at,
        CASE WHEN pr.record_id IS NOT NULL THEN 1 ELSE 0 END AS is_parked
      FROM vehicles v
      JOIN users u ON u.user_id = v.user_id
      LEFT JOIN parking_records pr ON pr.vehicle_id = v.vehicle_id AND pr.status = 'Active'
      LEFT JOIN parking_slots ps ON ps.slot_id = pr.slot_id
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim()) {
      query += ` AND (v.vehicle_number LIKE ? OR u.name LIKE ? OR u.phone LIKE ? OR v.vehicle_model LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    query += ' ORDER BY v.vehicle_id DESC';
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET available slots for a vehicle type (for dropdown selection in form)
router.get('/available-slots', async (req, res, next) => {
  try {
    const vehicleType = req.query.type || 'Car';
    const [slots] = await db.query(
      `SELECT slot_id, slot_number, vehicle_type, location 
       FROM parking_slots 
       WHERE status = 'Available' AND vehicle_type IN (?, 'Any') 
       ORDER BY (vehicle_type = ?) DESC, slot_number`,
      [vehicleType, vehicleType]
    );
    res.json(slots);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
