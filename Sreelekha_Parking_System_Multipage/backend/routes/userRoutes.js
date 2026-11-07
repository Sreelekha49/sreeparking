const router = require('express').Router();
const db = require('../config/db');

// GET all users with summary stats
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        u.user_id,
        u.name,
        u.phone,
        u.email,
        u.role,
        COUNT(DISTINCT v.vehicle_id) AS vehicle_count,
        COUNT(DISTINCT pr.record_id) AS record_count
      FROM users u
      LEFT JOIN vehicles v ON v.user_id = u.user_id
      LEFT JOIN parking_records pr ON pr.vehicle_id = v.vehicle_id
      GROUP BY u.user_id, u.name, u.phone, u.email, u.role
      ORDER BY u.user_id DESC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET user by ID
router.get('/:id', async (req, res, next) => {
  try {
    const [users] = await db.query('SELECT * FROM users WHERE user_id = ?', [req.params.id]);
    if (!users.length) return res.status(404).json({ message: 'User not found' });
    const user = users[0];
    const [vehicles] = await db.query('SELECT * FROM vehicles WHERE user_id = ?', [req.params.id]);
    res.json({ ...user, vehicles });
  } catch (err) {
    next(err);
  }
});

// POST new user
router.post('/', async (req, res, next) => {
  try {
    const { name, phone, email, role = 'Customer' } = req.body;
    if (!name || !phone || !email) {
      return res.status(400).json({ message: 'Name, phone, and email are required.' });
    }
    const [result] = await db.execute(
      'INSERT INTO users (name, phone, email, role) VALUES (?, ?, ?, ?)',
      [name.trim(), phone.trim(), email.trim().toLowerCase(), role]
    );
    res.status(201).json({ message: 'User created successfully', userId: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'A user with this email already exists.' });
    }
    next(err);
  }
});

module.exports = router;
