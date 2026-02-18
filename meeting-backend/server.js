require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

app.use(cors());
app.use(express.json());

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'host', 'member')),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS meetings (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      meeting_code TEXT UNIQUE NOT NULL,
      scheduled_time TIMESTAMP NOT NULL,
      password TEXT,
      is_locked BOOLEAN DEFAULT FALSE,
      is_ended BOOLEAN DEFAULT FALSE,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS meeting_settings (
      meeting_id INTEGER PRIMARY KEY REFERENCES meetings(id) ON DELETE CASCADE,
      host_can_lock BOOLEAN DEFAULT TRUE,
      host_can_mute BOOLEAN DEFAULT TRUE,
      host_can_video BOOLEAN DEFAULT TRUE,
      host_can_chat BOOLEAN DEFAULT TRUE,
      host_can_screen BOOLEAN DEFAULT TRUE,
      host_can_remove BOOLEAN DEFAULT TRUE,
      host_can_end_meeting BOOLEAN DEFAULT TRUE,
      allow_raise_hand BOOLEAN DEFAULT TRUE,
      allow_screen_share BOOLEAN DEFAULT TRUE,
      allow_recording BOOLEAN DEFAULT TRUE,
      allow_system_audio BOOLEAN DEFAULT TRUE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance (
      id SERIAL PRIMARY KEY,
      meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      join_time TIMESTAMP NOT NULL DEFAULT NOW(),
      leave_time TIMESTAMP,
      duration_minutes INTEGER
    )
  `);

  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@cooperative.local';
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
  if (existing.rows.length === 0) {
    const hash = await bcrypt.hash(adminPassword, 10);
    await pool.query(
      'INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
      ['System Administrator', adminEmail, hash, 'admin']
    );
    console.log(`Default admin created: ${adminEmail}`);
  }
}

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Missing token' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required.' });
  }
  return next();
}

function requireHost(req, res, next) {
  if (!req.user || (req.user.role !== 'host' && req.user.role !== 'admin')) {
    return res.status(403).json({ success: false, error: 'Host access required.' });
  }
  return next();
}

function normalizePermissions(input = {}) {
  return {
    canLock: input.canLock !== undefined ? Boolean(input.canLock) : true,
    canMute: input.canMute !== undefined ? Boolean(input.canMute) : true,
    canVideo: input.canVideo !== undefined ? Boolean(input.canVideo) : true,
    canChat: input.canChat !== undefined ? Boolean(input.canChat) : true,
    canScreen: input.canScreen !== undefined ? Boolean(input.canScreen) : true,
    canRemove: input.canRemove !== undefined ? Boolean(input.canRemove) : true,
    canEndMeeting: input.canEndMeeting !== undefined ? Boolean(input.canEndMeeting) : true,
    allowRaiseHand: input.allowRaiseHand !== undefined ? Boolean(input.allowRaiseHand) : true,
    allowScreenShare: input.allowScreenShare !== undefined ? Boolean(input.allowScreenShare) : true,
    allowRecording: input.allowRecording !== undefined ? Boolean(input.allowRecording) : true,
    allowSystemAudio: input.allowSystemAudio !== undefined ? Boolean(input.allowSystemAudio) : true
  };
}

function generateMeetingCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i += 1) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.post('/auth/register', async (req, res) => {
  try {
    const { full_name, email, password } = req.body || {};
    if (!full_name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Full name, email, and password are required.' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) {
      return res.status(409).json({ success: false, error: 'Email already exists' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, full_name, email, role, created_at',
      [full_name, email, hash, 'member']
    );

    return res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    const result = await pool.query('SELECT id, full_name, email, password_hash, role FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const token = signToken(user);
    delete user.password_hash;

    return res.json({ success: true, user, token });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, full_name, email, role, created_at FROM users ORDER BY created_at DESC');
    return res.json({ success: true, users: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, full_name, email, role, created_at FROM users WHERE id = $1',
      [id]
    );
    return res.json({ success: true, user: result.rows[0] || null });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { full_name, email, password, role } = req.body || {};
    if (!full_name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Full name, email, and password are required.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, full_name, email, role, created_at',
      [full_name, email, hash, role || 'member']
    );
    return res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, error: 'Email already exists' });
    }
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, email, role } = req.body || {};
    await pool.query(
      'UPDATE users SET full_name = $1, email = $2, role = $3 WHERE id = $4',
      [full_name, email, role, id]
    );
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/meetings', requireAuth, requireHost, async (req, res) => {
  try {
    const { title, scheduled_time, created_by, password, hostPermissions } = req.body || {};
    if (!title || !scheduled_time || !created_by) {
      return res.status(400).json({ success: false, error: 'Meeting title, time, and creator are required.' });
    }

    if (String(req.user.id) !== String(created_by) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Invalid meeting creator.' });
    }

    let meetingCode = generateMeetingCode();
    let collision = true;
    while (collision) {
      const existing = await pool.query('SELECT id FROM meetings WHERE meeting_code = $1', [meetingCode]);
      if (!existing.rows.length) {
        collision = false;
      } else {
        meetingCode = generateMeetingCode();
      }
    }

    const result = await pool.query(
      `INSERT INTO meetings (title, meeting_code, scheduled_time, password, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [title, meetingCode, scheduled_time, password || null, created_by]
    );

    const meetingId = result.rows[0].id;
    const perms = normalizePermissions(hostPermissions || {});

    await pool.query(
      `INSERT INTO meeting_settings (
        meeting_id,
        host_can_lock,
        host_can_mute,
        host_can_video,
        host_can_chat,
        host_can_screen,
        host_can_remove,
        host_can_end_meeting,
        allow_raise_hand,
        allow_screen_share,
        allow_recording,
        allow_system_audio
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        meetingId,
        perms.canLock,
        perms.canMute,
        perms.canVideo,
        perms.canChat,
        perms.canScreen,
        perms.canRemove,
        perms.canEndMeeting,
        perms.allowRaiseHand,
        perms.allowScreenShare,
        perms.allowRecording,
        perms.allowSystemAudio
      ]
    );

    return res.json({ success: true, meetingId, meeting_code: meetingCode });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/meetings', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.*, u.full_name as creator_name
       FROM meetings m
       JOIN users u ON m.created_by = u.id
       ORDER BY m.scheduled_time DESC`
    );
    return res.json({ success: true, meetings: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/meetings/code/:code', requireAuth, async (req, res) => {
  try {
    const { code } = req.params;
    const result = await pool.query(
      `SELECT m.*, u.full_name as creator_name,
        ms.host_can_lock,
        ms.host_can_mute,
        ms.host_can_video,
        ms.host_can_chat,
        ms.host_can_screen,
        ms.host_can_remove,
        ms.host_can_end_meeting,
        ms.allow_raise_hand,
        ms.allow_screen_share,
        ms.allow_recording,
        ms.allow_system_audio
      FROM meetings m
      JOIN users u ON m.created_by = u.id
      LEFT JOIN meeting_settings ms ON ms.meeting_id = m.id
      WHERE m.meeting_code = $1`,
      [code]
    );

    return res.json({ success: true, meeting: result.rows[0] || null });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/meetings/:id/settings', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM meeting_settings WHERE meeting_id = $1', [id]);
    return res.json({ success: true, settings: result.rows[0] || null });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/meetings/:id/settings', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const perms = normalizePermissions(req.body || {});

    await pool.query(
      `UPDATE meeting_settings SET
        host_can_lock = $1,
        host_can_mute = $2,
        host_can_video = $3,
        host_can_chat = $4,
        host_can_screen = $5,
        host_can_remove = $6,
        host_can_end_meeting = $7,
        allow_raise_hand = $8,
        allow_screen_share = $9,
        allow_recording = $10,
        allow_system_audio = $11
      WHERE meeting_id = $12`,
      [
        perms.canLock,
        perms.canMute,
        perms.canVideo,
        perms.canChat,
        perms.canScreen,
        perms.canRemove,
        perms.canEndMeeting,
        perms.allowRaiseHand,
        perms.allowScreenShare,
        perms.allowRecording,
        perms.allowSystemAudio,
        id
      ]
    );

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/meetings/:id/lock', requireAuth, requireHost, async (req, res) => {
  try {
    const { id } = req.params;
    const { isLocked } = req.body || {};

    const meeting = await pool.query('SELECT created_by FROM meetings WHERE id = $1', [id]);
    if (!meeting.rows.length) {
      return res.status(404).json({ success: false, error: 'Meeting not found.' });
    }

    if (req.user.role !== 'admin' && String(meeting.rows[0].created_by) !== String(req.user.id)) {
      return res.status(403).json({ success: false, error: 'Not authorized to lock this meeting.' });
    }

    await pool.query('UPDATE meetings SET is_locked = $1 WHERE id = $2', [Boolean(isLocked), id]);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/meetings/:code/end', requireAuth, requireHost, async (req, res) => {
  try {
    const { code } = req.params;
    await pool.query('UPDATE meetings SET is_ended = TRUE WHERE meeting_code = $1', [code]);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/attendance/join', requireAuth, async (req, res) => {
  try {
    const { meeting_id, user_id } = req.body || {};
    if (!meeting_id || !user_id) {
      return res.status(400).json({ success: false, error: 'Meeting and user are required.' });
    }
    if (String(user_id) !== String(req.user.id)) {
      return res.status(403).json({ success: false, error: 'Unauthorized attendance action.' });
    }

    const result = await pool.query(
      'INSERT INTO attendance (meeting_id, user_id) VALUES ($1, $2) RETURNING id',
      [meeting_id, user_id]
    );
    return res.json({ success: true, attendanceId: result.rows[0].id });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/attendance/leave', requireAuth, async (req, res) => {
  try {
    const { attendance_id } = req.body || {};
    if (!attendance_id) {
      return res.status(400).json({ success: false, error: 'Attendance id is required.' });
    }

    await pool.query(
      `UPDATE attendance
       SET leave_time = NOW(),
           duration_minutes = FLOOR(EXTRACT(EPOCH FROM (NOW() - join_time)) / 60)
       WHERE id = $1`,
      [attendance_id]
    );

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/attendance/by-meeting/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT a.*, u.full_name, u.email
       FROM attendance a
       JOIN users u ON a.user_id = u.id
       WHERE a.meeting_id = $1
       ORDER BY a.join_time DESC`,
      [id]
    );
    return res.json({ success: true, attendance: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/attendance/by-user/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (String(id) !== String(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Unauthorized access.' });
    }

    const result = await pool.query(
      `SELECT a.*, m.title as meeting_title, m.scheduled_time
       FROM attendance a
       JOIN meetings m ON a.meeting_id = m.id
       WHERE a.user_id = $1
       ORDER BY a.join_time DESC`,
      [id]
    );

    return res.json({ success: true, attendance: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/attendance/summary', requireAuth, requireAdmin, async (req, res) => {
  try {
    const conditions = [];
    const params = [];

    if (req.query.startDate) {
      params.push(req.query.startDate);
      conditions.push(`date(m.scheduled_time) >= date($${params.length})`);
    }

    if (req.query.endDate) {
      params.push(req.query.endDate);
      conditions.push(`date(m.scheduled_time) <= date($${params.length})`);
    }

    if (req.query.memberId) {
      params.push(req.query.memberId);
      conditions.push(`a.user_id = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT
        m.id as meeting_id,
        m.title,
        m.meeting_code,
        m.scheduled_time,
        COUNT(DISTINCT a.user_id) as attendee_count,
        (SELECT COUNT(*) FROM users WHERE role != 'admin') as total_members
      FROM meetings m
      LEFT JOIN attendance a ON a.meeting_id = m.id
      ${whereClause}
      GROUP BY m.id
      ORDER BY m.scheduled_time DESC`,
      params
    );

    return res.json({ success: true, summary: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/attendance/records', requireAuth, requireAdmin, async (req, res) => {
  try {
    const conditions = [];
    const params = [];

    if (req.query.startDate) {
      params.push(req.query.startDate);
      conditions.push(`date(m.scheduled_time) >= date($${params.length})`);
    }

    if (req.query.endDate) {
      params.push(req.query.endDate);
      conditions.push(`date(m.scheduled_time) <= date($${params.length})`);
    }

    if (req.query.memberId) {
      params.push(req.query.memberId);
      conditions.push(`a.user_id = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT
        a.id,
        m.title as meeting_title,
        m.meeting_code,
        m.scheduled_time,
        u.full_name,
        u.email,
        a.join_time,
        a.leave_time,
        a.duration_minutes
      FROM attendance a
      JOIN meetings m ON a.meeting_id = m.id
      JOIN users u ON a.user_id = u.id
      ${whereClause}
      ORDER BY a.join_time DESC`,
      params
    );

    return res.json({ success: true, records: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/attendance/absent', requireAuth, requireAdmin, async (req, res) => {
  try {
    const conditions = [];
    const params = [];

    if (req.query.startDate) {
      params.push(req.query.startDate);
      conditions.push(`date(m.scheduled_time) >= date($${params.length})`);
    }

    if (req.query.endDate) {
      params.push(req.query.endDate);
      conditions.push(`date(m.scheduled_time) <= date($${params.length})`);
    }

    if (req.query.memberId) {
      params.push(req.query.memberId);
      conditions.push(`u.id = $${params.length}`);
    }

    const whereClause = conditions.length ? `AND ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT
        m.id as meeting_id,
        m.title as meeting_title,
        m.meeting_code,
        m.scheduled_time,
        u.id as user_id,
        u.full_name,
        u.email
      FROM meetings m
      CROSS JOIN users u
      LEFT JOIN attendance a
        ON a.meeting_id = m.id AND a.user_id = u.id
      WHERE u.role != 'admin'
      AND a.id IS NULL
      ${whereClause}
      ORDER BY m.scheduled_time DESC, u.full_name`,
      params
    );

    return res.json({ success: true, rows: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/attendance/member-stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const meetingConditions = [];
    const memberConditions = ["role != 'admin'"];
    const params = [];

    if (req.query.startDate) {
      params.push(req.query.startDate);
      meetingConditions.push(`date(scheduled_time) >= date($${params.length})`);
    }

    if (req.query.endDate) {
      params.push(req.query.endDate);
      meetingConditions.push(`date(scheduled_time) <= date($${params.length})`);
    }

    if (req.query.memberId) {
      params.push(req.query.memberId);
      memberConditions.push(`id = $${params.length}`);
    }

    const meetingWhere = meetingConditions.length ? `WHERE ${meetingConditions.join(' AND ')}` : '';
    const memberWhere = memberConditions.length ? `WHERE ${memberConditions.join(' AND ')}` : '';

    const result = await pool.query(
      `WITH filtered_meetings AS (
        SELECT id FROM meetings
        ${meetingWhere}
      ),
      member_list AS (
        SELECT id, full_name, email, role FROM users
        ${memberWhere}
      )
      SELECT
        u.id as user_id,
        u.full_name,
        u.email,
        (SELECT COUNT(*) FROM filtered_meetings) as total_meetings,
        COUNT(DISTINCT a.meeting_id) as attended_meetings
      FROM member_list u
      LEFT JOIN attendance a
        ON a.user_id = u.id
        AND a.meeting_id IN (SELECT id FROM filtered_meetings)
      GROUP BY u.id, u.full_name, u.email
      ORDER BY u.full_name`,
      params
    );

    return res.json({ success: true, stats: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

initDb()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Backend API listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });
