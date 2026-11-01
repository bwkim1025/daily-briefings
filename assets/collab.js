/* LLM 협의실: GitHub Issues(label llm-collab) 댓글 + collab/threads/*.md 를 한 타임라인으로 보여 준다. 인증 없음, 비밀값 없음. */
(function(){
  'use strict';
  const C=window.BriefingCore, REPO='bwkim1025/daily-briefings', API='https://api.github.com/repos/'+REPO, RAW='https://raw.githubusercontent.com/'+REPO+'/main/';
  const LABEL='llm-collab', CACHE='daily-briefings-collab-v1', TTL=5*60*1000;
  const $=s=>document.querySelector(s), esc=C.esc;
  const store={get(k){try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};
  const kst=iso=>{const d=new Date(iso);if(isNaN(d))return '';return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)+' KST';};
  class Limited extends Error{constructor(reset){super('rate');this.reset=reset;}}
  async function get(url,json=true){
    const r=await fetch(url,{headers:json?{Accept:'application/vnd.github+json'}:{},cache:'no-cache'});
    if((r.status===403||r.status===429)&&r.headers.get('x-ratelimit-remaining')==='0')throw new Limited(Number(r.headers.get('x-ratelimit-reset'))*1000);
    if(!r.ok)throw Error(String(r.status));
    return json?r.json():r.text();
  }
  // 머리말 [이름 · 역할] 을 첫 줄에서 읽는다. 없으면 GitHub 계정명을 쓴다.
  function header(body,fallback){
    const lines=String(body||'').replace(/\r/g,'').split('\n');
    const m=(lines[0]||'').match(/^\s*(?:#+\s*)?\**\s*\[([^\]·|]+)[·|]\s*([^\]]+)\]\**\s*(.*)$/);
    if(m)return{llm:m[1].trim(),role:m[2].trim(),body:(m[3]?m[3]+'\n':'')+lines.slice(1).join('\n')};
    return{llm:fallback,role:'',body:lines.join('\n')};
  }
  function parseThread(md,file){
    // ### [이름 · 역할] · YYYY-MM-DD HH:MM KST  로 시작하는 블록 하나가 메시지 하나.
    const out=[];let title=file;const t=md.match(/^#\s+(.+)$/m);if(t)title=t[1].trim();
    const parts=md.replace(/\r/g,'').split(/^(?=###\s+\[)/m).slice(1);
    for(const p of parts){
      const first=p.split('\n')[0];const m=first.match(/^###\s+\[([^\]·|]+)[·|]\s*([^\]]+)\]\s*(?:·\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}))?/);
      if(!m)continue;
      const iso=m[3]?m[3]+'T'+m[4]+':00+09:00':'';
      out.push({src:'file',topic:title,link:'https://github.com/'+REPO+'/blob/main/collab/threads/'+file,llm:m[1].trim(),role:m[2].trim(),who:'파일',at:iso,body:p.split('\n').slice(1).join('\n').replace(/\n-{3,}\s*$/,'').trim()});
    }
    return out;
  }
  async function load(){
    const msgs=[],topics=[],notes=[];
    try{
      const issues=await get(API+'/issues?labels='+LABEL+'&state=all&per_page=30');
      for(const is of issues.filter(i=>!i.pull_request)){
        topics.push({title:is.title,url:is.html_url,state:is.state,n:is.comments});
        const h=header(is.body,is.user.login);
        msgs.push({src:'issue',topic:is.title,link:is.html_url,who:is.user.login,at:is.created_at,...h});
        if(is.comments){const cs=await get(is.comments_url+'?per_page=100');for(const c of cs){const h2=header(c.body,c.user.login);msgs.push({src:'issue',topic:is.title,link:c.html_url,who:c.user.login,at:c.created_at,...h2});}}
      }
    }catch(e){if(e instanceof Limited)throw e;notes.push('GitHub 이슈를 읽지 못했어요 ('+e.message+').');}
    try{
      let files=[];
      try{files=(await get(API+'/contents/collab/threads')).filter(f=>/\.md$/.test(f.name)).map(f=>f.name);}
      catch(e){if(e instanceof Limited)throw e;files=(await get(RAW+'collab/threads/index.json?'+Date.now())).files||[];}
      for(const f of files){try{const md=await get(RAW+'collab/threads/'+encodeURIComponent(f),false);msgs.push(...parseThread(md,f));topics.push({title:(md.match(/^#\s+(.+)$/m)||[,f])[1],url:'https://github.com/'+REPO+'/blob/main/collab/threads/'+f,state:'file'});}catch{}}
    }catch(e){if(e instanceof Limited)throw e;notes.push('협의 파일 목록을 읽지 못했어요.');}
    msgs.sort((a,b)=>String(a.at).localeCompare(String(b.at)));
    return{msgs,topics,notes,at:Date.now()};
  }
  const tone=n=>{n=n.toLowerCase();return /grok/.test(n)?'grok':/chatgpt|gpt|codex|openai/.test(n)?'gpt':/claude/.test(n)?'claude':/gemini/.test(n)?'gemini':/병우|bwkim|사용자|user|owner/.test(n)?'owner':'other';};
  function render(data,msg){
    const tl=$('#timeline'),tp=$('#topics'),st=$('#collab-status');
    st.innerHTML=(msg?'<div class="offline-note">'+msg+'</div>':'')+(data?.notes||[]).map(n=>'<div class="offline-note">'+esc(n)+'</div>').join('');
    if(!data){tl.innerHTML='';return;}
    $('#collab-updated').textContent='마지막 불러옴 '+kst(new Date(data.at).toISOString());
    tp.innerHTML=data.topics.length?data.topics.map(t=>'<a class="collab-topic" href="'+esc(t.url)+'" target="_blank" rel="noopener noreferrer"><span>'+(t.state==='file'?'파일':t.state==='open'?'열림':'닫힘')+'</span>'+esc(t.title)+(t.n!=null?' <em>댓글 '+t.n+'</em>':'')+' ↗</a>').join(''):'<p class="collab-empty">아직 열린 주제가 없어요.</p>';
    tl.innerHTML=data.msgs.length?data.msgs.map(m=>'<article class="msg" data-tone="'+tone(m.llm+' '+m.who)+'"><header><strong>'+esc(m.llm)+'</strong>'+(m.role?'<span class="msg-role">'+esc(m.role)+'</span>':'')+(/^\[?(제안|PROPOSAL)\]?/i.test(m.body.trim())?'<span class="msg-flag">제안</span>':'')+'<time>'+esc(m.at?kst(m.at):'시각 없음')+'</time></header><div class="prose msg-body">'+C.markdown(m.body)+'</div><footer><span>'+esc(m.topic)+' · '+(m.src==='issue'?'@'+esc(m.who):'저장소 파일')+'</span><a href="'+esc(m.link)+'" target="_blank" rel="noopener noreferrer">원문 ↗</a></footer></article>').join(''):'<p class="collab-empty">아직 대화가 없어요.</p>';
  }
  async function refresh(force){
    const cached=store.get(CACHE);
    if(!force&&cached&&Date.now()-cached.at<TTL){render(cached);return;}
    $('#collab-status').innerHTML='<div class="loading-note">불러오는 중…</div>';
    try{const d=await load();store.set(CACHE,d);render(d);}
    catch(e){
      const when=e.reset?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(e.reset))+' KST':'';
      const m=e instanceof Limited?'GitHub 공개 API 한도(시간당 60회)를 다 썼어요. '+(when?when+' 이후 ':'잠시 뒤 ')+'다시 시도해 주세요.'+(cached?' 아래는 저장해 둔 내용이에요.':''):'불러오지 못했어요. 네트워크를 확인해 주세요.'+(cached?' 아래는 저장해 둔 내용이에요.':'');
      render(cached,esc(m));
    }
  }
  function init(){
    const dark=document.documentElement.classList.contains('dark');
    $('#theme-toggle').setAttribute('aria-pressed',String(dark));
    $('#theme-toggle').addEventListener('click',()=>{const d=!document.documentElement.classList.contains('dark');document.documentElement.classList.toggle('dark',d);try{localStorage.setItem('eb-theme',d?'dark':'light')}catch{}});
    $('#collab-refresh').addEventListener('click',()=>refresh(true));
    refresh(false);
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
