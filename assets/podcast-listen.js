(function () {
  const script = document.currentScript;
  const base = new URL('.', script.src);
  const localSrc = new URL('podcast-listen.json', base);

  function dateFromPage() {
    const q = new URLSearchParams(location.search).get('date');
    if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
    const title = document.title || '';
    const tm = title.match(/(\d{4}-\d{2}-\d{2})/);
    if (tm) return tm[1];
    const hd = document.getElementById('h-date') || document.getElementById('hero-date');
    const t = (hd && hd.textContent) || '';
    const m = t.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
    if (m) return m[1] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[3]).padStart(2, '0');
    return null;
  }

  function label(kind, n) {
    if (kind === 'study') return '공부 ' + n + '번';
    const s = String(n);
    return s.indexOf('번') >= 0 ? '뉴스 ' + s : '뉴스 ' + s + '번';
  }

  function openTarget(id) {
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'DETAILS') el.open = true;
    el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function decorateItems(ep, kind, pageCat) {
    const items = ep.items || [];
    items.forEach((it) => {
      if (pageCat && it.cat && it.cat !== pageCat) return;
      const el = document.getElementById(it.id);
      if (!el || el.querySelector('.podcast-no')) return;
      const badge = document.createElement('span');
      badge.className = 'podcast-no';
      badge.textContent = label(kind, it.n);
      const head = el.querySelector('.item-copy, .article-heading, .kicker, h2, h3');
      if (el.classList.contains('story') || it.id === 'todays-story') {
        const k = el.querySelector('.kicker') || el.firstElementChild;
        if (k) k.prepend(badge);
        else el.prepend(badge);
        return;
      }
      if (head) head.prepend(badge);
    });
  }

  function panel(cfg, ep, kind, pageCat) {
    const box = document.createElement('section');
    box.className = 'podcast-listen';
    box.id = 'podcast-listen';
    box.setAttribute('aria-labelledby', 'podcast-listen-title');
    const relevant = (ep.items || []).filter((it) => !pageCat || !it.cat || it.cat === pageCat);
    const covered = relevant.filter((it) => it.covered);
    const skipped = relevant.filter((it) => !it.covered);
    const lis = (arr) => arr.map((it) => {
      const newsHome = document.body.getAttribute('data-page') === 'home';
      const link = (kind === 'news' && (newsHome || (it.cat && it.cat !== pageCat)))
        ? (newsHome ? it.cat + '/' : (it.cat && it.cat !== pageCat ? '../' + it.cat + '/' : '')) + '?date=' + ep.date + '#' + it.id
        : '#' + it.id;
      return '<li><a href="' + link + '" data-podcast-id="' + it.id + '">' + label(kind, it.n) + '</a> — ' + (it.title || '') + '</li>';
    }).join('');
    box.innerHTML =
      '<div class="podcast-listen-head"><h2 id="podcast-listen-title">오늘 들은 내용</h2>' +
      '<button type="button" class="podcast-play" data-podcast-play>오늘 회차 듣기</button></div>' +
      '<audio controls preload="none" src="' + ep.audio + '"></audio>' +
      '<div class="podcast-cols"><div><h3>음성에서 다룬 항목</h3><ul>' + (lis(covered) || '<li>없음</li>') +
      '</ul></div><div><h3>앱에서 찾아보실 항목</h3><ul>' + (lis(skipped) || '<li>없음</li>') +
      '</ul></div></div>';
    box.querySelectorAll('a[data-podcast-id]').forEach((a) => {
      a.addEventListener('click', (e) => {
        if (a.getAttribute('href').charAt(0) !== '#') return;
        e.preventDefault();
        history.replaceState(history.state, '', a.getAttribute('href'));
        openTarget(a.getAttribute('data-podcast-id'));
      });
    });
    const audio = box.querySelector('audio');
    box.querySelector('[data-podcast-play]').addEventListener('click', () => {
      audio.play().catch(() => {});
      audio.scrollIntoView({ block: 'nearest' });
    });
    return box;
  }

  function unmount() {
    const box = document.getElementById('podcast-listen');
    if (box) box.remove();
    document.querySelectorAll('.podcast-no').forEach((el) => el.remove());
  }

  function mount(cfg) {
    const ep = cfg && cfg.episode;
    const date = dateFromPage();
    if (!ep || !date || date !== ep.date) {
      unmount();
      return;
    }
    const kind = cfg.kind;
    const pageCat = document.body.getAttribute('data-page');
    const onHome = pageCat === 'home';
    const host = document.getElementById('content') || document.querySelector('main') || document.getElementById('app');
    if (!host) return;
    const next = panel(cfg, ep, kind, onHome ? null : pageCat);
    const box = document.getElementById('podcast-listen');
    if (box) box.replaceWith(next);
    else if (host.id === 'content' || host.tagName === 'MAIN') host.insertBefore(next, host.firstChild);
    else host.prepend(next);
    decorateItems(ep, kind, onHome ? null : pageCat);
    const hash = decodeURIComponent((location.hash || '').slice(1));
    if (hash) openTarget(hash);
  }

  function boot(localCfg) {
    const kind = (localCfg && localCfg.kind) || 'study';
    const listenBase = ((localCfg && localCfg.listenBase) || '').replace(/\/$/, '');
    let timer = null;
    let inflight = '';

    function apply(cfg) {
      if (cfg && cfg.episode && cfg.episode.date === dateFromPage()) mount(cfg);
      else unmount();
    }

    function loadForPage() {
      const date = dateFromPage();
      if (!date) return;
      const key = kind + ':' + date;
      if (inflight === key && document.getElementById('podcast-listen')) return;
      inflight = key;
      const remote = listenBase ? (listenBase + '/' + kind + '/' + date + '.json') : null;
      const fallback = function () {
        if (localCfg && localCfg.episode && localCfg.episode.date === date) apply(localCfg);
        else unmount();
      };
      if (!remote) { fallback(); return; }
      fetch(remote, { cache: 'no-cache' })
        .then((r) => r.ok ? r.json() : null)
        .then((cfg) => { if (cfg && cfg.episode) apply(cfg); else fallback(); })
        .catch(fallback);
    }

    const run = () => {
      clearTimeout(timer);
      timer = setTimeout(loadForPage, 30);
    };
    const observe = (el) => {
      if (!el) return;
      new MutationObserver(run).observe(el, { childList: true, subtree: false });
    };
    run();
    setTimeout(run, 80);
    observe(document.getElementById('content'));
    observe(document.getElementById('app'));
    window.addEventListener('hashchange', () => openTarget(decodeURIComponent((location.hash || '').slice(1))));
    window.addEventListener('popstate', run);
  }

  fetch(localSrc.href, { cache: 'no-cache' })
    .then((r) => r.ok ? r.json() : null)
    .then((cfg) => boot(cfg || {}))
    .catch(() => boot({}));
})();
