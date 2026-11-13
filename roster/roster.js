// Roster calendar: build a repeating shift cycle, see a year of it, and share
// it as a link. The only script on the site. Everything runs in the browser:
// the roster lives in the URL's #fragment (never sent to any server, GitHub
// Pages included) and, for the visitor's own convenience, in localStorage.
//
// The #fragment is a contract with the app, which will import it. Format v1:
//
//   #v=1&n=<name>&s=YYYY-MM-DD&t=<type>,<type>,…&c=<days>
//
//   n  optional roster name, percent-encoded, at most 40 characters
//   s  the date of day 1 of the cycle (the app's cycle_templates.start_date)
//   t  work shift types, at most 8; each is name;HHMM;RRGGBB;minutes with the
//      name percent-encoded (so it can't contain a raw , or ;), minutes 1–1440
//   c  one character per cycle day, 1–84 days: 0–7 index into t, - is Off
//
// Off is never listed in t: the app has its own seeded Off type.
// #preset=<id> opens the builder on one of PRESETS instead. A pattern page
// (roster/<slug>/) opens on the preset named by #planner-root's data-preset.
// The planner markup itself lives in PLANNER_HTML below, shared by every page. Anything that doesn't parse is ignored and the page starts fresh.
// A link is untrusted input: names only ever reach the page as textContent,
// colours are checked against a hex pattern, numbers are range-checked.

(function () {
  'use strict';

  var MAX_TYPES = 8;
  var MAX_DAYS = 84;
  var MAX_NAME = 40;
  var MAX_TYPE_NAME = 30;
  var STORE_KEY = 'roster.v1';
  var WEEK_KEY = 'roster.weekStart';
  var DAY_MS = 86400000;

  // The app's shift-type colour swatches (app/shift-type-edit/[id].tsx).
  var COLORS = ['4a90e2', 'e24a4a', '4ae26a', 'e2c34a', '9b4ae2', 'e2874a', '4ae2d6', 'e24ab5'];

  var DAY = { name: 'Day', start: '07:00', minutes: 720, color: '4a90e2' };
  var NIGHT = { name: 'Night', start: '19:00', minutes: 720, color: '9b4ae2' };

  // The app's rotation presets (app/cycle.tsx ROTATION_PRESETS), with default
  // shift types for when the visitor hasn't made enough of their own.
  // Blocks are [role, length]; role 0, 1, 2 = first, second, third work type.
  var PRESETS = [
    { id: '4-on-4-off', label: '4 on, 4 off', types: [DAY], blocks: [[0, 4], ['-', 4]] },
    { id: '4d-4n', label: '4 days, 4 off, 4 nights, 4 off', types: [DAY, NIGHT], blocks: [[0, 4], ['-', 4], [1, 4], ['-', 4]] },
    { id: '2d-2n-4-off', label: '2 days, 2 nights, 4 off', types: [DAY, NIGHT], blocks: [[0, 2], [1, 2], ['-', 4]] },
    { id: 'panama', label: '2-2-3 (Panama)', types: [DAY], blocks: [[0, 2], ['-', 2], [0, 3], ['-', 2], [0, 2], ['-', 3]] },
    { id: 'continental', label: '2 earlies, 2 lates, 2 nights, 4 off',
      types: [
        { name: 'Early', start: '06:00', minutes: 480, color: '4a90e2' },
        { name: 'Late', start: '14:00', minutes: 480, color: 'e2874a' },
        { name: 'Night', start: '22:00', minutes: 480, color: '9b4ae2' }
      ],
      blocks: [[0, 2], [1, 2], [2, 2], ['-', 4]] },
    { id: 'dupont', label: 'DuPont', types: [DAY, NIGHT], blocks: [[1, 4], ['-', 3], [0, 3], ['-', 1], [1, 3], ['-', 3], [0, 4], ['-', 7]] },
    { id: '2-on-2-off', label: '2 on, 2 off', types: [DAY], blocks: [[0, 2], ['-', 2]] },
    { id: '3-on-3-off', label: '3 on, 3 off', types: [DAY], blocks: [[0, 3], ['-', 3]] },
    { id: '4-on-3-off', label: '4 on, 3 off', types: [DAY], blocks: [[0, 4], ['-', 3]] },
    { id: '7-on-7-off', label: '7 on, 7 off', types: [DAY], blocks: [[0, 7], ['-', 7]] },
    { id: '5-on-2-off', label: '5 on, 2 off',
      types: [{ name: 'Work', start: '09:00', minutes: 480, color: '4a90e2' }],
      blocks: [[0, 5], ['-', 2]] }
  ];

  // The planner's markup. It is built here rather than written into each page,
  // because the main page and every pattern page share it and it is useless
  // without this script anyway; the pages carry only crawlable text. Static
  // markup only: nothing from a link or the visitor is ever put into it.
  var PLANNER_HTML = [
    "<div id=\"planner\" class=\"wrap planner\">",
    "  <section id=\"builder\" class=\"roster-card builder\" aria-labelledby=\"builder-title\">",
    "    <h2 id=\"builder-title\">1. Your pattern</h2>",
    "    <p class=\"hint\">Start from a common rotation, then change anything that doesn't match yours.</p>",
    "    <div id=\"presets\" class=\"chips\" role=\"group\" aria-label=\"Common patterns\"></div>",
    "    <h3>Shift types</h3>",
    "    <p class=\"hint\">Tap the colour to change it. Days off don't need a type.</p>",
    "    <div id=\"types\" class=\"types\"></div>",
    "    <button id=\"add-type\" class=\"btn btn-ghost btn-small\" type=\"button\">+ Add a shift type</button>",
    "    <h3>The cycle <span id=\"cycle-length\" class=\"cycle-length\"></span></h3>",
    "    <p class=\"hint\">Choose a shift below, then tap days in the cycle to set them.</p>",
    "    <div id=\"brushes\" class=\"brushes\" role=\"group\" aria-label=\"Shift to set\"></div>",
    "    <div id=\"cycle\" class=\"cycle\"></div>",
    "    <div class=\"row-actions\">",
    "      <button id=\"add-day\" class=\"btn btn-ghost btn-small\" type=\"button\">+ Add a day</button>",
    "      <button id=\"remove-day\" class=\"btn btn-ghost btn-small\" type=\"button\">− Remove last day</button>",
    "    </div>",
    "    <h2>2. When it starts</h2>",
    "    <div class=\"fields\">",
    "      <label class=\"field\">",
    "        <span>Day 1 of the cycle falls on</span>",
    "        <span class=\"field-row\">",
    "          <input id=\"start-date\" type=\"date\" required>",
    "          <button id=\"start-today\" class=\"btn btn-ghost btn-small\" type=\"button\">Today</button>",
    "        </span>",
    "      </label>",
    "      <label class=\"field\">",
    "        <span>Roster name <em>(optional, shown on the shared link)</em></span>",
    "        <input id=\"roster-name\" type=\"text\" maxlength=\"40\" placeholder=\"e.g. B shift\">",
    "      </label>",
    "    </div>",
    "  </section>",
    "  <section class=\"roster-card calendar\" aria-labelledby=\"roster-title\">",
    "    <div class=\"calendar-head\">",
    "      <div>",
    "        <p id=\"viewing-note\" class=\"eyebrow-small\" hidden>Shared roster</p>",
    "        <h2 id=\"roster-title\">Your roster</h2>",
    "        <p id=\"today\" class=\"today-line\"></p>",
    "        <p id=\"next\" class=\"next-line\"></p>",
    "      </div>",
    "      <button id=\"edit\" class=\"btn btn-ghost btn-small\" type=\"button\" hidden>Edit this roster</button>",
    "    </div>",
    "    <ul id=\"legend\" class=\"legend\"></ul>",
    "    <div class=\"calendar-nav\">",
    "      <button id=\"prev\" class=\"btn btn-ghost btn-small\" type=\"button\" aria-label=\"Previous twelve months\">←</button>",
    "      <span id=\"range\" class=\"range\" aria-live=\"polite\"></span>",
    "      <button id=\"next-year\" class=\"btn btn-ghost btn-small\" type=\"button\" aria-label=\"Next twelve months\">→</button>",
    "      <label class=\"week-start\">",
    "        <span>Week starts</span>",
    "        <select id=\"week-start\">",
    "          <option value=\"1\">Monday</option>",
    "          <option value=\"0\">Sunday</option>",
    "        </select>",
    "      </label>",
    "    </div>",
    "    <div id=\"months\" class=\"months\"></div>",
    "  </section>",
    "  <section class=\"roster-card share-card\" aria-labelledby=\"share-title\">",
    "    <h2 id=\"share-title\">Share or print</h2>",
    "    <p class=\"hint\">The link holds the whole roster, so anyone you send it to sees this calendar on any phone or computer, without signing up. Nothing is stored on our side. Anyone with the link can see it.</p>",
    "    <div class=\"share-row\">",
    "      <input id=\"share-url\" type=\"text\" readonly aria-label=\"Share link\">",
    "      <button id=\"copy\" class=\"btn btn-primary btn-small\" type=\"button\">Copy link</button>",
    "      <button id=\"share\" class=\"btn btn-ghost btn-small\" type=\"button\" hidden>Share…</button>",
    "      <button id=\"print\" class=\"btn btn-ghost btn-small\" type=\"button\">Print</button>",
    "    </div>",
    "    <p id=\"share-status\" class=\"share-status\" role=\"status\"></p>",
    "  </section>",
    "</div>"
  ].join('\n');

  // ---------------------------------------------------------------- dates
  // Calendar days are handled as UTC midnights so daylight saving never
  // shifts a day; only "today" is read from the visitor's local clock.

  function utcDay(y, m, d) { return Date.UTC(y, m, d); }

  function todayUtc() {
    var now = new Date();
    return utcDay(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function isoOf(ms) {
    var d = new Date(ms);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }

  function parseIso(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if (!m) return null;
    var y = +m[1], mo = +m[2] - 1, d = +m[3];
    var ms = utcDay(y, mo, d);
    var back = new Date(ms);
    if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo || back.getUTCDate() !== d) return null;
    if (y < 1990 || y > 2100) return null;
    return ms;
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function mod(a, n) { return ((a % n) + n) % n; }

  var LOCALE = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';

  function fmt(ms, opts) {
    opts.timeZone = 'UTC';
    try { return new Intl.DateTimeFormat(LOCALE, opts).format(ms); }
    catch (e) { return new Date(ms).toDateString(); }
  }

  function fmtTime(hhmm) {
    var p = hhmm.split(':');
    return fmt(utcDay(2000, 0, 1) + (+p[0] * 60 + +p[1]) * 60000, { hour: 'numeric', minute: '2-digit' });
  }

  function endTime(type) {
    var p = type.start.split(':');
    var total = mod(+p[0] * 60 + +p[1] + type.minutes, 1440);
    return pad(Math.floor(total / 60)) + ':' + pad(total % 60);
  }

  function minutesBetween(start, end) {
    var a = start.split(':'), b = end.split(':');
    var diff = mod((+b[0] * 60 + +b[1]) - (+a[0] * 60 + +a[1]), 1440);
    return diff === 0 ? 1440 : diff;
  }

  function localeWeekStart() {
    try {
      var loc = new Intl.Locale(LOCALE);
      var info = loc.getWeekInfo ? loc.getWeekInfo() : loc.weekInfo;
      if (info && info.firstDay === 7) return 0;
    } catch (e) { /* older browsers: Monday */ }
    return 1;
  }

  // ---------------------------------------------------------------- state

  var state = null;      // { name, start (ms), types: [{name,start,minutes,color}], days: [index|-1] }
  var brush = 0;         // type index painted onto tapped days; -1 = Off
  var viewFrom = null;   // first month shown, as a UTC ms on the 1st
  var weekStart = 1;     // 0 = Sunday, 1 = Monday
  var viewing = false;   // opened from someone's link: builder hidden until Edit

  function presetById(id) {
    for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === id) return PRESETS[i];
    return null;
  }

  function roleCount(preset) {
    var roles = {};
    preset.blocks.forEach(function (b) { if (b[0] !== '-') roles[b[0]] = true; });
    return Object.keys(roles).length;
  }

  /** Lays a preset's shape over the current types where there are enough of them. */
  function applyPreset(preset, keepTypes) {
    var types = keepTypes && state && state.types.length >= roleCount(preset)
      ? state.types
      : preset.types.map(function (t) { return { name: t.name, start: t.start, minutes: t.minutes, color: t.color }; });
    var days = [];
    preset.blocks.forEach(function (b) {
      for (var i = 0; i < b[1]; i++) days.push(b[0] === '-' ? -1 : b[0]);
    });
    state = {
      name: state ? state.name : '',
      start: state ? state.start : todayUtc(),
      types: types,
      days: days
    };
    brush = 0;
  }

  // ---------------------------------------------------------------- link format

  function encode(s) {
    var parts = ['v=1'];
    if (s.name) parts.push('n=' + encodeURIComponent(s.name));
    parts.push('s=' + isoOf(s.start));
    parts.push('t=' + s.types.map(function (t) {
      return [encodeURIComponent(t.name), t.start.replace(':', ''), t.color, t.minutes].join(';');
    }).join(','));
    parts.push('c=' + s.days.map(function (d) { return d < 0 ? '-' : String(d); }).join(''));
    return parts.join('&');
  }

  function decodePart(s) {
    try { return decodeURIComponent(s); } catch (e) { return null; }
  }

  function cleanName(s, max) {
    if (s == null) return null;
    // Control characters out, whitespace collapsed; it is only ever textContent.
    s = s.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
    return s.length > max ? s.slice(0, max) : s;
  }

  /** Raw "a=1&b=2" (no #) → params, without URLSearchParams turning + into space. */
  function splitParams(raw) {
    var out = {};
    raw.split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i > 0) out[kv.slice(0, i)] = kv.slice(i + 1);
    });
    return out;
  }

  function decode(raw) {
    var p = splitParams(raw);
    if (p.v !== '1') return null;
    var start = parseIso(p.s);
    if (start == null || !p.t || !p.c) return null;

    var types = [];
    var rawTypes = p.t.split(',');
    if (rawTypes.length > MAX_TYPES) return null;
    for (var i = 0; i < rawTypes.length; i++) {
      var f = rawTypes[i].split(';');
      if (f.length !== 4) return null;
      var name = cleanName(decodePart(f[0]), MAX_TYPE_NAME);
      var time = /^([01]\d|2[0-3])([0-5]\d)$/.exec(f[1]);
      var color = /^[0-9a-fA-F]{6}$/.test(f[2]) ? f[2].toLowerCase() : null;
      var minutes = /^\d{1,4}$/.test(f[3]) ? +f[3] : 0;
      if (!name || !time || !color || minutes < 1 || minutes > 1440) return null;
      types.push({ name: name, start: time[1] + ':' + time[2], minutes: minutes, color: color });
    }

    if (!/^[0-7-]+$/.test(p.c) || p.c.length > MAX_DAYS) return null;
    var days = [];
    for (var j = 0; j < p.c.length; j++) {
      var ch = p.c.charAt(j);
      var idx = ch === '-' ? -1 : +ch;
      if (idx >= types.length) return null;
      days.push(idx);
    }

    var rosterName = p.n ? cleanName(decodePart(p.n), MAX_NAME) : '';
    return { name: rosterName || '', start: start, types: types, days: days };
  }

  // ---------------------------------------------------------------- storage

  function load(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  function save(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* private mode */ }
  }

  // ---------------------------------------------------------------- helpers

  var $ = function (id) { return document.getElementById(id); };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  /** Dark text on light swatches (the app's green and yellow), white on the rest. */
  function inkFor(hex) {
    var r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? '#0a0e1a' : '#ffffff';
  }

  function paint(node, dayIdx) {
    if (dayIdx < 0) { node.classList.add('off'); return; }
    var t = state.types[dayIdx];
    node.style.backgroundColor = '#' + t.color;
    node.style.color = inkFor(t.color);
  }

  function initial(name) {
    var chars = Array.from ? Array.from(name) : name.split('');
    return (chars[0] || '?').toUpperCase();
  }

  function typeLabel(idx) { return idx < 0 ? 'Off' : state.types[idx].name; }

  function shiftOn(ms) {
    if (!state.days.length) return -1;
    return state.days[mod(Math.round((ms - state.start) / DAY_MS), state.days.length)];
  }

  function describe(idx) {
    if (idx < 0) return 'Off';
    var t = state.types[idx];
    return t.name + ', ' + fmtTime(t.start) + '–' + fmtTime(endTime(t));
  }

  // ---------------------------------------------------------------- builder

  function renderPresets() {
    var box = $('presets');
    box.textContent = '';
    PRESETS.forEach(function (p) {
      var b = el('button', 'chip', p.label);
      b.type = 'button';
      b.addEventListener('click', function () { applyPreset(p, true); changed(); });
      box.appendChild(b);
    });
  }

  function renderTypes() {
    var list = $('types');
    list.textContent = '';
    state.types.forEach(function (t, i) {
      var row = el('div', 'type-row');

      var sw = el('button', 'swatch');
      sw.type = 'button';
      sw.style.backgroundColor = '#' + t.color;
      sw.setAttribute('aria-label', 'Change colour of ' + t.name);
      sw.addEventListener('click', function () {
        t.color = COLORS[(COLORS.indexOf(t.color) + 1) % COLORS.length];
        changed();
      });

      var name = el('input', 'type-name');
      name.type = 'text';
      name.value = t.name;
      name.maxLength = MAX_TYPE_NAME;
      name.setAttribute('aria-label', 'Shift type name');
      name.addEventListener('change', function () {
        var v = cleanName(name.value, MAX_TYPE_NAME);
        if (v && !isOffName(v)) t.name = v;
        changed();
      });

      var from = timeInput(t.start, 'Start time for ' + t.name);
      var to = timeInput(endTime(t), 'End time for ' + t.name);
      from.addEventListener('change', function () {
        if (!from.value) return;
        var end = endTime(t);
        t.start = from.value;
        t.minutes = minutesBetween(t.start, end);
        changed();
      });
      to.addEventListener('change', function () {
        if (!to.value) return;
        t.minutes = minutesBetween(t.start, to.value);
        changed();
      });

      var del = el('button', 'icon-btn', '×');
      del.type = 'button';
      del.setAttribute('aria-label', 'Remove ' + t.name);
      del.disabled = state.types.length <= 1;
      del.addEventListener('click', function () { removeType(i); });

      var times = el('span', 'type-times');
      times.appendChild(from);
      times.appendChild(el('span', 'dash', '–'));
      times.appendChild(to);

      row.appendChild(sw);
      row.appendChild(name);
      row.appendChild(times);
      row.appendChild(del);
      list.appendChild(row);
    });
    $('add-type').disabled = state.types.length >= MAX_TYPES;
  }

  function isOffName(v) { return v.toLowerCase() === 'off'; }

  function timeInput(value, label) {
    var i = el('input', 'type-time');
    i.type = 'time';
    i.value = value;
    i.required = true;
    i.setAttribute('aria-label', label);
    return i;
  }

  function removeType(i) {
    state.types.splice(i, 1);
    state.days = state.days.map(function (d) { return d === i ? -1 : d > i ? d - 1 : d; });
    if (brush >= state.types.length) brush = 0;
    changed();
  }

  function addType() {
    if (state.types.length >= MAX_TYPES) return;
    var used = state.types.map(function (t) { return t.color; });
    var color = COLORS.filter(function (c) { return used.indexOf(c) < 0; })[0] || COLORS[0];
    state.types.push({ name: 'Shift ' + (state.types.length + 1), start: '09:00', minutes: 480, color: color });
    brush = state.types.length - 1;
    changed();
  }

  function renderBrushes() {
    var box = $('brushes');
    box.textContent = '';
    var all = state.types.map(function (_, i) { return i; }).concat([-1]);
    all.forEach(function (idx) {
      var b = el('button', 'brush', typeLabel(idx));
      b.type = 'button';
      b.setAttribute('aria-pressed', String(brush === idx));
      var dot = el('span', 'brush-dot');
      paint(dot, idx);
      b.insertBefore(dot, b.firstChild);
      b.addEventListener('click', function () { brush = idx; renderBrushes(); });
      box.appendChild(b);
    });
  }

  function renderCycle() {
    var box = $('cycle');
    box.textContent = '';
    state.days.forEach(function (d, i) {
      var b = el('button', 'cycle-day');
      b.type = 'button';
      paint(b, d);
      b.appendChild(el('span', 'cycle-num', String(i + 1)));
      b.appendChild(el('span', 'cycle-code', d < 0 ? '–' : initial(state.types[d].name)));
      b.setAttribute('aria-label', 'Day ' + (i + 1) + ': ' + typeLabel(d) + '. Set to ' + typeLabel(brush));
      b.addEventListener('click', function () {
        state.days[i] = brush;
        changed({ keepFocus: 'cycle', index: i });
      });
      box.appendChild(b);
    });
    var n = state.days.length;
    $('cycle-length').textContent = n === 1 ? '1-day cycle' : n + '-day cycle';
    $('add-day').disabled = n >= MAX_DAYS;
    $('remove-day').disabled = n <= 1;
  }

  // ---------------------------------------------------------------- calendar

  function renderToday() {
    var today = todayUtc();
    var idx = shiftOn(today);
    var n = state.days.length;
    var pos = mod(Math.round((today - state.start) / DAY_MS), n) + 1;
    var line = $('today');
    line.textContent = '';
    line.appendChild(el('strong', null, 'Today, ' + fmt(today, { weekday: 'short', day: 'numeric', month: 'short' }) + ': '));
    line.appendChild(document.createTextNode(describe(idx) + ' · day ' + pos + ' of ' + n));

    // Next change: the next day off while working, or the next shift while off.
    var next = $('next');
    next.textContent = '';
    for (var i = 1; i <= n; i++) {
      var d = shiftOn(today + i * DAY_MS);
      if ((idx < 0) !== (d < 0)) {
        var when = fmt(today + i * DAY_MS, { weekday: 'long', day: 'numeric', month: 'short' });
        next.textContent = (idx < 0 ? 'Next shift: ' + describe(d) + ', ' : 'Next day off: ') + when;
        break;
      }
    }
  }

  function renderCalendar() {
    var grid = $('months');
    grid.textContent = '';
    var counts = state.types.map(function () { return 0; });
    var offCount = 0;
    var today = todayUtc();
    var from = new Date(viewFrom);
    var y0 = from.getUTCFullYear(), m0 = from.getUTCMonth();

    var headers = [];
    for (var w = 0; w < 7; w++) {
      // 2000-01-02 was a Sunday.
      var dayMs = utcDay(2000, 0, 2 + mod(weekStart + w, 7));
      headers.push([fmt(dayMs, { weekday: 'narrow' }), fmt(dayMs, { weekday: 'long' })]);
    }

    for (var k = 0; k < 12; k++) {
      var first = utcDay(y0, m0 + k, 1);
      var fd = new Date(first);
      var year = fd.getUTCFullYear(), month = fd.getUTCMonth();
      var daysIn = new Date(utcDay(year, month + 1, 0)).getUTCDate();

      var table = el('table', 'month');
      table.appendChild(el('caption', null, fmt(first, { month: 'long', year: 'numeric' })));
      var thead = el('thead');
      var hr = el('tr');
      headers.forEach(function (h) {
        var th = el('th', null, h[0]);
        th.scope = 'col';
        th.title = h[1];
        th.setAttribute('aria-label', h[1]);
        hr.appendChild(th);
      });
      thead.appendChild(hr);
      table.appendChild(thead);

      var tbody = el('tbody');
      var lead = mod(fd.getUTCDay() - weekStart, 7);
      var tr = el('tr');
      for (var b = 0; b < lead; b++) tr.appendChild(el('td', 'pad'));
      for (var day = 1; day <= daysIn; day++) {
        var ms = utcDay(year, month, day);
        var idx = shiftOn(ms);
        if (idx < 0) offCount++; else counts[idx]++;
        var td = el('td', 'day');
        paint(td, idx);
        if (ms === today) td.classList.add('today');
        td.appendChild(el('span', 'num', String(day)));
        if (idx >= 0) td.appendChild(el('span', 'code', initial(state.types[idx].name)));
        td.title = fmt(ms, { weekday: 'short', day: 'numeric', month: 'short' }) + ': ' + describe(idx);
        td.setAttribute('aria-label', td.title);
        tr.appendChild(td);
        if (tr.children.length === 7) { tbody.appendChild(tr); tr = el('tr'); }
      }
      if (tr.children.length) {
        while (tr.children.length < 7) tr.appendChild(el('td', 'pad'));
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      grid.appendChild(table);
    }

    var last = utcDay(y0, m0 + 11, 1);
    $('range').textContent = fmt(viewFrom, { month: 'short', year: 'numeric' }) + ' – ' + fmt(last, { month: 'short', year: 'numeric' });

    var legend = $('legend');
    legend.textContent = '';
    state.types.forEach(function (t, i) {
      legend.appendChild(legendItem(i, t.name + ' ' + fmtTime(t.start) + '–' + fmtTime(endTime(t)), counts[i]));
    });
    legend.appendChild(legendItem(-1, 'Off', offCount));
  }

  function legendItem(idx, label, count) {
    var li = el('li');
    var dot = el('span', 'legend-dot');
    paint(dot, idx);
    li.appendChild(dot);
    li.appendChild(el('span', null, label));
    li.appendChild(el('span', 'legend-count', count + (idx < 0 ? (count === 1 ? ' day' : ' days') : (count === 1 ? ' shift' : ' shifts'))));
    return li;
  }

  // ---------------------------------------------------------------- share

  function shareUrl() {
    // Always the main page, whichever pattern page made it: /roster/#v=1… is
    // the address the app claims.
    return location.origin + '/roster/#' + encode(state);
  }

  function renderShare() {
    $('share-url').value = shareUrl();
    $('share').hidden = typeof navigator.share !== 'function';
  }

  function flash(msg) {
    var s = $('share-status');
    s.textContent = msg;
    clearTimeout(flash.t);
    flash.t = setTimeout(function () { s.textContent = ''; }, 3000);
  }

  function copyLink() {
    var url = shareUrl();
    var done = function () { flash('Link copied'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, fallback);
    } else fallback();
    function fallback() {
      var input = $('share-url');
      input.focus();
      input.select();
      try { document.execCommand('copy'); done(); } catch (e) { flash('Select the link and copy it'); }
    }
  }

  // ---------------------------------------------------------------- wiring

  function renderTitle() {
    var title = state.name ? state.name : 'Your roster';
    $('roster-title').textContent = title;
    $('roster-name').value = state.name;
    $('start-date').value = isoOf(state.start);
    $('week-start').value = String(weekStart);
  }

  function render() {
    $('builder').hidden = viewing;
    $('planner').classList.toggle('viewing', viewing);
    $('edit').hidden = !viewing;
    $('viewing-note').hidden = !viewing;
    renderTitle();
    if (!viewing) {
      renderTypes();
      renderBrushes();
      renderCycle();
    }
    renderToday();
    renderCalendar();
    renderShare();
  }

  function changed(opts) {
    // The address bar always holds the current roster, so reload keeps it and
    // the URL is itself the share link.
    var hash = '#' + encode(state);
    if (location.hash !== hash) history.replaceState(null, '', hash);
    if (!viewing) save(STORE_KEY, encode(state));
    render();
    if (opts && opts.keepFocus === 'cycle') {
      var btn = $('cycle').children[opts.index];
      if (btn) btn.focus();
    }
  }

  function readHash() {
    var raw = location.hash.replace(/^#/, '');
    var preset = /^preset=([a-z0-9-]+)$/.exec(raw);
    if (preset && presetById(preset[1])) {
      var stored = load(STORE_KEY);
      state = stored ? decode(stored) : null;
      applyPreset(presetById(preset[1]), false);
      viewing = false;
      return;
    }
    var fromLink = raw ? decode(raw) : null;
    if (fromLink) {
      state = fromLink;
      // A link the visitor made on this browser opens for editing; anyone
      // else's opens as a calendar first.
      viewing = load(STORE_KEY) !== raw;
      return;
    }
    // A pattern page (data-preset) opens on its pattern; the main page on the
    // visitor's last roster, else the first preset.
    viewing = false;
    var pagePreset = presetById($('planner-root').getAttribute('data-preset') || '');
    if (pagePreset) { state = null; applyPreset(pagePreset, false); return; }
    var mine = load(STORE_KEY);
    state = mine ? decode(mine) : null;
    if (!state) applyPreset(PRESETS[0], false);
  }

  function start() {
    var storedWeek = load(WEEK_KEY);
    weekStart = storedWeek === '0' || storedWeek === '1' ? +storedWeek : localeWeekStart();
    var now = new Date();
    viewFrom = utcDay(now.getFullYear(), now.getMonth(), 1);

    var root = $('planner-root');
    if (!root) return;
    root.innerHTML = PLANNER_HTML;

    readHash();
    renderPresets();

    $('roster-name').addEventListener('change', function (e) {
      state.name = cleanName(e.target.value, MAX_NAME) || '';
      changed();
    });
    $('start-date').addEventListener('change', function (e) {
      var ms = parseIso(e.target.value);
      if (ms != null) { state.start = ms; changed(); }
    });
    $('start-today').addEventListener('click', function () { state.start = todayUtc(); changed(); });
    $('week-start').addEventListener('change', function (e) {
      weekStart = +e.target.value;
      save(WEEK_KEY, String(weekStart));
      render();
    });
    $('add-type').addEventListener('click', addType);
    $('add-day').addEventListener('click', function () {
      if (state.days.length < MAX_DAYS) { state.days.push(brush); changed(); }
    });
    $('remove-day').addEventListener('click', function () {
      if (state.days.length > 1) { state.days.pop(); changed(); }
    });
    $('prev').addEventListener('click', function () {
      var d = new Date(viewFrom); viewFrom = utcDay(d.getUTCFullYear(), d.getUTCMonth() - 12, 1); renderCalendar();
    });
    $('next-year').addEventListener('click', function () {
      var d = new Date(viewFrom); viewFrom = utcDay(d.getUTCFullYear(), d.getUTCMonth() + 12, 1); renderCalendar();
    });
    $('edit').addEventListener('click', function () {
      viewing = false;
      changed();
      $('builder').scrollIntoView({ block: 'start' });
    });
    $('copy').addEventListener('click', copyLink);
    $('share').addEventListener('click', function () {
      navigator.share({ title: state.name || 'My roster', url: shareUrl() }).catch(function () {});
    });
    $('print').addEventListener('click', function () { window.print(); });
    window.addEventListener('hashchange', function () {
      if (location.hash.replace(/^#/, '') === encode(state)) return;
      readHash();
      render();
      if (location.hash.indexOf('preset=') === 1) $('planner').scrollIntoView({ block: 'start' });
    });

    $('noscript-note').hidden = true;
    if (location.hash.indexOf('preset=') === 1) changed(); else render();
  }

  start();
}());
