/* collab-core.js — LLM 협의실 공용 코어 (daily-briefings · study 공통).
 * 원본(source of truth): bwkim1025/daily-briefings/assets/collab-core.js
 * 다른 저장소에는 바이트 단위로 같은 파일을 복사한다. 확인: scripts/check-collab-sync.sh
 * 담당: 데이터 로드(llm-collab 라벨 이슈 + collab/threads/*.md + index.json 대체 목록),
 *       머리말 파싱, 오너/LLM 톤 판별, 캐시, API 한도 처리, KST 표기.
 * 렌더링(Markdown, 화면 마크업)은 각 앱의 collab.js가 맡는다. 인증·비밀값 없음.
 * 설정: window.COLLAB_CONFIG = {repo:'owner/name', label:'llm-collab', cacheKey:'...', ownerLogin:'bwkim1025', ttl:300000}
 */
(function(){
  'use strict';
  const cfg=Object.assign({label:'llm-collab',ownerLogin:'bwkim1025',ttl:5*60*1000,branch:'main'},window.COLLAB_CONFIG||{});
  if(!cfg.repo)throw Error('COLLAB_CONFIG.repo 필요');
  if(!cfg.cacheKey)cfg.cacheKey=cfg.repo.split('/')[1]+'-collab-v2';
  const API='https://api.github.com/repos/'+cfg.repo, RAW='https://raw.githubusercontent.com/'+cfg.repo+'/'+cfg.branch+'/';
  const BLOB='https://github.com/'+cfg.repo+'/blob/'+cfg.branch+'/collab/threads/';
  const store={get(k){try{return JSON.parse(localStorage.getItem(k)||'null')}catch(_){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}}};
  const fmt=(o)=>new Intl.DateTimeFormat('ko-KR',Object.assign({timeZone:'Asia/Seoul',hour12:false},o));
  function kst(iso){const d=new Date(iso);if(isNaN(d))return '';return fmt({year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(d)+' KST';}
  function kstTime(ms){return fmt({hour:'2-digit',minute:'2-digit'}).format(new Date(ms))+' KST';}
  class Limited extends Error{constructor(reset){super('rate');this.reset=reset;}}
  async function get(url,json){
    if(json===undefined)json=true;
    const r=await fetch(url,{headers:json?{Accept:'application/vnd.github+json'}:{},cache:'no-cache'});
    if((r.status===403||r.status===429)&&r.headers.get('x-ratelimit-remaining')==='0')throw new Limited(Number(r.headers.get('x-ratelimit-reset'))*1000);
    if(!r.ok)throw Error(String(r.status));
    return json?r.json():r.text();
  }
  const HEAD=/^\s*(?:#+\s*)?\**\s*\[([^\]·|]+)[·|]\s*([^\]]+)\]\**\s*(.*)$/;
  // 첫 줄의 [이름 · 역할] 머리말. 없으면 GitHub 계정명을 이름으로 쓴다(hasHeader=false).
  function header(body,fallback){
    const lines=String(body||'').replace(/\r/g,'').split('\n');
    const m=(lines[0]||'').match(HEAD);
    if(m)return{llm:m[1].trim(),role:m[2].trim(),hasHeader:true,body:((m[3]?m[3]+'\n':'')+lines.slice(1).join('\n')).trim()};
    return{llm:fallback||'',role:'',hasHeader:false,body:lines.join('\n').trim()};
  }
  // 공통 규칙: 오너를 먼저 본다. 이름·역할이 병우/오너/owner 이거나, 머리말 없이 오너 계정으로 쓴 글이면 owner.
  const OWNER=/병우|오너|owner/i;
  function tone(m){
    const name=(m.llm||'')+' '+(m.role||'');
    if(OWNER.test(name))return 'owner';
    if(!m.hasHeader&&m.who&&m.who.toLowerCase()===String(cfg.ownerLogin).toLowerCase())return 'owner';
    const n=(m.llm||'').toLowerCase();
    return /grok/.test(n)?'grok':/chatgpt|gpt|codex|openai/.test(n)?'gpt':/claude|anthropic/.test(n)?'claude':/gemini/.test(n)?'gemini':'other';
  }
  // [제안] 배지는 본문이 [제안]으로 시작할 때만.
  const isProposal=b=>/^\[제안\]/.test(String(b||'').trim());
  function parseThread(md,file){
    // "### [이름 · 역할] · YYYY-MM-DD HH:MM KST" 로 시작하는 블록 하나가 메시지 하나.
    const out=[];let title=file;const t=md.match(/^#\s+(.+)$/m);if(t)title=t[1].trim();
    const parts=md.replace(/\r/g,'').split(/^(?=###\s+\[)/m).slice(1);
    for(const p of parts){
      const m=p.split('\n')[0].match(/^###\s+\[([^\]·|]+)[·|]\s*([^\]]+)\]\s*(?:·\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}))?/);
      if(!m)continue;
      out.push({src:'file',topic:title,link:BLOB+encodeURIComponent(file),llm:m[1].trim(),role:m[2].trim(),hasHeader:true,who:'',at:m[3]?m[3]+'T'+m[4]+':00+09:00':'',body:p.split('\n').slice(1).join('\n').replace(/\n-{3,}\s*$/,'').trim()});
    }
    return {title,msgs:out};
  }
  async function load(){
    const msgs=[],topics=[],notes=[];
    try{
      const issues=await get(API+'/issues?labels='+encodeURIComponent(cfg.label)+'&state=all&per_page=30');
      for(const is of issues.filter(i=>!i.pull_request)){
        topics.push({title:is.title,url:is.html_url,state:is.state,n:is.comments});
        msgs.push(Object.assign({src:'issue',topic:is.title,link:is.html_url,who:is.user.login,at:is.created_at},header(is.body,is.user.login)));
        if(is.comments){const cs=await get(is.comments_url+'?per_page=100');for(const c of cs)msgs.push(Object.assign({src:'issue',topic:is.title,link:c.html_url,who:c.user.login,at:c.created_at},header(c.body,c.user.login)));}
      }
    }catch(e){if(e instanceof Limited)throw e;notes.push('GitHub 이슈를 읽지 못했어요 ('+e.message+').');}
    try{
      let files=[];
      try{files=(await get(API+'/contents/collab/threads')).filter(f=>/\.md$/.test(f.name)).map(f=>f.name);}
      catch(e){if(e instanceof Limited)throw e;files=(await get(RAW+'collab/threads/index.json?'+Date.now())).files||[];}
      for(const f of files){try{const md=await get(RAW+'collab/threads/'+encodeURIComponent(f),false);const r=parseThread(md,f);msgs.push(...r.msgs);topics.push({title:r.title,url:BLOB+encodeURIComponent(f),state:'file'});}catch(_){}}
    }catch(e){if(e instanceof Limited)throw e;notes.push('협의 파일 목록을 읽지 못했어요.');}
    msgs.sort((a,b)=>String(a.at).localeCompare(String(b.at)));
    msgs.forEach(m=>{m.tone=tone(m);m.proposal=isProposal(m.body);});
    return{msgs,topics,notes,at:Date.now()};
  }
  // render(data, noticeText) 를 받아 캐시·한도 처리를 한다. noticeText는 일반 텍스트(앱이 이스케이프).
  async function refresh(render,force,onLoading){
    const cached=store.get(cfg.cacheKey);
    if(!force&&cached&&Date.now()-cached.at<cfg.ttl){render(cached,'');return;}
    if(onLoading)onLoading();
    try{const d=await load();store.set(cfg.cacheKey,d);render(d,'');}
    catch(e){
      const tail=cached?' 아래는 저장해 둔 내용이에요.':'';
      const msg=e instanceof Limited?'GitHub 공개 API 한도(시간당 60회)를 다 썼어요. '+(e.reset?kstTime(e.reset)+' 이후 ':'잠시 뒤 ')+'다시 시도해 주세요.'+tail:'불러오지 못했어요. 네트워크를 확인해 주세요.'+tail;
      render(cached,msg);
    }
  }
  const topicState=s=>s==='file'?'파일':s==='open'?'열림':'닫힘';
  window.CollabCore={config:cfg,kst,header,parseThread,tone,isProposal,load,refresh,topicState,Limited};
})();
