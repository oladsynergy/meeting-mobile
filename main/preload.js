/**
 * Preload Script
 * Securely exposes IPC methods to the renderer process
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // Navigation
  navigate: (page) => ipcRenderer.invoke('navigate', page),

  // Session Management
  session: {
    set: (user) => ipcRenderer.invoke('session:set', user),
    get: () => ipcRenderer.invoke('session:get'),
    clear: () => ipcRenderer.invoke('session:clear')
  },

  // User Authentication
  user: {
    register: (data) => ipcRenderer.invoke('user:register', data),
    login: (data) => ipcRenderer.invoke('user:login', data),
    getAll: () => ipcRenderer.invoke('user:getAll'),
    getById: (userId) => ipcRenderer.invoke('user:getById', userId),
    update: (data) => ipcRenderer.invoke('user:update', data),
    delete: (userId) => ipcRenderer.invoke('user:delete', userId)
  },

  // Meeting Management
  meeting: {
    create: (data) => ipcRenderer.invoke('meeting:create', data),
    getByCode: (code) => ipcRenderer.invoke('meeting:getByCode', code),
    getAll: () => ipcRenderer.invoke('meeting:getAll'),
    lock: (data) => ipcRenderer.invoke('meeting:lock', data),
    getSettings: (meetingId) => ipcRenderer.invoke('meeting:settings:get', meetingId),
    updateSettings: (data) => ipcRenderer.invoke('meeting:settings:update', data)
  },

  // Attendance Management
  attendance: {
    recordJoin: (data) => ipcRenderer.invoke('attendance:recordJoin', data),
    recordLeave: (attendanceId) => ipcRenderer.invoke('attendance:recordLeave', attendanceId),
    getByMeeting: (meetingId) => ipcRenderer.invoke('attendance:getByMeeting', meetingId),
    getByUser: (userId) => ipcRenderer.invoke('attendance:getByUser', userId),
    summary: (filters) => ipcRenderer.invoke('attendance:summary', filters),
    records: (filters) => ipcRenderer.invoke('attendance:records', filters),
    absent: (filters) => ipcRenderer.invoke('attendance:absent', filters),
    memberStats: (filters) => ipcRenderer.invoke('attendance:memberStats', filters),
    exportCsv: (filters) => ipcRenderer.invoke('attendance:exportCsv', filters),
    exportPdf: (filters) => ipcRenderer.invoke('attendance:exportPdf', filters)
  },

  // Activity Logging
  activity: {
    log: (data) => ipcRenderer.invoke('activity:log', data)
  },

  recording: {
    save: (data) => ipcRenderer.invoke('recording:save', data)
  },

  poll: {
    create: (data) => ipcRenderer.invoke('poll:create', data),
    list: (meetingId) => ipcRenderer.invoke('poll:list', meetingId),
    vote: (data) => ipcRenderer.invoke('poll:vote', data),
    close: (pollId) => ipcRenderer.invoke('poll:close', pollId)
  },

  // App Settings
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (data) => ipcRenderer.invoke('settings:set', data),
    getAll: () => ipcRenderer.invoke('settings:getAll')
  }
});
