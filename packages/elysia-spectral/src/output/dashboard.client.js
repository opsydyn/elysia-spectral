(() => {
  const THEME_KEY = 'elysia-spectral-theme';
  const THEMES = ['astro', 'tron', '808'];
  let stored = null;
  try {
    stored = localStorage.getItem(THEME_KEY);
  } catch {}
  const initial = THEMES.includes(stored) ? stored : 'astro';
  document.documentElement.dataset.theme = initial;

  const themeSel = document.querySelector('[data-theme-switcher]');
  if (themeSel) {
    themeSel.value = initial;
    themeSel.addEventListener('change', () => {
      const next = THEMES.includes(themeSel.value) ? themeSel.value : 'astro';
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {}
    });
  }

  const rel = (iso) => {
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return '';
    const s = Math.round((Date.now() - t) / 1000);
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.round(s / 60) + 'm ago';
    if (s < 86400) return Math.round(s / 3600) + 'h ago';
    return Math.round(s / 86400) + 'd ago';
  };
  for (const el of document.querySelectorAll('[data-relative-time]')) {
    el.textContent = rel(el.getAttribute('data-relative-time'));
  }

  const rows = Array.from(document.querySelectorAll('[data-findings] tr'));
  const search = document.querySelector('[data-search]');
  const empty = document.querySelector('[data-empty-findings]');
  const chips = Array.from(document.querySelectorAll('[data-filter]'));
  let activeSeverity = 'all';
  let query = '';

  const apply = () => {
    let visible = 0;
    for (const tr of rows) {
      const sev = tr.getAttribute('data-severity');
      const hay = tr.getAttribute('data-haystack') || '';
      const sevOk = activeSeverity === 'all' || sev === activeSeverity;
      const qOk = !query || hay.includes(query);
      const show = sevOk && qOk;
      tr.classList.toggle('is-hidden', !show);
      if (show) visible += 1;
    }
    if (empty)
      empty.classList.toggle('hidden', visible !== 0 || rows.length === 0);
  };

  for (const chip of chips) {
    const select = () => {
      activeSeverity = chip.getAttribute('data-filter') || 'all';
      for (const c of chips) c.classList.toggle('is-active', c === chip);
      apply();
    };
    chip.addEventListener('click', select);
    chip.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        select();
      }
    });
  }

  if (search) {
    search.addEventListener('input', () => {
      query = search.value.trim().toLowerCase();
      apply();
    });
  }

  for (const btn of document.querySelectorAll('[data-copy]')) {
    btn.addEventListener('click', async () => {
      const value = btn.getAttribute('data-copy') || '';
      try {
        await navigator.clipboard.writeText(value);
        btn.classList.add('copied');
        btn.textContent = 'copied';
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.textContent = 'copy';
        }, 1200);
      } catch {}
    });
  }

  document.addEventListener('keydown', (e) => {
    if (
      e.target &&
      (e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.tagName === 'SELECT')
    )
      return;
    if (e.key === 'r') {
      const link = document.querySelector('[data-refresh]');
      if (link) link.click();
    }
    if (e.key === '/' && search) {
      e.preventDefault();
      search.focus();
    }
  });
})();
