/* ===================== 探奇 / Mind Gym — M1 逻辑（无 AI 闭环） ===================== */
const KEY = 'mindgym_v2';
let DB = load();
let mode = 'passive';          // 捕捉模式：passive 偶遇 / active 探索
let curThreadId = null;        // 当前打开的线索
let curStage = null;           // 当前阶段指针（2~5）
let foldOpen = false;          // 首页“我的探索”折叠状态（默认收起）
let aboutIdx = 0;              // 首页 About 轮播当前索引
let aboutTimer = null;         // 自动轮播定时器
/* About 轮播：4 张，目的/价值/流程/姿态。文案面向 AI-native 青少年：短句、同盟者口吻、不上纲上线。 */
const ABOUT_SLIDES = [
  { kicker: '为什么 · WHY', emoji: '🧠',
    title: '答案越来越好找，', title2: '会问问题才是超能力。',
    body: 'AI 能秒回，但“到底哪里不对劲、该验证什么”得你自己长出来。探奇就是练这块肌肉的。' },
  { kicker: '练什么 · VALUE', emoji: '⚡',
    title: '四件 AI 替不了的事。', title2: '',
    body: '发现 → 定义 → 验证 → 校准判断。每周练一点点，看得见自己变强。' },
  { kicker: '怎么走 · FLOW', emoji: '🧭',
    title: '5 步，一个小疑问走到底。', title2: '',
    body: '随手捕捉 → 挑值得的 → 写下你的判断 → 做点什么验证 → 下次更顺。不打卡，不排名。' },
  { kicker: '谁做主 · YOURS', emoji: '🔑',
    title: '你的判断，先到。', title2: '',
    body: '先看 AI 再下结论，容易被带着跑。这里永远是你先想、AI 后帮。你的 Key、你的数据，只在这台设备。' }
];

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { user: { name: null, isMinor: false, guardianPhone: '', consent: false, ageConfirmed: false }, threads: [], settings: {} };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) {} }
function el(id) { return document.getElementById(id); }
function go(id, btn) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  el(id).classList.add('active');
  if (btn) { document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('on')); btn.classList.add('on'); }
  else if (id === 's-home') { setNav('s-home'); }
  else if (id === 's-mine') { setNav('s-mine'); }
  if (id !== 's-home') clearInterval(aboutTimer);
  if (id === 's-home') { renderHomeThreads(); if (DB.user.ageConfirmed) restartAbout(); }
  if (id === 's-pool') renderPool();
  if (id === 's-mine') renderMine();
  updateFab();
  updateAiBtn();
  window.scrollTo(0, 0);
}
function setNav(id) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('on'));
  if (id === 's-home') document.querySelectorAll('.nav-item')[0].classList.add('on');
  if (id === 's-mine') document.querySelectorAll('.nav-item')[1].classList.add('on');
}
/* FAB 只在家页且无需分诊时显示，避免遮挡底部“下一步 / 整理一下”按钮导致无法点按 */
function updateFab() {
  const fab = el('fab'); if (!fab) return;
  const homeActive = el('s-home').classList.contains('active');
  const triageVisible = el('triage-entry') && el('triage-entry').classList.contains('show');
  fab.style.display = (homeActive && !triageVisible) ? 'flex' : 'none';
}
/* 首页右上角 AI 设置按钮：仅首页显示，连好 Key 后显示 ✓ */
function updateAiBtn() {
  const btn = el('ai-set-btn'); if (!btn) return;
  const homeActive = el('s-home').classList.contains('active');
  const hasKey = !!(DB.settings && DB.settings.aiKey);
  btn.classList.toggle('show', homeActive);
  btn.innerHTML = hasKey ? '⚙️ AI ✓' : '⚙️ AI 设置';
}

/* ---------- AI 设置（用户自带 Key，本地存储） ---------- */
function openSettings() {
  const s = DB.settings || {};
  el('ai-provider').value = s.aiProvider || 'deepseek';
  el('ai-base').value = s.aiBase || '';
  el('ai-key').value = s.aiKey || '';
  el('ai-base-wrap').style.display = (s.aiProvider === 'custom') ? 'block' : 'none';
  renderAiStatus();
  el('settings-gate').classList.add('active');
}
function closeSettings() { el('settings-gate').classList.remove('active'); }
function onProviderChange() {
  const p = el('ai-provider').value;
  el('ai-base-wrap').style.display = p === 'custom' ? 'block' : 'none';
}
function toggleKey() {
  const i = el('ai-key'); const e = el('ai-eye');
  if (i.type === 'password') { i.type = 'text'; e.textContent = '隐藏'; }
  else { i.type = 'password'; e.textContent = '显示'; }
}
function saveAiSettings() {
  const provider = el('ai-provider').value;
  const base = el('ai-base').value.trim();
  const key = el('ai-key').value.trim();
  if (!key) { toast('先填 API Key'); return; }
  if (provider === 'custom' && !base) { toast('自定义需填 Base URL'); return; }
  DB.settings = DB.settings || {};
  DB.settings.aiProvider = provider;
  DB.settings.aiBase = base;
  DB.settings.aiKey = key;
  save();
  renderAiStatus();
  updateAiBtn();
  toast('已保存 🔐');
  setTimeout(closeSettings, 700);
}
function renderAiStatus() {
  const s = DB.settings || {};
  const note = el('ai-status-note');
  if (s.aiKey) {
    const names = { deepseek: 'DeepSeek', openai: 'OpenAI', custom: '自定义' };
    note.innerHTML = `✅ 已连接：${names[s.aiProvider] || '自定义'} · Key 已保存在本地`;
  } else {
    note.innerHTML = '⚠️ 尚未设置 API Key';
  }
}
function goHome() { go('s-home'); }
function toast(msg) {
  const t = el('toast');
  if (!t) return; // 防御：toast 节点缺失时绝不抛错，避免中断调用方的后续逻辑
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 1600);
}

/* ---------- 年龄门禁 ---------- */
function setAge(minor) {
  if (minor) { el('guardian-box').style.display = 'block'; }
  else { DB.user.isMinor = false; confirmAge(); }
}
function confirmGuardian() {
  const phone = el('guardian-phone').value.trim();
  const agree = el('guardian-agree').checked;
  if (!/^\d{6,}$/.test(phone)) { toast('请填写监护人手机号'); return; }
  if (!agree) { toast('请勾选同意'); return; }
  DB.user.isMinor = true; DB.user.guardianPhone = phone; DB.user.consent = true; confirmAge();
}
function confirmAge() {
  DB.user.ageConfirmed = true; save();
  el('age-gate').classList.remove('active');
  restartAbout();
}

/* ---------- 捕捉（首页） ---------- */
function setMode(m, btn) {
  mode = m;
  document.querySelectorAll('.mode-chip').forEach(c => c.classList.remove('on'));
  btn.classList.add('on');
}
function newThread(raw, media) {
  return {
    id: 't' + Date.now() + Math.floor(Math.random() * 1000),
    title: (raw || '').slice(0, 42),
    sourceMode: mode, raw: raw || '', media: media || null,
    status: 'captured', stagePointer: 1, stageData: {},
    createdAt: Date.now(), updatedAt: Date.now()
  };
}
function addThread(raw, media) {
  const t = newThread(raw, media);
  DB.threads.unshift(t); save();
  showFeedback(t); renderHomeThreads();
  return t;
}
function submitHome() {
  const v = el('home-input').value.trim();
  if (!v) { toast('先写点什么吧'); return; }
  addThread(v, null);
  el('home-input').value = '';
  toast('已记下 ✅');
}
function showFeedback(t) {
  const fb = el('home-feedback');
  fb.innerHTML = `<div class="fb-card">
    <div class="fb-ok">已记下 ✅</div>
    <div class="fb-text">${esc(t.raw)}</div>
    <div class="fb-actions">
      <button class="fb-go" onclick="go('s-pool')">放进探索池看看 →</button>
      <button class="fb-more" onclick="moreCapture()">再记一条</button>
    </div></div>`;
  fb.classList.add('show');
}
function moreCapture() {
  el('home-feedback').classList.remove('show');
  el('home-input').focus();
}
function esc(s) { return (s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

/* ---------- 多源捕捉面板 ---------- */
function openSheet() { el('sheet-mask').classList.add('active'); el('cap-sheet').classList.add('active'); }
function closeSheet() { el('sheet-mask').classList.remove('active'); el('cap-sheet').classList.remove('active'); }
function pickSource(type) {
  closeSheet();
  if (type === 'write') { el('home-input').focus(); return; }
  if (type === 'voice') {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      try {
        const r = new SR(); r.lang = 'zh-CN'; r.interimResults = false;
        r.onresult = e => { addThread('🎙️ ' + e.results[0][0].transcript, 'voice'); toast('语音已记下 ✅'); };
        r.onerror = () => { addThread('🎙️ 语音线索（真实转写待 M2）', 'voice'); toast('语音已记下（示意）'); };
        r.start(); return;
      } catch (e) {}
    }
    addThread('🎙️ 语音线索（真实转写待 M2）', 'voice'); toast('语音已记下（示意）');
  } else if (type === 'photo') {
    el('photo-input').click();
  } else if (type === 'link') {
    const url = prompt('贴一个链接：');
    if (url && url.trim()) addThread('🔗 ' + url.trim(), 'link');
  }
}
function onPhotoChosen(e) {
  const f = e.target.files && e.target.files[0];
  if (f) { addThread('📷 已拍一张照片（M1 示意）', 'photo'); toast('照片已记下 ✅'); }
  e.target.value = '';
}

/* ---------- 我的线索列表（首页） ---------- */
function statusText(s) { return { captured: '待整理', active: '进行中', dropped: '已放下', archived: '已归档', done: '已收尾' }[s] || s; }
function statusClass(s) { return { captured: 'st-pending', active: 'st-active', dropped: 'st-drop', archived: 'st-archive', done: 'st-done' }[s] || 'st-drop'; }
function railHTML(t) {
  let doneCount, curIndex;
  if (t.status === 'captured') { doneCount = 1; curIndex = 0; }
  else if (t.status === 'done') { doneCount = 5; curIndex = 0; }
  else { doneCount = Math.max(0, t.stagePointer - 1); curIndex = t.stagePointer; }
  let h = '<div class="rail">';
  for (let i = 1; i <= 5; i++) {
    const cls = i <= doneCount ? 'done' : (i === curIndex ? 'cur' : '');
    h += `<i class="${cls}"></i>`;
  }
  return h + '</div>';
}
/* ---------- 首页 About 轮播 ---------- */
function renderAbout() {
  const box = el('about-card'); if (!box) return;
  const s = ABOUT_SLIDES[aboutIdx];
  box.innerHTML = `
    <div class="ab-kicker">${s.kicker}</div>
    <div class="ab-emoji">${s.emoji}</div>
    <div class="ab-title">${s.title}${s.title2 ? `<br>${s.title2}` : ''}</div>
    <div class="ab-body">${s.body}</div>
    <div class="ab-foot">
      <div class="ab-dots">${ABOUT_SLIDES.map((_, i) => `<span class="ab-dot ${i === aboutIdx ? 'on' : ''}" onclick="event.stopPropagation();aboutGo(${i})"></span>`).join('')}</div>
      <div class="ab-count">${aboutIdx + 1} / ${ABOUT_SLIDES.length}</div>
    </div>`;
}
function aboutGo(i) { aboutIdx = (i + ABOUT_SLIDES.length) % ABOUT_SLIDES.length; renderAbout(); restartAbout(); }
function restartAbout() { clearInterval(aboutTimer); aboutTimer = setInterval(() => aboutGo(aboutIdx + 1), 4200); }

function toggleFold() {
  foldOpen = !foldOpen;
  el('fold-body').style.display = foldOpen ? 'block' : 'none';
  el('fold-chevron').textContent = foldOpen ? '▴' : '▾';
}
function renderHomeThreads() {
  const list = el('thread-list');
  const anyThreads = DB.threads.length;
  const captured = DB.threads.filter(t => t.status === 'captured').length;
  el('fold-count').textContent = anyThreads;
  const te = el('triage-entry');
  te.classList.toggle('show', anyThreads > 0);
  te.textContent = captured > 0 ? `探索池 · ${captured} →` : '探索池 →';
  updateFab();
  if (!DB.threads.length) { list.innerHTML = ''; return; }
  list.innerHTML = DB.threads.map(t => {
    const emoji = t.sourceMode === 'active' ? '🔆' : '🌧️';
    const sub = `${statusText(t.status)} · ${new Date(t.updatedAt).toLocaleDateString('zh-CN')}`;
    return `<div class="tri-card" onclick="openThread('${t.id}')">
      <div class="tri-emoji">${emoji}</div>
      <div class="tri-main">
        <div class="tri-title">${esc(t.title || t.raw)}</div>
        <div class="tri-sub">${sub}</div>
        ${railHTML(t)}
      </div>
      <div class="status-chip ${statusClass(t.status)}">${statusText(t.status)}</div>
      <button class="del-btn" title="删除这条探索" onclick="event.stopPropagation();deleteThread('${t.id}')">🗑️</button>
    </div>`;
  }).join('');
}

/* ---------- 整理（分诊） ---------- */
function renderPool() {
  const pool = el('pool-list');
  const items = DB.threads.filter(t => t.status === 'captured');
  if (!items.length) {
    pool.innerHTML = '<div class="pool-empty">都整理完啦 🌿<br>去首页记点新探索吧</div>';
    return;
  }
  pool.innerHTML = items.map(t => {
    const emoji = t.sourceMode === 'active' ? '🔆' : '🌧️';
    return `<div class="tri-card" style="display:block;">
      <div style="display:flex;gap:10px;align-items:flex-start;">
        <div class="tri-emoji">${emoji}</div>
        <div class="tri-main"><div class="tri-title">${esc(t.title || t.raw)}</div></div>
        <button class="del-btn" title="删除这条探索" onclick="deleteThread('${t.id}')">🗑️</button>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button class="next-btn" style="margin:0;" onclick="triage('${t.id}','push')">推进 ➡️</button>
        <button class="next-btn" style="margin:0;background:#b9c2bd;" onclick="triage('${t.id}','drop')">放弃</button>
        <button class="next-btn coral" style="margin:0;" onclick="triage('${t.id}','archive')">归档</button>
      </div>
    </div>`;
  }).join('');
}
/* 彻底删除一条探索（不可逆，需二次确认）。状态类的“放弃/归档”仍走 triage。 */
function deleteThread(id) {
  const t = DB.threads.find(x => x.id === id); if (!t) return;
  if (!confirm(`删除这条探索？\n\n「${(t.title || t.raw || '').slice(0, 30)}」\n\n删除后无法恢复。`)) return;
  DB.threads = DB.threads.filter(x => x.id !== id);
  if (curThreadId === id) { curThreadId = null; curStage = null; }
  save();
  renderHomeThreads();
  if (el('s-pool').classList.contains('active')) renderPool();
  if (el('s-mine').classList.contains('active')) renderMine();
  toast('已删除 🗑️');
}
function triage(id, act) {
  const t = DB.threads.find(x => x.id === id); if (!t) return;
  if (act === 'push') { t.status = 'active'; t.stagePointer = 2; t.updatedAt = Date.now(); save(); toast('已推进，去定义 →'); openThread(id); }
  else if (act === 'drop') { t.status = 'dropped'; save(); renderPool(); renderHomeThreads(); toast('已放下'); }
  else { t.status = 'archived'; save(); renderPool(); renderHomeThreads(); toast('已归档'); }
}

/* ---------- 线索打开 / 阶段渲染 ---------- */
function openThread(id) {
  const t = DB.threads.find(x => x.id === id); if (!t) return;
  curThreadId = id;
  if (t.status === 'captured') { go('s-pool'); return; }
  curStage = t.stagePointer;
  go('s-stage');
  renderStage();
}
function getCur() { return DB.threads.find(x => x.id === curThreadId); }

/* ===================== 引导式对话引擎 =====================
   设计：一次只问一个问题；基于捕捉原文与上一步追问；对话可回看、可点开修订。
   数据：stageData[key] = { answers:{stepId:value}, progress:n, ... }
*/
const STAGES = {
  2: { key:'define', label:'定义 · 第2步/共5', why:'把“说不清哪儿怪”的感觉，逼成一句能去验证的问题。五步来，别跳。',
       nextLabel:'下一步：说出你自己的判断 →' },
  3: { key:'collab', label:'协作 · 第3步/共5', why:'先看 AI 之前的答案之前，先说你的。你的判断先到，AI 后到——这是不被带着走的关键。',
       nextLabel:'下一步：去验证这个方案 →' },
  4: { key:'verify', label:'验证 · 第4步/共5', why:'想法对不对，做了才知道。按验证建议做一次最小测试，记下真实结果，再回头修订。',
       nextLabel:'下一步：看看怎么练得更顺 →' },
  5: { key:'improve', label:'进阶 · 第5步/共5', why:'不是打分。回头看整段对话，挑一个下次能改的点。',
       nextLabel:'收尾啦 🎉 回到首页 →' }
};
/* 每个环节的对话脚本。type: text 普通输入 / template 汇总填空 / ai AI 协作 / advice 验证建议 / verdict 二选一 */
const FLOWS = {
  define: { intro:'跟着下面的问题走。只写观察到的事实，不写解释、不着急下结论。', steps:[
    { id:'now', label:'① 现状', q:'现在实际发生的是什么？', hint:'一句话。只写你观察到的事实，不写解释。', ph:'例：课间大家都低头刷手机，几乎没人说话' },
    { id:'std', label:'② 标准', q:'本来应该是什么样？', hint:'参照可以是自己的期望、岗位要求、常识基准，或你认可的某个做法。', ph:'例：我希望课间能有人说说话' },
    { id:'gap', label:'③ 差距', q:'现状与标准之间，具体差在哪？', hint:'只写一个最关键的差距，不要罗列。', ph:'例：大家宁愿刷手机也不愿开口' },
    { id:'cost', label:'④ 后果', q:'这个差距造成了什么可识别的后果？不解决会怎样？', hint:'要具体，不能是“不好”“难受”。', ph:'例：一学期下来我没交到什么新朋友' },
    { id:'problem', label:'⑤ 问题定义', q:'把前四步压成一句话。', hint:'最后那个“问题”必须可验证——能通过行动观察它是否被解决。', ph:'', type:'template' }
  ]},
  collab: { intro:'先给方向、再说理由。然后选 AI 怎么帮你：出完整方案，或专门挑你判断的毛病。', steps:[
    { id:'direction', label:'① 你的方向', q:'针对这个问题，你倾向怎么解决？', hint:'先给一个方向，不用完美。AI 一会儿会帮你，也可能反驳你。', ph:'例：我想在课间主动找人聊一句' },
    { id:'reason', label:'② 你的理由', q:'为什么是这个方向？你依据什么？', hint:'依据可以是你的经验、常识，或你查过的东西。', ph:'例：因为不主动就永远没人先找我' },
    { id:'ai', label:'③ AI 协作', q:'让 AI 帮你推进这一步', hint:'选一种协作方式——它会基于你的问题、方向和理由来回应。', type:'ai' },
    { id:'solution', label:'④ 最终方案', q:'把你的判断和 AI 的反馈，合成一个方案。', hint:'这是你认可的方案，下一步就去验证它。', ph:'例：下周挑 3 天，课间主动跟旁边的人说一句话' }
  ]},
  verify: { intro:'先给你一份验证建议。照着做一次最小测试，记下真实发生的事，再回头修订。', steps:[
    { id:'advice', label:'① 验证建议', q:'这样验证你的方案', hint:'照这个做一次最小测试。建议来自本地模板；填了 Key 可让 AI 定制。', type:'advice' },
    { id:'test', label:'② 原型测试', q:'在这个建议下，你具体做了什么？', hint:'一个最小动作 / 一个粗糙原型，写具体做了啥。', ph:'例：周二课间主动跟同桌说了“昨天那题你会吗”' },
    { id:'result', label:'③ 实际结果', q:'真实发生了什么？', hint:'写观察到的事实，不写“感觉还行”。', ph:'例：他愣了一下，跟我聊了两分钟' },
    { id:'verdict', label:'④ 判断', q:'你的判断：有效，还是错了？', hint:'对照你要解决的问题——它被解决了吗？', type:'verdict' },
    { id:'revision', label:'⑤ 修订', q:'根据结果，怎么修订你的判断或方案？', hint:'这一步会更新你前面整段对话，让它更接近真相。', ph:'例：直接问问题有用，下次可以从共同话题切入' }
  ]},
  improve: { intro:'回头看整段对话，只挑一个下次能改的点。', steps:[
    { id:'note', label:'下次试一点', q:'下次，你最想改进这一步的哪里？', hint:'挑一个点就够。', ph:'例：定义时“后果”写得太笼统，下次要写具体数字' }
  ]}
};
function getFlow(key){ return FLOWS[key]; }

/* 初始化/补全某环节的对话状态 */
function ensureFlow(t, key) {
  t.stageData = t.stageData || {};
  const d = t.stageData[key] || {};
  if (!d.answers) d.answers = {};
  if (typeof d.progress !== 'number') d.progress = 0;
  t.stageData[key] = d;
  return d;
}
/* 预填第 5 步“问题定义”：把前四步拼成模板句 */
function problemTemplate(t) {
  const a = (t.stageData.define || {}).answers || {};
  if (!a.now) return '';
  return `现状${a.now}，标准是${a.std || '___'}，差距在${a.gap || '___'}，导致${a.cost || '___'}，所以我需要解决的问题是___。`;
}
/* 渲染对话流：已答的回合可点开修改；当前回合高亮输入 */
function renderStage() {
  const t = getCur(); if (!t) return;
  const m = STAGES[curStage]; if (!m) return;
  const key = m.key, flow = getFlow(key);
  const d = ensureFlow(t, key);
  el('stage-label').textContent = m.label;
  let body = `<div class="stage-why">${m.why}<button class="help-pill" onclick="toggleHelp()">?</button></div>
    <div class="help-sheet" id="help-sheet">${esc(flow.intro)}</div>`;
  body += stepperHTML(curStage);
  body += `<div class="dlg-context"><span class="dlg-ctx-tag">你在捕捉时记下的</span><div class="dlg-ctx-text">${esc(t.raw || t.title || '—')}</div></div>`;
  body += `<div class="dlg" id="dlg">`;
  flow.steps.forEach((s, i) => {
    const ans = d.answers[s.id];
    const isCurrent = i === d.progress;
    if (ans && !isCurrent) {
      body += answeredTurn(i, s, ans, key);
    } else if (isCurrent) {
      body += currentTurn(i, s, d, t, key);
    }
  });
  body += `</div>`;
  /* 风险与来源：协作阶段标记，验证阶段补来源（合规硬要求） */
  if (key === 'collab' || key === 'verify') {
    body += `<div class="risk-zone" id="risk-zone">${riskZoneHTML(t, key)}</div>`;
  }
  body += `<div class="summary-card" id="summary-card">${summaryHTML(t, key)}</div>`;
  el('stage-body').innerHTML = body;
  const prevBtn = curStage > 2 ? `<button class="next-btn ghost" id="prev-btn" onclick="prevStage()">‹ 上一步</button>` : '';
  const done = d.progress >= flow.steps.length;
  el('stage-footer').innerHTML = `<div class="foot-row">${prevBtn}<button class="next-btn ${curStage === 5 ? 'coral' : ''}" id="next-btn" onclick="nextStage()">${m.nextLabel}</button></div><div class="next-hint" id="next-hint"></div>`;
  el('chrome-prev').style.display = curStage > 2 ? 'block' : 'none';
  bindFlow(key, t, d);
  updateGate(done, key);
}
/* 已回答的回合（可点“改”回到该步） */
function answeredTurn(i, s, ans, key) {
  let a = ans;
  if (s.type === 'ai') a = (ans.mode ? '【' + ans.mode + '】' : '') + (ans.text || '').slice(0, 120);
  if (s.type === 'verdict') a = ans === 'valid' ? '✅ 有效' : '❌ 错了';
  if (s.type === 'advice') a = '已收到验证建议（可重新生成）';
  return `<div class="turn done">
    <div class="turn-q"><span class="turn-n">${i + 1}</span><b>${s.label}</b> · ${esc(s.q)}</div>
    <div class="turn-a">${esc(a || '')}</div>
    <button class="turn-edit" onclick="editTurn(${i})">改 ✎</button>
  </div>`;
}
/* 当前回合：输入框 / AI 选择 / 验证建议 / 判断 */
function currentTurn(i, s, d, t, key) {
  let input = '';
  if (s.type === 'ai') {
    input = `<div class="ai-choices">
      <button class="ai-choice" onclick="runAI('plan')">🛠️ 让 AI 给出完整方案</button>
      <button class="ai-choice" onclick="runAI('challenge')">⚔️ 让 AI 挑战 / 反驳我的判断</button>
    </div>
    ${aiStatusLine()}
    <div id="ai-result"></div>`;
  } else if (s.type === 'advice') {
    input = `<div id="advice-box">${adviceHTML(d)}</div>
      <div class="advice-actions">
        <button class="btn-mini" onclick="regenAdvice()">🔄 重新生成建议</button>
        <button class="btn-mini primary" onclick="answerAdvice()">照这个去做 →</button>
      </div>`;
  } else if (s.type === 'verdict') {
    input = `<div class="judge-group">
      <button id="j-valid" onclick="setVerdict('valid')">✅ 有效</button>
      <button id="j-wrong" onclick="setVerdict('wrong')">❌ 错了</button>
    </div>`;
  } else {
    let pre = d.answers[s.id] || '';
    if (s.type === 'template' && !pre) pre = problemTemplate(t);
    input = `<textarea id="step-input" placeholder="${esc(s.ph || '')}">${esc(pre)}</textarea>
      <button class="btn step-confirm" onclick="answerStep()">${d.answers[s.id] ? '更新这步' : '记下，继续 →'}</button>`;
  }
  return `<div class="turn current">
    <div class="turn-q"><span class="turn-n">${i + 1}</span><b>${s.label}</b> · ${esc(s.q)}</div>
    <div class="turn-hint">${esc(s.hint)}</div>
    ${input}
  </div>`;
}
/* 验证建议 HTML：用真实生成的，没有就本地模板 */
function adviceHTML(d) {
  if (d.advice) {
    const src = d.adviceSource === 'ai' ? 'AI 定制建议' : '本地模板建议';
    return `<div class="advice-list"><div class="advice-src">${src}</div>${d.advice.map(x => `<div class="advice-row">${esc(x)}</div>`).join('')}</div>`;
  }
  return `<div class="advice-list"><div class="advice-src">本地模板建议（填 Key 可让 AI 定制）</div>
    <div class="advice-row">① 最小动作：只做 1 次，5 分钟内能完成。</div>
    <div class="advice-row">② 提前写下你预期看到什么，避免事后找理由。</div>
    <div class="advice-row">③ 只观察一个信号：你定义的问题有没有被解决。</div>
    <div class="advice-row">④ 涉钱/安全/健康/法律：先查来源再下判断。</div></div>`;
}
function stepperHTML(cur) {
  const STEPS = ['捕捉', '定义', '协作', '验证', '进阶'];
  let h = '<div class="stepper">';
  STEPS.forEach((s, i) => {
    const n = i + 1;
    const cls = n < cur ? 'done' : (n === cur ? 'on' : '');
    h += `<span class="stp ${cls}">${s}</span>`;
    if (i < STEPS.length - 1) h += '<i class="stp-line"></i>';
  });
  return h + '</div>';
}
function qcardHTML(qs) {
  if (!qs || !qs.length) return '';
  return `<div class="qcard"><div class="qcard-title">这一步要回答的问题</div><ul class="qlist">${qs.map(q => `<li>${esc(q)}</li>`).join('')}</ul></div>`;
}
function aiStatusLine() {
  const s = DB.settings || {};
  if (s.aiKey) {
    const names = { deepseek: 'DeepSeek', openai: 'OpenAI', custom: '自定义' };
    return `<div class="ai-ready">✅ 你的 AI 已连接（${names[s.aiProvider] || '自定义'}）。M2 将在这里真正与你协作：理清 / 质疑 / 找证据。</div>`;
  }
  return `<div class="ai-note">🔑 还没填 AI Key？在首页右上角 ⚙️ AI 设置 里填一个，M2 就能真的和你一起想了。</div>`;
}
function prevStage() {
  if (curStage > 2) { const t = getCur(); if (t) { t.stagePointer = curStage - 1; save(); } curStage = curStage - 1; renderStage(); }
}
function toggleHelp() { const h = el('help-sheet'); if (h) h.classList.toggle('show'); }

/* ---------- 对话交互 ---------- */
let editIdx = -1;
function bindFlow(key, t, d) { editIdx = -1; }
function answerStep() {
  const t = getCur(); if (!t) return;
  const key = STAGES[curStage].key, flow = getFlow(key), d = ensureFlow(t, key);
  const s = flow.steps[d.progress]; if (!s) return;
  if (s.type === 'ai' || s.type === 'advice' || s.type === 'verdict') return; // 这些由专用函数推进
  const val = (el('step-input') && el('step-input').value || '').trim();
  if (val.length < 2) { toast('多写一点，至少几个字'); return; }
  d.answers[s.id] = val; d.progress++;
  if (key === 'verify' && s.id === 'test') d.risk = (d.risk === true);
  t.updatedAt = Date.now(); save(); renderStage();
}
function editTurn(i) {
  const t = getCur(); if (!t) return;
  const key = STAGES[curStage].key, d = ensureFlow(t, key);
  const delKeys = getFlow(key).steps.slice(i).map(s => s.id);
  delKeys.forEach(k => delete d.answers[k]); // 从这一步起后续回答作废，重新走
  d.progress = i; t.stageData[key] = d; save(); renderStage();
  el('stage-body').scrollTop = el('stage-body').scrollHeight;
}
function answerAdvice() {
  const t = getCur(); if (!t) return;
  const d = ensureFlow(t, 'verify');
  d.answers.advice = '已收到验证建议'; d.progress++; t.updatedAt = Date.now(); save(); renderStage();
}
function setVerdict(v) {
  const t = getCur(); if (!t) return;
  const key = STAGES[curStage].key, d = ensureFlow(t, key);
  d.answers.verdict = v; d.progress++; t.updatedAt = Date.now(); save(); renderStage();
}
/* AI 协作：有 Key 走真实 API，失败/无 Key 走本地模板；结果明确标注来源，不假装智能 */
async function runAI(mode) {
  const t = getCur(); if (!t) return;
  const d = ensureFlow(t, 'collab');
  const box = el('ai-result');
  if (box) box.innerHTML = `<div class="ai-loading">AI 正在${mode === 'challenge' ? '挑战你的判断' : '生成方案'}…</div>`;
  const a = d.answers || {};
  const problem = ((t.stageData.define || {}).answers || {}).problem || t.title || '';
  const ctx = `问题：${problem}\n我的方向：${a.direction || ''}\n我的理由：${a.reason || ''}`;
  const sys = mode === 'challenge'
    ? '你是思考教练。针对用户的方向和理由，给出2-3条尖锐但友善的反驳/质疑，逼他检视盲点。不要替他下结论。简洁，中文，每条不超过60字。'
    : '你是思考教练。基于用户的问题、方向和理由，给出一个具体可执行的完整方案，分3步，每步一句话。不要空话。中文，总共不超过150字。';
  const res = await callAI(sys, ctx);
  const text = res.ok ? res.text : localAI(mode, a, problem);
  const source = res.ok ? 'AI 实时生成' : (res.reason === 'nokey' ? '本地模板（未配置 Key）' : '本地模板（AI 不可用，已降级）');
  d.aiDraft = { mode: mode === 'challenge' ? 'AI 挑战' : 'AI 方案', text, source };
  t.updatedAt = Date.now(); save();
  if (box) box.innerHTML = `<div class="ai-result-card">
    <div class="ai-src">${source}</div>
    <div class="ai-text">${esc(text)}</div>
    <button class="btn step-confirm" onclick="answerAI()">采纳，继续 →</button>
  </div>`;
}
function answerAI() {
  const t = getCur(); if (!t) return;
  const d = ensureFlow(t, 'collab'); const draft = d.aiDraft || {};
  d.answers.ai = { mode: draft.mode || 'AI 协作', text: draft.text || '', source: draft.source || '' };
  d.progress++; save(); renderStage();
}
/* 生成验证建议（AI 或本地），写入 verify.answers.advice */
async function regenAdvice() {
  const t = getCur(); if (!t) return;
  const d = ensureFlow(t, 'verify');
  const problem = ((t.stageData.define || {}).answers || {}).problem || t.title || '';
  const solution = ((t.stageData.collab || {}).answers || {}).solution || '';
  const box = el('advice-box');
  if (box) box.innerHTML = `<div class="ai-loading">正在生成验证建议…</div>`;
  const res = await callAI('你是验证教练。针对用户的方案，给出3条具体的验证建议：最小动作、观察信号、判断标准。中文，每条不超过40字。', `问题：${problem}\n方案：${solution}`);
  if (res.ok) { d.advice = splitAdvice(res.text); d.adviceSource = 'ai'; }
  else { d.advice = localAdvice(problem, solution); d.adviceSource = 'local'; }
  save();
  if (box) box.innerHTML = adviceHTML(d);
}
/* 本地降级：明确是模板，不冒充 AI */
function localAI(mode, a, problem) {
  if (mode === 'challenge') {
    return `① 你的方向是「${(a.direction || '这个办法').slice(0, 20)}」——如果不做它，最坏会怎样？\n② 这个判断基于「${(a.reason || '你的理由').slice(0, 20)}」，依据可靠吗，还是只是猜测？\n③ 有没有一个人，和你情况相反却做成了？他怎么做？`;
  }
  return `① 针对「${problem.slice(0, 24)}」，先做一个 5 分钟内能完成的最小动作。\n② 动手前写下你预期看到什么。\n③ 做完只对照一个问题：它被解决了吗？`;
}
function localAdvice(problem, solution) {
  return [
    `① 最小动作：针对「${(solution || problem).slice(0, 22)}」，只做 1 次，5 分钟完成。`,
    '② 观察信号：动手前写下你预期看到什么，别事后找理由。',
    '③ 判断标准：只问一件事——你定义的问题有没有被解决。',
    '④ 涉钱/安全/健康/法律：先查来源再下判断。'
  ];
}
function splitAdvice(text) {
  return (text || '').split(/\n+/).map(x => x.trim()).filter(Boolean).slice(0, 5);
}
/* 真正调用用户自带的 Key（OpenAI 兼容协议）。无 Key / 失败返回结构化的失败原因。 */
async function callAI(system, user) {
  const s = DB.settings || {};
  if (!s.aiKey) return { ok:false, reason:'nokey' };
  const prov = s.aiProvider || 'deepseek';
  let url, model;
  if (prov === 'deepseek') { url = 'https://api.deepseek.com/chat/completions'; model = 'deepseek-chat'; }
  else if (prov === 'openai') { url = 'https://api.openai.com/v1/chat/completions'; model = 'gpt-4o-mini'; }
  else { url = (s.aiBase || '').replace(/\/$/, '') + '/chat/completions'; model = 'gpt-4o-mini'; }
  try {
    const r = await fetch(url, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + s.aiKey },
      body: JSON.stringify({ model, messages:[{role:'system',content:system},{role:'user',content:user}], temperature:0.7, max_tokens:500 })
    });
    if (!r.ok) return { ok:false, reason:'http_' + r.status };
    const j = await r.json();
    const txt = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!txt) return { ok:false, reason:'empty' };
    return { ok:true, text:String(txt).trim() };
  } catch (e) { return { ok:false, reason:'network_or_cors' }; }
}

/* 小结：直接汇总对话各回合的答案，不再依赖表单字段 */
function summaryHTML(t, key) {
  const d = (t.stageData && t.stageData[key]) || {};
  const a = d.answers || {};
  const flow = getFlow(key);
  if (!flow) return '';
  const pairs = flow.steps.filter(s => a[s.id]).map(s => {
    let v = a[s.id];
    if (s.type === 'ai') v = (v.mode || '') + '：' + (v.text || '').slice(0, 80);
    if (s.type === 'verdict') v = v === 'valid' ? '✅ 有效' : '❌ 错了';
    if (s.type === 'advice') v = '已收到验证建议';
    return `<div class="sc-row"><b>${s.label.replace(/^[①②③④⑤]\s*/, '')}：</b>${esc(v)}</div>`;
  });
  if (!pairs.length) return '<div class="sc-title">这一步的小结</div><div class="sc-row" style="color:var(--muted)">跟着对话回答，这里会自动汇总</div>';
  return `<div class="sc-title">这一步的小结</div>${pairs.join('')}`;
}
/* 门禁：本环节对话走完才允许下一步；验证环节高风险需贴来源 */
function updateGate(done, key) {
  const nb = el('next-btn'); const hint = el('next-hint'); if (!nb) return;
  const t = getCur(); const d = t ? ensureFlow(t, key) : {};
  const flow = getFlow(key) || { steps:[] };
  const complete = done !== undefined ? done : (d.progress >= flow.steps.length);
  const needSource = key === 'verify' && d.risk === true && !(d.source || '').trim();
  nb.disabled = !complete || needSource;
  if (hint) {
    if (!complete) hint.textContent = `还有 ${Math.max(0, flow.steps.length - (d.progress || 0))} 个问题没答完`;
    else if (needSource) hint.textContent = '这条涉及风险，先在对话里补一个来源再收尾';
    else hint.textContent = '';
  }
}
/* 高风险标记：协作阶段问一句，写进 verify，供验证阶段门禁使用 */
function riskZoneHTML(t, stageKey) {
  const vd = ensureFlow(t, 'verify');
  return `<label class="risk-check"><input type="checkbox" ${vd.risk ? 'checked' : ''} onchange="setRisk(this.checked)"/> 这条涉及 钱 / 安全 / 健康 / 法律？</label>`
    + (stageKey === 'verify' && vd.risk
       ? `<div class="source-row"><div class="st-hint">高风险：验证前必须核对来源</div><input id="f-source" class="src-input" placeholder="贴来源链接或资料" value="${esc(vd.source || '')}" oninput="setSource(this.value)"/></div>`
       : '');
}
function setRisk(v) {
  const t = getCur(); if (!t) return;
  ensureFlow(t, 'verify').risk = (v === true || v === 'true'); save();
  const zone = el('risk-zone'); if (zone) zone.innerHTML = riskZoneHTML(t, STAGES[curStage].key);
  toast((v === true || v === 'true') ? '已标记高风险，验证时需查来源' : '已取消风险标记');
  updateGate(undefined, STAGES[curStage].key);
}
function setSource(v) {
  const t = getCur(); if (!t) return;
  const d = ensureFlow(t, 'verify'); d.source = v; save();
  updateGate(undefined, 'verify');
}
function nextStage() {
  const t = getCur(); if (!t) return;
  const key = STAGES[curStage].key, d = ensureFlow(t, key), flow = getFlow(key);
  if (d.progress < flow.steps.length) { toast('先把这段对话走完'); return; }
  if (key === 'verify' && d.risk === true && !(d.source || '').trim()) { toast('这条涉及风险，先补来源'); return; }
  if (curStage < 5) { t.stagePointer = curStage + 1; curStage = curStage + 1; save(); renderStage(); }
  else { t.status = 'done'; t.stagePointer = 5; save(); goHome(); toast('收尾啦 🎉'); }
}
function saveDraft() {
  if (!curThreadId) { toast('没有可保存的内容'); return; }
  const inp = el('step-input');
  if (inp && inp.value.trim()) { // 把当前正在写、未确认的半句也存下来
    const key = STAGES[curStage].key, d = ensureFlow(getCur(), key), s = getFlow(key).steps[d.progress];
    if (s) d.answers[s.id] = inp.value.trim();
  }
  save(); toast('已存草稿 💾');
}

/* ---------- 我的成长 ---------- */
function setName() {
  const v = el('name-field').value.trim(); if (!v) { toast('先写名字'); return; }
  DB.user.name = v; save();
  el('name-card').style.display = 'none'; renderGreet();
}
function renderGreet() {
  const g = el('mine-greet');
  if (DB.user.name) {
    g.innerHTML = `<div><span class="g-name">你好，${esc(DB.user.name)}</span> 👋</div>
      <div class="g-sub">本周我来帮助你练习思维肌肉 💪</div>`;
  } else g.innerHTML = '';
}
function renderMine() {
  renderGreet();
  el('name-card').style.display = DB.user.name ? 'none' : 'block';
  const threads = DB.threads;
  const total = threads.length;
  const hasA = (t, key, id) => !!(t.stageData && t.stageData[key] && t.stageData[key].answers && t.stageData[key].answers[id]);
  const defined = threads.filter(t => hasA(t, 'define', 'problem')).length;
  const verified = threads.filter(t => hasA(t, 'verify', 'result')).length;
  const judged = threads.filter(t => hasA(t, 'collab', 'direction')).length;
  const risk = threads.filter(t => t.stageData && t.stageData.verify && t.stageData.verify.risk).length;
  const score = Math.min(100, total * 10 + defined * 15 + verified * 20);
  el('ring-num').textContent = score;
  el('grow-label').textContent = total ? '思维肌肉 · 成长中' : '思维肌肉';
  el('grow-sub').textContent = total ? `发现 ${total} · 定义 ${defined} · 验证 ${verified}` : '先去记下你的第一条探索吧';
  const disc = Math.min(100, total * 12);
  const def = total ? Math.round(defined / total * 100) : 0;
  const ver = total ? Math.round(verified / total * 100) : 0;
  const cal = total ? Math.round(judged / total * 100) : 0;
  el('radar-svg').innerHTML = drawRadar([disc, def, ver, cal]);
  const weak = Math.min(disc, def, ver, cal);
  el('radar-note').textContent = total ? `最弱项已用橙色标出，优先练 💪（当前最弱 ${weak}）` : '记几条探索后，这里会画出你的能力雷达';
  const jl = el('judgment-list');
  if (!total) { jl.innerHTML = '还没有记录。<br>每次你“先写下自己的判断”，都会变成长期资产 📌'; }
  else {
    let h = `<div class="sc-row">📌 你已写下 <b>${judged}</b> 条自己的判断（先判再看）</div>`;
    h += `<div class="sc-row">📌 你已验证 <b>${verified}</b> 条，记录了有效 / 错误</div>`;
    if (risk) h += `<div class="sc-row">📌 你有 <b>${risk}</b> 条涉及风险——记得都查了来源吗？</div>`;
    h += `<div class="sc-row" style="color:var(--muted)">这些“为什么这样选”的积累，是长期最值钱的东西。</div>`;
    jl.innerHTML = h;
  }
}
function drawRadar(vals) {
  const cx = 130, cy = 105, R = 78;
  const angles = [-90, 0, 90, 180].map(a => a * Math.PI / 180);
  const pt = (i, r) => [cx + Math.cos(angles[i]) * r, cy + Math.sin(angles[i]) * r];
  let grid = '';
  [0.25, 0.5, 0.75, 1].forEach(f => {
    const p = vals.map((_, i) => pt(i, R * f).map(n => n.toFixed(1)).join(','));
    grid += `<polygon points="${p.join(' ')}" fill="none" stroke="#e7ece9" stroke-width="1"/>`;
  });
  let axes = '';
  vals.forEach((_, i) => { const [x, y] = pt(i, R); axes += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#e7ece9" stroke-width="1"/>`; });
  const datap = vals.map((v, i) => pt(i, R * v / 100).map(n => n.toFixed(1)).join(','));
  const dataPoly = `<polygon points="${datap.join(' ')}" fill="rgba(14,107,80,.18)" stroke="#0E6B50" stroke-width="2"/>`;
  const weak = vals.indexOf(Math.min(...vals));
  const labels = [
    { t: `🔍 发现 ${vals[0]}`, pos: pt(0, R + 18) },
    { t: `💡 定义 ${vals[1]}`, pos: pt(1, R + 18) },
    { t: `🧪 验证 ${vals[2]}`, pos: pt(2, R + 18) },
    { t: `🎯 校准 ${vals[3]}`, pos: pt(3, R + 18) }
  ];
  let labs = '';
  labels.forEach((l, i) => {
    const anchor = i === 1 ? 'start' : i === 3 ? 'end' : 'middle';
    const dy = i === 0 ? -4 : i === 2 ? 14 : 4;
    const col = i === weak ? '#FF8A5B' : '#1c2b25';
    labs += `<text x="${l.pos[0].toFixed(1)}" y="${(l.pos[1] + dy).toFixed(1)}" text-anchor="${anchor}" font-size="12" font-weight="700" fill="${col}" stroke="#fff" stroke-width="3" paint-order="stroke">${l.t}</text>`;
  });
  return `<svg viewBox="-10 0 280 220" width="100%" style="display:block;">${grid}${axes}${dataPoly}${labs}</svg>`;
}

/* ---------- 启动 ---------- */
function init() {
  renderAbout();
  renderHomeThreads();
  updateAiBtn();
  if (!DB.user.ageConfirmed) el('age-gate').classList.add('active');
  else { el('age-gate').classList.remove('active'); restartAbout(); }
}
init();
