/**
 * Settings Page Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
  const logoutBtn = document.getElementById('logoutBtn');
  const serverSettingsForm = document.getElementById('serverSettingsForm');
  const signalingServerUrl = document.getElementById('signalingServerUrl');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const resetDefaultBtn = document.getElementById('resetDefaultBtn');
  const testConnectionBtn = document.getElementById('testConnectionBtn');
  const settingsStatus = document.getElementById('settingsStatus');
  const openDocsBtn = document.getElementById('openDocsBtn');
  const backendSettingsForm = document.getElementById('backendSettingsForm');
  const backendApiUrl = document.getElementById('backendApiUrl');
  const saveBackendBtn = document.getElementById('saveBackendBtn');
  const resetBackendBtn = document.getElementById('resetBackendBtn');
  const testBackendBtn = document.getElementById('testBackendBtn');
  const backendStatus = document.getElementById('backendStatus');
  const navItems = document.querySelectorAll('.nav-item');
  const currentRoleBadge = document.getElementById('currentRole');

  // Check authentication
  const sessionResult = await window.api.session.get();
  if (!sessionResult.success || !sessionResult.user) {
    await window.api.navigate('index');
    return;
  }

  const currentUser = sessionResult.user;

  if (currentRoleBadge) {
    currentRoleBadge.textContent = currentUser.role.toUpperCase();
    currentRoleBadge.className = `badge badge-${currentUser.role === 'admin' ? 'success' : 'warning'}`;
  }

  // Check if user is admin
  if (currentUser.role !== 'admin') {
    showStatus('error', '❌ Access Denied: Admin access required');
    serverSettingsForm.style.display = 'none';
    return;
  }

  // Hide Members/Attendance/Settings nav for non-admins
  if (currentUser.role !== 'admin') {
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

  // Load current settings
  loadSettings();
  loadBackendSettings();

  // Event listeners
  logoutBtn.addEventListener('click', async () => {
    await window.api.session.clear();
    await window.api.navigate('index');
  });

  navItems.forEach((item) => {
    item.addEventListener('click', async () => {
      const page = item.dataset.page;
      if (page && page !== 'settings') {
        await window.api.navigate(page);
      }
    });
  });

  serverSettingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveSettings();
  });

  resetDefaultBtn.addEventListener('click', () => {
    signalingServerUrl.value = 'http://127.0.0.1:3001';
    showStatus('info', 'ℹ️ URL reset to default local server. Click "Save Settings" to apply.');
  });

  testConnectionBtn.addEventListener('click', async () => {
    await testConnection();
  });

  if (backendSettingsForm) {
    backendSettingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveBackendSettings();
    });
  }

  if (resetBackendBtn) {
    resetBackendBtn.addEventListener('click', () => {
      backendApiUrl.value = '';
      showBackendStatus('info', 'ℹ️ Backend URL cleared. Click "Save Backend URL" to apply.');
    });
  }

  if (testBackendBtn) {
    testBackendBtn.addEventListener('click', async () => {
      await testBackendConnection();
    });
  }

  openDocsBtn.addEventListener('click', () => {
    try {
      const { shell } = require('electron');
      const path = require('path');
      const docsPath = path.join(__dirname, '..', 'signaling-server', 'README.md');
      shell.openPath(docsPath);
    } catch (error) {
      showStatus('error', '❌ Unable to open the deployment guide.');
    }
  });

  async function loadSettings() {
    try {
      const result = await window.api.settings.get('signalingServerUrl');
      if (result.success && result.value) {
        signalingServerUrl.value = result.value;
      } else {
        signalingServerUrl.value = 'http://127.0.0.1:3001';
      }
    } catch (error) {
      showStatus('error', '❌ Error loading settings: ' + error.message);
    }
  }

  async function loadBackendSettings() {
    if (!backendApiUrl) {
      return;
    }

    try {
      const result = await window.api.settings.get('backendApiUrl');
      if (result.success && result.value) {
        backendApiUrl.value = result.value;
      } else {
        backendApiUrl.value = '';
      }
    } catch (error) {
      showBackendStatus('error', '❌ Error loading backend URL: ' + error.message);
    }
  }

  async function saveSettings() {
    const url = signalingServerUrl.value.trim();
    
    if (!url) {
      showStatus('error', '❌ Please enter a server URL');
      return;
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      showStatus('error', '❌ Invalid URL format. Must include protocol (http:// or https://)');
      return;
    }

    saveSettingsBtn.disabled = true;
    saveSettingsBtn.textContent = '💾 Saving...';

    try {
      const result = await window.api.settings.set({
        key: 'signalingServerUrl',
        value: url
      });

      if (result.success) {
        showStatus('success', '✅ Settings saved successfully! Please restart the app for changes to take effect.');
        
        // Log activity
        await window.api.activity.log({
          user_id: currentUser.id,
          action: 'update_settings',
          details: `Changed signaling server to: ${url}`
        });
      } else {
        showStatus('error', '❌ Error saving settings: ' + result.error);
      }
    } catch (error) {
      showStatus('error', '❌ Error saving settings: ' + error.message);
    } finally {
      saveSettingsBtn.disabled = false;
      saveSettingsBtn.textContent = '💾 Save Settings';
    }
  }

  async function saveBackendSettings() {
    const url = backendApiUrl.value.trim();

    if (!url) {
      showBackendStatus('error', '❌ Please enter a backend API URL');
      return;
    }

    try {
      new URL(url);
    } catch (error) {
      showBackendStatus('error', '❌ Invalid URL format. Must include protocol (http:// or https://)');
      return;
    }

    saveBackendBtn.disabled = true;
    saveBackendBtn.textContent = '💾 Saving...';

    try {
      const result = await window.api.settings.set({
        key: 'backendApiUrl',
        value: url
      });

      if (result.success) {
        showBackendStatus('success', '✅ Backend URL saved. Please restart the app to apply changes.');
      } else {
        showBackendStatus('error', '❌ Error saving backend URL: ' + result.error);
      }
    } catch (error) {
      showBackendStatus('error', '❌ Error saving backend URL: ' + error.message);
    } finally {
      saveBackendBtn.disabled = false;
      saveBackendBtn.textContent = 'Save Backend URL';
    }
  }

  async function testConnection() {
    const url = signalingServerUrl.value.trim();
    
    if (!url) {
      showStatus('error', '❌ Please enter a server URL');
      return;
    }

    testConnectionBtn.disabled = true;
    testConnectionBtn.textContent = '🔌 Testing...';
    showStatus('info', '🔄 Testing connection...');

    try {
      // Try to fetch health endpoint
      const healthUrl = new URL(url);
      healthUrl.pathname = '/health';
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(healthUrl.toString(), {
        signal: controller.signal,
        method: 'GET'
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        showStatus('success', `✅ Connection successful! Server is healthy. Active rooms: ${data.activeRooms || 0}`);
      } else {
        showStatus('warning', `⚠️ Server responded with status ${response.status}. Server may be running but not fully functional.`);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        showStatus('error', '❌ Connection timeout. Server is not reachable or not responding.');
      } else {
        showStatus('error', `❌ Connection failed: ${error.message}. Make sure the server is running and the URL is correct.`);
      }
    } finally {
      testConnectionBtn.disabled = false;
      testConnectionBtn.textContent = '🔌 Test Connection';
    }
  }

  async function testBackendConnection() {
    const url = backendApiUrl.value.trim();

    if (!url) {
      showBackendStatus('error', '❌ Please enter a backend API URL');
      return;
    }

    testBackendBtn.disabled = true;
    testBackendBtn.textContent = '🔌 Testing...';
    showBackendStatus('info', '🔄 Testing backend API...');

    try {
      const healthUrl = new URL(url);
      healthUrl.pathname = '/health';

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(healthUrl.toString(), {
        signal: controller.signal,
        method: 'GET'
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        showBackendStatus('success', '✅ Backend API is reachable.');
      } else {
        showBackendStatus('warning', `⚠️ Backend responded with status ${response.status}.`);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        showBackendStatus('error', '❌ Connection timeout. Backend is not reachable.');
      } else {
        showBackendStatus('error', `❌ Connection failed: ${error.message}`);
      }
    } finally {
      testBackendBtn.disabled = false;
      testBackendBtn.textContent = 'Test API';
    }
  }

  function showStatus(type, message) {
    const alertClass = {
      success: 'alert-success',
      error: 'alert-error',
      warning: 'alert-warning',
      info: 'alert-info'
    }[type] || 'alert-info';

    settingsStatus.innerHTML = `
      <div class="alert ${alertClass}" role="alert">
        ${message}
      </div>
    `;

    // Auto-dismiss after 5 seconds (except for errors)
    if (type !== 'error') {
      setTimeout(() => {
        settingsStatus.innerHTML = '';
      }, 5000);
    }
  }

  function showBackendStatus(type, message) {
    const alertClass = {
      success: 'alert-success',
      error: 'alert-error',
      warning: 'alert-warning',
      info: 'alert-info'
    }[type] || 'alert-info';

    backendStatus.innerHTML = `
      <div class="alert ${alertClass}" role="alert">
        ${message}
      </div>
    `;

    if (type !== 'error') {
      setTimeout(() => {
        backendStatus.innerHTML = '';
      }, 5000);
    }
  }
});
