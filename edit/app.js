(function () {
  'use strict';

  // -------------------------------------------------------------------------
  // Option lists (mirrors badge_lib.py)
  // -------------------------------------------------------------------------

  var STATIC_DEFAULTS = {
    con:                    ['defcon', 'saintcon', 'dc503', 'queercon', 'layerone', 'toorcon', 'other'],
    type:                   ['badge', 'sao', 'minibadge', 'standalone', 'entry', 'other'],
    edition:                ['regular', 'limited', 'press', 'speaker', 'staff', 'volunteer', 'prototype', 'artist', 'other'],
    display:                ['none', 'oled', 'eink', 'lcd', 'led-matrix', '7seg', 'neopixel-matrix', 'other'],
    battery_type:           ['none', 'rechargeable', 'non-rechargeable'],
    battery_cell:           ['CR2032', 'CR2016', '18650', 'LiPo', 'AA', 'AAA', '9V', 'other'],
    power_sources:          ['battery', 'usb', 'sao', 'minibadge'],
    sao_version:            ['SAOv1', 'SAOv2', 'SAOv3'],
    sao_implements:         ['i2c', 'gpio1', 'gpio2', '3v3'],
    minibadge_implements:   ['i2c', 'clk', 'gpio', '3v3'],
    sao_port_features:      ['i2c', 'gpio'],
    minibadge_port_features:['i2c', 'clk', 'gpio'],
    port_power:             ['3v3', 'vbatt', '5v'],
    interface:              ['none', 'USB-C', 'micro-USB', 'mini-USB'],
    programming:            ['none', 'JTAG', 'SWD', 'UART', 'USB-DFU', 'other'],
    connectivity:           ['wifi', 'bluetooth', 'ir', 'nfc', 'lora', 'zigbee', 'rf', 'other'],
    rarity:                 ['unknown', 'limited', 'small-run', 'mass-produced'],
    status:                 ['stub', 'wip', 'complete'],
  };

  // -------------------------------------------------------------------------
  // YAML utilities (mirrors badge_lib.py)
  // -------------------------------------------------------------------------

  function qs(val) {
    return '"' + String(val == null ? '' : val).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }

  function yamlList(items) {
    if (!items || !items.length) return '[]';
    return '[' + items.join(', ') + ']';
  }

  function yamlStrList(items) {
    if (!items || !items.length) return '[]';
    return '[' + items.map(function (i) { return '"' + i + '"'; }).join(', ') + ']';
  }

  function yamlBlockList(items) {
    if (!items || !items.length) return '[]';
    return '\n' + items.map(function (i) { return '  - ' + qs(i); }).join('\n');
  }

  function yamlSoldAt(entries) {
    if (!entries || !entries.length) return '[]';
    var lines = [];
    entries.forEach(function (e) {
      lines.push('  - vendor: ' + qs(e.vendor || ''));
      lines.push('    url: ' + qs(e.url || ''));
    });
    return '\n' + lines.join('\n');
  }

  function yamlLinks(entries) {
    if (!entries || !entries.length) return '[]';
    var lines = [];
    entries.forEach(function (e) {
      lines.push('  - label: ' + qs(e.label || ''));
      lines.push('    url: ' + qs(e.url || ''));
      lines.push('    type: ' + (e.type || 'web'));
    });
    return '\n' + lines.join('\n');
  }

  function yamlMediaBlock(items) {
    if (!items || !items.length) return '[]';
    var lines = [];
    items.forEach(function (item) {
      lines.push('  - filename: ' + qs(item.filename || ''));
      lines.push('    caption: ' + qs(item.caption || ''));
      if (item.highlight) lines.push('    highlight: true');
    });
    return '\n' + lines.join('\n');
  }

  function buildFrontmatter(f) {
    var makers = f.makers || [];
    var makersYaml = makers.length === 1 ? yamlStrList(makers) : yamlBlockList(makers);
    var badgeType = f.badge_type || '';

    var saoBlock = '';
    if (badgeType === 'sao') {
      saoBlock = 'sao:\n  version: ' + qs(f.sao_version || '') + '\n  implements: ' + yamlList(f.sao_implements || []) + '\n';
    }

    var minibadgeBlock = '';
    if (badgeType === 'minibadge') {
      minibadgeBlock = 'minibadge:\n  implements: ' + yamlList(f.minibadge_implements || []) + '\n';
    }

    var saoPortCount = parseInt(f.sao_port_count) || 0;
    var saoPortsBlock = '';
    if (saoPortCount > 0) {
      saoPortsBlock = 'sao_ports:\n  count: ' + saoPortCount + '\n  implements: ' + yamlList(f.sao_port_features || []) + '\n  power: ' + (f.sao_port_power || '') + '\n';
    }

    var mbPortCount = parseInt(f.mb_port_count) || 0;
    var mbPortsBlock = '';
    if (mbPortCount > 0) {
      mbPortsBlock = 'minibadge_ports:\n  count: ' + mbPortCount + '\n  implements: ' + yamlList(f.mb_port_features || []) + '\n  power: ' + (f.mb_port_power || '') + '\n';
    }

    var currentMa = f.current_ma || '';
    var notes = f.notes || '';

    return '---\n' +
      'layout: badge\n' +
      'title: ' + qs(f.title || '') + '\n' +
      'slug: ' + (f.slug || '') + '\n' +
      'year: ' + (f.year || '') + '\n' +
      'con: ' + (f.con || '') + '\n' +
      'event: ' + qs(f.event || '') + '\n' +
      'type: ' + badgeType + '\n' +
      'edition: ' + qs(f.edition || '') + '\n' +
      'makers: ' + makersYaml + '\n' +
      'group: ' + qs(f.group || '') + '\n' +
      'electronics: ' + (f.has_electronics ? 'true' : 'false') + '\n' +
      'mcu: ' + qs(f.mcu || '') + '\n' +
      'display: ' + qs(f.display || '') + '\n' +
      'power:\n' +
      '  sources: ' + yamlList(f.power_sources || []) + '\n' +
      '  battery: ' + (f.battery_type || 'none') + '\n' +
      '  battery_cell: ' + qs(f.battery_cell || '') + '\n' +
      '  current_ma: ' + (currentMa || 'null') + '\n' +
      saoBlock + minibadgeBlock + saoPortsBlock + mbPortsBlock +
      'interface: ' + (f.interface || 'none') + '\n' +
      'programming: ' + (f.programming || 'none') + '\n' +
      'connectivity: ' + yamlList(f.connectivity || []) + '\n' +
      'features: ' + yamlStrList(f.features_list || []) + '\n' +
      'rarity: ' + qs(f.rarity || '') + '\n' +
      'acquisition:\n' +
      '  date: ' + qs(f.acq_date || '') + '\n' +
      '  source: ' + qs(f.acq_source || '') + '\n' +
      'docs_url: ' + qs(f.docs_url || '') + '\n' +
      'source_repo: ' + qs(f.source_repo || '') + '\n' +
      'sold_at: ' + yamlSoldAt(f.sold_at || []) + '\n' +
      'purchase_url: ' + qs(f.purchase_url || '') + '\n' +
      'links: ' + yamlLinks(f.links || []) + '\n' +
      'images: ' + yamlMediaBlock(f.images || []) + '\n' +
      'videos: ' + yamlMediaBlock(f.videos || []) + '\n' +
      'status: ' + (f.status || 'stub') + '\n' +
      '---\n\n' +
      notes + '\n';
  }

  // -------------------------------------------------------------------------
  // Frontmatter parser (mirrors badge_lib.py)
  // -------------------------------------------------------------------------

  function stripQuotes(s) {
    s = (s || '').trim();
    if (s.length >= 2 && s[0] === s[s.length - 1] && (s[0] === '"' || s[0] === "'")) {
      return s.slice(1, -1);
    }
    return s;
  }

  function parseInlineList(s) {
    var inner = s.trim().slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map(function (p) { return stripQuotes(p.trim()); });
  }

  function parseMappingSequence(blockLines) {
    var items = [], current = null;
    blockLines.forEach(function (line) {
      var stripped = line.trim();
      if (!stripped) return;
      if (stripped.startsWith('- ')) {
        if (current !== null) items.push(current);
        current = {};
        var rest = stripped.slice(2);
        var m = rest.match(/^(\w+):\s*(.*)$/);
        if (m) current[m[1]] = stripQuotes(m[2]);
      } else if (current !== null) {
        var m2 = stripped.match(/^(\w+):\s*(.*)$/);
        if (m2) current[m2[1]] = stripQuotes(m2[2]);
      }
    });
    if (current !== null) items.push(current);
    return items;
  }

  function collectIndentedBlock(lines, start) {
    var block = [], j = start, baseIndent = null;
    while (j < lines.length) {
      var line = lines[j];
      if (!line.trim()) { j++; continue; }
      var indent = line.length - line.trimStart().length;
      if (indent === 0) break;
      if (baseIndent === null) baseIndent = indent;
      if (indent < baseIndent) break;
      block.push(line.slice(baseIndent));
      j++;
    }
    return { block: block, consumed: j - start };
  }

  function parseFrontmatter(text) {
    var lines = text.split('\n');
    var result = {}, i = 0;
    while (i < lines.length) {
      var line = lines[i];
      if (!line.trim() || line.trim().startsWith('#')) { i++; continue; }
      var m = line.match(/^([\w.]+):\s*(.*)$/);
      if (!m) { i++; continue; }
      var key = m[1], rest = m[2].trim();

      if (rest === '' || rest === '{}') {
        var res = collectIndentedBlock(lines, i + 1);
        i += 1 + res.consumed;
        if (!res.block.length) { result[key] = ''; continue; }
        var first = res.block[0].trim();
        if (first.startsWith('- ')) {
          var itemBody = first.slice(2).trim();
          if (itemBody.indexOf(':') !== -1 && itemBody[0] !== '"' && itemBody[0] !== "'") {
            result[key] = parseMappingSequence(res.block);
          } else {
            result[key] = res.block
              .filter(function (l) { return l.trim().startsWith('- '); })
              .map(function (l) { return stripQuotes(l.trim().slice(2)); });
          }
        } else {
          var nested = parseFrontmatter(res.block.join('\n'));
          Object.keys(nested).forEach(function (nk) { result[key + '.' + nk] = nested[nk]; });
        }
        continue;
      }

      if (rest.startsWith('[')) {
        result[key] = parseInlineList(rest);
      } else {
        result[key] = stripQuotes(rest);
      }
      i++;
    }
    return result;
  }

  function extractFrontmatterBlock(text) {
    var m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    return m ? m[1] : null;
  }

  // -------------------------------------------------------------------------
  // Data helpers
  // -------------------------------------------------------------------------

  function asList(v) {
    if (Array.isArray(v)) return v;
    return v ? [v] : [];
  }

  function normalizeMediaList(items) {
    if (!Array.isArray(items)) return [];
    return items.filter(function (i) { return i && i.filename; }).map(function (i) {
      return {
        filename: i.filename,
        caption: i.caption || '',
        highlight: String(i.highlight || '').toLowerCase() === 'true' || i.highlight === true,
      };
    });
  }

  function normalizeLinks(items) {
    if (!Array.isArray(items)) return [];
    return items.filter(function (i) { return i && i.url; }).map(function (i) {
      return { label: i.label || '', url: i.url, type: i.type || 'web' };
    });
  }

  // -------------------------------------------------------------------------
  // File System Access API state & utilities
  // -------------------------------------------------------------------------

  var repoDir = null;
  var badgesDir = null;

  async function openRepo() {
    var dir;
    try {
      dir = await window.showDirectoryPicker({ mode: 'readwrite' });
    } catch (e) {
      return false; // user cancelled
    }
    var bd;
    try {
      bd = await dir.getDirectoryHandle('_badges');
    } catch (e) {
      alert("This doesn't look like the badges repo — no _badges/ directory found. Make sure you open the root of your local checkout.");
      return false;
    }
    repoDir = dir;
    badgesDir = bd;
    return true;
  }

  async function fsWrite(dirHandle, filename, content) {
    var handle = await dirHandle.getFileHandle(filename, { create: true });
    var writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  async function fsCopyFile(srcHandle, destDirHandle, destName) {
    var file = await srcHandle.getFile();
    var buf = await file.arrayBuffer();
    var destHandle = await destDirHandle.getFileHandle(destName, { create: true });
    var writable = await destHandle.createWritable();
    await writable.write(buf);
    await writable.close();
  }

  // Copy all files from srcDir into destDir, then remove srcDir
  async function moveBadgeDir(srcConName, srcSlugName, destConName, destSlugName) {
    var srcConHandle = await badgesDir.getDirectoryHandle(srcConName);
    var srcSlugHandle = await srcConHandle.getDirectoryHandle(srcSlugName);
    var destConHandle = await badgesDir.getDirectoryHandle(destConName, { create: true });
    var destSlugHandle = await destConHandle.getDirectoryHandle(destSlugName, { create: true });
    for await (var entry of srcSlugHandle.values()) {
      if (entry.kind === 'file') {
        await fsCopyFile(entry, destSlugHandle, entry.name);
      }
    }
    await srcSlugHandle.remove({ recursive: true });
    return destSlugHandle;
  }

  // -------------------------------------------------------------------------
  // Badge data functions (async, File System API based)
  // -------------------------------------------------------------------------

  async function listBadges() {
    var out = [];
    for await (var conEntry of badgesDir.values()) {
      if (conEntry.kind !== 'directory') continue;
      var conName = conEntry.name;
      for await (var slugEntry of conEntry.values()) {
        if (slugEntry.kind !== 'directory') continue;
        var slugName = slugEntry.name;
        try {
          var indexHandle = await slugEntry.getFileHandle('index.md');
          var file = await indexHandle.getFile();
          var text = await file.text();
          var fmText = extractFrontmatterBlock(text);
          if (!fmText) continue;
          var data = parseFrontmatter(fmText);
          var images = normalizeMediaList(asList(data.images));
          var thumb = images.find(function (i) { return i.highlight; }) || images[0] || null;
          out.push({
            con: conName,
            slug: slugName,
            title: data.title || slugName,
            year: data.year || '',
            type: data.type || '',
            group: data.group || '',
            makers: asList(data.makers),
            status: data.status || '',
            thumbnailFile: thumb ? thumb.filename : null,
            slugHandle: slugEntry,
          });
        } catch (e) { /* skip malformed */ }
      }
    }
    out.sort(function (a, b) {
      return a.con.localeCompare(b.con) || a.title.toLowerCase().localeCompare(b.title.toLowerCase());
    });
    return out;
  }

  async function scanKnownValues() {
    var scanned = {};
    function add(key, val) {
      if (val == null || val === '') return;
      if (!scanned[key]) scanned[key] = new Set();
      if (Array.isArray(val)) { val.forEach(function (v) { if (v) scanned[key].add(v); }); }
      else { scanned[key].add(val); }
    }

    for await (var conEntry of badgesDir.values()) {
      if (conEntry.kind !== 'directory') continue;
      for await (var slugEntry of conEntry.values()) {
        if (slugEntry.kind !== 'directory') continue;
        try {
          var indexHandle = await slugEntry.getFileHandle('index.md');
          var file = await indexHandle.getFile();
          var text = await file.text();
          var fmText = extractFrontmatterBlock(text);
          if (!fmText) continue;
          var d = parseFrontmatter(fmText);
          add('con', d.con);
          add('type', d.type);
          add('edition', d.edition);
          add('makers', d.makers);
          add('group', d.group);
          add('mcu', d.mcu);
          add('display', d.display);
          add('battery_type', d['power.battery']);
          add('battery_cell', d['power.battery_cell']);
          add('power_sources', d['power.sources']);
          add('sao_version', d['sao.version']);
          add('sao_implements', d['sao.implements']);
          add('minibadge_implements', d['minibadge.implements']);
          add('sao_port_features', d['sao_ports.implements']);
          add('minibadge_port_features', d['minibadge_ports.implements']);
          add('port_power', d['sao_ports.power']);
          add('port_power', d['minibadge_ports.power']);
          add('interface', d.interface);
          add('programming', d.programming);
          add('connectivity', d.connectivity);
          add('features', d.features);
          add('rarity', d.rarity);
          add('status', d.status);
        } catch (e) { /* skip */ }
      }
    }

    var out = {};
    Object.keys(STATIC_DEFAULTS).forEach(function (key) {
      var combined = STATIC_DEFAULTS[key].slice();
      if (scanned[key]) {
        Array.from(scanned[key]).sort().forEach(function (v) { if (combined.indexOf(v) === -1) combined.push(v); });
      }
      out[key] = combined;
    });
    ['makers', 'group', 'mcu', 'features'].forEach(function (key) {
      out[key] = scanned[key] ? Array.from(scanned[key]).sort() : [];
    });
    return out;
  }

  async function getBadgeFields(con, slug) {
    var conHandle = await badgesDir.getDirectoryHandle(con);
    var slugHandle = await conHandle.getDirectoryHandle(slug);
    var indexHandle = await slugHandle.getFileHandle('index.md');
    var file = await indexHandle.getFile();
    var text = await file.text();

    var fmText = extractFrontmatterBlock(text) || '';
    var data = parseFrontmatter(fmText);

    var bodyMatch = text.match(/^---\s*\n[\s\S]*?\n---\s*\n?([\s\S]*)$/);
    var notes = bodyMatch ? bodyMatch[1].trim() : '';

    var currentMa = data['power.current_ma'];
    if (currentMa == null || currentMa === 'null' || currentMa === '') currentMa = '';

    var images = normalizeMediaList(asList(data.images));
    var videos = normalizeMediaList(asList(data.videos));
    var soldAt = data.sold_at;
    var links = normalizeLinks(asList(data.links));

    return {
      title: data.title || '',
      slug: slug,
      con: con,
      year: data.year || '',
      event: data.event || '',
      badge_type: data.type || '',
      edition: data.edition || '',
      makers: asList(data.makers),
      group: data.group || '',
      has_electronics: String(data.electronics || '').toLowerCase() === 'true',
      mcu: data.mcu || '',
      display: data.display || '',
      power_sources: asList(data['power.sources']),
      battery_type: data['power.battery'] || 'none',
      battery_cell: data['power.battery_cell'] || '',
      current_ma: currentMa,
      sao_version: data['sao.version'] || '',
      sao_implements: asList(data['sao.implements']),
      minibadge_implements: asList(data['minibadge.implements']),
      sao_port_count: parseInt(data['sao_ports.count']) || 0,
      sao_port_features: asList(data['sao_ports.implements']),
      sao_port_power: data['sao_ports.power'] || '',
      mb_port_count: parseInt(data['minibadge_ports.count']) || 0,
      mb_port_features: asList(data['minibadge_ports.implements']),
      mb_port_power: data['minibadge_ports.power'] || '',
      interface: data.interface || 'none',
      programming: data.programming || 'none',
      connectivity: asList(data.connectivity),
      features_list: asList(data.features),
      rarity: data.rarity || '',
      acq_date: data['acquisition.date'] || '',
      acq_source: data['acquisition.source'] || '',
      docs_url: data.docs_url || '',
      source_repo: data.source_repo || '',
      sold_at: Array.isArray(soldAt) ? soldAt : [],
      purchase_url: data.purchase_url || '',
      links: links,
      status: data.status || 'stub',
      notes: notes,
      images: images,
      videos: videos,
      _slugHandle: slugHandle,
    };
  }

  async function saveBadge(fields) {
    var con = fields.con;
    var slug = fields.slug;
    var originalCon = fields.original_con;
    var originalSlug = fields.original_slug;
    var isEdit = !!(originalCon && originalSlug);

    var slugHandle;
    if (isEdit && (originalCon !== con || originalSlug !== slug)) {
      slugHandle = await moveBadgeDir(originalCon, originalSlug, con, slug);
    } else if (isEdit) {
      var conHandle = await badgesDir.getDirectoryHandle(con);
      slugHandle = await conHandle.getDirectoryHandle(slug);
    } else {
      var conHandle2 = await badgesDir.getDirectoryHandle(con, { create: true });
      slugHandle = await conHandle2.getDirectoryHandle(slug, { create: true });
    }

    // Place images
    var finalImages = [];
    for (var i = 0; i < (fields.images || []).length; i++) {
      var img = fields.images[i];
      if (img.fileObject) {
        // New file dropped in
        var destHandle = await slugHandle.getFileHandle(img.filename, { create: true });
        var writable = await destHandle.createWritable();
        await writable.write(await img.fileObject.arrayBuffer());
        await writable.close();
      } else if (img.originalFilename && img.originalFilename !== img.filename) {
        // Rename existing file
        var oldHandle = await slugHandle.getFileHandle(img.originalFilename);
        await fsCopyFile(oldHandle, slugHandle, img.filename);
        await oldHandle.remove();
      }
      finalImages.push({ filename: img.filename, caption: img.caption || '', highlight: !!img.highlight });
    }

    // Place videos
    var finalVideos = [];
    for (var j = 0; j < (fields.videos || []).length; j++) {
      var vid = fields.videos[j];
      if (vid.fileObject) {
        var destHandle2 = await slugHandle.getFileHandle(vid.filename, { create: true });
        var writable2 = await destHandle2.createWritable();
        await writable2.write(await vid.fileObject.arrayBuffer());
        await writable2.close();
      } else if (vid.originalFilename && vid.originalFilename !== vid.filename) {
        var oldHandle2 = await slugHandle.getFileHandle(vid.originalFilename);
        await fsCopyFile(oldHandle2, slugHandle, vid.filename);
        await oldHandle2.remove();
      }
      finalVideos.push({ filename: vid.filename, caption: vid.caption || '', highlight: !!vid.highlight });
    }

    var content = buildFrontmatter(Object.assign({}, fields, { images: finalImages, videos: finalVideos }));
    await fsWrite(slugHandle, 'index.md', content);
    return { con: con, slug: slug };
  }

  // -------------------------------------------------------------------------
  // UI state
  // -------------------------------------------------------------------------

  var OPTIONS = {};
  var CHECKBOX_GROUPS = {};
  var images = [];
  var videos = [];
  var dragSrcIndex = null;
  var videoDragSrcIndex = null;
  var slugTouched = false;
  var previewMode = 'rendered';
  var editingBadge = null;
  var dirty = false;
  var allBadgesList = [];

  var ALLOW_BLANK = { edition: true, programming: true, rarity: true };
  var form = document.getElementById('badge-form');

  // -------------------------------------------------------------------------
  // Small helpers
  // -------------------------------------------------------------------------

  function val(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function setVal(id, v) { var el = document.getElementById(id); if (el) el.value = (v == null) ? '' : v; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function splitCsv(s) { return s.split(',').map(function (p) { return p.trim(); }).filter(Boolean); }
  function markDirty() { dirty = true; }

  function setStatus(message, isError) {
    var status = document.getElementById('save-status');
    status.textContent = message;
    status.className = 'save-status' + (isError ? ' error' : message ? ' ok' : '');
  }

  // -------------------------------------------------------------------------
  // Repo picker
  // -------------------------------------------------------------------------

  document.getElementById('open-repo-btn').addEventListener('click', async function () {
    var btn = this;
    btn.disabled = true;
    btn.textContent = 'Opening…';
    var ok = await openRepo();
    if (ok) {
      document.getElementById('repo-picker').hidden = true;
      document.getElementById('admin-ui').hidden = false;
      await initAdminUi();
    } else {
      btn.disabled = false;
      btn.textContent = 'Open repo…';
    }
  });

  document.getElementById('close-repo-btn').addEventListener('click', function () {
    if (dirty && !confirm('You have unsaved changes. Close the repo anyway?')) return;
    repoDir = null;
    badgesDir = null;
    document.getElementById('admin-ui').hidden = true;
    document.getElementById('repo-picker').hidden = false;
    document.getElementById('open-repo-btn').disabled = false;
    document.getElementById('open-repo-btn').textContent = 'Open repo…';
  });

  async function initAdminUi() {
    document.getElementById('repo-name').textContent = repoDir.name;
    setStatus('Scanning badges…', false);
    try {
      OPTIONS = await scanKnownValues();
    } catch (e) {
      OPTIONS = {};
    }
    buildAllSelects();
    buildAllCheckboxGroups();
    populateDatalist('dl-makers', OPTIONS.makers);
    populateDatalist('dl-groups', OPTIONS.group);
    populateDatalist('dl-mcu', OPTIONS.mcu);
    wireStaticControls();
    scheduleFieldsChanged();
    setStatus('', false);
  }

  // -------------------------------------------------------------------------
  // Select-with-add-new
  // -------------------------------------------------------------------------

  function buildAllSelects() {
    document.querySelectorAll('[data-select-field]').forEach(function (labelEl) {
      var optionsKey = labelEl.dataset.selectField;
      var fieldId = labelEl.dataset.selectId || optionsKey;
      buildSelectField(labelEl, optionsKey, fieldId, !!ALLOW_BLANK[fieldId]);
    });
  }

  function buildSelectField(labelEl, optionsKey, fieldId, allowBlank) {
    // Avoid rebuilding if already built
    if (labelEl.querySelector('.select-add-wrap')) return labelEl.querySelector('select');
    var wrap = document.createElement('div');
    wrap.className = 'select-add-wrap';
    var select = document.createElement('select');
    select.id = 'f-' + fieldId;
    if (allowBlank) appendOpt(select, '', '(none)');
    (OPTIONS[optionsKey] || []).forEach(function (v) { appendOpt(select, v, v); });
    var addOpt = document.createElement('option');
    addOpt.value = '__add__'; addOpt.textContent = '+ Add new…';
    select.appendChild(addOpt);

    var addInput = document.createElement('input');
    addInput.type = 'text';
    addInput.placeholder = 'Type a new value, press Enter';
    addInput.className = 'select-add-new-input';

    var fallback = select.options[0] ? select.options[0].value : '';

    select.addEventListener('change', function () {
      if (select.value === '__add__') { addInput.classList.add('active'); addInput.focus(); }
      else { addInput.classList.remove('active'); }
    });

    function ensureOption(v) {
      if (!Array.from(select.options).some(function (o) { return o.value === v; })) {
        var opt = document.createElement('option'); opt.value = v; opt.textContent = v;
        select.insertBefore(opt, addOpt);
      }
    }

    function commitNew() {
      var v = addInput.value.trim();
      addInput.classList.remove('active');
      if (!v) { select.value = fallback; return; }
      ensureOption(v); select.value = v; addInput.value = '';
      scheduleFieldsChanged();
    }

    addInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commitNew(); }
      if (e.key === 'Escape') { addInput.value = ''; addInput.classList.remove('active'); select.value = fallback; }
    });
    addInput.addEventListener('blur', commitNew);

    wrap.appendChild(select); wrap.appendChild(addInput);
    labelEl.appendChild(wrap);
    select._ensureOption = ensureOption;
    return select;
  }

  function appendOpt(select, value, label) {
    var opt = document.createElement('option'); opt.value = value; opt.textContent = label;
    select.appendChild(opt);
  }

  function setSelectValue(id, value) {
    var select = document.getElementById(id);
    if (!select) return;
    value = (value == null) ? '' : String(value);
    if (value && select._ensureOption) select._ensureOption(value);
    select.value = value;
  }

  // -------------------------------------------------------------------------
  // Checkbox groups
  // -------------------------------------------------------------------------

  function buildAllCheckboxGroups() {
    document.querySelectorAll('[data-checkbox-field]').forEach(buildCheckboxGroup);
  }

  function buildCheckboxGroup(container) {
    if (container._getChecked) return; // already built
    var key = container.dataset.checkboxField;
    var values = (OPTIONS[key] || []).slice();

    var label = document.createElement('span');
    label.className = 'checkbox-group-label';
    label.textContent = container.dataset.label || key;
    container.appendChild(label);

    var optionsWrap = document.createElement('div');
    optionsWrap.className = 'checkbox-group-options';
    container.appendChild(optionsWrap);

    function addOption(value, checked) {
      var optLabel = document.createElement('label'); optLabel.className = 'checkbox-option';
      var cb = document.createElement('input'); cb.type = 'checkbox'; cb.value = value; cb.checked = !!checked;
      var span = document.createElement('span'); span.textContent = value;
      optLabel.appendChild(cb); optLabel.appendChild(span);
      optionsWrap.appendChild(optLabel);
      return cb;
    }

    values.forEach(function (v) { addOption(v, false); });

    var addRow = document.createElement('div'); addRow.className = 'checkbox-add-row';
    var addInput = document.createElement('input'); addInput.type = 'text'; addInput.placeholder = '+ add new…';
    var addBtn = document.createElement('button'); addBtn.type = 'button'; addBtn.className = 'btn-secondary'; addBtn.textContent = 'Add';
    addRow.appendChild(addInput); addRow.appendChild(addBtn);
    container.appendChild(addRow);

    function setChecked(value, checked) {
      var existing = Array.from(optionsWrap.querySelectorAll('input[type=checkbox]')).find(function (cb) { return cb.value === value; });
      if (existing) { existing.checked = checked; return; }
      if (checked) addOption(value, true);
    }

    function commitAdd() {
      var v = addInput.value.trim(); if (!v) return;
      setChecked(v, true); addInput.value = '';
      scheduleFieldsChanged();
    }
    addBtn.addEventListener('click', commitAdd);
    addInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); commitAdd(); } });

    container._getChecked = function () {
      return Array.from(optionsWrap.querySelectorAll('input[type=checkbox]:checked')).map(function (cb) { return cb.value; });
    };
    container._setChecked = setChecked;
    CHECKBOX_GROUPS[key] = container;
  }

  function getChecked(key) { return CHECKBOX_GROUPS[key] ? CHECKBOX_GROUPS[key]._getChecked() : []; }

  function setCheckedValues(key, values) {
    var group = CHECKBOX_GROUPS[key]; if (!group) return;
    (values || []).forEach(function (v) { group._setChecked(v, true); });
  }

  function setOptionVisible(groupKey, value, visible) {
    var group = CHECKBOX_GROUPS[groupKey]; if (!group) return;
    var cb = Array.from(group.querySelectorAll('input[type=checkbox]')).find(function (c) { return c.value === value; });
    if (!cb) return;
    var optLabel = cb.closest('.checkbox-option');
    if (optLabel) optLabel.hidden = !visible;
    if (!visible && cb.checked) cb.checked = false;
  }

  function populateDatalist(id, values) {
    var dl = document.getElementById(id); if (!dl) return;
    dl.innerHTML = '';
    (values || []).forEach(function (v) { var o = document.createElement('option'); o.value = v; dl.appendChild(o); });
  }

  // -------------------------------------------------------------------------
  // Conditional visibility
  // -------------------------------------------------------------------------

  function updateConditionalVisibility() {
    var badgeType = val('f-badge_type');
    var hasElectronicsCb = document.getElementById('f-has-electronics');
    if (badgeType === 'entry') { hasElectronicsCb.checked = false; hasElectronicsCb.disabled = true; }
    else if (badgeType === 'sao' || badgeType === 'minibadge') { hasElectronicsCb.checked = true; hasElectronicsCb.disabled = true; }
    else { hasElectronicsCb.disabled = false; }

    var hasElectronics = hasElectronicsCb.checked;
    document.getElementById('electronics-fields').hidden = !hasElectronics;
    var isSaoOrMb = badgeType === 'sao' || badgeType === 'minibadge';
    document.getElementById('power-sources-group').hidden = !isSaoOrMb;
    document.getElementById('sao-device-fields').hidden = badgeType !== 'sao';
    document.getElementById('minibadge-device-fields').hidden = badgeType !== 'minibadge';
    document.getElementById('current-ma-field').hidden = !isSaoOrMb;
    setOptionVisible('power_sources', 'sao', badgeType === 'sao');
    setOptionVisible('power_sources', 'minibadge', badgeType === 'minibadge');

    var powerSources = getChecked('power_sources');
    var showBattery = !isSaoOrMb || powerSources.indexOf('battery') !== -1;
    var batteryType = val('f-battery_type');
    document.getElementById('battery-cell-field').hidden = !showBattery || batteryType === 'none';
    document.getElementById('sao-ports-fields').hidden = !document.getElementById('f-has-sao-ports').checked;
    document.getElementById('mb-ports-fields').hidden = !document.getElementById('f-has-mb-ports').checked;
  }

  // -------------------------------------------------------------------------
  // Slug auto-fill
  // -------------------------------------------------------------------------

  function slugify(s) {
    return s.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/[\s-]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function updateAutoSlug() {
    if (slugTouched) return;
    var group = val('f-group').trim();
    var makers = splitCsv(val('f-makers'));
    var creatorPart = group || makers[0] || '';
    document.getElementById('f-slug').value = slugify([creatorPart, val('f-title'), val('f-year')].filter(Boolean).join('-'));
  }

  // -------------------------------------------------------------------------
  // Photos & videos
  // -------------------------------------------------------------------------

  function sanitizeFilename(name) {
    var dot = name.lastIndexOf('.');
    var base = dot > -1 ? name.slice(0, dot) : name;
    var ext = dot > -1 ? name.slice(dot).toLowerCase() : '';
    base = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return (base || 'photo') + ext;
  }

  function addFiles(fileList) {
    Array.from(fileList).forEach(function (file) {
      if (file.type && file.type.indexOf('video/') === 0) { addVideoFile(file); return; }
      if (file.type && file.type.indexOf('image/') !== 0) return;
      markDirty();
      var filename = sanitizeFilename(file.name);
      images.push({ filename: filename, caption: '', objectUrl: URL.createObjectURL(file), fileObject: file, originalFilename: null, highlight: false });
      renderImageList();
      scheduleFieldsChanged();
    });
  }

  function addVideoFile(file) {
    markDirty();
    var filename = sanitizeFilename(file.name);
    videos.push({ filename: filename, caption: '', objectUrl: URL.createObjectURL(file), fileObject: file, originalFilename: null, highlight: false, error: null });
    renderVideoList();
    scheduleFieldsChanged();
  }

  function setHighlight(kind, index) {
    images.forEach(function (img, i) { img.highlight = (kind === 'image' && i === index); });
    videos.forEach(function (vid, i) { vid.highlight = (kind === 'video' && i === index); });
    markDirty(); renderImageList(); renderVideoList(); scheduleFieldsChanged();
  }

  function buildHighlightButton(item, kind, idx) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'highlight-btn' + (item.highlight ? ' active' : '');
    btn.title = item.highlight ? 'This is the highlight' : 'Set as highlight';
    btn.textContent = item.highlight ? '★ Highlight' : '☆ Set as highlight';
    btn.addEventListener('click', function () { setHighlight(kind, idx); });
    return btn;
  }

  function renderImageList() {
    var container = document.getElementById('image-list'); container.innerHTML = '';
    images.forEach(function (img, idx) {
      var card = document.createElement('div');
      card.className = 'image-card' + (img.highlight ? ' highlighted' : '');
      card.draggable = true;
      if (img.objectUrl) { var thumb = document.createElement('img'); thumb.src = img.objectUrl; card.appendChild(thumb); }
      var body = document.createElement('div'); body.className = 'image-card-body';
      body.appendChild(buildHighlightButton(img, 'image', idx));
      var nameInput = document.createElement('input'); nameInput.type = 'text'; nameInput.value = img.filename;
      nameInput.addEventListener('change', function () { img.filename = nameInput.value.trim() || img.filename; markDirty(); scheduleFieldsChanged(); });
      var capInput = document.createElement('input'); capInput.type = 'text'; capInput.placeholder = 'Caption'; capInput.value = img.caption || '';
      capInput.addEventListener('change', function () { img.caption = capInput.value; markDirty(); scheduleFieldsChanged(); });
      var removeBtn = document.createElement('button'); removeBtn.type = 'button'; removeBtn.className = 'image-card-remove';
      removeBtn.textContent = img.originalFilename ? '✕ remove from list' : '✕ remove';
      removeBtn.addEventListener('click', function () { images.splice(idx, 1); markDirty(); renderImageList(); scheduleFieldsChanged(); });
      body.appendChild(nameInput); body.appendChild(capInput); body.appendChild(removeBtn);
      card.appendChild(body);
      card.addEventListener('dragstart', function () { dragSrcIndex = idx; card.classList.add('dragging'); });
      card.addEventListener('dragend', function () { card.classList.remove('dragging'); });
      card.addEventListener('dragover', function (e) { e.preventDefault(); });
      card.addEventListener('drop', function (e) {
        e.preventDefault();
        if (dragSrcIndex === null || dragSrcIndex === idx) return;
        var moved = images.splice(dragSrcIndex, 1)[0]; images.splice(idx, 0, moved);
        dragSrcIndex = null; markDirty(); renderImageList(); scheduleFieldsChanged();
      });
      container.appendChild(card);
    });
  }

  function renderVideoList() {
    var container = document.getElementById('video-list'); container.innerHTML = '';
    videos.forEach(function (vid, idx) {
      var card = document.createElement('div');
      card.className = 'video-card' + (vid.error ? ' error' : '') + (vid.highlight ? ' highlighted' : '');
      card.draggable = true;
      var preview = document.createElement('video'); preview.src = vid.objectUrl; preview.muted = true; preview.loop = true; preview.playsInline = true; preview.autoplay = true;
      card.appendChild(preview);
      var body = document.createElement('div'); body.className = 'video-card-body';
      if (!vid.error) body.appendChild(buildHighlightButton(vid, 'video', idx));
      var nameInput = document.createElement('input'); nameInput.type = 'text'; nameInput.value = vid.filename;
      nameInput.addEventListener('change', function () { vid.filename = nameInput.value.trim() || vid.filename; markDirty(); scheduleFieldsChanged(); });
      var capInput = document.createElement('input'); capInput.type = 'text'; capInput.placeholder = 'Caption'; capInput.value = vid.caption || '';
      capInput.addEventListener('change', function () { vid.caption = capInput.value; markDirty(); scheduleFieldsChanged(); });
      if (vid.error) { var status = document.createElement('div'); status.className = 'video-card-status error'; status.textContent = vid.error; body.appendChild(status); }
      var removeBtn = document.createElement('button'); removeBtn.type = 'button'; removeBtn.className = 'video-card-remove';
      removeBtn.textContent = vid.originalFilename ? '✕ remove from list' : '✕ remove';
      removeBtn.addEventListener('click', function () { videos.splice(idx, 1); markDirty(); renderVideoList(); scheduleFieldsChanged(); });
      body.appendChild(nameInput); body.appendChild(capInput); body.appendChild(removeBtn);
      card.appendChild(body);
      card.addEventListener('dragstart', function () { videoDragSrcIndex = idx; card.classList.add('dragging'); });
      card.addEventListener('dragend', function () { card.classList.remove('dragging'); });
      card.addEventListener('dragover', function (e) { e.preventDefault(); });
      card.addEventListener('drop', function (e) {
        e.preventDefault();
        if (videoDragSrcIndex === null || videoDragSrcIndex === idx) return;
        var moved = videos.splice(videoDragSrcIndex, 1)[0]; videos.splice(idx, 0, moved);
        videoDragSrcIndex = null; markDirty(); renderVideoList(); scheduleFieldsChanged();
      });
      container.appendChild(card);
    });
  }

  // -------------------------------------------------------------------------
  // Sold-at & links rows
  // -------------------------------------------------------------------------

  function addSoldAtRow(vendor, url) {
    var list = document.getElementById('sold-at-list');
    var row = document.createElement('div'); row.className = 'sold-at-row';
    var v = document.createElement('input'); v.type = 'text'; v.placeholder = 'Vendor'; v.value = vendor || '';
    var u = document.createElement('input'); u.type = 'url'; u.placeholder = 'https://…'; u.value = url || '';
    var rm = document.createElement('button'); rm.type = 'button'; rm.className = 'sold-at-remove'; rm.title = 'Remove'; rm.textContent = '✕';
    rm.addEventListener('click', function () { row.remove(); markDirty(); scheduleFieldsChanged(); });
    row.appendChild(v); row.appendChild(u); row.appendChild(rm); list.appendChild(row);
  }

  function collectSoldAt() {
    return Array.from(document.querySelectorAll('#sold-at-list .sold-at-row')).map(function (row) {
      var inputs = row.querySelectorAll('input');
      return { vendor: inputs[0].value.trim(), url: inputs[1].value.trim() };
    }).filter(function (e) { return e.vendor || e.url; });
  }

  function addLinkRow(label, url, type) {
    var list = document.getElementById('links-list');
    var row = document.createElement('div'); row.className = 'links-row';
    var lbl = document.createElement('input'); lbl.type = 'text'; lbl.placeholder = 'Label'; lbl.value = label || '';
    var u = document.createElement('input'); u.type = 'url'; u.placeholder = 'https://…'; u.value = url || '';
    var sel = document.createElement('select');
    ['web', 'youtube'].forEach(function (t) {
      var opt = document.createElement('option'); opt.value = t; opt.textContent = t;
      if (t === (type || 'web')) opt.selected = true;
      sel.appendChild(opt);
    });
    var rm = document.createElement('button'); rm.type = 'button'; rm.className = 'links-remove'; rm.title = 'Remove'; rm.textContent = '✕';
    rm.addEventListener('click', function () { row.remove(); markDirty(); scheduleFieldsChanged(); });
    row.appendChild(lbl); row.appendChild(u); row.appendChild(sel); row.appendChild(rm); list.appendChild(row);
  }

  function collectLinks() {
    return Array.from(document.querySelectorAll('#links-list .links-row')).map(function (row) {
      var inputs = row.querySelectorAll('input'); var sel = row.querySelector('select');
      return { label: inputs[0].value.trim(), url: inputs[1].value.trim(), type: sel.value };
    }).filter(function (e) { return e.url; });
  }

  function youtubeEmbedId(url) {
    var m = url.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  // -------------------------------------------------------------------------
  // Collect fields
  // -------------------------------------------------------------------------

  function collectFields() {
    var badgeType = val('f-badge_type');
    var hasElectronics = document.getElementById('f-has-electronics').checked;
    var isSaoOrMb = badgeType === 'sao' || badgeType === 'minibadge';
    var batteryType = hasElectronics ? val('f-battery_type') : 'none';
    var hasSaoPorts = document.getElementById('f-has-sao-ports').checked;
    var hasMbPorts = document.getElementById('f-has-mb-ports').checked;

    var fields = {
      title: val('f-title'), year: val('f-year'), con: val('f-con'), event: val('f-event'),
      badge_type: badgeType, edition: val('f-edition'),
      makers: splitCsv(val('f-makers')), group: val('f-group'),
      has_electronics: hasElectronics,
      mcu: hasElectronics ? val('f-mcu') : '',
      display: hasElectronics ? val('f-display') : '',
      power_sources: isSaoOrMb ? getChecked('power_sources') : [],
      battery_type: batteryType,
      battery_cell: batteryType !== 'none' ? val('f-battery_cell') : '',
      current_ma: val('f-current-ma'),
      sao_version: badgeType === 'sao' ? val('f-sao_version') : '',
      sao_implements: badgeType === 'sao' ? getChecked('sao_implements') : [],
      minibadge_implements: badgeType === 'minibadge' ? getChecked('minibadge_implements') : [],
      sao_port_count: hasSaoPorts ? (parseInt(val('f-sao-port-count'), 10) || 1) : 0,
      sao_port_features: hasSaoPorts ? getChecked('sao_port_features') : [],
      sao_port_power: hasSaoPorts ? val('f-sao_port_power') : '',
      mb_port_count: hasMbPorts ? (parseInt(val('f-mb-port-count'), 10) || 1) : 0,
      mb_port_features: hasMbPorts ? getChecked('minibadge_port_features') : [],
      mb_port_power: hasMbPorts ? val('f-mb_port_power') : '',
      interface: hasElectronics ? val('f-interface') : 'none',
      programming: hasElectronics ? val('f-programming') : 'none',
      connectivity: hasElectronics ? getChecked('connectivity') : [],
      features_list: hasElectronics ? getChecked('features') : [],
      rarity: val('f-rarity'),
      acq_date: val('f-acq-date'), acq_source: val('f-acq-source'),
      docs_url: val('f-docs-url'), source_repo: val('f-source-repo'),
      sold_at: collectSoldAt(), purchase_url: val('f-purchase-url'),
      links: collectLinks(),
      slug: val('f-slug'), status: val('f-status'), notes: val('f-notes'),
      images: images.map(function (img) {
        return { fileObject: img.fileObject || null, originalFilename: img.originalFilename || null, filename: img.filename, caption: img.caption, highlight: !!img.highlight };
      }),
      videos: videos.map(function (v) {
        return { fileObject: v.fileObject || null, originalFilename: v.originalFilename || null, filename: v.filename, caption: v.caption, highlight: !!v.highlight };
      }),
    };
    if (editingBadge) { fields.original_con = editingBadge.con; fields.original_slug = editingBadge.slug; }
    return fields;
  }

  // -------------------------------------------------------------------------
  // Preview
  // -------------------------------------------------------------------------

  function tagHtml(cls, text) { return '<span class="tag' + (cls ? ' ' + cls : '') + '">' + esc(text) + '</span>'; }
  function tagList(values) { return (values || []).map(function (v) { return tagHtml('', v); }).join(' '); }
  function specRow(label, valueHtml) { return '<div class="spec-row"><div class="spec-label">' + esc(label) + '</div><div class="spec-value">' + valueHtml + '</div></div>'; }

  function inlineMarkdown(s) {
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return s;
  }

  function renderNotesMarkdown(src) {
    if (!src || !src.trim()) return '<p><em>No notes yet.</em></p>';
    var lines = src.split(/\r?\n/), out = [], inList = false, paragraph = [];
    function flushP() { if (paragraph.length) { out.push('<p>' + paragraph.join(' ') + '</p>'); paragraph = []; } }
    function closeList() { if (inList) { out.push('</ul>'); inList = false; } }
    lines.forEach(function (line) {
      var t = line.trim();
      if (!t) { flushP(); closeList(); return; }
      var h = t.match(/^(#{1,3})\s+(.*)$/);
      if (h) { flushP(); closeList(); out.push('<h' + (h[1].length + 1) + '>' + inlineMarkdown(h[2]) + '</h' + (h[1].length + 1) + '>'); return; }
      var li = t.match(/^[-*]\s+(.*)$/);
      if (li) { flushP(); if (!inList) { out.push('<ul>'); inList = true; } out.push('<li>' + inlineMarkdown(li[1]) + '</li>'); return; }
      closeList(); paragraph.push(inlineMarkdown(t));
    });
    flushP(); closeList();
    return out.join('\n');
  }

  function renderFullPreview(fields) {
    var badgeType = fields.badge_type || '';
    var creditTag = fields.group || (fields.makers && fields.makers[0]) || '';
    var tags = [];
    if (badgeType) tags.push(tagHtml('tag-type-' + badgeType, badgeType.toUpperCase()));
    if (fields.con) tags.push(tagHtml('tag-con-' + fields.con, fields.con.toUpperCase()));
    if (creditTag) tags.push(tagHtml('tag-credit', creditTag));
    if (fields.year) tags.push(tagHtml('', fields.year));
    if (fields.edition) tags.push(tagHtml('', fields.edition));
    if (fields.status === 'stub') tags.push(tagHtml('tag-status-stub', 'stub'));
    if (fields.status === 'complete') tags.push(tagHtml('tag-status-complete', 'complete'));

    var highlightedImage = images.find(function (i) { return i.highlight; }) || null;
    var highlightedVideo = videos.find(function (v) { return v.highlight; }) || null;
    var otherVideos = highlightedVideo ? videos.filter(function (v) { return v !== highlightedVideo; }) : videos;

    function videoHtml(v) {
      var cap = v.caption ? '<div class="badge-video-caption">' + esc(v.caption) + '</div>' : '';
      return '<video class="badge-video" src="' + esc(v.objectUrl) + '" autoplay muted loop playsinline controls></video>' + cap;
    }

    var heroVideoHtml = highlightedVideo ? '<div class="badge-videos">' + videoHtml(highlightedVideo) + '</div>' : '';
    var galleryHtml = '';
    if (images.length) {
      var mainImg = highlightedImage || images[0];
      galleryHtml = '<div class="gallery-main"><img id="preview-gallery-img" src="' + esc(mainImg.objectUrl) + '" alt=""></div>';
      if (images.length > 1) {
        galleryHtml += '<div class="gallery-thumbs">' + images.map(function (img) {
          return '<div class="gallery-thumb' + (img === mainImg ? ' active' : '') + '" data-src="' + esc(img.objectUrl) + '"><img src="' + esc(img.objectUrl) + '" alt=""></div>';
        }).join('') + '</div>';
      }
    } else if (!highlightedVideo) {
      galleryHtml = '<div class="gallery-main"><div class="gallery-main-placeholder">[ no images yet ]</div></div>';
    }

    var videosHtml = otherVideos.length ? '<div class="badge-videos">' + otherVideos.map(videoHtml).join('') + '</div>' : '';

    var links = [];
    if (fields.docs_url) links.push('<a class="source-link" href="' + esc(fields.docs_url) + '" target="_blank" rel="noopener">📄 Documentation</a>');
    if (fields.source_repo) links.push('<a class="source-link" href="' + esc(fields.source_repo) + '" target="_blank" rel="noopener">Source / Repo</a>');
    (fields.sold_at || []).forEach(function (e) { if (e.url) links.push('<a class="source-link" href="' + esc(e.url) + '" target="_blank" rel="noopener">⊕ ' + esc(e.vendor || 'Buy') + '</a>'); });
    var youtubeEmbeds = [];
    (fields.links || []).forEach(function (lk) {
      if (!lk.url) return;
      if (lk.type === 'youtube') {
        var ytId = youtubeEmbedId(lk.url);
        if (ytId) youtubeEmbeds.push('<div class="badge-youtube"><iframe src="https://www.youtube.com/embed/' + esc(ytId) + '" allowfullscreen></iframe>' + (lk.label ? '<div class="badge-video-caption">' + esc(lk.label) + '</div>' : '') + '</div>');
      } else {
        links.push('<a class="source-link" href="' + esc(lk.url) + '" target="_blank" rel="noopener">🔗 ' + esc(lk.label || lk.url) + '</a>');
      }
    });

    var specs = [];
    if (fields.makers && fields.makers.length) specs.push(specRow('Maker' + (fields.makers.length > 1 ? 's' : ''), esc(fields.makers.join(', '))));
    if (fields.group) specs.push(specRow('Group', esc(fields.group)));
    if (fields.event) specs.push(specRow('Event', esc(fields.event)));
    if (fields.year) specs.push(specRow('Year', esc(fields.year)));
    if (fields.edition) specs.push(specRow('Edition', esc(fields.edition)));
    if (!fields.has_electronics) specs.push(specRow('Electronics', 'None (entry / art badge)'));
    if (fields.mcu) specs.push(specRow('MCU', '<span class="font-mono">' + esc(fields.mcu) + '</span>'));
    if (fields.display && fields.display !== 'none') specs.push(specRow('Display', esc(fields.display)));
    if (fields.battery_type && fields.battery_type !== 'none') specs.push(specRow('Battery', esc(fields.battery_type) + (fields.battery_cell ? ' &middot; ' + esc(fields.battery_cell) : '')));
    if (fields.power_sources && fields.power_sources.length) specs.push(specRow('Power in', tagList(fields.power_sources)));
    if (fields.current_ma) specs.push(specRow('Current draw', '<span class="font-mono">' + esc(fields.current_ma) + ' mA</span>'));
    if (badgeType === 'sao' && fields.sao_version) specs.push(specRow('SAO version', '<span class="font-mono">' + esc(fields.sao_version) + '</span>'));
    if (badgeType === 'sao' && fields.sao_implements && fields.sao_implements.length) specs.push(specRow('SAO pins used', tagList(fields.sao_implements)));
    if (badgeType === 'minibadge' && fields.minibadge_implements && fields.minibadge_implements.length) specs.push(specRow('MB implements', tagList(fields.minibadge_implements)));
    if (fields.sao_port_count > 0) { specs.push(specRow('SAO ports', String(fields.sao_port_count))); var saoSigs = (fields.sao_port_power ? [tagHtml('', fields.sao_port_power)] : []).concat((fields.sao_port_features || []).map(function (s) { return tagHtml('', s); })); if (saoSigs.length) specs.push(specRow('SAO port signals', saoSigs.join(' '))); }
    if (fields.mb_port_count > 0) { specs.push(specRow('MB ports', String(fields.mb_port_count))); var mbSigs = (fields.mb_port_power ? [tagHtml('', fields.mb_port_power)] : []).concat((fields.mb_port_features || []).map(function (s) { return tagHtml('', s); })); if (mbSigs.length) specs.push(specRow('MB port signals', mbSigs.join(' '))); }
    if (fields.interface && fields.interface !== 'none') specs.push(specRow('USB', esc(fields.interface)));
    if (fields.programming && fields.programming !== 'none') specs.push(specRow('Programming', '<span class="font-mono">' + esc(fields.programming) + '</span>'));
    if (fields.connectivity && fields.connectivity.length) specs.push(specRow('Wireless', tagList(fields.connectivity)));
    if (fields.features_list && fields.features_list.length) specs.push(specRow('Features', tagList(fields.features_list)));
    if (fields.rarity) specs.push(specRow('Rarity', esc(fields.rarity)));
    if (fields.acq_date || fields.acq_source) specs.push(specRow('Acquired', [fields.acq_date, fields.acq_source].filter(Boolean).map(esc).join(' &middot; ')));

    var html =
      '<div class="breadcrumb">museum <span class="sep">/</span> ' + esc(badgeType || 'other') + ' <span class="sep">/</span> ' + esc(fields.title || '(untitled)') + '</div>' +
      '<div class="badge-detail-header"><h1>' + esc(fields.title || '(untitled)') + '</h1>' +
      '<div class="badge-detail-meta-row">' + tags.join(' ') + '</div></div>' +
      '<div class="badge-detail-body">' +
        '<div class="badge-detail-left">' + heroVideoHtml + '<div class="badge-gallery">' + galleryHtml + '</div>' + videosHtml + (youtubeEmbeds.length ? youtubeEmbeds.join('') : '') + (links.length ? '<div class="badge-links">' + links.join('') + '</div>' : '') + '</div>' +
        '<div class="badge-specs"><div class="specs-header">Specifications</div>' + specs.join('') + '</div>' +
      '</div>' +
      '<div class="badge-notes"><h2>Notes</h2><div class="badge-notes-content">' + renderNotesMarkdown(fields.notes) + '</div></div>';

    var previewEl = document.getElementById('preview-render');
    previewEl.innerHTML = html;
    previewEl.querySelectorAll('.gallery-thumb').forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        var mainImg = previewEl.querySelector('#preview-gallery-img');
        if (mainImg) mainImg.src = thumb.dataset.src;
        previewEl.querySelectorAll('.gallery-thumb').forEach(function (t) { t.classList.remove('active'); });
        thumb.classList.add('active');
      });
    });
  }

  function updatePreview() {
    var fields = collectFields();
    renderFullPreview(fields);
    if (previewMode === 'raw') {
      document.getElementById('preview-content').textContent = buildFrontmatter(fields);
    }
  }

  function setPreviewMode(mode) {
    previewMode = mode;
    document.getElementById('preview-mode-rendered').classList.toggle('active', mode === 'rendered');
    document.getElementById('preview-mode-raw').classList.toggle('active', mode === 'raw');
    document.getElementById('preview-render').hidden = mode !== 'rendered';
    document.getElementById('preview-content').hidden = mode !== 'raw';
    if (mode === 'raw') document.getElementById('preview-content').textContent = buildFrontmatter(collectFields());
  }

  function scheduleFieldsChanged() { updateConditionalVisibility(); updateAutoSlug(); updatePreview(); }

  // -------------------------------------------------------------------------
  // Browse panel
  // -------------------------------------------------------------------------

  var browseGroup = null;

  function badgeCredit(b) { return b.group || (b.makers && b.makers[0]) || ''; }

  function openBrowsePanel() {
    document.getElementById('browse-overlay').hidden = false;
    document.getElementById('browse-search').value = '';
    document.getElementById('browse-search').focus();
    browseGroup = null;
    document.getElementById('browse-list').innerHTML = '<p class="text-muted">Loading badges…</p>';
    listBadges().then(function (data) { allBadgesList = data; renderBrowseView(); }).catch(function () { allBadgesList = []; renderBrowseView(); });
  }

  function closeBrowsePanel() { document.getElementById('browse-overlay').hidden = true; }

  function renderBrowseView() {
    var q = document.getElementById('browse-search').value.trim().toLowerCase();
    if (q) {
      var container = document.getElementById('browse-list'); container.innerHTML = '';
      renderBadgeRows(allBadgesList.filter(function (b) {
        return (b.title + ' ' + b.con + ' ' + (b.group || '') + ' ' + (b.makers || []).join(' ')).toLowerCase().indexOf(q) !== -1;
      }), container);
    } else if (browseGroup === null) {
      renderGroupsList();
    } else {
      renderGroupBadges(browseGroup);
    }
  }

  function renderGroupsList() {
    var container = document.getElementById('browse-list'); container.innerHTML = '';
    if (!allBadgesList.length) { container.innerHTML = '<p class="text-muted">No badges found.</p>'; return; }
    var groups = {};
    allBadgesList.forEach(function (b) { var c = badgeCredit(b) || '(no maker/group)'; (groups[c] = groups[c] || []).push(b); });
    var names = Object.keys(groups).sort(function (a, b) {
      if (a === '(no maker/group)') return 1; if (b === '(no maker/group)') return -1;
      return a.localeCompare(b);
    });
    var allRow = document.createElement('div'); allRow.className = 'browse-row browse-row-group';
    allRow.innerHTML = '<div class="browse-info"><div class="browse-title">All badges</div><div class="browse-meta text-muted">' + allBadgesList.length + ' total</div></div><div class="browse-chevron">›</div>';
    allRow.addEventListener('click', function () { browseGroup = true; renderBrowseView(); });
    container.appendChild(allRow);
    names.forEach(function (name) {
      var badges = groups[name];
      var row = document.createElement('div'); row.className = 'browse-row browse-row-group';
      var thumb = document.createElement('div'); thumb.className = 'browse-thumb'; thumb.textContent = '—';
      var info = document.createElement('div'); info.className = 'browse-info';
      info.innerHTML = '<div class="browse-title">' + esc(name) + '</div><div class="browse-meta text-muted">' + badges.length + ' badge' + (badges.length === 1 ? '' : 's') + '</div>';
      var chev = document.createElement('div'); chev.className = 'browse-chevron'; chev.textContent = '›';
      row.appendChild(thumb); row.appendChild(info); row.appendChild(chev);
      row.addEventListener('click', function () { browseGroup = name; renderBrowseView(); });
      container.appendChild(row);
    });
  }

  function renderGroupBadges(name) {
    var container = document.getElementById('browse-list'); container.innerHTML = '';
    var back = document.createElement('button'); back.type = 'button'; back.className = 'browse-back'; back.textContent = '‹ All groups';
    back.addEventListener('click', function () { browseGroup = null; renderBrowseView(); });
    container.appendChild(back);
    var heading = document.createElement('div'); heading.className = 'browse-group-heading';
    heading.textContent = name === true ? 'All badges' : name;
    container.appendChild(heading);
    var badges = name === true ? allBadgesList : allBadgesList.filter(function (b) { return (badgeCredit(b) || '(no maker/group)') === name; });
    renderBadgeRows(badges, container);
  }

  function renderBadgeRows(list, container) {
    if (!list.length) { var empty = document.createElement('p'); empty.className = 'text-muted'; empty.textContent = 'No badges found.'; container.appendChild(empty); return; }
    list.forEach(function (b) {
      var row = document.createElement('div'); row.className = 'browse-row';
      var thumb = document.createElement('div'); thumb.className = 'browse-thumb'; thumb.textContent = '—';
      var info = document.createElement('div'); info.className = 'browse-info';
      info.innerHTML = '<div class="browse-title">' + esc(b.title) + '</div><div class="browse-meta text-muted">' + esc(b.con) + ' &middot; ' + esc(b.year) + ' &middot; ' + esc(b.type) + ' &middot; ' + esc(b.status) + '</div>';
      var actions = document.createElement('div'); actions.className = 'browse-actions';
      var editBtn = document.createElement('button'); editBtn.type = 'button'; editBtn.className = 'btn-secondary'; editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', function () { loadBadge(b.con, b.slug, b.slugHandle, 'edit'); });
      var dupBtn = document.createElement('button'); dupBtn.type = 'button'; dupBtn.className = 'btn-secondary'; dupBtn.textContent = 'Duplicate';
      dupBtn.addEventListener('click', function () { loadBadge(b.con, b.slug, b.slugHandle, 'duplicate'); });
      actions.appendChild(editBtn); actions.appendChild(dupBtn);
      row.appendChild(thumb); row.appendChild(info); row.appendChild(actions);
      container.appendChild(row);
    });
  }

  async function loadBadge(con, slug, slugHandle, mode) {
    var data;
    try {
      data = await getBadgeFields(con, slug);
    } catch (e) {
      setStatus('Failed to load badge: ' + e.message, true);
      return;
    }
    // Load existing image/video files as objectURLs for the edit preview
    if (mode === 'edit' && slugHandle) {
      var loadedImages = [];
      for (var i = 0; i < data.images.length; i++) {
        var img = data.images[i];
        var objUrl = '';
        try {
          var fh = await slugHandle.getFileHandle(img.filename);
          var f = await fh.getFile();
          objUrl = URL.createObjectURL(f);
        } catch (e) { /* file not found, skip thumbnail */ }
        loadedImages.push({ filename: img.filename, caption: img.caption, objectUrl: objUrl, fileObject: null, originalFilename: img.filename, highlight: img.highlight });
      }
      data.images = loadedImages;
      var loadedVideos = [];
      for (var j = 0; j < data.videos.length; j++) {
        var vid = data.videos[j];
        var vUrl = '';
        try {
          var vfh = await slugHandle.getFileHandle(vid.filename);
          var vf = await vfh.getFile();
          vUrl = URL.createObjectURL(vf);
        } catch (e) { /* skip */ }
        loadedVideos.push({ filename: vid.filename, caption: vid.caption, objectUrl: vUrl, fileObject: null, originalFilename: vid.filename, highlight: vid.highlight, error: null });
      }
      data.videos = loadedVideos;
    } else {
      data.images = [];
      data.videos = [];
    }
    applyLoadedFields(data, mode);
    closeBrowsePanel();
  }

  // -------------------------------------------------------------------------
  // Reset / load form
  // -------------------------------------------------------------------------

  function resetForm() {
    form.reset();
    Object.keys(CHECKBOX_GROUPS).forEach(function (key) {
      CHECKBOX_GROUPS[key].querySelectorAll('input[type=checkbox]').forEach(function (cb) { cb.checked = false; });
    });
    document.getElementById('sold-at-list').innerHTML = '';
    document.getElementById('links-list').innerHTML = '';
    images.forEach(function (img) { if (img.objectUrl && img.objectUrl.startsWith('blob:')) URL.revokeObjectURL(img.objectUrl); });
    images = [];
    renderImageList();
    videos.forEach(function (v) { if (v.objectUrl && v.objectUrl.startsWith('blob:')) URL.revokeObjectURL(v.objectUrl); });
    videos = [];
    renderVideoList();
    editingBadge = null; slugTouched = false; dirty = false;
    document.getElementById('save-result').hidden = true;
    setStatus('', false);
    updateEditingBanner();
    scheduleFieldsChanged();
  }

  function applyLoadedFields(data, mode) {
    resetForm();
    var title = data.title || '';
    if (mode === 'duplicate' && title && !/ COPY$/.test(title)) title += ' COPY';
    setVal('f-title', title);
    setVal('f-year', data.year);
    setSelectValue('f-con', data.con);
    setSelectValue('f-badge_type', data.badge_type);
    setVal('f-event', data.event);
    setSelectValue('f-edition', data.edition);
    setVal('f-makers', (data.makers || []).join(', '));
    setVal('f-group', data.group);
    document.getElementById('f-has-electronics').checked = !!data.has_electronics;
    setVal('f-mcu', data.mcu);
    setSelectValue('f-display', data.display);
    setCheckedValues('power_sources', data.power_sources);
    setSelectValue('f-battery_type', data.battery_type);
    setSelectValue('f-battery_cell', data.battery_cell);
    setVal('f-current-ma', data.current_ma);
    setSelectValue('f-sao_version', data.sao_version);
    setCheckedValues('sao_implements', data.sao_implements);
    setCheckedValues('minibadge_implements', data.minibadge_implements);
    document.getElementById('f-has-sao-ports').checked = !!(data.sao_port_count > 0);
    setVal('f-sao-port-count', data.sao_port_count || 1);
    setCheckedValues('sao_port_features', data.sao_port_features);
    setSelectValue('f-sao_port_power', data.sao_port_power);
    document.getElementById('f-has-mb-ports').checked = !!(data.mb_port_count > 0);
    setVal('f-mb-port-count', data.mb_port_count || 1);
    setCheckedValues('minibadge_port_features', data.mb_port_features);
    setSelectValue('f-mb_port_power', data.mb_port_power);
    setSelectValue('f-interface', data.interface);
    setSelectValue('f-programming', data.programming);
    setCheckedValues('connectivity', data.connectivity);
    setCheckedValues('features', data.features_list);
    setSelectValue('f-rarity', data.rarity);
    setVal('f-acq-date', data.acq_date);
    setVal('f-acq-source', data.acq_source);
    setVal('f-docs-url', data.docs_url);
    setVal('f-source-repo', data.source_repo);
    (data.sold_at || []).forEach(function (e) { addSoldAtRow(e.vendor, e.url); });
    setVal('f-purchase-url', data.purchase_url);
    (data.links || []).forEach(function (lk) { addLinkRow(lk.label, lk.url, lk.type); });
    setVal('f-notes', data.notes);
    setSelectValue('f-status', mode === 'edit' ? data.status : 'stub');

    if (mode === 'edit') {
      editingBadge = { con: data.con, slug: data.slug };
      images = data.images || [];
      videos = data.videos || [];
      slugTouched = true;
      setVal('f-slug', data.slug);
    } else {
      editingBadge = null; images = []; videos = []; slugTouched = false;
    }
    renderImageList(); renderVideoList(); updateEditingBanner(); dirty = false;
    scheduleFieldsChanged();
  }

  function updateEditingBanner() {
    var banner = document.getElementById('editing-banner');
    var saveBtn = document.getElementById('save-btn');
    if (editingBadge) {
      banner.hidden = false;
      banner.innerHTML = 'Editing <strong>' + esc(editingBadge.con + '/' + editingBadge.slug) + '</strong> — <a href="#" id="cancel-edit">cancel &amp; start new</a>';
      document.getElementById('cancel-edit').addEventListener('click', function (e) { e.preventDefault(); resetForm(); });
      saveBtn.textContent = 'Save changes';
    } else {
      banner.hidden = true; saveBtn.textContent = 'Save badge to disk';
    }
  }

  // -------------------------------------------------------------------------
  // Wiring
  // -------------------------------------------------------------------------

  function wireStaticControls() {
    form.addEventListener('input', function () { markDirty(); scheduleFieldsChanged(); });
    form.addEventListener('change', function () { markDirty(); scheduleFieldsChanged(); });
    document.getElementById('f-slug').addEventListener('input', function () { slugTouched = true; });
    document.getElementById('browse-btn').addEventListener('click', openBrowsePanel);
    document.getElementById('browse-close').addEventListener('click', closeBrowsePanel);
    document.getElementById('browse-overlay').addEventListener('click', function (e) { if (e.target.id === 'browse-overlay') closeBrowsePanel(); });
    document.getElementById('browse-search').addEventListener('input', renderBrowseView);
    document.getElementById('preview-mode-rendered').addEventListener('click', function () { setPreviewMode('rendered'); });
    document.getElementById('preview-mode-raw').addEventListener('click', function () { setPreviewMode('raw'); });
    document.getElementById('preview-popout').addEventListener('click', function () {
      var mainCss = (document.querySelector('link[rel=stylesheet]') || {}).href || '';
      var win = window.open('', '_blank', 'width=900,height=1000');
      if (!win) return;
      win.document.write('<!DOCTYPE html><html><head><title>Badge preview</title><link rel="stylesheet" href="' + mainCss + '"><style>body{max-width:900px;margin:0 auto;padding:24px;} .badge-detail-body{grid-template-columns:1fr;}</style></head><body>' + document.getElementById('preview-render').innerHTML + '</body></html>');
      win.document.close();
    });
    var dropzone = document.getElementById('dropzone');
    var fileInput = document.getElementById('file-input');
    dropzone.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () { addFiles(fileInput.files); fileInput.value = ''; });
    dropzone.addEventListener('dragover', function (e) { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', function () { dropzone.classList.remove('dragover'); });
    dropzone.addEventListener('drop', function (e) { e.preventDefault(); dropzone.classList.remove('dragover'); addFiles(e.dataTransfer.files); });
    document.getElementById('add-sold-at').addEventListener('click', function () { markDirty(); addSoldAtRow(); });
    document.getElementById('add-link').addEventListener('click', function () { markDirty(); addLinkRow(); });
    window.addEventListener('beforeunload', function (e) { if (!dirty) return; e.preventDefault(); e.returnValue = ''; return ''; });
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = document.getElementById('save-btn');
      btn.disabled = true;
      setStatus('Saving…', false);
      var fields = collectFields();
      try {
        var result = await saveBadge(fields);
        dirty = false;
        setStatus('Saved.', false);
        editingBadge = { con: result.con, slug: result.slug };
        updateEditingBanner();
        var resultEl = document.getElementById('save-result');
        resultEl.hidden = false;
        resultEl.innerHTML = '<div>Wrote <code>_badges/' + esc(result.con) + '/' + esc(result.slug) + '/index.md</code>.</div>' +
          '<div>Run these yourself to commit:</div>' +
          '<pre>git add _badges/' + esc(result.con) + '/' + esc(result.slug) + '\ngit commit -m "' + (editingBadge ? 'Update' : 'Add') + ' badge: ' + esc(fields.title) + '"</pre>';
      } catch (err) {
        setStatus(err.message || 'Save failed', true);
      } finally {
        btn.disabled = false;
      }
    });
  }

  // Check browser support on load
  if (!window.showDirectoryPicker) {
    document.getElementById('not-supported-banner').hidden = false;
    document.getElementById('open-repo-btn').disabled = true;
  }

})();
