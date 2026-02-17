/**
 * Dashboard JavaScript
 * Loads session data and populates summary stats
 */

document.addEventListener('DOMContentLoaded', async () => {
  const userName = document.getElementById('userName');
  const totalMembers = document.getElementById('totalMembers');
  const desktopUsers = document.getElementById('desktopUsers');
  const mobileUsers = document.getElementById('mobileUsers');
  const totalMeetings = document.getElementById('totalMeetings');
  const totalHosts = document.getElementById('totalHosts');
  const totalAdmins = document.getElementById('totalAdmins');
  const meetingList = document.getElementById('meetingList');
  const memberList = document.getElementById('memberList');
  const logoutBtn = document.getElementById('logoutBtn');
  const createMeetingBtn = document.getElementById('createMeetingBtn');
  const navItems = document.querySelectorAll('.nav-item');

  const sessionResult = await window.api.session.get();

  if (!sessionResult.success || !sessionResult.user) {
    await window.api.navigate('index');
    return;
  }

  const currentUser = sessionResult.user;
  userName.textContent = currentUser.full_name || 'Member';
  const isAdmin = currentUser.role === 'admin';
  const canCreateMeeting = currentUser.role === 'host' || isAdmin;

  // Hide Members and Attendance nav for non-admins
  if (!isAdmin) {
    const membersNav = document.querySelector('.nav-item[data-page="members"]');
    const attendanceNav = document.querySelector('.nav-item[data-page="attendance"]');
    const settingsNav = document.querySelector('.nav-item[data-page="settings"]');
    if (membersNav) {
      membersNav.style.display = 'none';
    }
    if (attendanceNav) {
      attendanceNav.style.display = 'none';
    }
    if (settingsNav) {
      settingsNav.style.display = 'none';
    }
  }

  // Hide Create Meeting button for members
  if (!canCreateMeeting) {
    createMeetingBtn.style.display = 'none';
  }

  // Hide admin statistics and Recent Members section for non-admins
  if (!isAdmin) {
    const statsGrid = document.querySelector('.stats-grid');
    const memberCard = Array.from(document.querySelectorAll('.card'))
      .find(card => card.querySelector('h2')?.textContent === 'Recent Members');
    
    if (statsGrid) {
      statsGrid.style.display = 'none';
    }
    if (memberCard) {
      memberCard.style.display = 'none';
    }
  }

  try {
    const [usersResult, meetingsResult] = await Promise.all([
      window.api.user.getAll(),
      window.api.meeting.getAll()
    ]);

    // Only populate stats for admins
    if (isAdmin && usersResult.success) {
      const users = usersResult.users || [];
      totalMembers.textContent = users.length;
      totalHosts.textContent = users.filter((u) => u.role === 'host').length;
      totalAdmins.textContent = users.filter((u) => u.role === 'admin').length;
      desktopUsers.textContent = users.filter((u) => u.last_platform === 'desktop' || !u.last_platform).length;
      mobileUsers.textContent = users.filter((u) => u.last_platform === 'mobile').length;
      renderMembers(users.slice(0, 5));
    }

    if (meetingsResult.success) {
      const meetings = meetingsResult.meetings || [];
      if (isAdmin) {
        totalMeetings.textContent = meetings.length;
      }
      renderMeetings(meetings.slice(0, 5));
    }
  } catch (error) {
    console.error('Dashboard load error:', error);
  }

  logoutBtn.addEventListener('click', async () => {
    await window.api.session.clear();
    await window.api.navigate('index');
  });

  createMeetingBtn.addEventListener('click', async () => {
    await window.api.navigate('meetings');
  });

  navItems.forEach((item) => {
    item.addEventListener('click', async () => {
      const page = item.dataset.page;
      if (page && page !== 'dashboard') {
        await window.api.navigate(page);
      }
    });
  });

  function renderMeetings(meetings) {
    meetingList.innerHTML = '';
    if (!meetings.length) {
      meetingList.innerHTML = '<div class="list-empty">No meetings yet.</div>';
      return;
    }

    meetings.forEach((meeting) => {
      const item = document.createElement('div');
      item.className = 'list-item';

      const left = document.createElement('div');
      left.innerHTML = `
        <h4>${meeting.title}</h4>
        <p>${meeting.meeting_code} • ${new Date(meeting.scheduled_time).toLocaleString()}</p>
      `;

      const right = document.createElement('span');
      right.className = 'badge badge-primary';
      right.textContent = meeting.is_locked ? 'Locked' : 'Open';

      item.appendChild(left);
      item.appendChild(right);
      meetingList.appendChild(item);
    });
  }

  function renderMembers(users) {
    memberList.innerHTML = '';
    if (!users.length) {
      memberList.innerHTML = '<div class="list-empty">No members yet.</div>';
      return;
    }

    users.forEach((user) => {
      const item = document.createElement('div');
      item.className = 'list-item';

      const left = document.createElement('div');
      const platform = user.last_platform === 'mobile' ? '📱 Mobile' : '🖥️ Desktop';
      left.innerHTML = `
        <h4>${user.full_name}</h4>
        <p>${user.email}</p>
      `;

      const rolesContainer = document.createElement('div');
      rolesContainer.style.display = 'flex';
      rolesContainer.style.gap = '8px';
      rolesContainer.style.alignItems = 'center';

      const roleSpan = document.createElement('span');
      roleSpan.className = 'badge badge-success';
      roleSpan.textContent = user.role;

      const platformSpan = document.createElement('span');
      platformSpan.className = `badge ${user.last_platform === 'mobile' ? 'badge-info' : 'badge-secondary'}`;
      platformSpan.textContent = platform;

      rolesContainer.appendChild(roleSpan);
      rolesContainer.appendChild(platformSpan);

      item.appendChild(left);
      item.appendChild(rolesContainer);
      memberList.appendChild(item);
    });
  }
});
