// ============================================================
// Skills + Notifications Routes
// ============================================================
const express = require('express');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/skills - all skills (any authenticated user)
router.get('/skills', authenticate, async (req, res) => {
  try {
    const [skills] = await db.query('SELECT * FROM skills ORDER BY category, skill_name');
    res.json({ skills });
  } catch (err) {
    console.error('[Skills GET]', err);
    res.status(500).json({ error: 'Failed to fetch skills' });
  }
});

// POST /api/skills - admin only
router.post('/skills', authenticate, requireRole('admin'), async (req, res) => {
  const { skill_name, category } = req.body;
  if (!skill_name) return res.status(400).json({ error: 'skill_name required' });
  try {
    const [result] = await db.query(
      'INSERT INTO skills (skill_name, category) VALUES (?, ?)',
      [skill_name, category || 'general']
    );
    res.status(201).json({ message: 'Skill added', id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Skill already exists' });
    }
    console.error('[Skills POST]', err);
    res.status(500).json({ error: 'Failed to add skill' });
  }
});

// GET /api/notifications
router.get('/notifications', authenticate, async (req, res) => {
  try {
    const [notifs] = await db.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    const [[unread]] = await db.query(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [req.user.id]
    );
    res.json({ notifications: notifs, unread_count: unread.count });
  } catch (err) {
    console.error('[Notif GET]', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PUT /api/notifications/:id/read
router.put('/notifications/:id/read', authenticate, async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Marked as read' });
  } catch (err) {
    console.error('[Notif Read]', err);
    res.status(500).json({ error: 'Failed to mark read' });
  }
});

// PUT /api/notifications/read-all
router.put('/notifications/read-all', authenticate, async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'All marked as read' });
  } catch (err) {
    console.error('[Notif ReadAll]', err);
    res.status(500).json({ error: 'Failed to mark all read' });
  }
});

module.exports = router;
