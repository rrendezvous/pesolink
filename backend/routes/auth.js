// ============================================================
// Auth Routes - Register, Login, Get Current User
// ============================================================
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password, role, profile } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ error: 'Email, password and role are required' });
  }
  if (role !== 'job_seeker') {
    return res.status(400).json({
      error: 'Self-registration is only available for job seekers. Employer accounts are created by PESO Admin.',
    });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    // Check if email exists
    const [existing] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userStatus = 'active';

    const [userResult] = await conn.query(
      'INSERT INTO users (email, password_hash, role, account_status) VALUES (?, ?, ?, ?)',
      [email, passwordHash, role, userStatus]
    );
    const userId = userResult.insertId;

    // Only job_seeker self-registration is allowed; employer accounts are admin-created.
    await conn.query(
      `INSERT INTO job_seekers (user_id, first_name, last_name, contact_number)
       VALUES (?, ?, ?, ?)`,
      [
        userId,
        profile?.first_name || '',
        profile?.last_name || '',
        profile?.contact_number || '',
      ]
    );

    await conn.commit();

    const token = jwt.sign(
      { id: userId, email, role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: { id: userId, email, role, account_status: userStatus },
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('[Register Error]', err);
    res.status(500).json({ error: 'Registration failed' });
  } finally {
    if (conn) conn.release();
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password, role } = req.body;
  const allowedRoles = ['job_seeker', 'employer', 'admin'];
  if (!email || !password || !role) {
    return res.status(400).json({ error: 'Email, password and role are required' });
  }
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid account role' });
  }

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const user = rows[0];

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.account_status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended. Contact PESO admin.' });
    }

    if (user.role !== role) {
      return res.status(403).json({ error: 'Selected login role does not match this account.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        account_status: user.account_status,
      },
    });
  } catch (err) {
    console.error('[Login Error]', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, email, role, account_status, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = users[0];
    let profile = null;

    if (user.role === 'job_seeker') {
      const [js] = await db.query('SELECT * FROM job_seekers WHERE user_id = ?', [user.id]);
      profile = js[0] || null;
    } else if (user.role === 'employer') {
      const [emp] = await db.query('SELECT * FROM employers WHERE user_id = ?', [user.id]);
      profile = emp[0] || null;
    } else if (user.role === 'admin') {
      const [adm] = await db.query('SELECT * FROM peso_admins WHERE user_id = ?', [user.id]);
      profile = adm[0] || null;
    }

    res.json({ user, profile });
  } catch (err) {
    console.error('[Me Error]', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
