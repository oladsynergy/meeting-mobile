/**
 * IPC Handlers Module
 * Handles all inter-process communication between renderer and main process
 */

const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const BackendClient = require('./backendClient');

class IPCHandlers {
  constructor(dbManager) {
    this.db = dbManager;
    this.setupHandlers();
  }

  setupHandlers() {
    const getSessionUser = () => global.sessionUser || null;
    const isAdmin = (user) => user && user.role === 'admin';
    const isHost = (user) => user && (user.role === 'host' || user.role === 'admin');
    const getBackendClient = () => {
      const backendUrl = this.db.getAppSetting('backendApiUrl');
      if (!backendUrl) {
        return null;
      }
      const token = global.sessionUser?.token || null;
      return new BackendClient(backendUrl, token);
    };
    const buildQueryString = (filters) => {
      if (!filters) {
        return '';
      }

      const params = new URLSearchParams();
      if (filters.startDate) {
        params.set('startDate', filters.startDate);
      }
      if (filters.endDate) {
        params.set('endDate', filters.endDate);
      }
      if (filters.memberId) {
        params.set('memberId', filters.memberId);
      }

      const query = params.toString();
      return query ? `?${query}` : '';
    };

    // Authentication Handlers
    ipcMain.handle('user:register', async (event, { full_name, email, password, role }) => {
      const sessionUser = getSessionUser();
      const backendClient = getBackendClient();

      if (backendClient) {
        try {
          if (role && role !== 'member') {
            if (!isAdmin(sessionUser)) {
              return { success: false, error: 'Only admins can create admin accounts.' };
            }
            const result = await backendClient.post('/users', { full_name, email, password, role });
            if (result.success && result.user) {
              this.db.cacheUsersFromBackend([result.user]);
            }
            return result;
          }

          const result = await backendClient.post('/auth/register', { full_name, email, password });
          if (result.success && result.user) {
            this.db.cacheUsersFromBackend([result.user]);
          }
          return result;
        } catch (error) {
          return { success: false, error: `Backend error: ${error.message}` };
        }
      }

      if (role === 'admin' && !isAdmin(sessionUser)) {
        return { success: false, error: 'Only admins can create admin accounts.' };
      }
      return this.db.registerUser(full_name, email, password, role);
    });

    ipcMain.handle('user:login', async (event, { email, password }) => {
      try {
        if (!email || !password) {
          return { success: false, error: 'Email and password are required' };
        }
        const backendClient = getBackendClient();
        if (backendClient) {
          const result = await backendClient.post('/auth/login', { email, password, platform: 'desktop' });
          if (result.success && result.user) {
            this.db.cacheUsersFromBackend([result.user]);
            return { success: true, user: { ...result.user, token: result.token } };
          }
          return result;
        }

        const result = this.db.loginUser(email, password);
        if (!result) {
          return { success: false, error: 'Login system error' };
        }
        return result;
      } catch (error) {
        console.error('IPC login handler error:', error);
        return { success: false, error: 'An error occurred during login' };
      }
    });

    // User Management Handlers
    ipcMain.handle('user:getAll', async () => {
      const backendClient = getBackendClient();
      if (backendClient) {
        try {
          const result = await backendClient.get('/users');
          if (result.success && result.users) {
            this.db.cacheUsersFromBackend(result.users);
          }
          return result;
        } catch (error) {
          return { success: false, error: `Backend error: ${error.message}` };
        }
      }
      return this.db.getAllUsers();
    });

    ipcMain.handle('user:getById', async (event, userId) => {
      const backendClient = getBackendClient();
      if (backendClient) {
        try {
          return await backendClient.get(`/users/${userId}`);
        } catch (error) {
          return { success: false, error: `Backend error: ${error.message}` };
        }
      }
      return this.db.getUserById(userId);
    });

    ipcMain.handle('user:update', async (event, { userId, full_name, email, role }) => {
      const sessionUser = getSessionUser();
      if (!isAdmin(sessionUser)) {
        return { success: false, error: 'Admin access required.' };
      }
      const backendClient = getBackendClient();
      if (backendClient) {
        try {
          return await backendClient.put(`/users/${userId}`, { full_name, email, role });
        } catch (error) {
          return { success: false, error: `Backend error: ${error.message}` };
        }
      }
      return this.db.updateUser(userId, full_name, email, role);
    });

    ipcMain.handle('user:delete', async (event, userId) => {
      const sessionUser = getSessionUser();
      if (!isAdmin(sessionUser)) {
        return { success: false, error: 'Admin access required.' };
      }
      const backendClient = getBackendClient();
      if (backendClient) {
        try {
          return await backendClient.delete(`/users/${userId}`);
        } catch (error) {
          return { success: false, error: `Backend error: ${error.message}` };
        }
      }
      return this.db.deleteUser(userId);
    });

    // Meeting Handlers
    ipcMain.handle('meeting:create', async (event, { title, scheduled_time, created_by, password, hostPermissions }) => {
      const sessionUser = getSessionUser();
      if (!isHost(sessionUser)) {
        return { success: false, error: 'Host access required.' };
      }
      if (!sessionUser || String(sessionUser.id) !== String(created_by)) {
        return { success: false, error: 'Invalid meeting creator.' };
      }
      const effectivePermissions = isAdmin(sessionUser) ? hostPermissions : null;
      const backendClient = getBackendClient();
      if (backendClient) {
        try {
          return await backendClient.post('/meetings', {
            title,
            scheduled_time,
            created_by,
            password,
            hostPermissions: effectivePermissions
          });
        } catch (error) {
          return { success: false, error: `Backend error: ${error.message}` };
        }
      }
      return this.db.createMeeting(title, scheduled_time, created_by, password, effectivePermissions);
    });

    ipcMain.handle('meeting:getByCode', async (event, meeting_code) => {
      const backendClient = getBackendClient();
      if (backendClient) {
        try {
          const result = await backendClient.get(`/meetings/code/${meeting_code}`);
          if (result.success && result.meeting) {
            this.db.cacheMeetingsFromBackend([result.meeting]);
          }
          return result;
        } catch (error) {
          return { success: false, error: `Backend error: ${error.message}` };
        }
      }
      return this.db.getMeetingByCode(meeting_code);
    });

    ipcMain.handle('meeting:getAll', async () => {
      const backendClient = getBackendClient();
      if (backendClient) {
        try {
          const result = await backendClient.get('/meetings');
          if (result.success && result.meetings) {
            this.db.cacheMeetingsFromBackend(result.meetings);
          }
          return result;
        } catch (error) {
          return { success: false, error: `Backend error: ${error.message}` };
        }
      }
      return this.db.getAllMeetings();
    });

    ipcMain.handle('meeting:settings:get', async (event, meetingId) => {
      const sessionUser = getSessionUser();
      if (!isAdmin(sessionUser)) {
        return { success: false, error: 'Admin access required.' };
      }
      const backendClient = getBackendClient();
      if (backendClient) {
        try {
          return await backendClient.get(`/meetings/${meetingId}/settings`);
        } catch (error) {
          return { success: false, error: `Backend error: ${error.message}` };
        }
      }
      return this.db.getMeetingSettingsById(meetingId);
    });

    ipcMain.handle('meeting:settings:update', async (event, { meetingId, hostPermissions }) => {
      const sessionUser = getSessionUser();
      if (!isAdmin(sessionUser)) {
        return { success: false, error: 'Admin access required.' };
      }
      const backendClient = getBackendClient();
      if (backendClient) {
        try {
          return await backendClient.put(`/meetings/${meetingId}/settings`, hostPermissions);
        } catch (error) {
          return { success: false, error: `Backend error: ${error.message}` };
        }
      }
      return this.db.updateMeetingHostPermissions(meetingId, hostPermissions);
    });

    ipcMain.handle('meeting:lock', async (event, { meetingId, isLocked }) => {
      const sessionUser = getSessionUser();
      if (!isHost(sessionUser)) {
        return { success: false, error: 'Host access required.' };
      }
      const backendClient = getBackendClient();
      if (backendClient) {
        try {
          return await backendClient.post(`/meetings/${meetingId}/lock`, { isLocked });
        } catch (error) {
          return { success: false, error: `Backend error: ${error.message}` };
        }
      }

      const meetingResult = this.db.getMeetingById(meetingId);
      if (!meetingResult.success || !meetingResult.meeting) {
        return { success: false, error: 'Meeting not found.' };
      }

      if (!isAdmin(sessionUser) && String(meetingResult.meeting.created_by) !== String(sessionUser.id)) {
        return { success: false, error: 'Not authorized to lock this meeting.' };
      }

      return this.db.lockMeeting(meetingId, isLocked);
    });

    // Poll Handlers
    ipcMain.handle('poll:create', async (event, { meetingId, question, options }) => {
      const sessionUser = getSessionUser();
      if (!isHost(sessionUser)) {
        return { success: false, error: 'Host access required.' };
      }
      return this.db.createPoll(meetingId, question, options, sessionUser.id);
    });

    ipcMain.handle('poll:list', async (event, meetingId) => {
      return this.db.getPollsByMeeting(meetingId);
    });

    ipcMain.handle('poll:vote', async (event, { pollId, optionId, userId }) => {
      const sessionUser = getSessionUser();
      if (!sessionUser || String(sessionUser.id) !== String(userId)) {
        return { success: false, error: 'Unauthorized vote.' };
      }
      return this.db.recordPollVote(pollId, optionId, userId);
    });

    ipcMain.handle('poll:close', async (event, pollId) => {
      const sessionUser = getSessionUser();
      if (!isHost(sessionUser)) {
        return { success: false, error: 'Host access required.' };
      }
      return this.db.closePoll(pollId);
    });

    // Attendance Handlers
    ipcMain.handle('attendance:recordJoin', async (event, { meeting_id, user_id }) => {
      const sessionUser = getSessionUser();
      if (!sessionUser || String(sessionUser.id) !== String(user_id)) {
        return { success: false, error: 'Unauthorized attendance action.' };
      }
      const backendClient = getBackendClient();
      if (backendClient) {
        try {
          return await backendClient.post('/attendance/join', { meeting_id, user_id });
        } catch (error) {
          return { success: false, error: `Backend error: ${error.message}` };
        }
      }
      return this.db.recordJoin(meeting_id, user_id);
    });

    ipcMain.handle('attendance:recordLeave', async (event, attendanceId) => {
      const backendClient = getBackendClient();
      if (backendClient) {
        try {
          return await backendClient.post('/attendance/leave', { attendance_id: attendanceId });
        } catch (error) {
          return { success: false, error: `Backend error: ${error.message}` };
        }
      }
      return this.db.recordLeave(attendanceId);
    });

    ipcMain.handle('attendance:getByMeeting', async (event, meeting_id) => {
      const backendClient = getBackendClient();
      if (backendClient) {
        try {
          return await backendClient.get(`/attendance/by-meeting/${meeting_id}`);
        } catch (error) {
          return { success: false, error: `Backend error: ${error.message}` };
        }
      }
      return this.db.getAttendanceByMeeting(meeting_id);
    });

    ipcMain.handle('attendance:getByUser', async (event, user_id) => {
      const backendClient = getBackendClient();
      if (backendClient) {
        try {
          return await backendClient.get(`/attendance/by-user/${user_id}`);
        } catch (error) {
          return { success: false, error: `Backend error: ${error.message}` };
        }
      }
      return this.db.getAttendanceByUser(user_id);
    });

    ipcMain.handle('attendance:summary', async (event, filters) => {
      const sessionUser = getSessionUser();
      if (!isAdmin(sessionUser)) {
        return { success: false, error: 'Admin access required.' };
      }
      const backendClient = getBackendClient();
      if (backendClient) {
        try {
          return await backendClient.get(`/attendance/summary${buildQueryString(filters || {})}`);
        } catch (error) {
          return { success: false, error: `Backend error: ${error.message}` };
        }
      }
      return this.db.getAttendanceSummary(filters || {});
    });

    ipcMain.handle('attendance:records', async (event, filters) => {
      const sessionUser = getSessionUser();
      if (!isAdmin(sessionUser)) {
        return { success: false, error: 'Admin access required.' };
      }
      const backendClient = getBackendClient();
      if (backendClient) {
        try {
          const result = await backendClient.get(`/attendance/records${buildQueryString(filters || {})}`);
          if (result.success && result.records) {
            this.db.cacheAttendanceRecordsFromBackend(result.records);
          }
          return result;
        } catch (error) {
          return { success: false, error: `Backend error: ${error.message}` };
        }
      }
      return this.db.getAttendanceRecords(filters || {});
    });

    ipcMain.handle('attendance:absent', async (event, filters) => {
      const sessionUser = getSessionUser();
      if (!isAdmin(sessionUser)) {
        return { success: false, error: 'Admin access required.' };
      }
      const backendClient = getBackendClient();
      if (backendClient) {
        try {
          return await backendClient.get(`/attendance/absent${buildQueryString(filters || {})}`);
        } catch (error) {
          return { success: false, error: `Backend error: ${error.message}` };
        }
      }
      return this.db.getAbsentMembers(filters || {});
    });

    ipcMain.handle('attendance:memberStats', async (event, filters) => {
      const sessionUser = getSessionUser();
      if (!isAdmin(sessionUser)) {
        return { success: false, error: 'Admin access required.' };
      }
      const backendClient = getBackendClient();
      if (backendClient) {
        try {
          return await backendClient.get(`/attendance/member-stats${buildQueryString(filters || {})}`);
        } catch (error) {
          return { success: false, error: `Backend error: ${error.message}` };
        }
      }
      return this.db.getMemberAttendanceStats(filters || {});
    });

    ipcMain.handle('attendance:exportCsv', async (event, filters) => {
      try {
        const sessionUser = getSessionUser();
        if (!isAdmin(sessionUser)) {
          return { success: false, error: 'Admin access required.' };
        }
        const backendClient = getBackendClient();
        const recordsResult = backendClient
          ? await backendClient.get(`/attendance/records${buildQueryString(filters || {})}`)
          : this.db.getAttendanceRecords(filters || {});
        if (!recordsResult.success) {
          return { success: false, error: recordsResult.error };
        }

        const { filePath, canceled } = await dialog.showSaveDialog({
          title: 'Export Attendance CSV',
          defaultPath: 'attendance-report.csv',
          filters: [{ name: 'CSV', extensions: ['csv'] }]
        });

        if (canceled || !filePath) {
          return { success: false, error: 'Export canceled.' };
        }

        const parser = new Parser({
          fields: [
            { label: 'Meeting', value: 'meeting_title' },
            { label: 'Meeting Code', value: 'meeting_code' },
            { label: 'Scheduled Time', value: 'scheduled_time' },
            { label: 'Member Name', value: 'full_name' },
            { label: 'Email', value: 'email' },
            { label: 'Join Time', value: 'join_time' },
            { label: 'Leave Time', value: 'leave_time' },
            { label: 'Duration (minutes)', value: 'duration_minutes' }
          ]
        });

        const csv = parser.parse(recordsResult.records || []);
        fs.writeFileSync(filePath, csv, 'utf8');

        return { success: true, filePath };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('attendance:exportPdf', async (event, filters) => {
      try {
        const sessionUser = getSessionUser();
        if (!isAdmin(sessionUser)) {
          return { success: false, error: 'Admin access required.' };
        }
        const backendClient = getBackendClient();
        const recordsResult = backendClient
          ? await backendClient.get(`/attendance/records${buildQueryString(filters || {})}`)
          : this.db.getAttendanceRecords(filters || {});
        if (!recordsResult.success) {
          return { success: false, error: recordsResult.error };
        }

        const summaryResult = backendClient
          ? await backendClient.get(`/attendance/summary${buildQueryString(filters || {})}`)
          : this.db.getAttendanceSummary(filters || {});
        const summary = summaryResult.success ? summaryResult.summary || [] : [];
        const totalMeetings = summary.length;
        const totalAttendance = summary.reduce((acc, item) => acc + item.attendee_count, 0);
        const totalMembers = summary.length ? summary[0].total_members : 0;
        const averagePercent = totalMeetings && totalMembers
          ? Math.round((totalAttendance / (totalMeetings * totalMembers)) * 100)
          : 0;

        const { filePath, canceled } = await dialog.showSaveDialog({
          title: 'Export Attendance PDF',
          defaultPath: 'attendance-report.pdf',
          filters: [{ name: 'PDF', extensions: ['pdf'] }]
        });

        if (canceled || !filePath) {
          return { success: false, error: 'Export canceled.' };
        }

        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        doc.fontSize(18).text('Attendance Report', { align: 'left' });
        doc.moveDown(0.5);
        doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`);
        doc.moveDown(0.5);

        doc.fontSize(11).text(`Total Meetings: ${totalMeetings}`);
        doc.fontSize(11).text(`Total Attendance: ${totalAttendance}`);
        doc.fontSize(11).text(`Average Attendance: ${averagePercent}%`);
        doc.moveDown();

        const columnX = {
          meeting: 40,
          member: 200,
          date: 360,
          join: 440,
          minutes: 510
        };
        let currentY = doc.y;

        doc.fontSize(10).text('Meeting', columnX.meeting, currentY, { width: 150 });
        doc.text('Member', columnX.member, currentY, { width: 150 });
        doc.text('Date', columnX.date, currentY, { width: 70 });
        doc.text('Join', columnX.join, currentY, { width: 60 });
        doc.text('Min', columnX.minutes, currentY, { width: 40 });
        doc.moveDown(0.5);

        doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#e2e8f0').stroke();
        doc.moveDown(0.3);

        (recordsResult.records || []).forEach((record) => {
          const lineY = doc.y;
          const meetingLabel = `${record.meeting_title || 'Meeting'} (${record.meeting_code || '-'})`;
          const dateText = record.scheduled_time ? new Date(record.scheduled_time).toLocaleDateString() : '-';
          const joinText = record.join_time ? new Date(record.join_time).toLocaleTimeString() : '-';
          const minutes = record.duration_minutes ?? '-';

          doc.fontSize(9).text(meetingLabel, columnX.meeting, lineY, { width: 150 });
          doc.text(record.full_name || '-', columnX.member, lineY, { width: 150 });
          doc.text(dateText, columnX.date, lineY, { width: 70 });
          doc.text(joinText, columnX.join, lineY, { width: 60 });
          doc.text(String(minutes), columnX.minutes, lineY, { width: 40 });

          doc.moveDown(0.6);
          if (doc.y > 750) {
            doc.addPage();
          }
        });

        doc.end();

        await new Promise((resolve, reject) => {
          stream.on('finish', resolve);
          stream.on('error', reject);
        });

        return { success: true, filePath };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // App Settings Handlers
    ipcMain.handle('settings:get', async (event, key) => {
      try {
        const value = this.db.getAppSetting(key);
        return { success: true, value };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('settings:set', async (event, { key, value }) => {
      return this.db.setAppSetting(key, value);
    });

    ipcMain.handle('settings:getAll', async () => {
      return this.db.getAllAppSettings();
    });

    // Activity Log Handlers
    ipcMain.handle('activity:log', async (event, { user_id, action, details }) => {
      return this.db.logActivity(user_id, action, details);
    });

    ipcMain.handle('recording:save', async (event, { data, suggestedName }) => {
      try {
        const { filePath, canceled } = await dialog.showSaveDialog({
          title: 'Save Recording',
          defaultPath: suggestedName || 'meeting-recording.webm',
          filters: [{ name: 'WebM Video', extensions: ['webm'] }]
        });

        if (canceled || !filePath) {
          return { success: false, error: 'Save canceled.' };
        }

        const buffer = Buffer.from(data);
        fs.writeFileSync(filePath, buffer);
        return { success: true, filePath };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    console.log('IPC handlers registered successfully');
  }
}

module.exports = IPCHandlers;
