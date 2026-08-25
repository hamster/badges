---
layout: default
title: Home
---

{% assign all_badges  = site.badges | sort: "year" | reverse %}
{% assign badge_count = all_badges | size %}
{% assign full_count  = all_badges | where: "type", "badge"      | size %}
{% assign sao_count   = all_badges | where: "type", "sao"        | size %}
{% assign mini_count  = all_badges | where: "type", "minibadge"  | size %}
{% assign sa_count    = all_badges | where: "type", "standalone" | size %}
{% assign entry_count = all_badges | where: "type", "entry"      | size %}
{% assign other_count = all_badges | where: "type", "other"      | size %}

<div class="page-header">
  <p class="lead">My personal museum of electronic conference badges — from DEF CON, SAINTCON, and beyond — that I actually own, cataloged with photos, specs, and source links. Notice something missing or wrong? <a href="https://github.com/{{ site.repository }}">Please submit a PR.</a></p>
</div>

<div class="stats-bar">
  <div class="stat-item">
    <span class="stat-value">{{ badge_count }}</span>
    <span class="stat-label">Total</span>
  </div>
  <div class="stat-item">
    <span class="stat-value">{{ full_count }}</span>
    <span class="stat-label">Badges</span>
  </div>
  <div class="stat-item">
    <span class="stat-value">{{ sao_count }}</span>
    <span class="stat-label">SAOs</span>
  </div>
  <div class="stat-item">
    <span class="stat-value">{{ mini_count }}</span>
    <span class="stat-label">Minibadges</span>
  </div>
</div>

{% if badge_count == 0 %}
<div class="empty-state">
  <div class="empty-state-icon">📡</div>
  <p>No badges cataloged yet.</p>
  <p>Run <code>python scripts/badge_cli/badge_cli.py</code> to add the first one.</p>
</div>
{% else %}

<div class="category-strip" id="type-strip">
  <button class="cat-chip active" data-type="">All ({{ badge_count }})</button>
  {% if full_count  > 0 %}<button class="cat-chip" data-type="badge">Badges ({{ full_count }})</button>{% endif %}
  {% if sao_count   > 0 %}<button class="cat-chip" data-type="sao">SAOs ({{ sao_count }})</button>{% endif %}
  {% if mini_count  > 0 %}<button class="cat-chip" data-type="minibadge">Minibadges ({{ mini_count }})</button>{% endif %}
  {% if sa_count    > 0 %}<button class="cat-chip" data-type="standalone">Standalone ({{ sa_count }})</button>{% endif %}
  {% if entry_count > 0 %}<button class="cat-chip" data-type="entry">Entry ({{ entry_count }})</button>{% endif %}
  {% if other_count > 0 %}<button class="cat-chip" data-type="other">Other ({{ other_count }})</button>{% endif %}
</div>

<div class="filter-bar">
  <input type="search" id="filter-search" class="filter-input" placeholder="Search title, maker, group…">
  <select id="filter-year" class="filter-select"><option value="">Any year</option></select>
  <select id="filter-con"  class="filter-select"><option value="">Any con</option></select>
  <select id="filter-sort" class="filter-select">
    <option value="year-desc">Year ↓</option>
    <option value="year-asc">Year ↑</option>
    <option value="title-asc">Title A–Z</option>
    <option value="title-desc">Title Z–A</option>
    <option value="group-asc">Group A–Z</option>
    <option value="group-desc">Group Z–A</option>
    <option value="maker-asc">Maker A–Z</option>
    <option value="maker-desc">Maker Z–A</option>
  </select>

  <div class="filter-advanced">
    <button type="button" id="filter-advanced-toggle" class="filter-advanced-toggle">
      Advanced filters <span id="advanced-count-badge" class="advanced-count-badge" hidden>0</span>
    </button>
  </div>

  <div class="view-toggle" role="group" aria-label="View">
    <button type="button" id="view-grid" class="view-btn active" title="Grid view">▦ Grid</button>
    <button type="button" id="view-table" class="view-btn" title="Table view">☰ Table</button>
  </div>

  <div class="columns-wrap">
    <button type="button" id="columns-toggle" class="filter-clear" hidden>Columns ▾</button>
    <div id="columns-panel" class="columns-panel" hidden></div>
  </div>

  <span class="filter-results" id="filter-results"></span>
  <button id="filter-clear" class="filter-clear" hidden>✕ clear</button>
</div>

<div id="filter-advanced-panel" class="filter-advanced-panel" hidden>
  <div id="filter-advanced-panel-inner" class="filter-advanced-panel-inner"></div>
</div>

<div class="badge-grid" id="badge-grid">
  {% for badge in all_badges %}
    {% include badge-card.html badge=badge %}
  {% endfor %}
</div>

<div class="badge-table-wrap" id="badge-table-wrap" hidden>
  <table class="badge-table" id="badge-table">
    <thead id="badge-table-head"></thead>
    <tbody id="badge-table-body"></tbody>
  </table>
</div>

<script>
(function () {
  var grid        = document.getElementById('badge-grid');
  var searchInput = document.getElementById('filter-search');
  var yearSelect  = document.getElementById('filter-year');
  var conSelect   = document.getElementById('filter-con');
  var sortSelect  = document.getElementById('filter-sort');
  var clearBtn    = document.getElementById('filter-clear');
  var resultsEl   = document.getElementById('filter-results');
  var typeChips   = Array.from(document.querySelectorAll('#type-strip .cat-chip'));

  var advToggle      = document.getElementById('filter-advanced-toggle');
  var advPanel       = document.getElementById('filter-advanced-panel');
  var advPanelInner  = document.getElementById('filter-advanced-panel-inner');
  var advCountBadge  = document.getElementById('advanced-count-badge');

  var viewGridBtn   = document.getElementById('view-grid');
  var viewTableBtn  = document.getElementById('view-table');
  var tableWrap     = document.getElementById('badge-table-wrap');
  var tableHead     = document.getElementById('badge-table-head');
  var tableBody     = document.getElementById('badge-table-body');
  var columnsToggle = document.getElementById('columns-toggle');
  var columnsPanel  = document.getElementById('columns-panel');

  var activeType = '';
  var cards = Array.from(grid.querySelectorAll('.badge-card'));

  function uniqueSorted(arr) {
    return arr.filter(function(v, i, a) { return v && a.indexOf(v) === i; }).sort();
  }
  function appendOption(select, value, label) {
    var opt = document.createElement('option');
    opt.value = value; opt.textContent = label;
    select.appendChild(opt);
  }

  // Populate year and con selects from card data attributes
  var years = uniqueSorted(cards.map(function(c) { return c.dataset.year; })).reverse();
  var cons  = uniqueSorted(cards.map(function(c) { return c.dataset.con;  }));
  years.forEach(function(y) { appendOption(yearSelect, y, y); });
  cons.forEach( function(c) { appendOption(conSelect,  c, c); });

  // ===== Advanced parametric filter (Digikey-style multi-select facets) =====

  var FACETS = [
    { key: 'con',          label: 'Con',             multi: false },
    { key: 'group',        label: 'Group',           multi: false },
    { key: 'makers',       label: 'Maker',           multi: true, separator: '|' },
    { key: 'acqSource',    label: 'Acquired from',   multi: false },
    { key: 'edition',      label: 'Edition',         multi: false },
    { key: 'mcu',          label: 'MCU',             multi: false },
    { key: 'display',      label: 'Display',         multi: false },
    { key: 'interface',    label: 'USB',             multi: false },
    { key: 'programming',  label: 'Programming',     multi: false },
    { key: 'rarity',       label: 'Rarity',          multi: false },
    { key: 'status',       label: 'Status',          multi: false },
    { key: 'power',        label: 'Power',           multi: true },
    { key: 'connectivity', label: 'Wireless',        multi: true },
    { key: 'features',     label: 'Other features',  multi: true },
    { key: 'saoMinibadge', label: 'SAO / Minibadge', multi: true },
    { key: 'flags',        label: 'Flags',           multi: true, options: [
        { value: 'has-docs',   label: 'Has docs' },
        { value: 'has-repo',   label: 'Has repo/source' },
        { value: 'has-vendor', label: 'Has vendor/purchase link' },
        { value: 'has-notes',  label: 'Has notes' }
      ] }
  ];

  var activeFacets = {};
  FACETS.forEach(function (f) { activeFacets[f.key] = new Set(); });

  function cardFacetValues(card, facet) {
    var raw = card.dataset[facet.key] || '';
    if (!raw) return [];
    if (!facet.multi) return [raw];
    return raw.split(facet.separator || /\s+/).filter(Boolean);
  }

  // Build each facet column from the values actually present in the collection —
  // laid out side by side like Digikey's parametric search, each column its own
  // scrollable list, rather than a single narrow dropdown. A facet can instead
  // supply a fixed `options` list (value + display label) — used for the Flags
  // column, whose values are computed booleans rather than discovered strings.
  FACETS.forEach(function (facet) {
    var values; // [{ value, label }]
    if (facet.options) {
      var present = {};
      cards.forEach(function (card) {
        cardFacetValues(card, facet).forEach(function (v) { present[v] = true; });
      });
      values = facet.options.filter(function (opt) { return present[opt.value]; });
    } else {
      var all = [];
      cards.forEach(function (card) { all = all.concat(cardFacetValues(card, facet)); });
      values = uniqueSorted(all).map(function (v) { return { value: v, label: v }; });
    }
    if (!values.length) return; // nothing to filter on for this facet yet

    var column = document.createElement('div');
    column.className = 'facet-column';

    var header = document.createElement('div');
    header.className = 'facet-column-header';
    header.textContent = facet.label;
    column.appendChild(header);

    // Long lists get a search-within box, same as Digikey's per-facet filter.
    var list = document.createElement('div');
    list.className = 'facet-options';
    if (values.length > 8) {
      var searchWithin = document.createElement('input');
      searchWithin.type = 'search';
      searchWithin.className = 'facet-column-search';
      searchWithin.placeholder = 'Search Filter';
      searchWithin.addEventListener('input', function () {
        var q = searchWithin.value.trim().toLowerCase();
        list.querySelectorAll('.facet-option').forEach(function (opt) {
          var text = opt.querySelector('.facet-option-label').textContent.toLowerCase();
          opt.hidden = q && text.indexOf(q) === -1;
        });
      });
      column.appendChild(searchWithin);
    }

    values.forEach(function (opt) {
      var value = opt.value, optLabel = opt.label;

      var label = document.createElement('label');
      label.className = 'facet-option';
      label.dataset.value = value;

      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = value;
      checkbox.addEventListener('change', function () {
        if (checkbox.checked) activeFacets[facet.key].add(value);
        else activeFacets[facet.key].delete(value);
        applyFilters();
      });

      var text = document.createElement('span');
      text.className = 'facet-option-label';
      text.textContent = optLabel;

      var count = document.createElement('span');
      count.className = 'facet-option-count';
      count.dataset.facet = facet.key;
      count.dataset.value = value;

      label.appendChild(checkbox);
      label.appendChild(text);
      label.appendChild(count);
      list.appendChild(label);
    });
    column.appendChild(list);
    advPanelInner.appendChild(column);
  });

  advToggle.addEventListener('click', function () {
    advPanel.hidden = !advPanel.hidden;
    advToggle.classList.toggle('active', !advPanel.hidden);
  });

  // Does a card pass every active filter except (optionally) one facet's own selection?
  // Excluding a facet from its own check is what lets us show accurate "if you also
  // picked this" counts on its own options.
  function cardMatches(card, exceptFacetKey) {
    if (activeType && card.dataset.type !== activeType) return false;

    var year = yearSelect.value, con = conSelect.value;
    var search = searchInput.value.trim().toLowerCase();
    if (year   && card.dataset.year !== year) return false;
    if (con    && card.dataset.con  !== con)  return false;
    if (search && !(card.dataset.search || '').includes(search)) return false;

    for (var i = 0; i < FACETS.length; i++) {
      var facet = FACETS[i];
      if (facet.key === exceptFacetKey) continue;
      var selected = activeFacets[facet.key];
      if (selected.size === 0) continue;
      var values = cardFacetValues(card, facet);
      if (!values.some(function (v) { return selected.has(v); })) return false;
    }
    return true;
  }

  // ===== Type chips =====
  typeChips.forEach(function(chip) {
    chip.addEventListener('click', function() {
      activeType = chip.dataset.type;
      typeChips.forEach(function(c) { c.classList.toggle('active', c === chip); });
      applyFilters();
    });
  });

  // ===== Simple filter / sort controls =====
  [searchInput, yearSelect, conSelect, sortSelect].forEach(function(el) {
    el.addEventListener('input', applyFilters);
  });

  clearBtn.addEventListener('click', function() {
    activeType = '';
    searchInput.value = '';
    yearSelect.value  = '';
    conSelect.value   = '';
    sortSelect.value  = 'year-desc';
    typeChips.forEach(function(c, i) { c.classList.toggle('active', i === 0); });
    FACETS.forEach(function (f) { activeFacets[f.key].clear(); });
    advPanel.querySelectorAll('input[type=checkbox]').forEach(function (cb) { cb.checked = false; });
    advPanel.querySelectorAll('.facet-column-search').forEach(function (input) { input.value = ''; });
    advPanel.querySelectorAll('.facet-option').forEach(function (opt) { opt.hidden = false; });
    applyFilters();
  });

  function compareBySort(a, b, sort) {
    switch (sort) {
      case 'year-asc':    return (+(a.dataset.year) || 0) - (+(b.dataset.year) || 0);
      case 'title-asc':   return (a.dataset.title || '').localeCompare(b.dataset.title || '');
      case 'title-desc':  return (b.dataset.title || '').localeCompare(a.dataset.title || '');
      case 'group-asc':   return (a.dataset.group || '').localeCompare(b.dataset.group || '');
      case 'group-desc':  return (b.dataset.group || '').localeCompare(a.dataset.group || '');
      case 'maker-asc':   return (a.dataset.creator || '').localeCompare(b.dataset.creator || '');
      case 'maker-desc':  return (b.dataset.creator || '').localeCompare(a.dataset.creator || '');
      default:            return (+(b.dataset.year) || 0) - (+(a.dataset.year) || 0);
    }
  }

  function applyFilters() {
    var sort = sortSelect.value;
    var visible = 0;

    cards.forEach(function(card) {
      var show = cardMatches(card, null);
      card.hidden = !show;
      if (show) visible++;
    });

    // Reorder cards to match chosen sort — shared by both the grid and the table view
    cards.sort(function (a, b) { return compareBySort(a, b, sort); });
    cards.forEach(function(card) { grid.appendChild(card); });

    // Live facet counts: how many results *would* match if this option were also picked
    FACETS.forEach(function (facet) {
      var counts = {};
      cards.forEach(function (card) {
        if (!cardMatches(card, facet.key)) return;
        cardFacetValues(card, facet).forEach(function (v) { counts[v] = (counts[v] || 0) + 1; });
      });
      advPanel.querySelectorAll('.facet-option-count[data-facet="' + facet.key + '"]').forEach(function (el) {
        var n = counts[el.dataset.value] || 0;
        el.textContent = '(' + n + ')';
        var isChecked = activeFacets[facet.key].has(el.dataset.value);
        el.closest('.facet-option').classList.toggle('facet-option-zero', n === 0 && !isChecked);
      });
    });

    var activeFacetCount = FACETS.reduce(function (sum, f) { return sum + activeFacets[f.key].size; }, 0);
    advCountBadge.hidden = activeFacetCount === 0;
    advCountBadge.textContent = activeFacetCount;
    advToggle.classList.toggle('has-active', activeFacetCount > 0);

    var isFiltered = activeType || yearSelect.value || conSelect.value || searchInput.value.trim() || activeFacetCount > 0;
    clearBtn.hidden = !isFiltered;
    resultsEl.textContent = isFiltered ? (visible + ' of ' + cards.length) : '';

    var emptyEl = document.getElementById('filter-empty');
    if (visible === 0 && cards.length > 0) {
      if (!emptyEl) {
        emptyEl = document.createElement('div');
        emptyEl.id = 'filter-empty';
        emptyEl.className = 'empty-state';
        emptyEl.innerHTML = '<p>No badges match the current filters.</p>';
        grid.insertAdjacentElement('afterend', emptyEl);
      }
      emptyEl.hidden = false;
    } else if (emptyEl) {
      emptyEl.hidden = true;
    }

    if (currentView === 'table') renderTable();
  }

  // ===== Grid / table view toggle =====

  var ALL_COLUMNS = [
    { key: 'title',   label: 'Name',       base: true },
    { key: 'creator', label: 'Creator',    base: true },
    { key: 'group',   label: 'Group',      base: true },
    { key: 'year',    label: 'Year',       base: true },
    { key: 'type',    label: 'Type',       base: true },
    { key: 'con',     label: 'Conference', base: true },
    { key: 'mcu',     label: 'MCU',        base: false },
    { key: 'display', label: 'Display',    base: false },
    { key: 'edition', label: 'Edition',    base: false },
    { key: 'status',  label: 'Status',     base: false },
    { key: 'rarity',  label: 'Rarity',     base: false }
  ];
  var SORT_COLUMN_MAP = {
    title:   ['title-asc', 'title-desc'],
    year:    ['year-desc', 'year-asc'],
    group:   ['group-asc', 'group-desc'],
    creator: ['maker-asc', 'maker-desc']
  };

  var savedColumns = null;
  try { savedColumns = JSON.parse(localStorage.getItem('badgeMuseum.columns') || 'null'); } catch (e) {}
  var activeColumns = new Set(savedColumns || ALL_COLUMNS.filter(function (c) { return c.base; }).map(function (c) { return c.key; }));

  function saveColumns() {
    try { localStorage.setItem('badgeMuseum.columns', JSON.stringify(Array.from(activeColumns))); } catch (e) {}
  }

  ALL_COLUMNS.filter(function (c) { return !c.base; }).forEach(function (col) {
    var label = document.createElement('label');
    label.className = 'columns-option';
    var checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = activeColumns.has(col.key);
    checkbox.addEventListener('change', function () {
      if (checkbox.checked) activeColumns.add(col.key); else activeColumns.delete(col.key);
      saveColumns();
      renderTable();
    });
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(' ' + col.label));
    columnsPanel.appendChild(label);
  });

  function renderTable() {
    var columns = ALL_COLUMNS.filter(function (c) { return c.base || activeColumns.has(c.key); });

    tableHead.innerHTML = '';
    var headRow = document.createElement('tr');
    columns.forEach(function (col) {
      var th = document.createElement('th');
      th.textContent = col.label;
      if (SORT_COLUMN_MAP[col.key]) {
        th.className = 'sortable';
        th.addEventListener('click', function () {
          var options = SORT_COLUMN_MAP[col.key];
          sortSelect.value = sortSelect.value === options[0] ? options[1] : options[0];
          applyFilters();
        });
      }
      headRow.appendChild(th);
    });
    tableHead.appendChild(headRow);

    tableBody.innerHTML = '';
    cards.forEach(function (card) {
      if (card.hidden) return;
      var tr = document.createElement('tr');
      tr.addEventListener('click', function () { window.location.href = card.getAttribute('href'); });
      columns.forEach(function (col) {
        var td = document.createElement('td');
        td.className = 'table-col-' + col.key;
        td.textContent = col.key === 'title'
          ? card.querySelector('.badge-card-title').textContent
          : (card.dataset[col.key] || '—');
        tr.appendChild(td);
      });
      tableBody.appendChild(tr);
    });
  }

  var currentView = 'grid';
  try { currentView = localStorage.getItem('badgeMuseum.view') || 'grid'; } catch (e) {}

  function setView(view) {
    currentView = view;
    try { localStorage.setItem('badgeMuseum.view', view); } catch (e) {}
    viewGridBtn.classList.toggle('active', view === 'grid');
    viewTableBtn.classList.toggle('active', view === 'table');
    grid.hidden = view !== 'grid';
    tableWrap.hidden = view !== 'table';
    columnsToggle.hidden = view !== 'table';
    if (view !== 'table') columnsPanel.hidden = true;
    if (view === 'table') renderTable();
  }

  viewGridBtn.addEventListener('click', function () { setView('grid'); });
  viewTableBtn.addEventListener('click', function () { setView('table'); });
  columnsToggle.addEventListener('click', function () { columnsPanel.hidden = !columnsPanel.hidden; });

  applyFilters();
  setView(currentView);
})();
</script>

{% endif %}
