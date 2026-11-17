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
  return { user: { name: null, isMinor: false, guardianPhone: '', consent: false, ageConfirmed: false, aboutClosed: false }, threads: [], settings: {} };
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
  ensureExamples(t);   /* 捕捉后一次性生成全部阶段的主题示例（无 Key/失败自动跳过） */
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
  box.style.display = DB.user.aboutClosed ? 'none' : '';
  const s = ABOUT_SLIDES[aboutIdx];
  box.innerHTML = `
    <button class="ab-close" title="收起介绍" onclick="event.stopPropagation();closeAbout()">×</button>
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
function restartAbout() { if (DB.user.aboutClosed) return; clearInterval(aboutTimer); aboutTimer = setInterval(() => aboutGo(aboutIdx + 1), 4200); }
function closeAbout() {
  DB.user.aboutClosed = true; save();
  clearInterval(aboutTimer);
  const box = el('about-card'); if (box) box.style.display = 'none';
  toast('已收起，可在「我的」里重新打开');
}
function reopenAbout() {
  DB.user.aboutClosed = false; save();
  aboutIdx = 0; renderAbout(); restartAbout();
  go('s-home');
  toast('介绍已重新显示 🌿');
}

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
      ${t.status === 'done' ? `<button class="dl-btn" title="下载探索卡" onclick="event.stopPropagation();exportCard('${t.id}')">📥</button>` : ''}
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
  ensureExamples(t);   /* 捕捉时无 Key、后来才填的补救：首次进入阶段时补生成 */
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
  5: { key:'improve', label:'进阶 · 第5步/共5', why:'看见自己练到了什么，再挑一个下次能改的点。',
       nextLabel:'完成这一趟 →' }
};
/* 每个环节的对话脚本。type: text 普通输入 / template 汇总填空 / ai AI 协作 / advice 验证建议 / verdict 二选一 */
const FLOWS = {
  define: { intro:'跟着下面的问题走。只写观察到的事实，不写解释、不着急下结论。', steps:[
    { id:'now', label:'现状', q:'现在实际发生的是什么？', hint:'一句话。只写你观察到的事实，不写解释。', ph:'例：课间大家都低头刷手机，几乎没人说话' },
    { id:'std', label:'标准', q:'本来应该是什么样？', hint:'参照可以是自己的期望、岗位要求、常识基准，或你认可的某个做法。', ph:'例：我希望课间能有人说说话' },
    { id:'gap', label:'差距', q:'现状与标准之间，具体差在哪？', hint:'只写一个最关键的差距，不要罗列。', ph:'例：大家宁愿刷手机也不愿开口' },
    { id:'cost', label:'后果', q:'这个差距造成了什么可识别的后果？不解决会怎样？', hint:'要具体，不能是“不好”“难受”。', ph:'例：一学期下来我没交到什么新朋友' },
    { id:'problem', label:'问题定义', q:'把前四步压缩成一句可验证的问题定义。', hint:'系统已按你的前四步归纳好一句，可直接用，也可以改。最后那个问题要能通过行动验证。', ph:'', type:'template' }
  ]},
  collab: { intro:'先给方向、再说理由。然后选 AI 怎么帮你：出完整方案，或专门挑你判断的毛病。', steps:[
    { id:'direction', label:'你的方向', q:'针对这个问题，你倾向怎么解决？', hint:'先给一个方向，不用完美。AI 一会儿会帮你，也可能反驳你。', ph:'例：我想在课间主动找人聊一句' },
    { id:'reason', label:'你的理由', q:'为什么是这个方向？你依据什么？', hint:'依据可以是你的经验、常识，或你查过的东西。', ph:'例：因为不主动就永远没人先找我' },
    { id:'ai', label:'AI 协作', q:'让 AI 帮你推进这一步', hint:'选一种协作方式——它会基于你的问题、方向和理由来回应。', type:'ai' },
    { id:'solution', label:'最终方案', q:'把你的判断和 AI 的反馈，合成一个方案。', hint:'这是你认可的方案，下一步就去验证它。', ph:'例：下周挑 3 天，课间主动跟旁边的人说一句话' }
  ]},
  verify: { intro:'先给你一份验证建议。照着做一次最小测试，记下真实发生的事，再回头修订。', steps:[
    { id:'advice', label:'验证建议', q:'这样验证你的方案', hint:'这是针对"你定义的问题"和"你构建的方案"生成的具体测试：去做什么、看什么信号、怎么判断对错。照着做一次即可。', type:'advice' },
    { id:'test', label:'原型测试', q:'在这个建议下，你具体做了什么？', hint:'一个最小动作 / 一个粗糙原型，写具体做了啥。', ph:'例：周二课间主动跟同桌说了“昨天那题你会吗”' },
    { id:'result', label:'实际结果', q:'真实发生了什么？', hint:'写观察到的事实，不写“感觉还行”。', ph:'例：他愣了一下，跟我聊了两分钟' },
    { id:'verdict', label:'判断', q:'你的判断：有效，还是错了？', hint:'对照你要解决的问题——它被解决了吗？', type:'verdict' },
    { id:'revision', label:'修订', q:'根据结果，怎么修订你的判断或方案？', hint:'这一步会更新你前面整段对话，让它更接近真相。', ph:'例：直接问问题有用，下次可以从共同话题切入' }
  ]},
  improve: { intro:'先看看这一趟你练到了什么，再挑一个下次能改的点。', steps:[
    { id:'note', label:'下次试一点', q:'下次，你最想改进这一步的哪里？', hint:'挑一个点就够。', ph:'例：定义时“后果”写得太笼统，下次要写具体数字' }
  ]}
};
function getFlow(key){ return FLOWS[key]; }

/* ---------- 主题相关示例：捕捉后一次性生成全部输入步骤的示例句 ----------
   无 Key / 失败一律保持 FLOWS 里的固定示例(s.ph)，不打扰用户。 */
const EXAMPLE_IDS = ['now','std','gap','cost','direction','reason','solution','test','result','revision','note'];
const EXAMPLE_HINTS = {
  now:'现在实际发生的事实', std:'本来应该的样子', gap:'最关键的一处差距',
  cost:'具体可识别的后果', direction:'你倾向的解决方向', reason:'你选这个方向的依据',
  solution:'你认可的最终方案', test:'你具体做的最小动作', result:'真实观察到的事实',
  revision:'根据结果怎么修订判断', note:'下次最想改进的一点'
};
/* 兼容：整段 JSON / ```json 围栏 / 每行 "id": "值" / id：值 / 中英文逗号 */
function parseExamples(raw, ids) {
  const out = {};
  if (!raw) return out;
  let text = String(raw).replace(/```(?:json)?/gi, '').trim();
  try {
    const j = JSON.parse(text);
    if (j && typeof j === 'object' && !Array.isArray(j)) {
      ids.forEach(k => { if (typeof j[k] === 'string' && j[k].trim()) out[k] = j[k].trim().slice(0, 60); });
      if (Object.keys(out).length >= 2) return out;
    }
  } catch (e) {}
  text.split(/\r?\n/).forEach(line => {
    const m = line.match(/["']?([a-zA-Z]{2,12})["']?\s*[:：]\s*["']?(.+?)["']?\s*[,，]?\s*$/);
    if (m && ids.includes(m[1]) && m[2] && m[2] !== 'null')
      out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '').slice(0, 60);
  });
  return out;
}
async function ensureExamples(t, force) {
  if (!t || (!force && (t.examples || t.examplesTried))) return;
  const s = DB.settings || {};
  if (!s.aiKey) return;                       /* 无 Key：保持固定示例，且不标记 tried（日后填了 Key 可补生成） */
  t.examplesTried = true; save();             /* 有 Key 就记为已尝试，失败也不反复调 AI */
  const topic = shortPhrase(t.raw || t.title || '', 60);
  const fieldLines = EXAMPLE_IDS.map(id =>
    `"${id}": 一条贴合「${topic}」这个主题的示例句（写${EXAMPLE_HINTS[id]}；只示范角度和颗粒度，绝不替用户下结论、不把答案写满；≤28字，口语、具体）`
  ).join('\n');
  const sys = '你是青少年思维训练器的示例文案助手。为每个字段写一条简短示例，帮学生明白"这一格该填什么"。硬规则：①示例必须贴合给定主题的具体场景，绝不用与主题无关的套话；②只示范"写什么角度、写到多具体"，绝不替用户把结论、方案、判断写出来——这是思维训练，示例一旦把答案说透就毁了训练；③每条不超过28字，口语、具体、可观察；④只输出一个 JSON 对象，key 用我给的字段名，每行一个，不要解释、不要代码块标记。';
  const res = await callAI(sys, '主题：' + (t.raw || t.title || '') + '\n\n字段：\n' + fieldLines, 1000);
  if (!res.ok) return;                        /* 失败：静默保持固定示例 */
  const parsed = parseExamples(res.text, EXAMPLE_IDS);
  const got = Object.keys(parsed).length;
  if (!got) return;
  /* 没返回的字段沿用旧示例或固定示例，不整批丢弃 */
  t.examples = Object.assign({}, t.examples || {}, parsed);
  t.examplesSrc = 'ai'; save();
  refreshPlaceholder();
}
function exampleFor(t, s) {
  return (t.examples && t.examples[s.id]) || s.ph || '';
}
function refreshPlaceholder() {
  const input = el('step-input'); const t = getCur();
  if (!input || !t || curStage === null) return;
  const m = STAGES[curStage]; if (!m) return;
  const d = ensureFlow(t, m.key);
  const s = (FLOWS[m.key].steps || [])[d.progress];
  if (s) input.placeholder = exampleFor(t, s);
}
async function regenExamples() {
  const t = getCur(); if (!t) return;
  const s = DB.settings || {};
  if (!s.aiKey) { toast('在右上角 ⚙️ AI 设置里填 Key，才能生成贴合你主题的例子'); return; }
  const btn = el('ex-regen-btn'); if (btn) { btn.disabled = true; btn.textContent = '正在换…'; }
  await ensureExamples(t, true);
  if (btn) { btn.disabled = false; btn.textContent = '↻ 换个贴合我的例子'; }
}

/* 问题定义的 AI 归纳：把四步真实答案浓缩成一句"能被行动验证"的问题，替代机械套模板 */
async function ensureProblemAI(t, force) {
  if (!t) return;
  const d = ensureFlow(t, 'define');
  if (!force && d.problemAi) return;
  const s = DB.settings || {};
  if (!s.aiKey) return;                       /* 无 Key：保持本地归纳 */
  const a = d.answers;
  const ctx = `现状：${a.now || ''}\n标准：${a.std || ''}\n差距：${a.gap || ''}\n后果：${a.cost || ''}`;
  const sys = '你是问题定义教练。把学生填的现状/标准/差距/后果，浓缩成一句"能被一个小行动验证"的问题。硬要求：①是一句问句或可验证的陈述，不是口号、不是"如何消除X让Y成为现实"这种套话；②聚焦差距背后的真实原因或可检验的关系，具体、能动手查；③30字以内；④中文，只输出这一句，不要引号、不要解释。';
  const res = await callAI(sys, ctx, 300);
  if (!res.ok) return;
  let q = res.text.replace(/[「」"'\s]/g, '').split(/\n/)[0].trim().slice(0, 40);
  if (!q || isBlankConclusion(q)) return;
  d.problemAi = q; t.updatedAt = Date.now(); save();
  const ta = el('step-input');
  if (ta && !d.answers.problemAsk) ta.value = q;  /* 用户已改写就不覆盖 */
  updateProblemHero();                            /* 就地刷新凸显卡的结论 */
}
async function regenProblemAI() {
  const t = getCur(); if (!t) return;
  const s = DB.settings || {};
  if (!s.aiKey) { toast('在右上角 ⚙️ AI 设置里填 Key，才能让 AI 归纳问题'); return; }
  const btn = el('problem-ai-btn'); if (btn) { btn.disabled = true; btn.textContent = 'AI 归纳中…'; }
  await ensureProblemAI(t, true);
  if (btn) { btn.disabled = false; btn.textContent = '✨ 让 AI 归纳得更准'; }
}

/* 初始化/补全某环节的对话状态 */
function ensureFlow(t, key) {
  t.stageData = t.stageData || {};
  const d = t.stageData[key] || {};
  if (!d.answers) d.answers = {};
  if (typeof d.progress !== 'number') d.progress = 0;
  t.stageData[key] = d;
  return d;
}
/* ---------- 问题定义：严格按“现状/标准/差距/导致/所以”格式，逐项重建，绝不留空 ---------- */
function shortPhrase(s, n) { s = (s || '').trim(); return s.length > n ? s.slice(0, n) + '…' : s; }
/* 本地归纳兜底（无 Key 时）：聚焦具体差距、写成能用行动验证的问句，不再套"让X成为现实" */
function problemInduction(a) {
  const gap = (a.gap || '').trim(), std = (a.std || '').trim(), now = (a.now || '').trim();
  const core = gap || now;
  if (!core && !std) return '（先完成前面四步，这里会自动归纳）';
  if (core) return `为什么「${shortPhrase(core, 26)}」？我能不能用一个小动作验证真正的原因`;
  return `怎么才能做到「${shortPhrase(std, 28)}」？我能不能验证它真的可行`;
}
/* 从一段文字里提取"需要解决的问题"：兼容完整模板、用户直接写的问题句 */
function extractAsk(s) {
  s = (s || '').trim();
  const m = s.match(/所以我需要解决的问题是[：:]?\s*(.*)$/);
  if (m) return m[1].trim();
  if (!isBlankConclusion(s) && !/^(现状|标准是|差距在|导致)/.test(s)) return s;
  return '';
}
/* 判断结论是不是“空 / 下划线 / 旧模板残留”——这类必须重新归纳 */
function isBlankConclusion(x) {
  if (!x) return true;
  const s = String(x).trim();
  return /^[___—\-—。.\s]*$/.test(s) || /(^|[：:])[\s_]*$/.test(s) || s === '___' || /_{2,}/.test(s) || /（.*自动归纳.*）/.test(s);
}
/* 从 define 四步的真实答案重建完整问题定义。old stored problem 里的下划线会被替换。 */
function problemBuild(t) {
  const a = ((t.stageData || {}).define || {}).answers || {};
  const now = (a.now || '').trim() || '（未填现状）';
  const std = (a.std || '').trim() || '（未填标准）';
  const gap = (a.gap || '').trim() || '（未填差距）';
  const cost = (a.cost || '').trim() || '（未填后果）';
  /* 优先级：用户修订(problemAsk) > AI 归纳(problemAi) > 用户原始输入(extractAsk) > 本地归纳 */
  let ask = '';
  const edited = (a.problemAsk || '').trim();
  if (!isBlankConclusion(edited)) ask = extractAsk(edited) || edited;
  if (isBlankConclusion(ask)) {
    const ai = (a.problemAi || '').trim();
    if (!isBlankConclusion(ai)) ask = extractAsk(ai) || ai;
  }
  if (isBlankConclusion(ask)) ask = extractAsk((a.problem || '').trim());
  if (isBlankConclusion(ask)) ask = problemInduction(a);
  ask = ask.replace(/[。．]+$/, '');
  return { now, std, gap, cost, ask,
    full: `现状${now}，标准是${std}，差距在${gap}，导致${cost}，所以我需要解决的问题是${ask}。` };
}
function problemTemplate(t) { return problemBuild(t).full; }
/* ---------- 进阶：基于真实数据的成长反馈 ---------- */
function threadReview(t) {
  const d = t.stageData || {};
  const da = (d.define || {}).answers || {};
  const ca = (d.collab || {}).answers || {};
  const va = (d.verify || {}).answers || {};
  const vd = d.verify || {};
  const trained = [], watch = [];
  if (t.raw) trained.push('发现：把一个真实的困惑抓住并记了下来');
  if (da.problem) trained.push('定义：用“现状—标准—差距—后果”压出一句可验证的问题');
  if (ca.direction && ca.reason) trained.push('判断：在 AI 介入前，先说清自己的方向和理由');
  if (ca.ai) trained.push('协作：借 AI 拿到了方案或反驳，再合成自己的决定');
  if (va.test && va.result) trained.push('验证：用一个最小动作拿到了真实结果');
  if (va.verdict) trained.push('校准：' + (va.verdict === 'valid' ? '判断被现实确认' : '敢承认判断错了，并据此修订'));
  if (vd.risk && vd.source) trained.push('风险意识：涉钱/安全/健康/法律，先核对了来源');
  if (!trained.length) trained.push('你迈出了第一步——把“不对劲”记了下来');
  if (!da.problem) watch.push('这次没走完问题定义，下次试把它压成一句话');
  if (/\b(不好|难受|不行|奇怪)\b/.test(da.cost || '')) watch.push('“后果”还可以更具体——具体到你看见了什么');
  if (!ca.direction) watch.push('下次先写你自己的判断，再看 AI 怎么说');
  if (vd.risk && !vd.source) watch.push('高风险问题，验证前记得先查一个来源');
  if (va.verdict === 'wrong') watch.push('这次判断偏了——回头看，是哪一步的依据不够实');
  if (!watch.length) watch.push('这次每一步都到位了，下次可以挑战一个更难的问题');
  return { trained, watch };
}
function reviewHTML(t) {
  const r = threadReview(t);
  const im = t.stageData.improve || {};
  const ai = im.aiReview
    ? `<div class="rv-ai"><div class="rv-ai-src">${esc(im.aiReviewSource || 'AI 深化')}</div><div class="rv-ai-text">${esc(im.aiReview)}</div></div>`
    : '';
  const aiBtn = `<button class="btn-mini" id="rv-ai-btn" onclick="deepenReview()">✨ 让 AI 点评这一趟</button>`;
  return `<div class="review-card">
    <div class="rv-head"><span class="rv-badge">这一趟，你练到了</span>${aiBtn}</div>
    <div class="rv-block">${r.trained.map(x => `<div class="rv-row"><b>✓</b>${esc(x)}</div>`).join('')}</div>
    <div class="rv-watch-title">下次留意</div>
    <div class="rv-watch">${r.watch.map(x => `<div class="rv-row"><b>→</b>${esc(x)}</div>`).join('')}</div>
    ${ai}
  </div>`;
}
async function deepenReview() {
  const t = getCur(); if (!t) return;
  const s = DB.settings || {};
  if (!s.aiKey) { toast('在首页右上角 ⚙️ AI 设置里填 Key，可让 AI 点评'); return; }
  const r = threadReview(t);
  const btn = el('rv-ai-btn'); if (btn) { btn.disabled = true; btn.textContent = 'AI 正在点评…'; }
  const ctx = `捕捉：${(t.raw || '').slice(0, 80)}\n练到的能力：${r.trained.join('；')}\n下次留意：${r.watch.join('；')}`;
  const res = await callAI('你是青少年思维教练。针对学生这次“发现问题—定义—验证”的练习，写一段50-90字的点评：先肯定他真正练到的能力，再给一个具体、可操作的下次建议。温暖、像同盟者，不说教、不用口号。中文。', ctx);
  const im = ensureFlow(t, 'improve');
  if (res.ok) { im.aiReview = res.text; im.aiReviewSource = 'AI 点评'; }
  else { im.aiReview = localReview(r); im.aiReviewSource = '本地模板（AI 不可用，已降级）'; }
  save();
  const host = el('review-slot'); if (host) host.innerHTML = reviewHTML(t);
  else toast('点评已生成');
}
function localReview(r) {
  return `你已经把「${(r.trained[0] || '发现困惑').replace(/^[^：]+：/, '')}」练成了习惯，这是最难的起点。${r.watch[0] || ''}下次就试这一件，不用多。`;
}
/* 字段内的每个逗号后断行（仅用于现状/标准/差距/后果四步） */
function phValue(v) {
  return String(v).split(/[，,]/).map(s => s.trim()).filter(Boolean).map(s => phText(s)).join('<br>');
}
/* 结论整句连续显示：把收尾标点与前字绑在一起，杜绝「」被甩到下一行 */
function phText(v) {
  return esc(String(v || '').trim())
    .replace(/([\u4e00-\u9fa5a-zA-Z0-9])([」』”"）)\]】])/g, '$1\u2060$2')
    .replace(/([「『“"（\[【])([\u4e00-\u9fa5a-zA-Z0-9])/g, '$1\u2060$2');
}
function problemHeroHTML(t, askOverride) {
  const p = problemBuild(t);
  const ask = (askOverride && askOverride.trim()) ? askOverride.trim() : p.ask;
  /* 前四步按逗号断行；结论是一句完整的话，自然换行不拆段 */
  return `<div class="problem-hero">
    <div class="ph-label">你的问题定义</div>
    <div class="ph-line"><span class="ph-k k-now">现状</span><span class="ph-v">${phValue(p.now)}</span></div>
    <div class="ph-line"><span class="ph-k k-std">标准是</span><span class="ph-v">${phValue(p.std)}</span></div>
    <div class="ph-line"><span class="ph-k k-gap">差距在</span><span class="ph-v">${phValue(p.gap)}</span></div>
    <div class="ph-line"><span class="ph-k k-cost">导致</span><span class="ph-v">${phValue(p.cost)}</span></div>
    <div class="ph-conclusion">
      <div class="ph-conclusion-k">所以我需要解决的问题是</div>
      <div class="ph-conclusion-v">${phText(ask)}</div>
    </div>
  </div>`;
}
function updateProblemHero() {
  const box = el('problem-hero');
  const ta = el('step-input');
  const typed = ta ? ta.value : '';
  if (box) box.innerHTML = problemHeroHTML(getCur(), typed);
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
  /* 进阶屏：先给真实成长反馈，再让用户写一个改进点；走完显示完成卡 */
  if (key === 'improve') {
    body += `<div id="review-slot">${reviewHTML(t)}</div>`;
    if (t.status === 'done') body += finishCardHTML(t);
  }
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
  /* 随时收尾出口：不是每条探索都要走到最后。定义清楚就可以停。 */
  const exitBar = `<div class="exit-bar">
    <span>想清楚了就可以停，不必每条都走完</span>
    <div class="exit-btns">
      <button class="exit-btn" onclick="finishThread('archived')">📦 先存着</button>
      <button class="exit-btn" onclick="finishThread('dropped')">🚫 放下</button>
    </div>
  </div>`;
  if (t.status === 'done') {
    /* 已完成：保留回退修订入口，避免走完就被锁死 */
    el('stage-footer').innerHTML = `<div class="foot-row">
      <button class="next-btn ghost" onclick="reopenForEdit()">‹ 回去修订</button>
      <button class="next-btn coral" onclick="exportCard('${t.id}',true)">📥 再存一张卡</button>
    </div>
    <div class="foot-row" style="margin-top:8px;"><button class="next-btn ghost" onclick="goHome()">← 回到首页</button></div>`;
  } else {
    el('stage-footer').innerHTML = `<div class="foot-row">${prevBtn}<button class="next-btn ${curStage === 5 ? 'coral' : ''}" id="next-btn" onclick="nextStage()">${m.nextLabel}</button></div><div class="next-hint" id="next-hint"></div>${exitBar}`;
  }
  el('chrome-prev').style.display = curStage > 2 ? 'block' : 'none';
  bindFlow(key, t, d);
  updateGate(done, key);
  /* 走到"问题定义"这一步时，有 Key 就 Async 归纳一句更准的问题（幂等，已有则不重复） */
  if (key === 'define' && (flow.steps[d.progress] || {}).type === 'template') ensureProblemAI(t);
  /* 进入验证阶段即按"你定义的问题+你构建的方案"生成可执行的测试建议 */
  if (key === 'verify' && (flow.steps[d.progress] || {}).type === 'advice') ensureAdvice();
}
/* 已回答的回合（可点“改”回到该步） */
function answeredTurn(i, s, ans, key) {
  let a = ans;
  if (s.type === 'ai') a = (ans.mode ? '【' + ans.mode + '】' : '') + (ans.text || '').slice(0, 120);
  if (s.type === 'verdict') a = ans === 'valid' ? '✅ 有效' : '❌ 错了';
  if (s.type === 'advice') a = '已收到验证建议（可重新生成）';
  /* 问题定义：用凸显卡，从四步真实数据重建（自动修复旧数据的下划线） */
  const body = s.type === 'template' ? problemHeroHTML(getCur()) : `<div class="turn-a">${esc(a || '')}</div>`;
  return `<div class="turn done">
    <div class="turn-q"><span class="turn-n">${i + 1}</span><b>${s.label}</b> · ${esc(s.q)}</div>
    ${body}
    <button class="turn-edit" onclick="editTurn(${i})">改 ✎</button>
  </div>`;
}
/* 当前回合：输入框 / AI 选择 / 验证建议 / 判断 */
function currentTurn(i, s, d, t, key) {
  let input = '';
  if (s.type === 'ai') {
    const draft = d.aiDraft || {};
    if (!draft.challenge && !draft.plan) {
      input = `<div class="ai-choices">
        <button class="ai-choice" onclick="runAICollab()">⚔️ 开始协作：先挑战我的判断，再给方案 →</button>
      </div>
      ${aiStatusLine()}
      <div id="ai-result"></div>`;
    } else {
      input = `<div id="ai-result">${aiCollabResultHTML(draft)}</div>`;
    }
  } else if (s.type === 'advice') {
    input = `<div id="advice-box">${adviceHTML(d)}</div>
      <div class="advice-actions">
        <button class="btn-mini" onclick="regenAdvice(true)">🔄 重新生成建议</button>
        <button class="btn-mini primary" onclick="answerAdvice()">照这个去做 →</button>
      </div>`;
  } else if (s.type === 'verdict') {
    input = `<div class="judge-group">
      <button id="j-valid" onclick="setVerdict('valid')">✅ 有效</button>
      <button id="j-wrong" onclick="setVerdict('wrong')">❌ 错了</button>
    </div>`;
  } else {
    let pre = d.answers[s.id] || '';
    if (s.type === 'template') pre = problemBuild(t).ask; // 输入框只放"那句问题"，可直接改写
    const hero = s.type === 'template' ? `<div id="problem-hero">${problemHeroHTML(t)}</div>` : '';
    const onIn = s.type === 'template' ? ' oninput="updateProblemHero()"' : '';
    const isProblem = s.type === 'template';
    const aiBtn = isProblem ? `<button class="ex-regen" id="problem-ai-btn" onclick="regenProblemAI()">✨ 让 AI 归纳得更准</button>` : '';
    const regenLink = (t.examples && t.examples[s.id] && !isProblem)
      ? `<button class="ex-regen" id="ex-regen-btn" onclick="regenExamples()">↻ 换个贴合我的例子</button>` : '';
    const editHint = isProblem ? `<div class="problem-edit-tip">上面是完整定义。这里只改最后那句"需要解决的问题"，也可以直接让 AI 重新归纳。</div>` : '';
    input = `${hero}${editHint}<textarea id="step-input"${onIn} placeholder="${esc(exampleFor(t, s))}">${esc(pre)}</textarea>
      ${aiBtn}${regenLink}
      <button class="btn step-confirm" onclick="answerStep()">${d.answers[s.id] ? '更新这步' : '记下，继续 →'}</button>`;
  }
  return `<div class="turn current">
    <span class="now-tag">现在轮到你</span>
    <div class="turn-q"><span class="turn-n">${i + 1}</span><b>${s.label}</b> · ${esc(s.q)}</div>
    <div class="turn-hint">${esc(s.hint)}</div>
    ${input}
  </div>`;
}
/* 验证建议 HTML：用真实生成的，没有就本地模板 */
function adviceHTML(d) {
  if (d.advice) {
    const src = d.adviceSource === 'ai' ? 'AI 针对你的问题和方案定制' : '本地模板（已填入你的问题和方案 · 填 Key 可让 AI 定制）';
    return `<div class="advice-list"><div class="advice-src">${src}</div>${d.advice.map(x => `<div class="advice-row">${esc(x)}</div>`).join('')}</div>`;
  }
  return `<div class="advice-list"><div class="advice-src">正在生成…</div></div>`;
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
  if (curStage > 2) {
    const t = getCur();
    if (t) {
      t.stagePointer = curStage - 1;
      /* 从完成态退回 = 重新打开修订，清掉完成标记，否则渲染仍停在完成卡 */
      if (t.status === 'done') { t.status = 'active'; t.finishedAt = null; }
      save();
    }
    curStage = curStage - 1; renderStage();
    toast('已回到上一步，可继续修订');
  }
}
/* 完成卡上的“回去修订”：从最后一跳回验证/上一阶段，重新进入可编辑状态 */
function reopenForEdit() {
  const t = getCur(); if (!t) return;
  t.status = 'active'; t.finishedAt = null;
  const target = curStage > 2 ? curStage - 1 : 2;
  t.stagePointer = target; curStage = target; save();
  renderStage();
  toast('已回到前面，可继续修订 ✎');
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
  /* 问题定义：保存用户改写的问题句(problemAsk)，不再用模板覆盖掉用户的修订 */
  if (key === 'define' && s.id === 'problem') {
    d.answers.problemAsk = val;
    d.answers.problem = problemTemplate(t);   /* 兼容旧字段 */
  } else {
    d.answers[s.id] = val;
  }
  d.progress++;
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
/* AI 协作（串行三段）：①先挑战反驳我的判断 → ②再基于质疑给方案 → ③我合成自己的方案
   有 Key 走真实 API，失败/无 Key 走本地模板；每段明确标注来源，不假装智能。 */
function aiCollabResultHTML(draft) {
  const ch = draft.challenge || {}, pl = draft.plan || {};
  let h = `<div class="ai-phase">
    <div class="ai-phase-h">① AI 先挑战 / 反驳你的判断</div>
    <div class="ai-result-card"><div class="ai-src">${esc(ch.source || '')}</div><div class="ai-text">${esc(ch.text || '')}</div></div>
  </div>`;
  if (pl.text) {
    h += `<div class="ai-phase">
      <div class="ai-phase-h">② AI 基于上面的质疑，给出方案</div>
      <div class="ai-result-card"><div class="ai-src">${esc(pl.source || '')}</div><div class="ai-text">${esc(pl.text)}</div></div>
    </div>
    <div class="ai-merge-hint">AI 的反驳和方案都在这了。下一步由你决定：把它和你的判断合成一个你认可的方案。</div>
    <button class="btn step-confirm" onclick="answerAI()">看完了，去合成我的方案 →</button>`;
  } else {
    h += `<div class="ai-loading">AI 正在基于质疑给方案…</div>`;
  }
  return h;
}
async function runAICollab() {
  const t = getCur(); if (!t) return;
  const d = ensureFlow(t, 'collab');
  const box = el('ai-result');
  if (box) box.innerHTML = `<div class="ai-loading">第一步：AI 正在挑战你的判断…</div>`;
  const a = d.answers || {};
  const problem = problemBuild(t).ask || t.title || '';
  const base = `问题：${problem}\n我的方向：${a.direction || ''}\n我的理由：${a.reason || ''}`;
  const challengeSys = '你是思考教练。针对用户的方向和理由，给出2-3条尖锐但友善的反驳/质疑，逼他检视盲点。不要替他下结论。简洁，中文，每条不超过60字。';
  const chRes = await callAI(challengeSys, base);
  const chText = chRes.ok ? chRes.text : localAI('challenge', a, problem);
  const chSrc = chRes.ok ? 'AI 实时生成' : (chRes.reason === 'nokey' ? '本地模板（未配置 Key）' : '本地模板（AI 已降级）');
  d.aiDraft = { challenge: { text: chText, source: chSrc }, plan: {} };
  t.updatedAt = Date.now(); save();
  if (box) box.innerHTML = aiCollabResultHTML(d.aiDraft);
  /* 第二步：把"我的判断 + AI 的质疑"一起交给 AI，让它出方案，而不是凭空给 */
  const planSys = '你是思考教练。先看过你对用户判断的反驳，再给出一个具体可执行的方案，分3步、每步一句。方案必须正面回应你刚才提出的质疑，不要空话。中文，总共不超过150字。';
  const planCtx = base + `\n\n你刚才的反驳：\n${chText}`;
  const plRes = await callAI(planSys, planCtx);
  const plText = plRes.ok ? plRes.text : localAI('plan', a, problem, chText);
  const plSrc = plRes.ok ? 'AI 实时生成' : (plRes.reason === 'nokey' ? '本地模板（未配置 Key）' : '本地模板（AI 已降级）');
  d.aiDraft.plan = { text: plText, source: plSrc };
  save();
  if (box) box.innerHTML = aiCollabResultHTML(d.aiDraft);
}
function answerAI() {
  const t = getCur(); if (!t) return;
  const d = ensureFlow(t, 'collab'); const draft = d.aiDraft || {};
  const ch = (draft.challenge || {}).text || '', pl = (draft.plan || {}).text || '';
  const src = (draft.plan || {}).source || (draft.challenge || {}).source || '';
  d.answers.ai = {
    mode: '先反驳后方案',
    challenge: ch, plan: pl,
    text: `【AI 的反驳】${ch}\n【AI 的方案】${pl}`,
    source: src
  };
  d.progress++; save(); renderStage();
}
/* 生成验证建议（AI 或本地），写入 verify.advice。始终带上"你定义的问题 + 你构建的方案"。 */
async function regenAdvice(force) {
  const t = getCur(); if (!t) return;
  const d = ensureFlow(t, 'verify');
  if (!force && d.advice) return;              /* 已有就不重复生成 */
  const problem = problemBuild(t).ask || t.title || '';
  const solution = ((t.stageData.collab || {}).answers || {}).solution || '';
  const challenge = (((t.stageData.collab || {}).answers || {}).ai || {}).challenge || '';
  const box = el('advice-box');
  if (box) box.innerHTML = `<div class="ai-loading">正在针对你的问题和方案生成验证建议…</div>`;
  const ctx = `你要验证的问题：${problem}\n你构建的方案：${solution}\nAI 对方案的质疑（要在测试里一并检验）：${challenge || '无'}`;
  const sys = '你是验证教练。针对用户"要验证的问题"和"构建的方案"，给出3条能直接照做的验证建议：①一个具体的测试动作（写清去哪、做什么、拿谁试）；②一个要观察的关键信号（能证明或推翻方案的具体现象）；③一个判断标准（看到什么算有效、看到什么算错了）。必须紧扣用户的问题和方案本身，不要给"做最小测试"这类空话。中文，每条不超过45字，分三行。';
  const res = await callAI(sys, ctx, 400);
  if (res.ok) { d.advice = splitAdvice(res.text); d.adviceSource = 'ai'; }
  else { d.advice = localAdvice(problem, solution, challenge); d.adviceSource = 'local'; }
  save();
  if (box) box.innerHTML = adviceHTML(d);
}
/* 进入验证阶段即自动生成一次 */
function ensureAdvice() { const t = getCur(); if (t) regenAdvice(false); }
/* 本地降级：明确是模板，不冒充 AI */
function localAI(mode, a, problem, challenge) {
  if (mode === 'challenge') {
    return `① 你的方向是「${(a.direction || '这个办法').slice(0, 20)}」——如果不做它，最坏会怎样？\n② 这个判断基于「${(a.reason || '你的理由').slice(0, 20)}」，依据可靠吗，还是只是猜测？\n③ 有没有一个人，和你情况相反却做成了？他怎么做？`;
  }
  const reply = challenge ? `先回应上面的质疑：挑一条你能查证的，动手去查。` : '';
  return `${reply}① 针对「${String(problem).slice(0, 24)}」，做一个 5 分钟内能完成的最小动作。\n② 动手前写下你预期看到什么。\n③ 做完只对照一个问题：它被解决了吗？`;
}
function localAdvice(problem, solution, challenge) {
  const s = String(solution || problem || '').slice(0, 26);
  const p = String(problem || '').slice(0, 22);
  const out = [
    `① 测试动作：找 1 个真实场景，按你的方案「${s}」做一次（比如真的去问/去看/去试）。`,
    `② 观察信号：动手前写下"如果我解决了「${p}」，我应该看到____"，填具体现象。`,
    `③ 判断标准：看到那现象=有效；没看到或反着来=错了，回头改方案。`
  ];
  if (challenge) out.push('④ 顺带检验 AI 的质疑：挑它能被观察的一条，看是不是真的发生。');
  out.push('⑤ 涉钱/安全/健康/法律：先查来源再下判断。');
  return out;
}
function splitAdvice(text) {
  return (text || '').split(/\n+/).map(x => x.trim()).filter(Boolean).slice(0, 5);
}
/* 真正调用用户自带的 Key（OpenAI 兼容协议）。无 Key / 失败返回结构化的失败原因。 */
async function callAI(system, user, maxTokens) {
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
      body: JSON.stringify({ model, messages:[{role:'system',content:system},{role:'user',content:user}], temperature:0.7, max_tokens:maxTokens || 500 })
    });
    if (!r.ok) return { ok:false, reason:'http_' + r.status };
    const j = await r.json();
    const txt = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!txt) return { ok:false, reason:'empty' };
    return { ok:true, text:String(txt).trim() };
  } catch (e) { return { ok:false, reason:'network_or_cors' }; }
}

/* ---------- 探索卡标题：AI 把问题概括成 ≤20 字短语，失败本地提炼 ---------- */
function localTopic(t) {
  const p = problemBuild(t);
  /* 直接用「差距」当标题——它本身就是最像问题的那一句；逗号改间隔点 */
  let s = String(p.gap || p.now || '').trim();
  if (!s) s = String(p.ask || '').replace(/^如何消除「/, '').replace(/」，让「/g, ' · ').replace(/」成为现实/g, '');
  s = s.replace(/[「」『』“”"'。.；;：:！!？?、\s]+/g, '').replace(/[，,]/g, ' · ');
  return s.slice(0, 20) || '这次探索';
}
/* 旧数据里的 6 字标签直接降级为本地完整短语，不等 AI */
function displayTopic(t) {
  return (t.topic && String(t.topic).length > 6) ? t.topic : localTopic(t);
}
async function ensureTopic(t) {
  /* 旧版 ≤6 字标签表述不清，自动升级为完整短语；新版不重复调用 */
  if (t.topic && String(t.topic).length > 6) return;
  const p = problemBuild(t);
  const res = await callAI('你是中文标题助手。把下面的问题概括成一个不超过20字的中文短语，要让人一眼看出「谁 + 什么状况」，保留关键信息，不要引号、不要解释。例如："课间大家低头玩手机不愿交流"→"课间学生低头玩手机不愿交流"。只输出这个短语。', '问题：' + p.ask + '\n差距：' + p.gap + '\n现状：' + p.now);
  let topic;
  if (res.ok) {
    topic = res.text.replace(/[「」『』“”"'，,。.；;：:！!？?、\s]/g, '').slice(0, 20);
  }
  if (!topic) topic = localTopic(t);
  t.topic = topic; save();
  /* 若完成卡/标题已在屏上，就地刷新标题，无需整屏重绘 */
  const node = el('card-topic'); if (node) node.textContent = topic;
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
    /* 小结里不再放大凸显卡，问题定义在对话区已完整展示；这里只留一句话摘要 */
    if (s.type === 'template') {
      const p = problemBuild(t);
      return `<div class="sc-row"><b>${s.label}：</b>${esc(shortPhrase(p.ask, 34))}</div>`;
    }
    return `<div class="sc-row"><b>${s.label}：</b>${esc(v)}</div>`;
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
  else {
    /* 走完留在进阶屏，完成卡在进阶屏内显示（不再弹到首页，首页保持极简） */
    t.status = 'done'; t.stagePointer = 5; t.finishedAt = Date.now(); save();
    renderStage();
    toast('这一趟，走完了 🎉');
    ensureTopic(t);   /* 异步生成 ≤6 字问题标签，供探索卡标题用 */
  }
}
/* 完成卡：只在进阶屏内显示，由 renderStage 注入 */
function finishCardHTML(t) {
  return `<div class="finish-card">
    <div class="finish-emoji">🎉</div>
    <div class="finish-title">这一趟，走完了</div>
    <div class="finish-text">从「<span id="card-topic">${esc(displayTopic(t))}</span>」到亲手验证，这一趟值得留一张卡。</div>
    <button class="btn finish-btn" onclick="exportCard('${t.id}',true)">📥 生成我的探索卡</button>
    <button class="finish-revisit" onclick="reopenForEdit()">✎ 回去再改改</button>
    <div class="finish-foot">不打卡，不排名——这张卡，只属于你自己。</div>
  </div>`;
}
/* 随时收尾：不是每条探索都要走到验证。想清楚了就能停，状态入库。 */
function finishThread(status) {
  const t = getCur(); if (!t) return;
  const label = { archived: '先存着', dropped: '放下' }[status] || '收尾';
  if (!confirm(`把这条探索「${label}」？\n\n「${(t.title || t.raw || '').slice(0, 28)}」\n\n${status === 'archived' ? '以后可以在“我的探索”里重新打开继续。' : '放下后不再出现在进行中，但仍可在“我的探索”里找到。'}`)) return;
  t.status = status;
  t.finishedAt = Date.now(); t.stoppedAtStage = curStage;
  t.updatedAt = Date.now(); save();
  goHome(); toast(status === 'archived' ? '已先存着 📦' : '已放下 🌿');
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
  el('reopen-about').style.display = DB.user.aboutClosed ? 'block' : 'none';
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

/* ===================== 探索卡 PNG 导出（canvas 手绘，零依赖） ===================== */
function escLines(s) { return (s || '').trim().split(/\n+/).filter(Boolean); }
function exportCard(id, backToHome) {
  const t = DB.threads.find(x => x.id === id) || getCur(); if (!t) { toast('找不到这条探索'); return; }
  try {
    const url = drawCard(t);
    const a = document.createElement('a');
    a.href = url; a.download = `探奇-探索卡-${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    toast('探索卡已生成 📥');
    if (backToHome) setTimeout(() => goHome(), 700);
  } catch (e) { toast('生成失败，请重试'); console.error(e); }
}
/* 探索卡结语：从这条探索的真实数据里长出来，每句话都能在卡里找到出处 */
function cardClosing(t) {
  const d = t.stageData || {};
  const vd = d.verify || {}, va = vd.answers || {}, da = d.define || {}, ca = d.collab || {};
  const verdict = va.verdict;                              /* valid / wrong */
  const test = (va.test || '').trim(), result = (va.result || '').trim();
  const trained = threadReview(t).trained;
  const skill = (trained[0] || '').replace(/^[^：]+：/, '').slice(0, 18);
  let main, sub;
  if (verdict === 'valid' && test) {
    main = `你做的那次测试，让判断被现实确认了。`;
    sub = skill ? `这一趟真正练到的是：${skill}` : '这就是一次完整的"想到—做到—验证"。';
  } else if (verdict === 'wrong' && test) {
    main = `测试没支持你的判断——你敢承认它偏了，还改了它。`;
    sub = '愿意被现实纠偏，比判断一开始就对更值钱。';
  } else if (result) {
    main = `你把"我原以为"拿去做了一次真实验证。`;
    sub = skill ? `这一趟真正练到的是：${skill}` : '看见真实发生的事，就是进步。';
  } else if (ca.solution) {
    main = `你把一句困惑，走成了一个自己认可的方案。`;
    sub = '下一步，找个机会真的试一次。';
  } else if (da.answers && da.answers.problemAsk) {
    main = `你把说不清的纳闷，逼成了一句能验证的问题。`;
    sub = '会问问题，本身就是一种能力。';
  } else {
    main = `你把"好像哪里不对"抓住并记了下来。`;
    sub = '很多发现，都是从这一句开始的。';
  }
  return { main, sub };
}
function drawCard(t) {
  /* 重设计：文字砍半，只留 4 个核心视觉区 + 装饰，面向大中学生审美 */
  const W = 750, PAD = 48;
  const CARD_X = PAD - 12, CARD_W = W - CARD_X * 2, TX = CARD_X + 78, TXT_W = CARD_W - 78 - 30;
  const GREEN = '#0E6B50', CORAL = '#FF8A5B', INK = '#1c2b25', MUTED = '#7a8a83', SOFT = '#E7F3ED';
  const fam = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const F = (size, weight) => `${weight || 400} ${size}px ${fam}`;

  /* 收尾标点不能落在行首：放不下时把前一个字一起挪到下一行 */
  const NO_START = /[」』”"】）\]，,。.、；;：:！!？?]/;
  function wrap(text, maxW, font) {
    ctx.font = font; const out = []; let cur = '';
    for (const ch of String(text == null ? '' : text)) {
      if (ch === '\n') { if (cur) out.push(cur); cur = ''; continue; }
      const test = cur + ch;
      if (ctx.measureText(test).width > maxW && cur) {
        if (NO_START.test(ch) && cur.length > 1) {
          out.push(cur.slice(0, -1)); cur = cur.slice(-1) + ch;
        } else { out.push(cur); cur = ch; }
      } else cur = test;
    }
    if (cur) out.push(cur);
    return out;
  }
  function cap(text, maxLines, maxW, font) {
    let lines = wrap(text, maxW, font);
    if (lines.length <= maxLines) return lines;
    lines = lines.slice(0, maxLines);
    ctx.font = font;
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(last + '…').width > maxW) last = last.slice(0, -1);
    lines[maxLines - 1] = last + '…';
    return lines;
  }

  /* 标题即问题本身：短句保持大字，长句最多两行；「新探索」下沉到时间行，不再吃掉标题空间 */
  const topicText = displayTopic(t).slice(0, 24);
  const HEAD_W = W - PAD * 2;
  let ts = 46, titleLines = wrap(topicText, HEAD_W, F(46, 800));
  while (titleLines.length > 2 && ts > 30) { ts -= 2; titleLines = wrap(topicText, HEAD_W, F(ts, 800)); }
  if (titleLines.length > 2) titleLines = cap(topicText, 2, HEAD_W, F(ts, 800));
  const TITLE_TOP = 68, LINE_H = ts + 6;
  const STAMP_Y = TITLE_TOP + titleLines.length * LINE_H + 10;
  const STEPS_Y = STAMP_Y + 38;
  const HEAD_H = STEPS_Y + 34 + 16;

  const d = t.stageData || {}, da = (d.define || {}).answers || {}, ca = (d.collab || {}).answers || {}, va = (d.verify || {}).answers || {}, vd = d.verify || {};
  const p = problemBuild(t), rv = threadReview(t);
  const cards = [];

  /* A · 起点 */
  cards.push({ emoji: '🔍', kicker: '起点 · 我记下的', accent: GREEN,
    rows: cap(t.raw || t.title || '—', 3, TXT_W, F(26, 500)).map(x => ({ t: x, size: 26, weight: 500, color: INK })) });

  /* B · 问题定义（核心，最突出）：标签独占一行，答案另起占满宽度，杜绝溢出 */
  const probRows = [];
  const seg = [
    ['现状', p.now, '#2E9E6B'],
    ['标准是', p.std, '#2E7FB8'],
    ['差距在', p.gap, '#E08A3C'],
    ['导致', p.cost, '#C4518B'],
    ['所以我需要解决的问题是', p.ask, CORAL]
  ];
  seg.forEach((segItem) => {
    const label = segItem[0], val = segItem[1], col = segItem[2], isAsk = label.indexOf('解决的问题') >= 0;
    /* 标签行 */
    probRows.push({ kind:'label', t:label, color:col, size:isAsk ? 18 : 17 });
    /* 前四步按逗号断行；结论整句连续换行，不再拆成碎片 */
    const parts = isAsk ? [String(val || '')] : String(val || '').split(/[，,]/).map(x => x.trim()).filter(Boolean);
    (parts.length ? parts : ['—']).forEach((part) => {
      cap(part, isAsk ? 5 : 4, TXT_W, F(isAsk ? 24 : 23, isAsk ? 800 : 600)).forEach(line => {
        probRows.push({ kind:'val', t:line, size:isAsk ? 24 : 23, weight:isAsk ? 800 : 600, color:isAsk ? CORAL : INK });
      });
    });
  });
  cards.push({ emoji: '🎯', kicker: '我把问题说清楚了', accent: CORAL, hero: true, rows: probRows });

  /* C · AI 协作构建的方案 */
  const solRows = [];
  if (ca.ai && ca.ai.text) {
    if (ca.ai.challenge) {
      solRows.push({ kind:'label', t:'AI 先质疑我', color:'#C4518B', size:18 });
      cap(ca.ai.challenge, 4, TXT_W, F(21)).forEach(x => solRows.push({ kind:'val', t:x, size:21, weight:400, color:'#3a7d68' }));
    }
    if (ca.ai.plan) {
      solRows.push({ kind:'label', t:'AI 再给方案', color:GREEN, size:18 });
      cap(ca.ai.plan, 4, TXT_W, F(21)).forEach(x => solRows.push({ kind:'val', t:x, size:21, weight:400, color:'#3a7d68' }));
    }
    if (!ca.ai.challenge && !ca.ai.plan)
      cap(ca.ai.text, 5, TXT_W, F(21)).forEach(x => solRows.push({ kind:'val', t:x, size:21, weight:400, color:'#3a7d68' }));
  }
  if (ca.solution) {
    solRows.push({ kind:'label', t:'我定下的方案', color:GREEN, size:18 });
    cap(ca.solution, 5, TXT_W, F(23, 700)).forEach(x => solRows.push({ kind:'val', t:x, size:23, weight:700, color:INK }));
  }
  if (solRows.length) cards.push({ emoji: '🤝', kicker: 'AI 协作下，我定下了方案', accent: GREEN, rows: solRows });

  /* C · 验证 */
  const vRows = [];
  if (va.verdict) vRows.push({ t: va.verdict === 'valid' ? '✅  我的判断：有效' : '❌  我的判断：偏了，已修订', size: 26, weight: 800, color: va.verdict === 'valid' ? GREEN : CORAL });
  if (va.test) cap('做了：' + va.test, 2, TXT_W, F(23)).forEach(x => vRows.push({ t: x, size: 23, weight: 400, color: INK }));
  if (va.result) cap('结果：' + va.result, 2, TXT_W, F(23)).forEach(x => vRows.push({ t: x, size: 23, weight: 400, color: INK }));
  if (vRows.length) cards.push({ emoji: '🧪', kicker: '我验证了一次', accent: GREEN, rows: vRows });

  /* D · 成长（能力徽章 + 一条留意） */
  const chips = rv.trained.map(x => String(x).split(/[：:]/)[0]).filter(Boolean).slice(0, 5);
  const gRows = [];
  if (chips.length) cap(chips.join('  ·  '), 2, TXT_W, F(24, 800)).forEach(x => gRows.push({ t: x, size: 24, weight: 800, color: GREEN }));
  if (rv.watch[0]) cap('下次留意：' + rv.watch[0], 2, TXT_W, F(22)).forEach(x => gRows.push({ t: x, size: 22, weight: 400, color: MUTED }));
  cards.push({ emoji: '💪', kicker: '这一趟，我练到了', accent: GREEN, rows: gRows });

  /* 测量高度 */
  let y = HEAD_H + 30;
  cards.forEach(card => {
    const lineH = card.rows.reduce((h, r) => h + (r.kind === 'label' ? 32 : 36), 0);
    card.h = 66 + lineH + 14;
    y += card.h + 18;
  });
  const totalH = y + 112;
  const dpr = 2;
  c.width = W * dpr; c.height = totalH * dpr;
  ctx.scale(dpr, dpr);

  /* 背景 */
  ctx.fillStyle = '#F4F7F5'; ctx.fillRect(0, 0, W, totalH);

  /* 顶部品牌区（渐变 + 装饰） */
  const gh = ctx.createLinearGradient(0, 0, W, HEAD_H);
  gh.addColorStop(0, GREEN); gh.addColorStop(1, '#0A5741');
  ctx.fillStyle = gh; ctx.fillRect(0, 0, W, HEAD_H);
  ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.beginPath(); ctx.arc(W - 30, 20, 150, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.beginPath(); ctx.arc(W - 170, HEAD_H - 20, 96, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.28)';
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(W - 72 - i * 26, 92, 4, 0, Math.PI * 2); ctx.fill(); }
  ctx.textBaseline = 'top';
  ctx.font = F(20, 700); ctx.fillStyle = 'rgba(255,255,255,.82)'; ctx.fillText('探奇 · MIND GYM', PAD, 32);
  /* 标题即问题本身：短句大字，长句最多两行；「新探索」下沉到时间行 */
  ctx.font = F(ts, 800); ctx.fillStyle = '#fff';
  titleLines.forEach((line, i) => ctx.fillText(line, PAD, TITLE_TOP + i * LINE_H));
  const stamp = new Date(t.finishedAt || t.updatedAt || Date.now()).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  ctx.font = F(19, 400); ctx.fillStyle = 'rgba(255,255,255,.75)';
  ctx.fillText('我的新探索 · 记录于 ' + stamp, PAD, STAMP_Y);
  const steps = ['捕捉', '定义', '协作', '验证', '进阶'];
  let sx = PAD;
  steps.forEach((s, i) => {
    ctx.font = F(18, 700);
    const tw = ctx.measureText(s).width + 28;
    ctx.fillStyle = i === 4 ? CORAL : 'rgba(255,255,255,.22)';
    roundRect(ctx, sx, STEPS_Y, tw, 34, 17); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(s, sx + 14, STEPS_Y + 7);
    sx += tw + 10;
  });

  /* 内容卡 */
  y = HEAD_H + 30;
  cards.forEach(card => {
    const bx = PAD - 12, bw = W - (PAD - 12) * 2;
    ctx.fillStyle = '#fff'; roundRect(ctx, bx, y, bw, card.h, 20); ctx.fill();
    if (card.hero) { ctx.strokeStyle = CORAL; ctx.lineWidth = 3; roundRect(ctx, bx, y, bw, card.h, 20); ctx.stroke(); }
    ctx.fillStyle = card.hero ? '#FFF0E9' : SOFT;
    ctx.beginPath(); ctx.arc(bx + 42, y + 42, 24, 0, Math.PI * 2); ctx.fill();
    ctx.font = '26px sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText(card.emoji, bx + 42, y + 44);
    ctx.textBaseline = 'top';
    ctx.font = F(19, 800); ctx.fillStyle = card.accent; ctx.fillText(card.kicker, TX, y + 28);
    let ry = y + 66;
    card.rows.forEach(row => {
      if (row.kind === 'label') {
        ctx.font = F(row.size || 18, 800); ctx.fillStyle = row.color;
        ctx.fillText(row.t, TX, ry);
        ry += 32;
      } else {
        ctx.font = F(row.size, row.weight || 400); ctx.fillStyle = row.color;
        ctx.fillText(row.t, TX, ry);
        ry += 36;
      }
    });
    y += card.h + 18;
  });

  /* 底部结语：基于这条探索的真实结果，不再用随机鸡汤 */
  const closing = cardClosing(t);
  ctx.fillStyle = SOFT; roundRect(ctx, PAD - 12, y, W - (PAD - 12) * 2, 96, 20); ctx.fill();
  ctx.fillStyle = GREEN; ctx.font = F(22, 700);
  cap(closing.main, 2, W - (PAD - 12) * 2 - 56, F(22, 700))
    .forEach((ln, i) => ctx.fillText(ln, PAD + 16, y + 16 + i * 30));
  ctx.fillStyle = MUTED; ctx.font = F(16, 400);
  ctx.fillText(closing.sub, PAD + 16, y + 74);
  return c.toDataURL('image/png');
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

/* ---------- 启动 ---------- */
function init() {
  renderAbout();
  renderHomeThreads();
  updateAiBtn();
  if (!DB.user.ageConfirmed) el('age-gate').classList.add('active');
  else { el('age-gate').classList.remove('active'); restartAbout(); }
}
init();
