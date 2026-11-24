/* Dashboard — active outpasses, volume chart, activity, new pass flow */
(function () {
  'use strict';

  const UI = window.OutpassUI;
  const state = { active: [], history: [], search: '' };

  const els = {
    rows: document.getElementById('activeRows'),
    table: document.getElementById('activeTable'),
    empty: document.getElementById('activeEmpty'),
    emptyHint: document.getElementById('emptyHint'),
    emptyBtn: document.getElementById('emptyNewBtn'),
    activeChip: document.getElementById('activeChip'),
    statActive: document.getElementById('statActive'),
    statWeek: document.getElementById('statWeek'),
    statReturned: document.getElementById('statReturned'),
    statStudents: document.getElementById('statStudents'),
    activeFoot: document.getElementById('activeFoot'),
    returnedFoot: document.getElementById('returnedFoot'),
    headline: document.getElementById('headline'),
    navCount: document.getElementById('navCount'),
    chartBars: document.getElementById('chartBars'),
    chartTotal: document.getElementById('chartTotal'),
    chartSub: document.getElementById('chartSub'),
    chartRange: document.getElementById('chartRange'),
    peakDay: document.getElementById('peakDay'),
    activity: document.getElementById('activityList'),
    modal: document.getElementById('modalBackdrop'),
    form: document.getElementById('requestForm'),
    submitBtn: document.getElementById('submitBtn'),
    search: document.getElementById('searchInput')
  };

  const plural = (count, word, pluralWord) => count + ' ' + (count === 1 ? word : (pluralWord || word + 's'));

  /* ── Header date ────────────────────────────────── */
  function paintHeader() {
    const now = new Date();
    document.getElementById('todayLabel').textContent =
      now.toLocaleDateString([], { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
  }

  /* ── Data ───────────────────────────────────────── */
  async function fetchJSON(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Request failed: ' + response.status);
    return response.json();
  }

  async function load() {
    try {
      const [active, history] = await Promise.all([
        fetchJSON('/api/tickets/active'),
        fetchJSON('/api/tickets/history')
      ]);
      state.active = Array.isArray(active) ? active : [];
      state.history = Array.isArray(history) ? history : [];
      UI.setApiStatus(true);
      render();
    } catch (error) {
      console.error(error);
      UI.setApiStatus(false);
      UI.toast('Could not reach the server. Is it running?', 'error');
    }
  }

  function allTickets() {
    return state.active.concat(state.history);
  }

  /* ── Rendering ──────────────────────────────────── */
  function render() {
    renderStats();
    renderTable();
    renderChart();
    renderActivity();
  }

  function renderStats() {
    const active = state.active.length;
    const week = allTickets().filter((ticket) => UI.withinDays(ticket.created_at, 7)).length;
    const returnedToday = state.history.filter((ticket) => UI.isToday(ticket.closed_at)).length;
    const students = new Set(allTickets()
      .map((ticket) => String(ticket.studentName || '').toLowerCase().trim())
      .filter(Boolean)).size;
    els.statActive.textContent = active;
    els.statWeek.textContent = week;
    els.statReturned.textContent = state.history.length;
    els.statStudents.textContent = students;
    els.activeChip.textContent = active + ' out';
    els.navCount.textContent = active;
    els.activeFoot.textContent = active ? 'Live count from the gate' : 'Everyone is on campus';
    els.returnedFoot.textContent = returnedToday
      ? plural(returnedToday, 'pass', 'passes') + ' returned today'
      : 'All-time check-ins';

    const headlineParts = [];
    headlineParts.push(active
      ? plural(active, 'student') + ' currently outside campus'
      : 'No active outpasses right now');
    headlineParts.push(plural(week, 'pass', 'passes') + ' issued this week');
    els.headline.textContent = headlineParts.join(' · ') + '.';
  }

  function rowHTML(ticket) {
    const name = String(ticket.studentName || 'Unknown');
    const reason = String(ticket.reason || '—');
    return (
      '<tr>' +
        '<td><div class="student">' +
          '<span class="avatar-sm" style="--h:' + UI.hueFor(name) + '">' + UI.escapeHtml(UI.initials(name)) + '</span>' +
          '<div class="s-meta"><div class="s-name">' + UI.escapeHtml(name) + '</div>' +
          '<div class="s-sub">Pass #' + UI.escapeHtml(ticket.id) + '</div></div>' +
        '</div></td>' +
        '<td><span class="grade">' + UI.escapeHtml(ticket.grade || '—') + '</span></td>' +
        '<td><div class="reason" title="' + UI.escapeHtml(reason) + '">' + UI.escapeHtml(reason) + '</div></td>' +
        '<td><div class="time-cell">' + UI.escapeHtml(ticket.time || '—') + '</div>' +
        '<div class="time-sub">expected</div></td>' +
        '<td><div class="time-cell">' + UI.escapeHtml(UI.fmtTime(ticket.created_at)) + '</div>' +
        '<div class="time-sub">' + UI.escapeHtml(UI.fmtDate(ticket.created_at)) + '</div></td>' +
        '<td><div class="actions">' +
          '<button class="btn btn-ghost btn-sm" type="button" data-return="' + UI.escapeHtml(ticket.id) + '" data-name="' + UI.escapeHtml(name) + '">Mark returned</button>' +
        '</div></td>' +
      '</tr>'
    );
  }

  function renderTable() {
    const query = state.search.trim().toLowerCase();
    const visible = state.active.filter((ticket) => {
      if (!query) return true;
      return [ticket.studentName, ticket.grade, ticket.reason]
        .some((value) => String(value || '').toLowerCase().includes(query));
    });

    els.rows.innerHTML = visible.map(rowHTML).join('');
    const isEmpty = visible.length === 0;
    els.table.hidden = isEmpty;
    els.empty.hidden = !isEmpty;

    if (isEmpty) {
      const searching = query.length > 0;
      els.emptyHint.textContent = searching
        ? 'No active outpass matches “' + state.search.trim() + '”.'
        : 'Every student is on campus. New outpasses will show up here.';
      els.emptyBtn.hidden = searching;
    }
  }

  function renderChart() {
    const days = [];
    const now = new Date();
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
      days.push({ date, key: UI.dayKey(date), count: 0 });
    }
    const byKey = new Map(days.map((day) => [day.key, day]));
    allTickets().forEach((ticket) => {
      const date = UI.toDate(ticket.created_at);
      if (!date) return;
      const bucket = byKey.get(UI.dayKey(date));
      if (bucket) bucket.count += 1;
    });

    const peak = Math.max(...days.map((day) => day.count));
    const max = Math.max(peak, 1);
    els.chartBars.innerHTML = days.map((day, index) => {
      const height = day.count === 0 ? 3 : Math.round((day.count / max) * 100);
      const isPeak = peak > 0 && day.count === peak;
      return (
        '<div class="bar-track" title="' + UI.escapeHtml(day.key + ' · ' + plural(day.count, 'pass', 'passes')) + '">' +
          '<span class="bar-val">' + (day.count || '') + '</span>' +
          '<div class="bar' + (isPeak ? ' is-peak' : '') + '" style="height:' + height + '%"' +
            ' aria-label="' + UI.escapeHtml(day.key + ': ' + plural(day.count, 'pass', 'passes')) + '"></div>' +
        '</div>'
      );
    }).join('');

    const total = days.reduce((sum, day) => sum + day.count, 0);
    els.chartTotal.textContent = total + (total === 1 ? ' pass' : ' passes');
    els.chartSub.textContent = 'Last 7 days';
    els.peakDay.textContent = peak > 0
      ? days.filter((day) => day.count === peak).map((day) => day.date.toLocaleDateString([], { weekday: 'short' }))[0] +
        ' · ' + peak
      : '—';
    els.chartRange.textContent =
      days[0].date.toLocaleDateString([], { day: '2-digit', month: 'short' }) + ' – ' +
      days[6].date.toLocaleDateString([], { day: '2-digit', month: 'short' });
  }

  function renderActivity() {
    const events = [];
    allTickets().forEach((ticket) => {
      const name = String(ticket.studentName || 'Unknown');
      events.push({
        at: UI.toDate(ticket.created_at),
        type: 'out',
        name,
        text: '<b>' + UI.escapeHtml(name) + '</b> issued an outpass',
        sub: UI.escapeHtml(ticket.reason || 'No reason')
      });
      if (ticket.closed_at) {
        events.push({
          at: UI.toDate(ticket.closed_at),
          type: 'in',
          name,
          text: '<b>' + UI.escapeHtml(name) + '</b> returned to class',
          sub: 'Closed by teacher'
        });
      }
    });

    events.sort((a, b) => (b.at ? b.at.getTime() : 0) - (a.at ? a.at.getTime() : 0));
    const latest = events.slice(0, 6);

    if (!latest.length) {
      els.activity.innerHTML = '<li class="list-empty">Nothing yet — activity appears as passes are issued and closed.</li>';
      return;
    }

    els.activity.innerHTML = latest.map((event) =>
      '<li>' +
        '<span class="dot ' + (event.type === 'in' ? 'dot--lime' : 'dot--amber') + '"></span>' +
        '<div class="a-body">' +
          '<div class="a-text">' + event.text + '</div>' +
          '<div class="a-time">' + event.sub + ' · ' + UI.escapeHtml(UI.fmtDateTime(event.at)) + '</div>' +
        '</div>' +
      '</li>'
    ).join('');
  }

  /* ── Actions ────────────────────────────────────── */
  async function markReturned(id, name, button) {
    if (button) {
      button.disabled = true;
      button.textContent = 'Closing…';
    }
    try {
      const response = await fetch('/api/tickets/' + encodeURIComponent(id) + '/close', { method: 'PUT' });
      if (!response.ok) throw new Error('Close failed');
      UI.toast(name + ' is back on campus.');
      await load();
    } catch (error) {
      console.error(error);
      UI.toast('Could not close that outpass.', 'error');
      if (button) {
        button.disabled = false;
        button.textContent = 'Mark returned';
      }
    }
  }

  els.rows.addEventListener('click', (event) => {
    const button = event.target.closest('[data-return]');
    if (!button) return;
    markReturned(button.dataset.return, button.dataset.name, button);
  });

  /* ── Modal ──────────────────────────────────────── */
  function defaultReturnTime() {
    const date = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const minutes = Math.round(date.getMinutes() / 5) * 5;
    date.setMinutes(minutes);
    return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
  }

  function openModal() {
    els.modal.hidden = false;
    const timeInput = els.form.elements.namedItem('time');
    if (timeInput && !timeInput.value) timeInput.value = defaultReturnTime();
    const nameInput = els.form.elements.namedItem('studentName');
    if (nameInput) setTimeout(() => nameInput.focus(), 60);
  }

  function closeModal() {
    els.modal.hidden = true;
  }

  document.getElementById('newRequestBtn').addEventListener('click', openModal);
  document.getElementById('emptyNewBtn').addEventListener('click', openModal);
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('cancelModal').addEventListener('click', closeModal);
  els.modal.addEventListener('click', (event) => {
    if (event.target === els.modal) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !els.modal.hidden) closeModal();
  });

  els.form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(els.form);
    const payload = {
      studentName: String(data.get('studentName') || '').trim(),
      grade: String(data.get('grade') || '').trim(),
      reason: String(data.get('reason') || '').trim(),
      time: String(data.get('time') || '')
    };

    els.submitBtn.disabled = true;
    els.submitBtn.textContent = 'Creating…';

    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Create failed');
      els.form.reset();
      closeModal();
      UI.toast('Outpass issued to ' + payload.studentName + '.');
      await load();
    } catch (error) {
      console.error(error);
      UI.toast('Could not create the outpass.', 'error');
    } finally {
      els.submitBtn.disabled = false;
      els.submitBtn.textContent = 'Create outpass';
    }
  });

  /* ── Search & shortcuts ─────────────────────────── */
  els.search.addEventListener('input', () => {
    state.search = els.search.value;
    renderTable();
  });

  document.addEventListener('keydown', (event) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if ((event.key === 'k' && (event.metaKey || event.ctrlKey)) || (event.key === '/' && !typing)) {
      event.preventDefault();
      els.search.focus();
    }
  });

  /* ── Boot ───────────────────────────────────────── */
  paintHeader();

  if (window.location.hash === '#new') {
    openModal();
  }

  load();
})();
