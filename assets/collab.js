/* Daily Briefings · LLM 협의실 화면. 데이터·판별 로직은 assets/collab-core.js(공용), 여기서는 렌더링만. */
(function(){
  'use strict';
  const C=window.BriefingCore, K=window.CollabCore, $=s=>document.querySelector(s), esc=C.esc;
  function render(data,msg){
    const tl=$('#timeline'),tp=$('#topics'),st=$('#collab-status');
    st.innerHTML=(msg?'<div class="offline-note">'+esc(msg)+'</div>':'')+((data&&data.notes)||[]).map(n=>'<div class="offline-note">'+esc(n)+'</div>').join('');
    if(!data){tl.innerHTML='';return;}
    $('#collab-updated').textContent='마지막 불러옴 '+K.kst(new Date(data.at).toISOString());
    tp.innerHTML=data.topics.length?data.topics.map(t=>'<a class="collab-topic" href="'+esc(t.url)+'" target="_blank" rel="noopener noreferrer"><span>'+K.topicState(t.state)+'</span>'+esc(t.title)+(t.n!=null?' <em>댓글 '+t.n+'</em>':'')+' ↗</a>').join(''):'<p class="collab-empty">아직 열린 주제가 없어요.</p>';
    tl.innerHTML=data.msgs.length?data.msgs.map(m=>'<article class="msg" data-tone="'+(m.tone||K.tone(m))+'"><header><strong>'+esc(m.llm)+'</strong>'+(m.role?'<span class="msg-role">'+esc(m.role)+'</span>':'')+(K.isProposal(m.body)?'<span class="msg-flag">제안</span>':'')+'<time>'+esc(m.at?K.kst(m.at):'시각 없음')+'</time></header><div class="prose msg-body">'+C.markdown(m.body)+'</div><footer><span>'+esc(m.topic)+' · '+(m.src==='issue'?'@'+esc(m.who):'저장소 파일')+'</span><a href="'+esc(m.link)+'" target="_blank" rel="noopener noreferrer">원문 ↗</a></footer></article>').join(''):'<p class="collab-empty">아직 대화가 없어요.</p>';
  }
  const refresh=force=>K.refresh(render,force,()=>{$('#collab-status').innerHTML='<div class="loading-note">불러오는 중…</div>';});
  function init(){
    const dark=document.documentElement.classList.contains('dark');
    $('#theme-toggle').setAttribute('aria-pressed',String(dark));
    $('#theme-toggle').addEventListener('click',()=>{const d=!document.documentElement.classList.contains('dark');document.documentElement.classList.toggle('dark',d);$('#theme-toggle').setAttribute('aria-pressed',String(d));try{localStorage.setItem('eb-theme',d?'dark':'light')}catch(_){}});
    $('#collab-refresh').addEventListener('click',()=>refresh(true));
    refresh(false);
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
