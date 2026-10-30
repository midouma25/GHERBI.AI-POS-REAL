/**
 * scale-bridge.js
 * محرك الاتصال الحي بالميزان الإلكتروني عبر منافذ COM / USB
 * يدعم البث المستمر (Stream)، الاستجواب الدوري (Poll)، التصفير (Zero)، والطارئة (Tare)
 */

'use strict';

const EventEmitter = require('events');
const { parseScaleFrame } = require('./scale-protocols');

let SerialPort = null;
try {
  const spMod = require('serialport');
  SerialPort = spMod.SerialPort || spMod;
} catch (_) {
  // يعمل النظام بأمان حتى لو لم تكن مكتبة serialport مثبتة على الجهاز
}

class ScaleBridge extends EventEmitter {
  constructor() {
    super();
    this.port = null;
    this.pollTimer = null;
    this.buffer = '';
    this.config = {};
    this.state = {
      connected: false,
      portPath: '',
      weight: 0,
      unit: 'kg',
      stable: false,
      stableCount: 0,
      lastRaw: '',
      lastError: null,
      updatedAt: null
    };
  }

  async listPorts() {
    if (!SerialPort || typeof SerialPort.list !== 'function') {
      return [];
    }
    try {
      const ports = await SerialPort.list();
      return (ports || []).map((p) => ({
        path: p.path,
        manufacturer: p.manufacturer || '',
        serialNumber: p.serialNumber || '',
        vendorId: p.vendorId || '',
        productId: p.productId || '',
        friendlyName: p.friendlyName || `${p.path} ${p.manufacturer ? `(${p.manufacturer})` : ''}`.trim()
      }));
    } catch (err) {
      return [];
    }
  }

  getStatus() {
    return { ...this.state };
  }

  _decodeEscapedCmd(cmdStr = '') {
    return String(cmdStr || '')
      .replace(/\\r/g, '\r')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t');
  }

  async start(customConfig = {}) {
    await this.stop();
    this.config = { ...this.config, ...customConfig };

    const portPath = String(this.config.usb_scale_port || this.config.port || '').trim();
    if (!portPath) {
      this.state.lastError = 'port_not_configured';
      this._emitStatus();
      return { ok: false, error: 'لم يتم تحديد منفذ الميزان (COM Port)' };
    }

    if (!SerialPort) {
      this.state.lastError = 'serialport_module_unavailable';
      this._emitStatus();
      return { ok: false, error: 'مكتبة المنفذ التسلسلي غير متوفرة' };
    }

    const baudRate = parseInt(this.config.usb_scale_baud || this.config.baudRate || 9600, 10) || 9600;
    const dataBits = parseInt(this.config.usb_scale_databits || this.config.dataBits || 8, 10) || 8;
    const stopBits = parseFloat(this.config.usb_scale_stopbits || this.config.stopBits || 1) || 1;
    const parity = String(this.config.usb_scale_parity || this.config.parity || 'none').toLowerCase();

    return new Promise((resolve) => {
      try {
        this.port = new SerialPort({
          path: portPath,
          baudRate,
          dataBits,
          stopBits,
          parity: ['none', 'even', 'odd', 'mark', 'space'].includes(parity) ? parity : 'none',
          autoOpen: false
        });

        this.port.on('data', (chunk) => this._handleIncomingChunk(chunk));

        this.port.on('error', (err) => {
          this.state.lastError = err.message;
          this._emitStatus();
        });

        this.port.on('close', () => {
          this.state.connected = false;
          this._clearPollTimer();
          this._emitStatus();
        });

        this.port.open((err) => {
          if (err) {
            this.state.connected = false;
            this.state.lastError = err.message;
            this._emitStatus();
            return resolve({ ok: false, error: err.message });
          }

          this.state.connected = true;
          this.state.portPath = portPath;
          this.state.lastError = null;
          this._emitStatus();

          const mode = String(this.config.usb_scale_mode || 'stream').toLowerCase();
          if (mode === 'poll') {
            const pollMs = Math.max(100, parseInt(this.config.usb_scale_poll_ms || 250, 10) || 250);
            const pollCmd = this._decodeEscapedCmd(this.config.usb_scale_poll_cmd || 'W\r\n');
            this.pollTimer = setInterval(() => {
              this.sendRaw(pollCmd).catch(() => {});
            }, pollMs);
          }

          resolve({ ok: true, status: this.getStatus() });
        });
      } catch (err) {
        this.state.connected = false;
        this.state.lastError = err.message;
        this._emitStatus();
        resolve({ ok: false, error: err.message });
      }
    });
  }

  _handleIncomingChunk(chunk) {
    const text = chunk.toString('ascii');
    this.buffer += text;

    if (this.buffer.length > 2048) {
      this.buffer = this.buffer.slice(-1024);
    }

    const lines = this.buffer.split(/[\r\n\x02\x03]+/);
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      this.state.lastRaw = trimmed;
      this.emit('raw', { raw: trimmed, ts: Date.now() });

      const parsed = parseScaleFrame(trimmed, {
        protocol: this.config.usb_scale_protocol || 'auto',
        customRegex: this.config.usb_scale_custom_regex || '',
        divisor: this.config.usb_scale_divisor || 1,
        unit: this.config.usb_scale_unit || 'kg'
      });

      if (parsed && Number.isFinite(parsed.weight)) {
        const prevWeight = this.state.weight;
        const isSame = Math.abs(parsed.weight - prevWeight) < 0.001;
        this.state.stableCount = isSame ? this.state.stableCount + 1 : 1;

        const reqStableFrames = Math.max(1, parseInt(this.config.usb_scale_stable_frames || 3, 10) || 3);
        this.state.weight = parsed.weight;
        this.state.unit = parsed.unit || 'kg';
        this.state.stable = Boolean(parsed.stable && this.state.stableCount >= reqStableFrames);
        this.state.updatedAt = new Date().toISOString();

        this.emit('reading', this.getStatus());
      }
    }
  }

  _clearPollTimer() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  _emitStatus() {
    this.emit('status', this.getStatus());
  }

  async stop() {
    this._clearPollTimer();
    if (!this.port) {
      this.state.connected = false;
      this._emitStatus();
      return { ok: true };
    }

    return new Promise((resolve) => {
      try {
        if (this.port.isOpen) {
          this.port.close(() => {
            this.port = null;
            this.state.connected = false;
            this._emitStatus();
            resolve({ ok: true });
          });
        } else {
          this.port = null;
          this.state.connected = false;
          this._emitStatus();
          resolve({ ok: true });
        }
      } catch (_) {
        this.port = null;
        this.state.connected = false;
        this._emitStatus();
        resolve({ ok: true });
      }
    });
  }

  async sendRaw(cmdStr) {
    if (!this.port || !this.port.isOpen) {
      return { ok: false, error: 'scale_not_connected' };
    }
    const payload = this._decodeEscapedCmd(cmdStr);
    return new Promise((resolve) => {
      this.port.write(payload, (err) => {
        if (err) return resolve({ ok: false, error: err.message });
        resolve({ ok: true });
      });
    });
  }

  async tare() {
    const cmd = this.config.usb_scale_tare_cmd || 'T\r\n';
    return await this.sendRaw(cmd);
  }

  async zero() {
    const cmd = this.config.usb_scale_zero_cmd || 'Z\r\n';
    return await this.sendRaw(cmd);
  }

  async readOnce() {
    if (!this.state.connected) {
      await this.start(this.config);
    }
    const pollCmd = this.config.usb_scale_poll_cmd || 'W\r\n';
    await this.sendRaw(pollCmd);
    await new Promise((r) => setTimeout(r, 220));
    return this.getStatus();
  }

  async sniff(options = {}) {
    const durationMs = Math.min(10000, Math.max(1000, Number(options.durationMs || 3000)));
    const captured = [];
    const onRaw = (item) => captured.push(item);

    this.on('raw', onRaw);
    await new Promise((r) => setTimeout(r, durationMs));
    this.removeListener('raw', onRaw);

    return { ok: true, frames: captured, status: this.getStatus() };
  }

  async probe(options = {}) {
    if (options.port) {
      await this.start({ ...this.config, usb_scale_port: options.port, ...options });
    }
    return await this.readOnce();
  }
}

module.exports = new ScaleBridge();
module.exports.ScaleBridge = ScaleBridge;