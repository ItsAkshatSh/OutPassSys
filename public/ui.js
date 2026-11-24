/* Shared helpers for the Outpass UI */
(function (global) {
  'use strict';

  const escapeHtml = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const initials = (name) => String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';

  const hueFor = (name) => {
    let hash = 0;
    for (const char of String(name || '')) {
      hash = (hash * 31 + char.charCodeAt(0)) % 360;
    }
    return hash;
  };

  /* SQLite CURRENT_TIMESTAMP is UTC, e.g. "2025-05-03 09:43:41" */
  const toDate = (value) => {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    const normalized = String(value).includes('T') ? value : String(value).replace(' ', 'T') + 'Z';
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const fmtTime = (value) => {
    const date = toDate(value);
    if (!date) return '—';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const fmtDate = (value) => {
    const date = toDate(value);
    if (!date) return '—';
    return date.toLocaleDateString([], { day: '2-digit', month: 'short' });
  };

  const fmtDateTime = (value) => {
    const date = toDate(value);
    if (!date) return '—';
    return date.toLocaleDateString([], { day: '2-digit', month: 'short' }) + ' · ' + fmtTime(value);
  };

  const isToday = (value) => {
    const date = toDate(value);
    if (!date) return false;
    const now = new Date();
    return date.getDate() === now.getDate()
      && date.getMonth() === now.getMonth()
      && date.getFullYear() === now.getFullYear();
  };

  const withinDays = (value, days) => {
    const date = toDate(value);
    if (!date) return false;
    return Date.now() - date.getTime() <= days * 24 * 60 * 60 * 1000;
  };

  const toast = (message, type) => {
    const host = document.getElementById('toasts');
    if (!host) return;
    const node = document.createElement('div');
    node.className = 'toast' + (type === 'error' ? ' toast--error' : '');
    node.innerHTML = '<span class="dot"></span><span>' + escapeHtml(message) + '</span>';
    host.appendChild(node);
    setTimeout(() => {
      node.classList.add('is-out');
      setTimeout(() => node.remove(), 240);
    }, 3200);
  };

  const setApiStatus = (ok) => {
    const label = document.getElementById('apiStatus');
    const pulse = document.getElementById('apiPulse');
    if (label) label.textContent = ok ? 'All systems operational' : 'API unreachable';
    if (pulse) pulse.classList.toggle('pulse--rose', !ok);
  };

  const initShell = () => {
    const menuBtn = document.getElementById('menuBtn');
    const backdrop = document.getElementById('drawerBackdrop');
    const closeDrawer = () => document.body.classList.remove('drawer-open');

    if (menuBtn) menuBtn.addEventListener('click', () => document.body.classList.add('drawer-open'));
    if (backdrop) backdrop.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeDrawer();
    });

    document.querySelectorAll('.nav-item').forEach((link) => {
      link.addEventListener('click', closeDrawer);
    });
  };

  const dayKey = (date) => {
    const pad = (n) => String(n).padStart(2, '0');
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  };

  global.OutpassUI = {
    escapeHtml,
    initials,
    hueFor,
    toDate,
    fmtTime,
    fmtDate,
    fmtDateTime,
    isToday,
    withinDays,
    toast,
    setApiStatus,
    initShell,
    dayKey
  };

  initShell();
})(window);
