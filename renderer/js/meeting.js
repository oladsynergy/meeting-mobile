/**
 * Meeting Room WebRTC Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
  const meetingTitle = document.getElementById('meetingTitle');
  const meetingCode = document.getElementById('meetingCode');
  const leaveBtn = document.getElementById('leaveBtn');
  const muteBtn = document.getElementById('muteBtn');
  const cameraBtn = document.getElementById('cameraBtn');
  const shareBtn = document.getElementById('shareBtn');
  const recordBtn = document.getElementById('recordBtn');
  const pauseRecordBtn = document.getElementById('pauseRecordBtn');
  const stopRecordBtn = document.getElementById('stopRecordBtn');
  const raiseHandBtn = document.getElementById('raiseHandBtn');
  const videoOffAllBtn = document.getElementById('videoOffAllBtn');
  const localVideo = document.getElementById('localVideo');
  const remoteVideos = document.getElementById('remoteVideos');
  const connectionStatus = document.getElementById('connectionStatus');
  const participantsList = document.getElementById('participantsList');
  const hostPanel = document.getElementById('hostPanel');
  const lockToggle = document.getElementById('lockToggle');
  const muteAllBtn = document.getElementById('muteAllBtn');
  const chatToggle = document.getElementById('chatToggle');
  const clearChatBtn = document.getElementById('clearChatBtn');
  const screenToggle = document.getElementById('screenToggle');
  const clearHandsBtn = document.getElementById('clearHandsBtn');
  const meetingStatus = document.getElementById('meetingStatus');
  const localLabel = document.getElementById('localLabel');
  const chatList = document.getElementById('chatList');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const chatSendBtn = document.getElementById('chatSendBtn');
  const recordStatus = document.getElementById('recordStatus');
  const hostPollForm = document.getElementById('hostPollForm');
  const pollQuestion = document.getElementById('pollQuestion');
  const pollOptions = document.getElementById('pollOptions');
  const createPollBtn = document.getElementById('createPollBtn');
  const pollList = document.getElementById('pollList');
  const handQueueCard = document.getElementById('handQueueCard');
  const handQueueList = document.getElementById('handQueueList');
  const systemAudioToggle = document.getElementById('systemAudioToggle');
  const meetingTimer = document.getElementById('meetingTimer');
  const endMeetingBtn = document.getElementById('endMeetingBtn');

  const sessionResult = await window.api.session.get();
  if (!sessionResult.success || !sessionResult.user) {
    await window.api.navigate('index');
    return;
  }

  const meetingData = sessionStorage.getItem('activeMeeting');
  if (!meetingData) {
    await window.api.navigate('meetings');
    return;
  }

  const meeting = JSON.parse(meetingData);
  const currentUser = sessionResult.user;
  const isAdmin = currentUser.role === 'admin';
  const isHost = String(currentUser.id) === String(meeting.created_by) || isAdmin;
  let attendanceId = null;
  let attendanceRecorded = false;

  meetingTitle.textContent = meeting.title;
  meetingCode.textContent = `Meeting Code: ${meeting.meeting_code}`;
  localLabel.textContent = currentUser.full_name || 'You';

  // Initialize roomSettings BEFORE calling updateChatState/updateScreenShareState
  const peerConnections = new Map();
  const participantsBySocket = new Map();
  let roomSettings = { chatEnabled: true, screenShareEnabled: true };
  let hostPermissions = {
    canLock: true,
    canMute: true,
    canVideo: true,
    canChat: true,
    canScreen: true,
    canRemove: true,
    canEndMeeting: true
  };

  updateChatState();
  updateScreenShareState();
  updateButtonVisibility(roomSettings);

  if (isHost) {
    hostPanel.classList.remove('hidden');
    handQueueCard.classList.remove('hidden');
  }
  let localStream;
  let isMuted = false;
  let isCameraOff = false;
  let isVideoLocked = false;
  let isScreenSharing = false;
  let screenStream;
  let recorder;
  let recordingChunks = [];
  let isRecording = false;
  let isHandRaised = false;
  const polls = new Map();
  const pollVotes = new Map();
  let meetingStartTime = Date.now();
  let timerInterval = null;

  // Start meeting timer
  function updateTimer() {
    const elapsed = Math.floor((Date.now() - meetingStartTime) / 1000);
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    meetingTimer.textContent = 
      `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  timerInterval = setInterval(updateTimer, 1000);
  updateTimer();

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ 
      video: true, 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    localVideo.srcObject = localStream;
  } catch (error) {
    console.error('Media error:', error);
    connectionStatus.textContent = 'Camera/Mic blocked';
    connectionStatus.className = 'badge badge-danger';
    return;
  }

  await recordJoin();

  if (typeof io === 'undefined') {
    connectionStatus.textContent = 'Socket client missing';
    connectionStatus.className = 'badge badge-danger';
    return;
  }

  // Get signaling server URL from settings
  const serverUrlResult = await window.api.settings.get('signalingServerUrl');
  const serverUrl = serverUrlResult.success && serverUrlResult.value 
    ? serverUrlResult.value 
    : 'http://127.0.0.1:3001';

  const socket = io(serverUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000
  });

  socket.on('connect', () => {
    connectionStatus.textContent = 'Connected';
    connectionStatus.className = 'badge badge-success';
    socket.emit('join-room', {
      meetingCode: meeting.meeting_code,
      user: { id: currentUser.id, name: currentUser.full_name, role: currentUser.role },
      hostId: meeting.created_by
    });
    loadPolls();
  });

  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    connectionStatus.textContent = 'Connection Failed';
    connectionStatus.className = 'badge badge-danger';
  });

  socket.on('disconnect', () => {
    connectionStatus.textContent = 'Disconnected';
    connectionStatus.className = 'badge badge-warning';
  });

  socket.on('existing-users', (users) => {
    users.forEach(({ socketId }) => {
      createPeerConnection(socketId, true);
    });
  });

  socket.on('user-joined', ({ socketId, user }) => {
    createPeerConnection(socketId, true);
  });

  socket.on('signal', async ({ from, data }) => {
    const peerConnection = createPeerConnection(from, false);

    if (data.type === 'offer') {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit('signal', { to: from, from: socket.id, data: answer });
    } else if (data.type === 'answer') {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
    } else if (data.type === 'ice') {
      if (data.candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    }
  });

  socket.on('user-left', ({ socketId }) => {
    const peerConnection = peerConnections.get(socketId);
    if (peerConnection) {
      peerConnection.close();
      peerConnections.delete(socketId);
    }
    const remoteVideo = document.getElementById(`remote-${socketId}`);
    if (remoteVideo) {
      remoteVideo.parentElement.remove();
    }
  });

  socket.on('room-update', ({ participants, locked, settings }) => {
    updateParticipants(participants);
    roomSettings = settings || roomSettings;
    hostPermissions = settings?.hostPermissions || hostPermissions;
    updateStatus(locked, settings);
    updateHostControls(locked, settings);
    updateChatState();
    updateScreenShareState();
    updateButtonVisibility(settings);
  });

  socket.on('room-locked', () => {
    connectionStatus.textContent = 'Meeting Locked';
    connectionStatus.className = 'badge badge-warning';
  });

  socket.on('meeting-ended', async ({ message }) => {
    if (timerInterval) {
      clearInterval(timerInterval);
    }
    alert(message || 'This meeting has been ended');
    await leaveMeeting();
  });

  socket.on('host-command', ({ action }) => {
    if (action === 'mute') {
      setMuted(true);
    }

    if (action === 'unmute') {
      setMuted(false);
    }

    if (action === 'video-off') {
      setCameraEnabled(false, true);
    }

    if (action === 'video-on') {
      setCameraEnabled(true, false);
    }

    if (action === 'remove') {
      leaveMeeting();
    }
  });

  socket.on('chat-message', ({ user, message, timestamp, messageId, senderId }) => {
    appendChatMessage(user, message, timestamp, messageId, senderId);
  });

  socket.on('chat-deleted', ({ messageId }) => {
    removeChatMessage(messageId);
  });

  socket.on('chat-cleared', () => {
    clearChatMessages();
    appendChatMessage({ name: 'System' }, 'Chat cleared by host.', Date.now(), null, null);
  });

  socket.on('hands-reset', () => {
    isHandRaised = false;
    raiseHandBtn.textContent = 'Raise Hand';
  });

  socket.on('poll-list', (payload) => {
    if (payload && payload.polls) {
      payload.polls.forEach((poll) => {
        polls.set(poll.id, poll);
        if (poll.userVote) {
          pollVotes.set(poll.id, poll.userVote);
        }
      });
      renderPolls();
    }
  });

  socket.on('poll-created', (poll) => {
    polls.set(poll.id, poll);
    renderPolls();
  });

  socket.on('poll-updated', ({ id, optionId, userId }) => {
    if (String(userId) === String(currentUser.id)) {
      pollVotes.set(id, optionId);
    }
    loadPolls();
  });

  socket.on('poll-closed', (pollId) => {
    loadPolls();
  });

  muteBtn.addEventListener('click', () => {
    setMuted(!isMuted);
  });

  cameraBtn.addEventListener('click', () => {
    if (isVideoLocked) {
      appendChatMessage({ name: 'System' }, 'Video is locked by host.', Date.now(), null, null);
      return;
    }
    setCameraEnabled(isCameraOff, false);
  });

  recordBtn.addEventListener('click', async () => {
    await startRecording();
  });

  pauseRecordBtn.addEventListener('click', () => {
    if (recorder && recorder.state === 'recording') {
      recorder.pause();
      pauseRecordBtn.textContent = 'Resume';
      recordStatus.textContent = 'Recording Paused';
    } else if (recorder && recorder.state === 'paused') {
      recorder.resume();
      pauseRecordBtn.textContent = 'Pause';
      recordStatus.textContent = 'Recording...';
    }
  });

  stopRecordBtn.addEventListener('click', async () => {
    await stopRecording();
  });

  raiseHandBtn.addEventListener('click', () => {
    isHandRaised = !isHandRaised;
    raiseHandBtn.textContent = isHandRaised ? 'Lower Hand' : 'Raise Hand';
    socket.emit('hand-toggle', {
      meetingCode: meeting.meeting_code,
      raised: isHandRaised
    });
  });

  shareBtn.addEventListener('click', async () => {
    if (!roomSettings.screenShareEnabled) {
      return;
    }
    if (!isScreenSharing) {
      await startScreenShare();
    } else {
      await stopScreenShare();
    }
  });

  leaveBtn.addEventListener('click', async () => {
    await leaveMeeting();
  });

  window.addEventListener('beforeunload', async () => {
    await recordLeave();
  });

  if (isHost) {
    lockToggle.addEventListener('click', async () => {
      const nextAction = lockToggle.dataset.locked === 'true' ? 'unlock' : 'lock';
      socket.emit('host-action', { meetingCode: meeting.meeting_code, action: nextAction });
      await window.api.meeting.lock({ meetingId: meeting.id, isLocked: nextAction === 'lock' });
    });

    muteAllBtn.addEventListener('click', () => {
      socket.emit('host-action', { meetingCode: meeting.meeting_code, action: 'mute-all' });
      appendChatMessage({ name: 'System' }, '🔇 Host muted all participants', Date.now(), null, null);
    });

    if (videoOffAllBtn) {
      videoOffAllBtn.addEventListener('click', () => {
        socket.emit('host-action', { meetingCode: meeting.meeting_code, action: 'video-off-all' });
        appendChatMessage({ name: 'System' }, 'Host turned off all participant videos', Date.now(), null, null);
      });
    }

    chatToggle.addEventListener('click', () => {
      socket.emit('host-action', { meetingCode: meeting.meeting_code, action: 'toggle-chat' });
    });

    screenToggle.addEventListener('click', () => {
      socket.emit('host-action', { meetingCode: meeting.meeting_code, action: 'toggle-screen' });
    });

    clearChatBtn.addEventListener('click', () => {
      socket.emit('chat-clear', { meetingCode: meeting.meeting_code });
      window.api.activity.log({
        user_id: currentUser.id,
        action: 'chat_clear',
        details: JSON.stringify({ meetingId: meeting.id, meetingCode: meeting.meeting_code })
      });
    });

     clearHandsBtn.addEventListener('click', () => {
       socket.emit('hands-reset', { meetingCode: meeting.meeting_code });
     });

    endMeetingBtn.addEventListener('click', async () => {
      const confirmed = confirm('Are you sure you want to end this meeting for everyone? This action cannot be undone.');
      if (confirmed) {
        socket.emit('host-action', { meetingCode: meeting.meeting_code, action: 'end-meeting' });
      }
    });
  }

  createPollBtn.addEventListener('click', async () => {
    if (!isHost) {
      return;
    }
    const question = pollQuestion.value.trim();
    const options = pollOptions.value
      .split('\n')
      .map((option) => option.trim())
      .filter((option) => option.length > 0);

    if (!question || options.length < 2) {
      return;
    }

    const result = await window.api.poll.create({
      meetingId: meeting.id,
      question,
      options
    });

    if (result.success) {
      const poll = {
        id: result.pollId,
        question,
        status: 'open',
        options: result.options.map((option) => ({
          id: option.id,
          option_text: option.option_text,
          votes: 0
        }))
      };

      polls.set(poll.id, poll);
      socket.emit('poll-create', {
        meetingCode: meeting.meeting_code,
        poll
      });
      pollQuestion.value = '';
      pollOptions.value = '';
      renderPolls();
    }
  });

  chatForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!roomSettings.chatEnabled) {
      return;
    }
     const message = chatInput.value.trim();
    if (!message) {
      return;
    }
     const messageId = `${socket.id}-${Date.now()}`;
    socket.emit('chat-message', {
      meetingCode: meeting.meeting_code,
      message,
       messageId,
       senderId: currentUser.id,
       user: { id: currentUser.id, name: currentUser.full_name, role: currentUser.role }
    });
    chatInput.value = '';
  });

  function createPeerConnection(peerId, isInitiator) {
    if (peerConnections.has(peerId)) {
      return peerConnections.get(peerId);
    }

    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('signal', {
          to: peerId,
          from: socket.id,
          data: { type: 'ice', candidate: event.candidate }
        });
      }
    };

    peerConnection.ontrack = (event) => {
      const remoteId = `remote-${peerId}`;
      let remoteVideo = document.getElementById(remoteId);

      if (!remoteVideo) {
        const wrapper = document.createElement('div');
        wrapper.className = 'video-card';

        remoteVideo = document.createElement('video');
        remoteVideo.id = remoteId;
        remoteVideo.autoplay = true;
        remoteVideo.playsInline = true;
        wrapper.appendChild(remoteVideo);

        const label = document.createElement('div');
        label.className = 'video-label';
        label.textContent = 'Participant';
        wrapper.appendChild(label);

        remoteVideos.appendChild(wrapper);
      }

      remoteVideo.srcObject = event.streams[0];
    };

    peerConnections.set(peerId, peerConnection);

    if (isInitiator) {
      peerConnection.createOffer()
        .then((offer) => peerConnection.setLocalDescription(offer))
        .then(() => {
          socket.emit('signal', {
            to: peerId,
            from: socket.id,
            data: peerConnection.localDescription
          });
        })
        .catch((error) => console.error('Offer error:', error));
    }

    return peerConnection;
  }

  function setMuted(value) {
    isMuted = value;
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !isMuted;
    });
    updateMuteButton();
    updateLocalVideoOverlay();
  }

  function updateMuteButton() {
    const icon = muteBtn.querySelector('.control-icon');
    if (icon) {
      icon.textContent = isMuted ? '🔇' : '🎤';
    }
  }

  function setCameraEnabled(enabled, locked) {
    isCameraOff = !enabled;
    isVideoLocked = Boolean(locked);
    localStream.getVideoTracks().forEach((track) => {
      track.enabled = enabled;
    });
    updateCameraButton();
    updateLocalVideoOverlay();
  }

  function updateCameraButton() {
    const icon = cameraBtn.querySelector('.control-icon');
    if (icon) {
      icon.textContent = isCameraOff ? '📷' : '📹';
    }
    cameraBtn.disabled = isVideoLocked;
    cameraBtn.title = isVideoLocked ? 'Video locked by host' : 'Camera On/Off';
  }

  function updateLocalVideoOverlay() {
    const overlay = document.getElementById('localVideoOverlay');
    if (!overlay) return;
    
    overlay.innerHTML = '';
    
    if (isMuted) {
      const muteIcon = document.createElement('div');
      muteIcon.className = 'video-status-icon muted';
      muteIcon.innerHTML = '🔇';
      overlay.appendChild(muteIcon);
    }
    
    if (isCameraOff) {
      const videoIcon = document.createElement('div');
      videoIcon.className = 'video-status-icon camera-off';
      videoIcon.innerHTML = '📷';
      overlay.appendChild(videoIcon);
    }
  }

  async function leaveMeeting() {
    if (timerInterval) {
      clearInterval(timerInterval);
    }
    if (isRecording) {
      await stopRecording();
    }
    socket.emit('leave-room', { meetingCode: meeting.meeting_code });
    clearChatMessages();
    socket.disconnect();
    await recordLeave();
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
    }
    localStream.getTracks().forEach((track) => track.stop());
    sessionStorage.removeItem('activeMeeting');
    await window.api.navigate('meetings');
  }

  function updateParticipants(participants) {
    participantsBySocket.clear();
    participantsList.innerHTML = '';

    if (!participants.length) {
      participantsList.innerHTML = '<div class="text-muted">No participants.</div>';
      return;
    }

    participants.forEach(({ socketId, user }) => {
      participantsBySocket.set(socketId, user);
      const row = document.createElement('div');
      row.className = 'participant-item';

      const meta = document.createElement('div');
      meta.className = 'participant-meta';
      const roleText = `${user?.role || 'member'}${user?.isHost ? ' • Host' : ''}`;
      const handText = user?.isHandRaised ? '<div class="hand-badge">Raised Hand</div>' : '';
      const videoText = user?.videoLocked ? '<div class="status-badge">Video Locked</div>' : '';
      meta.innerHTML = `
        <h4>${user?.name || 'Guest'}</h4>
        <p class="text-muted">${roleText}</p>
        ${handText}
        ${videoText}
      `;

      const actions = document.createElement('div');
      actions.className = 'participant-actions';

      if (isHost && socketId !== socket.id) {
        const canMute = isAdmin || hostPermissions.canMute;
        const canVideo = isAdmin || hostPermissions.canVideo;
        const canRemove = isAdmin || hostPermissions.canRemove;

        if (canMute) {
          const muteBtn = document.createElement('button');
          muteBtn.className = 'btn btn-sm btn-outline';
          muteBtn.textContent = 'Mute';
          muteBtn.addEventListener('click', () => {
            socket.emit('host-action', {
              meetingCode: meeting.meeting_code,
              action: 'mute',
              targetSocketId: socketId
            });
          });

          const unmuteBtn = document.createElement('button');
          unmuteBtn.className = 'btn btn-sm btn-outline';
          unmuteBtn.textContent = 'Unmute';
          unmuteBtn.addEventListener('click', () => {
            socket.emit('host-action', {
              meetingCode: meeting.meeting_code,
              action: 'unmute',
              targetSocketId: socketId
            });
          });

          actions.appendChild(muteBtn);
          actions.appendChild(unmuteBtn);
        }

        if (canVideo) {
          const videoOffBtn = document.createElement('button');
          videoOffBtn.className = 'btn btn-sm btn-outline';
          videoOffBtn.textContent = 'Video Off';
          videoOffBtn.addEventListener('click', () => {
            socket.emit('host-action', {
              meetingCode: meeting.meeting_code,
              action: 'video-off',
              targetSocketId: socketId
            });
          });

          const videoOnBtn = document.createElement('button');
          videoOnBtn.className = 'btn btn-sm btn-outline';
          videoOnBtn.textContent = 'Allow Video';
          videoOnBtn.addEventListener('click', () => {
            socket.emit('host-action', {
              meetingCode: meeting.meeting_code,
              action: 'video-on',
              targetSocketId: socketId
            });
          });

          actions.appendChild(videoOffBtn);
          actions.appendChild(videoOnBtn);
        }

        if (canRemove) {
          const removeBtn = document.createElement('button');
          removeBtn.className = 'btn btn-sm btn-danger';
          removeBtn.textContent = 'Remove';
          removeBtn.addEventListener('click', () => {
            socket.emit('host-action', {
              meetingCode: meeting.meeting_code,
              action: 'remove',
              targetSocketId: socketId
            });
          });
          actions.appendChild(removeBtn);
        }
      }

      row.appendChild(meta);
      row.appendChild(actions);
      participantsList.appendChild(row);
      updateRemoteLabel(socketId, user);
    });

    if (isHost) {
      updateHandQueue(participants);
    }

     const self = participants.find((entry) => entry.socketId === socket.id);
     if (self && typeof self.user?.isHandRaised === 'boolean') {
       isHandRaised = self.user.isHandRaised;
       raiseHandBtn.textContent = isHandRaised ? 'Lower Hand' : 'Raise Hand';
     }
     if (self && typeof self.user?.videoLocked === 'boolean') {
       isVideoLocked = self.user.videoLocked;
       updateCameraButton();
     }
  }

  function updateStatus(locked, settings) {
    meetingStatus.innerHTML = `
      <div>Meeting: ${locked ? 'Locked' : 'Open'}</div>
      <div>Chat: ${settings?.chatEnabled ? 'Enabled' : 'Disabled'}</div>
      <div>Screen Share: ${settings?.screenShareEnabled ? 'Enabled' : 'Disabled'}</div>
    `;
  }

  function updateHostControls(locked, settings) {
    if (!isHost) {
      return;
    }
    hostPollForm.classList.remove('hidden');
    lockToggle.textContent = locked ? 'Unlock Meeting' : 'Lock Meeting';
    lockToggle.dataset.locked = locked ? 'true' : 'false';
    chatToggle.textContent = settings?.chatEnabled ? 'Disable Chat' : 'Enable Chat';
    screenToggle.textContent = settings?.screenShareEnabled ? 'Disable Screen Share' : 'Enable Screen Share';

    const canLock = isAdmin || hostPermissions.canLock;
    const canMute = isAdmin || hostPermissions.canMute;
    const canVideo = isAdmin || hostPermissions.canVideo;
    const canChat = isAdmin || hostPermissions.canChat;
    const canScreen = isAdmin || hostPermissions.canScreen;
    const canRemove = isAdmin || hostPermissions.canRemove;
    const canEndMeeting = isAdmin || hostPermissions.canEndMeeting;

    lockToggle.disabled = !canLock;
    muteAllBtn.disabled = !canMute;
    if (videoOffAllBtn) {
      videoOffAllBtn.disabled = !canVideo;
    }
    chatToggle.disabled = !canChat;
    clearChatBtn.disabled = !canChat;
    screenToggle.disabled = !canScreen;
    clearHandsBtn.disabled = !canRemove;
    endMeetingBtn.disabled = !canEndMeeting;
  }

  function updateChatState() {
    chatInput.disabled = !roomSettings.chatEnabled;
    chatSendBtn.disabled = !roomSettings.chatEnabled;
    chatInput.placeholder = roomSettings.chatEnabled ? 'Type a message' : 'Chat disabled by host';
  }

  function updateScreenShareState() {
    shareBtn.disabled = !roomSettings.screenShareEnabled;
    if (!roomSettings.screenShareEnabled && isScreenSharing) {
      stopScreenShare();
    }
  }

  function updateButtonVisibility(settings) {
    if (!settings || isAdmin || isHost) {
      // Admins and hosts always see all buttons
      return;
    }

    // Hide buttons based on settings for regular participants
    if (raiseHandBtn) {
      raiseHandBtn.style.display = settings.allowRaiseHand !== false ? '' : 'none';
    }
    if (shareBtn) {
      shareBtn.style.display = settings.allowScreenShare !== false ? '' : 'none';
    }
    const recordingButtons = [recordBtn, pauseRecordBtn, stopRecordBtn];
    recordingButtons.forEach(btn => {
      if (btn) {
        btn.style.display = settings.allowRecording !== false ? '' : 'none';
      }
    });
    if (document.getElementById('systemAudioLabel')) {
      document.getElementById('systemAudioLabel').style.display = settings.allowSystemAudio !== false ? '' : 'none';
    }
  }

  async function startScreenShare() {
    try {
      // Request screen sharing with proper constraints
      const includeSystemAudio = systemAudioToggle?.checked || false;
      
      const constraints = {
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: 'screen:0:0'
          }
        }
      };

      // Try the standard API first - browser will show picker for screen/window/tab
      try {
        const displayMediaOptions = {
          video: { 
            cursor: 'always'
          }
        };
        
        // Add audio options if system audio is enabled
        if (includeSystemAudio) {
          displayMediaOptions.audio = {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          };
        } else {
          displayMediaOptions.audio = false;
        }
        
        screenStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
      } catch (err) {
        // Fallback to getUserMedia with desktop constraint
        screenStream = await navigator.mediaDevices.getUserMedia(constraints);
      }

      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) {
        throw new Error('No video track available');
      }

      replaceVideoTrack(screenTrack);
      isScreenSharing = true;
      shareBtn.textContent = 'Stop Share';
      shareBtn.classList.add('btn-warning');

      screenTrack.onended = () => {
        stopScreenShare();
      };
    } catch (error) {
      console.error('Screen share error:', error);
      if (error.name === 'NotAllowedError') {
        alert('Screen sharing permission was denied. Please allow screen sharing when prompted.');
      } else if (error.name === 'NotSupportedError') {
        alert('Screen sharing is not supported on this device.');
      } else {
        alert('Screen sharing failed: ' + error.message);
      }
    }
  }

  async function stopScreenShare() {
    if (!screenStream) {
      return;
    }
    screenStream.getTracks().forEach((track) => track.stop());
    const cameraTrack = localStream.getVideoTracks()[0];
    replaceVideoTrack(cameraTrack);
    isScreenSharing = false;
    shareBtn.textContent = 'Share Screen';
    shareBtn.classList.remove('btn-warning');
  }

  function replaceVideoTrack(newTrack) {
    localVideo.srcObject = new MediaStream([
      newTrack,
      ...localStream.getAudioTracks()
    ]);
    peerConnections.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
      if (sender) {
        sender.replaceTrack(newTrack);
      }
    });
  }

  function appendChatMessage(user, message, timestamp, messageId, senderId) {
    const item = document.createElement('div');
    item.className = 'chat-message';
     if (messageId) {
       item.dataset.messageId = messageId;
     }
    if (senderId) {
      item.dataset.senderId = senderId;
    }
    if (user?.name) {
      item.dataset.senderName = user.name;
    }
    const time = timestamp ? new Date(timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
    const roleBadge = user?.role === 'admin'
      ? '<span class="reply-badge admin">Admin Reply</span>'
      : user?.role === 'host'
        ? '<span class="reply-badge host">Host Reply</span>'
        : '';
    item.innerHTML = `
      <strong>${user?.name || 'Guest'} • ${time}</strong>
      ${roleBadge}
      <div>${message}</div>
    `;
    const canChatModerate = isAdmin || hostPermissions.canChat;
    if (isHost && canChatModerate && senderId) {
       const actions = document.createElement('div');
       actions.className = 'chat-message-actions';
       const deleteBtn = document.createElement('button');
       deleteBtn.className = 'btn btn-sm btn-danger';
       deleteBtn.textContent = 'Delete';
       deleteBtn.addEventListener('click', () => {
         socket.emit('chat-delete', {
           meetingCode: meeting.meeting_code,
           messageId
         });
        window.api.activity.log({
          user_id: currentUser.id,
          action: 'chat_delete',
          details: JSON.stringify({
            meetingId: meeting.id,
            meetingCode: meeting.meeting_code,
            messageId,
            senderId,
            senderName: user?.name || null
          })
        });
       });
       actions.appendChild(deleteBtn);
       item.appendChild(actions);
     }
    chatList.appendChild(item);
    chatList.scrollTop = chatList.scrollHeight;
  }

  function clearChatMessages() {
    while (chatList.firstChild) {
      chatList.removeChild(chatList.firstChild);
    }
  }

   function removeChatMessage(messageId) {
     if (!messageId) {
       return;
     }
     const item = chatList.querySelector(`[data-message-id="${messageId}"]`);
     if (item) {
       item.remove();
     }
   }

  function updateHandQueue(participants) {
    const raised = participants
      .filter((entry) => entry.user?.isHandRaised)
      .map((entry) => ({
        name: entry.user?.name || 'Guest',
        time: entry.user?.handRaisedAt || Date.now()
      }))
      .sort((a, b) => a.time - b.time);

    handQueueList.innerHTML = '';

    if (!raised.length) {
      const empty = document.createElement('div');
      empty.className = 'text-muted';
      empty.textContent = 'No raised hands yet.';
      handQueueList.appendChild(empty);
      return;
    }

    raised.forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'hand-queue-item';
      const timeText = new Date(entry.time).toLocaleTimeString();
      row.innerHTML = `<strong>${entry.name}</strong><span>${timeText}</span>`;
      handQueueList.appendChild(row);
    });
  }

  function renderPolls() {
    pollList.innerHTML = '';
    if (!polls.size) {
      pollList.innerHTML = '<div class="text-muted">No active polls.</div>';
      return;
    }

    Array.from(polls.values()).forEach((poll) => {
      const card = document.createElement('div');
      card.className = 'poll-card';

      const title = document.createElement('h4');
      title.textContent = poll.question;
      card.appendChild(title);

      const votedOption = pollVotes.get(poll.id);

      poll.options.forEach((option) => {
        const row = document.createElement('div');
        row.className = 'poll-option';

        const label = document.createElement('span');
        label.textContent = `${option.option_text} (${option.votes || 0})`;
        row.appendChild(label);

        if (poll.status === 'open') {
          const voteBtn = document.createElement('button');
          voteBtn.className = 'btn btn-sm btn-outline';
          voteBtn.textContent = votedOption === option.id ? 'Voted' : 'Vote';
          voteBtn.disabled = votedOption === option.id;
          voteBtn.addEventListener('click', () => {
            handleVote(poll, option);
          });
          row.appendChild(voteBtn);
        }

        card.appendChild(row);
      });

      if (isHost && poll.status === 'open') {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn btn-sm btn-danger';
        closeBtn.textContent = 'Close Poll';
        closeBtn.addEventListener('click', async () => {
          await window.api.poll.close(poll.id);
          socket.emit('poll-close', { meetingCode: meeting.meeting_code, pollId: poll.id });
        });
        card.appendChild(closeBtn);
      }

      pollList.appendChild(card);
    });
  }

  async function handleVote(poll, option) {
    pollVotes.set(poll.id, option.id);
    socket.emit('poll-vote', {
      meetingCode: meeting.meeting_code,
      pollId: poll.id,
      optionId: option.id,
      userId: currentUser.id
    });

    await window.api.poll.vote({ pollId: poll.id, optionId: option.id, userId: currentUser.id });
  }

  async function loadPolls() {
    const result = await window.api.poll.list(meeting.id);
    if (!result.success) {
      return;
    }
    const pollData = result.polls || [];
    polls.clear();
    pollData.forEach((poll) => {
      polls.set(poll.id, poll);
    });
    renderPolls();
  }

  function updateRemoteLabel(socketId, user) {
    const remoteVideo = document.getElementById(`remote-${socketId}`);
    if (!remoteVideo) {
      return;
    }
    const wrapper = remoteVideo.parentElement;
    const label = wrapper.querySelector('.video-label');
    if (label) {
      label.textContent = user?.name || 'Participant';
    }
  }

  async function recordJoin() {
    if (attendanceRecorded) {
      return;
    }

    try {
      const result = await window.api.attendance.recordJoin({
        meeting_id: meeting.id,
        user_id: currentUser.id
      });

      if (result.success) {
        attendanceId = result.attendanceId;
        attendanceRecorded = true;
      }
    } catch (error) {
      console.error('Attendance join error:', error);
    }
  }

  async function recordLeave() {
    if (!attendanceRecorded || !attendanceId) {
      return;
    }

    try {
      await window.api.attendance.recordLeave(attendanceId);
    } catch (error) {
      console.error('Attendance leave error:', error);
    } finally {
      attendanceRecorded = false;
      attendanceId = null;
    }
  }

  async function startRecording() {
    const stream = localVideo.srcObject;
    if (!stream) {
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm;codecs=vp8,opus';

    recordingChunks = [];
    recorder = new MediaRecorder(stream, { mimeType });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordingChunks.push(event.data);
      }
    };

    recorder.onstop = async () => {
      const blob = new Blob(recordingChunks, { type: mimeType });
      const buffer = new Uint8Array(await blob.arrayBuffer());
      const suggestedName = `meeting-${meeting.meeting_code}-${Date.now()}.webm`;
      const result = await window.api.recording.save({
        data: Array.from(buffer),
        suggestedName
      });

      if (result.success) {
        appendChatMessage({ name: 'System' }, `Recording saved to ${result.filePath}`, Date.now(), null, null);
      }
      
      recordBtn.style.display = 'inline-block';
      recordBtn.classList.remove('btn-recording');
      pauseRecordBtn.style.display = 'none';
      pauseRecordBtn.classList.remove('btn-warning');
      stopRecordBtn.style.display = 'none';
      stopRecordBtn.classList.remove('btn-danger');
      recordStatus.classList.add('hidden');
    };

    recorder.start(1000);
    isRecording = true;
    recordBtn.style.display = 'none';
    pauseRecordBtn.style.display = 'inline-block';
    stopRecordBtn.style.display = 'inline-block';
    pauseRecordBtn.textContent = 'Pause';
    pauseRecordBtn.classList.add('btn-warning');
    stopRecordBtn.classList.add('btn-danger');
    recordStatus.textContent = 'Recording...';
    recordStatus.classList.remove('hidden');
  }

  async function stopRecording() {
    if (!recorder) {
      return;
    }
    recorder.stop();
    isRecording = false;
  }
});
