(function () {
  const script = document.currentScript;
  const base = new URL('.', script.src);
  const localSrc = new URL('podcast-listen.json', base);
  // 재생 속도: 기본 0.9배, 0.85·0.9·0.95·1.0 중 선택. 고른 값은 이 기기에 기억(두 앱 공통 키).
  const RATES = [0.85, 0.9, 0.95, 1];
  const RATE_KEY = 'ddang-podcast-rate';
  const DEFAULT_RATE = 0.9;
  function savedRate() {
    try {
      const v = Number(localStorage.getItem(RATE_KEY));
      return RATES.indexOf(v) >= 0 ? v : DEFAULT_RATE;
    } catch (e) { return DEFAULT_RATE; }
  }
  function storeRate(v) { try { localStorage.setItem(RATE_KEY, String(v)); } catch (e) {} }
  const rateText = (v) => (v === 1 ? '1.0' : String(v)) + '배';
  const mmss = (sec) => { const s = Math.max(0, Math.round(Number(sec) || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  // 주소의 # 뒤가 깨진 글자(%만 있는 경우 등)여도 오류 없이 빈 값으로 본다.
  const hashId = () => { try { return decodeURIComponent((location.hash || '').slice(1)); } catch (e) { return ''; } };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function dateFromPage() {
    // 뉴스 앱은 지금 화면에 보이는 호의 날짜를 #main에 적어 둔다(주소에 ?date=가 없는 첫 화면 포함).
    const shown = document.querySelector('#main');
    if (shown && shown.dataset && /^\d{4}-\d{2}-\d{2}$/.test(shown.dataset.briefingDate || '')) return shown.dataset.briefingDate;
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

  // 한 화면에 재생기는 하나. 큐(골라 듣기)와 속도를 관리한다.
  function player(box, ep) {
    const audio = box.querySelector('audio');
    const now = box.querySelector('[data-pl-now]');
    let queue = [];
    let pos = -1;
    const applyRate = () => {
      const r = savedRate();
      audio.defaultPlaybackRate = r;
      audio.playbackRate = r;
      if ('preservesPitch' in audio) audio.preservesPitch = true;
    };
    // src를 바꾸면 브라우저가 속도를 기본값으로 되돌리므로, 새 음원을 읽을 때마다 다시 맞춘다.
    audio.addEventListener('loadedmetadata', applyRate);
    audio.addEventListener('play', applyRate);
    applyRate();
    function show() {
      const cur = queue[pos];
      box.querySelectorAll('[data-pl-key]').forEach((b) => b.classList.toggle('is-playing', !!cur && b.getAttribute('data-pl-key') === cur.key));
      if (!cur) { now.textContent = ''; now.hidden = true; return; }
      now.hidden = false;
      now.textContent = '지금 듣는 중: ' + cur.label + (queue.length > 1 ? ' (' + (pos + 1) + '/' + queue.length + ')' : '');
      if ('mediaSession' in navigator && window.MediaMetadata) {
        try { navigator.mediaSession.metadata = new MediaMetadata({ title: cur.label, artist: ep.title || '' }); } catch (e) {}
      }
    }
    function playAt(i) {
      if (i < 0 || i >= queue.length) { pos = -1; show(); return; }
      pos = i;
      audio.src = queue[i].audio;
      applyRate();
      audio.play().catch(() => {});
      show();
    }
    audio.addEventListener('ended', () => { if (pos >= 0 && pos < queue.length - 1) playAt(pos + 1); else { pos = -1; show(); } });
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.setActionHandler('nexttrack', () => { if (pos < queue.length - 1) playAt(pos + 1); });
        navigator.mediaSession.setActionHandler('previoustrack', () => { if (pos > 0) playAt(pos - 1); });
      } catch (e) {}
    }
    return {
      play(list) { queue = list.filter((x) => x && x.audio); playAt(0); audio.scrollIntoView({ block: 'nearest' }); },
      rate(v) { storeRate(v); applyRate(); },
    };
  }

  function panel(cfg, ep, kind, pageCat) {
    const box = document.createElement('section');
    box.className = 'podcast-listen';
    box.id = 'podcast-listen';
    box.setAttribute('aria-labelledby', 'podcast-listen-title');
    const relevant = (ep.items || []).filter((it) => !pageCat || !it.cat || it.cat === pageCat);
    const covered = relevant.filter((it) => it.covered || it.clipOnly);
    const skipped = relevant.filter((it) => !it.covered && !it.clipOnly);
    const clips = Array.isArray(ep.clips) ? ep.clips : [];
    const groups = clips.filter((c) => c.kind === 'group');
    const itemClip = {};
    clips.filter((c) => c.kind === 'item').forEach((c) => { itemClip[String(c.n)] = c; });
    const full = { key: '__full', label: '전체 회차', audio: ep.audio };
    const lis = (arr, withPlay) => arr.map((it) => {
      const newsHome = document.body.getAttribute('data-page') === 'home';
      const link = (kind === 'news' && (newsHome || (it.cat && it.cat !== pageCat)))
        ? (newsHome ? it.cat + '/' : (it.cat && it.cat !== pageCat ? '../' + it.cat + '/' : '')) + '?date=' + ep.date + '#' + it.id
        : '#' + it.id;
      const c = withPlay ? itemClip[String(it.n)] : null;
      const btn = c ? '<button type="button" class="pl-item-play" data-pl-key="' + esc(c.key) + '" aria-label="' + esc(label(kind, it.n)) + '만 듣기">▶</button>' : '';
      const only = it.clipOnly ? ' <span class="pl-only">분야 음성에만</span>' : '';
      return '<li>' + btn + '<a href="' + link + '" data-podcast-id="' + esc(it.id) + '">' + esc(label(kind, it.n)) + '</a> — ' + esc(it.title || '') + only + '</li>';
    }).join('');
    // 분야(뉴스)·과목(공부) 단추: 누르면 고르고/풀고, 여러 개 고른 뒤 '고른 것 듣기'로 이어 듣는다.
    const chip = (g) => '<button type="button" class="pl-chip" aria-pressed="false" data-pl-group="' + esc(g.key) + '" data-pl-key="' + esc(g.key) + '">' + esc(g.label) + '<small>' + mmss(g.durationSec) + '</small></button>';
    const speed = '<div class="pl-speed" role="group" aria-label="재생 속도">' + RATES.map((r) => '<button type="button" data-pl-rate="' + r + '" aria-pressed="' + (r === savedRate()) + '">' + rateText(r) + '</button>').join('') + '</div>';
    box.innerHTML =
      '<div class="podcast-listen-head"><h2 id="podcast-listen-title">오늘 들은 내용</h2>' +
      '<button type="button" class="podcast-play" data-podcast-play data-pl-key="__full">오늘 회차 전체 듣기</button></div>' +
      (groups.length
        ? '<div class="pl-pick"><p class="pl-hint">' + (kind === 'study' ? '과목' : '분야') + '을 눌러 고르고 듣기를 누르면 그것만 이어서 나옵니다.</p>' +
          '<div class="pl-chips" role="group" aria-label="골라 듣기">' + groups.map(chip).join('') + '</div>' +
          '<div class="pl-actions"><button type="button" class="pl-go" data-pl-go disabled>고른 것 듣기</button>' + speed + '</div></div>'
        : '<div class="pl-actions">' + speed + '</div>') +
      '<p class="pl-now" data-pl-now hidden></p>' +
      '<audio controls preload="none" src="' + esc(ep.audio) + '"></audio>' +
      '<div class="podcast-cols"><div><h3>음성에서 다룬 항목</h3><ul>' + (lis(covered, true) || '<li>없음</li>') +
      '</ul></div><div><h3>앱에서 찾아보실 항목</h3><ul>' + (lis(skipped, false) || '<li>없음</li>') +
      '</ul></div></div>';
    box.querySelectorAll('a[data-podcast-id]').forEach((a) => {
      a.addEventListener('click', (e) => {
        if (a.getAttribute('href').charAt(0) !== '#') return;
        e.preventDefault();
        history.replaceState(history.state, '', a.getAttribute('href'));
        openTarget(a.getAttribute('data-podcast-id'));
      });
    });
    const pl = player(box, ep);
    const byKey = {};
    clips.forEach((c) => { byKey[c.key] = c; });
    const chips = Array.from(box.querySelectorAll('[data-pl-group]'));
    const go = box.querySelector('[data-pl-go]');
    const picked = () => chips.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => byKey[b.getAttribute('data-pl-group')]);
    const sync = () => { if (go) { const n = picked().length; go.disabled = !n; go.textContent = n ? '고른 ' + n + '개 듣기' : '고른 것 듣기'; } };
    chips.forEach((b) => b.addEventListener('click', () => { b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); sync(); }));
    // 분야 화면(예: 스포츠)에서는 그 분야를 미리 골라 둔다. 바로 '고른 1개 듣기'.
    if (pageCat && byKey['all-' + pageCat]) { const b = chips.find((x) => x.getAttribute('data-pl-group') === 'all-' + pageCat); if (b) b.setAttribute('aria-pressed', 'true'); }
    sync();
    if (go) go.addEventListener('click', () => pl.play(picked()));
    box.querySelector('[data-podcast-play]').addEventListener('click', () => pl.play([full]));
    box.querySelectorAll('.pl-item-play').forEach((b) => b.addEventListener('click', () => {
      const c = byKey[b.getAttribute('data-pl-key')];
      if (c) pl.play([{ key: c.key, label: (c.label || '') + ' · ' + (c.title || ''), audio: c.audio }]);
    }));
    box.querySelectorAll('[data-pl-rate]').forEach((b) => b.addEventListener('click', () => {
      const v = Number(b.getAttribute('data-pl-rate'));
      pl.rate(v);
      box.querySelectorAll('[data-pl-rate]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    }));
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
    const old = document.getElementById('podcast-listen');
    // 재생 중인 칸은 다시 그리지 않는다(같은 날짜·같은 회차면 소리가 끊기지 않게).
    if (old && old.dataset.epKey === kind + ':' + ep.date && old.isConnected) {
      const a = old.querySelector('audio');
      if (a && !a.paused) { decorateItems(ep, kind, onHome ? null : pageCat); return; }
    }
    const next = panel(cfg, ep, kind, onHome ? null : pageCat);
    next.dataset.epKey = kind + ':' + ep.date;
    if (old) old.replaceWith(next);
    else if (host.id === 'content' || host.tagName === 'MAIN') host.insertBefore(next, host.firstChild);
    else host.prepend(next);
    decorateItems(ep, kind, onHome ? null : pageCat);
    const hash = hashId();
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
    window.addEventListener('hashchange', () => openTarget(hashId()));
    document.addEventListener('briefing-date-change', run);
    window.addEventListener('popstate', run);
  }

  fetch(localSrc.href, { cache: 'no-cache' })
    .then((r) => r.ok ? r.json() : null)
    .then((cfg) => boot(cfg || {}))
    .catch(() => boot({}));
})();
