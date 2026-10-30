/**
 * preload-activation.js
 * جسر الربط الخاص بشاشة التفعيل
 */

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('activationAPI', {
  getHWID: () => ipcRenderer.sendSync('get-hwid-sync'),
  activate: (code) => ipcRenderer.invoke('activate-software', code),
  activateOffline: () => ipcRenderer.invoke('activate-software-offline'),
  getStatus: () => ipcRenderer.invoke('get-license-status')
});