// Turntable panel for the badge editor: drives the Badge Turntable app on a
// phone over the LAN. Wire format: Remote-API.md in hamster/badge-turntable.
// Test against that repo's badge-turntable/remote-mock/mock_phone.py.
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  if (!$('tt-panel')) return;

  var API_VERSION = 1;
  var DEFAULT_HOST = 'badge-turntable.local';
  var DEFAULT_PORT = 8737;
  var PROBE_TIMEOUT_MS = 1500;
  var STORE_KEY = 'badges-turntable';
  var ROLE_LABELS = {
    start_stop: 'On / pause', turn_left: 'Turn left', turn_right: 'Turn right', speed_up: 'Speed +', speed_down: 'Speed −',
    continuous_mode: 'Continuous', intermittent_mode: 'Intermittent', step_45: 'Step 45°', step_90: 'Step 90°',
    step_180: 'Step 180°', set_origin: 'Set origin', return_to_origin: 'Back to origin',
  };
  var ANSWER_LABELS = { retry: 'Retry', manual: 'Switch to manual', stop: 'Stop', ready: 'Ready, capture', done: 'Done' };
  function answerLabel(p, a) {
    if (a === 'ready' && p.view && /(^|-)spin$/.test(p.view)) return 'Ready, record';
    return ANSWER_LABELS[a] || a;
  }
  var EXTRA_LABELS = ['Lanyard', 'Add-ons installed', 'Detail', 'Lit up', 'Packaging'];
  var JOB_NAMES = { calibrate: 'Calibration', capture: 'Capture', extra: 'Extra shot', move: 'Move' };
  var SHUTTERS = [1 / 8000, 1 / 4000, 1 / 2000, 1 / 1000, 1 / 500, 1 / 250, 1 / 125, 1 / 60, 1 / 30, 1 / 15, 1 / 8, 1 / 4, 1 / 2, 1];

  // -------------------------------------------------------------------------
  // Remembered state (localStorage)
  // -------------------------------------------------------------------------

  var store = (function () {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { s = {}; }
    return Object.assign({ devices: [], addresses: [], clientName: '', lastDeviceId: null, extraLabel: 'Lanyard',
                           open: false, saveOriginals: false, clearAfter: true }, s);
  })();
  function saveStore() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* private mode */ } }
  function deviceById(id) { return store.devices.find(function (d) { return d.deviceId === id; }) || null; }

  // -------------------------------------------------------------------------
  // HTTP
  // -------------------------------------------------------------------------

  function ApiError(status, body) {
    this.status = status;
    this.code = (body && body.error) || ('http_' + status);
    this.message = (body && body.message) || ('The phone answered HTTP ' + status + '.');
    this.body = body || {};
  }
  ApiError.prototype = Object.create(Error.prototype);

  function isLoopback(host) { return host === 'localhost' || /^127\./.test(host) || host === '::1' || host === '[::1]'; }
  function baseUrl(host, port) {
    var h = host.indexOf(':') >= 0 && host[0] !== '[' ? '[' + host + ']' : host;
    return 'http://' + h + ':' + port;
  }

  // Local Network Access: from an https page, http:// to a LAN device is only
  // exempt from mixed-content blocking when the fetch says where it's going.
  function lnaOptions(host) {
    if (location.protocol !== 'https:') return {};
    return { targetAddressSpace: isLoopback(host) ? 'loopback' : 'local' };
  }

  async function http(host, port, method, path, opts) {
    opts = opts || {};
    var ctrl = new AbortController();
    var timer = opts.timeout ? setTimeout(function () { ctrl.abort(); }, opts.timeout) : null;
    var headers = {};
    if (opts.token) headers.Authorization = 'Bearer ' + opts.token;
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    try {
      var resp = await fetch(baseUrl(host, port) + '/api' + path, Object.assign({
        method: method, headers: headers, cache: 'no-store', signal: ctrl.signal,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      }, lnaOptions(host)));
      if (!resp.ok) {
        var b = null;
        try { b = await resp.json(); } catch (e) { /* not JSON */ }
        throw new ApiError(resp.status, b);
      }
      if (opts.blob) return await resp.blob();
      if (resp.status === 204) return null;
      return await resp.json();
    } catch (e) {
      if (e instanceof ApiError) throw e;
      var timedOut = e && e.name === 'AbortError';
      throw new ApiError(0, { error: timedOut ? 'timeout' : 'network',
                              message: timedOut ? 'The phone didn\'t answer.' : 'Can\'t reach the phone.' });
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  // -------------------------------------------------------------------------
  // Small helpers
  // -------------------------------------------------------------------------

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'text') e.textContent = v;
      else if (k === 'class') e.className = v;
      else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, v);
    });
    (children || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }

  function fmtDeg(v) { return v == null ? '–' : (Math.round(v * 10) / 10).toFixed(1) + '°'; }
  // An angle in [0, 360): 359.97 shows as 0.0°, not 360.0°.
  function fmtAngle(v) { return v == null ? '–' : fmtDeg((Math.round(v * 10) / 10) % 360); }
  // A signed offset, e.g. +3.2° or -0.5°.
  function fmtSigned(v) { return v == null ? '–' : (Math.round(v * 10) > 0 ? '+' : '') + fmtDeg(v); }
  function fmtBytes(n) {
    if (n == null) return '';
    if (n < 1024 * 1024) return Math.max(1, Math.round(n / 1024)) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }
  function fmtShutter(ns) {
    var s = ns / 1e9;
    return s >= 0.5 ? (Math.round(s * 10) / 10) + ' s' : '1/' + Math.round(1 / s) + ' s';
  }
  function ago(iso) {
    if (!iso) return '';
    var s = (Date.now() - Date.parse(iso)) / 1000;
    if (s < 90) return 'just now';
    if (s < 5400) return Math.round(s / 60) + ' min ago';
    if (s < 129600) return Math.round(s / 3600) + ' h ago';
    return Math.round(s / 86400) + ' days ago';
  }
  function delta(a, b) { var d = ((b - a) % 360 + 540) % 360 - 180; return d === -180 ? 180 : d; }
  function defaultClientName() {
    var ua = navigator.userAgent;
    var b = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : 'Browser';
    var p = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'a PC';
    return b + ' on ' + p;
  }

  var noticeTimer = null;
  function notice(text, level) {
    var n = $('tt-notice');
    if (!text) { n.hidden = true; return; }
    n.textContent = text;
    n.className = 'tt-notice' + (level ? ' ' + level : '');
    n.hidden = false;
    clearTimeout(noticeTimer);
    if (level !== 'error') noticeTimer = setTimeout(function () { n.hidden = true; }, 8000);
  }

  // Run a command, showing any error from the phone.
  async function run(fn) {
    try { return await fn(); } catch (e) { notice(e.message || String(e), 'error'); return null; }
  }

  // -------------------------------------------------------------------------
  // Local network permission
  // -------------------------------------------------------------------------

  var lnaStatus = null;

  async function queryLna() {
    if (!navigator.permissions || !navigator.permissions.query) return null;
    var names = ['local-network', 'local-network-access'];
    for (var i = 0; i < names.length; i++) {
      try { return await navigator.permissions.query({ name: names[i] }); } catch (e) { /* unknown name */ }
    }
    return null;
  }

  function renderPerm() {
    var p = $('tt-perm');
    var state = lnaStatus && lnaStatus.state;
    if (state === 'denied' && location.protocol === 'https:') {
      p.innerHTML = '';
      p.appendChild(document.createTextNode('This site isn\'t allowed to reach devices on your local network. Allow it in the site settings (the icon left of the address bar → Site settings → Local network access), then reload.'));
      p.hidden = false;
    } else if (state === 'prompt' && location.protocol === 'https:') {
      p.textContent = 'Click Find phones. The browser will ask to let this site reach devices on your local network: allow it.';
      p.hidden = false;
    } else {
      p.hidden = true;
    }
  }

  // -------------------------------------------------------------------------
  // Finding phones
  // -------------------------------------------------------------------------

  var found = new Map();        // deviceId -> { info, host, port }
  var deadAddresses = new Set(); // "host:port" of added addresses that didn't answer
  var probing = false;
  var probeAgain = false;  // asked for while a probe was running
  var probed = false;

  function candidates() {
    var list = [], seen = new Set();
    function add(host, port, dev) {
      if (!host) return;
      var k = host.toLowerCase() + ':' + port;
      if (seen.has(k)) return;
      seen.add(k);
      list.push({ host: host, port: port, dev: dev });
    }
    store.devices.forEach(function (d) { add(d.host, d.port, d); add(d.lastIp, d.port, d); });
    store.addresses.forEach(function (a) { add(a.host, a.port, null); });
    add(DEFAULT_HOST, DEFAULT_PORT, null);
    return list;
  }

  async function probe() {
    if (probing) { probeAgain = true; return; }
    probing = true;
    probeAgain = false;
    renderDevices();
    var cands = candidates();
    var results = await Promise.all(cands.map(function (c) {
      return http(c.host, c.port, 'GET', '/info', { token: c.dev && c.dev.token, timeout: PROBE_TIMEOUT_MS })
        .then(function (info) { return { c: c, info: info }; }, function (err) { return { c: c, err: err }; });
    }));
    var next = new Map();
    deadAddresses = new Set();
    var paired = {}, refused = {};
    results.forEach(function (r) {
      if (!r.info || !r.info.deviceId) {
        if (!r.c.dev) deadAddresses.add(r.c.host + ':' + r.c.port);
        return;
      }
      var id = r.info.deviceId;
      if (!next.has(id)) next.set(id, { info: r.info, host: r.c.host, port: r.c.port });
      if (r.info.paired === true) paired[id] = true;
      if (r.info.paired === false) refused[id] = true;
    });
    next.forEach(function (f, id) {
      var dev = deviceById(id);
      if (!dev) return;
      dev.name = f.info.name;
      dev.model = f.info.model;
      if (f.info.addresses && f.info.addresses[0]) dev.lastIp = f.info.addresses[0];
      if (refused[id] && !paired[id]) dev.token = null;  // revoked on the phone
    });
    saveStore();
    found = next;
    probing = false;
    probed = true;
    if (probeAgain) { probe(); return; }
    renderDevices();

    // Reconnect to the last phone used, if it's still paired.
    if (!conn && store.lastDeviceId && found.has(store.lastDeviceId)) {
      var dev = deviceById(store.lastDeviceId);
      if (dev && dev.token) connect(store.lastDeviceId);
    }
  }

  function renderDevices() {
    var list = $('tt-device-list');
    list.innerHTML = '';
    $('tt-find').disabled = probing;
    $('tt-find').textContent = probing ? 'Looking…' : 'Find phones';

    var ids = [];
    found.forEach(function (_, id) { ids.push(id); });
    store.devices.forEach(function (d) { if (ids.indexOf(d.deviceId) < 0) ids.push(d.deviceId); });

    ids.forEach(function (id) {
      var f = found.get(id), dev = deviceById(id);
      var name = (f && f.info.name) || (dev && dev.name) || id;
      var model = (f && f.info.model) || (dev && dev.model) || '';
      var where = f ? f.host + ':' + f.port : dev ? dev.host + ':' + dev.port : '';
      var isConn = conn && conn.deviceId === id;
      var state, actions = [];
      if (isConn) {
        state = conn.wsLive ? 'Connected' : conn.offline ? 'Lost contact, reconnecting…' : 'Connecting…';
        actions.push(el('button', { type: 'button', class: 'btn-secondary tt-small', text: 'Disconnect', onclick: function () { disconnect(true); } }));
      } else if (f && f.info.api !== API_VERSION) {
        state = 'Needs a different editor (phone speaks API ' + f.info.api + ', this page ' + API_VERSION + ')';
      } else if (f && dev && dev.token) {
        state = f.info.busy ? 'Paired · busy' : 'Paired';
        actions.push(el('button', { type: 'button', class: 'btn-primary tt-small', text: 'Connect', onclick: function () { connect(id); } }));
      } else if (f) {
        state = 'Not paired';
        actions.push(el('button', { type: 'button', class: 'btn-primary tt-small', text: 'Pair…', onclick: function () { showPair(id); } }));
      } else {
        state = probed ? 'Not found on the network' : 'Not checked yet';
      }
      if (dev) {
        actions.push(el('button', { type: 'button', class: 'btn-secondary tt-small', text: 'Forget', title: 'Forget this phone and its pairing',
                                     onclick: function () { forget(id); } }));
      }
      list.appendChild(el('div', { class: 'tt-device' + (isConn ? ' connected' + (conn.offline ? ' lost' : '') : '') + (f ? '' : ' missing') }, [
        el('span', { class: 'tt-device-name', text: name }),
        el('span', { class: 'tt-device-meta text-muted', text: [model, where].filter(Boolean).join(' · ') }),
        el('span', { class: 'tt-device-state', text: state }),
        el('span', { class: 'tt-device-actions' }, actions),
      ]));
    });

    store.addresses.forEach(function (a, i) {
      var k = a.host + ':' + a.port;
      if (!deadAddresses.has(k)) return;
      list.appendChild(el('div', { class: 'tt-device missing' }, [
        el('span', { class: 'tt-device-name', text: k }),
        el('span', { class: 'tt-device-meta text-muted', text: 'added by address' }),
        el('span', { class: 'tt-device-state', text: 'No answer' }),
        el('span', { class: 'tt-device-actions' }, [
          el('button', { type: 'button', class: 'btn-secondary tt-small', text: 'Remove', onclick: function () {
            store.addresses.splice(i, 1); saveStore(); deadAddresses.delete(k); renderDevices();
          } }),
        ]),
      ]));
    });

    if (!list.children.length) {
      list.appendChild(el('div', { class: 'tt-empty text-muted', text: probing ? 'Looking for phones…' : probed
        ? 'No phones found. On the phone, turn on Settings → Remote control and keep the Capture screen open. If it still doesn\'t appear, add it by the address shown on its Capture screen.'
        : 'Click Find phones.' }));
    }
  }

  async function forget(id) {
    var dev = deviceById(id);
    if (!dev) return;
    if (!confirm('Forget ' + (dev.name || id) + '? You\'ll need to pair again to use it.')) return;
    if (conn && conn.deviceId === id) disconnect(true);
    var f = found.get(id);
    if (dev.token && f) {
      try { await http(f.host, f.port, 'DELETE', '/pair', { token: dev.token, timeout: PROBE_TIMEOUT_MS }); } catch (e) { /* best effort */ }
    }
    store.devices = store.devices.filter(function (d) { return d.deviceId !== id; });
    if (store.lastDeviceId === id) store.lastDeviceId = null;
    saveStore();
    renderDevices();
  }

  // -------------------------------------------------------------------------
  // Pairing
  // -------------------------------------------------------------------------

  var pairingId = null;

  function showPair(id) {
    var f = found.get(id);
    if (!f) return;
    pairingId = id;
    $('tt-pair-name').textContent = f.info.name + (f.info.model ? ' (' + f.info.model + ')' : '');
    $('tt-pair-code').value = '';
    $('tt-client-name').value = store.clientName || defaultClientName();
    $('tt-pair-error').hidden = true;
    $('tt-pair-form').hidden = false;
    $('tt-pair-code').focus();
  }

  async function submitPair(e) {
    e.preventDefault();
    var f = found.get(pairingId);
    if (!f) return;
    var code = $('tt-pair-code').value.replace(/\D/g, '');
    var clientName = $('tt-client-name').value.trim() || defaultClientName();
    var errEl = $('tt-pair-error');
    errEl.hidden = true;
    try {
      var r = await http(f.host, f.port, 'POST', '/pair', { body: { code: code, clientName: clientName } });
      store.clientName = clientName;
      var dev = deviceById(r.deviceId);
      if (!dev) { dev = { deviceId: r.deviceId }; store.devices.push(dev); }
      Object.assign(dev, { name: r.name, model: f.info.model, host: f.host, port: f.port, token: r.token,
                           lastIp: (f.info.addresses && f.info.addresses[0]) || dev.lastIp || null });
      // Remembered by device now; drop the bare address entry.
      store.addresses = store.addresses.filter(function (a) { return !(a.host === f.host && a.port === f.port); });
      saveStore();
      $('tt-pair-form').hidden = true;
      pairingId = null;
      connect(r.deviceId);
    } catch (err) {
      var msg = err.message;
      if (err.code === 'bad_code' && err.body.attemptsLeft != null) msg += ' ' + err.body.attemptsLeft + ' tries left.';
      errEl.textContent = msg;
      errEl.hidden = false;
    }
  }

  // -------------------------------------------------------------------------
  // Connection
  // -------------------------------------------------------------------------

  var conn = null;

  function Conn(id, host, port) {
    this.deviceId = id;
    this.host = host;
    this.port = port;
    this.status = null;
    this.caps = null;
    this.camera = null;
    this.shots = [];
    this.job = null;
    this.ring = null;
    this.ws = null;
    this.wsLive = false;
    this.wanted = true;
    this.backoff = 1000;
    this.thumbs = new Map();  // shot id -> object URL
    this.lastMsgAt = 0;
    this.watchdog = null;
    this.stopWanted = null;   // id of a job to stop once the phone answers again
    this.offline = false;     // lost contact after being connected
  }

  // The phone sends status about every 500 ms, so this much silence means the
  // link is gone even if the socket hasn't noticed (Wi-Fi dropped, phone asleep).
  var SILENCE_MS = 4000;

  Conn.prototype.dev = function () { return deviceById(this.deviceId); };

  Conn.prototype.api = function (method, path, body, timeout) {
    var self = this, dev = this.dev();
    return http(this.host, this.port, method, path, { token: dev && dev.token, body: body, timeout: timeout || 10000 }).catch(function (e) {
      if (e.code === 'unauthorized') unauthorized(self);
      throw e;
    });
  };

  Conn.prototype.blob = function (path) {
    var dev = this.dev();
    return http(this.host, this.port, 'GET', path, { token: dev && dev.token, blob: true });
  };

  Conn.prototype.sync = async function () {
    var r = await Promise.all([this.api('GET', '/status'), this.api('GET', '/camera'), this.api('GET', '/shots'), this.api('GET', '/jobs/current')]);
    this.status = r[0];
    this.caps = r[1].capabilities;
    this.camera = r[1].settings;
    this.shots = r[2].shots;
    this.job = r[3].job;
  };

  Conn.prototype.openWs = function () {
    var self = this, dev = this.dev();
    var ws = new WebSocket(baseUrl(this.host, this.port).replace(/^http/, 'ws') + '/api/live');
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    ws.onopen = function () { ws.send(JSON.stringify({ type: 'auth', token: dev && dev.token })); };
    this.lastMsgAt = Date.now();
    clearInterval(this.watchdog);
    this.watchdog = setInterval(function () {
      if (self.ws !== ws) return;
      if (Date.now() - self.lastMsgAt > SILENCE_MS) self.lost(ws);
    }, 1000);
    ws.onmessage = function (ev) {
      if (self.ws !== ws) return;
      self.lastMsgAt = Date.now();
      if (typeof ev.data === 'string') {
        var m;
        try { m = JSON.parse(ev.data); } catch (e) { return; }
        self.onMessage(m);
      } else {
        onFrame(ev.data);
      }
    };
    ws.onclose = function (ev) {
      if (self.ws !== ws) return;
      if (ev.code === 4401) { self.ws = null; self.wsLive = false; clearInterval(self.watchdog); if (self.wanted) unauthorized(self); return; }
      self.lost(ws);
    };
  };

  // The socket closed or went quiet: show the phone as offline and keep trying.
  Conn.prototype.lost = function (ws) {
    if (this.ws !== ws) return;
    this.ws = null;
    this.wsLive = false;
    this.offline = true;
    clearInterval(this.watchdog);
    try { ws.close(); } catch (e) { /* already closed */ }
    if (!this.wanted) return;
    if (conn === this) {
      $('tt-preview-msg').textContent = 'Lost contact with the phone. Reconnecting…';
      $('tt-preview-msg').classList.add('lost');
      $('tt-preview-msg').hidden = false;
    }
    renderAll();
    var self = this, wait = this.backoff;
    this.backoff = Math.min(this.backoff * 2, 15000);
    setTimeout(function () { if (self.wanted && conn === self) self.reconnect(); }, wait);
  };

  // Stop asked for while the phone was unreachable: send it now, if that job is still going.
  Conn.prototype.sendWantedStop = function () {
    var id = this.stopWanted, self = this;
    this.stopWanted = null;
    if (!id || !jobActive(this.job) || this.job.id !== id) return;
    this.api('DELETE', '/jobs/current').then(function (r) {
      if (conn === self) { self.job = r.job; renderJob(); notice('Stopped the ' + (JOB_NAMES[r.job.kind] || r.job.kind).toLowerCase() + ' now the phone is back.'); }
    }, function (e) {
      if (e.code === 'no_job') return;
      if (e.status === 0 && conn === self) { self.stopWanted = id; renderJob(); return; }
      notice('Couldn\'t stop: ' + e.message, 'error');
    });
  };

  Conn.prototype.reconnect = async function () {
    try {
      await this.sync();
      if (!this.wanted) return;
      this.openWs();
      this.sendWantedStop();
      renderAll();
    } catch (e) {
      if (!this.wanted || e.code === 'unauthorized') return;
      var self = this, wait = this.backoff;
      this.backoff = Math.min(this.backoff * 2, 15000);
      renderAll();
      setTimeout(function () { if (self.wanted && conn === self) self.reconnect(); }, wait);
    }
  };

  Conn.prototype.sendPreview = function () {
    if (!this.ws || this.ws.readyState !== 1) return;
    var enabled = $('tt-panel').open && !document.hidden;
    this.ws.send(JSON.stringify({ type: 'preview', enabled: enabled, fps: 8, width: 640 }));
  };

  Conn.prototype.onMessage = function (m) {
    switch (m.type) {
      case 'hello':
        this.wsLive = true;
        this.offline = false;
        $('tt-preview-msg').textContent = 'Waiting for the preview…';  // hidden again by the next frame
        $('tt-preview-msg').classList.remove('lost');
        this.backoff = 1000;
        this.sendPreview();
        renderDevices();
        renderSummary();
        break;
      case 'status': {
        var prevJob = JSON.stringify(this.job), prevRoles = this.status && this.status.turntable.roles.join();
        delete m.type;
        this.status = m;
        if (m.job) {
          this.job = m.job;
        } else if (jobActive(this.job)) {
          // Missed the job's final message; fetch how it ended.
          var self = this;
          this.api('GET', '/jobs/current').then(function (r) { if (conn === self) { self.job = r.job; renderJob(); } }, function () {});
        }
        if (m.camera && JSON.stringify(m.camera) !== JSON.stringify(this.camera)) { this.camera = m.camera; renderCameraValues(); }
        if (prevRoles !== m.turntable.roles.join()) renderRoles();
        renderStatus();
        if (JSON.stringify(this.job) !== prevJob) renderJob();
        break;
      }
      case 'ring':
        this.ring = m;
        renderAngle();
        updateDial();
        break;
      case 'job':
        this.job = m.job;
        renderJob();
        renderStatus();
        break;
      case 'shot': {
        var i = this.shots.findIndex(function (s) { return s.id === m.shot.id; });
        if (i >= 0) this.shots[i] = m.shot; else this.shots.push(m.shot);
        if (i < 0) refreshShotOrder(this);
        renderShots();
        break;
      }
      case 'shot_removed':
        this.shots = this.shots.filter(function (s) { return s.id !== m.id; });
        if (this.thumbs.has(m.id)) { URL.revokeObjectURL(this.thumbs.get(m.id)); this.thumbs.delete(m.id); }
        renderShots();
        break;
      case 'camera':
        this.camera = m.settings;
        renderCameraValues();
        break;
      case 'countdown':
        showCountdown(m.remainingMs);
        break;
      case 'notice':
        notice(m.text, m.level === 'warn' ? 'warn' : '');
        break;
    }
  };

  Conn.prototype.close = function () {
    this.wanted = false;
    clearInterval(this.watchdog);
    if (this.ws) { try { this.ws.close(1000); } catch (e) { /* already closed */ } this.ws = null; }
    this.thumbs.forEach(function (u) { URL.revokeObjectURL(u); });
    this.thumbs.clear();
  };

  // New shots arrive one at a time; ask the phone for its standard order again.
  var orderTimer = null;
  function refreshShotOrder(c) {
    clearTimeout(orderTimer);
    orderTimer = setTimeout(function () {
      if (conn !== c) return;
      c.api('GET', '/shots').then(function (r) { if (conn === c) { c.shots = r.shots; renderShots(); } }, function () {});
    }, 400);
  }

  async function connect(id) {
    var f = found.get(id), dev = deviceById(id);
    if (!f || !dev || !dev.token) { if (f) showPair(id); return; }
    disconnect(false);
    var c = new Conn(id, f.host, f.port);
    conn = c;
    renderDevices();
    try {
      await c.sync();
    } catch (e) {
      if (conn === c) { conn = null; c.close(); }
      if (e.code !== 'unauthorized') notice('Couldn\'t connect: ' + e.message, 'error');
      renderAll();
      return;
    }
    if (conn !== c) return;
    store.lastDeviceId = id;
    saveStore();
    c.openWs();
    lastBitmap = null;
    $('tt-preview-msg').textContent = 'Waiting for the preview…';
    $('tt-preview-msg').classList.remove('lost');
    $('tt-preview-msg').hidden = false;
    renderCameraControls();
    renderRoles();
    renderAll();
  }

  function disconnect(userAsked) {
    if (!conn) return;
    conn.close();
    conn = null;
    if (userAsked) { store.lastDeviceId = null; saveStore(); }
    hidePrompt();
    renderAll();
  }

  function unauthorized(c) {
    var dev = c.dev();
    if (dev) { dev.token = null; saveStore(); }
    if (conn === c) disconnect(false);
    notice('The phone no longer accepts this browser\'s pairing. Pair again.', 'error');
    if (found.has(c.deviceId)) showPair(c.deviceId);
  }

  // -------------------------------------------------------------------------
  // Preview
  // -------------------------------------------------------------------------

  var pendingFrame = null, decoding = false, lastBitmap = null, lastRot = 0, focusMark = null;

  function onFrame(buf) {
    pendingFrame = buf;
    if (!decoding) decodeFrames();
  }

  async function decodeFrames() {
    decoding = true;
    while (pendingFrame) {
      var buf = pendingFrame;
      pendingFrame = null;
      if (buf.byteLength < 20) continue;
      var dv = new DataView(buf);
      if (dv.getUint32(0) !== 0x42545056) continue;  // "BTPV"
      var rot = dv.getUint8(5) & 3;
      try {
        var bmp = await createImageBitmap(new Blob([new Uint8Array(buf, 16)], { type: 'image/jpeg' }));
        if (lastBitmap && lastBitmap.close) lastBitmap.close();
        lastBitmap = bmp;
        lastRot = rot;
        drawPreview();
      } catch (e) { /* bad frame; skip */ }
    }
    decoding = false;
  }

  function drawPreview() {
    var c = $('tt-preview'), bmp = lastBitmap;
    if (!bmp) return;
    $('tt-preview-msg').hidden = true;
    var odd = lastRot % 2 === 1;
    var w = odd ? bmp.height : bmp.width, h = odd ? bmp.width : bmp.height;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    var ctx = c.getContext('2d');
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(lastRot * Math.PI / 2);
    ctx.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
    ctx.restore();

    var lw = Math.max(1, w / 400);
    if ($('tt-ov-grid').checked) {
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = lw;
      ctx.beginPath();
      [1, 2].forEach(function (i) {
        ctx.moveTo(w * i / 3, 0); ctx.lineTo(w * i / 3, h);
        ctx.moveTo(0, h * i / 3); ctx.lineTo(w, h * i / 3);
      });
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.moveTo(w / 2 - w / 40, h / 2); ctx.lineTo(w / 2 + w / 40, h / 2);
      ctx.moveTo(w / 2, h / 2 - w / 40); ctx.lineTo(w / 2, h / 2 + w / 40);
      ctx.stroke();
    }
    var ring = conn && conn.ring;
    if ($('tt-ov-ring').checked && ring) {
      if (ring.axis) {
        ctx.strokeStyle = 'rgba(57,211,83,0.8)';
        ctx.setLineDash([6 * lw, 4 * lw]);
        ctx.lineWidth = lw * 1.5;
        ctx.beginPath();
        ctx.moveTo(ring.axis.x1 * w, ring.axis.y1 * h);
        ctx.lineTo(ring.axis.x2 * w, ring.axis.y2 * h);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.strokeStyle = 'rgba(57,211,83,0.95)';
      ctx.lineWidth = lw * 1.5;
      (ring.markers || []).forEach(function (m) {
        ctx.strokeRect(m.x * w - 5 * lw, m.y * h - 5 * lw, 10 * lw, 10 * lw);
      });
    }
    // The held focus point, or the click still waiting for the phone's answer.
    var fp = (conn && conn.camera && conn.camera.focusPoint) || (focusMark && performance.now() - focusMark.t < 1500 ? focusMark : null);
    if (fp) {
      ctx.strokeStyle = 'rgba(255,214,10,0.95)';
      ctx.lineWidth = lw * 2;
      ctx.beginPath();
      ctx.arc(fp.x * w, fp.y * h, w / 18, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function previewClick(e) {
    if (!conn || !lastBitmap) return;
    var r = $('tt-preview').getBoundingClientRect();
    var x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    var y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    focusMark = { x: x, y: y, t: performance.now() };
    drawPreview();
    run(function () { return conn.api('POST', '/camera/focus', { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 }); })
      .then(function (r2) { if (r2 && conn) { conn.camera = r2.settings; renderCameraValues(); } });
  }

  var countdownTimer = null;
  function showCountdown(ms) {
    var c = $('tt-countdown');
    clearTimeout(countdownTimer);
    if (!ms || ms <= 0) { c.hidden = true; return; }
    c.textContent = Math.ceil(ms / 1000);
    c.hidden = false;
    countdownTimer = setTimeout(function () { c.hidden = true; }, 1500);
  }

  function renderAngle() {
    var a = $('tt-angle');
    var r = conn && (conn.ring || (conn.status && conn.status.ring));
    if (!r) { a.textContent = ''; return; }
    var markers = Array.isArray(r.markers) ? r.markers.length : r.markers;
    if (!r.ok) {
      a.innerHTML = '';
      a.appendChild(el('span', { class: 'tt-warn', text: 'Ring not seen' }));
      a.appendChild(document.createTextNode(' · is the badge blocking the rim?'));
      return;
    }
    a.textContent = (r.frontDeg != null ? 'Front ' + fmtSigned(r.frontDeg) + ' · ' : '') +
      (r.tableDeg != null ? 'Table ' + fmtAngle(r.tableDeg) + ' · ' : '') + 'ring ' + fmtAngle(r.ringDeg) +
      ' · ' + markers + ' markers' + (r.tableDeg == null ? ' · not calibrated' : '');
  }

  // -------------------------------------------------------------------------
  // Camera controls
  // -------------------------------------------------------------------------

  function cameraRow(label, controls, key) {
    return el('div', { class: 'tt-cam-row', 'data-row': key }, [el('span', { class: 'tt-cam-label', text: label })].concat(controls));
  }

  function holdBox(key, title) {
    return el('label', { class: 'tt-inline', title: title }, [el('input', { type: 'checkbox', 'data-key': key }), ' Hold']);
  }

  // The everyday controls (lens, zoom, brightness, focus point) sit under the
  // preview; modes and holds are folded into "More camera settings".
  function renderCameraControls() {
    var box = $('tt-camera');
    box.innerHTML = '';
    if (!conn || !conn.caps) return;
    var caps = conn.caps;
    var manualOk = !!(caps.iso && caps.shutterNs);

    if (caps.lenses.length > 1) {
      var lens = el('select', { 'data-key': 'lens' }, caps.lenses.map(function (l) {
        return el('option', { value: l.id, text: l.label + ' · ' + l.focalLengthMm + ' mm' + (l.minFocusCm ? ' · ≥' + l.minFocusCm + ' cm' : '') });
      }));
      box.appendChild(cameraRow('Lens', [lens], 'lens'));
    }

    box.appendChild(cameraRow('Zoom', [
      el('input', { type: 'range', 'data-key': 'zoom', min: caps.zoom.min, max: caps.zoom.max, step: 0.1 }),
      el('output', { 'data-out': 'zoom' }),
    ], 'zoom'));

    var ev = cameraRow('Brightness', [
      el('input', { type: 'range', 'data-key': 'ev', min: caps.ev.min, max: caps.ev.max, step: 1 }),
      el('output', { 'data-out': 'ev' }),
    ], 'ev');
    ev.title = 'Exposure stays automatic; this nudges it brighter or darker (exposure compensation)';
    box.appendChild(ev);
    box.appendChild(cameraRow('Exposure', [el('span', { class: 'tt-cam-note', 'data-note': 'manual' })], 'manualNote'));

    box.appendChild(el('div', { class: 'tt-focus-line', 'data-row': 'focusLine' }, [
      el('span', { class: 'tt-cam-label', text: 'Focus' }),
      el('span', { class: 'tt-cam-note', 'data-note': 'focus' }),
      el('button', { type: 'button', class: 'btn-secondary tt-small', 'data-act': 'focus-clear', text: 'Back to auto',
        title: 'Forget the spot you clicked; focus follows the picture again',
        onclick: function () { clearFocusPoint(); } }),
    ]));

    var more = el('details', { class: 'tt-cam-more' });
    more.open = !!store.cameraMore;
    more.addEventListener('toggle', function () { store.cameraMore = more.open; saveStore(); });
    more.appendChild(el('summary', { text: 'More camera settings' }));
    var grid = el('div', { class: 'tt-cam-grid' });
    more.appendChild(grid);

    var expModes = [el('option', { value: 'auto', text: 'Automatic' })];
    if (manualOk) expModes.push(el('option', { value: 'manual', text: 'Manual (ISO and shutter)' }));
    grid.appendChild(cameraRow('Exposure', [
      el('select', { 'data-key': 'exposureMode' }, expModes),
      holdBox('aeLock', 'Keep the exposure as it is now instead of adjusting as the picture changes'),
    ], 'exposureMode'));
    if (manualOk) {
      grid.appendChild(cameraRow('ISO', [
        el('input', { type: 'range', 'data-key': 'iso', min: caps.iso.min, max: caps.iso.max, step: 50 }),
        el('output', { 'data-out': 'iso' }),
      ], 'iso'));
      var shutters = SHUTTERS.map(function (v) { return Math.round(v * 1e9); })
        .filter(function (ns) { return ns >= caps.shutterNs.min && ns <= caps.shutterNs.max; });
      grid.appendChild(cameraRow('Shutter', [
        el('select', { 'data-key': 'shutterNs' }, shutters.map(function (ns) { return el('option', { value: ns, text: fmtShutter(ns) }); })),
      ], 'shutterNs'));
    }

    var focusModes = [el('option', { value: 'auto', text: 'Automatic' })];
    if (caps.focusDiopters) focusModes.push(el('option', { value: 'manual', text: 'Manual distance' }));
    grid.appendChild(cameraRow('Focus', [
      el('select', { 'data-key': 'focusMode' }, focusModes),
      holdBox('afLock', 'Keep the focus where it is now'),
    ], 'focusMode'));
    if (caps.focusDiopters) {
      grid.appendChild(cameraRow('Distance', [
        el('input', { type: 'range', 'data-key': 'focusDiopters', min: caps.focusDiopters.min, max: caps.focusDiopters.max, step: 0.05 }),
        el('output', { 'data-out': 'focusDiopters' }),
      ], 'focusDiopters'));
    }

    grid.appendChild(cameraRow('White bal.', [
      el('select', { 'data-key': 'whiteBalance' }, caps.whiteBalance.map(function (w) {
        return el('option', { value: w, text: w === 'kelvin' ? 'Kelvin' : w === 'auto' ? 'Automatic' : w[0].toUpperCase() + w.slice(1) });
      })),
      holdBox('awbLock', 'Keep the colour balance as it is now'),
    ], 'whiteBalance'));
    if (caps.kelvin) {
      grid.appendChild(cameraRow('Kelvin', [
        el('input', { type: 'range', 'data-key': 'kelvin', min: caps.kelvin.min, max: caps.kelvin.max, step: 50 }),
        el('output', { 'data-out': 'kelvin' }),
      ], 'kelvin'));
    }
    grid.appendChild(el('p', { class: 'tt-cam-help', text: 'Captures hold exposure, focus and white balance themselves while they run, so all the views match.' }));
    box.appendChild(more);

    box.querySelectorAll('[data-key]').forEach(function (input) {
      var key = input.getAttribute('data-key');
      input.addEventListener('input', function () { updateOutputs(key, readControl(input)); });
      input.addEventListener('change', function () {
        var patch = {};
        patch[key] = readControl(input);
        setCamera(patch);
      });
    });
    renderCameraValues();
  }

  function clearFocusPoint() {
    if (!conn) return;
    focusMark = null;
    run(function () { return conn.api('POST', '/camera/focus', { clear: true }); })
      .then(function (r) { if (r && conn) { conn.camera = r.settings; renderCameraValues(); drawPreview(); } });
  }

  function readControl(input) {
    var key = input.getAttribute('data-key');
    if (input.type === 'checkbox') return input.checked;
    if (key === 'lens' || key === 'exposureMode' || key === 'focusMode' || key === 'whiteBalance') return input.value;
    if (key === 'zoom' || key === 'focusDiopters') return parseFloat(input.value);
    return parseInt(input.value, 10);
  }

  function updateOutputs(key, v) {
    var out = $('tt-camera').querySelector('[data-out="' + key + '"]');
    if (!out) return;
    if (key === 'zoom') out.textContent = v.toFixed(1) + '×';
    else if (key === 'ev') out.textContent = (v >= 0 ? '+' : '') + (v * conn.caps.ev.stepEv).toFixed(1) + ' EV';
    else if (key === 'iso') out.textContent = v;
    else if (key === 'kelvin') out.textContent = v + ' K';
    else if (key === 'focusDiopters') out.textContent = v <= 0.01 ? '∞' : (100 / v < 100 ? (100 / v).toFixed(1) + ' cm' : (1 / v).toFixed(2) + ' m');
  }

  function renderCameraValues() {
    if (!conn || !conn.camera) return;
    var s = conn.camera, box = $('tt-camera');
    box.querySelectorAll('[data-key]').forEach(function (input) {
      var key = input.getAttribute('data-key');
      if (s[key] === undefined) return;
      if (document.activeElement === input && input.type === 'range') return;  // don't fight a drag
      if (input.type === 'checkbox') input.checked = !!s[key];
      else {
        if (key === 'shutterNs' && !input.querySelector('option[value="' + s[key] + '"]')) {
          input.appendChild(el('option', { value: s[key], text: fmtShutter(s[key]) }));
        }
        input.value = s[key];
      }
      updateOutputs(key, s[key]);
    });
    var show = function (key, on) { var r = box.querySelector('[data-row="' + key + '"]'); if (r) r.hidden = !on; };
    var note = function (key, text) { var n = box.querySelector('[data-note="' + key + '"]'); if (n) n.textContent = text; };
    if (s.exposureMode === 'manual') note('manual', 'Manual: ISO ' + s.iso + (s.shutterNs ? ' · ' + fmtShutter(s.shutterNs) : '') + ' (More camera settings)');
    show('manualNote', s.exposureMode === 'manual');
    var fp = s.focusPoint;
    note('focus', s.focusMode === 'manual' ? 'Manual distance (More camera settings)'
      : s.afLock ? 'Held where it was (More camera settings)'
      : fp ? 'On the spot you clicked (yellow ring)'
      : 'Automatic. Click the picture to focus on a spot, e.g. for a detail shot.');
    var clr = box.querySelector('[data-act="focus-clear"]');
    if (clr) clr.hidden = !fp;
    show('ev', s.exposureMode !== 'manual');
    show('iso', s.exposureMode === 'manual');
    show('shutterNs', s.exposureMode === 'manual');
    show('focusDiopters', s.focusMode === 'manual');
    show('kelvin', s.whiteBalance === 'kelvin');
  }

  async function setCamera(patch) {
    if (!conn) return;
    var c = conn;
    try {
      var r = await c.api('POST', '/camera', patch);
      c.camera = r.settings;
      if ('lens' in patch) {
        var cam = await c.api('GET', '/camera');
        c.caps = cam.capabilities;
        c.camera = cam.settings;
        renderCameraControls();
      }
    } catch (e) {
      notice(e.message, 'error');
    }
    renderCameraValues();
  }

  // -------------------------------------------------------------------------
  // Status, turntable and capture controls
  // -------------------------------------------------------------------------

  function jobActive(j) { return !!(j && (j.state === 'running' || j.state === 'waiting')); }
  function calibrated() { return !!(conn && conn.status && conn.status.calibration.state === 'valid'); }
  function hasRole(role) { return !!(conn && conn.status && conn.status.turntable.roles.indexOf(role) >= 0); }

  function renderRoles() {
    var box = $('tt-roles');
    box.innerHTML = '';
    if (!conn || !conn.status) return;
    var t = conn.status.turntable;
    if (!t.irAvailable) { box.appendChild(el('span', { class: 'text-muted', text: 'No IR on this phone or profile.' })); return; }
    t.roles.forEach(function (role) {
      box.appendChild(el('button', { type: 'button', class: 'btn-secondary tt-small', 'data-role': role, text: ROLE_LABELS[role] || role,
        onclick: function () { run(function () { return conn.api('POST', '/turntable/press', { role: role }); }); } }));
    });
  }

  function renderStatus() {
    var st = conn && conn.status;
    if (!st) return;
    var cal = st.calibration, calEl = $('tt-cal');
    calEl.innerHTML = '';
    var profile = el('div', { class: 'text-muted', text: st.turntable.profileName });
    if (cal.state === 'valid') {
      calEl.appendChild(el('div', { text: 'Calibrated ' + ago(cal.calibratedAt) + ' · ' + cal.degPerSec.toFixed(1) + '°/s' +
        (cal.step90Deg != null ? ' · step ' + fmtDeg(cal.step90Deg) : '') }));
    } else if (cal.state === 'stale') {
      calEl.appendChild(el('div', { class: 'tt-warn', text: 'Calibration out of date' + (cal.reason ? ': ' + cal.reason : '') + '. Calibrate again.' }));
    } else {
      calEl.appendChild(el('div', { class: 'tt-warn', text: 'Not calibrated. Auto capture and checked moves need it.' }));
    }
    var front = st.turntable.frontRingDeg;
    calEl.appendChild(el('div', { class: 'text-muted', text: front != null ? 'Front set at ring ' + fmtAngle(front)
      : 'No front set: captures start wherever the table is' }));
    calEl.appendChild(profile);

    var busy = jobActive(conn.job) || conn.offline;
    var ir = st.turntable.irAvailable;
    $('tt-calibrate').disabled = busy || !ir;
    $('tt-step').disabled = busy || !(calibrated() || hasRole('step_90'));
    $('tt-step').title = calibrated() ? 'Move 90° and check it against the ring' : 'Press the step button (unchecked: not calibrated)';
    $('tt-home').disabled = busy || !(calibrated() || hasRole('return_to_origin'));
    $('tt-goto').querySelector('button').disabled = busy || !calibrated();
    $('tt-front').disabled = busy;
    $('tt-roles').querySelectorAll('button').forEach(function (b) { b.disabled = busy; });
    $('tt-extra').disabled = busy;
    renderCaptureButtons(busy, ir);
    var camLocked = conn.offline || (busy && conn.job.kind !== 'move');
    $('tt-camera').disabled = camLocked;
    $('tt-camera').title = conn.offline ? 'Can\'t reach the phone' : camLocked ? 'Camera settings are locked while a sequence runs' : '';
    if (!conn.ring) renderAngle();
    renderSummary();
  }

  // Auto capture only appears when the phone can drive the table (IR), and
  // only works once it's calibrated. Both, Stills and Spin are by hand: the
  // phone's prompts say what to do with the table.
  function renderCaptureButtons(busy, ir) {
    var autoBtn = $('tt-auto-capture'), hint = $('tt-capture-hint');
    autoBtn.hidden = !ir;
    autoBtn.disabled = busy || !calibrated();
    autoBtn.title = calibrated() ? 'The phone turns the table: four stills, then the spin' : 'Calibrate the turntable first';
    $('tt-capture-both').disabled = busy;
    $('tt-capture-stills').disabled = busy;
    $('tt-capture-spin').disabled = busy;
    var setLabel = selectedSet();
    var where = setLabel ? ' Shots go in the extra set "' + setLabel + '".' : '';
    var byHand = 'you work the table, following the phone\'s instructions (start it turning and stop it when told, or turn it to each view, depending on the phone\'s capture method).';
    if (!ir) {
      hint.textContent = 'This phone can\'t drive the turntable, so ' + byHand + where;
    } else if (!calibrated()) {
      hint.textContent = 'Auto capture needs the turntable calibrated (Calibrate, above). Until then, use the other buttons: ' + byHand + where;
    } else {
      hint.textContent = 'Auto capture: the phone turns the table for the four stills (front, 90°, back, 270°), then records the spin. With the other buttons, ' + byHand + where;
    }
  }

  function selectedSet() {
    return $('tt-set-extra').checked ? $('tt-set-label').value.trim() || null : null;
  }

  function startCapture(kind) {
    var setLabel = null;
    if ($('tt-set-extra').checked) {
      setLabel = $('tt-set-label').value.trim();
      if (!setLabel) { notice('Give the extra set a label, e.g. "With SAOs installed", or choose Main views.', 'error'); $('tt-set-label').focus(); return; }
    }
    var body = kind === 'auto' ? { stills: true, video: true, auto: true }
      : kind === 'both' ? { stills: true, video: true, auto: false }
      : kind === 'stills' ? { stills: true, video: false, auto: false }
      : { stills: false, video: true, auto: false };
    body.setLabel = setLabel;
    startJob('/capture', body);
  }

  var lastFinished = null;

  function renderJob() {
    var j = conn && conn.job, box = $('tt-job');
    var active = jobActive(j);
    var offline = !!(conn && conn.offline);
    var stopHeld = !!(active && conn.stopWanted === j.id);
    var stop = $('tt-stop');
    stop.hidden = !active;
    stop.disabled = stopHeld;
    stop.textContent = stopHeld ? '■ Stop requested' : '■ Stop';
    stop.title = stopHeld ? 'Sent as soon as the phone answers again' : '';
    if (!j) { box.hidden = true; hidePrompt(); renderSummary(); return; }
    box.hidden = false;
    box.className = 'tt-job ' + j.state + (offline && active ? ' offline' : '');
    var name = JOB_NAMES[j.kind] || j.kind;
    var text;
    if (active && offline) {
      text = 'Lost contact with the phone during the ' + name.toLowerCase() + ' (last: ' + (j.progress && j.progress.text ? j.progress.text : name + '…') + '). ' +
             'It carries on there, and Stop on the phone works. ' +
             (stopHeld ? 'Your stop will be sent as soon as the phone answers again.' : 'Stop here is sent once the phone answers again.');
    }
    else if (active) text = j.progress && j.progress.text ? j.progress.text : name + '…';
    else if (j.state === 'done') text = name + ' done' + (j.result && j.result.complete === false ? ' (stopped early; the shots taken are kept)' : '') + '.';
    else if (j.state === 'aborted') text = name + ' stopped.';
    else text = name + ' failed: ' + (j.error ? j.error.message : 'unknown error');
    $('tt-job-text').textContent = text;
    var bar = $('tt-job-progress');
    bar.hidden = !active;
    if (active && j.progress && j.progress.step != null && j.progress.of) {
      bar.max = j.progress.of;
      bar.value = j.progress.step - (j.state === 'running' ? 0.5 : 0);
    } else {
      bar.removeAttribute('value');
    }
    if (j.state === 'waiting' && j.prompt && !offline) showPrompt(j.prompt); else hidePrompt();

    if (!active && lastFinished !== j.id + j.state) {
      lastFinished = j.id + j.state;
      if (j.state === 'done' && j.kind === 'calibrate') refreshStatus();
    }
    renderStatus();
  }

  function refreshStatus() {
    var c = conn;
    if (!c) return;
    c.api('GET', '/status').then(function (s) { if (conn === c) { c.status = s; renderStatus(); } }, function () {});
  }

  function renderSummary() {
    var s = $('tt-summary-status');
    if (!conn) { s.textContent = found.size ? found.size + ' phone' + (found.size > 1 ? 's' : '') + ' found' : 'Not connected'; s.className = 'tt-summary-status'; return; }
    var dev = conn.dev();
    var parts = [(dev && dev.name) || 'phone'];
    if (conn.offline) parts.push('lost contact, reconnecting…');
    else if (!conn.wsLive) parts.push('connecting…');
    var j = conn.job;
    if (jobActive(j)) {
      var p = j.progress || {};
      parts.push((JOB_NAMES[j.kind] || j.kind) + (p.step != null && p.of ? ' ' + p.step + '/' + p.of : '') + (j.state === 'waiting' ? ' · waiting for you' : ''));
    }
    if (conn.shots.length) parts.push(conn.shots.length + ' shot' + (conn.shots.length > 1 ? 's' : '') + ' on the phone');
    s.textContent = parts.join(' · ');
    s.className = 'tt-summary-status connected' + (conn.offline ? ' lost' : j && j.state === 'waiting' ? ' waiting' : '');
  }

  function startJob(path, body) {
    return run(async function () {
      var r = await conn.api('POST', path, body);
      conn.job = r.job;
      renderJob();
      return r;
    });
  }

  async function stopJob() {
    var c = conn;
    if (!c || !c.job) return;
    if (c.offline) { c.stopWanted = c.job.id; renderJob(); return; }
    try {
      var r = await c.api('DELETE', '/jobs/current', undefined, 4000);
      if (conn === c) { c.job = r.job; renderJob(); }
    } catch (e) {
      if (e.code === 'no_job') { if (conn === c) c.api('GET', '/jobs/current').then(function (r) { if (conn === c) { c.job = r.job; renderJob(); } }, function () {}); return; }
      if (e.status !== 0) { notice(e.message, 'error'); return; }
      // Can't reach the phone: hold the stop and send it when it's back.
      if (conn !== c) return;
      c.stopWanted = c.job.id;
      if (c.ws) c.lost(c.ws); else renderAll();
    }
  }

  function renderChips() {
    var box = $('tt-chips');
    box.innerHTML = '';
    var labels = EXTRA_LABELS.concat(['Other…']);
    var current = store.extraLabel || 'Lanyard';
    var isOther = EXTRA_LABELS.indexOf(current) < 0;
    labels.forEach(function (l) {
      var on = l === 'Other…' ? isOther : l === current;
      box.appendChild(el('button', { type: 'button', class: 'tt-chip' + (on ? ' active' : ''), text: l, onclick: function () {
        if (l === 'Other…') {
          store.extraLabel = $('tt-extra-other').value.trim() || '';
          $('tt-extra-other').hidden = false;
          $('tt-extra-other').focus();
        } else {
          store.extraLabel = l;
        }
        saveStore();
        renderChips();
      } }));
    });
    $('tt-extra-other').hidden = !isOther;
    if (isOther && document.activeElement !== $('tt-extra-other')) $('tt-extra-other').value = current;
  }

  // -------------------------------------------------------------------------
  // Prompts
  // -------------------------------------------------------------------------

  var promptShown = null;

  function showPrompt(p) {
    var dlg = $('tt-prompt');
    if (promptShown !== p.id) {
      promptShown = p.id;
      $('tt-prompt-text').textContent = p.text;
      var answers = $('tt-prompt-answers');
      answers.innerHTML = '';
      p.answers.forEach(function (a) {
        answers.appendChild(el('button', { type: 'button', class: a === 'stop' ? 'btn-secondary' : 'btn-primary', text: answerLabel(p, a),
          onclick: function () { answerPrompt(p.id, a); } }));
      });
      $('tt-prompt-dial').hidden = p.targetTableDeg == null;
      if (!dlg.open) dlg.show();
    }
    updateDial();
  }

  function hidePrompt() {
    promptShown = null;
    var dlg = $('tt-prompt');
    if (dlg.open) dlg.close();
  }

  async function answerPrompt(promptId, answer) {
    if (!conn) return;
    $('tt-prompt-answers').querySelectorAll('button').forEach(function (b) { b.disabled = true; });
    try {
      var r = await conn.api('POST', '/jobs/current/answer', { promptId: promptId, answer: answer });
      conn.job = r.job;
    } catch (e) {
      if (e.code !== 'prompt_gone' && e.code !== 'no_job') notice(e.message, 'error');
    }
    hidePrompt();
    renderJob();
  }

  function updateDial() {
    if (!promptShown || !conn || !conn.job || !conn.job.prompt) return;
    var p = conn.job.prompt, box = $('tt-prompt-dial');
    if (p.targetTableDeg == null) return;
    var r = conn.ring, cur = r && r.ok ? r.tableDeg : null;
    var tol = p.toleranceDeg || 2;
    var d = cur == null ? null : delta(p.targetTableDeg, cur);
    var ok = d != null && Math.abs(d) <= tol;
    var hand = function (deg, len) {
      var a = (deg - p.targetTableDeg) * Math.PI / 180;  // target at the top
      return { x: 50 + Math.sin(a) * len, y: 50 - Math.cos(a) * len };
    };
    var t = hand(p.targetTableDeg, 40);
    var svg = '<svg viewBox="0 0 100 100" width="96" height="96"><circle cx="50" cy="50" r="44" fill="none" stroke="#30363d" stroke-width="3"/>' +
      '<line x1="50" y1="50" x2="' + t.x + '" y2="' + t.y + '" stroke="#39d353" stroke-width="3" stroke-dasharray="5 3"/>';
    if (cur != null) {
      var c = hand(cur, 36);
      svg += '<line x1="50" y1="50" x2="' + c.x + '" y2="' + c.y + '" stroke="' + (ok ? '#39d353' : '#f0b429') + '" stroke-width="5" stroke-linecap="round"/>';
    }
    svg += '<circle cx="50" cy="50" r="4" fill="#e6edf3"/></svg>';
    var text = cur == null ? 'Ring not seen' : 'Now ' + fmtAngle(cur) + ' · target ' + fmtAngle(p.targetTableDeg) + ' · ' +
      (ok ? 'on target' : (d > 0 ? 'turn back ' : 'turn forward ') + fmtDeg(Math.abs(d)));
    box.innerHTML = svg + '<div class="' + (ok ? 'tt-ok' : 'tt-warn') + '">' + text + '</div>';
  }

  // -------------------------------------------------------------------------
  // Shots
  // -------------------------------------------------------------------------

  function shotsInBadge() {
    var ids = new Set();
    if (!window.BadgeEditor) return ids;
    var m = window.BadgeEditor.getMedia();
    m.images.concat(m.videos).forEach(function (x) { if (x.tt) ids.add(x.tt.shotId); });
    return ids;
  }

  function renderShots() {
    var list = $('tt-shot-list');
    list.innerHTML = '';
    var shots = conn ? conn.shots : [];
    var bytes = shots.reduce(function (n, s) { return n + ((s.web && s.web.bytes) || 0); }, 0);
    $('tt-shots-count').textContent = shots.length ? shots.length + ' · ' + fmtBytes(bytes) : 'none yet';
    $('tt-add-all').disabled = !shots.length;
    $('tt-clear-all').disabled = !shots.length;
    var inBadge = shotsInBadge();
    shots.forEach(function (s) {
      var img = el('img', { alt: '', loading: 'lazy' });
      loadThumb(s, img);
      var meta = [s.filename];
      if (s.actualDeg != null) meta.push(fmtDeg(s.actualDeg));
      if (s.web && s.web.bytes) meta.push(fmtBytes(s.web.bytes));
      var added = inBadge.has(s.id);
      list.appendChild(el('div', { class: 'tt-shot' + (added ? ' added' : '') + (s.ready ? '' : ' pending'), title: s.caption }, [
        el('div', { class: 'tt-shot-thumb' }, [img, s.kind === 'spin' ? el('span', { class: 'tt-shot-play', text: '▶' }) : null]),
        el('div', { class: 'tt-shot-caption', text: s.caption || s.filename }),
        el('div', { class: 'tt-shot-meta text-muted', text: meta.join(' · ') }),
        el('div', { class: 'tt-shot-actions' }, [
          s.ready
            ? el('button', { type: 'button', class: 'btn-secondary tt-small', text: added ? '✓ In badge' : '+ Add', title: added ? 'Add again (replaces it)' : 'Add to the badge',
                             onclick: function () { addShots([s]); } })
            : el('span', { class: 'text-muted', text: 'Encoding…' }),
          el('button', { type: 'button', class: 'btn-secondary tt-small', text: '✕', title: 'Delete from the phone',
                         onclick: function () { deleteShot(s); } }),
        ]),
      ]));
    });
    renderSummary();
  }

  function loadThumb(s, img) {
    var c = conn;
    if (!c) return;
    if (c.thumbs.has(s.id)) { img.src = c.thumbs.get(s.id); return; }
    c.blob('/shots/' + encodeURIComponent(s.id) + '?variant=thumb').then(function (b) {
      if (conn !== c) return;
      var url = URL.createObjectURL(b);
      c.thumbs.set(s.id, url);
      img.src = url;
    }, function () { /* leave blank */ });
  }

  async function addShots(shots) {
    if (!conn || !window.BadgeEditor) return;
    if (!window.BadgeEditor.isRepoOpen()) { notice('Open the repo first.', 'error'); return; }
    var c = conn, ready = shots.filter(function (s) { return s.ready; }), items = [];
    var btn = $('tt-add-all');
    btn.disabled = true;
    try {
      for (var i = 0; i < ready.length; i++) {
        var s = ready[i];
        notice('Downloading ' + (i + 1) + ' of ' + ready.length + ': ' + s.filename + '…');
        var blob = await c.blob('/shots/' + encodeURIComponent(s.id));
        var file = new File([blob], s.filename, { type: (s.web && s.web.mime) || blob.type });
        items.push({
          kind: s.kind === 'spin' ? 'video' : 'image', file: file, filename: s.filename, caption: s.caption,
          highlight: s.kind === 'view' && !s.setLabel && s.view === 'front',
          tt: { deviceId: c.deviceId, shotId: s.id, kind: s.kind, saved: false },
        });
      }
    } catch (e) {
      notice('Download failed: ' + e.message, 'error');
      btn.disabled = false;
      if (!items.length) return;
    }
    window.BadgeEditor.addMedia(items);
    var skipped = shots.length - ready.length;
    notice('Added ' + items.length + ' to the badge\'s photos & video' + (skipped ? '. ' + skipped + ' still encoding, add later.' : '.'));
    btn.disabled = false;
    renderShots();
  }

  async function deleteShot(s) {
    if (!confirm('Delete ' + s.filename + ' from the phone?')) return;
    var r = await run(function () { return conn.api('DELETE', '/shots/' + encodeURIComponent(s.id)).then(function () { return true; }); });
    if (r && conn) { conn.shots = conn.shots.filter(function (x) { return x.id !== s.id; }); renderShots(); }
  }

  async function deleteAllShots() {
    var inBadge = shotsInBadge(), notAdded = conn.shots.filter(function (s) { return !inBadge.has(s.id); }).length;
    var msg = 'Delete all ' + conn.shots.length + ' shots from the phone?' + (notAdded ? ' ' + notAdded + ' of them haven\'t been added to the badge.' : '');
    if (!confirm(msg)) return;
    var r = await run(function () { return conn.api('DELETE', '/shots'); });
    if (r && conn) { conn.shots = []; renderShots(); }
  }

  // -------------------------------------------------------------------------
  // Saving: originals to _capture/, and clearing the phone
  // -------------------------------------------------------------------------

  function pendingTtItems(images, videos) {
    return images.concat(videos).filter(function (x) { return x.tt && !x.tt.saved; });
  }

  function renderSaveOptions() {
    if (!window.BadgeEditor) return;
    var m = window.BadgeEditor.getMedia();
    $('tt-save-options').hidden = !pendingTtItems(m.images, m.videos).length;
    if (conn) renderShotsBadgeState();
  }

  // Cheap refresh of the "✓ In badge" marks when the media list changes.
  var lastInBadge = '';
  function renderShotsBadgeState() {
    var key = Array.from(shotsInBadge()).sort().join();
    if (key !== lastInBadge) { lastInBadge = key; renderShots(); }
  }

  async function writeFile(dir, name, data) {
    var h = await dir.getFileHandle(name, { create: true });
    var w = await h.createWritable();
    await w.write(data);
    await w.close();
  }

  async function afterSave(ctx) {
    var items = pendingTtItems(ctx.images, ctx.videos);
    if (!items.length) return null;
    var saveOriginals = $('tt-save-originals').checked, clearAfter = $('tt-clear-after').checked;
    items.forEach(function (x) { x.tt.saved = true; });
    if (!saveOriginals && !clearAfter) return null;
    var c = conn && conn.deviceId === items[0].tt.deviceId ? conn : null;
    if (!c) {
      return 'The phone isn\'t connected, so ' + (saveOriginals ? 'the originals weren\'t saved' : '') +
        (saveOriginals && clearAfter ? ' and ' : '') + (clearAfter ? 'the shots are still on it' : '') + '.';
    }
    var msgs = [];
    if (saveOriginals) {
      var dir = await ctx.repoDir.getDirectoryHandle('_capture', { create: true });
      dir = await dir.getDirectoryHandle(ctx.con, { create: true });
      dir = await dir.getDirectoryHandle(ctx.slug, { create: true });
      var orig = await dir.getDirectoryHandle('originals', { create: true });
      var n = 0, failed = [];
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var name = it.tt.kind === 'spin' ? it.filename.replace(/\.[^.]+$/, '') + '-source.mp4' : it.filename;
        try {
          setSaveStatus('Saving originals ' + (i + 1) + ' of ' + items.length + '…');
          await writeFile(orig, name, await c.blob('/shots/' + encodeURIComponent(it.tt.shotId) + '?variant=original'));
          n++;
        } catch (e) {
          failed.push(it.filename + ' (' + e.message + ')');
        }
      }
      try {
        await writeFile(dir, 'session.json', JSON.stringify(await c.api('GET', '/session.json'), null, 2) + '\n');
      } catch (e) {
        failed.push('session.json (' + e.message + ')');
      }
      msgs.push('Wrote ' + n + ' original' + (n === 1 ? '' : 's') + ' and session.json to _capture/' + ctx.con + '/' + ctx.slug + '/.');
      if (failed.length) {
        msgs.push('Couldn\'t save: ' + failed.join(', ') + '. Those shots were left on the phone.');
        if (clearAfter) items = items.filter(function (x) { return !failed.some(function (f) { return f.indexOf(x.filename + ' ') === 0; }); });
      }
    }
    if (clearAfter) {
      var removed = 0;
      for (var j = 0; j < items.length; j++) {
        try {
          await c.api('DELETE', '/shots/' + encodeURIComponent(items[j].tt.shotId));
          removed++;
        } catch (e) {
          if (e.code === 'not_found') removed++;
        }
      }
      c.shots = c.shots.filter(function (s) { return !items.some(function (x) { return x.tt.shotId === s.id; }); });
      renderShots();
      msgs.push('Removed ' + removed + ' shot' + (removed === 1 ? '' : 's') + ' from the phone.');
    }
    return msgs.join(' ');
  }

  function setSaveStatus(text) {
    var s = $('save-status');
    if (s) { s.textContent = text; s.className = 'save-status'; }
  }

  // -------------------------------------------------------------------------
  // Wiring
  // -------------------------------------------------------------------------

  function renderAll() {
    var connected = !!conn;
    $('tt-connected').hidden = !connected;
    if (connected) {
      renderStatus();
      renderJob();
      renderShots();
      renderAngle();
    }
    renderDevices();
    renderSummary();
  }

  async function onPanelOpen() {
    store.open = $('tt-panel').open;
    saveStore();
    if (conn) conn.sendPreview();
    if (!store.open || probed || probing) return;
    lnaStatus = await queryLna();
    if (lnaStatus) lnaStatus.onchange = function () { renderPerm(); if (lnaStatus.state === 'granted') probe(); };
    renderPerm();
    // Probing while the permission is still "prompt" would raise the browser's
    // prompt without a click, so wait for Find phones then.
    if (!(lnaStatus && lnaStatus.state === 'prompt' && location.protocol === 'https:')) probe();
    else renderDevices();
  }

  function wire() {
    $('tt-panel').addEventListener('toggle', onPanelOpen);
    $('tt-find').addEventListener('click', function () { probe(); });
    $('tt-add-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var host = $('tt-add-host').value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      var port = parseInt($('tt-add-port').value, 10) || DEFAULT_PORT;
      var m = host.match(/^([^:\[\]]+):(\d+)$/);
      if (m) { host = m[1]; port = parseInt(m[2], 10); }
      if (!host) return;
      if (!store.addresses.some(function (a) { return a.host === host && a.port === port; })) store.addresses.push({ host: host, port: port });
      saveStore();
      $('tt-add-host').value = '';
      probe();
    });
    $('tt-pair-form').addEventListener('submit', submitPair);
    $('tt-pair-cancel').addEventListener('click', function () { $('tt-pair-form').hidden = true; pairingId = null; });

    $('tt-preview').addEventListener('click', previewClick);
    $('tt-ov-grid').addEventListener('change', drawPreview);
    $('tt-ov-ring').addEventListener('change', drawPreview);
    document.addEventListener('visibilitychange', function () { if (conn) conn.sendPreview(); });

    $('tt-calibrate').addEventListener('click', function () { startJob('/calibrate', {}); });
    $('tt-step').addEventListener('click', function () {
      if (calibrated()) startJob('/turntable/move', { by: 90 });
      else run(function () { return conn.api('POST', '/turntable/press', { role: 'step_90' }); });
    });
    $('tt-home').addEventListener('click', function () { startJob('/turntable/move', { home: true }); });
    $('tt-front').addEventListener('click', function () {
      run(function () { return conn.api('POST', '/turntable/front', {}); }).then(function (out) {
        if (!out) return;
        notice('Front set at ring ' + fmtAngle(out.frontRingDeg) + '.');
        refreshStatus();
      });
    });
    $('tt-goto').addEventListener('submit', function (e) {
      e.preventDefault();
      var deg = ((parseFloat($('tt-goto-deg').value) || 0) % 360 + 360) % 360;
      startJob('/turntable/move', { to: deg });
    });
    $('tt-auto-capture').addEventListener('click', function () { startCapture('auto'); });
    $('tt-capture-both').addEventListener('click', function () { startCapture('both'); });
    $('tt-capture-stills').addEventListener('click', function () { startCapture('stills'); });
    $('tt-capture-spin').addEventListener('click', function () { startCapture('spin'); });
    // Typing a set label picks Extra set; either choice updates the hint.
    $('tt-set-label').addEventListener('input', function () {
      if (this.value.trim()) $('tt-set-extra').checked = true;
      if (conn && conn.status) renderStatus();
    });
    ['tt-set-main', 'tt-set-extra'].forEach(function (id) {
      $(id).addEventListener('change', function () {
        if (id === 'tt-set-extra' && !$('tt-set-label').value.trim()) $('tt-set-label').focus();
        if (conn && conn.status) renderStatus();
      });
    });
    $('tt-extra').addEventListener('click', function () {
      var label = EXTRA_LABELS.indexOf(store.extraLabel) >= 0 ? store.extraLabel : $('tt-extra-other').value.trim();
      if (!label) { notice('Give the extra shot a label.', 'error'); $('tt-extra-other').focus(); return; }
      startJob('/extra', { label: label });
    });
    $('tt-extra-other').addEventListener('change', function () { store.extraLabel = this.value.trim(); saveStore(); });
    $('tt-stop').addEventListener('click', stopJob);
    $('tt-add-all').addEventListener('click', function () { if (conn) addShots(conn.shots); });
    $('tt-clear-all').addEventListener('click', function () { if (conn) deleteAllShots(); });

    // The save options sit inside the badge form; keep them from marking it dirty.
    ['tt-save-originals', 'tt-clear-after'].forEach(function (id) {
      var cb = $(id);
      cb.checked = id === 'tt-save-originals' ? !!store.saveOriginals : store.clearAfter !== false;
      ['input', 'change'].forEach(function (ev) { cb.addEventListener(ev, function (e) { e.stopPropagation(); }); });
      cb.addEventListener('change', function () {
        if (id === 'tt-save-originals') store.saveOriginals = cb.checked; else store.clearAfter = cb.checked;
        saveStore();
      });
    });

    if (window.BadgeEditor) {
      window.BadgeEditor.onSaved(afterSave);
      window.BadgeEditor.onMediaChanged(renderSaveOptions);
    }
    renderChips();
    renderDevices();
    if (store.open) $('tt-panel').open = true;  // fires toggle → probe
  }

  wire();
})();
