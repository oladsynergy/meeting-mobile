/**
 * Main Process
 * Entry point for the Electron application
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const DatabaseManager = require('./database');
const IPCHandlers = require('./ipcHandlers');

let mainWindow;
let dbManager;
let ipcHandlers;
let signalingServer;

function startSignalingServer(dbManager) {
  try {
    const http = require('http');
    const { Server } = require('socket.io');
    
    const PORT = 3001;
    const server = http.createServer();
    const io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    const rooms = new Map();

    const defaultHostPermissions = {
      canLock: true,
      canMute: true,
      canVideo: true,
      canChat: true,
      canScreen: true,
      canRemove: true
    };

    function resolveHostPermissions(settings) {
      return {
        canLock: settings?.host_can_lock !== 0,
        canMute: settings?.host_can_mute !== 0,
        canVideo: settings?.host_can_video !== 0,
        canChat: settings?.host_can_chat !== 0,
        canScreen: settings?.host_can_screen !== 0,
        canRemove: settings?.host_can_remove !== 0
      };
    }

    function getRoom(meetingCode) {
      if (!rooms.has(meetingCode)) {
        const settingsResult = dbManager?.getMeetingSettingsByCode(meetingCode);
        const meetingSettings = settingsResult?.success ? settingsResult.settings : null;
        const hostPermissions = meetingSettings ? resolveHostPermissions(meetingSettings) : { ...defaultHostPermissions };

        rooms.set(meetingCode, {
          participants: new Map(),
          locked: false,
          settings: {
            chatEnabled: meetingSettings ? meetingSettings.chat_enabled !== 0 : true,
            screenShareEnabled: meetingSettings ? meetingSettings.screen_share_enabled !== 0 : true,
            hostPermissions,
            allowRaiseHand: meetingSettings ? meetingSettings.allow_raise_hand !== 0 : true,
            allowScreenShare: meetingSettings ? meetingSettings.allow_screen_share !== 0 : true,
            allowRecording: meetingSettings ? meetingSettings.allow_recording !== 0 : true,
            allowSystemAudio: meetingSettings ? meetingSettings.allow_system_audio !== 0 : true
          }
        });
      }
      return rooms.get(meetingCode);
    }

    function broadcastRoomState(meetingCode) {
      const room = rooms.get(meetingCode);
      if (!room) {
        return;
      }

      const participants = Array.from(room.participants.entries()).map(([id, info]) => ({
        socketId: id,
        user: info
      }));

      io.to(meetingCode).emit('room-update', {
        participants,
        locked: room.locked,
        settings: room.settings
      });
    }

    io.on('connection', (socket) => {
      socket.on('join-room', ({ meetingCode, user, hostId }) => {
        if (!meetingCode) {
          return;
        }

        // Check if meeting is ended
        const meetingResult = dbManager.getMeetingByCode(meetingCode);
        if (meetingResult.success && meetingResult.meeting?.is_ended) {
          socket.emit('meeting-ended', { 
            message: 'This meeting has been ended and cannot be joined' 
          });
          return;
        }

        const room = getRoom(meetingCode);
        if (room.locked) {
          socket.emit('room-locked');
          return;
        }

        const isHost = Boolean(user && hostId && String(user.id) === String(hostId));
        const userInfo = {
          id: user?.id || socket.id,
          name: user?.name || 'Guest',
          role: user?.role || 'member',
          isHost,
          isHandRaised: false,
          handRaisedAt: null,
          videoLocked: false
        };

        room.participants.set(socket.id, userInfo);
        socket.join(meetingCode);

        const existing = Array.from(room.participants.entries())
          .filter(([id]) => id !== socket.id)
          .map(([id, info]) => ({ socketId: id, user: info }));

        socket.emit('existing-users', existing);
        socket.to(meetingCode).emit('user-joined', { socketId: socket.id, user: userInfo });
        broadcastRoomState(meetingCode);
      });

      socket.on('signal', ({ to, from, data }) => {
        if (!to || !data) {
          return;
        }
        io.to(to).emit('signal', { from, data });
      });

      socket.on('leave-room', ({ meetingCode }) => {
        handleLeave(socket, meetingCode);
      });

      socket.on('host-action', ({ meetingCode, action, targetSocketId }) => {
        if (!meetingCode || !action) {
          return;
        }

        const room = rooms.get(meetingCode);
        if (!room) {
          return;
        }

        const requester = room.participants.get(socket.id);
        const isAdmin = requester?.role === 'admin';
        const isHostOrAdmin = requester?.isHost || isAdmin;
        const permissions = room.settings?.hostPermissions || defaultHostPermissions;
        const hasPermission = (permKey) => isAdmin || permissions?.[permKey];

        if (!requester || !isHostOrAdmin) {
          return;
        }

        if ((action === 'lock' || action === 'unlock') && !hasPermission('canLock')) {
          return;
        }

        if (action === 'lock') {
          room.locked = true;
          broadcastRoomState(meetingCode);
          return;
        }

        if (action === 'unlock') {
          room.locked = false;
          broadcastRoomState(meetingCode);
          return;
        }

        if (action === 'toggle-chat') {
          if (!hasPermission('canChat')) {
            return;
          }
          room.settings.chatEnabled = !room.settings.chatEnabled;
          broadcastRoomState(meetingCode);
          return;
        }

        if (action === 'toggle-screen') {
          if (!hasPermission('canScreen')) {
            return;
          }
          room.settings.screenShareEnabled = !room.settings.screenShareEnabled;
          broadcastRoomState(meetingCode);
          return;
        }

        if (action === 'mute-all') {
          if (!hasPermission('canMute')) {
            return;
          }
          room.participants.forEach((participant, id) => {
            if (id !== socket.id) {
              io.to(id).emit('host-command', { action: 'mute' });
            }
          });
          return;
        }

        if (action === 'video-off-all') {
          if (!hasPermission('canVideo')) {
            return;
          }
          room.participants.forEach((participant, id) => {
            if (id !== socket.id) {
              room.participants.set(id, { ...participant, videoLocked: true });
              io.to(id).emit('host-command', { action: 'video-off', locked: true });
            }
          });
          broadcastRoomState(meetingCode);
          return;
        }

        if (action === 'end-meeting') {
          if (!hasPermission('canEndMeeting')) {
            return;
          }
          // Mark meeting as ended in database
          dbManager.endMeeting(meetingCode);
          // Notify all participants
          io.to(meetingCode).emit('meeting-ended', { 
            message: 'This meeting has been ended by the admin' 
          });
          // Remove room from active rooms
          rooms.delete(meetingCode);
          return;
        }

        if (!targetSocketId) {
          return;
        }

        if (action === 'mute') {
          if (!hasPermission('canMute')) {
            return;
          }
          io.to(targetSocketId).emit('host-command', { action: 'mute' });
        }

        if (action === 'unmute') {
          if (!hasPermission('canMute')) {
            return;
          }
          io.to(targetSocketId).emit('host-command', { action: 'unmute' });
        }

        if (action === 'remove') {
          if (!hasPermission('canRemove')) {
            return;
          }
          io.to(targetSocketId).emit('host-command', { action: 'remove' });
        }

        if (action === 'video-off') {
          if (!hasPermission('canVideo')) {
            return;
          }
          const participant = room.participants.get(targetSocketId);
          if (participant) {
            room.participants.set(targetSocketId, { ...participant, videoLocked: true });
          }
          io.to(targetSocketId).emit('host-command', { action: 'video-off', locked: true });
          broadcastRoomState(meetingCode);
        }

        if (action === 'video-on') {
          if (!hasPermission('canVideo')) {
            return;
          }
          const participant = room.participants.get(targetSocketId);
          if (participant) {
            room.participants.set(targetSocketId, { ...participant, videoLocked: false });
          }
          io.to(targetSocketId).emit('host-command', { action: 'video-on', locked: false });
          broadcastRoomState(meetingCode);
        }
      });

      socket.on('chat-message', ({ meetingCode, message, user, messageId, senderId }) => {
        if (!meetingCode || !message) {
          return;
        }

        const room = rooms.get(meetingCode);
        if (!room || !room.settings.chatEnabled) {
          return;
        }

        const participant = room.participants.get(socket.id);
        const userPayload = participant
          ? { id: participant.id, name: participant.name, role: participant.role, isHost: participant.isHost }
          : user;

        io.to(meetingCode).emit('chat-message', {
          user: userPayload,
          message,
          messageId: messageId || `${socket.id}-${Date.now()}`,
          senderId: senderId || user?.id || null,
          timestamp: Date.now()
        });
      });

      socket.on('chat-delete', ({ meetingCode, messageId }) => {
        const room = rooms.get(meetingCode);
        if (!room) {
          return;
        }
        const requester = room.participants.get(socket.id);
        const isAdmin = requester?.role === 'admin';
        const isHostOrAdmin = requester?.isHost || isAdmin;
        const permissions = room.settings?.hostPermissions || defaultHostPermissions;
        if (!requester || !isHostOrAdmin || (!isAdmin && !permissions.canChat)) {
          return;
        }
        io.to(meetingCode).emit('chat-deleted', { messageId });
      });

      socket.on('chat-clear', ({ meetingCode }) => {
        const room = rooms.get(meetingCode);
        if (!room) {
          return;
        }
        const requester = room.participants.get(socket.id);
        const isAdmin = requester?.role === 'admin';
        const isHostOrAdmin = requester?.isHost || isAdmin;
        const permissions = room.settings?.hostPermissions || defaultHostPermissions;
        if (!requester || !isHostOrAdmin || (!isAdmin && !permissions.canChat)) {
          return;
        }
        io.to(meetingCode).emit('chat-cleared');
      });

      socket.on('hand-toggle', ({ meetingCode, raised }) => {
        const room = rooms.get(meetingCode);
        if (!room) {
          return;
        }
        const participant = room.participants.get(socket.id);
        if (!participant) {
          return;
        }
        const nextRaised = Boolean(raised);
        participant.isHandRaised = nextRaised;
        participant.handRaisedAt = nextRaised ? Date.now() : null;
        room.participants.set(socket.id, participant);
        broadcastRoomState(meetingCode);
      });

      socket.on('hands-reset', ({ meetingCode }) => {
        const room = rooms.get(meetingCode);
        if (!room) {
          return;
        }
        const requester = room.participants.get(socket.id);
        if (!requester || !requester.isHost) {
          return;
        }
        room.participants.forEach((participant, id) => {
          room.participants.set(id, { ...participant, isHandRaised: false, handRaisedAt: null });
        });
        io.to(meetingCode).emit('hands-reset');
        broadcastRoomState(meetingCode);
      });

      socket.on('poll-create', ({ meetingCode, poll }) => {
        if (!meetingCode || !poll) {
          return;
        }
        io.to(meetingCode).emit('poll-created', poll);
      });

      socket.on('poll-vote', ({ meetingCode, pollId, optionId, userId }) => {
        if (!meetingCode || !pollId || !optionId) {
          return;
        }
        io.to(meetingCode).emit('poll-updated', { id: pollId, optionId, userId });
      });

      socket.on('poll-close', ({ meetingCode, pollId }) => {
        if (!meetingCode || !pollId) {
          return;
        }
        io.to(meetingCode).emit('poll-closed', pollId);
      });

      socket.on('disconnect', () => {
        rooms.forEach((room, meetingCode) => {
          if (room.participants.has(socket.id)) {
            handleLeave(socket, meetingCode);
          }
        });
      });

      function handleLeave(socket, meetingCode) {
        const room = rooms.get(meetingCode);
        if (!room) {
          return;
        }

        room.participants.delete(socket.id);
        socket.leave(meetingCode);
        socket.to(meetingCode).emit('user-left', { socketId: socket.id });
        broadcastRoomState(meetingCode);

        if (room.participants.size === 0) {
          rooms.delete(meetingCode);
        }
      }
    });

    return new Promise((resolve, reject) => {
      server.listen(PORT, (err) => {
        if (err) {
          console.error('Failed to start signaling server:', err);
          reject(err);
        } else {
          console.log(`Signaling server running on port ${PORT}`);
          signalingServer = server;
          resolve();
        }
      });
    });
  } catch (error) {
    console.error('Failed to start signaling server:', error);
    throw error;
  }
}

/**
 * Create the main application window
 */
function createWindow() {
  try {
    const preloadPath = path.join(__dirname, 'preload.js');
    console.log('Preload path:', preloadPath);
    
    mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1200,
      minHeight: 700,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        enableRemoteModule: false
      },
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false
    });

    // Enable all media permissions including screen capture
    mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
      const allowedPermissions = ['media', 'display-capture', 'mediaKeySystem', 'geolocation', 'notifications', 'midi', 'midiSysex'];
      callback(allowedPermissions.includes(permission));
    });

    // Grant permission check handler
    mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
      if (permission === 'media') {
        return true;
      }
      return true;
    });

    // Load the login page
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });

    // Open DevTools in development mode
    if (process.argv.includes('--dev')) {
      mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    console.log('Main window created successfully');
  } catch (error) {
    console.error('Failed to create window:', error);
    throw error;
  }
}

/**
 * Initialize the application
 */
async function initializeApp() {
  try {
    // Initialize database
    dbManager = new DatabaseManager();
    dbManager.initialize();

    // Setup IPC handlers
    ipcHandlers = new IPCHandlers(dbManager);

    // Create main window first
    createWindow();

    // Start local signaling server after window is created
    try {
      await startSignalingServer(dbManager);
    } catch (error) {
      console.error('Signaling server error (non-blocking):', error);
      // Don't block app startup if signaling server fails
    }

    console.log('Application initialized successfully');
  } catch (error) {
    console.error('Failed to initialize application:', error);
    app.quit();
  }
}

/**
 * App Event Handlers
 */

app.whenReady().then(initializeApp);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (dbManager) {
      dbManager.close();
    }
    if (signalingServer) {
      signalingServer.close();
    }
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (dbManager) {
    dbManager.close();
  }
  if (signalingServer) {
    signalingServer.close();
  }
});

/**
 * Handle navigation between pages
 */
ipcMain.handle('navigate', async (event, page) => {
  const pagePath = path.join(__dirname, `../renderer/${page}.html`);
  mainWindow.loadFile(pagePath);
  return { success: true };
});

/**
 * Get current user session
 */
let currentUser = null;
global.sessionUser = null;

ipcMain.handle('session:set', async (event, user) => {
  currentUser = user;
  global.sessionUser = user;
  return { success: true };
});

ipcMain.handle('session:get', async () => {
  return { success: true, user: currentUser };
});

ipcMain.handle('session:clear', async () => {
  currentUser = null;
  global.sessionUser = null;
  return { success: true };
});
