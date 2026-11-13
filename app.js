/* =========================================================
   探奇 / Mind Gym — M1 无 AI 闭环
   纯前端 + localStorage，零后端、零 Key 也能跑完一周循环
   ========================================================= */
(function(){
'use strict';

const KEY = 'mindgym_v1';
let state = loadState();
let currentMode = 'passive';     // 捕捉时默认被动
let poolFilter = 'pending';
let pendingMedia = [];           // 拍摄/链接暂存
let defineState = { captureId:null, step:0, data:{} };
let recog = null;

/* ---------- 状态 ---------- */
function loadState(){
  try{
    const raw = localStorage.getItem(KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return {
    user:{ name:null, is_minor:null, guardian_verified:false, created_at:Date.now() },
    captures:[], problems:[], solutions:[], verifications:[]
  };
}
function saveState(){ try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch(e){} }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function nowISO(){ return new Date().toISOString(); }
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function timeAgo(iso){
  const d=new Date(iso).getTime(), diff=Date.now()-d, m=Math.floor(diff/60000);
  if(m<1) return '刚刚'; if(m<60) return m+' 分钟前';
  const h=Math.floor(m/60); if(h<24) return h+' 小时前';
  return Math.floor(h/24)+' 天前';
}
function statusText(t){ return {pending:'待分拣',push:'已推进',drop:'已放弃',archive:'已归档'}[t]||t; }

/* ---------- 导航 ---------- */
function go(id, btn){
  if(id.startsWith('s-')){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(btn){ document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('on')); btn.classList.add('on'); }
    if(id==='s-pool') renderPool();
    if(id==='s-mine') renderMine();
  }
  document.querySelectorAll('.overlay').forEach(o=>{ if(o.id!=='age-gate') o.classList.remove('active'); });
  if(id.startsWith('flow-')) document.getElementById(id).classList.add('active');
}
function toast(msg){
  let t=document.querySelector('.toast');
  if(!t){ t=document.createElement('div'); t.className='toast'; document.querySelector('.phone').appendChild(t); }
  t.textContent=msg; t.classList.add('show');
  clearTimeout(window._toastT); window._toastT=setTimeout(()=>t.classList.remove('show'),1600);
}

/* ---------- 模式切换 ---------- */
function setMode(m, btn){
  currentMode = m;
  document.querySelectorAll('#mode-toggle .mode-chip').forEach(c=>c.classList.remove('on'));
  btn.classList.add('on');
}

/* ---------- 捕捉 ---------- */
function submitHome(){
  const v=document.getElementById('home-input').value.trim();
  if(!v){ toast('先写点什么，或随便记一句纳闷的事 🌧️'); return; }
  addCapture(v, currentMode, pendingMedia.slice());
  pendingMedia=[];
  document.getElementById('home-input').value='';
  toast('已记下 📡');
  renderRecent();
}
function addCapture(text, mode, media){
  state.captures.unshift({ id:uid(), text, tags:[], scene:'', mode, media:media||[], links:[], triage:'pending', created_at:nowISO() });
  saveState();
}
function renderRecent(){
  const list=document.getElementById('recent-list');
  const items=state.captures.slice(0,6);
  if(!items.length){ list.innerHTML='<div class="note" style="padding:6px 0;">还没有捕捉。随手记一条吧 📡</div>'; return; }
  list.innerHTML=items.map(c=>`<div class="rc"><span>${c.mode==='active'?'🔆':'🌧️'}</span><div>${escapeHtml(c.text)}</div></div>`).join('');
}
function toggleFold(){
  const b=document.getElementById('fold-body'), t=document.querySelector('.fold-toggle');
  if(b.style.display==='block'){ b.style.display='none'; t.textContent='最近捕捉 ▾'; }
  else{ b.style.display='block'; t.textContent='最近捕捉 ▴'; }
}

/* ---------- 多源面板 ---------- */
function openSheet(){ document.getElementById('sheet-mask').classList.add('active'); document.getElementById('cap-sheet').classList.add('active'); }
function closeSheet(){ document.getElementById('sheet-mask').classList.remove('active'); document.getElementById('cap-sheet').classList.remove('active'); }
function pickSource(type){
  closeSheet();
  if(type==='text'){ go('s-capture'); setTimeout(()=>document.getElementById('home-input').focus(),50); return; }
  if(type==='voice'){ startVoice(); return; }
  if(type==='photo'){ document.getElementById('photo-input').click(); return; }
  if(type==='link'){ const u=prompt('粘贴链接：'); if(u && u.trim()){ pendingMedia.push({type:'link', url:u.trim()}); toast('链接已附上 🔗'); } return; }
}
function onPhotoChosen(e){
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=ev=>{ pendingMedia.push({type:'photo', data:ev.target.result}); toast('照片已附上 📷'); };
  r.readAsDataURL(f); e.target.value='';
}
function startVoice(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){ toast('当前浏览器不支持语音，直接打字吧 ✍️'); go('s-capture'); document.getElementById('home-input').focus(); return; }
  try{
    recog=new SR(); recog.lang='zh-CN'; recog.interimResults=false; recog.maxAlternatives=1;
    recog.onresult=ev=>{ const txt=ev.results[0][0].transcript; const ta=document.getElementById('home-input'); ta.value=(ta.value?ta.value+' ':'')+txt; ta.focus(); };
    recog.onerror=()=>toast('语音没听清，再试或直接打字');
    recog.start(); toast('🎙️ 在听…说完点 ✓'); go('s-capture');
  }catch(err){ toast('语音启动失败，打字吧'); }
}

/* ---------- 池 / 分拣 ---------- */
function setPoolFilter(f, btn){
  poolFilter=f;
  document.querySelectorAll('#pool-tabs .ptab').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on'); renderPool();
}
function renderPool(){
  const list=document.getElementById('pool-list');
  const items=state.captures.filter(c=>c.triage===poolFilter);
  if(!items.length){ list.innerHTML=`<div class="pool-empty">这里还空着～<br/>${poolFilter==='pending'?'去首页随手记一条纳闷的事 📡':'切换其他标签看看'}</div>`; return; }
  list.innerHTML=items.map(poolCardHTML).join('');
}
function poolCardHTML(c){
  const em=c.mode==='active'?'🔆':'🌧️', tx=c.mode==='active'?'主动':'被动';
  let tri='';
  if(c.triage==='pending'){
    tri=`<div class="tri">
      <button class="b-push" onclick="triage('${c.id}','push')">推进 ➡️</button>
      <button class="b-drop" onclick="triage('${c.id}','drop')">放弃 🗑️</button>
      <button class="b-arc" onclick="triage('${c.id}','archive')">归档 📥</button>
    </div>`;
  } else {
    tri=`<div class="pc-meta">状态：${statusText(c.triage)} · ${timeAgo(c.created_at)}</div>`;
  }
  let action='';
  if(c.triage==='push'){
    const p=problemOfCapture(c.id);
    if(!p){ action=`<div class="guide-pick"><button onclick="startDefine('${c.id}')">🤔 我想搞明白（去定义）</button></div>`; }
    else if(p.status==='closed'){ action=`<div class="guide-pick"><button onclick="openShare('${p.id}')">📤 分享 artifact</button></div>`; }
    else { action=`<div class="guide-pick"><button onclick="continueProblem('${p.id}')">${p.status==='defined'?'继续：先想再做':'继续：验证'}</button></div>`; }
  }
  return `<div class="pool-card">
    <div class="pc-text"><span>${em}</span><div>${escapeHtml(c.text)}</div></div>
    <div class="pc-meta">${tx} · ${timeAgo(c.created_at)} ${c.media&&c.media.length?('· 📎'+c.media.length):''}</div>
    ${tri}${action}
  </div>`;
}
function triage(id, status){
  const c=state.captures.find(x=>x.id===id); if(!c) return;
  c.triage=status; saveState(); renderPool();
}

/* ---------- 定义 4 步引导 ---------- */
const defineSteps=[
  {q:'第 1 步 · 真正让你在意的是哪一点？💡', hint:'不是整个事件，是里面最扎你的那小块。', ph:'例：不是「分组不好玩」，是「我怕自己也被剩下」', key:'core'},
  {q:'第 2 步 · 你希望这事变成什么样？🎯', hint:'想象一下，理想状态是什么。', ph:'例：分组时我能自在，不被剩下', key:'goal'},
  {q:'第 3 步 · 现在卡在哪？⛔', hint:'是什么拦着你？', ph:'例：不知道怎么开口，也怕显得矫情', key:'block'},
  {q:'第 4 步 · 怎么算「想通了 / 解决了」？✅', hint:'一个可验证的标准，不是感觉。', ph:'例：我能说出感受，且对方有回应', key:'criteria'},
];
function startDefine(captureId){
  defineState={ captureId, step:0, data:{} };
  go('flow-define'); renderDefine();
}
function renderDefine(){
  const s=defineSteps[defineState.step];
  const dots=defineSteps.map((_,i)=>`<i class="${i<=defineState.step?'on':''}"></i>`).join('');
  document.getElementById('define-body').innerHTML=`
    <div class="step-dot">${dots}</div>
    <div class="big-q">${s.q}</div>
    <div class="guide-q">${s.hint}</div>
    <textarea class="cap-input" id="def-input" placeholder="${s.ph}"></textarea>
    <button class="btn" onclick="nextDefine()">${defineState.step<3?'下一步 →':'生成问题卡 →'}</button>
    <div class="guide-q" style="margin-top:10px;">共 4 步，可随时点左上角返回</div>`;
  document.getElementById('def-input').focus();
}
function nextDefine(){
  const v=document.getElementById('def-input').value.trim();
  if(!v){ toast('先写一句，不用完美'); return; }
  defineState.data[defineSteps[defineState.step].key]=v;
  if(defineState.step<3){ defineState.step++; renderDefine(); }
  else finishDefine();
}
function finishDefine(){
  const d=defineState.data;
  const cap=state.captures.find(c=>c.id===defineState.captureId);
  const statement=`在「${cap?cap.text:''}」里，我最在意的是${d.core}；我希望${d.goal}，但目前卡在${d.block}；怎么算想通：当${d.criteria}。`;
  state.problems.push({ id:uid(), capture_id:defineState.captureId, text:cap?cap.text:'', core:d.core, goal:d.goal, block:d.block, criteria:d.criteria, statement, status:'defined', risk_flag:false, created_at:nowISO() });
  saveState();
  toast('问题卡已生成 💡');
  const pid=state.problems[state.problems.length-1].id;
  go('flow-collab'); renderCollab(pid);
}

/* ---------- 先想再做（P1 门禁 + 验证规划，M1 无真 AI） ---------- */
function renderCollab(problemId){
  const p=state.problems.find(x=>x.id===problemId); if(!p) return;
  if(!solutionOf(p.id)){
    state.solutions.push({ id:uid(), problem_id:p.id, my_tendency:'', my_reason:'', ai_paths:[], final_choice:'', choice_reason:'', verify_plan:'', created_at:nowISO() });
    saveState();
  }
  const s=solutionOf(p.id);
  document.getElementById('collab-body').innerHTML=`
    <div class="warn">🛑 先写下你的想法，再往下走 —— 不然会被第一个答案锚定。</div>
    <div class="guide-q">你倾向怎么处理？为什么？</div>
    <textarea class="cap-input" id="my-tendency" placeholder="例：我想先观察一次真实分组，再决定要不要说出来">${escapeHtml(s.my_tendency)}</textarea>
    <div class="guide-q">写下你的理由（这是你的判断资产）</div>
    <textarea class="cap-input" id="my-reason" placeholder="例：我怕直接说会尴尬，先看看情况再说">${escapeHtml(s.my_reason)}</textarea>
    <button class="btn" onclick="saveMyThinking('${p.id}')">我写好了，看下一步 →</button>
    <div id="ai-placeholder" style="display:${s.my_tendency||s.my_reason?'block':'none'};">
      <div class="ai-msg">🤖 <b>AI 视角</b>（M2 启用）：会给你 2–3 条不同路径 + Argue（理清 / 质疑 / 证据）。M1 先靠你自己想。</div>
      <div class="guide-q" style="color:var(--green)">验证规划（进验证前的脚手架）</div>
      <div class="guide-q">你想怎样验证？收集什么、怎么判断有效 / 错误？</div>
      <textarea class="cap-input" id="verify-plan" placeholder="例：这周观察 2 次分组，记下感受；预期「说出来会尴尬」，实际对比">${escapeHtml(s.verify_plan)}</textarea>
      <div class="guide-q" style="color:var(--coral)">这条是高风险吗？🔐</div>
      <div class="guide-pick">
        <button id="risk-no" onclick="toggleRisk('${p.id}',false)">普通问题</button>
        <button id="risk-yes" onclick="toggleRisk('${p.id}',true)">涉及资金/安全/法律/健康/重大业务</button>
      </div>
      <button class="btn coral" onclick="saveCollab('${p.id}')">去验证 →</button>
    </div>`;
  highlightRisk(p.id);
}
function saveMyThinking(pid){
  const s=solutionOf(pid);
  s.my_tendency=document.getElementById('my-tendency').value.trim();
  s.my_reason=document.getElementById('my-reason').value.trim();
  saveState();
  document.getElementById('ai-placeholder').style.display='block';
  toast('已记录你的判断 🎯');
}
function toggleRisk(pid, v){
  const p=state.problems.find(x=>x.id===pid); if(!p) return;
  p.risk_flag=v; saveState(); highlightRisk(pid);
}
function highlightRisk(pid){
  const p=state.problems.find(x=>x.id===pid); if(!p) return;
  const yes=document.getElementById('risk-yes'), no=document.getElementById('risk-no');
  if(!yes||!no) return;
  if(p.risk_flag){ yes.style.background='var(--coral)'; yes.style.color='#fff'; no.style.background='var(--green-soft)'; no.style.color='var(--green)'; }
  else { no.style.background='var(--green-soft)'; no.style.color='var(--green)'; yes.style.background='#fff'; yes.style.color='var(--coral)'; }
}
function saveCollab(pid){
  const s=solutionOf(pid);
  s.verify_plan=document.getElementById('verify-plan').value.trim();
  saveState();
  const p=state.problems.find(x=>x.id===pid); p.status='verifying'; saveState();
  go('flow-verify'); renderVerify(p.id);
}

/* ---------- 验证 ---------- */
function renderVerify(problemId){
  const p=state.problems.find(x=>x.id===problemId); if(!p) return;
  if(!verificationOf(p.id)){ state.verifications.push({ id:uid(), problem_id:p.id, action:'', expected:'', actual:'', ai_effective:'na', high_risk_check:'', note:'', created_at:nowISO() }); saveState(); }
  const v=verificationOf(p.id);
  document.getElementById('verify-body').innerHTML=`
    <div class="guide-q">行动（最小一步）：</div>
    <textarea class="cap-input" id="v-action" placeholder="例：周二观察一次分组，记下感受">${escapeHtml(v.action)}</textarea>
    <div class="guide-q" style="margin-top:10px;">预期 vs 实际：</div>
    <textarea class="cap-input" id="v-expected" placeholder="预期：说出来会尴尬">${escapeHtml(v.expected)}</textarea>
    <textarea class="cap-input" id="v-actual" placeholder="实际：______">${escapeHtml(v.actual)}</textarea>
    <div class="guide-q">你的想法有效 / 错误？</div>
    <div class="guide-pick" id="eff-pick">
      <button id="eff-yes" onclick="setEff('${p.id}','effective')">✅ 有效</button>
      <button id="eff-no" onclick="setEff('${p.id}','wrong')">❌ 错误</button>
      <button id="eff-na" onclick="setEff('${p.id}','na')">➖ 暂不评</button>
    </div>
    ${p.risk_flag?`<div class="warn" id="hr-box">🔐 高风险：需先核对原始资料 / 证据再闭环。<br/><textarea class="cap-input" id="v-hr" placeholder="我核对了什么、结论是什么">${escapeHtml(v.high_risk_check)}</textarea></div>`:''}
    <div class="guide-q">一句话复盘：</div>
    <textarea class="cap-input" id="v-note" placeholder="这周学到了什么">${escapeHtml(v.note)}</textarea>
    <button class="btn" onclick="saveVerify('${p.id}')">完成，回我的 →</button>`;
  highlightEff(p.id);
}
function setEff(pid, val){
  const v=verificationOf(pid); v.ai_effective=val; saveState(); highlightEff(pid);
}
function highlightEff(pid){
  const v=verificationOf(pid); if(!v) return;
  ['eff-yes','eff-no','eff-na'].forEach(id=>{ const b=document.getElementById(id); if(b){ b.style.background='var(--green-soft)'; b.style.color='var(--green)'; } });
  const map={effective:'eff-yes',wrong:'eff-no',na:'eff-na'};
  const b=document.getElementById(map[v.ai_effective]); if(b){ b.style.background='var(--green)'; b.style.color='#fff'; }
}
function saveVerify(pid){
  const v=verificationOf(pid);
  v.action=document.getElementById('v-action').value.trim();
  v.expected=document.getElementById('v-expected').value.trim();
  v.actual=document.getElementById('v-actual').value.trim();
  v.note=document.getElementById('v-note').value.trim();
  if(document.getElementById('v-hr')) v.high_risk_check=document.getElementById('v-hr').value.trim();
  const p=state.problems.find(x=>x.id===pid);
  if(p.risk_flag && !v.high_risk_check){ toast('高风险问题需先核对资料再闭环 ⚠️'); return; }
  saveState(); p.status='closed'; saveState();
  toast('验证已记录 🧪');
  go('s-mine'); renderMine();
}

/* ---------- 继续 / 分享 ---------- */
function continueProblem(pid){
  const p=problemOf(pid); if(!p) return;
  if(p.status==='defined'){ go('flow-collab'); renderCollab(pid); }
  else if(p.status==='verifying'){ go('flow-verify'); renderVerify(pid); }
  else if(p.status==='closed'){ openShare(pid); }
  else { go('flow-define'); startDefine(p.capture_id); }
}
function openShare(pid){
  const p=problemOf(pid); if(!p) return;
  const s=solutionOf(pid), v=verificationOf(pid);
  const txt=`我这周在琢磨：${p.text} 🔍\n我的定义：${p.statement} 💡\n我的想法：${s?s.my_tendency:'（未填）'} 🤔\n我试了：${v?v.action:'（未验证）'} 🧪\n结果：${v?(v.actual||'（待验证）'):'（待验证）'} ${v?v.ai_effective==='effective'?'✅':(v&&v.ai_effective==='wrong'?'❌':'➖'):''}`;
  window._artifact=txt;
  document.getElementById('share-body').innerHTML=`
    <div class="section-title">思考 artifact（想发就发）</div>
    <div class="artifact">${escapeHtml(txt).replace(/\n/g,'<br/>')}</div>
    <div class="guide-q" style="margin-top:10px;">公开默认，敏感内容走分组 / 私有。</div>
    <div class="platforms"><span class="pf">📕 小红书</span><span class="pf">📺 B站</span><span class="pf">💬 班级群</span></div>
    <button class="btn coral" onclick="copyArtifact()">复制文本 ✨</button>
    <button class="btn ghost" onclick="go('s-capture')">先不发自留 🌿</button>`;
  go('flow-share');
}
function copyArtifact(){
  const t=window._artifact||'';
  if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(t).then(()=>toast('已复制，去粘贴吧 ✨'),()=>fallbackCopy(t)); }
  else fallbackCopy(t);
}
function fallbackCopy(t){ const ta=document.createElement('textarea'); ta.value=t; document.body.appendChild(ta); ta.select(); try{document.execCommand('copy'); toast('已复制 ✨');}catch(e){ toast('复制失败，手动选吧'); } document.body.removeChild(ta); }

/* ---------- 我的成长 ---------- */
function renderMine(){
  if(state.user.name){
    document.getElementById('conv-card').style.display='none';
    document.getElementById('greet').style.display='block';
    document.getElementById('greet-name').textContent=state.user.name;
  }
  const s=computeScores();
  document.getElementById('grow-num').textContent=s.overall;
  document.querySelector('#s-mine .ring').style.background=`conic-gradient(var(--green) 0 ${s.overall}%, var(--green-soft) ${s.overall}% 100%)`;
  document.getElementById('grow-label').textContent = s.overall>=60?'思维肌肉·在变强':(s.overall>=30?'思维肌肉·起步中':'思维肌肉·刚开始');
  document.getElementById('grow-sub').textContent=`发现 ${s.find} · 定义 ${s.define} · 验证 ${s.verify} · 校准 ${s.calibrate}`;
  renderRadar(s);
  renderJudgment();
}
function computeScores(){
  const caps=state.captures.length;
  const activeCount=state.captures.filter(c=>c.mode==='active').length;
  const problems=state.problems.length;
  const verifs=state.verifications.length;
  const find=Math.min(100, caps*8 + (caps>0?Math.round(activeCount/caps*20):0));
  const define=Math.min(100, problems*25);
  const verify=Math.min(100, verifs*30);
  const withActual=state.verifications.filter(v=>v.actual && v.actual.trim()).length;
  const calibrate=verifs>0?Math.min(100, Math.round(withActual/verifs*60)+(withActual>0?40:0)):0;
  return { find:Math.round(find), define:Math.round(define), verify:Math.round(verify), calibrate:Math.round(calibrate), overall:Math.round((find+define+verify+calibrate)/4) };
}
function renderRadar(s){
  const cx=130, cy=100, R=80;
  const axes=[
    {label:'🔍 发现', val:s.find, angle:-90},
    {label:'💡 定义', val:s.define, angle:0},
    {label:'🧪 验证', val:s.verify, angle:90},
    {label:'🎯 校准', val:s.calibrate, angle:180},
  ];
  const pt=(val,ang)=>{ const r=R*val/100, a=ang*Math.PI/180; return [cx+r*Math.cos(a), cy+r*Math.sin(a)]; };
  const grid=f=>{ const p=axes.map(ax=>{const[x,y]=pt(100*f,ax.angle);return `${x.toFixed(1)},${y.toFixed(1)}`;}).join(' '); return `<polygon points="${p}" fill="none" stroke="#e7ece9" stroke-width="1.5"/>`; };
  let svg=grid(1)+grid(0.66)+grid(0.33);
  axes.forEach(ax=>{ const[x,y]=pt(100,ax.angle); svg+=`<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#e7ece9" stroke-width="1.5"/>`; });
  const dataPts=axes.map(ax=>{const[x,y]=pt(ax.val,ax.angle);return `${x.toFixed(1)},${y.toFixed(1)}`;}).join(' ');
  svg+=`<polygon points="${dataPts}" fill="rgba(14,107,80,.16)" stroke="#0E6B50" stroke-width="2"/>`;
  const minV=Math.min(...axes.map(a=>a.val));
  axes.forEach(ax=>{ const[x,y]=pt(ax.val,ax.angle), weak=ax.val===minV; svg+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="${weak?'#FF8A5B':'#0E6B50'}"/>`; });
  axes.forEach(ax=>{
    const[x,y]=pt(100,ax.angle); let tx=x, ty=y, anchor='middle';
    if(ax.angle===-90){ ty=y-8; } else if(ax.angle===0){ tx=x+6; anchor='start'; } else if(ax.angle===90){ ty=y+14; } else { tx=x-6; anchor='end'; }
    const weak=ax.val===minV;
    svg+=`<text x="${tx}" y="${ty}" text-anchor="${anchor}" font-size="12" font-weight="800" fill="${weak?'#FF8A5B':'#1c2b25'}" stroke="#fff" stroke-width="3" paint-order="stroke">${ax.label} ${ax.val}</text>`;
  });
  document.getElementById('radar-svg').innerHTML=svg;
}
function renderJudgment(){
  const items=[];
  state.solutions.forEach(s=>{
    if(s.my_tendency || s.my_reason){
      const p=problemOf(s.problem_id);
      items.push(`📌 你对「${p?p.core:'问题'}」的判断：${s.my_tendency||'（未填倾向）'}<br/><span style="color:var(--muted);">${s.my_reason?'理由：'+escapeHtml(s.my_reason):'（未填理由）'}</span>`);
    }
  });
  state.verifications.forEach(v=>{
    if(v.ai_effective!=='na' || v.note){
      const p=problemOf(v.problem_id);
      const tag=v.ai_effective==='effective'?'✅ 想法有效':(v.ai_effective==='wrong'?'❌ 想法错误':'');
      items.push(`📌 验证「${p?p.core:'问题'}」：${tag}<br/><span style="color:var(--muted);">${escapeHtml(v.note||(v.actual?'实际：'+v.actual:''))}</span>`);
    }
  });
  if(!items.length){ document.getElementById('judgment-list').innerHTML='<div class="note" style="padding:6px 0;">还没有判断记录。去定义一个问题、写下你的想法，就会积累在这里 📌</div>'; return; }
  document.getElementById('judgment-list').innerHTML=items.map(i=>`<div style="padding:8px 0;text-align:left;border-bottom:1px solid var(--line);font-size:13px;line-height:1.5;">${i}</div>`).join('');
}

/* ---------- 年龄门禁 ---------- */
function setAge(minor){
  if(minor){ document.getElementById('guardian-box').style.display='block'; }
  else { state.user.is_minor=false; state.user.guardian_verified=true; saveState(); closeAgeGate(); }
}
function confirmGuardian(){
  const phone=document.getElementById('guardian-phone').value.trim();
  const agree=document.getElementById('guardian-agree').checked;
  if(!/^\d{6,}$/.test(phone)){ toast('请填写监护人手机号'); return; }
  if(!agree){ toast('需勾选监护人同意'); return; }
  state.user.is_minor=true; state.user.guardian_verified=true; saveState(); closeAgeGate();
}
function closeAgeGate(){ const g=document.getElementById('age-gate'); if(g) g.classList.remove('active'); }

/* ---------- 姓名 ---------- */
function setName(){
  const v=document.getElementById('name-field').value.trim();
  if(!v) return;
  state.user.name=v; saveState();
  document.getElementById('greet-name').textContent=v;
  document.getElementById('conv-card').style.display='none';
  document.getElementById('greet').style.display='block';
}

/* ---------- 关联查询 ---------- */
function problemOf(id){ return state.problems.find(p=>p.id===id); }
function problemOfCapture(cid){ return state.problems.find(p=>p.capture_id===cid); }
function solutionOf(pid){ return state.solutions.find(s=>s.problem_id===pid); }
function verificationOf(pid){ return state.verifications.find(v=>v.problem_id===pid); }

/* ---------- 初始化 ---------- */
function init(){
  if(state.user.guardian_verified){ closeAgeGate(); }
  renderRecent(); renderPool(); renderMine();
}
init();

// 暴露给内联 onclick
Object.assign(window,{
  go, toast, setMode, submitHome, renderRecent, toggleFold, openSheet, closeSheet, pickSource, onPhotoChosen,
  setPoolFilter, triage, startDefine, nextDefine, finishDefine, renderCollab, saveMyThinking, toggleRisk, saveCollab,
  renderVerify, setEff, saveVerify, continueProblem, openShare, copyArtifact, fallbackCopy,
  setAge, confirmGuardian, setName
});
})();
