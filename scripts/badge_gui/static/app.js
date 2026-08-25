(function () {
  'use strict';

  var OPTIONS = {};
  var CHECKBOX_GROUPS = {};
  var images = [];       // { filename, caption, objectUrl, draftFilename, originalFilename }
  var videos = [];       // { filename, caption, objectUrl, draftFilename, originalFilename, converting, error }
  var dragSrcIndex = null;
  var videoDragSrcIndex = null;
  var slugTouched = false;
  var previewTimer = null;
  var previewMode = 'rendered'; // or 'raw'
  var editingBadge = null;      // { con, slug } when editing an on-disk badge
  var dirty = false;
  var allBadgesList = [];

  var ALLOW_BLANK = { edition: true, programming: true, rarity: true };

  var form = document.getElementById('badge-form');

  // ---------------------------------------------------------------------
  // Connectivity — fetch() only rejects on a real network failure (server
  // not running, connection refused), never on an HTTP error status, so
  // this is exactly the signal to show a "backend unreachable" banner.
  // ---------------------------------------------------------------------

  function syncOfflineBannerLayout() {
    var banner = document.getElementById('server-offline-banner');
    // Reserve exactly as much space as the (possibly multi-line, resizable)
    // banner actually renders at, so it's fixed-on-top without covering
    // the header underneath it.
    document.body.style.paddingTop = banner.hidden ? '' : banner.offsetHeight + 'px';
  }

  function setServerOnline(online) {
    var banner = document.getElementById('server-offline-banner');
    var wasHidden = banner.hidden;
    banner.hidden = online;
    if (wasHidden !== banner.hidden) syncOfflineBannerLayout();
  }

  function apiFetch(url, opts) {
    return fetch(url, opts).then(
      function (r) { setServerOnline(true); return r; },
      function (err) { setServerOnline(false); throw err; }
    );
  }

  window.addEventListener('resize', syncOfflineBannerLayout);

  // Poll a cheap endpoint every few seconds so the banner shows up as soon
  // as the server goes away, rather than only the next time some user
  // action happens to hit the network (e.g. dropping a photo).
  setInterval(function () { apiFetch('/api/ping').catch(function () {}); }, 4000);

  // ---------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------

  apiFetch('/api/options')
    .then(function (r) { return r.json(); })
    .then(function (data) { OPTIONS = data; init(); })
    .catch(function (err) {
      document.getElementById('preview-render').textContent = 'Failed to load options: ' + err.message;
    });

  function init() {
    buildAllSelects();
    buildAllCheckboxGroups();
    populateDatalist('dl-makers', OPTIONS.makers);
    populateDatalist('dl-groups', OPTIONS.group);
    populateDatalist('dl-mcu', OPTIONS.mcu);
    var meta = OPTIONS._meta || {};
    document.getElementById('ffmpeg-notice').hidden = !!meta.ffmpeg_available;
    wireStaticControls();
    scheduleFieldsChanged();
  }

  // ---------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  }

  function setVal(id, v) {
    var el = document.getElementById(id);
    if (el) el.value = (v === undefined || v === null) ? '' : v;
  }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function splitCsv(s) {
    return s.split(',').map(function (p) { return p.trim(); }).filter(Boolean);
  }

  function markDirty() { dirty = true; }

  // ---------------------------------------------------------------------
  // Generic "select with add new" control
  // ---------------------------------------------------------------------

  function buildAllSelects() {
    document.querySelectorAll('[data-select-field]').forEach(function (labelEl) {
      var optionsKey = labelEl.dataset.selectField;
      var fieldId = labelEl.dataset.selectId || optionsKey;
      buildSelectField(labelEl, optionsKey, fieldId, !!ALLOW_BLANK[fieldId]);
    });
  }

  function buildSelectField(labelEl, optionsKey, fieldId, allowBlank) {
    var wrap = document.createElement('div');
    wrap.className = 'select-add-wrap';

    var select = document.createElement('select');
    select.id = 'f-' + fieldId;

    if (allowBlank) appendOpt(select, '', '(none)');
    (OPTIONS[optionsKey] || []).forEach(function (v) { appendOpt(select, v, v); });

    var addOpt = document.createElement('option');
    addOpt.value = '__add__';
    addOpt.textContent = '+ Add new…';
    select.appendChild(addOpt);

    var addInput = document.createElement('input');
    addInput.type = 'text';
    addInput.placeholder = 'Type a new value, press Enter';
    addInput.className = 'select-add-new-input';

    var fallback = select.options[0] ? select.options[0].value : '';

    select.addEventListener('change', function () {
      if (select.value === '__add__') {
        addInput.classList.add('active');
        addInput.focus();
      } else {
        addInput.classList.remove('active');
      }
    });

    function commitNew() {
      var v = addInput.value.trim();
      addInput.classList.remove('active');
      if (!v) { select.value = fallback; return; }
      ensureOption(v);
      select.value = v;
      addInput.value = '';
      scheduleFieldsChanged();
    }

    function ensureOption(v) {
      var exists = Array.from(select.options).some(function (o) { return o.value === v; });
      if (!exists) {
        var opt = document.createElement('option');
        opt.value = v; opt.textContent = v;
        select.insertBefore(opt, addOpt);
      }
    }

    addInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commitNew(); }
      if (e.key === 'Escape') { addInput.value = ''; addInput.classList.remove('active'); select.value = fallback; }
    });
    addInput.addEventListener('blur', commitNew);

    wrap.appendChild(select);
    wrap.appendChild(addInput);
    labelEl.appendChild(wrap);

    select._ensureOption = ensureOption;
    return select;
  }

  function appendOpt(select, value, label) {
    var opt = document.createElement('option');
    opt.value = value; opt.textContent = label;
    select.appendChild(opt);
  }

  function setSelectValue(id, value) {
    var select = document.getElementById(id);
    if (!select) return;
    value = value === undefined || value === null ? '' : String(value);
    if (value && select._ensureOption) select._ensureOption(value);
    select.value = value;
  }

  // ---------------------------------------------------------------------
  // Generic "checkbox group with add new" control
  // ---------------------------------------------------------------------

  function buildAllCheckboxGroups() {
    document.querySelectorAll('[data-checkbox-field]').forEach(buildCheckboxGroup);
  }

  function buildCheckboxGroup(container) {
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
      var optLabel = document.createElement('label');
      optLabel.className = 'checkbox-option';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = value;
      cb.checked = !!checked;
      var span = document.createElement('span');
      span.textContent = value;
      optLabel.appendChild(cb);
      optLabel.appendChild(span);
      optionsWrap.appendChild(optLabel);
      return cb;
    }

    values.forEach(function (v) { addOption(v, false); });

    var addRow = document.createElement('div');
    addRow.className = 'checkbox-add-row';
    var addInput = document.createElement('input');
    addInput.type = 'text';
    addInput.placeholder = '+ add new…';
    var addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn-secondary';
    addBtn.textContent = 'Add';
    addRow.appendChild(addInput);
    addRow.appendChild(addBtn);
    container.appendChild(addRow);

    function commitAdd() {
      var v = addInput.value.trim();
      if (!v) return;
      setChecked(v, true);
      addInput.value = '';
      scheduleFieldsChanged();
    }
    addBtn.addEventListener('click', commitAdd);
    addInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); commitAdd(); } });

    function setChecked(value, checked) {
      var existing = Array.from(optionsWrap.querySelectorAll('input[type=checkbox]'))
        .find(function (cb) { return cb.value === value; });
      if (existing) { existing.checked = checked; return; }
      if (checked) addOption(value, true);
    }

    container._getChecked = function () {
      return Array.from(optionsWrap.querySelectorAll('input[type=checkbox]:checked')).map(function (cb) { return cb.value; });
    };
    container._setChecked = setChecked;

    CHECKBOX_GROUPS[key] = container;
  }

  function getChecked(key) {
    return CHECKBOX_GROUPS[key] ? CHECKBOX_GROUPS[key]._getChecked() : [];
  }

  function setCheckedValues(key, values) {
    var group = CHECKBOX_GROUPS[key];
    if (!group) return;
    (values || []).forEach(function (v) { group._setChecked(v, true); });
  }

  // Show/hide (and uncheck if hiding) one option within a checkbox group —
  // used to restrict "sao" vs "minibadge" as a power source depending on
  // which kind of device is selected.
  function setOptionVisible(groupKey, value, visible) {
    var group = CHECKBOX_GROUPS[groupKey];
    if (!group) return;
    var cb = Array.from(group.querySelectorAll('input[type=checkbox]')).find(function (c) { return c.value === value; });
    if (!cb) return;
    var optLabel = cb.closest('.checkbox-option');
    if (optLabel) optLabel.hidden = !visible;
    if (!visible && cb.checked) cb.checked = false;
  }

  function populateDatalist(id, values) {
    var dl = document.getElementById(id);
    if (!dl) return;
    dl.innerHTML = '';
    (values || []).forEach(function (v) {
      var o = document.createElement('option');
      o.value = v;
      dl.appendChild(o);
    });
  }

  // ---------------------------------------------------------------------
  // Conditional field visibility — mirrors the branching in badge_cli.py
  // ---------------------------------------------------------------------

  function updateConditionalVisibility() {
    var badgeType = val('f-badge_type');
    var hasElectronicsCb = document.getElementById('f-has-electronics');

    if (badgeType === 'entry') {
      hasElectronicsCb.checked = false;
      hasElectronicsCb.disabled = true;
    } else if (badgeType === 'sao' || badgeType === 'minibadge') {
      hasElectronicsCb.checked = true;
      hasElectronicsCb.disabled = true;
    } else {
      hasElectronicsCb.disabled = false;
    }

    var hasElectronics = hasElectronicsCb.checked;
    document.getElementById('electronics-fields').hidden = !hasElectronics;

    var isSaoOrMb = badgeType === 'sao' || badgeType === 'minibadge';
    document.getElementById('power-sources-group').hidden = !isSaoOrMb;
    document.getElementById('sao-device-fields').hidden = badgeType !== 'sao';
    document.getElementById('minibadge-device-fields').hidden = badgeType !== 'minibadge';
    document.getElementById('current-ma-field').hidden = !isSaoOrMb;

    // "sao"/"minibadge" as a power source are mutually exclusive — only the
    // one matching the current device type is offered.
    setOptionVisible('power_sources', 'sao', badgeType === 'sao');
    setOptionVisible('power_sources', 'minibadge', badgeType === 'minibadge');

    var powerSources = getChecked('power_sources');
    var showBattery = !isSaoOrMb || powerSources.indexOf('battery') !== -1;
    var batteryType = val('f-battery_type');
    document.getElementById('battery-cell-field').hidden = !showBattery || batteryType === 'none';

    document.getElementById('sao-ports-fields').hidden = !document.getElementById('f-has-sao-ports').checked;
    document.getElementById('mb-ports-fields').hidden = !document.getElementById('f-has-mb-ports').checked;
  }

  // ---------------------------------------------------------------------
  // Slug auto-fill — {group or creator}-{title}-{year}, matching the
  // repo's real convention (con is the parent directory, not part of slug)
  // ---------------------------------------------------------------------

  function slugify(s) {
    return s
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/[\s-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function updateAutoSlug() {
    if (slugTouched) return;
    var group = val('f-group').trim();
    var makers = splitCsv(val('f-makers'));
    var creatorPart = group || makers[0] || '';
    var slugField = document.getElementById('f-slug');
    slugField.value = slugify([creatorPart, val('f-title'), val('f-year')].filter(Boolean).join('-'));
  }

  // ---------------------------------------------------------------------
  // Photos: dropzone, upload, reorder
  // ---------------------------------------------------------------------

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
      var entry = { filename: filename, caption: '', objectUrl: URL.createObjectURL(file), draftFilename: null, originalFilename: null, highlight: false };
      images.push(entry);
      renderImageList();
      apiFetch('/api/upload-image?name=' + encodeURIComponent(filename), { method: 'POST', body: file })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.filename) entry.draftFilename = data.filename;
          scheduleFieldsChanged();
        })
        .catch(function () {
          setStatus('Upload failed for ' + filename, true);
        });
    });
  }

  function addVideoFile(file) {
    markDirty();
    var filename = sanitizeFilename(file.name).replace(/\.[^.]+$/, '') + '.mp4';
    var entry = {
      filename: filename,
      caption: '',
      objectUrl: URL.createObjectURL(file),
      draftFilename: null,
      originalFilename: null,
      converting: true,
      error: null,
      highlight: false
    };
    videos.push(entry);
    renderVideoList();

    apiFetch('/api/upload-video?name=' + encodeURIComponent(filename), { method: 'POST', body: file })
      .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
      .then(function (res) {
        entry.converting = false;
        if (!res.ok) {
          entry.error = res.data.error || 'Video conversion failed';
          setStatus(entry.error, true);
        } else {
          entry.draftFilename = res.data.filename;
        }
        renderVideoList();
        scheduleFieldsChanged();
      })
      .catch(function () {
        entry.converting = false;
        entry.error = 'Upload failed';
        renderVideoList();
        setStatus('Video upload failed for ' + filename, true);
      });
  }

  // Only one image or video across both lists is ever "the highlight" —
  // the one used as the card-grid thumbnail and shown first on the badge
  // page. Setting one clears any other.
  function setHighlight(kind, index) {
    images.forEach(function (img, i) { img.highlight = (kind === 'image' && i === index); });
    videos.forEach(function (vid, i) { vid.highlight = (kind === 'video' && i === index); });
    markDirty();
    renderImageList();
    renderVideoList();
    scheduleFieldsChanged();
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
    var container = document.getElementById('image-list');
    container.innerHTML = '';
    images.forEach(function (img, idx) {
      var card = document.createElement('div');
      card.className = 'image-card' + (img.highlight ? ' highlighted' : '');
      card.draggable = true;

      var thumb = document.createElement('img');
      thumb.src = img.objectUrl;
      card.appendChild(thumb);

      var body = document.createElement('div');
      body.className = 'image-card-body';

      body.appendChild(buildHighlightButton(img, 'image', idx));

      var nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = img.filename;
      nameInput.addEventListener('change', function () {
        img.filename = nameInput.value.trim() || img.filename;
        markDirty();
        scheduleFieldsChanged();
      });

      var capInput = document.createElement('input');
      capInput.type = 'text';
      capInput.placeholder = 'Caption';
      capInput.value = img.caption || '';
      capInput.addEventListener('change', function () {
        img.caption = capInput.value;
        markDirty();
        scheduleFieldsChanged();
      });

      var removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'image-card-remove';
      removeBtn.textContent = img.originalFilename ? '✕ remove from list' : '✕ remove';
      removeBtn.addEventListener('click', function () {
        images.splice(idx, 1);
        markDirty();
        renderImageList();
        scheduleFieldsChanged();
      });

      body.appendChild(nameInput);
      body.appendChild(capInput);
      body.appendChild(removeBtn);
      card.appendChild(body);

      card.addEventListener('dragstart', function () { dragSrcIndex = idx; card.classList.add('dragging'); });
      card.addEventListener('dragend', function () { card.classList.remove('dragging'); });
      card.addEventListener('dragover', function (e) { e.preventDefault(); });
      card.addEventListener('drop', function (e) {
        e.preventDefault();
        if (dragSrcIndex === null || dragSrcIndex === idx) return;
        var moved = images.splice(dragSrcIndex, 1)[0];
        images.splice(idx, 0, moved);
        dragSrcIndex = null;
        markDirty();
        renderImageList();
        scheduleFieldsChanged();
      });

      container.appendChild(card);
    });
  }

  function renderVideoList() {
    var container = document.getElementById('video-list');
    container.innerHTML = '';
    videos.forEach(function (vid, idx) {
      var card = document.createElement('div');
      card.className = 'video-card' + (vid.converting ? ' converting' : '') + (vid.error ? ' error' : '') + (vid.highlight ? ' highlighted' : '');
      card.draggable = !vid.converting;

      var preview = document.createElement('video');
      preview.src = vid.objectUrl;
      preview.muted = true;
      preview.loop = true;
      preview.playsInline = true;
      if (!vid.converting) preview.autoplay = true;
      card.appendChild(preview);

      var body = document.createElement('div');
      body.className = 'video-card-body';

      if (!vid.converting && !vid.error) body.appendChild(buildHighlightButton(vid, 'video', idx));

      var nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = vid.filename;
      nameInput.addEventListener('change', function () {
        vid.filename = nameInput.value.trim() || vid.filename;
        markDirty();
        scheduleFieldsChanged();
      });

      var capInput = document.createElement('input');
      capInput.type = 'text';
      capInput.placeholder = 'Caption';
      capInput.value = vid.caption || '';
      capInput.addEventListener('change', function () {
        vid.caption = capInput.value;
        markDirty();
        scheduleFieldsChanged();
      });

      var status = document.createElement('div');
      status.className = 'video-card-status' + (vid.error ? ' error' : '');
      status.textContent = vid.converting ? 'Converting…' : (vid.error || (vid.originalFilename ? '' : 'Ready'));

      var removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'video-card-remove';
      removeBtn.textContent = vid.originalFilename ? '✕ remove from list' : '✕ remove';
      removeBtn.addEventListener('click', function () {
        videos.splice(idx, 1);
        markDirty();
        renderVideoList();
        scheduleFieldsChanged();
      });

      body.appendChild(nameInput);
      body.appendChild(capInput);
      if (status.textContent) body.appendChild(status);
      body.appendChild(removeBtn);
      card.appendChild(body);

      card.addEventListener('dragstart', function () { videoDragSrcIndex = idx; card.classList.add('dragging'); });
      card.addEventListener('dragend', function () { card.classList.remove('dragging'); });
      card.addEventListener('dragover', function (e) { e.preventDefault(); });
      card.addEventListener('drop', function (e) {
        e.preventDefault();
        if (videoDragSrcIndex === null || videoDragSrcIndex === idx) return;
        var moved = videos.splice(videoDragSrcIndex, 1)[0];
        videos.splice(idx, 0, moved);
        videoDragSrcIndex = null;
        markDirty();
        renderVideoList();
        scheduleFieldsChanged();
      });

      container.appendChild(card);
    });
  }

  // ---------------------------------------------------------------------
  // Sold-at vendor rows
  // ---------------------------------------------------------------------

  function addSoldAtRow(vendor, url) {
    var list = document.getElementById('sold-at-list');
    var row = document.createElement('div');
    row.className = 'sold-at-row';

    var vendorInput = document.createElement('input');
    vendorInput.type = 'text';
    vendorInput.placeholder = 'Vendor';
    vendorInput.value = vendor || '';

    var urlInput = document.createElement('input');
    urlInput.type = 'url';
    urlInput.placeholder = 'https://…';
    urlInput.value = url || '';

    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'sold-at-remove';
    removeBtn.title = 'Remove';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', function () {
      row.remove();
      markDirty();
      scheduleFieldsChanged();
    });

    row.appendChild(vendorInput);
    row.appendChild(urlInput);
    row.appendChild(removeBtn);
    list.appendChild(row);
  }

  function collectSoldAt() {
    return Array.from(document.querySelectorAll('#sold-at-list .sold-at-row'))
      .map(function (row) {
        var inputs = row.querySelectorAll('input');
        return { vendor: inputs[0].value.trim(), url: inputs[1].value.trim() };
      })
      .filter(function (e) { return e.vendor || e.url; });
  }

  // ---------------------------------------------------------------------
  // Collect fields (shared by preview + save)
  // ---------------------------------------------------------------------

  function collectFields() {
    var badgeType = val('f-badge_type');
    var hasElectronics = document.getElementById('f-has-electronics').checked;
    var isSaoOrMb = badgeType === 'sao' || badgeType === 'minibadge';
    var batteryType = hasElectronics ? val('f-battery_type') : 'none';
    var hasSaoPorts = document.getElementById('f-has-sao-ports').checked;
    var hasMbPorts = document.getElementById('f-has-mb-ports').checked;

    var fields = {
      title: val('f-title'),
      year: val('f-year'),
      con: val('f-con'),
      event: val('f-event'),
      badge_type: badgeType,
      edition: val('f-edition'),
      makers: splitCsv(val('f-makers')),
      group: val('f-group'),
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
      acq_date: val('f-acq-date'),
      acq_source: val('f-acq-source'),
      docs_url: val('f-docs-url'),
      source_repo: val('f-source-repo'),
      sold_at: collectSoldAt(),
      purchase_url: val('f-purchase-url'),
      slug: val('f-slug'),
      status: val('f-status'),
      notes: val('f-notes'),
      images: images.map(function (img) {
        return {
          draft_filename: img.draftFilename || null,
          original_filename: img.originalFilename || null,
          filename: img.filename,
          caption: img.caption,
          highlight: !!img.highlight
        };
      }),
      // Videos still converting or that failed have nothing to reference yet.
      videos: videos.filter(function (v) { return v.draftFilename || v.originalFilename; }).map(function (v) {
        return {
          draft_filename: v.draftFilename || null,
          original_filename: v.originalFilename || null,
          filename: v.filename,
          caption: v.caption,
          highlight: !!v.highlight
        };
      })
    };

    if (editingBadge) {
      fields.original_con = editingBadge.con;
      fields.original_slug = editingBadge.slug;
    }
    return fields;
  }

  // ---------------------------------------------------------------------
  // Preview: rendered (mirrors _layouts/badge.html) + raw YAML
  // ---------------------------------------------------------------------

  function tagHtml(cls, text) {
    return '<span class="tag' + (cls ? ' ' + cls : '') + '">' + esc(text) + '</span>';
  }

  function tagList(values) {
    return (values || []).map(function (v) { return tagHtml('', v); }).join(' ');
  }

  function specRow(label, valueHtml) {
    return '<div class="spec-row"><div class="spec-label">' + esc(label) + '</div><div class="spec-value">' + valueHtml + '</div></div>';
  }

  function inlineMarkdown(s) {
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return s;
  }

  // Small approximation of kramdown, just enough for typical badge notes
  // (paragraphs, headers, lists, bold/italic/code/links). Not a full
  // Markdown implementation.
  function renderNotesMarkdown(src) {
    if (!src || !src.trim()) return '<p><em>No notes yet.</em></p>';
    var lines = src.split(/\r?\n/);
    var out = [];
    var inList = false;
    var paragraph = [];

    function flushParagraph() {
      if (paragraph.length) { out.push('<p>' + paragraph.join(' ') + '</p>'); paragraph = []; }
    }
    function closeList() {
      if (inList) { out.push('</ul>'); inList = false; }
    }

    lines.forEach(function (line) {
      var trimmed = line.trim();
      if (!trimmed) { flushParagraph(); closeList(); return; }

      var heading = trimmed.match(/^(#{1,3})\s+(.*)$/);
      if (heading) {
        flushParagraph(); closeList();
        var level = heading[1].length + 1;
        out.push('<h' + level + '>' + inlineMarkdown(heading[2]) + '</h' + level + '>');
        return;
      }

      var item = trimmed.match(/^[-*]\s+(.*)$/);
      if (item) {
        flushParagraph();
        if (!inList) { out.push('<ul>'); inList = true; }
        out.push('<li>' + inlineMarkdown(item[1]) + '</li>');
        return;
      }

      closeList();
      paragraph.push(inlineMarkdown(trimmed));
    });
    flushParagraph();
    closeList();
    return out.join('\n');
  }

  function renderFullPreview(fields) {
    var badgeType = fields.badge_type || '';

    // Credit tag: group name, or the first maker if there's no group.
    var creditTag = fields.group || (fields.makers && fields.makers[0]) || '';

    var tags = [];
    if (badgeType) tags.push(tagHtml('tag-type-' + badgeType, badgeType.toUpperCase()));
    if (fields.con) tags.push(tagHtml('tag-con-' + fields.con, fields.con.toUpperCase()));
    if (creditTag) tags.push(tagHtml('tag-credit', creditTag));
    if (fields.year) tags.push(tagHtml('', fields.year));
    if (fields.edition) tags.push(tagHtml('', fields.edition));
    if (fields.status === 'stub') tags.push(tagHtml('tag-status-stub', 'stub'));
    if (fields.status === 'complete') tags.push(tagHtml('tag-status-complete', 'complete'));

    // The highlighted item (at most one, image or video) leads: a
    // highlighted video becomes a hero clip above the gallery (mirroring
    // _layouts/badge.html); a highlighted image becomes the gallery's main
    // image. Falls back to "first of whichever exists" when nothing is
    // explicitly highlighted, same as before this feature existed.
    var readyVideos = videos.filter(function (v) { return !v.converting; });
    var highlightedImage = images.find(function (i) { return i.highlight; }) || null;
    var highlightedVideo = readyVideos.find(function (v) { return v.highlight; }) || null;
    var otherVideos = highlightedVideo ? readyVideos.filter(function (v) { return v !== highlightedVideo; }) : readyVideos;

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
    (fields.sold_at || []).forEach(function (e) {
      if (e.url) links.push('<a class="source-link" href="' + esc(e.url) + '" target="_blank" rel="noopener">⊕ ' + esc(e.vendor || 'Buy') + '</a>');
    });

    var specs = [];
    if (fields.makers && fields.makers.length) {
      specs.push(specRow('Maker' + (fields.makers.length > 1 ? 's' : ''), esc(fields.makers.join(', '))));
    }
    if (fields.group) specs.push(specRow('Group', esc(fields.group)));
    if (fields.event) specs.push(specRow('Event', esc(fields.event)));
    if (fields.year) specs.push(specRow('Year', esc(fields.year)));
    if (fields.edition) specs.push(specRow('Edition', esc(fields.edition)));
    if (!fields.has_electronics) specs.push(specRow('Electronics', 'None (entry / art badge)'));
    if (fields.mcu) specs.push(specRow('MCU', '<span class="font-mono">' + esc(fields.mcu) + '</span>'));
    if (fields.display && fields.display !== 'none') specs.push(specRow('Display', esc(fields.display)));
    if (fields.battery_type && fields.battery_type !== 'none') {
      specs.push(specRow('Battery', esc(fields.battery_type) + (fields.battery_cell ? ' &middot; ' + esc(fields.battery_cell) : '')));
    }
    if (fields.power_sources && fields.power_sources.length) specs.push(specRow('Power in', tagList(fields.power_sources)));
    if (fields.current_ma) specs.push(specRow('Current draw', '<span class="font-mono">' + esc(fields.current_ma) + ' mA</span>'));
    if (badgeType === 'sao' && fields.sao_version) specs.push(specRow('SAO version', '<span class="font-mono">' + esc(fields.sao_version) + '</span>'));
    if (badgeType === 'sao' && fields.sao_implements && fields.sao_implements.length) specs.push(specRow('SAO pins used', tagList(fields.sao_implements)));
    if (badgeType === 'minibadge' && fields.minibadge_implements && fields.minibadge_implements.length) specs.push(specRow('MB implements', tagList(fields.minibadge_implements)));
    if (fields.sao_port_count > 0) {
      specs.push(specRow('SAO ports', String(fields.sao_port_count)));
      var saoSignals = (fields.sao_port_power ? [tagHtml('', fields.sao_port_power)] : []).concat((fields.sao_port_features || []).map(function (s) { return tagHtml('', s); }));
      if (saoSignals.length) specs.push(specRow('SAO port signals', saoSignals.join(' ')));
    }
    if (fields.mb_port_count > 0) {
      specs.push(specRow('MB ports', String(fields.mb_port_count)));
      var mbSignals = (fields.mb_port_power ? [tagHtml('', fields.mb_port_power)] : []).concat((fields.mb_port_features || []).map(function (s) { return tagHtml('', s); }));
      if (mbSignals.length) specs.push(specRow('MB port signals', mbSignals.join(' ')));
    }
    if (fields.interface && fields.interface !== 'none') specs.push(specRow('USB', esc(fields.interface)));
    if (fields.programming && fields.programming !== 'none') specs.push(specRow('Programming', '<span class="font-mono">' + esc(fields.programming) + '</span>'));
    if (fields.connectivity && fields.connectivity.length) specs.push(specRow('Wireless', tagList(fields.connectivity)));
    if (fields.features_list && fields.features_list.length) specs.push(specRow('Features', tagList(fields.features_list)));
    if (fields.rarity) specs.push(specRow('Rarity', esc(fields.rarity)));
    if (fields.acq_date || fields.acq_source) {
      specs.push(specRow('Acquired', [fields.acq_date, fields.acq_source].filter(Boolean).map(esc).join(' &middot; ')));
    }

    var html =
      '<div class="breadcrumb">museum <span class="sep">/</span> ' + esc(badgeType || 'other') + ' <span class="sep">/</span> ' + esc(fields.title || '(untitled)') + '</div>' +
      '<div class="badge-detail-header"><h1>' + esc(fields.title || '(untitled)') + '</h1>' +
      '<div class="badge-detail-meta-row">' + tags.join(' ') + '</div></div>' +
      '<div class="badge-detail-body">' +
        '<div class="badge-detail-left">' +
          heroVideoHtml +
          '<div class="badge-gallery">' + galleryHtml + '</div>' +
          videosHtml +
          (links.length ? '<div class="badge-links">' + links.join('') + '</div>' : '') +
        '</div>' +
        '<div class="badge-specs"><div class="specs-header">Specifications</div>' + specs.join('') + '</div>' +
      '</div>' +
      '<div class="badge-notes"><h2>Notes</h2><div class="badge-notes-content">' + renderNotesMarkdown(fields.notes) + '</div></div>';

    var previewEl = document.getElementById('preview-render');
    previewEl.innerHTML = html;
    wireGalleryThumbs(previewEl);
  }

  function wireGalleryThumbs(scope) {
    var mainImg = scope.querySelector('#preview-gallery-img');
    scope.querySelectorAll('.gallery-thumb').forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        if (mainImg) mainImg.src = thumb.dataset.src;
        scope.querySelectorAll('.gallery-thumb').forEach(function (t) { t.classList.remove('active'); });
        thumb.classList.add('active');
      });
    });
  }

  function fetchRawPreview(fields) {
    apiFetch('/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields)
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        document.getElementById('preview-content').textContent = data.content || data.error || '';
      })
      .catch(function () {});
  }

  function updatePreview() {
    var fields = collectFields();
    renderFullPreview(fields);
    if (previewMode === 'raw') {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(function () { fetchRawPreview(fields); }, 250);
    }
  }

  function setPreviewMode(mode) {
    previewMode = mode;
    document.getElementById('preview-mode-rendered').classList.toggle('active', mode === 'rendered');
    document.getElementById('preview-mode-raw').classList.toggle('active', mode === 'raw');
    document.getElementById('preview-render').hidden = mode !== 'rendered';
    document.getElementById('preview-content').hidden = mode !== 'raw';
    if (mode === 'raw') fetchRawPreview(collectFields());
  }

  function scheduleFieldsChanged() {
    updateConditionalVisibility();
    updateAutoSlug();
    updatePreview();
  }

  function setStatus(message, isError) {
    var status = document.getElementById('save-status');
    status.textContent = message;
    status.className = 'save-status' + (isError ? ' error' : message ? ' ok' : '');
  }

  // ---------------------------------------------------------------------
  // Browse / edit / duplicate an existing badge
  // ---------------------------------------------------------------------

  function openBrowsePanel() {
    document.getElementById('browse-overlay').hidden = false;
    document.getElementById('browse-search').value = '';
    document.getElementById('browse-search').focus();
    apiFetch('/api/badges')
      .then(function (r) { return r.json(); })
      .then(function (data) { allBadgesList = data; renderBrowseList(data); })
      .catch(function () { renderBrowseList([]); });
  }

  function closeBrowsePanel() {
    document.getElementById('browse-overlay').hidden = true;
  }

  function renderBrowseList(list) {
    var container = document.getElementById('browse-list');
    container.innerHTML = '';
    if (!list.length) {
      container.innerHTML = '<p class="text-muted">No badges found.</p>';
      return;
    }
    list.forEach(function (b) {
      var row = document.createElement('div');
      row.className = 'browse-row';

      var thumb = document.createElement('div');
      thumb.className = 'browse-thumb';
      if (b.thumbnail_url) {
        var img = document.createElement('img');
        img.src = b.thumbnail_url;
        thumb.appendChild(img);
      } else {
        thumb.textContent = '—';
      }

      var info = document.createElement('div');
      info.className = 'browse-info';
      info.innerHTML = '<div class="browse-title">' + esc(b.title) + '</div>' +
        '<div class="browse-meta text-muted">' + esc(b.con) + ' &middot; ' + esc(b.year) + ' &middot; ' + esc(b.type) + ' &middot; ' + esc(b.status) + '</div>';

      var actions = document.createElement('div');
      actions.className = 'browse-actions';
      var editBtn = document.createElement('button');
      editBtn.type = 'button'; editBtn.className = 'btn-secondary'; editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', function () { loadBadge(b.con, b.slug, 'edit'); });
      var dupBtn = document.createElement('button');
      dupBtn.type = 'button'; dupBtn.className = 'btn-secondary'; dupBtn.textContent = 'Duplicate';
      dupBtn.addEventListener('click', function () { loadBadge(b.con, b.slug, 'duplicate'); });
      actions.appendChild(editBtn);
      actions.appendChild(dupBtn);

      row.appendChild(thumb);
      row.appendChild(info);
      row.appendChild(actions);
      container.appendChild(row);
    });
  }

  function loadBadge(con, slug, mode) {
    apiFetch('/api/badge?con=' + encodeURIComponent(con) + '&slug=' + encodeURIComponent(slug))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) { setStatus(data.error, true); return; }
        applyLoadedFields(data, mode);
        closeBrowsePanel();
      })
      .catch(function (err) { setStatus(err.message, true); });
  }

  function resetForm() {
    form.reset();
    Object.keys(CHECKBOX_GROUPS).forEach(function (key) {
      CHECKBOX_GROUPS[key].querySelectorAll('input[type=checkbox]').forEach(function (cb) { cb.checked = false; });
    });
    document.getElementById('sold-at-list').innerHTML = '';
    images.forEach(function (img) { if (img.objectUrl && img.objectUrl.indexOf('blob:') === 0) URL.revokeObjectURL(img.objectUrl); });
    images = [];
    renderImageList();
    videos.forEach(function (v) { if (v.objectUrl && v.objectUrl.indexOf('blob:') === 0) URL.revokeObjectURL(v.objectUrl); });
    videos = [];
    renderVideoList();
    editingBadge = null;
    slugTouched = false;
    dirty = false;
    document.getElementById('save-result').hidden = true;
    setStatus('', false);
    updateEditingBanner();
    scheduleFieldsChanged();
  }

  function applyLoadedFields(data, mode) {
    resetForm();

    setVal('f-title', data.title);
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
    setVal('f-notes', data.notes);

    setSelectValue('f-status', mode === 'edit' ? data.status : 'stub');

    if (mode === 'edit') {
      editingBadge = { con: data.con, slug: data.slug };
      images = (data.images || []).map(function (img) {
        return {
          filename: img.filename,
          originalFilename: img.filename,
          caption: img.caption || '',
          objectUrl: '/assets/badges/' + data.con + '/' + data.slug + '/' + img.filename,
          draftFilename: null,
          highlight: !!img.highlight
        };
      });
      videos = (data.videos || []).map(function (vid) {
        return {
          filename: vid.filename,
          originalFilename: vid.filename,
          caption: vid.caption || '',
          objectUrl: '/assets/badges/' + data.con + '/' + data.slug + '/' + vid.filename,
          draftFilename: null,
          converting: false,
          error: null,
          highlight: !!vid.highlight
        };
      });
      slugTouched = true;
      setVal('f-slug', data.slug);
    } else {
      // Duplicate: a different physical item, so start without the
      // original's photos/video and let the slug recompute once the
      // title/year are updated.
      editingBadge = null;
      images = [];
      videos = [];
      slugTouched = false;
    }

    renderImageList();
    renderVideoList();
    updateEditingBanner();
    dirty = false;
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
      banner.hidden = true;
      saveBtn.textContent = 'Save badge to disk';
    }
  }

  // ---------------------------------------------------------------------
  // Wiring
  // ---------------------------------------------------------------------

  function wireStaticControls() {
    form.addEventListener('input', function () { markDirty(); scheduleFieldsChanged(); });
    form.addEventListener('change', function () { markDirty(); scheduleFieldsChanged(); });

    document.getElementById('f-slug').addEventListener('input', function () { slugTouched = true; });

    document.getElementById('server-offline-retry').addEventListener('click', function () { location.reload(); });

    document.getElementById('browse-btn').addEventListener('click', openBrowsePanel);
    document.getElementById('browse-close').addEventListener('click', closeBrowsePanel);
    document.getElementById('browse-overlay').addEventListener('click', function (e) {
      if (e.target.id === 'browse-overlay') closeBrowsePanel();
    });
    document.getElementById('browse-search').addEventListener('input', function () {
      var q = this.value.trim().toLowerCase();
      if (!q) { renderBrowseList(allBadgesList); return; }
      renderBrowseList(allBadgesList.filter(function (b) {
        return (b.title + ' ' + b.con + ' ' + (b.group || '') + ' ' + (b.makers || []).join(' ')).toLowerCase().indexOf(q) !== -1;
      }));
    });

    document.getElementById('preview-mode-rendered').addEventListener('click', function () { setPreviewMode('rendered'); });
    document.getElementById('preview-mode-raw').addEventListener('click', function () { setPreviewMode('raw'); });
    document.getElementById('preview-popout').addEventListener('click', function () {
      var win = window.open('', '_blank', 'width=900,height=1000');
      if (!win) return;
      win.document.write(
        '<!DOCTYPE html><html><head><title>Badge preview</title>' +
        '<link rel="stylesheet" href="/assets/css/main.css">' +
        '<style>body{max-width:900px;margin:0 auto;padding:24px;} .badge-detail-body{grid-template-columns:1fr;}</style>' +
        '</head><body>' + document.getElementById('preview-render').innerHTML + '</body></html>'
      );
      win.document.close();
    });

    var dropzone = document.getElementById('dropzone');
    var fileInput = document.getElementById('file-input');
    dropzone.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () { addFiles(fileInput.files); fileInput.value = ''; });
    dropzone.addEventListener('dragover', function (e) { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', function () { dropzone.classList.remove('dragover'); });
    dropzone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      addFiles(e.dataTransfer.files);
    });

    document.getElementById('add-sold-at').addEventListener('click', function () { markDirty(); addSoldAtRow(); });

    window.addEventListener('beforeunload', function (e) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
      return '';
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (videos.some(function (v) { return v.converting; })) {
        setStatus('Still converting a video — wait for it to finish before saving.', true);
        return;
      }
      var btn = document.getElementById('save-btn');
      btn.disabled = true;
      setStatus('Saving…', false);
      var fields = collectFields();

      apiFetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields)
      })
        .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.data.error || 'Save failed');
          dirty = false;
          setStatus('Saved.', false);
          editingBadge = { con: res.data.con, slug: res.data.slug };
          updateEditingBanner();
          var resultEl = document.getElementById('save-result');
          resultEl.hidden = false;
          resultEl.innerHTML =
            '<div>Wrote <code>' + res.data.badge_dir + '/index.md</code> and assets to <code>' + res.data.assets_dir + '/</code>.</div>' +
            '<div>Run these yourself to commit — nothing is committed automatically:</div>' +
            '<pre>' + res.data.git_commands.join('\n') + '</pre>';
        })
        .catch(function (err) { setStatus(err.message, true); })
        .finally(function () { btn.disabled = false; });
    });
  }
})();
