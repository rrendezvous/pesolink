// ============================================================
// JWT Authentication Middleware
// ============================================================
const jwt = require('jsonwebtoken');
const db = require('../db');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    // Look up the account on every request so account changes take effect immediately.
    const [rows] = await db.query(
      'SELECT id, email, role, account_status FROM users WHERE id = ?',
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = rows[0];
    if (user.account_status !== 'active') {
      const error = user.account_status === 'pending'
        ? 'Account pending PESO admin approval.'
        : 'Account suspended. Contact PESO admin.';
      return res.status(403).json({ error });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      account_status: user.account_status,
    };
  } catch (err) {
    // Database problem, not a bad token: don't tell the user their session expired.
    console.error('[Auth]', err.message);
    return res.status(500).json({ error: 'Server error. Please try again in a moment.' });
  }
  next();
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
