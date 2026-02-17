/**
 * Database Module
 * Handles all SQLite database operations using better-sqlite3
 */

const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');
const { app } = require('electron');

const SALT_ROUNDS = 10;
const REMOTE_PASSWORD_HASH = bcrypt.hashSync('remote-user', SALT_ROUNDS);

class DatabaseManager {
  constructor() {
    this.db = null;
  }

  /**
   * Initialize database connection and create tables
   */
  initialize() {
    try {
      const dbPath = path.join(app.getPath('userData'), 'cooperative.db');
      console.log('Database path:', dbPath);
      
      this.db = new Database(dbPath);
      this.db.pragma('journal_mode = WAL');
      
      this.createTables();
      this.ensureMeetingsColumns();
      this.ensureMeetingSettingsColumns();
      this.seedDefaultAdmin();
      this.seedDefaultSettings();
      
      console.log('Database initialized successfully');
      return true;
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  /**
   * Create all required database tables
   */
  createTables() {
    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'host', 'member')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Meetings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meetings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        meeting_code TEXT UNIQUE NOT NULL,
        scheduled_time DATETIME NOT NULL,
        password TEXT,
        is_locked INTEGER DEFAULT 0,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    // Attendance table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meeting_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        join_time DATETIME NOT NULL,
        leave_time DATETIME,
        duration_minutes INTEGER,
        FOREIGN KEY (meeting_id) REFERENCES meetings(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Activity logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Meeting settings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meeting_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meeting_id INTEGER NOT NULL,
        chat_enabled INTEGER DEFAULT 1,
        screen_share_enabled INTEGER DEFAULT 1,
        recording_enabled INTEGER DEFAULT 0,
        host_can_lock INTEGER DEFAULT 1,
        host_can_mute INTEGER DEFAULT 1,
        host_can_video INTEGER DEFAULT 1,
        host_can_chat INTEGER DEFAULT 1,
        host_can_screen INTEGER DEFAULT 1,
        host_can_remove INTEGER DEFAULT 1,
        FOREIGN KEY (meeting_id) REFERENCES meetings(id)
      )
    `);

    // App settings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Polls table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS polls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meeting_id INTEGER NOT NULL,
        question TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (meeting_id) REFERENCES meetings(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    // Poll options table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS poll_options (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        poll_id INTEGER NOT NULL,
        option_text TEXT NOT NULL,
        FOREIGN KEY (poll_id) REFERENCES polls(id)
      )
    `);

    // Poll votes table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS poll_votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        poll_id INTEGER NOT NULL,
        option_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (poll_id) REFERENCES polls(id),
        FOREIGN KEY (option_id) REFERENCES poll_options(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(poll_id, user_id)
      )
    `);

    console.log('All tables created successfully');
  }

  ensureMeetingsColumns() {
    try {
      const columns = this.db.prepare('PRAGMA table_info(meetings)').all();
      const columnNames = new Set(columns.map((col) => col.name));

      if (!columnNames.has('is_ended')) {
        this.db.exec('ALTER TABLE meetings ADD COLUMN is_ended INTEGER DEFAULT 0');
      }
    } catch (error) {
      console.error('Failed to update meetings columns:', error);
    }
  }

  ensureMeetingSettingsColumns() {
    try {
      const columns = this.db.prepare('PRAGMA table_info(meeting_settings)').all();
      const columnNames = new Set(columns.map((col) => col.name));

      const addColumnIfMissing = (name, definition) => {
        if (!columnNames.has(name)) {
          this.db.exec(`ALTER TABLE meeting_settings ADD COLUMN ${name} ${definition}`);
        }
      };

      addColumnIfMissing('host_can_lock', 'INTEGER DEFAULT 1');
      addColumnIfMissing('host_can_mute', 'INTEGER DEFAULT 1');
      addColumnIfMissing('host_can_video', 'INTEGER DEFAULT 1');
      addColumnIfMissing('host_can_chat', 'INTEGER DEFAULT 1');
      addColumnIfMissing('host_can_screen', 'INTEGER DEFAULT 1');
      addColumnIfMissing('host_can_remove', 'INTEGER DEFAULT 1');
      addColumnIfMissing('host_can_end_meeting', 'INTEGER DEFAULT 1');
      addColumnIfMissing('allow_raise_hand', 'INTEGER DEFAULT 1');
      addColumnIfMissing('allow_screen_share', 'INTEGER DEFAULT 1');
      addColumnIfMissing('allow_recording', 'INTEGER DEFAULT 1');
      addColumnIfMissing('allow_system_audio', 'INTEGER DEFAULT 1');
    } catch (error) {
      console.error('Failed to update meeting_settings columns:', error);
    }
  }

  /**
   * Seed a default admin user for first-time setup
   */
  seedDefaultAdmin() {
    try {
      console.log('Seeding default admin...');
      const existingAdmin = this.db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
      
      if (existingAdmin) {
        console.log('Admin account already exists');
        return;
      }

      const password_hash = bcrypt.hashSync('admin123', SALT_ROUNDS);
      const stmt = this.db.prepare(`
        INSERT INTO users (full_name, email, password_hash, role)
        VALUES (?, ?, ?, ?)
      `);
      
      const result = stmt.run('System Administrator', 'admin@cooperative.local', password_hash, 'admin');
      console.log('Default admin created with ID:', result.lastInsertRowid);
      console.log('Email: admin@cooperative.local, Password: admin123');
    } catch (error) {
      console.error('Error seeding admin:', error.message);
    }
  }

  seedDefaultSettings() {
    try {
      // Ensure default signaling server URL exists
      this.db.prepare(`
        INSERT OR IGNORE INTO app_settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `).run('signalingServerUrl', 'http://127.0.0.1:3001');

      this.db.prepare(`
        INSERT OR IGNORE INTO app_settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `).run('backendApiUrl', '');
      
      console.log('Default settings initialized');
    } catch (error) {
      console.error('Error seeding default settings:', error);
    }
  }

  /**
   * User Authentication Methods
   */
  
  registerUser(full_name, email, password, role = 'member') {
    try {
      const password_hash = bcrypt.hashSync(password, SALT_ROUNDS);
      
      const stmt = this.db.prepare(`
        INSERT INTO users (full_name, email, password_hash, role)
        VALUES (?, ?, ?, ?)
      `);
      
      const result = stmt.run(full_name, email, password_hash, role);
      return { success: true, userId: result.lastInsertRowid };
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        return { success: false, error: 'Email already exists' };
      }
      return { success: false, error: error.message };
    }
  }

  loginUser(email, password) {
    try {
      if (!email || !password) {
        return { success: false, error: 'Email and password are required' };
      }

      const user = this.db.prepare(`
        SELECT id, full_name, email, password_hash, role
        FROM users
        WHERE email = ?
      `).get(email);
      
      if (!user) {
        return { success: false, error: 'Invalid credentials' };
      }

      // Validate password hash exists and is valid format
      if (!user.password_hash || typeof user.password_hash !== 'string') {
        console.error('Invalid password hash for user:', email);
        return { success: false, error: 'Invalid credentials' };
      }
      
      let passwordMatch = false;
      try {
        passwordMatch = bcrypt.compareSync(password, user.password_hash);
      } catch (bcryptError) {
        console.error('Bcrypt comparison error:', bcryptError.message);
        return { success: false, error: 'Invalid credentials' };
      }
      
      if (!passwordMatch) {
        return { success: false, error: 'Invalid credentials' };
      }
      
      // Don't return password hash
      delete user.password_hash;
      
      return { success: true, user };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'An error occurred during login. Please try again.' };
    }
  }

  /**
   * User Management Methods
   */
  
  getAllUsers() {
    try {
      const users = this.db.prepare(`
        SELECT id, full_name, email, role, created_at
        FROM users
        ORDER BY created_at DESC
      `).all();
      
      return { success: true, users };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getUserById(userId) {
    try {
      const user = this.db.prepare(`
        SELECT id, full_name, email, role, created_at
        FROM users
        WHERE id = ?
      `).get(userId);
      
      return { success: true, user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  updateUser(userId, full_name, email, role) {
    try {
      this.db.prepare(`
        UPDATE users
        SET full_name = ?, email = ?, role = ?
        WHERE id = ?
      `).run(full_name, email, role, userId);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  deleteUser(userId) {
    try {
      this.db.prepare('DELETE FROM users WHERE id = ?').run(userId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Meeting Management Methods
   */
  
  createMeeting(title, scheduled_time, created_by, password = null, hostPermissions = null) {
    try {
      const meeting_code = this.generateMeetingCode();

      const permissions = this.normalizeHostPermissions(hostPermissions);
      
      const stmt = this.db.prepare(`
        INSERT INTO meetings (title, meeting_code, scheduled_time, password, created_by)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(title, meeting_code, scheduled_time, password, created_by);
      
      // Create default meeting settings
      this.db.prepare(`
        INSERT INTO meeting_settings (
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
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        result.lastInsertRowid,
        permissions.canLock ? 1 : 0,
        permissions.canMute ? 1 : 0,
        permissions.canVideo ? 1 : 0,
        permissions.canChat ? 1 : 0,
        permissions.canScreen ? 1 : 0,
        permissions.canRemove ? 1 : 0,
        permissions.canEndMeeting ? 1 : 0,
        permissions.allowRaiseHand ? 1 : 0,
        permissions.allowScreenShare ? 1 : 0,
        permissions.allowRecording ? 1 : 0,
        permissions.allowSystemAudio ? 1 : 0
      );
      
      return { 
        success: true, 
        meetingId: result.lastInsertRowid,
        meeting_code 
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  normalizeHostPermissions(input) {
    return {
      canLock: input?.canLock !== undefined ? Boolean(input.canLock) : true,
      canMute: input?.canMute !== undefined ? Boolean(input.canMute) : true,
      canVideo: input?.canVideo !== undefined ? Boolean(input.canVideo) : true,
      canChat: input?.canChat !== undefined ? Boolean(input.canChat) : true,
      canScreen: input?.canScreen !== undefined ? Boolean(input.canScreen) : true,
      canRemove: input?.canRemove !== undefined ? Boolean(input.canRemove) : true,
      canEndMeeting: input?.canEndMeeting !== undefined ? Boolean(input.canEndMeeting) : true,
      allowRaiseHand: input?.allowRaiseHand !== undefined ? Boolean(input.allowRaiseHand) : true,
      allowScreenShare: input?.allowScreenShare !== undefined ? Boolean(input.allowScreenShare) : true,
      allowRecording: input?.allowRecording !== undefined ? Boolean(input.allowRecording) : true,
      allowSystemAudio: input?.allowSystemAudio !== undefined ? Boolean(input.allowSystemAudio) : true
    };
  }

  getMeetingByCode(meeting_code) {
    try {
      const meeting = this.db.prepare(`
        SELECT m.*, u.full_name as creator_name,
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
        WHERE m.meeting_code = ?
      `).get(meeting_code);
      
      return { success: true, meeting };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getMeetingSettingsByCode(meeting_code) {
    try {
      const settings = this.db.prepare(`
        SELECT ms.*
        FROM meeting_settings ms
        JOIN meetings m ON ms.meeting_id = m.id
        WHERE m.meeting_code = ?
      `).get(meeting_code);

      return { success: true, settings };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getMeetingSettingsById(meetingId) {
    try {
      const settings = this.db.prepare(`
        SELECT *
        FROM meeting_settings
        WHERE meeting_id = ?
      `).get(meetingId);

      return { success: true, settings };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  updateMeetingHostPermissions(meetingId, hostPermissions) {
    try {
      const permissions = this.normalizeHostPermissions(hostPermissions);

      this.db.prepare(`
        UPDATE meeting_settings
        SET host_can_lock = ?,
            host_can_mute = ?,
            host_can_video = ?,
            host_can_chat = ?,
            host_can_screen = ?,
            host_can_remove = ?,
            host_can_end_meeting = ?,
            allow_raise_hand = ?,
            allow_screen_share = ?,
            allow_recording = ?,
            allow_system_audio = ?
        WHERE meeting_id = ?
      `).run(
        permissions.canLock ? 1 : 0,
        permissions.canMute ? 1 : 0,
        permissions.canVideo ? 1 : 0,
        permissions.canChat ? 1 : 0,
        permissions.canScreen ? 1 : 0,
        permissions.canRemove ? 1 : 0,
        permissions.canEndMeeting ? 1 : 0,
        permissions.allowRaiseHand ? 1 : 0,
        permissions.allowScreenShare ? 1 : 0,
        permissions.allowRecording ? 1 : 0,
        permissions.allowSystemAudio ? 1 : 0,
        meetingId
      );

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getMeetingById(meetingId) {
    try {
      const meeting = this.db.prepare(`
        SELECT m.*, u.full_name as creator_name
        FROM meetings m
        JOIN users u ON m.created_by = u.id
        WHERE m.id = ?
      `).get(meetingId);

      return { success: true, meeting };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getAllMeetings() {
    try {
      const meetings = this.db.prepare(`
        SELECT m.*, u.full_name as creator_name
        FROM meetings m
        JOIN users u ON m.created_by = u.id
        ORDER BY m.scheduled_time DESC
      `).all();
      
      return { success: true, meetings };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  lockMeeting(meetingId, isLocked) {
    try {
      this.db.prepare(`
        UPDATE meetings
        SET is_locked = ?
        WHERE id = ?
      `).run(isLocked ? 1 : 0, meetingId);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  endMeeting(meetingCode) {
    try {
      this.db.prepare(`
        UPDATE meetings
        SET is_ended = 1
        WHERE meeting_code = ?
      `).run(meetingCode);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Poll Management Methods
   */

  createPoll(meetingId, question, options, createdBy) {
    const createPollTxn = this.db.transaction(() => {
      const pollStmt = this.db.prepare(`
        INSERT INTO polls (meeting_id, question, created_by)
        VALUES (?, ?, ?)
      `);

      const pollResult = pollStmt.run(meetingId, question, createdBy);
      const pollId = pollResult.lastInsertRowid;

      const optionStmt = this.db.prepare(`
        INSERT INTO poll_options (poll_id, option_text)
        VALUES (?, ?)
      `);

      const optionRows = options.map((optionText) => {
        const optionResult = optionStmt.run(pollId, optionText);
        return { id: optionResult.lastInsertRowid, option_text: optionText };
      });

      return { pollId, options: optionRows };
    });

    try {
      const result = createPollTxn();
      return { success: true, pollId: result.pollId, options: result.options };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getPollsByMeeting(meetingId) {
    try {
      const polls = this.db.prepare(`
        SELECT id, question, status, created_by, created_at
        FROM polls
        WHERE meeting_id = ?
        ORDER BY created_at DESC
      `).all(meetingId);

      const optionStmt = this.db.prepare(`
        SELECT id, option_text
        FROM poll_options
        WHERE poll_id = ?
        ORDER BY id ASC
      `);

      const voteStmt = this.db.prepare(`
        SELECT option_id, COUNT(*) as vote_count
        FROM poll_votes
        WHERE poll_id = ?
        GROUP BY option_id
      `);

      const result = polls.map((poll) => {
        const options = optionStmt.all(poll.id);
        const votes = voteStmt.all(poll.id);
        const voteMap = votes.reduce((acc, row) => {
          acc[row.option_id] = row.vote_count;
          return acc;
        }, {});

        return {
          ...poll,
          options: options.map((option) => ({
            ...option,
            votes: voteMap[option.id] || 0
          }))
        };
      });

      return { success: true, polls: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  recordPollVote(pollId, optionId, userId) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO poll_votes (poll_id, option_id, user_id)
        VALUES (?, ?, ?)
        ON CONFLICT(poll_id, user_id)
        DO UPDATE SET option_id = excluded.option_id
      `);
      stmt.run(pollId, optionId, userId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  closePoll(pollId) {
    try {
      this.db.prepare(`
        UPDATE polls
        SET status = 'closed'
        WHERE id = ?
      `).run(pollId);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Attendance Management Methods
   */
  
  recordJoin(meeting_id, user_id) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO attendance (meeting_id, user_id, join_time)
        VALUES (?, ?, datetime('now'))
      `);
      
      const result = stmt.run(meeting_id, user_id);
      return { success: true, attendanceId: result.lastInsertRowid };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  recordLeave(attendanceId) {
    try {
      this.db.prepare(`
        UPDATE attendance
        SET leave_time = datetime('now'),
            duration_minutes = CAST((julianday(datetime('now')) - julianday(join_time)) * 24 * 60 AS INTEGER)
        WHERE id = ?
      `).run(attendanceId);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getAttendanceByMeeting(meeting_id) {
    try {
      const attendance = this.db.prepare(`
        SELECT a.*, u.full_name, u.email
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        WHERE a.meeting_id = ?
        ORDER BY a.join_time DESC
      `).all(meeting_id);
      
      return { success: true, attendance };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getAttendanceByUser(user_id) {
    try {
      const attendance = this.db.prepare(`
        SELECT a.*, m.title as meeting_title, m.scheduled_time
        FROM attendance a
        JOIN meetings m ON a.meeting_id = m.id
        WHERE a.user_id = ?
        ORDER BY a.join_time DESC
      `).all(user_id);
      
      return { success: true, attendance };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getAttendanceSummary(filters = {}) {
    try {
      const conditions = [];
      const params = [];

      if (filters.startDate) {
        conditions.push('date(m.scheduled_time) >= date(?)');
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        conditions.push('date(m.scheduled_time) <= date(?)');
        params.push(filters.endDate);
      }

      if (filters.memberId) {
        conditions.push('a.user_id = ?');
        params.push(filters.memberId);
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const summary = this.db.prepare(`
        SELECT
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
        ORDER BY m.scheduled_time DESC
      `).all(...params);

      return { success: true, summary };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getAttendanceRecords(filters = {}) {
    try {
      const conditions = [];
      const params = [];

      if (filters.startDate) {
        conditions.push('date(m.scheduled_time) >= date(?)');
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        conditions.push('date(m.scheduled_time) <= date(?)');
        params.push(filters.endDate);
      }

      if (filters.memberId) {
        conditions.push('a.user_id = ?');
        params.push(filters.memberId);
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const records = this.db.prepare(`
        SELECT
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
        ORDER BY a.join_time DESC
      `).all(...params);

      return { success: true, records };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getAbsentMembers(filters = {}) {
    try {
      const conditions = [];
      const params = [];

      if (filters.startDate) {
        conditions.push('date(m.scheduled_time) >= date(?)');
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        conditions.push('date(m.scheduled_time) <= date(?)');
        params.push(filters.endDate);
      }

      if (filters.memberId) {
        conditions.push('u.id = ?');
        params.push(filters.memberId);
      }

      const whereClause = conditions.length ? `AND ${conditions.join(' AND ')}` : '';

      const rows = this.db.prepare(`
        SELECT
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
        ORDER BY m.scheduled_time DESC, u.full_name
      `).all(...params);

      return { success: true, rows };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getMemberAttendanceStats(filters = {}) {
    try {
      const meetingConditions = [];
      const memberConditions = ["role != 'admin'"];
      const params = [];

      if (filters.startDate) {
        meetingConditions.push('date(scheduled_time) >= date(?)');
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        meetingConditions.push('date(scheduled_time) <= date(?)');
        params.push(filters.endDate);
      }

      if (filters.memberId) {
        memberConditions.push('id = ?');
        params.push(filters.memberId);
      }

      const meetingWhere = meetingConditions.length ? `WHERE ${meetingConditions.join(' AND ')}` : '';
      const memberWhere = memberConditions.length ? `WHERE ${memberConditions.join(' AND ')}` : '';

      const stats = this.db.prepare(`
        WITH filtered_meetings AS (
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
        GROUP BY u.id
        ORDER BY u.full_name
      `).all(...params);

      return { success: true, stats };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Backend Cache Helpers
   */

  cacheUsersFromBackend(users = []) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO users (full_name, email, password_hash, role, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(email) DO UPDATE SET
          full_name = excluded.full_name,
          role = excluded.role,
          created_at = excluded.created_at
      `);

      const now = new Date().toISOString();
      users.forEach((user) => {
        stmt.run(
          user.full_name,
          user.email,
          REMOTE_PASSWORD_HASH,
          user.role || 'member',
          user.created_at || now
        );
      });

      return { success: true };
    } catch (error) {
      console.error('Cache users error:', error);
      return { success: false, error: error.message };
    }
  }

  cacheMeetingsFromBackend(meetings = []) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO meetings (
          title,
          meeting_code,
          scheduled_time,
          password,
          is_locked,
          is_ended,
          created_by,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(meeting_code) DO UPDATE SET
          title = excluded.title,
          scheduled_time = excluded.scheduled_time,
          password = excluded.password,
          is_locked = excluded.is_locked,
          is_ended = excluded.is_ended,
          created_by = excluded.created_by,
          created_at = excluded.created_at
      `);

      const now = new Date().toISOString();
      meetings.forEach((meeting) => {
        stmt.run(
          meeting.title,
          meeting.meeting_code,
          meeting.scheduled_time,
          meeting.password || null,
          meeting.is_locked ? 1 : 0,
          meeting.is_ended ? 1 : 0,
          meeting.created_by,
          meeting.created_at || now
        );
      });

      return { success: true };
    } catch (error) {
      console.error('Cache meetings error:', error);
      return { success: false, error: error.message };
    }
  }

  cacheAttendanceRecordsFromBackend(records = []) {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO attendance (
          id,
          meeting_id,
          user_id,
          join_time,
          leave_time,
          duration_minutes
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      records.forEach((record) => {
        stmt.run(
          record.id,
          record.meeting_id,
          record.user_id,
          record.join_time,
          record.leave_time || null,
          record.duration_minutes || null
        );
      });

      return { success: true };
    } catch (error) {
      console.error('Cache attendance error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Activity Log Methods
   */
  
  logActivity(user_id, action, details = null) {
    try {
      this.db.prepare(`
        INSERT INTO activity_logs (user_id, action, details)
        VALUES (?, ?, ?)
      `).run(user_id, action, details);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * App Settings Methods
   */
  
  getAppSetting(key, defaultValue = null) {
    try {
      const result = this.db.prepare(`
        SELECT value FROM app_settings WHERE key = ?
      `).get(key);
      
      return result ? result.value : defaultValue;
    } catch (error) {
      console.error('Get app setting error:', error);
      return defaultValue;
    }
  }

  setAppSetting(key, value) {
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO app_settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `).run(key, value);
      
      return { success: true };
    } catch (error) {
      console.error('Set app setting error:', error);
      return { success: false, error: error.message };
    }
  }

  getAllAppSettings() {
    try {
      const settings = this.db.prepare(`
        SELECT key, value FROM app_settings
      `).all();
      
      const result = {};
      settings.forEach(row => {
        result[row.key] = row.value;
      });
      
      return { success: true, settings: result };
    } catch (error) {
      console.error('Get all app settings error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Utility Methods
   */
  
  generateMeetingCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = DatabaseManager;
