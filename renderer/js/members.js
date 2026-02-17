/**
 * Members Management JavaScript
 * Handles CRUD operations for cooperative members
 */

document.addEventListener('DOMContentLoaded', async () => {
  const logoutBtn = document.getElementById('logoutBtn');
  const currentRoleBadge = document.getElementById('currentRole');
  const accessNotice = document.getElementById('accessNotice');
  const memberList = document.getElementById('memberList');
  const memberForm = document.getElementById('memberForm');
  const submitBtn = document.getElementById('submitBtn');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const formTitle = document.getElementById('formTitle');
  const passwordGroup = document.getElementById('passwordGroup');
  const searchInput = document.getElementById('searchInput');
  const navItems = document.querySelectorAll('.nav-item');

  let currentUser = null;
  let editingUserId = null;
  let allUsers = [];

  const sessionResult = await window.api.session.get();
  if (!sessionResult.success || !sessionResult.user) {
    await window.api.navigate('index');
    return;
  }

  currentUser = sessionResult.user;
  currentRoleBadge.textContent = currentUser.role.toUpperCase();
  currentRoleBadge.className = `badge badge-${currentUser.role === 'admin' ? 'success' : 'warning'}`;

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
    accessNotice.textContent = 'Member management is restricted to administrators.';
    accessNotice.classList.remove('hidden');
    memberForm.querySelectorAll('input, select, button').forEach((el) => {
      el.disabled = true;
    });
  }

  await loadMembers();

  memberForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = {
      full_name: document.getElementById('full_name').value.trim(),
      email: document.getElementById('email').value.trim(),
      role: document.getElementById('role').value,
      password: document.getElementById('password').value
    };

    submitBtn.disabled = true;
    submitBtn.textContent = editingUserId ? 'Updating...' : 'Creating...';

    try {
      if (editingUserId) {
        const result = await window.api.user.update({
          userId: editingUserId,
          full_name: formData.full_name,
          email: formData.email,
          role: formData.role
        });

        if (result.success) {
          await loadMembers();
          resetForm();
        } else {
          showNotice(result.error || 'Unable to update member.');
        }
      } else {
        const result = await window.api.user.register(formData);
        if (result.success) {
          await loadMembers();
          resetForm();
        } else {
          showNotice(result.error || 'Unable to create member.');
        }
      }
    } catch (error) {
      console.error('Member save error:', error);
      showNotice('Unexpected error saving member.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = editingUserId ? 'Update Member' : 'Create Member';
    }
  });

  cancelEditBtn.addEventListener('click', () => resetForm());

  logoutBtn.addEventListener('click', async () => {
    await window.api.session.clear();
    await window.api.navigate('index');
  });

  navItems.forEach((item) => {
    item.addEventListener('click', async () => {
      const page = item.dataset.page;
      if (page && page !== 'members') {
        await window.api.navigate(page);
      }
    });
  });

  searchInput.addEventListener('input', () => {
    const value = searchInput.value.trim().toLowerCase();
    const filtered = allUsers.filter((user) => {
      return user.full_name.toLowerCase().includes(value) || user.email.toLowerCase().includes(value);
    });
    renderMembers(filtered);
  });

  function showNotice(message) {
    accessNotice.textContent = message;
    accessNotice.classList.remove('hidden');
    accessNotice.classList.remove('alert-warning');
    accessNotice.classList.add('alert-error');
  }

  async function loadMembers() {
    const result = await window.api.user.getAll();
    if (!result.success) {
      showNotice(result.error || 'Unable to load members.');
      return;
    }
    allUsers = result.users || [];
    renderMembers(allUsers);
  }

  function renderMembers(users) {
    memberList.innerHTML = '';
    if (!users.length) {
      memberList.innerHTML = '<div class="list-empty">No members found.</div>';
      return;
    }

    users.forEach((user) => {
      const card = document.createElement('div');
      card.className = 'member-card';

      const info = document.createElement('div');
      info.innerHTML = `
        <h4>${user.full_name}</h4>
        <p>${user.email}</p>
        <p class="text-muted">Role: ${user.role}</p>
      `;

      const actions = document.createElement('div');
      actions.className = 'member-actions';

      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-sm btn-outline';
      editBtn.textContent = 'Edit';
      editBtn.disabled = currentUser.role !== 'admin';
      editBtn.addEventListener('click', () => startEdit(user));

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-sm btn-danger';
      deleteBtn.textContent = 'Delete';
      deleteBtn.disabled = currentUser.role !== 'admin' || user.id === currentUser.id;
      deleteBtn.addEventListener('click', () => confirmDelete(user));

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);

      card.appendChild(info);
      card.appendChild(actions);
      memberList.appendChild(card);
    });
  }

  function startEdit(user) {
    editingUserId = user.id;
    formTitle.textContent = 'Edit Member';
    submitBtn.textContent = 'Update Member';
    cancelEditBtn.classList.remove('hidden');
    passwordGroup.classList.add('hidden');

    document.getElementById('full_name').value = user.full_name;
    document.getElementById('email').value = user.email;
    document.getElementById('role').value = user.role;
  }

  async function confirmDelete(user) {
    const confirmed = window.confirm(`Delete ${user.full_name}? This action cannot be undone.`);
    if (!confirmed) {
      return;
    }

    const result = await window.api.user.delete(user.id);
    if (result.success) {
      await loadMembers();
      if (editingUserId === user.id) {
        resetForm();
      }
    } else {
      showNotice(result.error || 'Unable to delete member.');
    }
  }

  function resetForm() {
    editingUserId = null;
    memberForm.reset();
    formTitle.textContent = 'Add New Member';
    submitBtn.textContent = 'Create Member';
    cancelEditBtn.classList.add('hidden');
    passwordGroup.classList.remove('hidden');
  }
});
