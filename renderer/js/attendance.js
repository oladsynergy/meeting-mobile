/**
 * Attendance Reports JavaScript
 */

document.addEventListener('DOMContentLoaded', async () => {
  const logoutBtn = document.getElementById('logoutBtn');
  const exportCsv = document.getElementById('exportCsv');
  const exportPdf = document.getElementById('exportPdf');
  const notice = document.getElementById('notice');
  const startDate = document.getElementById('startDate');
  const endDate = document.getElementById('endDate');
  const memberSelect = document.getElementById('memberSelect');
  const applyFilters = document.getElementById('applyFilters');
  const clearFilters = document.getElementById('clearFilters');
  const totalMeetings = document.getElementById('totalMeetings');
  const totalAttendance = document.getElementById('totalAttendance');
  const averageAttendance = document.getElementById('averageAttendance');
  const attendanceTable = document.getElementById('attendanceTable');
  const absentList = document.getElementById('absentList');
  const memberStatsTable = document.getElementById('memberStatsTable');
  const navItems = document.querySelectorAll('.nav-item');

  const sessionResult = await window.api.session.get();
  if (!sessionResult.success || !sessionResult.user) {
    await window.api.navigate('index');
    return;
  }

  const currentUser = sessionResult.user;
  
  // Hide Members and Attendance nav for non-admins
  if (currentUser.role !== 'admin') {
    const membersNav = document.querySelector('.nav-item[data-page="members"]');
    const attendanceNav = document.querySelector('.nav-item[data-page="attendance"]');
    if (membersNav) {
      membersNav.style.display = 'none';
    }
    if (attendanceNav) {
      attendanceNav.style.display = 'none';
    }
  }

  if (currentUser.role !== 'admin') {
    showNotice('Attendance reports are available to administrators only.', 'warning');
    exportCsv.disabled = true;
    exportPdf.disabled = true;
  }

  await loadMembers();
  await loadReport();

  applyFilters.addEventListener('click', async () => {
    await loadReport();
  });

  clearFilters.addEventListener('click', async () => {
    startDate.value = '';
    endDate.value = '';
    memberSelect.value = '';
    await loadReport();
  });

  exportCsv.addEventListener('click', async () => {
    await exportReport('csv');
  });

  exportPdf.addEventListener('click', async () => {
    await exportReport('pdf');
  });

  logoutBtn.addEventListener('click', async () => {
    await window.api.session.clear();
    await window.api.navigate('index');
  });

  navItems.forEach((item) => {
    item.addEventListener('click', async () => {
      const page = item.dataset.page;
      if (page && page !== 'attendance') {
        await window.api.navigate(page);
      }
    });
  });

  async function loadMembers() {
    const result = await window.api.user.getAll();
    if (!result.success) {
      return;
    }

    const users = result.users || [];
    users.forEach((user) => {
      if (user.role === 'admin') {
        return;
      }
      const option = document.createElement('option');
      option.value = user.id;
      option.textContent = user.full_name;
      memberSelect.appendChild(option);
    });
  }

  async function loadReport() {
    const filters = getFilters();

    const [summaryResult, recordsResult] = await Promise.all([
      window.api.attendance.summary(filters),
      window.api.attendance.records(filters)
    ]);

    const [absentResult, statsResult] = await Promise.all([
      window.api.attendance.absent(filters),
      window.api.attendance.memberStats(filters)
    ]);

    if (summaryResult.success) {
      const summary = summaryResult.summary || [];
      totalMeetings.textContent = summary.length;
      const totalAttendanceCount = summary.reduce((acc, item) => acc + item.attendee_count, 0);
      totalAttendance.textContent = totalAttendanceCount;
      const totalMembers = summary.length ? summary[0].total_members : 0;
      const average = summary.length && totalMembers
        ? Math.round((totalAttendanceCount / (summary.length * totalMembers)) * 100)
        : 0;
      averageAttendance.textContent = `${average}%`;
    }

    if (!summaryResult.success && summaryResult.error) {
      showNotice(summaryResult.error, 'warning');
    }

    if (recordsResult.success) {
      renderTable(recordsResult.records || []);
    } else if (recordsResult.error) {
      showNotice(recordsResult.error, 'warning');
    }

    if (absentResult.success) {
      renderAbsent(absentResult.rows || []);
    } else if (absentResult.error) {
      showNotice(absentResult.error, 'warning');
    }

    if (statsResult.success) {
      renderMemberStats(statsResult.stats || []);
    } else if (statsResult.error) {
      showNotice(statsResult.error, 'warning');
    }
  }

  function getFilters() {
    return {
      startDate: startDate.value || null,
      endDate: endDate.value || null,
      memberId: memberSelect.value || null
    };
  }

  function renderTable(records) {
    attendanceTable.innerHTML = '';
    if (!records.length) {
      attendanceTable.innerHTML = '<div class="table-empty">No attendance records found.</div>';
      return;
    }

    const header = document.createElement('div');
    header.className = 'table-header';
    header.innerHTML = `
      <div>Meeting</div>
      <div>Member</div>
      <div>Date</div>
      <div>Join</div>
      <div>Leave</div>
      <div>Minutes</div>
    `;
    attendanceTable.appendChild(header);

    records.forEach((record) => {
      const row = document.createElement('div');
      row.className = 'table-row';
      row.innerHTML = `
        <div>${record.meeting_title}</div>
        <div>${record.full_name}</div>
        <div>${new Date(record.scheduled_time).toLocaleDateString()}</div>
        <div>${record.join_time ? new Date(record.join_time).toLocaleTimeString() : '-'}</div>
        <div>${record.leave_time ? new Date(record.leave_time).toLocaleTimeString() : '-'}</div>
        <div>${record.duration_minutes ?? '-'}</div>
      `;
      attendanceTable.appendChild(row);
    });
  }

  function renderAbsent(rows) {
    absentList.innerHTML = '';
    if (!rows.length) {
      absentList.innerHTML = '<div class="table-empty">No absences in this range.</div>';
      return;
    }

    const grouped = rows.reduce((acc, row) => {
      if (!acc[row.meeting_id]) {
        acc[row.meeting_id] = {
          meeting_title: row.meeting_title,
          meeting_code: row.meeting_code,
          scheduled_time: row.scheduled_time,
          members: []
        };
      }
      acc[row.meeting_id].members.push(row);
      return acc;
    }, {});

    Object.values(grouped).forEach((meeting) => {
      const item = document.createElement('div');
      item.className = 'list-item';
      const dateText = meeting.scheduled_time ? new Date(meeting.scheduled_time).toLocaleString() : '-';
      const names = meeting.members.map((member) => member.full_name).join(', ');
      item.innerHTML = `
        <h4>${meeting.meeting_title} (${meeting.meeting_code})</h4>
        <p class="text-muted">${dateText}</p>
        <p>${names}</p>
      `;
      absentList.appendChild(item);
    });
  }

  function renderMemberStats(stats) {
    memberStatsTable.innerHTML = '';
    if (!stats.length) {
      memberStatsTable.innerHTML = '<div class="table-empty">No member stats available.</div>';
      return;
    }

    const header = document.createElement('div');
    header.className = 'table-header';
    header.innerHTML = `
      <div>Member</div>
      <div>Email</div>
      <div>Meetings</div>
      <div>Attended</div>
      <div>Attendance %</div>
      <div></div>
    `;
    memberStatsTable.appendChild(header);

    stats.forEach((row) => {
      const total = row.total_meetings || 0;
      const attended = row.attended_meetings || 0;
      const percent = total ? Math.round((attended / total) * 100) : 0;

      const item = document.createElement('div');
      item.className = 'table-row';
      item.innerHTML = `
        <div>${row.full_name}</div>
        <div>${row.email}</div>
        <div>${total}</div>
        <div>${attended}</div>
        <div>${percent}%</div>
        <div></div>
      `;
      memberStatsTable.appendChild(item);
    });
  }

  async function exportReport(type) {
    if (currentUser.role !== 'admin') {
      showNotice('Only administrators can export reports.', 'warning');
      return;
    }

    const filters = getFilters();
    const result = type === 'csv'
      ? await window.api.attendance.exportCsv(filters)
      : await window.api.attendance.exportPdf(filters);

    if (result.success) {
      showNotice(`Export saved to: ${result.filePath}`, 'success');
    } else {
      showNotice(result.error || 'Export failed.', 'error');
    }
  }

  function showNotice(message, type) {
    notice.textContent = message;
    notice.className = `alert alert-${type}`;
    notice.classList.remove('hidden');
  }
});
