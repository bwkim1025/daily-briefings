/* Static PWA: original Markdown remains the source of truth. No build step. */
(function () {
  'use strict';
  const C=window.BriefingCore, page=document.body.dataset.page, HOME=page==='home';
  const base=new URL(HOME?'./':'../', location.href);
  // v3: one blue tone for every category — categories are told apart by their illustrated icon (art) and label only.
  // hidden: the route stays readable for old links but is not listed in navigation or on home.
  const config={
    financial:{name:'파이낸셜 브리핑',short:'파이낸셜',en:'Financial',subtitle:'시장과 숫자, 그 뒤에 있는 맥락.',icon:'chart',art:'fin'},
    international:{name:'인터내셔널 브리핑',short:'인터내셔널',en:'International',subtitle:'세계를 읽는 네 개의 시선.',icon:'globe',art:'globe'},
    sports:{name:'스포츠 브리핑',short:'스포츠',en:'Sports',subtitle:'NBA를 중심으로, 꼭 볼 경기와 흐름.',icon:'chart',art:'sport'},
    health:{name:'헬스 브리핑',short:'헬스',en:'Health',subtitle:'일상에 닿는 건강 연구와 생활의 발견.',icon:'heart',art:'health'},
    tech:{name:'테크·AI 브리핑',short:'테크·AI',en:'Tech · AI',subtitle:'꼭 알아야 할 기술과 AI 소식.',icon:'chart',art:'tech'},
    weather:{name:'웨더 · 부산',short:'웨더',en:'Weather',subtitle:'부산의 기온·비·바람·미세먼지.',icon:'chart',art:'weather'},
    medical:{name:'메디컬 브리핑',short:'메디컬',en:'Medical',subtitle:'연구의 결과와 한계를 함께 읽습니다.',icon:'cross',art:'',hidden:true}
  };
  // New categories stay off every menu/home card until a briefing for them is known to exist
  // (assets/briefing-index.json entry or a saved GitHub date list). Their routes still open and show a 'preparing' note.
  const GATED=['sports','tech','weather'], PENDING=new Set();
  let LISTED=Object.keys(config).filter(key=>!config[key].hidden), STORIES=LISTED.filter(key=>key!=='weather');
  const blockLabels={'why it matters':'왜 중요한가','context':'배경','market implication':'시장 영향','source':'출처','sources':'출처','why':'어떤 연구','abstract':'초록','results':'주요 결과','clinical application':'임상 적용','limitations':'주의할 점','takeaway':'핵심 정리'};
  const icons={chart:'<path d="M4 19h16M7 15V9m5 6V5m5 10v-5"/>',globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/>',cross:'<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z"/>',heart:'<path d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1c-4 4 1 10 8 15 7-5 12-11 8-15Z"/>',arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',moon:'<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',chevron:'<path d="m6 9 6 6 6-6"/>',book:'<path d="M12 6v15M3 4h4a5 5 0 0 1 5 2 5 5 0 0 1 5-2h4v15h-4a5 5 0 0 0-5 2 5 5 0 0 0-5-2H3Z"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',home:'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',layers:'<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',chat:'<path d="M4 5h16v11H9l-5 4z"/>',back:'<path d="M15 6l-6 6 6 6"/>'};
  const svg=(name,cls='')=>'<svg class="'+cls+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(icons[name]||icons.book)+'</svg>';
  // Illustrated blue one-tone icons (assets/icons/*.svg, viewBox 40) for categories and weather.
  const art=(name,size)=>name?'<img class="art" src="'+new URL('assets/icons/'+name+'.svg',base).href+'" alt="" width="'+size+'" height="'+size+'" decoding="async">':svg('cross','art');
  const catArt=(cat,size)=>art(config[cat]&&config[cat].art,size);
  const storage={get(key){try{return localStorage.getItem(key);}catch{return null;}},set(key,value){try{localStorage.setItem(key,value);}catch{}}};
  // H1 이관: 예전 버전이 쌓아 둔 본문 사본(daily-briefings-article-*)을 한 번 지운다. 다른 앱·다른 키는 건드리지 않는다.
  setTimeout(()=>{try{const old=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)||'';if(k.startsWith('daily-briefings-article-'))old.push(k);}old.forEach(k=>localStorage.removeItem(k));}catch{}},3000);
  let requestId=0, selected='', available=[], view=new Date(C.kstDate()+'T12:00:00Z'), lastResult=null, homeId=0;
  const homeDates=new Set(), parsed=new WeakMap();
  const $=selector=>document.querySelector(selector);
  const mobile=()=>matchMedia('(max-width:760px)').matches;
  const P=result=>{if(!parsed.has(result))parsed.set(result,C.parse(result.md));return parsed.get(result);};
  const shortDate=date=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return '';const d=new Date(date+'T12:00:00Z');return (d.getUTCMonth()+1)+'월 '+d.getUTCDate()+'일 '+'일월화수목금토'[d.getUTCDay()];};
  function setTheme(dark){document.documentElement.classList.toggle('dark',dark);$('#theme-toggle').setAttribute('aria-pressed',String(dark));$('#theme-toggle').setAttribute('aria-label',dark?'밝은 테마로 전환':'어두운 테마로 전환');$('meta[name=theme-color]').content=dark?'#141312':'#F6F5F3';}
  async function request(url,type='text',timeout=5500){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);try{const response=await fetch(url,{cache:'no-cache',signal:controller.signal});if(!response.ok)throw Error(String(response.status));return type==='json'?await response.json():await response.text();}finally{clearTimeout(timer);}}
  async function dateIndex(cat){
    let dates=[],savedAt=0;try{const saved=JSON.parse(storage.get('daily-briefings-dates-'+cat)||'null');if(saved&&Array.isArray(saved.dates)){dates=saved.dates;savedAt=Number(saved.at)||0;}}catch{}
    try{const index=await request(new URL('assets/briefing-index.json',base),'json');dates=[...new Set([...dates,...(index.categories[cat]||[])])];}catch{}
    // Refresh without delaying today's reading. A snapshot/cache never prevents probing today's file.
    // [검토 제안 P2] 목록 API는 분야마다 30분에 한 번만(비로그인 한도: IP당 시간 60회, 가족이 같은 와이파이를 쓰면 함께 소진).
    if(Date.now()-savedAt>30*60000)request('https://api.github.com/repos/bwkim1025/daily-briefings/contents/'+cat+'/briefings','json',4500).then(items=>{
      if(!Array.isArray(items))return;const fresh=[...new Set(items.map(i=>(i.name||'').match(/^(\d{4}-\d{2}-\d{2})(?:-[a-z]+)?\.md$/)).filter(Boolean).map(m=>m[1]))].sort().reverse();
      storage.set('daily-briefings-dates-'+cat,JSON.stringify({dates:fresh,at:Date.now()}));
      if(page===cat){available=fresh;renderCalendar();updateControls();}
      else if(HOME){fresh.forEach(d=>homeDates.add(d));syncHomeDates();}
    }).catch(()=>{});
    return dates.filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse();
  }
  // 2026-11-05 검토(H1): 본문을 localStorage에 쌓지 않는다(지우는 경로가 없어 약 100일이면 같은 주소의 스터디 앱 저장까지 막음).
  // 읽은 본문은 서비스워커가 이미 Cache Storage에 저장하므로, 네트워크가 안 되거나 느리면 그 사본을 직접 읽는다.
  const articleUrls=(cat,date)=>(cat==='medical'?['.md','-journal.md','-policy.md']:['.md']).flatMap(suffix=>{const path=cat+'/briefings/'+date+suffix;return [[path,new URL(path,base).href],[path,'https://raw.githubusercontent.com/bwkim1025/daily-briefings/main/'+path]];});
  async function fromCache(cat,date){
    if(!('caches' in window))return null;
    for(const [path,url] of articleUrls(cat,date)){try{const hit=await caches.match(url,{ignoreSearch:true});if(!hit||!hit.ok)continue;const md=await hit.text();if(/^#\s+\d{4}-\d{2}-\d{2}/m.test(md))return{date,md,path,cached:true};}catch{}}
    return null;
  }
  async function fetchDate(cat,date){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
    if(!navigator.onLine)return fromCache(cat,date);
    for(const [path,url] of articleUrls(cat,date)){
      try{const md=await request(url);if(!/^#\s+\d{4}-\d{2}-\d{2}/m.test(md))continue;return{date,md,path,cached:false};}catch{}
    }
    return fromCache(cat,date);
  }
  async function latest(cat,dates){
    const today=C.kstDate();
    // Newest first across all hints: a stale index must never hide newer files (probe recent days too).
    const candidates=[...new Set([today,...dates.filter(d=>d<=today),...Array.from({length:14},(_,i)=>C.kstDate(i))])].sort().reverse();
    for(const ds of candidates){const result=await fetchDate(cat,ds);if(result)return result;}
    return null;
  }
  // Category row: no '전체' item. The active category is marked; tapping it again returns to the unfiltered home.
  const catHref=key=>page===key?base.href:new URL(key+'/',base).href;
  const catCur=key=>page===key?' aria-current="page" title="다시 누르면 전체로" aria-label="'+config[key].short+' (지금 보는 분야) · 누르면 전체 브리핑으로"':'';
  function navigation(){return '<nav class="nav" aria-label="브리핑 카테고리">'+LISTED.map(key=>'<a href="'+catHref(key)+'"'+catCur(key)+'>'+catArt(key,24)+config[key].short+'</a>').join('')+'</nav>';}
  // Mobile icon row: identical on home and category pages; only the ring of the active category changes.
  function rounds(){return '<nav class="cat-rounds" aria-label="분야 바로가기">'+STORIES.concat(LISTED.includes('weather')?['weather']:[]).map(key=>'<a href="'+catHref(key)+'"'+catCur(key)+(key==='weather'?' class="pc-only"':'')+'><span class="ring"><span class="disc">'+catArt(key,30)+'</span></span><span class="lbl">'+config[key].short+'</span></a>').join('')+'</nav>';}
  // Mobile bottom tabs: 오늘 / 분야 (sheet) / 지난 호 (calendar). Hidden on PC by CSS.
  function tabbar(){
    return '<nav class="tabbar" aria-label="빠른 이동"><a class="tab" href="'+base.href+'"'+(HOME?' aria-current="page"':'')+'>'+svg('home')+'<span>오늘</span></a>'
      +'<details class="tab-cats'+(!HOME&&config[page]?' is-here':'')+'"><summary class="tab">'+svg('layers')+'<span>분야</span></summary><div class="cat-sheet">'+sheetLinks()+'</div></details>'
      +'<a class="tab" id="tab-archive" href="'+base.href+'#archive">'+svg('calendar')+'<span>지난 호</span></a></nav>';
  }
  function sheetLinks(){return LISTED.map(key=>'<a href="'+new URL(key+'/',base).href+'"'+(page===key?' aria-current="page"':'')+'>'+catArt(key,30)+'<span>'+config[key].short+'</span></a>').join('');}
  // Gate resolved after the first paint: redraw only the category menus if the listed set changed.
  function refreshNav(){const n=$('.nav');if(n)n.outerHTML=navigation();document.querySelectorAll('.cat-rounds').forEach(r=>{r.outerHTML=rounds();});const s=$('.cat-sheet');if(s)s.innerHTML=sheetLinks();}
  function savedDates(cat){try{const saved=JSON.parse(localStorage.getItem('daily-briefings-dates-'+cat)||'null');return saved&&Array.isArray(saved.dates)?saved.dates:[];}catch{return [];}}
  async function gate(){
    let index=null;try{index=await request(new URL('assets/briefing-index.json',base),'json',4000);}catch{}
    GATED.forEach(cat=>{const known=(index&&index.categories&&index.categories[cat]||[]).length||savedDates(cat).length;if(!known)PENDING.add(cat);});
    LISTED=Object.keys(config).filter(key=>!config[key].hidden&&!PENDING.has(key));STORIES=LISTED.filter(key=>key!=='weather');
  }
  // Pending categories: at most one GitHub listing per 6 h, so a newly published category appears on the next visit.
  function probePending(){
    PENDING.forEach(cat=>{const k='daily-briefings-probe-'+cat;let last=0;try{last=Number(localStorage.getItem(k)||0);}catch{}if(Date.now()-last<6*3600000)return;storage.set(k,String(Date.now()));
      request('https://api.github.com/repos/bwkim1025/daily-briefings/contents/'+cat+'/briefings','json',4500).then(items=>{if(!Array.isArray(items))return;const fresh=[...new Set(items.map(i=>(i.name||'').match(/^(\d{4}-\d{2}-\d{2})(?:-[a-z]+)?\.md$/)).filter(Boolean).map(m=>m[1]))].sort().reverse();if(fresh.length)storage.set('daily-briefings-dates-'+cat,JSON.stringify({dates:fresh,at:Date.now()}));}).catch(()=>{});});
  }
  function shell(){
    const c=config[page];
    $('#app').innerHTML='<a class="skip" href="#main">본문으로 건너뛰기</a><header class="topbar"><div class="topbar-in"><a class="brand" href="'+base.href+'"><span class="app-mark app-icon"><img src="'+new URL('icon-v3-192.png?v=29',base).href+'" alt="" width="34" height="34"></span><div><div class="brand-name">땡이네 뉴스</div><div class="brand-caption">A CLEARER VIEW, EVERY DAY</div></div></a>'
      +(HOME?'':'<a class="back-link" href="'+base.href+'" aria-label="전체 브리핑으로">'+svg('back')+'</a><span class="m-title">'+C.esc(c?(page==='weather'?c.name:c.short):'')+'</span>')
      +'<div class="tools">'+(HOME?'<button class="date-pill" id="date-pill" type="button" aria-controls="home-archive"><span class="pill-face">'+svg('calendar')+'<span id="date-label">'+shortDate(C.kstDate())+'</span>'+svg('chevron','pill-chev')+'</span></button>':'')
      +'<button class="icon-btn cal-btn" id="cal-btn" type="button" aria-label="달력 · 지난 호">'+svg('calendar')+'</button><button class="icon-btn" id="theme-toggle">'+svg('moon')+'</button></div></div></header>'
      +'<div class="shell">'+navigation()+(HOME?'':rounds())+'<main id="main"></main><footer class="footer"><span>땡이네 뉴스 · bwkim1025</span><span>Personal use only · 원문을 함께 확인하세요</span></footer></div>'+tabbar();
    setTheme(document.documentElement.classList.contains('dark'));
    $('#theme-toggle').addEventListener('click',()=>{const dark=!document.documentElement.classList.contains('dark');setTheme(dark);storage.set('eb-theme',dark?'dark':'light');});
    const closeSheets=except=>document.querySelectorAll('.tab-cats[open]').forEach(d=>{if(!except||!d.contains(except))d.open=false;});
    document.addEventListener('click',e=>closeSheets(e.target));
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheets();});
    ['#tab-archive','#cal-btn','#date-pill'].forEach(sel=>{const el=$(sel);if(el)el.addEventListener('click',openArchive);});
  }
  // 지난 호: home → the archive calendar (PC rail / mobile sheet); category → the existing date picker.
  function openArchive(event){
    if(event){event.preventDefault();event.stopPropagation();}
    document.querySelectorAll('.tab-cats[open]').forEach(d=>{d.open=false;});
    if(HOME){
      const cal=$('#home-archive');if(!cal)return;const m=mobile();
      if(m){cal.classList.add('is-open');document.body.classList.add('cal-open');$('#date-pill')?.setAttribute('aria-expanded','true');}
      else cal.scrollIntoView({block:'nearest'});
      (cal.querySelector('.cal-day[aria-pressed="true"]')||cal.querySelector('.cal-day:not(:disabled)')||$('#cal-prev')).focus({preventScroll:m});
      return;
    }
    const el=$('#archive-picker');if(!el)return;
    el.open=true;el.scrollIntoView({block:'start'});el.querySelector('summary').focus({preventScroll:true});
  }
  function closeHomeCal(focusBack){
    const cal=$('#home-archive');if(!cal||!cal.classList.contains('is-open'))return;
    cal.classList.remove('is-open');document.body.classList.remove('cal-open');$('#date-pill')?.setAttribute('aria-expanded','false');
    if(focusBack)($('#date-pill')||$('#cal-btn')).focus();
  }
  const splitHeadline=text=>{const h=String(text),i=h.indexOf(' — ');return i>0?[h.slice(0,i),h.slice(i+3)]:[h,''];};
  const plain=text=>String(text||'').replace(/```[\s\S]*?```/g,' ').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/\*\*|__|`/g,'').replace(/\s+/g,' ').trim();
  const firstSentence=text=>{const s=plain(text),m=s.match(/^(.+?[.!?])(?=\s|$)/);return m?m[1]:s;};
  // Lead summary = the first sentence of the story's own "Why it matters" and implication/takeaway blocks. Nothing is written here.
  function storyPoints(story){
    const blocks=String(story||'').split(/^####\s+/m).slice(1).map(b=>{const nl=b.indexOf('\n');return {title:(nl<0?b:b.slice(0,nl)).trim().toLowerCase(),body:nl<0?'':b.slice(nl+1)};});
    const out=[];
    for(const re of [/^(why it matters|왜 중요한가)/,/^(market implication|takeaway|시장 영향|핵심 정리|우리 가족에 적용|임상 적용)/]){
      const b=blocks.find(x=>re.test(x.title));if(!b)continue;
      const s=firstSentence(b.body.split('\n').filter(l=>l.trim()&&!/^\s*(\||>|#|-{3,})/.test(l)).join('\n'));if(s)out.push(s);
    }
    return out;
  }
  // Sections hidden at render time for every date (md files untouched). financial MARKETS = '미국 · 한국 증시' (1103).
  const HIDE_SECTIONS={financial:['MARKETS']};
  const visible=(cat,sections)=>sections.filter(s=>s.key!=='SCHEDULE'&&!(HIDE_SECTIONS[cat]||[]).includes(s.key));
  const schedOf=data=>C.schedule(data.sections.find(s=>s.key==='SCHEDULE'));
  const schedList=items=>'<ul class="sched-list">'+items.map(x=>'<li><span class="sched-t">'+C.esc(x.time)+'</span><span class="sched-b"><strong>'+C.inline(x.title)+'</strong>'+(x.note?'<em>'+C.inline(x.note)+'</em>':'')+'</span></li>').join('')+'</ul>';
  const catUrl=(cat,date)=>{const url=new URL(cat+'/',base);if(date)url.searchParams.set('date',date);return url.href;};
  const cardTop=(cat,extra)=>'<div class="card-top"><span class="category-symbol">'+catArt(cat,22)+'</span><span class="category-name">'+config[cat].short+'</span>'+(extra||'')+'</div>';
  function card(cat,result,missing,isLead){
    const c=config[cat];let title=missing?'이 날짜의 브리핑이 없습니다':'새 브리핑을 확인해 주세요',excerpt=missing?'':c.subtitle,sub='',points=[],date='',count='';
    if(result){const data=P(result),secs=visible(cat,data.sections),lead=C.lead(data.story),parts=splitHeadline(lead.headline||secs.flatMap(s=>s.items)[0]?.headline||c.name);title=parts[0];sub=parts[1];excerpt=parts[1]||lead.paragraph||c.subtitle;date=result.date.slice(5).replace('-','.');count=secs.reduce((n,s)=>n+s.items.length,0)+'개 이슈 · '+C.sourceCount(result.md)+'개 출처 도메인';if(isLead)points=storyPoints(data.story);}
    const url=catUrl(cat,result?result.date:missing);
    const body=isLead?'<h2 class="card-headline"><a href="'+url+'">'+C.esc(title)+'</a></h2>'+(sub?'<p class="lead-sub">'+C.esc(sub)+'</p>':'')+(points.length?'<ol class="lead-points">'+points.map(p=>'<li>'+C.esc(p)+'</li>').join('')+'</ol>':(!sub&&excerpt?'<p class="card-excerpt">'+C.esc(excerpt)+'</p>':''))
      :'<h3 class="card-headline"><a href="'+url+'">'+C.esc(title)+'</a></h3>'+(excerpt?'<p class="card-excerpt">'+C.esc(excerpt)+'</p>':'');
    return '<article class="digest-card'+(isLead?' lead-card':'')+'" data-category="'+cat+'">'+(isLead?'<div class="lead-bar" aria-hidden="true"></div>':'')+cardTop(cat,'<span class="card-date">'+(date?date+' 발행':'')+'</span>')+'<div class="card-main">'+body+'</div><div class="card-foot"><span>'+count+'</span><a href="'+url+'">브리핑 읽기 '+svg('arrow')+'</a></div></article>';
  }
  // ---- 웨더: the generation pipeline writes one ```weather JSON block into weather/briefings/YYYY-MM-DD.md ----
  const num=v=>{if(v===null||v===undefined||v===''||v==='-')return null;const n=Number(v);return Number.isFinite(n)?n:null;};
  const fmt=(v,unit,decimal)=>{const n=num(v);return n===null?'–':(decimal?String(Math.round(n*10)/10):String(Math.round(n)))+unit;};
  const rainText=v=>{const n=num(v);return n===null?(v?C.esc(v):''):(Math.round(n*10)/10)+' mm';};
  // 환경부 예보 등급: PM10 좋음 0–30 · 보통 31–80 · 나쁨 81–150 · 매우나쁨 151+ / PM2.5 좋음 0–15 · 보통 16–35 · 나쁨 36–75 · 매우나쁨 76+
  const AIR={pm10:{name:'미세먼지',short:'미세',cut:[30,80,150],top:300,art:'pm10'},pm25:{name:'초미세먼지',short:'초미세',cut:[15,35,75],top:150,art:'pm25'}};
  const GRADES=['좋음','보통','나쁨','매우나쁨'];
  function airGrade(kind,v){const n=num(v);if(n===null)return null;const c=AIR[kind].cut,i=n<=c[0]?0:n<=c[1]?1:n<=c[2]?2:3,lo=i?c[i-1]:0,hi=i<3?c[i]:AIR[kind].top,f=Math.min(1,Math.max(0,(n-lo)/(hi-lo)));return {i,label:GRADES[i],cls:' g'+i,pos:Math.round(Math.min(98,Math.max(2,(i+f)*25)))};}
  function wxData(md){const m=String(md||'').match(/^```weather[ \t]*\r?\n([\s\S]*?)\r?\n```[ \t]*$/m);if(!m)return null;try{const d=JSON.parse(m[1]);return d&&typeof d==='object'?d:null;}catch{return null;}}
  const skyArt=sky=>{const s=String(sky||'');return /비|소나기|눈/.test(s)?'rain':/흐림/.test(s)?'cloud':/구름/.test(s)?'weather':/맑/.test(s)?'sun':'cloud';};
  const hourLabel=t=>{const m=String(t||'').match(/(\d{1,2})/);return m?String(Number(m[1])).padStart(2,'0')+'시':'';};
  const wxTile=(cls,name,label,value,note,noteCls)=>'<div class="'+cls+'"><div class="wx-k"><span class="tile-art">'+art(name,cls==='wx-box'?22:18)+'</span>'+label+'</div><div class="wx-v"><b>'+value+'</b>'+(note?'<em class="'+(noteCls||'').trim()+'">'+note+'</em>':'')+'</div></div>';
  const staleTag=d=>'<span class="stale-tag" title="'+C.esc(d)+' 발행분">지난 정보</span>';
  function weatherCard(result,missing){
    const url=catUrl('weather',result?result.date:missing),w=result?wxData(result.md):null;
    const link=loc=>'<a class="wx-link" href="'+url+'" aria-label="웨더 · '+loc+' 자세히 보기"></a>';
    if(!w)return '<article class="digest-card wx-card" data-category="weather">'+link('부산')+cardTop('weather','<span class="card-kind">· 부산</span>')+'<p class="card-excerpt">'+(missing?'이 날짜의 날씨 정보가 없습니다':'날씨 정보를 확인해 주세요')+'</p></article>';
    const now=w.now||{},today=w.today||{},wind=w.wind||{},air=w.air||{},loc=C.esc(w.location||'부산'),g10=airGrade('pm10',air.pm10),g25=airGrade('pm25',air.pm25);
    const hour=(String(w.asOf||'').match(/T(\d{2}):/)||[])[1];
    const tag=w.sample===true?'<span class="chip">샘플</span>':'<span class="card-date">'+result.date.slice(5).replace('-','.')+(hour?' '+hour+'시':'')+' 기준</span>';
    const full='<div class="wx-full"><div class="wx-now"><span class="wx-temp">'+fmt(now.temp,'°')+'</span><div class="wx-sky"><strong>'+C.esc(now.sky||'')+'</strong><span>최고 '+fmt(today.max,'°')+' · 최저 '+fmt(today.min,'°')+'</span></div>'+art(skyArt(now.sky),44)+'</div><div class="wx-tiles">'
      +wxTile('wx-tile','rain','강수',fmt(today.pop,'%'),rainText(today.rain_mm))+wxTile('wx-tile','wind','바람',fmt(wind.speed_ms,' m/s',true),C.esc(wind.dir||''))
      +wxTile('wx-tile','pm10','미세먼지',fmt(air.pm10,''),g10?g10.label:'',g10&&g10.cls)+wxTile('wx-tile','pm25','초미세먼지',fmt(air.pm25,''),g25?g25.label:'',g25&&g25.cls)+'</div></div>';
    const line='<div class="wx-line">'+art(skyArt(now.sky),40)+'<div class="wx-line-main"><strong>'+loc+' '+fmt(now.temp,'°')+' · '+C.esc(now.sky||'')+'</strong><span>최고 '+fmt(today.max,'°')+' · 최저 '+fmt(today.min,'°')+' · 강수 '+fmt(today.pop,'%')+(w.sample===true?'':' · '+result.date.slice(5).replace('-','.')+(hour?' '+hour+'시':'')+' 기준')+'</span></div><div class="wx-chips">'+(w.sample===true?'<span class="g-chip">샘플</span>':'')+(g10?'<span class="g-chip'+g10.cls+'">미세 '+g10.label+'</span>':'')+(g25?'<span class="g-chip'+g25.cls+'">초미세 '+g25.label+'</span>':'')+'</div></div>';
    return '<article class="digest-card wx-card" data-category="weather">'+link(loc)+cardTop('weather','<span class="card-kind">· '+loc+'</span>'+tag)+full+line+'</article>';
  }
  function weatherView(w,date){
    const now=w.now||{},today=w.today||{},wind=w.wind||{},air=w.air||{},tm=w.tomorrow||{};
    const airBox=kind=>{const v=air[kind],g=airGrade(kind,v);return '<div class="wx-box"><div class="wx-k"><span class="tile-art">'+art(AIR[kind].art,22)+'</span>'+AIR[kind].name+'</div><div class="wx-v"><b>'+fmt(v,'')+(num(v)===null?'':'<span class="unit"> ㎍/㎥</span>')+'</b><em class="'+(g?g.cls.trim():'')+'">'+(g?g.label:'정보 없음')+'</em></div>'+(g?'<div class="g-scale" role="img" aria-label="'+AIR[kind].name+' 등급 '+g.label+'"><div class="bars"><span></span><span></span><span></span><span></span></div><i style="left:'+g.pos+'%"></i></div>':'')+'</div>';};
    const tmDate=/^\d{4}-\d{2}-\d{2}$/.test(tm.date||'')?tm.date:new Date(new Date(date+'T12:00:00Z').getTime()+86400000).toISOString().slice(0,10);
    const hours=Array.isArray(w.hourly)?w.hourly.slice(0,12):[];
    const src=(Array.isArray(w.sources)?w.sources:[]).map(s=>C.esc([s.name,s.base&&'발표 '+s.base,s.station&&'측정소 '+s.station,s.dataTime&&'측정 '+s.dataTime].filter(Boolean).join(' · '))).join(' / ');
    return '<div class="wx-view"><section class="wx-hero" aria-label="지금 날씨">'+(w.sample===true?'<span class="chip">샘플</span>':'')+'<div class="wx-hero-main"><span class="wx-temp">'+fmt(now.temp,'°')+'</span><strong>'+C.esc(now.sky||'')+'</strong><span class="wx-sub">체감 '+fmt(now.feels,'°')+' · 습도 '+fmt(now.humidity,'%')+' · 최고 '+fmt(today.max,'°')+' · 최저 '+fmt(today.min,'°')+'</span></div>'+art(skyArt(now.sky),76)+'</section>'
      +(hours.length?'<section class="wx-hourly" aria-label="시간별 예보"><ol>'+hours.map(h=>'<li><span class="h-t">'+hourLabel(h.time)+'</span>'+art(skyArt(h.sky),26)+'<span class="sr-only">'+C.esc(h.sky||'')+'</span><b>'+fmt(h.temp,'°')+'</b><em>'+fmt(h.pop,'%')+'</em></li>').join('')+'</ol></section>':'')
      +'<div class="wx-grid">'+wxTile('wx-box','rain','강수',fmt(today.pop,'%'),rainText(today.rain_mm))+wxTile('wx-box','wind','바람',fmt(wind.speed_ms,' m/s',true),C.esc(wind.dir||''))+airBox('pm10')+airBox('pm25')+'</div>'
      +'<section class="wx-tomorrow">'+art(skyArt(tm.sky),28)+'<strong>내일 '+'일월화수목금토'[new Date(tmDate+'T12:00:00Z').getUTCDay()]+'</strong><span>'+C.esc(tm.sky||'')+'</span><b>최고 '+fmt(tm.max,'°')+' · 최저 '+fmt(tm.min,'°')+'</b></section>'
      +(src?'<p class="wx-source">'+src+'</p>':'')+'</div>';
  }
  // ---- Home: card feed + archive calendar + 오늘의 흐름 ----
  const homeCards=()=>(LISTED.includes('weather')?['weather']:[]).concat(STORIES);
  const skeletons=CARDS=>CARDS.map(cat=>'<article id="card-'+cat+'" class="digest-card'+(cat==='financial'?' lead-card':cat==='weather'?' wx-card':'')+'" data-category="'+cat+'">'+(cat==='financial'?'<div class="lead-bar" aria-hidden="true"></div>':'')+cardTop(cat)+'<div class="card-main"><div class="skeleton title"></div><div class="skeleton short"></div><div class="card-excerpt">최신 브리핑 확인 중…</div></div></article>').join('');
  async function home(ready){
    const date=new URL(location.href).searchParams.get('date');
    $('#main').innerHTML='<h1 class="sr-only">땡이네 뉴스</h1><div class="home-layout"><div class="home-feed">'+rounds()+'<div class="feed" id="feed">'+skeletons(homeCards())+'</div><section class="sched-card" id="sched" aria-labelledby="sched-title" hidden></section></div>'
      +'<aside class="home-rail"><section class="home-cal" id="home-archive" aria-label="지난 호 달력"><div class="cal-head"><h2 id="cal-title"></h2><div class="cal-nav"><button id="cal-prev" type="button" aria-label="이전 달">'+svg('back')+'</button><button id="cal-next" type="button" aria-label="다음 달">'+svg('back','flip')+'</button></div></div><div class="cal-grid" id="cal-grid"></div><details class="archive-all"><summary>지난 호 전체 보기</summary><ul class="archive-list" id="archive-list"></ul></details><button class="text-button" id="close-calendar" type="button">달력 닫기</button></section>'
      +'<section class="flow-card" aria-labelledby="flow-title"><h2 id="flow-title">오늘의 흐름</h2><div id="flow-list"><p class="flow-wait">불러오는 중…</p></div></section></aside></div>';
    $('#cal-prev').addEventListener('click',()=>{view=new Date(Date.UTC(view.getUTCFullYear(),view.getUTCMonth()-1,1,12));renderCalendar();});
    $('#cal-next').addEventListener('click',()=>{view=new Date(Date.UTC(view.getUTCFullYear(),view.getUTCMonth()+1,1,12));renderCalendar();});
    $('#close-calendar').addEventListener('click',()=>closeHomeCal(true));
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeHomeCal(true);});
    document.addEventListener('click',e=>{const cal=$('#home-archive');if(cal&&cal.classList.contains('is-open')&&!cal.contains(e.target))closeHomeCal(false);});
    window.addEventListener('popstate',()=>loadHome(new URL(location.href).searchParams.get('date')));
    renderArchiveList();
    await ready;probePending();
    // [검토 제안 P4] ?date= 로 바로 열어도 달력 점·'지난 호 전체 보기'가 채워지게 날짜 목록을 따로 받는다.
    if(/^\d{4}-\d{2}-\d{2}$/.test(date||''))Promise.all(homeCards().map(cat=>dateIndex(cat))).then(all=>{all.flat().forEach(d=>homeDates.add(d));syncHomeDates();}).catch(()=>{});
    await loadHome(/^\d{4}-\d{2}-\d{2}$/.test(date||'')?date:null);
    if(location.hash==='#archive'){history.replaceState(history.state,'',location.pathname+location.search);openArchive();}
  }
  async function loadHome(date,push=false){
    const id=++homeId,feed=$('#feed'),label=$('#date-label');
    selected=date||'';if(date)view=new Date(date.slice(0,7)+'-01T12:00:00Z');if(label)label.textContent=shortDate(date||C.kstDate());
    if(push){const url=new URL(location.href);if(date)url.searchParams.set('date',date);else url.searchParams.delete('date');history.pushState({},'',url);}
    const CARDS=homeCards();
    feed.innerHTML=skeletons(CARDS);
    {const sb=$('#sched');if(sb){sb.hidden=true;sb.innerHTML='';}} // [GPT] 느린 연결에서 이전 날짜 일정이 남지 않게
    renderCalendar();renderArchiveList();
    const results={};
    await Promise.all(CARDS.map(async cat=>{
      let result;
      if(date)result=await fetchDate(cat,date);
      else{const dates=await dateIndex(cat);dates.forEach(d=>homeDates.add(d));result=await latest(cat,dates);}
      if(id!==homeId)return;
      results[cat]=result;if(result)homeDates.add(result.date);
      const slot=$('#card-'+cat);if(slot)slot.outerHTML=cat==='weather'?weatherCard(result,date):card(cat,result,date,cat==='financial');
      // [GPT] 최신 호 보기인데 오늘 것이 아직 없으면 '지난 정보' 표시
      if(!date&&result&&result.date<C.kstDate()){const top=$('#feed [data-category="'+cat+'"] .card-top');if(top)top.insertAdjacentHTML('beforeend',staleTag(result.date));}
    }));
    if(id!==homeId)return;
    if(!date){const days=Object.values(results).filter(Boolean).map(r=>r.date).sort();selected=days[days.length-1]||'';if(selected){view=new Date(selected.slice(0,7)+'-01T12:00:00Z');if(label)label.textContent=shortDate(selected);}}
    flow(results);balance(CARDS.length);schedules(results);syncHomeDates();
    // [M7] 아무 분야도 없는 날짜(?date=로 연 경우): 카드 6장의 '없습니다' 대신 안내 하나 + 최신 호·다시 시도 버튼
    $('#home-empty')?.remove();
    feed.hidden=false;
    if(date&&!Object.values(results).some(Boolean)){
      feed.insertAdjacentHTML('beforebegin','<section class="empty" id="home-empty"><h2>'+C.esc(shortDate(date))+'에는 발행된 브리핑이 없습니다</h2><p>달력에서 점이 있는 날을 고르거나 최신 호를 보세요.</p><button type="button" id="home-latest">최신 호 보기</button> <button type="button" id="home-retry">다시 시도</button></section>');
      feed.hidden=true; // 빈 카드 6장은 숨기고 안내 하나만
      $('#home-latest').addEventListener('click',()=>loadHome(null,true));
      $('#home-retry').addEventListener('click',()=>loadHome(date));
    }
  }
  function flow(results){
    const items=STORIES.map(cat=>{const r=results[cat];if(!r)return '';const one=P(r).oneLiner.trim().split(/\n\s*\n/)[0].replace(/\s+/g,' ');return one?'<div class="flow-item"><span class="flow-k">'+config[cat].short+'</span><span class="flow-v">'+C.inline(one)+'</span></div>':'';}).join('');
    $('#flow-list').innerHTML=items||'<p class="flow-wait">'+(selected&&selected<C.kstDate()?'이 날짜의 한 줄 요약이 없습니다':'한 줄 요약이 아직 없습니다')+'</p>';
  }
  // One card per live category, no fillers. Odd leftovers in the last grid row widen the last card (CSS reads data-r2/data-r3).
  function balance(n){const feed=$('#feed'),after=Math.max(0,n-1);feed.dataset.r3=after?String((after-1)%3):'0';feed.dataset.r2=String(after%2);}
  // [검토 제안 P5] 홈에서는 NBA 경기를 한 줄 요약 + '전체 보기'로 접는다. 지난 경기(오늘 날짜, 지금보다 이른 시각)는 흐리게.
  function compactSched(items,date){
    const isNba=x=>/^NBA\s/.test(x.title),nba=items.filter(isNba),rest=items.filter(x=>!isNba(x));
    if(nba.length<4)return schedList(items);
    const t=nba.map(x=>x.time).filter(v=>/^\d/.test(v)),now=new Date(Date.now()+9*3600000).toISOString().slice(11,16),past=x=>date===C.kstDate()&&/^\d/.test(x.time)&&x.time<now;
    return (rest.length?schedList(rest):'')+'<details class="sched-more"><summary><span class="sched-t">NBA</span><span class="sched-b"><strong>'+nba.length+'경기 · '+C.esc(t[0]||'')+(t.length>1?'–'+C.esc(t[t.length-1]):'')+'</strong><em>전체 경기 보기</em></span></summary>'
      +'<ul class="sched-list sched-compact">'+nba.map(x=>'<li'+(past(x)?' class="is-past"':'')+'><span class="sched-t">'+C.esc(x.time)+'</span><span class="sched-b">'+C.inline(x.title.replace(/^NBA\s+/,''))+'</span></li>').join('')+'</ul></details>';
  }
  // 오늘의 주요 일정: '## SCHEDULE' of each story category's issue for the shown date, grouped by topic (weather has none).
  function schedules(results){
    const box=$('#sched');if(!box)return;
    const groups=STORIES.map(cat=>{const r=results[cat];if(!r||(selected&&r.date!==selected))return '';const items=schedOf(P(r));return items.length?'<div class="sched-group" data-category="'+cat+'"><h3>'+catArt(cat,20)+config[cat].short+'</h3>'+(cat==='sports'?compactSched(items,r.date):schedList(items))+'</div>':'';}).join('');
    box.hidden=!groups;box.innerHTML=groups?'<h2 id="sched-title">오늘의 주요 일정 <span>'+C.esc(shortDate(selected))+' · 한국 시간</span></h2>'+groups:'';
  }
  function syncHomeDates(){if(!HOME)return;available=[...homeDates].filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&d<=C.kstDate()).sort().reverse();renderCalendar();renderArchiveList();}
  function renderArchiveList(){
    const list=$('#archive-list');if(!list)return;
    list.innerHTML=available.length?available.map(d=>'<li><button type="button" class="archive-item" data-pick="'+d+'"'+(d===selected?' aria-current="true"':'')+'>'+C.formatDate(d)+'</button></li>').join(''):'<li class="archive-empty">발행 기록을 확인하는 중입니다</li>';
    list.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{closeHomeCal(mobile());loadHome(b.dataset.pick,true);}));
  }
  function controls(){return '<div class="date-controls"><details class="archive-picker" id="archive-picker"><summary class="date-trigger">'+svg('calendar')+'<span id="selected-label">날짜 선택</span>'+svg('chevron','chevron')+'</summary><div class="calendar"><div class="cal-head"><strong id="cal-title"></strong><div class="cal-nav"><button id="cal-prev" aria-label="이전 달">‹</button><button id="cal-next" aria-label="다음 달">›</button></div></div><div class="cal-grid" id="cal-grid"></div><p class="cal-note">● 발행된 브리핑 · 날짜는 한국 시간 기준</p><button class="text-button" id="close-calendar">달력 닫기</button></div></details><div class="date-step"><button id="previous-date">이전 호</button><button id="latest-date">최신 호</button></div><span class="status" id="read-status" role="status"></span></div>';}
  function updateControls(){
    if(!$('#selected-label'))return;$('#selected-label').textContent=selected?C.formatDate(selected):'날짜 선택';
    $('#previous-date').disabled=!available.some(d=>d<selected);$('#read-status').textContent=selected===C.kstDate()?'오늘 발행':selected?'보관된 브리핑':'';
  }
  function renderCalendar(){
    if(!$('#cal-grid'))return;const y=view.getUTCFullYear(),m=view.getUTCMonth();$('#cal-title').textContent=y+'년 '+(m+1)+'월';
    let html=['일','월','화','수','목','금','토'].map(d=>'<div class="cal-wd">'+d+'</div>').join('');
    html+='<span></span>'.repeat(new Date(Date.UTC(y,m,1)).getUTCDay());
    for(let d=1;d<=new Date(Date.UTC(y,m+1,0)).getUTCDate();d++){
      const date=y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0'),exists=available.includes(date),canSelect=exists||date<=C.kstDate(); // past days stay clickable even when the date list is stale or the API is rate-limited
      html+='<button class="cal-day'+(exists?' has-brief':'')+'" data-date="'+date+'" aria-label="'+(m+1)+'월 '+d+'일'+(exists?', 브리핑 있음':'')+'" aria-pressed="'+(date===selected)+'"'+(!canSelect?' disabled':'')+'>'+d+'</button>';
    }
    $('#cal-grid').innerHTML=html;$('#cal-grid').querySelectorAll('button:not(:disabled)').forEach(el=>el.addEventListener('click',()=>{
      if(HOME){const m=mobile(),d=el.dataset.date;closeHomeCal(m);loadHome(d,true);if(!m)$('.cal-day[data-date="'+d+'"]')?.focus();return;}
      closeCalendar();load(el.dataset.date,true);}));
  }
  // [검토 제안 P3] 날짜 목록이 낡아도(인덱스 미갱신·API 한도) 발행된 날을 건너뛰지 않게, 알려진 이전 호까지의 날을 차례로 확인한다.
  async function previousIssue(){
    const from=selected,known=available.filter(d=>d<from).sort().reverse()[0]||'';$('#read-status').textContent='이전 호 찾는 중…';
    // 신호가 약할 때 날마다 5.5초씩 기다려 1분 넘게 멈추지 않게, 전체 8초가 지나면 알고 있는 이전 호로 간다
    const deadline=Date.now()+8000;
    for(let i=1;i<=14&&Date.now()<deadline;i++){const d=new Date(Date.parse(from+'T12:00:00Z')-i*86400000).toISOString().slice(0,10);if(d<=known)break;if(await fetchDate(page,d)){if(!available.includes(d))available.push(d);return d;}}
    return known||null;
  }
  function closeCalendar(){const el=$('#archive-picker');if(el.open){el.open=false;el.querySelector('summary').focus();}}
  function story(text){if(!text)return '';const split=text.search(/^####\s/m);let main=text,more='';if(split>=0){main=text.slice(0,split);more=text.slice(split);}return '<section class="story"><div class="kicker">오늘의 흐름 · THE BIG PICTURE</div><div class="prose">'+C.markdown(main)+'</div>'+(more?'<details class="story-more"><summary>배경과 해석 더 읽기</summary><div class="prose">'+C.markdown(more)+'</div></details>':'')+'</section>';}
  function render(result){
    const data=C.parse(result.md),wx=page==='weather',sections=visible(page,data.sections).filter(s=>(!wx||s.key!=='WEATHER')&&(s.items.length||s.intro.trim()));
    const total=sections.reduce((n,s)=>n+s.items.length,0);
    let html=(result.cached?'<p class="offline-note" role="status">연결을 확인할 수 없어 저장해 둔 브리핑을 표시합니다.</p>':'');
    if(data.date && data.date!==result.date)html+='<p class="offline-note">선택한 발행일 '+C.esc(result.date)+' · 원문 표기일 '+C.esc(data.date)+'</p>';
    if(wx){const w=wxData(result.md);html+=w?weatherView(w,result.date):'<section class="empty"><h2>날씨 데이터가 없습니다</h2><p>이 날짜 파일에 weather 블록이 없습니다.</p></section>';if(data.story)html+='<section class="wx-note prose">'+C.markdown(data.story)+'</section>';}
    else html+=story(data.story);
    if(data.preamble)html+='<div class="source-note prose">'+C.markdown(data.preamble)+'</div>';
    if(!wx||sections.length)html+='<div class="reading-tools"><span>'+total+'개 이슈 · '+C.sourceCount(result.md)+'개 출처 도메인</span><button class="text-button" id="expand-all" aria-expanded="false">모두 펼치기</button></div>';
    // '한눈에 보는 이슈' overview removed (1103): sections render directly below.
    html+=sections.map((section,index)=>'<section class="category" id="section-'+index+'"><header class="category-header"><span class="number">'+String(index+1).padStart(2,'0')+'</span><h2>'+C.esc(C.sectionLabel(page,section.key))+'</h2><span class="count">'+section.items.length+' ISSUES</span></header>'+(section.intro.trim()?'<div class="prose">'+C.markdown(section.intro)+'</div>':'')+section.items.map((item,i)=>'<details class="article" id="item-'+index+'-'+i+'"><summary><div class="article-heading"><h3>'+C.inline(item.headline)+'</h3>'+(item.summary.trim()?'<div class="article-summary">'+C.markdown(item.summary)+'</div>':'')+'</div><span class="toggle" aria-hidden="true">+</span></summary><div class="article-body">'+item.blocks.map(block=>{
      const title=blockLabels[block.title.toLowerCase()]||block.title;
      const cls=/결과|result/i.test(title)?' results':/주의|한계|limitation/i.test(title)?' caution':/출처|source/i.test(title)?' sources':'';
      return '<section class="block'+cls+'"><h4>'+C.esc(title)+'</h4><div class="prose">'+C.markdown(block.body)+'</div></section>';
    }).join('')+(item.blocks.length?'':'<p class="source-note">원문에 추가 세부 항목이 없습니다.</p>')+'</div></details>').join('')+'</section>').join('');
    const sched=schedOf(data);if(sched.length)html+='<section class="sched-card sched-page" aria-label="오늘의 일정"><h2>오늘의 일정 <span>한국 시간</span></h2>'+schedList(sched)+'</section>';
    if(data.oneLiner)html+='<aside class="one-liner"><div class="kicker">마지막 한 줄</div><div class="prose">'+C.markdown(data.oneLiner)+'</div></aside>';
    html+='<div class="author">'+(data.author?'작성 · '+C.inline(data.author):'작성자 정보가 원문에 기록되지 않았습니다.')+'<br><a href="'+new URL(result.path,base).href+'">Markdown 원문 보기</a></div>';
    return html;
  }
  async function load(date,push=false){
    const id=++requestId;$('#content').setAttribute('aria-busy','true');$('#read-status').textContent='브리핑 확인 중…';
    if(date){selected=date;updateControls();renderCalendar();}
    const result=date?await fetchDate(page,date):await latest(page,available);
    if(id!==requestId)return;
    $('#content').setAttribute('aria-busy','false');
    if(!result){$('#content').innerHTML='<section class="empty"><h2>브리핑을 불러오지 못했습니다</h2><p>'+C.esc(date?shortDate(date):'최신 호')+'의 발행 여부와 인터넷 연결을 확인해 주세요.<br>다른 날짜를 선택하거나 다시 시도할 수 있습니다.</p><button id="retry">다시 시도</button>'+(date?' <button id="go-latest">최신 호 보기</button>':'')+'</section>';$('#retry').addEventListener('click',()=>load(date));$('#go-latest')?.addEventListener('click',()=>load(null,true));
      // [GPT] 실패해도 주소·머리줄·제목이 요청한 날짜와 맞게
      const hd=$('#hero-date');if(hd)hd.textContent=date?date.slice(5).replace('-','.')+' 발행 없음':'';
      if(date){const u=new URL(location.href);u.searchParams.set('date',date);if(push)history.pushState({},'',u);else history.replaceState({},'',u);document.title=config[page].name+' · '+date;}$('#read-status').textContent='불러오기 실패';return;}
    lastResult=result;selected=result.date;view=new Date(selected.slice(0,7)+'-01T12:00:00Z');if(!available.includes(selected))available.push(selected);available.sort().reverse();
    $('#content').innerHTML=(!date&&result.date<C.kstDate()&&!result.cached?'<p class="offline-note">'+staleTag(result.date)+' 오늘 브리핑이 아직 없어 '+C.esc(shortDate(result.date))+' 호를 표시합니다.</p>':'')+render(result);updateControls();const hd=$('#hero-date');if(hd)hd.textContent=selected.slice(5).replace('-','.')+' 발행';renderCalendar();
    const url=new URL(location.href);url.searchParams.set('date',selected);if(push)history.pushState({},'',url);else history.replaceState({},'',url);
    document.title=config[page].name+' · '+selected;
    document.querySelectorAll('.ov-open').forEach(b=>b.addEventListener('click',()=>{const el=document.getElementById(b.dataset.target);if(!el)return;el.open=true;el.scrollIntoView({behavior:'smooth',block:'start'});el.querySelector('summary').focus({preventScroll:true});}));
    const expand=$('#expand-all');if(expand)expand.addEventListener('click',event=>{const button=event.currentTarget,open=button.getAttribute('aria-expanded')!=='true';document.querySelectorAll('.article').forEach(el=>el.open=open);button.setAttribute('aria-expanded',String(open));button.textContent=open?'모두 접기':'모두 펼치기';});
  }
  // Category top = the home card 'opened': same card surface, icon tile, label and (financial) gradient bar.
  // Rendered synchronously so it exists at the first paint (the cross-document view transition morphs card → hero).
  function hero(cat){const c=config[cat];return '<header class="cat-hero'+(cat==='financial'?' lead-hero':'')+'" data-category="'+cat+'">'+(cat==='financial'?'<div class="lead-bar" aria-hidden="true"></div>':'')+cardTop(cat,'<span class="card-date" id="hero-date"></span>')+'<h1>'+C.esc(c.name)+'</h1><p>'+C.esc(c.subtitle)+'</p></header>';}
  async function category(ready){
    const c=config[page];$('#main').innerHTML=hero(page)+controls()+'<div id="content" aria-busy="true"><div class="loading-note" role="status">브리핑을 불러오는 중입니다…</div></div>';
    $('#cal-prev').addEventListener('click',()=>{view=new Date(Date.UTC(view.getUTCFullYear(),view.getUTCMonth()-1,1,12));renderCalendar();});
    $('#cal-next').addEventListener('click',()=>{view=new Date(Date.UTC(view.getUTCFullYear(),view.getUTCMonth()+1,1,12));renderCalendar();});
    $('#close-calendar').addEventListener('click',closeCalendar);
    $('#previous-date').addEventListener('click',async()=>load(await previousIssue(),true));
    $('#latest-date').addEventListener('click',()=>load(null,true));
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeCalendar();});
    document.addEventListener('click',e=>{if(!$('#archive-picker').contains(e.target))$('#archive-picker').open=false;});
    window.addEventListener('popstate',()=>load(new URL(location.href).searchParams.get('date')));
    const wantsArchive=location.hash==='#archive';if(wantsArchive)history.replaceState(history.state,'',location.pathname+location.search);
    const date=new URL(location.href).searchParams.get('date');
    await ready;
    if(PENDING.has(page)&&!/^\d{4}-\d{2}-\d{2}$/.test(date||'')){$('#content').setAttribute('aria-busy','false');$('#content').innerHTML='<section class="empty"><h2>'+C.esc(c.short)+' 브리핑은 준비 중입니다</h2><p>첫 브리핑이 발행되면 여기와 홈에 나타납니다.</p></section>';$('#read-status').textContent='';probePending();return;}
    available=await dateIndex(page);renderCalendar();await load(/^\d{4}-\d{2}-\d{2}$/.test(date||'')?date:null);
    if(wantsArchive)openArchive();
  }
  // First paint is synchronous (shell + home skeleton cards / category hero) so view transitions have both ends;
  // the published-category gate resolves afterwards and only redraws menus if it hides something.
  const before=LISTED.join(),ready=gate().then(()=>{if(LISTED.join()!==before)refreshNav();}).catch(()=>{});
  Promise.resolve().then(()=>{shell();return HOME?home(ready):category(ready);}).catch(()=>{$('#main').innerHTML='<section class="empty"><h2>화면을 불러오지 못했습니다</h2><p>잠시 후 새로고침해 주세요.</p></section>';});
  if('serviceWorker' in navigator)window.addEventListener('load',()=>{navigator.serviceWorker.register(new URL('sw.js',base),{scope:base.pathname,updateViaCache:'none'}).then(registration=>registration.update()).catch(()=>{});});
})();
