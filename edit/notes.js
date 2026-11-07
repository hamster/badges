// The badge's notes (the Markdown body of index.md): a small formatting
// toolbar and Write / Preview tabs. The preview uses markdown.js.
(function () {
  'use strict';

  var ta = document.getElementById('f-notes');
  if (!ta || !window.BadgeMarkdown) return;
  var preview = document.getElementById('md-preview');
  var tabWrite = document.getElementById('md-tab-write');
  var tabPreview = document.getElementById('md-tab-preview');
  var tools = document.getElementById('md-tools');

  // -------------------------------------------------------------------------
  // Editing
  // -------------------------------------------------------------------------

  // Replace start..end with text, then select from..to within the new text.
  // execCommand keeps Ctrl+Z working, and fires the input event that marks
  // the badge as changed.
  function replace(start, end, text, from, to) {
    ta.focus();
    ta.setSelectionRange(start, end);
    if (!document.execCommand('insertText', false, text)) {
      ta.setRangeText(text, start, end, 'end');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
    ta.setSelectionRange(start + from, start + to);
  }

  // **bold**, _italic_, `code`: wrap the selection, or unwrap it if it's wrapped.
  function wrap(mark, placeholder) {
    var v = ta.value, s = ta.selectionStart, e = ta.selectionEnd, sel = v.slice(s, e), n = mark.length;
    if (sel && v.slice(s - n, s) === mark && v.slice(e, e + n) === mark) {
      replace(s - n, e + n, sel, 0, sel.length);
      return;
    }
    if (sel.length > 2 * n && sel.slice(0, n) === mark && sel.slice(-n) === mark) {
      var inner = sel.slice(n, -n);
      replace(s, e, inner, 0, inner.length);
      return;
    }
    // Spaces stay outside the marks: "**word **" isn't bold.
    var lead = sel.match(/^\s*/)[0];
    var trail = sel.slice(lead.length).match(/\s*$/)[0];
    var core = sel.slice(lead.length, sel.length - trail.length) || placeholder;
    replace(s, e, lead + mark + core + mark + trail, lead.length + n, lead.length + n + core.length);
  }

  function link() {
    var v = ta.value, s = ta.selectionStart, e = ta.selectionEnd, sel = v.slice(s, e).trim();
    if (/^(https?:\/\/|mailto:)\S+$/i.test(sel)) {
      // A URL was selected: ask for the text.
      replace(s, e, '[link text](' + sel + ')', 1, 10);
    } else {
      var text = sel || 'link text';
      replace(s, e, '[' + text + '](https://)', text.length + 3, text.length + 11);
    }
  }

  // The whole lines the selection touches.
  function lineRange() {
    var v = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
    if (e > s && v[e - 1] === '\n') e--;  // a selection ending at a line's start doesn't include that line
    var from = v.lastIndexOf('\n', s - 1) + 1;
    var to = v.indexOf('\n', e);
    return { from: from, to: to < 0 ? v.length : to };
  }

  // Headings, lists and quotes: add the prefix to each line, or take it off
  // if every line already has it.
  function prefix(kind) {
    var r = lineRange(), v = ta.value, caret = ta.selectionStart === ta.selectionEnd;
    var lines = v.slice(r.from, r.to).split('\n');
    var used = lines.filter(function (l) { return l.trim(); });
    if (!used.length) used = lines;
    var has = {
      heading: /^#{1,6}\s+/, ul: /^\s*[-*+]\s+/, ol: /^\s*\d+[.)]\s+/, quote: /^>\s?/,
    }[kind];
    var all = used.every(function (l) { return has.test(l); });
    var num = 0;
    var out = lines.map(function (l) {
      if (!l.trim() && lines.length > 1) return l;
      if (all) return l.replace(has, '');
      if (kind === 'heading') return '## ' + l.replace(/^#{1,6}\s+/, '');
      if (kind === 'quote') return '> ' + l;
      var bare = l.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '');
      return kind === 'ul' ? '- ' + bare : (++num) + '. ' + bare;
    }).join('\n');
    if (caret && lines.length === 1) replace(r.from, r.to, out, out.length, out.length);
    else replace(r.from, r.to, out, 0, out.length);
  }

  // Code: `inline`, or a fenced block when the selection spans lines or the line is empty.
  function code() {
    var v = ta.value, s = ta.selectionStart, e = ta.selectionEnd, sel = v.slice(s, e);
    var r = lineRange();
    if (sel.indexOf('\n') >= 0) {
      var body = v.slice(r.from, r.to);
      replace(r.from, r.to, '```\n' + body + '\n```', 4, 4 + body.length);
    } else if (!sel && !v.slice(r.from, r.to).trim()) {
      replace(r.from, r.to, '```\n\n```', 4, 4);
    } else {
      wrap('`', 'code');
    }
  }

  var ACTIONS = {
    bold: function () { wrap('**', 'bold text'); },
    italic: function () { wrap('_', 'italic text'); },
    heading: function () { prefix('heading'); },
    link: link,
    ul: function () { prefix('ul'); },
    ol: function () { prefix('ol'); },
    quote: function () { prefix('quote'); },
    code: code,
  };

  tools.querySelectorAll('[data-md]').forEach(function (b) {
    b.addEventListener('mousedown', function (e) { e.preventDefault(); });  // keep the selection
    b.addEventListener('click', function () { ACTIONS[b.getAttribute('data-md')](); });
  });
  ta.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    var act = { b: 'bold', i: 'italic', k: 'link' }[e.key.toLowerCase()];
    if (!act) return;
    e.preventDefault();
    ACTIONS[act]();
  });

  // -------------------------------------------------------------------------
  // Write / Preview
  // -------------------------------------------------------------------------

  function render() {
    preview.innerHTML = ta.value.trim() ? window.BadgeMarkdown.render(ta.value) : '<p class="md-empty">Nothing to preview yet.</p>';
  }

  function showPreview(on) {
    if (on) {
      preview.style.minHeight = ta.offsetHeight + 'px';  // no jump in the page's layout
      render();
    }
    ta.hidden = on;
    preview.hidden = !on;
    tabWrite.classList.toggle('active', !on);
    tabPreview.classList.toggle('active', on);
    tabWrite.setAttribute('aria-selected', String(!on));
    tabPreview.setAttribute('aria-selected', String(on));
    tools.querySelectorAll('button').forEach(function (b) { b.disabled = on; });
    if (!on) ta.focus();
  }

  tabWrite.addEventListener('click', function () { showPreview(false); });
  tabPreview.addEventListener('click', function () { showPreview(true); });
  // Notes set by the editor (loading a badge, a phone session) while previewing.
  if (window.BadgeEditor) window.BadgeEditor.onMediaChanged(function () { if (!preview.hidden) render(); });
})();
