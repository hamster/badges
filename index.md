---
layout: default
title: Home
---

<div class="page-header">
  <h1 class="text-accent font-mono">hamster badge museum</h1>
  <p class="lead">Electronic conference badges from DEF CON, SAINTCON, and beyond — cataloged with photos, specs, and source links.</p>
</div>

{% assign all_badges = site.badges | sort: "year" | reverse %}
{% assign badge_count = all_badges | size %}
{% assign sao_count = all_badges | where: "type", "sao" | size %}
{% assign full_count = all_badges | where: "type", "badge" | size %}
{% assign mini_count = all_badges | where: "type", "minibadge" | size %}

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

<div class="category-strip">
  <a href="{{ '/' | relative_url }}" class="cat-chip active">All ({{ badge_count }})</a>
  <a href="{{ '/badge/' | relative_url }}" class="cat-chip">Badges ({{ full_count }})</a>
  <a href="{{ '/sao/' | relative_url }}" class="cat-chip">SAOs ({{ sao_count }})</a>
  <a href="{{ '/minibadge/' | relative_url }}" class="cat-chip">Minibadges ({{ mini_count }})</a>
  <a href="{{ '/other/' | relative_url }}" class="cat-chip">Other</a>
</div>

{% if badge_count == 0 %}
<div class="empty-state">
  <div class="empty-state-icon">📡</div>
  <p>No badges cataloged yet.</p>
  <p>Run <code>python scripts/new-badge.py</code> to add the first one.</p>
</div>
{% else %}
<div class="badge-grid">
  {% for badge in all_badges %}
    {% include badge-card.html badge=badge %}
  {% endfor %}
</div>
{% endif %}
