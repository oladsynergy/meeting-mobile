/**
 * Meetings JavaScript
 * Handles meeting creation, joining, and listing
 */

document.addEventListener('DOMContentLoaded', async () => {
  const logoutBtn = document.getElementById('logoutBtn');
  const currentRoleBadge = document.getElementById('currentRole');
  const notice = document.getElementById('notice');
  const createForm = document.getElementById('createMeetingForm');
  const joinForm = document.getElementById('joinMeetingForm');
  const meetingList = document.getElementById('meetingList');
  const createBtn = document.getElementById('createBtn');
  const joinBtn = document.getElementById('joinBtn');
  const navItems = document.querySelectorAll('.nav-item');
  const hostPermissionsSection = document.getElementById('hostPermissionsSection');
  const permLock = document.getElementById('permLock');
  const permMute = document.getElementById('permMute');
  const permVideo = document.getElementById('permVideo');
  const permChat = document.getElementById('permChat');
  const permScreen = document.getElementById('permScreen');
  const permRemove = document.getElementById('permRemove');
  const permEndMeeting = document.getElementById('permEndMeeting');
  const allowRaiseHand = document.getElementById('allowRaiseHand');
  const allowScreenShare = document.getElementById('allowScreenShare');
  const allowRecording = document.getElementById('allowRecording');
  const allowSystemAudio = document.getElementById('allowSystemAudio');
  const permissionsModal = document.getElementById('permissionsModal');
  const closePermissionsBtn = document.getElementById('closePermissionsBtn');
  const savePermissionsBtn = document.getElementById('savePermissionsBtn');
  const editPermLock = document.getElementById('editPermLock');
  const editPermMute = document.getElementById('editPermMute');
  const editPermVideo = document.getElementById('editPermVideo');
  const editPermChat = document.getElementById('editPermChat');
  const editPermScreen = document.getElementById('editPermScreen');
  const editPermRemove = document.getElementById('editPermRemove');
  const editPermEndMeeting = document.getElementById('editPermEndMeeting');
  const editAllowRaiseHand = document.getElementById('editAllowRaiseHand');
  const editAllowScreenShare = document.getElementById('editAllowScreenShare');
  const editAllowRecording = document.getElementById('editAllowRecording');
  const editAllowSystemAudio = document.getElementById('editAllowSystemAudio');
  let activeMeetingId = null;

  const sessionResult = await window.api.session.get();
  if (!sessionResult.success || !sessionResult.user) {
    await window.api.navigate('index');
    return;
  }

  const currentUser = sessionResult.user;
  currentRoleBadge.textContent = currentUser.role.toUpperCase();
  const isAdmin = currentUser.role === 'admin';

  // Hide Members and Attendance nav for non-admins
  if (!isAdmin) {
    const membersNav = document.querySelector('.nav-item[data-page="members"]');
    const attendanceNav = document.querySelector('.nav-item[data-page="attendance"]');
    if (membersNav) {
      membersNav.style.display = 'none';
    }
    if (attendanceNav) {
      attendanceNav.style.display = 'none';
    }
  }

  if (isAdmin && hostPermissionsSection) {
    hostPermissionsSection.classList.remove('hidden');
  }

  const canCreateMeeting = currentUser.role === 'host' || currentUser.role === 'admin';
  if (!canCreateMeeting) {
    // Hide entire create meeting section for members
    const createMeetingCard = createForm.closest('.card');
    if (createMeetingCard) {
      createMeetingCard.style.display = 'none';
    }
  }

  await loadMeetings();

  createForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!canCreateMeeting) {
      showNotice('Only hosts or admins can create meetings.', 'warning');
      return;
    }

    createBtn.disabled = true;
    createBtn.textContent = 'Creating...';
    notice.classList.add('hidden');

    const payload = {
      title: document.getElementById('title').value.trim(),
      scheduled_time: document.getElementById('scheduled_time').value,
      created_by: currentUser.id,
      password: document.getElementById('meeting_password').value.trim() || null
    };

    if (isAdmin) {
      payload.hostPermissions = {
        canLock: Boolean(permLock?.checked),
        canMute: Boolean(permMute?.checked),
        canVideo: Boolean(permVideo?.checked),
        canChat: Boolean(permChat?.checked),
        canScreen: Boolean(permScreen?.checked),
        canRemove: Boolean(permRemove?.checked),
        canEndMeeting: Boolean(permEndMeeting?.checked),
        allowRaiseHand: Boolean(allowRaiseHand?.checked),
        allowScreenShare: Boolean(allowScreenShare?.checked),
        allowRecording: Boolean(allowRecording?.checked),
        allowSystemAudio: Boolean(allowSystemAudio?.checked)
      };
    }

    try {
      const result = await window.api.meeting.create(payload);
      if (result.success) {
        createForm.reset();
        await loadMeetings();
        showNotice(`Meeting created. Code: ${result.meeting_code}`, 'success');
      } else {
        showNotice(result.error || 'Unable to create meeting.', 'error');
      }
    } catch (error) {
      console.error('Create meeting error:', error);
      showNotice('Unexpected error creating meeting.', 'error');
    } finally {
      createBtn.disabled = false;
      createBtn.textContent = 'Create Meeting';
    }
  });

  joinForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    joinBtn.disabled = true;
    joinBtn.textContent = 'Joining...';
    notice.classList.add('hidden');

    const meetingCode = document.getElementById('meeting_code').value.trim().toUpperCase();
    const meetingPassword = document.getElementById('join_password').value.trim();

    try {
      const result = await window.api.meeting.getByCode(meetingCode);
      if (!result.success || !result.meeting) {
        showNotice('Meeting not found.', 'error');
      } else if (result.meeting.is_locked) {
        showNotice('This meeting is locked by the host.', 'warning');
      } else if (result.meeting.password && result.meeting.password !== meetingPassword) {
        showNotice('Incorrect meeting password.', 'error');
      } else {
        sessionStorage.setItem('activeMeeting', JSON.stringify(result.meeting));
        await window.api.navigate('meeting');
      }
    } catch (error) {
      console.error('Join meeting error:', error);
      showNotice('Unexpected error joining meeting.', 'error');
    } finally {
      joinBtn.disabled = false;
      joinBtn.textContent = 'Join Meeting';
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await window.api.session.clear();
    await window.api.navigate('index');
  });

  navItems.forEach((item) => {
    item.addEventListener('click', async () => {
      const page = item.dataset.page;
      if (page && page !== 'meetings') {
        await window.api.navigate(page);
      }
    });
  });

  if (closePermissionsBtn) {
    closePermissionsBtn.addEventListener('click', () => {
      hidePermissionsModal();
    });
  }

  if (savePermissionsBtn) {
    savePermissionsBtn.addEventListener('click', async () => {
      if (!activeMeetingId) {
        return;
      }
      savePermissionsBtn.disabled = true;
      savePermissionsBtn.textContent = 'Saving...';
      const payload = {
        meetingId: activeMeetingId,
        hostPermissions: {
          canLock: Boolean(editPermLock?.checked),
          canMute: Boolean(editPermMute?.checked),
          canVideo: Boolean(editPermVideo?.checked),
          canChat: Boolean(editPermChat?.checked),
          canScreen: Boolean(editPermScreen?.checked),
          canRemove: Boolean(editPermRemove?.checked),
          canEndMeeting: Boolean(editPermEndMeeting?.checked),
          allowRaiseHand: Boolean(editAllowRaiseHand?.checked),
          allowScreenShare: Boolean(editAllowScreenShare?.checked),
          allowRecording: Boolean(editAllowRecording?.checked),
          allowSystemAudio: Boolean(editAllowSystemAudio?.checked)
        }
      };

      const result = await window.api.meeting.updateSettings(payload);
      if (result.success) {
        showNotice('Host permissions updated.', 'success');
        hidePermissionsModal();
      } else {
        showNotice(result.error || 'Failed to update permissions.', 'error');
      }
      savePermissionsBtn.disabled = false;
      savePermissionsBtn.textContent = 'Save';
    });
  }

  async function loadMeetings() {
    const result = await window.api.meeting.getAll();
    if (!result.success) {
      showNotice(result.error || 'Unable to load meetings.', 'error');
      return;
    }

    const meetings = result.meetings || [];
    meetingList.innerHTML = '';

    if (!meetings.length) {
      meetingList.innerHTML = '<div class="list-empty">No meetings scheduled.</div>';
      return;
    }

    meetings.forEach((meeting) => {
      const card = document.createElement('div');
      card.className = 'meeting-card';

      const info = document.createElement('div');
      info.innerHTML = `
        <h4>${meeting.title}</h4>
        <p>${meeting.meeting_code} • ${new Date(meeting.scheduled_time).toLocaleString()}</p>
        <p class="text-muted">Host: ${meeting.creator_name}</p>
      `;

      const status = document.createElement('span');
      if (meeting.is_ended) {
        status.className = 'badge badge-danger';
        status.textContent = 'Ended';
      } else {
        status.className = meeting.is_locked ? 'badge badge-warning' : 'badge badge-success';
        status.textContent = meeting.is_locked ? 'Locked' : 'Open';
      }

      const actions = document.createElement('div');
      actions.className = 'meeting-card-actions';
      actions.appendChild(status);

      const openBtn = document.createElement('button');
      openBtn.className = 'btn btn-sm btn-primary';
      openBtn.textContent = 'OPEN';
      openBtn.addEventListener('click', async () => {
        if (meeting.is_ended) {
          showNotice('This meeting has been ended and cannot be joined.', 'error');
          return;
        }
        if (meeting.is_locked) {
          showNotice('This meeting is locked by the host.', 'warning');
          return;
        }
        if (meeting.password) {
          const pwd = prompt('Enter meeting password:');
          if (pwd !== meeting.password) {
            showNotice('Incorrect meeting password.', 'error');
            return;
          }
        }
        sessionStorage.setItem('activeMeeting', JSON.stringify(meeting));
        await window.api.navigate('meeting');
      });
      actions.appendChild(openBtn);

      if (isAdmin) {
        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-sm btn-outline';
        editBtn.textContent = 'Edit Permissions';
        editBtn.addEventListener('click', async () => {
          const settingsResult = await window.api.meeting.getSettings(meeting.id);
          if (!settingsResult.success || !settingsResult.settings) {
            showNotice(settingsResult.error || 'Unable to load permissions.', 'error');
            return;
          }
          activeMeetingId = meeting.id;
          editPermLock.checked = settingsResult.settings.host_can_lock !== 0;
          editPermMute.checked = settingsResult.settings.host_can_mute !== 0;
          editPermVideo.checked = settingsResult.settings.host_can_video !== 0;
          editPermChat.checked = settingsResult.settings.host_can_chat !== 0;
          editPermScreen.checked = settingsResult.settings.host_can_screen !== 0;
          editPermRemove.checked = settingsResult.settings.host_can_remove !== 0;
          editPermEndMeeting.checked = settingsResult.settings.host_can_end_meeting !== 0;
          editAllowRaiseHand.checked = settingsResult.settings.allow_raise_hand !== 0;
          editAllowScreenShare.checked = settingsResult.settings.allow_screen_share !== 0;
          editAllowRecording.checked = settingsResult.settings.allow_recording !== 0;
          editAllowSystemAudio.checked = settingsResult.settings.allow_system_audio !== 0;
          showPermissionsModal();
        });
        actions.appendChild(editBtn);
      }

      card.appendChild(info);
      card.appendChild(actions);
      meetingList.appendChild(card);
    });
  }

  function showPermissionsModal() {
    if (permissionsModal) {
      permissionsModal.classList.remove('hidden');
    }
  }

  function hidePermissionsModal() {
    if (permissionsModal) {
      permissionsModal.classList.add('hidden');
    }
    activeMeetingId = null;
  }

  function showNotice(message, type) {
    notice.textContent = message;
    notice.className = `alert alert-${type}`;
    notice.classList.remove('hidden');
  }
});
