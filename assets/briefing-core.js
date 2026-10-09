/* Dependency-free, safe Markdown subset shared by every briefing page. */
(function (scope) {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const safeUrl = value => { try { const u = new URL(value); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch { return ''; } };
  function inline(text) {
    // Tokenize before emitting HTML: URLs must never be auto-linked inside an existing link.
    const re = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\[(https?:\/\/[^\s\]]+)\]|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|(https?:\/\/[^\s<>]+)/g;
    let out = '', end = 0;
    for (const m of String(text).matchAll(re)) {
      out += esc(text.slice(end, m.index)); end = m.index + m[0].length;
      if (m[2]) { const safe=safeUrl(m[2]); out += safe ? '<a href="'+esc(safe)+'" target="_blank" rel="noopener noreferrer">'+esc(m[1] || '그림 원문')+' ↗</a>' : esc(m[0]); }
      else if (m[4] || m[5] || m[9]) {
        const raw = m[4] || m[5] || m[9];
        const url = raw.replace(/[.,;]+$/, ''); const suffix = raw.slice(url.length);
        const safe=safeUrl(url);
        if(!safe) { out += esc(m[0]); continue; }
        out += '<a href="'+esc(safe)+'" target="_blank" rel="noopener noreferrer">'+esc(m[3] || (m[5] ? new URL(safe).hostname : url))+'</a>'+esc(suffix);
      } else if (m[6]) out += '<code>'+esc(m[6])+'</code>';
      else if (m[7]) out += '<strong>'+esc(m[7])+'</strong>';
      else if (m[8]) out += '<em>'+esc(m[8])+'</em>';
    }
    return out + esc(text.slice(end));
  }
  const splitRow = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(s => s.trim().replace(/\\\|/g, '|'));
  function renderVisual(raw, closed) {
    const fallback=()=>'<aside class="cv-fallback"><p>시각자료 원문 데이터</p><pre><code>'+esc(raw.slice(0,12000))+'</code></pre></aside>';
    if(!closed)return fallback();
    try { const engine=typeof module!=='undefined'&&module.exports?require('./content-visuals.js'):scope.ContentVisuals; return engine&&typeof engine.renderJSON==='function'?engine.renderJSON(raw):fallback(); } catch { return fallback(); }
  }
  function markdown(text = '') {
    const lines = text.replace(/\r/g, '').split('\n'); let html = '', paragraph = [];
    const flush = () => { if (paragraph.length) html += '<p>'+inline(paragraph.join(' '))+'</p>'; paragraph=[]; };
    for (let i=0; i<lines.length; i++) {
      const line = lines[i]; let m;
      if (!line.trim()) { flush(); continue; }
      const fence=line.match(/^\s*```([\w-]*)\s*$/);
      if (fence || /^```/.test(line)) { flush(); const code=[]; const visual=fence&&fence[1]==='visual'; while (++i<lines.length && !(visual?/^\s*```\s*$/:/^```/).test(lines[i])) code.push(lines[i]); const raw=code.join('\n'); html += visual?renderVisual(raw,i<lines.length):'<pre><code>'+esc(raw)+'</code></pre>'; continue; }
      if ((m=line.match(/^(#{1,6})\s+(.+)/))) { flush(); const level=Math.max(3, m[1].length); html+='<h'+level+'>'+inline(m[2])+'</h'+level+'>'; continue; }
      if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) { flush(); html+='<hr>'; continue; }
      if (line.trim().startsWith('|') && i+1<lines.length && splitRow(lines[i+1]).every(c=>/^:?-{2,}:?$/.test(c))) {
        flush(); const headers=splitRow(line); const align=splitRow(lines[++i]); const rows=[];
        while (i+1<lines.length && lines[i+1].trim().startsWith('|')) rows.push(splitRow(lines[++i]));
        html+='<div class="table-scroll" role="region" aria-label="원문 데이터 표" tabindex="0"><table><thead><tr>'+headers.map(h=>'<th scope="col">'+inline(h)+'</th>').join('')+'</tr></thead><tbody>';
        html+=rows.map(r=>'<tr>'+headers.map((_,j)=>'<td'+(/:$/.test(align[j])?' class="numeric"':'')+'>'+inline(r[j]||'')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'; continue;
      }
      if ((m=line.match(/^\s*(?:[-*+]\s+|\d+[.)]\s+)(.+)/))) {
        flush(); const ordered=/^\s*\d/.test(line); const tag=ordered?'ol':'ul'; const items=[m[1]];
        const re=ordered?/^\s*\d+[.)]\s+(.+)/:/^\s*[-*+]\s+(.+)/;
        while(i+1<lines.length && re.test(lines[i+1])) items.push(lines[++i].match(re)[1]);
        html+='<'+tag+'>'+items.map(t=>'<li>'+inline(t)+'</li>').join('')+'</'+tag+'>'; continue;
      }
      if (/^>\s?/.test(line)) { flush(); const quotes=[line.replace(/^>\s?/,'')]; while (i+1<lines.length && /^>/.test(lines[i+1])) quotes.push(lines[++i].replace(/^>\s?/,'')); html+='<blockquote>'+markdown(quotes.join('\n'))+'</blockquote>'; continue; }
      paragraph.push(line.trim());
    }
    flush(); return html;
  }
  function parse(text) {
    const result={date:'', preamble:'', story:'', oneLiner:'', author:'', sections:[]};
    let tag='', buffer=[];
    const flush=()=>{
      const body=buffer.join('\n').trim(); buffer=[];
      if(!tag) { result.preamble += body; return; }
      if(tag==='TODAYS_STORY') result.story += body;
      else if(tag==='AUTHOR') result.author += body;
      else if(['ONE_LINER','MARKET','TAKEAWAY'].includes(tag)) result.oneLiner += body;
      else {
        const section={key:tag, intro:'', items:[]}; let current=null; let block=null; let visualFence=false;
        for(const line of body.split('\n')) {
          const inside=visualFence; if(/^\s*```visual\s*$/.test(line)&&!visualFence)visualFence=true;else if(/^\s*```\s*$/.test(line)&&visualFence)visualFence=false;
          const h3=!inside&&!visualFence&&line.match(/^###\s+(.+)/), h4=!inside&&!visualFence&&line.match(/^####\s+(.+)/);
          if(h3) { current={headline:h3[1],summary:'',blocks:[]};section.items.push(current);block=null; }
          else if(h4 && current) { block={title:h4[1],body:''};current.blocks.push(block); }
          else if(block) block.body+=line+'\n';
          else if(current) current.summary+=line+'\n';
          else section.intro+=line+'\n';
        }
        result.sections.push(section);
      }
    };
    let visualFence=false;
    for(const line of text.replace(/\r/g,'').split('\n')) {
      const inside=visualFence; if(/^\s*```visual\s*$/.test(line)&&!visualFence)visualFence=true;else if(/^\s*```\s*$/.test(line)&&visualFence)visualFence=false;
      const date=!inside&&!visualFence&&line.match(/^#\s+(\d{4}-\d{2}-\d{2})/), heading=!inside&&!visualFence&&line.match(/^##\s+(.+)/);
      if(date) { result.date=date[1]; continue; }
      if(heading) { flush(); tag=heading[1].trim().toUpperCase(); } else buffer.push(line);
    }
    flush(); return result;
  }
  function formatDate(date) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
    const d=new Date(date+'T12:00:00Z');
    return date.replace(/-/g,'.')+' · '+['일','월','화','수','목','금','토'][d.getUTCDay()]+'요일';
  }
  const kstDate = (offset=0) => new Date(Date.now()+9*3600000-offset*86400000).toISOString().slice(0,10);
  function lead(text) { const lines=text.split('\n'); const headline=lines.find(l=>/^### /.test(l)); const paragraph=lines.filter(l=>l.trim()&&!/^#|^---|^>/.test(l)).join(' ').split('####')[0]; return {headline:headline?headline.replace(/^### /,''):'', paragraph}; }
  function sourceCount(text) { return new Set([...text.matchAll(/https?:\/\/[^\s)\]>]+/g)].map(m=>{try{return new URL(m[0]).hostname.replace(/^www\./,'');}catch{return '';}}).filter(Boolean)).size; }
  const sectionLabels={MARKETS:'미국 · 한국 증시',FX:'환율 · 채권 · 원자재',EARNINGS:'기업 실적 · 빅테크',POLICY:'정책',US:'미국 · 워싱턴',CHINA:'중국 · 대만 · 미중',ASIA:'아시아',ME:'중동',EU:'유럽',PAPERS:'오늘의 논문',NEPHROLOGY:'신장 · 투석 · 이식',CARDIOLOGY:'심장 · 순환기',ENDOCRINOLOGY:'내분비 · 당뇨',RHEUMATOLOGY:'류마티스 · 자가면역',GASTROENTEROLOGY:'소화기 · 간',PULMONOLOGY:'호흡기',ALLERGY:'알러지 · 면역',GENERAL_MEDICINE:'일반 내과',FAMILY_MEDICINE:'가정의학과',OTHERS:'기타 분과',INSURANCE:'급여 · 약가',AI_HEALTH:'의료 AI · 디지털',GUIDELINES:'가이드라인',NUTRITION:'영양 · 식단',EXERCISE_SLEEP:'운동 · 수면',EXERCISE:'운동',MOVEMENT:'운동',SLEEP:'수면',PARENTING:'육아 · 임신',PREGNANCY:'임신',WELLNESS:'생활 건강',FAMILY:'가족 건강',RESEARCH:'최신 연구',HEALTH:'건강',LIFESTYLE:'생활 습관'};
  const categoryLabels={
    financial:{POLICY:'중앙은행 · 경제지표'},
    medical:{POLICY:'정책 · 보험/심사'},
    international:{ME:'중동 · 이란 · 이스라엘',EU:'유럽 · 우크라이나'}
  };
  function sectionLabel(category,key){return categoryLabels[category]?.[key]||sectionLabels[key]||key;}
  const api={esc,inline,markdown,parse,formatDate,kstDate,lead,sourceCount,sectionLabel};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  else scope.BriefingCore=api;
})(typeof window!=='undefined'?window:globalThis);
