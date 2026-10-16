/* ContentVisuals v1 (+paper-glance). Fixed, dependency-free SVG templates; data is never executable. */
(function (scope) {
  'use strict';
  const MAX_BYTES = 12000, MAX_NUMBER = 1e9;
  const TYPES = ['research-design', 'event-bars', 'effect-ci', 'comparison-bars', 'paper-glance'];
  const DESIGNS = {'rct':'무작위 대조시험','cluster-rct':'군집 무작위시험','crossover-rct':'교차 무작위시험','nonrandomized-trial':'비무작위 중재연구','single-arm':'단일군 연구','cohort':'코호트 연구','case-control':'환자-대조군 연구','cross-sectional':'단면 연구','meta-analysis':'메타분석','systematic-review':'체계적 문헌고찰','diagnostic':'진단·예측 정확도','mendelian-randomization':'멘델 무작위분석','target-trial':'표적시험 모사','registry':'레지스트리 분석','modeling':'모델링 연구','qualitative':'질적 연구','narrative-review':'서술 리뷰·토론','other':'기타 설계'};
  const TRIALS = ['rct','cluster-rct','crossover-rct','nonrandomized-trial','single-arm'];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const bytes = text => { let n=0; for(const c of text) { const p=c.codePointAt(0); n+=p<128?1:p<2048?2:p<65536?3:4; } return n; };
  const plain = o => o !== null && typeof o === 'object' && !Array.isArray(o);
  const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
  const dateOK = d => typeof d==='string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d+'T00:00:00Z')) && new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
  function urlOK(value) { try { const u=new URL(value); return typeof value==='string' && value.length<=2000 && !/[\u0000-\u0020\u007f]/.test(value) && /^https?:$/.test(u.protocol) && !u.username && !u.password; } catch { return false; } }
  function validate(data) {
    const errors=[];
    const fail=(p,s)=>errors.push(p+': '+s);
    const keys=(o,allowed,p)=>{if(!plain(o)){fail(p,'object required');return false;}for(const k of Object.keys(o))if(!allowed.includes(k))fail(p+'.'+k,'unknown field');return true;};
    const str=(v,p,max=160)=>{if(typeof v!=='string'||!v.trim()||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v))fail(p,'nonempty bounded text required');};
    const num=(v,p,min=-MAX_NUMBER,max=MAX_NUMBER)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)fail(p,'finite number in range required');};
    const integer=(v,p,min=1)=>{num(v,p,min);if(!Number.isInteger(v))fail(p,'integer required');};
    if(!plain(data))return {ok:false,errors:['visual: object required']};
    // Fail closed on unknown types and keys, including __proto__/constructor payloads.
    const extra={
      'research-design':['population','allocation','arms','followUp','outcome'],
      'event-bars':['measure','timeframe','unit','rows'],
      'comparison-bars':['measure','timeframe','unit','rows'],
      'effect-ci':['metric','measure','comparison','basis','unit','estimate','interval','pValue','lowerLabel','upperLabel'],
      'paper-glance':['design','setting','population','exposure','comparator','outcome','followUp','effects','conclusion','caveats']
    };
    keys(data,['version','type','title','description','topic','source',...(typeof data.type==='string'&&own(extra,data.type)?extra[data.type]:[])],'visual');
    if(data.version!==1)fail('version','must be 1');
    if(!TYPES.includes(data.type))fail('type','unsupported visual type');
    str(data.title,'title');str(data.description,'description',600);str(data.topic,'topic',100);
    if(keys(data.source,['label','url','asOf','locator'],'source')) {
      str(data.source.label,'source.label',160);str(data.source.locator,'source.locator',240);
      if(!urlOK(data.source.url))fail('source.url','HTTP(S) source URL without credentials required');
      if(!dateOK(data.source.asOf))fail('source.asOf','real YYYY-MM-DD date required');
    }
    if(data.type==='research-design') {
      const node=(o,p)=>{if(keys(o,['label','n','detail'],p)){str(o.label,p+'.label',100);str(o.detail,p+'.detail',240);if(own(o,'n'))integer(o.n,p+'.n');}};
      node(data.population,'population');str(data.allocation,'allocation',180);str(data.followUp,'followUp',180);str(data.outcome,'outcome',240);
      if(!Array.isArray(data.arms)||data.arms.length<2||data.arms.length>4)fail('arms','2–4 groups required');
      else {data.arms.forEach((r,i)=>node(r,'arms['+i+']'));if(plain(data.population)&&Number.isInteger(data.population.n)&&data.arms.every(r=>plain(r)&&Number.isInteger(r.n))&&data.arms.reduce((s,r)=>s+r.n,0)!==data.population.n)fail('arms','group counts must equal supplied population count');}
    }
    if(data.type==='event-bars'||data.type==='comparison-bars') {
      str(data.measure,'measure',180);str(data.timeframe,'timeframe',160);str(data.unit,'unit',40);
      const events=data.type==='event-bars';
      if(events&&data.unit!=='%')fail('unit','event-bars must use %');
      if(!Array.isArray(data.rows)||data.rows.length<2||data.rows.length>6)fail('rows','2–6 rows required');
      else data.rows.forEach((r,i)=>{const p='rows['+i+']';if(!keys(r,events?['label','value','events','denominator']:['label','value'],p))return;str(r.label,p+'.label',100);num(r.value,p+'.value',events?0:-MAX_NUMBER,events?100:MAX_NUMBER);if(events){integer(r.events,p+'.events',0);integer(r.denominator,p+'.denominator');if(r.events>r.denominator)fail(p,'events exceed denominator');if(Number.isFinite(r.value)&&Number.isInteger(r.events)&&Number.isInteger(r.denominator)&&r.denominator>0){const decimals=(String(r.value).split('.')[1]||'').length;const tolerance=0.5*Math.pow(10,-decimals)+1e-8;if(Math.abs(100*r.events/r.denominator-r.value)>tolerance)fail(p+'.value','reported percentage inconsistent with counts at its precision');}}});
    }
    if(data.type==='effect-ci') {
      if(!['difference','ratio'].includes(data.metric))fail('metric','difference or ratio required');
      if(!['adjusted','unadjusted'].includes(data.basis))fail('basis','adjusted or unadjusted required');
      str(data.measure,'measure',180);str(data.comparison,'comparison',180);str(data.unit,'unit',40);
      if(data.metric==='ratio'&&data.unit!=='ratio')fail('unit','ratio effect must use ratio');
      if(data.metric==='difference'&&['ratio','%'].includes(data.unit))fail('unit','difference needs absolute units, e.g. %p, not % or ratio');
      num(data.estimate,'estimate',data.metric==='ratio'?Number.MIN_VALUE:-MAX_NUMBER);
      if(keys(data.interval,['low','high','level'],'interval')) {
        num(data.interval.low,'interval.low',data.metric==='ratio'?Number.MIN_VALUE:-MAX_NUMBER);
        num(data.interval.high,'interval.high',data.metric==='ratio'?Number.MIN_VALUE:-MAX_NUMBER);
        num(data.interval.level,'interval.level',0.01,99.99);
        if(data.interval.low>data.interval.high)fail('interval','low must not exceed high');
        if(data.estimate<data.interval.low||data.estimate>data.interval.high)fail('estimate','must be within supplied interval');
      }
      if(own(data,'pValue'))num(data.pValue,'pValue',0,1);
      if(own(data,'lowerLabel'))str(data.lowerLabel,'lowerLabel',120);
      if(own(data,'upperLabel'))str(data.upperLabel,'upperLabel',120);
      if(own(data,'lowerLabel')!==own(data,'upperLabel'))fail('direction','supply both source-backed direction labels or neither');
    }
    if(data.type==='paper-glance') {
      if(keys(data.design,['kind','label','registration'],'design')){if(!own(DESIGNS,data.design.kind))fail('design.kind','supported design kind required');str(data.design.label,'design.label',80);if(own(data.design,'registration'))str(data.design.registration,'design.registration',60);}
      if(own(data,'setting'))str(data.setting,'setting',200);
      const group=(o,p)=>{if(keys(o,['label','detail','n'],p)){str(o.label,p+'.label',160);if(own(o,'detail'))str(o.detail,p+'.detail',240);if(own(o,'n'))integer(o.n,p+'.n');}};
      group(data.population,'population');group(data.exposure,'exposure');if(own(data,'comparator'))group(data.comparator,'comparator');
      for(const k of ['exposure','comparator'])if(plain(data[k])&&plain(data.population)&&Number.isInteger(data[k].n)&&Number.isInteger(data.population.n)&&data[k].n>data.population.n)fail(k+'.n','group count cannot exceed population count');
      str(data.outcome,'outcome',240);if(own(data,'followUp'))str(data.followUp,'followUp',160);str(data.conclusion,'conclusion',320);
      if(own(data,'caveats')){if(!Array.isArray(data.caveats)||data.caveats.length>3)fail('caveats','0–3 items');else data.caveats.forEach((c,i)=>str(c,'caveats['+i+']',140));}
      if(!Array.isArray(data.effects)||data.effects.length>6||(data.effects.length<1&&!['narrative-review','qualitative','systematic-review'].includes(data.design&&data.design.kind)))fail('effects','1–6 rows required (0 allowed only for narrative-review, qualitative, systematic-review)');
      else data.effects.forEach((e,i)=>{const p='effects['+i+']';if(!keys(e,['label','kind','measure','estimate','interval','unit','basis','primary','note'],p))return;
        str(e.label,p+'.label',100);str(e.measure,p+'.measure',24);if(!['ratio','difference','value'].includes(e.kind))fail(p+'.kind','ratio, difference or value required');
        const pos=e.kind==='ratio'?Number.MIN_VALUE:-MAX_NUMBER;num(e.estimate,p+'.estimate',pos);
        if(own(e,'unit'))str(e.unit,p+'.unit',24);if(e.kind==='difference'&&(!own(e,'unit')||['%','ratio'].includes(e.unit)))fail(p+'.unit','difference needs absolute unit such as %p');
        if(e.kind==='ratio'&&own(e,'unit'))fail(p+'.unit','ratio rows take no unit');
        if(own(e,'basis')&&!['adjusted','unadjusted'].includes(e.basis))fail(p+'.basis','adjusted or unadjusted');
        if(own(e,'primary')&&typeof e.primary!=='boolean')fail(p+'.primary','boolean');if(own(e,'note'))str(e.note,p+'.note',100);
        if(own(e,'interval')&&keys(e.interval,['low','high','level'],p+'.interval')){num(e.interval.low,p+'.interval.low',pos);num(e.interval.high,p+'.interval.high',pos);num(e.interval.level,p+'.interval.level',0.01,99.99);if(e.interval.low>e.interval.high)fail(p+'.interval','low must not exceed high');if(e.estimate<e.interval.low||e.estimate>e.interval.high)fail(p+'.estimate','must be within interval');}
      });
    }
    return {ok:errors.length===0,errors};
  }
  const fmt=n=>String(Object.is(n,-0)?0:n).replace('-', '−');
  const signed=n=>n>0?'+'+fmt(n):fmt(n);
  const coord=n=>Number(n.toFixed(4));
  const line=(x,y1,y2,cls='cv-grid')=>'<line class="'+cls+'" x1="'+coord(x)+'" x2="'+coord(x)+'" y1="'+y1+'" y2="'+y2+'" vector-effect="non-scaling-stroke"/>';
  const svg=(body,label,view='0 0 600 32')=>'<svg class="cv-plot" viewBox="'+view+'" preserveAspectRatio="none" role="img" aria-label="'+esc(label)+'" xmlns="http://www.w3.org/2000/svg">'+body+'</svg>';
  const axis=(min,max,zero)=>'<div class="cv-axis" aria-hidden="true"><span>'+esc(fmt(min))+'</span>'+(zero>10&&zero<90?'<span class="cv-axis-zero" style="left:'+coord(zero)+'%">0</span>':'')+'<span>'+esc(fmt(max))+'</span></div>';
  function design(d) {
    const node=(r,cls)=>'<div class="cv-node '+cls+'"><strong>'+esc(r.label)+'</strong>'+(own(r,'n')?'<span class="cv-count">n = '+fmt(r.n)+'</span>':'')+'<p>'+esc(r.detail)+'</p></div>';
    const n=d.arms.length, mid=i=>600*(i+0.5)/n;
    const connectors='<path d="M300 0 V12 H'+coord(mid(0))+' M300 12 H'+coord(mid(n-1))+' '+d.arms.map((_,i)=>'M'+coord(mid(i))+' 12 V28').join(' ')+'"/>';
    return '<div class="cv-design">'+node(d.population,'cv-population')+'<p class="cv-allocation">'+esc(d.allocation)+'</p><svg class="cv-connectors" viewBox="0 0 600 30" preserveAspectRatio="none" aria-hidden="true">'+connectors+'</svg><div class="cv-arms cv-arms-'+n+'">'+d.arms.map(r=>node(r,'cv-arm')).join('')+'</div><div class="cv-follow"><span>'+esc(d.followUp)+'</span><strong>'+esc(d.outcome)+'</strong></div></div>';
  }
  function bars(d) {
    const events=d.type==='event-bars', values=d.rows.map(r=>r.value);
    let min=events?0:Math.min(0,...values), max=events?100:Math.max(0,...values);
    if(min===max){min=0;max=1;} // Explicit all-zero data, with a stable non-degenerate zero baseline.
    const x=v=>600*(v-min)/(max-min), zero=x(0), summary=events?'관찰 사건 비율 · '+d.timeframe:'보고된 값 · '+d.timeframe;
    const unit=events?'%':d.unit;
    const rows=d.rows.map((r,i)=>{
      const from=Math.min(zero,x(r.value)),width=Math.abs(x(r.value)-zero);
      let grid='';for(let tick=0;tick<=4;tick++)grid+=line(150*tick,0,32);
      const label=r.label+': '+fmt(r.value)+' '+unit+(events?' ('+r.events+'/'+r.denominator+')':'');
      return '<div class="cv-bar-row"><div class="cv-data-line"><strong>'+esc(r.label)+'</strong><span><b>'+esc(fmt(r.value))+'</b> '+esc(unit)+(events?'<small>'+r.events+' / '+r.denominator+'명</small>':'')+'</span></div>'+svg(grid+'<rect class="cv-bar cv-tone-'+(i%2)+'" x="'+coord(from)+'" y="5" width="'+coord(width)+'" height="22" rx="2"/>'+line(zero,0,32,'cv-zero'),label)+'</div>';
    }).join('');
    return '<p class="cv-measure">'+esc(d.measure)+'<span>'+esc(summary)+'</span></p><div class="cv-bars">'+rows+axis(min,max,zero/6)+'</div><p class="cv-stat-note">'+(events?'막대는 관찰 비율입니다. 분모는 각 결과의 분석 대상이며, 보정 효과값과 다를 수 있습니다.':'공통 축 · 단위: '+esc(unit)+' · 기준선 0')+'</p>';
  }
  function effect(d) {
    const ratio=d.metric==='ratio', reference=ratio?1:0, trans=ratio?Math.log:v=>v;
    let low=Math.min(trans(d.interval.low),trans(reference)),high=Math.max(trans(d.interval.high),trans(reference));
    const span=high-low||1, padding=span*0.12;low-=padding;high+=padding;
    const x=v=>20+560*(trans(v)-low)/(high-low), ref=x(reference), a=x(d.interval.low), b=x(d.interval.high), point=x(d.estimate);
    const value=ratio?fmt:signed, unit=ratio?'':d.unit;
    const basis=d.basis==='adjusted'?'보정':'비보정';
    const label=basis+' '+d.measure+': '+value(d.estimate)+' '+unit+', '+d.interval.level+'% CI '+value(d.interval.low)+' ~ '+value(d.interval.high)+', 기준값 '+reference;
    const plot=line(ref,4,62,'cv-null')+'<line class="cv-interval" x1="'+coord(a)+'" x2="'+coord(b)+'" y1="33" y2="33" vector-effect="non-scaling-stroke"/>'+line(a,24,42,'cv-cap')+line(b,24,42,'cv-cap')+'<circle class="cv-point" cx="'+coord(point)+'" cy="33" r="6" vector-effect="non-scaling-stroke"/>';
    const ticks=[{v:d.interval.low,x:a},{v:reference,x:ref},{v:d.interval.high,x:b}].sort((a,b)=>a.x-b.x).filter((t,i,arr)=>!i||Math.abs(t.x-arr[i-1].x)>42);
    return '<p class="cv-measure">'+esc(basis+' '+d.measure)+'<span>'+esc(d.comparison)+'</span></p><div class="cv-effect-value">'+esc(value(d.estimate))+' <span>'+esc(unit)+'</span></div><p class="cv-ci-detail">'+d.interval.level+'% CI '+esc(value(d.interval.low))+' ~ '+esc(value(d.interval.high))+' '+esc(unit)+(own(d,'pValue')?' · P = '+fmt(d.pValue):'')+'</p><div class="cv-effect-plot">'+svg(plot,label,'0 0 600 66')+'<div class="cv-effect-ticks" aria-hidden="true">'+ticks.map(t=>'<span style="left:'+coord(t.x/6)+'%">'+esc(value(t.v))+'</span>').join('')+'</div></div>'+(own(d,'lowerLabel')?'<div class="cv-directions"><span>← '+esc(d.lowerLabel)+'</span><span>'+esc(d.upperLabel)+' →</span></div>':'')+'<p class="cv-stat-note">기준값 '+reference+' ('+(ratio?'비율 1, 로그 축':'차이 없음')+'). 신뢰구간이 기준값을 포함해도 동등성을 입증한 것은 아닙니다.</p>';
  }
  function glance(d) {
    const trial=TRIALS.includes(d.design.kind), tone=trial?'trial':['meta-analysis','systematic-review','narrative-review'].includes(d.design.kind)?'review':'obs';
    const chip=t=>'<span class="cv-pg-chip">'+esc(t)+'</span>';
    const n=r=>own(r,'n')?'<span class="cv-pg-n">n = '+esc(Number(r.n).toLocaleString('en-US'))+'</span>':'';
    const cell=(letter,name,r)=>'<div class="cv-pg-cell"><dt><b>'+letter+'</b>'+esc(name)+'</dt><dd><strong>'+esc(r.label)+'</strong>'+n(r)+(own(r,'detail')?'<span>'+esc(r.detail)+'</span>':'')+'</dd></div>';
    const iName=d.design.kind==='diagnostic'?'검사·지표':trial?'중재':'노출·요인';
    let html='<div class="cv-pg cv-pg-'+tone+'"><div class="cv-pg-tags"><span class="cv-pg-badge">'+esc(DESIGNS[d.design.kind])+'</span>'+chip(d.design.label)+(own(d.population,'n')?chip('n = '+Number(d.population.n).toLocaleString('en-US')):'')+(own(d,'followUp')?chip('추적 '+d.followUp):'')+(own(d.design,'registration')?chip(d.design.registration):'')+'</div>';
    if(own(d,'setting'))html+='<p class="cv-pg-setting">'+esc(d.setting)+'</p>';
    html+='<dl class="cv-pg-pico">'+cell('P','대상',d.population)+cell(d.design.kind==='diagnostic'?'I':trial?'I':'E',iName,d.exposure)+(own(d,'comparator')?cell('C','비교',d.comparator):'')+'<div class="cv-pg-cell"><dt><b>O</b>결과</dt><dd><strong>'+esc(d.outcome)+'</strong></dd></div></dl>';
    // Shared log axis for all ratio rows; shared linear axis per difference unit. Value rows are printed without a plot.
    const doms={};const add=(key,vals)=>{const v=vals.filter(Number.isFinite);doms[key]=doms[key]?[Math.min(doms[key][0],...v),Math.max(doms[key][1],...v)]:[Math.min(...v),Math.max(...v)];};
    d.effects.forEach(e=>{if(e.kind==='value')return;const ratio=e.kind==='ratio',t=ratio?Math.log:v=>v,key=ratio?'ratio':'diff:'+e.unit;add(key,[t(e.estimate),t(ratio?1:0)].concat(e.interval?[t(e.interval.low),t(e.interval.high)]:[]));});
    const dec=v=>(String(v).split('.')[1]||'').length;
    // Print estimate and CI at the same precision (1.3 with CI 1.04–1.63 is shown as 1.30).
    const val=(e,v)=>{const dp=Math.min(4,Math.max(dec(e.estimate),...(e.interval?[dec(e.interval.low),dec(e.interval.high)]:[])));const t=Number(v).toFixed(dp),n=Number(t);return (e.kind==='difference'&&n>0?'+':'')+String(Object.is(n,-0)||n===0?t.replace('-',''):t).replace('-','−');};
    const rows=d.effects.map(e=>{
      const ci=e.interval?' ('+e.interval.level+'% CI '+val(e,e.interval.low)+' ~ '+val(e,e.interval.high)+')':'';
      const unit=own(e,'unit')?' '+e.unit:'';
      const txt=e.measure+' '+val(e,e.estimate)+unit+ci;
      let plot='';
      if(e.kind!=='value'){
        const ratio=e.kind==='ratio',t=ratio?Math.log:v=>v,key=ratio?'ratio':'diff:'+e.unit;let [lo,hi]=doms[key];const pad=(hi-lo||1)*0.1;lo-=pad;hi+=pad;
        const x=v=>10+580*(t(v)-lo)/(hi-lo),ref=x(ratio?1:0),pt=x(e.estimate);
        let body=line(ref,2,26,'cv-null');
        if(e.interval){const a=x(e.interval.low),b=x(e.interval.high);body+='<line class="cv-interval" x1="'+coord(a)+'" x2="'+coord(b)+'" y1="14" y2="14" vector-effect="non-scaling-stroke"/>'+line(a,8,20,'cv-cap')+line(b,8,20,'cv-cap');}
        // Zero-length round-capped strokes stay circular even though the plot stretches horizontally.
        const dot=(cls,w)=>'<line class="'+cls+'" x1="'+coord(pt)+'" x2="'+coord(pt)+'" y1="14" y2="14" stroke-width="'+w+'" stroke-linecap="round" vector-effect="non-scaling-stroke"/>';
        body+=dot('cv-pg-dot',11)+(e.interval?'':dot('cv-pg-dot-hole',6));
        plot=svg(body,e.label+': '+txt+(ratio?' · 기준값 1':' · 기준값 0'),'0 0 600 28');
      }
      const tags=(e.primary?'<em class="cv-pg-primary">1차</em>':'')+(own(e,'basis')?'<em>'+(e.basis==='adjusted'?'보정':'비보정')+'</em>':'')+(e.kind!=='value'&&!e.interval?'<em>CI 미보고</em>':'');
      return '<div class="cv-pg-effect"><div class="cv-pg-eline"><span class="cv-pg-elabel">'+esc(e.label)+tags+'</span><b>'+esc(txt)+'</b></div>'+plot+(own(e,'note')?'<p class="cv-pg-note">'+esc(e.note)+'</p>':'')+'</div>';
    }).join('');
    const hasRatio=d.effects.some(e=>e.kind==='ratio'),hasDiff=d.effects.some(e=>e.kind==='difference');
    html+='<div class="cv-pg-effects"><p class="cv-pg-h">핵심 수치</p>'+(d.effects.length?rows:'<p class="cv-pg-note">원문 초록에 정량 효과 수치가 제시되지 않았습니다.</p>')+((hasRatio||hasDiff)?'<p class="cv-stat-note">점선 = 기준값('+(hasRatio?'비율 1, 같은 로그 축':'')+(hasRatio&&hasDiff?' · ':'')+(hasDiff?'차이 0, 단위별 같은 축':'')+'). 속이 빈 점은 신뢰구간이 보고되지 않은 값입니다.</p>':'')+'</div>';
    html+='<div class="cv-pg-bottom"><p class="cv-pg-h">저자 결론</p><p>'+esc(d.conclusion)+'</p></div>';
    if(own(d,'caveats')&&d.caveats.length)html+='<ul class="cv-pg-caveats">'+d.caveats.map(c=>'<li>'+esc(c)+'</li>').join('')+'</ul>';
    return html+'</div>';
  }
  function fallback(raw,message='시각자료 형식을 확인할 수 없어 원문 데이터로 표시합니다.') {
    const text=typeof raw==='string'?raw:'';return '<aside class="cv-fallback"><p>'+esc(message)+'</p><pre><code>'+esc(text.slice(0,MAX_BYTES))+(text.length>MAX_BYTES?'\n… (표시 한도 초과)':'')+'</code></pre></aside>';
  }
  function renderJSON(raw) {
    if(typeof raw!=='string'||raw.length>MAX_BYTES||bytes(raw)>MAX_BYTES)return fallback(raw,'시각자료가 크기 한도를 넘어 원문 데이터로 표시합니다.');
    let d;try{d=JSON.parse(raw);}catch{return fallback(raw);}
    const checked=validate(d);if(!checked.ok)return fallback(raw);
    const body=d.type==='research-design'?design(d):d.type==='effect-ci'?effect(d):d.type==='paper-glance'?glance(d):bars(d);
    const source='<a href="'+esc(d.source.url)+'" target="_blank" rel="noopener noreferrer">'+esc(d.source.label)+' ↗</a>';
    return '<figure class="content-visual" data-visual-type="'+d.type+'"><figcaption><strong>'+esc(d.title)+'</strong><p>'+esc(d.description)+'</p></figcaption>'+body+'<footer class="cv-source">출처 '+source+' · '+esc(d.source.locator)+'<br>확인 기준 '+esc(d.source.asOf)+' · 원문 집계값·라벨의 학습용 재구성</footer></figure>';
  }
  const api=Object.freeze({version:1,MAX_BYTES,TYPES:Object.freeze(TYPES),validate,renderJSON,fallback});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else scope.ContentVisuals=api;
})(typeof window!=='undefined'?window:globalThis);
