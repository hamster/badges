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
  <h1 class="text-accent font-mono">hamster badge museum</h1>
  <p class="lead">Electronic conference badges from DEF CON, SAINTCON, and beyond — cataloged with photos, specs, and source links.</p>
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
  <p>Run <code>python scripts/new-badge.py</code> to add the first one.</p>
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
  </select>
  <span class="filter-results" id="filter-results"></span>
  <button id="filter-clear" class="filter-clear" hidden>✕ clear</button>
</div>

<div class="badge-grid" id="badge-grid">
  {% for badge in all_badges %}
    {% include badge-card.html badge=badge %}
  {% endfor %}
</div>

<script>
(function () {
  var grid       = document.getElementById('badge-grid');
  var searchInput = document.getElementById('filter-search');
  var yearSelect  = document.getElementById('filter-year');
  var conSelect   = document.getElementById('filter-con');
  var sortSelect  = document.getElementById('filter-sort');
  var clearBtn    = document.getElementById('filter-clear');
  var resultsEl   = document.getElementById('filter-results');
  var typeChips   = Array.from(document.querySelectorAll('#type-strip .cat-chip'));

  var activeType = '';
  var cards = Array.from(grid.querySelectorAll('.badge-card'));

  // Populate year and con selects from card data attributes
  var years = uniqueSorted(cards.map(function(c) { return c.dataset.year; })).reverse();
  var cons  = uniqueSorted(cards.map(function(c) { return c.dataset.con;  }));

  years.forEach(function(y) { appendOption(yearSelect, y, y); });
  cons.forEach( function(c) { appendOption(conSelect,  c, c); });

  function uniqueSorted(arr) {
    return arr.filter(function(v, i, a) { return v && a.indexOf(v) === i; }).sort();
  }
  function appendOption(select, value, label) {
    var opt = document.createElement('option');
    opt.value = value; opt.textContent = label;
    select.appendChild(opt);
  }

  // Type chip clicks
  typeChips.forEach(function(chip) {
    chip.addEventListener('click', function() {
      activeType = chip.dataset.type;
      typeChips.forEach(function(c) { c.classList.toggle('active', c === chip); });
      applyFilters();
    });
  });

  // Filter / sort controls
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
    applyFilters();
  });

  function applyFilters() {
    var search = searchInput.value.trim().toLowerCase();
    var year   = yearSelect.value;
    var con    = conSelect.value;
    var sort   = sortSelect.value;

    var visible = 0;
    cards.forEach(function(card) {
      var show = true;
      if (activeType && card.dataset.type  !== activeType) show = false;
      if (year       && card.dataset.year  !== year)       show = false;
      if (con        && card.dataset.con   !== con)        show = false;
      if (search     && !(card.dataset.search || '').includes(search)) show = false;
      card.hidden = !show;
      if (show) visible++;
    });

    // Reorder cards in DOM to match chosen sort
    var sorted = cards.slice().sort(function(a, b) {
      switch (sort) {
        case 'year-asc':   return (+(a.dataset.year) || 0) - (+(b.dataset.year) || 0);
        case 'title-asc':  return (a.dataset.title || '').localeCompare(b.dataset.title || '');
        case 'title-desc': return (b.dataset.title || '').localeCompare(a.dataset.title || '');
        default:           return (+(b.dataset.year) || 0) - (+(a.dataset.year) || 0);
      }
    });
    sorted.forEach(function(card) { grid.appendChild(card); });

    // Results label + clear button
    var isFiltered = activeType || year || con || search;
    clearBtn.hidden = !isFiltered;
    resultsEl.textContent = isFiltered ? (visible + ' of ' + cards.length) : '';

    // Dynamic empty state when filters produce no results
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
  }
})();
</script>

{% endif %}
