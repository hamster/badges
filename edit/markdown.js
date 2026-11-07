// Markdown to HTML for the editor's previews of a badge's notes. The site
// renders notes with Jekyll's kramdown (GFM input), so this follows the same
// rules where it matters: headings, emphasis, ~~strikethrough~~, code spans
// and fenced code, block quotes, nested and task lists, tables, rules, links,
// images and reference links. A single line break doesn't break the line
// (end a line with two spaces or a backslash for that), and bare URLs aren't
// linked. Raw HTML is shown as text, except a few simple tags such as <br>.
//
// window.BadgeMarkdown.render(src) -> HTML string
(function () {
  'use strict';

  var RE = {
    blank: /^\s*$/,
    fence: /^( {0,3})(`{3,}|~{3,})\s*([^`\s]*)[^`]*$/,
    atx: /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/,
    hr: /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/,
    quote: /^ {0,3}>/,
    item: /^( {0,3})([-*+]|\d{1,9}[.)])([ \t]+|$)(.*)$/,
    setext: /^ {0,3}(=+|-+)[ \t]*$/,
    tableDelim: /^ {0,3}\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/,
    refDef: /^ {0,3}\[([^\]]+)\]:[ \t]*<?([^\s>]+)>?(?:[ \t]+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\)))?[ \t]*$/,
    indented: /^ {4}/,
  };
  var SIMPLE_TAGS = /<(\/?)(br|sub|sup|kbd|b|i|u|s|em|strong|small|mark|del|ins)\s*\/?>/gi;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  // Text: leaves entities such as &copy; and &#169; as they are.
  function escText(s) {
    return String(s).replace(/&(?!#?\w+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function safeUrl(u) {
    u = (u || '').trim();
    if (/^(javascript|vbscript|data):/i.test(u) && !/^data:image\//i.test(u)) return '#';
    return esc(u);
  }
  function refKey(s) { return s.trim().replace(/\s+/g, ' ').toLowerCase(); }

  // -------------------------------------------------------------------------
  // Inline
  // -------------------------------------------------------------------------

  function inline(src, refs) {
    var held = [];
    function hold(html) { held.push(html); return '\u0000' + (held.length - 1) + '\u0000'; }
    function linkHtml(href, title, inner) {
      // target=_blank: a click in the editor's preview mustn't leave the unsaved form.
      return '<a href="' + safeUrl(href) + '"' + (title ? ' title="' + esc(title) + '"' : '') + ' target="_blank" rel="noopener">' + inner + '</a>';
    }
    function imgHtml(src2, title, alt) {
      return '<img src="' + safeUrl(src2) + '" alt="' + esc(alt) + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>';
    }
    var s = src;

    // Code spans first: nothing inside them is markdown.
    s = s.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, function (_, ticks, code) {
      code = code.replace(/\n/g, ' ');
      if (/^ [\s\S]* $/.test(code) && code.trim()) code = code.slice(1, -1);
      return hold('<code>' + esc(code) + '</code>');
    });
    // Hard line breaks: two spaces or a backslash at the end of a line.
    s = s.replace(/(?: {2,}|\\)\n/g, function () { return hold('<br>') + '\n'; });
    // Autolinks: <https://…> and <name@example.com>.
    s = s.replace(/<((?:https?|ftp):\/\/[^\s<>]+)>/gi, function (_, u) { return hold(linkHtml(u, '', esc(u))); });
    s = s.replace(/<(?:mailto:)?([^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)>/gi, function (_, u) { return hold(linkHtml('mailto:' + u, '', esc(u))); });
    // Backslash escapes.
    s = s.replace(/\\([!-\/:-@\[-`{-~])/g, function (_, c) { return hold(esc(c)); });
    // A few harmless HTML tags, kept as tags.
    s = s.replace(SIMPLE_TAGS, function (_, close, tag) { return hold('<' + close + tag.toLowerCase() + '>'); });

    // Images and links, inline: ![alt](src "title"), [text](href "title").
    var target = '\\(\\s*<?([^\\s)>]*)>?(?:\\s+(?:"([^"]*)"|\'([^\']*)\'))?\\s*\\)';
    var text = '((?:[^\\[\\]]|\\[[^\\]]*\\])*)';
    s = s.replace(new RegExp('!\\[' + text + '\\]' + target, 'g'), function (_, alt, u, t1, t2) {
      return hold(imgHtml(u, t1 || t2, alt));
    });
    s = s.replace(new RegExp('\\[' + text + '\\]' + target, 'g'), function (_, t, u, t1, t2) {
      return hold(linkHtml(u, t1 || t2, inline(t, refs)));
    });
    // Reference links and images: [text][id], [text][], [id].
    s = s.replace(new RegExp('(!?)\\[' + text + '\\](?:\\[([^\\]]*)\\])?', 'g'), function (all, bang, t, id) {
      var d = refs[refKey(id || t)];
      if (!d || !t.trim()) return all;
      return hold(bang ? imgHtml(d.url, d.title, t) : linkHtml(d.url, d.title, inline(t, refs)));
    });

    s = escText(s);
    s = s.replace(/(\*\*\*|___)(?=\S)([\s\S]*?\S)\1/g, '<strong><em>$2</em></strong>');
    s = s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?!\w)/g, '$1<strong>$2</strong>');
    s = s.replace(/\*(?=\S)([\s\S]*?\S)\*/g, '<em>$1</em>');
    s = s.replace(/(^|[^\w])_(?=\S)([\s\S]*?\S)_(?!\w)/g, '$1<em>$2</em>');
    s = s.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');

    // Put the held pieces back (they can hold others, e.g. code in a link).
    for (var guard = 0; s.indexOf('\u0000') >= 0 && guard < 10; guard++) {
      s = s.replace(/\u0000(\d+)\u0000/g, function (_, n) { return held[+n]; });
    }
    return s;
  }

  // -------------------------------------------------------------------------
  // Blocks
  // -------------------------------------------------------------------------

  function isTableStart(lines, i) {
    return i + 1 < lines.length && lines[i].indexOf('|') >= 0 && lines[i + 1].indexOf('|') >= 0 &&
      lines[i + 1].indexOf('-') >= 0 && RE.tableDelim.test(lines[i + 1]);
  }

  // Can this line end a paragraph without a blank line before it?
  function interrupts(lines, i) {
    var l = lines[i], m;
    if (RE.fence.test(l) || RE.atx.test(l) || RE.hr.test(l) || RE.quote.test(l) || isTableStart(lines, i)) return true;
    m = l.match(RE.item);
    // Only bullets and lists starting at 1 interrupt a paragraph, and not empty ones.
    return !!(m && m[4].trim() && (!/\d/.test(m[2]) || parseInt(m[2], 10) === 1));
  }

  function splitRow(line) {
    var t = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    var cells = [], cur = '';
    for (var i = 0; i < t.length; i++) {
      if (t[i] === '\\' && t[i + 1] === '|') { cur += '|'; i++; continue; }
      if (t[i] === '|') { cells.push(cur.trim()); cur = ''; continue; }
      cur += t[i];
    }
    cells.push(cur.trim());
    return cells;
  }

  function table(lines, i, refs) {
    var head = splitRow(lines[i]);
    var aligns = splitRow(lines[i + 1]).map(function (c) {
      var l = c[0] === ':', r = c[c.length - 1] === ':';
      return l && r ? 'center' : r ? 'right' : l ? 'left' : '';
    });
    var cell = function (tag, text, k) {
      return '<' + tag + (aligns[k] ? ' style="text-align:' + aligns[k] + '"' : '') + '>' + inline(text || '', refs) + '</' + tag + '>';
    };
    var html = '<table>\n<thead>\n<tr>' + head.map(function (c, k) { return cell('th', c, k); }).join('') + '</tr>\n</thead>\n';
    var rows = [];
    i += 2;
    while (i < lines.length && !RE.blank.test(lines[i]) && lines[i].indexOf('|') >= 0) {
      var cells = splitRow(lines[i]);
      rows.push('<tr>' + head.map(function (_, k) { return cell('td', cells[k], k); }).join('') + '</tr>');
      i++;
    }
    if (rows.length) html += '<tbody>\n' + rows.join('\n') + '\n</tbody>\n';
    return { html: html + '</table>', next: i };
  }

  function list(lines, i, refs) {
    var first = lines[i].match(RE.item);
    var ordered = /\d/.test(first[2]);
    var marker = function (m) { return /\d/.test(m[2]) ? 'ol' + m[2].slice(-1) : 'ul' + m[2]; };
    var kind = marker(first);
    var items = [], loose = false, n = lines.length;
    while (i < n) {
      var m = lines[i].match(RE.item);
      if (!m || RE.hr.test(lines[i]) || marker(m) !== kind) break;
      var indent = m[1].length + m[2].length + Math.min(Math.max(m[3].length, 1), 4);
      var body = [m[4]];
      var blankSeen = false;
      i++;
      while (i < n) {
        var l = lines[i];
        if (RE.blank.test(l)) { body.push(''); blankSeen = true; i++; continue; }
        if (l.match(/^ */)[0].length >= indent) { body.push(l.slice(indent)); blankSeen = false; i++; continue; }
        if (blankSeen || RE.item.test(l) || interrupts(lines, i)) break;
        body.push(l);  // a lazy continuation of the item's paragraph
        i++;
      }
      var trailing = 0;
      while (body.length > 1 && body[body.length - 1] === '') { body.pop(); trailing++; }
      if (body.indexOf('') >= 0) loose = true;
      var next = i < n && lines[i].match(RE.item);
      if (trailing && next && marker(next) === kind) loose = true;
      items.push(body);
    }
    var start = ordered ? parseInt(first[2], 10) : 1;
    var html = items.map(function (body) {
      var box = '';
      var t = body[0].match(/^\[([ xX])\][ \t]+(.*)$/);
      if (t) { box = '<input type="checkbox" disabled' + (t[1] === ' ' ? '' : ' checked') + '> '; body[0] = t[2]; }
      return '<li>' + box + blocks(body, refs, !loose).trim() + '</li>';
    }).join('\n');
    var tag = ordered ? 'ol' : 'ul';
    return { html: '<' + tag + (ordered && start !== 1 ? ' start="' + start + '"' : '') + '>\n' + html + '\n</' + tag + '>', next: i };
  }

  // tight: paragraphs without <p>, for the items of a tight list.
  function blocks(lines, refs, tight) {
    var out = [], i = 0, n = lines.length, m;
    while (i < n) {
      var line = lines[i];
      if (RE.blank.test(line)) { i++; continue; }

      if ((m = line.match(RE.fence))) {
        var fence = m[2], indent = m[1].length, lang = m[3], code = [];
        var close = new RegExp('^ {0,3}' + (fence[0] === '`' ? '`' : '~') + '{' + fence.length + ',}\\s*$');
        i++;
        while (i < n && !close.test(lines[i])) { code.push(lines[i].replace(new RegExp('^ {0,' + indent + '}'), '')); i++; }
        i++;
        out.push('<pre><code' + (lang ? ' class="language-' + esc(lang) + '"' : '') + '>' + esc(code.join('\n')) + (code.length ? '\n' : '') + '</code></pre>');
        continue;
      }
      if (RE.indented.test(line)) {
        var block = [];
        while (i < n && (RE.indented.test(lines[i]) || RE.blank.test(lines[i]))) { block.push(lines[i].slice(4)); i++; }
        while (block.length && RE.blank.test(block[block.length - 1])) block.pop();
        out.push('<pre><code>' + esc(block.join('\n')) + '\n</code></pre>');
        continue;
      }
      if ((m = line.match(RE.atx))) {
        var lv = m[1].length;
        out.push('<h' + lv + '>' + inline(m[2] || '', refs) + '</h' + lv + '>');
        i++;
        continue;
      }
      if (RE.hr.test(line)) { out.push('<hr>'); i++; continue; }
      if (RE.quote.test(line)) {
        var q = [];
        while (i < n && !RE.blank.test(lines[i])) {
          if (RE.quote.test(lines[i])) q.push(lines[i].replace(/^ {0,3}> ?/, ''));
          else if (interrupts(lines, i)) break;
          else q.push(lines[i]);  // lazy continuation
          i++;
        }
        out.push('<blockquote>\n' + blocks(q, refs, false) + '\n</blockquote>');
        continue;
      }
      if (RE.item.test(line)) {
        var l2 = list(lines, i, refs);
        out.push(l2.html);
        i = l2.next;
        continue;
      }
      if (isTableStart(lines, i)) {
        var t = table(lines, i, refs);
        out.push(t.html);
        i = t.next;
        continue;
      }

      // A paragraph, or a setext heading (text underlined with === or ---).
      var para = [line.replace(/^\s+/, '')], heading = 0;
      i++;
      while (i < n && !RE.blank.test(lines[i])) {
        if ((m = lines[i].match(RE.setext))) { heading = m[1][0] === '=' ? 1 : 2; i++; break; }
        if (interrupts(lines, i)) break;
        para.push(lines[i].replace(/^\s+/, ''));
        i++;
      }
      var text = para.join('\n').replace(/[ \t]+$/, '');
      if (heading) out.push('<h' + heading + '>' + inline(text, refs) + '</h' + heading + '>');
      else out.push(tight ? inline(text, refs) : '<p>' + inline(text, refs) + '</p>');
    }
    return out.join('\n');
  }

  function render(src) {
    var lines = String(src || '').replace(/\r\n?/g, '\n').split('\n').map(function (l) {
      return l.replace(/^\t+/, function (t) { return new Array(t.length + 1).join('    '); });
    });
    // Reference definitions ([id]: url "title"), outside code blocks.
    var refs = {}, kept = [], inFence = null;
    lines.forEach(function (l) {
      var f = l.match(RE.fence), d;
      if (inFence) { if (f && f[2][0] === inFence[0] && f[2].length >= inFence.length && !f[3]) inFence = null; kept.push(l); return; }
      if (f) { inFence = f[2]; kept.push(l); return; }
      if ((d = l.match(RE.refDef)) && !refs[refKey(d[1])]) { refs[refKey(d[1])] = { url: d[2], title: d[3] || d[4] || d[5] || '' }; return; }
      kept.push(l);
    });
    return blocks(kept, refs, false);
  }

  window.BadgeMarkdown = { render: render };
})();
