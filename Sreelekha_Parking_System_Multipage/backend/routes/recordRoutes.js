const router = require('express').Router();
const db = require('../config/db');

// GET all records with filtering and search
router.get('/', async (req, res, next) => {
  try {
    const { status, search } = req.query;
    let query = `
      SELECT 
        pr.record_id,
        pr.vehicle_id,
        pr.slot_id,
        pr.entry_time,
        pr.exit_time,
        pr.parking_fee,
        pr.status,
        v.vehicle_number,
        v.vehicle_type,
        v.vehicle_model,
        u.name AS owner_name,
        u.phone AS owner_phone,
        u.email AS owner_email,
        ps.slot_number,
        ps.location,
        TIMESTAMPDIFF(MINUTE, pr.entry_time, COALESCE(pr.exit_time, NOW())) AS elapsed_minutes,
        GREATEST(1, CEIL(TIMESTAMPDIFF(MINUTE, pr.entry_time, COALESCE(pr.exit_time, NOW())) / 60)) AS billed_hours
      FROM parking_records pr
      JOIN vehicles v ON v.vehicle_id = pr.vehicle_id
      JOIN users u ON u.user_id = v.user_id
      JOIN parking_slots ps ON ps.slot_id = pr.slot_id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'All') {
      query += ' AND pr.status = ?';
      params.push(status);
    }

    if (search && search.trim()) {
      query += ' AND (v.vehicle_number LIKE ? OR u.name LIKE ? OR ps.slot_number LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY pr.record_id DESC';
    const [rows] = await db.query(query, params);

    // Compute live estimated fee for active records
    const enriched = rows.map(r => {
      const rate = r.vehicle_type === 'Car' ? 30 : 15;
      const hours = Number(r.billed_hours);
      const fee = r.status === 'Completed' ? Number(r.parking_fee) : Number((hours * rate).toFixed(2));
      return {
        ...r,
        hourly_rate: rate,
        calculated_fee: fee
      };
    });

    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

// GET specific record by ID (for receipt modal)
router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        pr.record_id,
        pr.vehicle_id,
        pr.slot_id,
        pr.entry_time,
        pr.exit_time,
        pr.parking_fee,
        pr.status,
        v.vehicle_number,
        v.vehicle_type,
        v.vehicle_model,
        u.name AS owner_name,
        u.phone AS owner_phone,
        u.email AS owner_email,
        ps.slot_number,
        ps.location,
        TIMESTAMPDIFF(MINUTE, pr.entry_time, COALESCE(pr.exit_time, NOW())) AS elapsed_minutes,
        GREATEST(1, CEIL(TIMESTAMPDIFF(MINUTE, pr.entry_time, COALESCE(pr.exit_time, NOW())) / 60)) AS billed_hours
      FROM parking_records pr
      JOIN vehicles v ON v.vehicle_id = pr.vehicle_id
      JOIN users u ON u.user_id = v.user_id
      JOIN parking_slots ps ON ps.slot_id = pr.slot_id
      WHERE pr.record_id = ?
    `, [req.params.id]);

    if (!rows.length) return res.status(404).json({ message: 'Record not found.' });

    const r = rows[0];
    const rate = r.vehicle_type === 'Car' ? 30 : 15;
    const hours = Number(r.billed_hours);
    const fee = r.status === 'Completed' ? Number(r.parking_fee) : Number((hours * rate).toFixed(2));

    res.json({
      ...r,
      hourly_rate: rate,
      total_fee: fee
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
