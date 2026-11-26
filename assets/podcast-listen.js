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

  function openTarget(id) {
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'DETAILS') el.open = true;
    el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  // 한 화면에 재생기는 하나. 지금 재생 중인 칩과 속도를 관리한다.
  // defaultKey: 분야 화면(예: 뉴스 스포츠)에서 아무것도 안 들을 때 강조만 해 둘 칩(자동 재생은 하지 않음).
  function player(box, ep, defaultKey) {
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
      const on = cur ? cur.key : defaultKey;
      box.querySelectorAll('[data-pl-key]').forEach((b) => {
        const k = b.getAttribute('data-pl-key');
        b.classList.toggle('is-playing', !!cur && k === cur.key);
        b.setAttribute('aria-pressed', String(!!on && k === on));
      });
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
      // 지금 듣는 칩을 다시 누르면 멈춤/이어 듣기.
      toggle(key) {
        const cur = queue[pos];
        if (!cur || cur.key !== key) return false;
        if (audio.paused) audio.play().catch(() => {}); else audio.pause();
        return true;
      },
      show,
      rate(v) { storeRate(v); applyRate(); },
    };
  }

  function panel(cfg, ep, kind, pageCat) {
    const box = document.createElement('section');
    box.className = 'podcast-listen';
    box.id = 'podcast-listen';
    box.setAttribute('aria-labelledby', 'podcast-listen-title');
    const clips = Array.isArray(ep.clips) ? ep.clips : [];
    const groups = clips.filter((c) => c.kind === 'group' && c.audio);
    // '전체' = 오늘 회차 전체를 처음부터 순서대로. 분야(뉴스)·과목(공부) 칩 = 그 그룹 클립만 바로 재생.
    const full = { key: '__full', label: '전체', audio: ep.audio };
    const byKey = { __full: full };
    groups.forEach((g) => { byKey[g.key] = { key: g.key, label: g.label || '', audio: g.audio }; });
    const chip = (key, text, sec) => '<button type="button" class="pl-chip" aria-pressed="false" data-pl-key="' + esc(key) + '">' + esc(text) + (sec ? '<small>' + mmss(sec) + '</small>' : '') + '</button>';
    const speed = '<div class="pl-speed" role="group" aria-label="재생 속도">' + RATES.map((r) => '<button type="button" data-pl-rate="' + r + '" aria-pressed="' + (r === savedRate()) + '">' + rateText(r) + '</button>').join('') + '</div>';
    box.innerHTML =
      '<div class="podcast-listen-head"><h2 id="podcast-listen-title">오늘 회차 듣기</h2></div>' +
      '<p class="pl-hint">\'전체\'는 처음부터 순서대로, ' + (kind === 'study' ? '과목을' : '분야를') + ' 누르면 그것만 바로 재생돼요.</p>' +
      '<div class="pl-chips" role="group" aria-label="' + (kind === 'study' ? '과목별 듣기' : '분야별 듣기') + '">' +
        (ep.audio ? chip('__full', '전체', 0) : '') + groups.map((g) => chip(g.key, g.label, g.durationSec)).join('') + '</div>' +
      '<div class="pl-actions">' + speed + '</div>' +
      '<p class="pl-now" data-pl-now hidden></p>' +
      '<audio controls preload="none" src="' + esc(ep.audio) + '"></audio>';
    const defaultKey = pageCat && byKey['all-' + pageCat] ? 'all-' + pageCat : '';
    const pl = player(box, ep, defaultKey);
    pl.show();
    box.querySelectorAll('.pl-chip[data-pl-key]').forEach((b) => b.addEventListener('click', () => {
      const key = b.getAttribute('data-pl-key');
      if (pl.toggle(key)) return;
      const c = byKey[key];
      if (c) pl.play([c]);
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
    // 예전 판(v19 이하)이 붙인 번호 배지가 남아 있으면 지운다.
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
      if (a && !a.paused) return;
    }
    const next = panel(cfg, ep, kind, onHome ? null : pageCat);
    next.dataset.epKey = kind + ':' + ep.date;
    if (old) old.replaceWith(next);
    else if (host.id === 'content' || host.tagName === 'MAIN') host.insertBefore(next, host.firstChild);
    else host.prepend(next);
    document.querySelectorAll('.podcast-no').forEach((el) => el.remove());
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
