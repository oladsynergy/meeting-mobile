/**
 * Local signaling server for WebRTC
 */

const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.SIGNAL_PORT || 3001;

const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const rooms = new Map();

function getRoom(meetingCode) {
  if (!rooms.has(meetingCode)) {
    rooms.set(meetingCode, {
      participants: new Map(),
      locked: false,
      settings: {
        chatEnabled: true,
        screenShareEnabled: true
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
      handRaisedAt: null
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
    if (!requester || !requester.isHost) {
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
      room.settings.chatEnabled = !room.settings.chatEnabled;
      broadcastRoomState(meetingCode);
      return;
    }

    if (action === 'toggle-screen') {
      room.settings.screenShareEnabled = !room.settings.screenShareEnabled;
      broadcastRoomState(meetingCode);
      return;
    }

    if (action === 'mute-all') {
      io.to(meetingCode).emit('host-command', { action: 'mute' });
      return;
    }

    if (!targetSocketId) {
      return;
    }

    if (action === 'mute') {
      io.to(targetSocketId).emit('host-command', { action: 'mute' });
    }

    if (action === 'remove') {
      io.to(targetSocketId).emit('host-command', { action: 'remove' });
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

    io.to(meetingCode).emit('chat-message', {
      user,
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
    if (!requester || !requester.isHost) {
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
    if (!requester || !requester.isHost) {
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
      if (room.has(socket.id)) {
        handleLeave(socket, meetingCode);
      }
    });
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

server.listen(PORT, () => {
  console.log(`Signaling server listening on ${PORT}`);
});
