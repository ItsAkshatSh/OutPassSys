/* History — searchable archive of returned outpasses */
(function () {
  'use strict';

  const UI = window.OutpassUI;
  const state = { rows: [] };

  const els = {
    rows: document.getElementById('historyRows'),
    table: document.getElementById('historyTable'),
    empty: document.getElementById('historyEmpty'),
    emptyHint: document.getElementById('emptyHint'),
    resultSub: document.getElementById('resultSub'),
    statTotal: document.getElementById('statTotal'),
    statWeek: document.getElementById('statWeek'),
    statStudents: document.getElementById('statStudents'),
    statGrade: document.getElementById('statGrade'),
    navCount: document.getElementById('navCount'),
    form: document.getElementById('searchForm'),
    search: document.getElementById('search'),
    startDate: document.getElementById('startDate'),
    endDate: document.getElementById('endDate'),
    resetBtn: document.getElementById('resetBtn'),
    exportBtn: document.getElementById('exportBtn')
  };

  async function loadHistory() {
    const params = new URLSearchParams();
    const search = els.search.value.trim();
    const startDate = els.startDate.value;
    const endDate = els.endDate.value;

    if (search) params.set('search', search);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate + ' 23:59:59');

    els.resultSub.textContent = 'Loading records…';

    try {
      const response = await fetch('/api/tickets/history' + (params.toString() ? '?' + params : ''));
      if (!response.ok) throw new Error('Request failed: ' + response.status);
      const rows = await response.json();
      state.rows = Array.isArray(rows) ? rows : [];
      UI.setApiStatus(true);
      render();
    } catch (error) {
      console.error(error);
      UI.setApiStatus(false);
      UI.toast('Could not load history from the server.', 'error');
      els.resultSub.textContent = 'Unavailable';
    }
  }

  function render() {
    const rows = state.rows;

    els.statTotal.textContent = rows.length;
    els.statWeek.textContent = rows.filter((row) => UI.withinDays(row.closed_at, 7)).length;
    els.statStudents.textContent = new Set(
      rows
        .map((row) => String(row.studentName || '').toLowerCase().trim())
        .filter(Boolean)
    ).size;

    const gradeCounts = new Map();
    rows.forEach((row) => {
      const grade = String(row.grade || '—');
      gradeCounts.set(grade, (gradeCounts.get(grade) || 0) + 1);
    });
    let topGrade = '—';
    let topCount = 0;
    gradeCounts.forEach((count, grade) => {
      if (count > topCount) { topCount = count; topGrade = grade; }
    });
    els.statGrade.textContent = topGrade;

    els.navCount.textContent = rows.length;
    els.resultSub.textContent = rows.length
      ? rows.length + (rows.length === 1 ? ' pass' : ' passes') + ' matching your filters'
      : 'No passes match your filters';

    els.rows.innerHTML = rows.map((row) => {
      const name = String(row.studentName || 'Unknown');
      return (
        '<tr>' +
          '<td><div class="student">' +
            '<span class="avatar-sm" style="--h:' + UI.hueFor(name) + '">' + UI.escapeHtml(UI.initials(name)) + '</span>' +
            '<div class="s-meta"><div class="s-name">' + UI.escapeHtml(name) + '</div>' +
            '<div class="s-sub">Pass #' + UI.escapeHtml(row.id) + '</div></div>' +
          '</div></td>' +
          '<td><span class="grade">' + UI.escapeHtml(row.grade || '—') + '</span></td>' +
          '<td><div class="reason" title="' + UI.escapeHtml(row.reason || '') + '">' + UI.escapeHtml(row.reason || '—') + '</div></td>' +
          '<td><div class="time-cell">' + UI.escapeHtml(row.time || '—') + '</div>' +
          '<div class="time-sub">expected</div></td>' +
          '<td><div class="time-cell">' + UI.escapeHtml(UI.fmtTime(row.created_at)) + '</div>' +
          '<div class="time-sub">' + UI.escapeHtml(UI.fmtDate(row.created_at)) + '</div></td>' +
          '<td><div class="time-cell">' + UI.escapeHtml(UI.fmtTime(row.closed_at)) + '</div>' +
          '<div class="time-sub">' + UI.escapeHtml(UI.fmtDate(row.closed_at)) + '</div></td>' +
        '</tr>'
      );
    }).join('');

    const isEmpty = rows.length === 0;
    els.table.hidden = isEmpty;
    els.empty.hidden = !isEmpty;

    if (isEmpty) {
      const filtered = Boolean(els.search.value.trim() || els.startDate.value || els.endDate.value);
      els.emptyHint.textContent = filtered
        ? 'No returned pass matches these filters. Try widening the date range.'
        : 'Once a pass is marked as returned it is archived here.';
    }
  }

  els.form.addEventListener('submit', (event) => {
    event.preventDefault();
    loadHistory();
  });

  els.resetBtn.addEventListener('click', () => {
    els.form.reset();
    loadHistory();
  });

  /* ── CSV export of the current result set ───────── */
  function csvCell(value) {
    return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';
  }

  els.exportBtn.addEventListener('click', () => {
    if (!state.rows.length) {
      UI.toast('There are no records to export.', 'error');
      return;
    }

    const header = ['ID', 'Student', 'Grade', 'Reason', 'Return by', 'Issued at', 'Returned at'];
    const lines = [header.map(csvCell).join(',')];
    state.rows.forEach((row) => {
      lines.push([
        row.id,
        row.studentName,
        row.grade,
        row.reason,
        row.time,
        row.created_at,
        row.closed_at
      ].map(csvCell).join(','));
    });

    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'outpass-history-' + UI.dayKey(new Date()) + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    UI.toast('Exported ' + state.rows.length + ' records.');
  });

  loadHistory();
})();
