/* Static PWA: original Markdown remains the source of truth. No build step. */
(function () {
  'use strict';
  const C=window.BriefingCore, page=document.body.dataset.page, HOME=page==='home';
  const base=new URL(HOME?'./':'../', location.href);
  const config={
    financial:{name:'파이낸셜 브리핑',en:'Financial',subtitle:'시장과 숫자, 그 뒤에 있는 맥락.',icon:'chart'},
    international:{name:'인터내셔널 브리핑',en:'International',subtitle:'세계를 읽는 네 개의 시선.',icon:'globe'},
    medical:{name:'메디컬 브리핑',en:'Medical',subtitle:'연구의 결과와 한계를 함께 읽습니다.',icon:'cross'},
    health:{name:'가족 건강 브리핑',en:'Health',subtitle:'일상에 닿는 건강 연구와 생활의 발견.',icon:'heart'}
  };
  const blockLabels={'why it matters':'왜 중요한가','context':'배경','market implication':'시장 영향','source':'출처','sources':'출처','why':'어떤 연구','abstract':'초록','results':'주요 결과','clinical application':'임상 적용','limitations':'주의할 점','takeaway':'핵심 정리'};
  const icons={chart:'<path d="M4 19h16M7 15V9m5 6V5m5 10v-5"/>',globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/>',cross:'<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z"/>',heart:'<path d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1c-4 4 1 10 8 15 7-5 12-11 8-15Z"/>',arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',moon:'<path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18"/>',chevron:'<path d="m7 10 5 5 5-5"/>',book:'<path d="M12 6v15M3 4h4a5 5 0 0 1 5 2 5 5 0 0 1 5-2h4v15h-4a5 5 0 0 0-5 2 5 5 0 0 0-5-2H3Z"/>'};
  const svg=(name,cls='')=>'<svg class="'+cls+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(icons[name]||icons.book)+'</svg>';
  const storage={get(key){try{return localStorage.getItem(key);}catch{return null;}},set(key,value){try{localStorage.setItem(key,value);}catch{}}};
  let requestId=0, selected='', available=[], view=new Date(C.kstDate()+'T12:00:00Z'), lastResult=null;
  const $=selector=>document.querySelector(selector);
  function setTheme(dark){document.documentElement.classList.toggle('dark',dark);$('#theme-toggle').setAttribute('aria-pressed',String(dark));$('#theme-toggle').setAttribute('aria-label',dark?'밝은 테마로 전환':'어두운 테마로 전환');$('meta[name=theme-color]').content=dark?'#0e1925':'#132b41';}
  async function request(url,type='text',timeout=5500){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);try{const response=await fetch(url,{cache:'no-cache',signal:controller.signal});if(!response.ok)throw Error(String(response.status));return type==='json'?await response.json():await response.text();}finally{clearTimeout(timer);}}
  async function dateIndex(cat){
    let dates=[];try{const saved=JSON.parse(storage.get('daily-briefings-dates-'+cat)||'null');if(saved&&Array.isArray(saved.dates))dates=saved.dates;}catch{}
    try{const index=await request(new URL('assets/briefing-index.json',base),'json');dates=[...new Set([...dates,...(index.categories[cat]||[])])];}catch{}
    // Refresh without delaying today's reading. A snapshot/cache never prevents probing today's file.
    request('https://api.github.com/repos/bwkim1025/daily-briefings/contents/'+cat+'/briefings','json',4500).then(items=>{
      if(!Array.isArray(items))return;const fresh=[...new Set(items.map(i=>(i.name||'').match(/^(\d{4}-\d{2}-\d{2})(?:-[a-z]+)?\.md$/)).filter(Boolean).map(m=>m[1]))].sort().reverse();
      storage.set('daily-briefings-dates-'+cat,JSON.stringify({dates:fresh,at:Date.now()}));
      if(page===cat){available=fresh;renderCalendar();updateControls();}
    }).catch(()=>{});
    return dates.filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse();
  }
  async function fetchDate(cat,date){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
    if(!navigator.onLine){try{const saved=JSON.parse(storage.get('daily-briefings-article-'+cat+'-'+date)||'null');if(saved?.md)return{date,md:saved.md,path:saved.path,cached:true};}catch{}return null;}
    const suffixes=cat==='medical'?['.md','-journal.md','-policy.md']:['.md'];
    for(const suffix of suffixes){
      const path=cat+'/briefings/'+date+suffix;
      for(const url of [new URL(path,base).href,'https://raw.githubusercontent.com/bwkim1025/daily-briefings/main/'+path]){
        try{const md=await request(url);if(!/^#\s+\d{4}-\d{2}-\d{2}/m.test(md))continue;
          storage.set('daily-briefings-article-'+cat+'-'+date,JSON.stringify({md,at:Date.now(),path}));
          return{date,md,path,cached:false};}catch{}
      }
    }
    try{const cached=JSON.parse(storage.get('daily-briefings-article-'+cat+'-'+date)||'null');if(cached?.md)return{date,md:cached.md,path:cached.path,cached:true};}catch{}
    return null;
  }
  async function latest(cat,dates){
    const today=C.kstDate();const candidates=[...new Set([today,...dates.filter(d=>d<=today),...Array.from({length:14},(_,i)=>C.kstDate(i))])];
    for(const ds of candidates){const result=await fetchDate(cat,ds);if(result)return result;}
    return null;
  }
  function navigation(){return '<nav class="nav" aria-label="브리핑 카테고리"><a href="'+base.href+'"'+(HOME?' aria-current="page"':'')+'>전체 브리핑</a>'+Object.entries(config).map(([key,c])=>'<a href="'+new URL(key+'/',base).href+'"'+(page===key?' aria-current="page"':'')+'>'+({financial:'파이낸셜',international:'인터내셔널',medical:'메디컬',health:'가족 건강'}[key])+'</a>').join('')+'</nav>';}
  function shell(){
    $('#app').innerHTML='<a class="skip" href="#main">본문으로 건너뛰기</a><div class="shell"><header class="topbar"><a class="brand" href="'+base.href+'"><img src="'+new URL('icon-192.png',base).href+'" alt="" width="40" height="40"><div><div class="brand-name">Daily Briefings</div><div class="brand-caption">A CLEARER VIEW, EVERY DAY</div></div></a><div class="tools"><button class="icon-btn" id="theme-toggle">'+svg('moon')+'</button></div></header>'+navigation()+'<main id="main"></main><footer class="footer"><span>DAILY BRIEFINGS · bwkim1025</span><span>Personal use only · 원문을 함께 확인하세요</span></footer></div>';
    setTheme(document.documentElement.classList.contains('dark'));
    $('#theme-toggle').addEventListener('click',()=>{const dark=!document.documentElement.classList.contains('dark');setTheme(dark);storage.set('eb-theme',dark?'dark':'light');});
  }
  function card(cat,result){
    const c=config[cat];let headline='새 브리핑을 확인해 주세요',excerpt=c.subtitle,date='';let count='';
    if(result){const data=C.parse(result.md),lead=C.lead(data.story);headline=lead.headline||data.sections.flatMap(s=>s.items)[0]?.headline||c.name;excerpt=lead.paragraph||c.subtitle;date=result.date.slice(5).replace('-','.');count=data.sections.reduce((n,s)=>n+s.items.length,0)+'개 이슈 · '+C.sourceCount(result.md)+'개 출처 도메인';}
    const url=new URL(cat+'/',base);if(result)url.searchParams.set('date',result.date);
    return '<article class="digest-card" data-category="'+cat+'"><div class="card-top"><div class="category-symbol">'+svg(c.icon)+'</div><div><div class="category-en">'+c.en.toUpperCase()+'</div><div class="category-name">'+c.name+'</div></div><span class="card-date">'+(date?date+' 발행':'')+'</span></div><div class="card-main"><h3 class="card-headline"><a href="'+url.href+'">'+C.esc(headline)+'</a></h3><p class="card-excerpt">'+C.esc(excerpt)+'</p></div><div class="card-foot"><span>'+count+'</span><a href="'+url.href+'">브리핑 읽기 '+svg('arrow')+'</a></div></article>';
  }
  async function home(){
    $('#main').innerHTML='<section class="home-hero"><div><div class="kicker">YOUR DAILY PERSPECTIVE</div><h1>하루의 흐름을,<br><span>한눈에.</span></h1><p>시장부터 가족의 건강까지, 중요한 맥락을 모았습니다.</p></div><div class="edition"><strong>'+C.formatDate(C.kstDate())+'</strong>SEOUL · KST</div></section><section aria-labelledby="digest-heading"><div class="section-label"><h2 id="digest-heading">분야별 최신 브리핑</h2><span>네 가지 시선, 하나의 일상</span></div><div class="digest-grid">'+Object.keys(config).map(cat=>'<div id="card-'+cat+'"><article class="digest-card" data-category="'+cat+'"><div class="card-top"><div class="category-symbol">'+svg(config[cat].icon)+'</div><div class="category-name">'+config[cat].name+'</div></div><div class="card-main"><div class="skeleton title"></div><div class="skeleton short"></div><div class="skeleton"></div><div class="card-excerpt">최신 브리핑 확인 중…</div></div></article></div>').join('')+'</div></section><aside class="principle">'+svg('book')+'<p><strong>핵심부터 읽고, 근거까지 확인하세요.</strong><br>각 브리핑에 발행일, 정보 기준, 원문 링크와 작성자 정보를 함께 담았습니다.</p></aside>';
    await Promise.all(Object.keys(config).map(async cat=>{const dates=await dateIndex(cat);const result=await latest(cat,dates);$('#card-'+cat).outerHTML=card(cat,result);}));
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
      const date=y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0'),exists=available.includes(date),canSelect=exists||date===C.kstDate();
      html+='<button class="cal-day'+(exists?' has-brief':'')+'" data-date="'+date+'" aria-label="'+date+(exists?' 브리핑 읽기':' 브리핑 확인')+'" aria-pressed="'+(date===selected)+'"'+(!canSelect?' disabled':'')+'>'+d+'</button>';
    }
    $('#cal-grid').innerHTML=html;$('#cal-grid').querySelectorAll('button:not(:disabled)').forEach(el=>el.addEventListener('click',()=>{closeCalendar();load(el.dataset.date,true);}));
  }
  function closeCalendar(){const el=$('#archive-picker');if(el.open){el.open=false;el.querySelector('summary').focus();}}
  function story(text){if(!text)return '';const split=text.search(/^####\s/m);let main=text,more='';if(split>=0){main=text.slice(0,split);more=text.slice(split);}return '<section class="story"><div class="kicker">오늘의 흐름 · THE BIG PICTURE</div><div class="prose">'+C.markdown(main)+'</div>'+(more?'<details class="story-more"><summary>배경과 해석 더 읽기</summary><div class="prose">'+C.markdown(more)+'</div></details>':'')+'</section>';}
  function render(result){
    const data=C.parse(result.md),sections=data.sections.filter(s=>s.items.length||s.intro.trim());
    const total=sections.reduce((n,s)=>n+s.items.length,0);
    let html=(result.cached?'<p class="offline-note" role="status">연결을 확인할 수 없어 저장해 둔 브리핑을 표시합니다.</p>':'');
    if(data.date && data.date!==result.date)html+='<p class="offline-note">선택한 발행일 '+C.esc(result.date)+' · 원문 표기일 '+C.esc(data.date)+'</p>';
    html+=story(data.story);
    if(data.preamble)html+='<div class="source-note prose">'+C.markdown(data.preamble)+'</div>';
    html+='<div class="reading-tools"><h2>한눈에 보는 이슈</h2><span>'+total+'개 이슈 · '+C.sourceCount(result.md)+'개 출처 도메인</span><button class="text-button" id="expand-all" aria-expanded="false">모두 펼치기</button></div>';
    if(sections.length)html+='<nav class="overview" aria-label="본문 목차">'+sections.map((s,i)=>'<a href="#section-'+i+'"><span class="overview-label">'+String(i+1).padStart(2,'0')+' · '+C.esc(C.sectionLabel(page,s.key))+'</span><span class="overview-title">'+C.esc(s.items[0]?.headline||s.intro.trim())+'</span><span class="overview-count">'+s.items.length+'개 이슈 ↗</span></a>').join('')+'</nav>';
    html+=sections.map((section,index)=>'<section class="category" id="section-'+index+'"><header class="category-header"><span class="number">'+String(index+1).padStart(2,'0')+'</span><h2>'+C.esc(C.sectionLabel(page,section.key))+'</h2><span class="count">'+section.items.length+' ISSUES</span></header>'+(section.intro.trim()?'<div class="prose">'+C.markdown(section.intro)+'</div>':'')+section.items.map((item,i)=>'<details class="article" id="item-'+index+'-'+i+'"><summary><div class="article-heading"><h3>'+C.inline(item.headline)+'</h3>'+(item.summary.trim()?'<div class="article-summary">'+C.markdown(item.summary)+'</div>':'')+'</div><span class="toggle" aria-hidden="true">+</span></summary><div class="article-body">'+item.blocks.map(block=>{
      const title=blockLabels[block.title.toLowerCase()]||block.title;
      const cls=/결과|result/i.test(title)?' results':/주의|한계|limitation/i.test(title)?' caution':/출처|source/i.test(title)?' sources':'';
      return '<section class="block'+cls+'"><h4>'+C.esc(title)+'</h4><div class="prose">'+C.markdown(block.body)+'</div></section>';
    }).join('')+(item.blocks.length?'':'<p class="source-note">원문에 추가 세부 항목이 없습니다.</p>')+'</div></details>').join('')+'</section>').join('');
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
    if(!result){$('#content').innerHTML='<section class="empty"><h2>브리핑을 불러오지 못했습니다</h2><p>'+C.esc(date||'최신 호')+'의 발행 여부와 인터넷 연결을 확인해 주세요.<br>다른 날짜를 선택하거나 다시 시도할 수 있습니다.</p><button id="retry">다시 시도</button></section>';$('#retry').addEventListener('click',()=>load(date));$('#read-status').textContent='불러오기 실패';return;}
    lastResult=result;selected=result.date;view=new Date(selected.slice(0,7)+'-01T12:00:00Z');if(!available.includes(selected))available.push(selected);available.sort().reverse();
    $('#content').innerHTML=render(result);updateControls();renderCalendar();
    const url=new URL(location.href);url.searchParams.set('date',selected);if(push)history.pushState({},'',url);else history.replaceState({},'',url);
    document.title=config[page].name+' · '+selected;
    $('#expand-all').addEventListener('click',event=>{const button=event.currentTarget,open=button.getAttribute('aria-expanded')!=='true';document.querySelectorAll('.article').forEach(el=>el.open=open);button.setAttribute('aria-expanded',String(open));button.textContent=open?'모두 접기':'모두 펼치기';});
  }
  async function category(){
    const c=config[page];$('#main').innerHTML='<header class="page-masthead"><div><div class="kicker">'+c.en.toUpperCase()+' / DAILY EDITION</div><h1>'+c.name+'</h1><p>'+c.subtitle+'</p></div><div class="edition">FACTS · CONTEXT · PERSPECTIVE</div></header>'+controls()+'<div id="content" aria-busy="true"><div class="loading-note" role="status">브리핑을 불러오는 중입니다…</div></div>';
    $('#cal-prev').addEventListener('click',()=>{view=new Date(Date.UTC(view.getUTCFullYear(),view.getUTCMonth()-1,1,12));renderCalendar();});
    $('#cal-next').addEventListener('click',()=>{view=new Date(Date.UTC(view.getUTCFullYear(),view.getUTCMonth()+1,1,12));renderCalendar();});
    $('#close-calendar').addEventListener('click',closeCalendar);
    $('#previous-date').addEventListener('click',()=>load(available.filter(d=>d<selected).sort().reverse()[0],true));
    $('#latest-date').addEventListener('click',()=>load(null,true));
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeCalendar();});
    document.addEventListener('click',e=>{if(!$('#archive-picker').contains(e.target))$('#archive-picker').open=false;});
    window.addEventListener('popstate',()=>load(new URL(location.href).searchParams.get('date')));
    available=await dateIndex(page);renderCalendar();const date=new URL(location.href).searchParams.get('date');await load(/^\d{4}-\d{2}-\d{2}$/.test(date||'')?date:null);
  }
  shell();(HOME?home():category()).catch(()=>{$('#main').innerHTML='<section class="empty"><h2>화면을 불러오지 못했습니다</h2><p>잠시 후 새로고침해 주세요.</p></section>';});
  if('serviceWorker' in navigator)window.addEventListener('load',()=>{navigator.serviceWorker.register(new URL('sw.js',base),{scope:base.pathname,updateViaCache:'none'}).then(registration=>registration.update()).catch(()=>{});});
})();
