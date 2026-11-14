/* ===================== 探奇 / Mind Gym — M1 逻辑（无 AI 闭环） ===================== */
const KEY = 'mindgym_v2';
let DB = load();
let mode = 'passive';          // 捕捉模式：passive 偶遇 / active 探索
let curThreadId = null;        // 当前打开的线索
let curStage = null;           // 当前阶段指针（2~5）

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
  if (id === 's-home') renderHomeThreads();
  if (id === 's-pool') renderPool();
  if (id === 's-mine') renderMine();
  updateFab();
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
function goHome() { go('s-home'); }
function toast(msg) {
  const t = el('toast'); t.textContent = msg; t.classList.add('show');
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
      <button class="fb-go" onclick="go('s-pool')">放进线索池看看 →</button>
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
function renderHomeThreads() {
  const list = el('thread-list');
  const anyThreads = DB.threads.length;
  const captured = DB.threads.filter(t => t.status === 'captured').length;
  el('threads-title').style.display = anyThreads ? 'block' : 'none';
  const te = el('triage-entry');
  te.classList.toggle('show', anyThreads > 0);
  te.textContent = captured > 0 ? '整理一下 →' : '查看线索池 →';
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
    </div>`;
  }).join('');
}

/* ---------- 整理（分诊） ---------- */
function renderPool() {
  const pool = el('pool-list');
  const items = DB.threads.filter(t => t.status === 'captured');
  if (!items.length) {
    pool.innerHTML = '<div class="pool-empty">都整理完啦 🌿<br>去首页记点新线索吧</div>';
    return;
  }
  pool.innerHTML = items.map(t => {
    const emoji = t.sourceMode === 'active' ? '🔆' : '🌧️';
    return `<div class="tri-card" style="display:block;">
      <div style="display:flex;gap:10px;align-items:flex-start;">
        <div class="tri-emoji">${emoji}</div>
        <div class="tri-main"><div class="tri-title">${esc(t.title || t.raw)}</div></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button class="next-btn" style="margin:0;" onclick="triage('${t.id}','push')">推进 ➡️</button>
        <button class="next-btn" style="margin:0;background:#b9c2bd;" onclick="triage('${t.id}','drop')">放弃</button>
        <button class="next-btn coral" style="margin:0;" onclick="triage('${t.id}','archive')">归档</button>
      </div>
    </div>`;
  }).join('');
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

const STAGE_META = {
  2: { key: 'define', label: '定义 · 第2步/共5', why: '把一个“说不清哪儿怪”的感觉，变成一句能去验证的话。这是“洞察 / 定义”的练习。',
       help: '① 核心：到底在困惑什么？\n② 目标：你想弄明白啥？\n③ 卡点：现在卡住你的是哪一点？\n④ 标准：怎样算弄明白了？', nextLabel: '下一步：先写下你自己的判断，再看几种思路 →' },
  3: { key: 'collab', label: '协作 · 第3步/共5', why: '在瞅任何“答案”之前，先说出你自己的判断和理由。这是不被 AI 带着走的关键一步。',
       help: '写下你的初步想法和为什么。下面会列出几种思路路径（M1 先用示例填充）。记住：你的判断先到，别人的后到。', nextLabel: '下一步：去做点什么，验证一下你的想法 →' },
  4: { key: 'verify', label: '验证 · 第4步/共5', why: '想法对不对，得试试才知道。做了啥、你以为会怎样、实际怎样、你判断对了没。',
       help: '记一个动作 + 你预期的结果 + 真实结果。如果是钱 / 安全 / 健康 / 法律类的高风险，必须先查来源才能收尾。', nextLabel: '下一步：看看怎么把这几步练得更顺 →' },
  5: { key: 'improve', label: '进阶 · 第5步/共5', why: '不是打分，是支招：发现、定义、验证这三步，下次怎么更利索。',
       help: '回头看这条线索：捕捉时是不是太犹豫？定义时核心清楚吗？验证时查来源了吗？挑一个点，下次试试。', nextLabel: '收尾啦 🎉 回到首页 →' }
};

function renderStage() {
  const t = getCur(); if (!t) return;
  const m = STAGE_META[curStage]; if (!m) return;
  el('stage-label').textContent = m.label;
  let body = `<div class="stage-why">${m.why}<button class="help-pill" onclick="toggleHelp()">?</button></div>
    <div class="help-sheet" id="help-sheet">${m.help.replace(/\n/g, '<br>')}</div>`;
  const d = t.stageData[m.key] || {};
  if (m.key === 'define') {
    body += `<div class="stage-form">
      ${stepHTML('① 核心', '到底在困惑什么？', 'f-core', d.core)}
      ${stepHTML('② 目标', '你想弄明白啥？', 'f-goal', d.goal)}
      ${stepHTML('③ 卡点', '现在卡住你的是哪一点？', 'f-blocker', d.blocker)}
      ${stepHTML('④ 标准', '怎样算弄明白了？', 'f-success', d.success)}
    </div>`;
  } else if (m.key === 'collab') {
    body += `<div class="stage-form">
      <div class="stage-step">
        <div><span class="st-num">✍️</span><span class="st-label">先写下你的判断 + 理由</span></div>
        <div class="st-hint">你的想法先到，别人的后到。</div>
        <textarea id="f-leaning" placeholder="我的初步想法是……因为……">${esc(d.leaning)}</textarea>
      </div>
      <div class="stage-step">
        <label style="display:flex;gap:8px;align-items:center;font-size:14px;color:var(--ink);">
          <input type="checkbox" id="f-risk" ${d.risk ? 'checked' : ''}/> 这条涉及 钱 / 安全 / 健康 / 法律？
        </label>
      </div>
      <div id="collab-options" style="display:${d.leaning ? 'block' : 'none'};">
        <div class="guide-q">几种思路路径（示例 · M1 占位，M2 由 AI 生成）</div>
        <div class="ai-msg">① 换个角度：把问题反过来想，会怎样？</div>
        <div class="ai-msg">② 拆小一点：能不能先验证其中最小的一块？</div>
        <div class="ai-msg">③ 找真人聊聊：谁可能真遇过这回事？</div>
      </div>
    </div>`;
  } else if (m.key === 'verify') {
    body += `<div class="stage-form">
      ${stepHTML('做了啥', '一个最小可行动作', 'f-action', d.action)}
      ${stepHTML('你预期', '以为会发生什么', 'f-expected', d.expected)}
      ${stepHTML('实际怎样', '真实发生了什么', 'f-actual', d.actual)}
      <div class="stage-step">
        <div class="st-label">你的判断</div>
        <div class="judge-group">
          <button id="j-valid" class="${d.judgment === 'valid' ? 'on' : ''}" onclick="setJudge('valid')">✅ 有效</button>
          <button id="j-wrong" class="${d.judgment === 'wrong' ? 'on' : ''}" onclick="setJudge('wrong')">❌ 错了</button>
        </div>
      </div>
      <div class="stage-step"><div class="st-label">来源 / 原始资料（可选）</div>
        <textarea id="f-source" placeholder="贴一个你核对过的来源链接或资料">${esc(d.source)}</textarea></div>
      <div class="risk-bar" id="risk-bar" style="display:${d.risk ? 'block' : 'none'};">这条涉及风险，先贴个来源再收尾 →</div>
    </div>`;
  } else if (m.key === 'improve') {
    body += `<div class="stage-form">${stepHTML('下次试一点', '挑一个最想改进的点', 'f-note', d.note)}</div>`;
  }
  body += `<div class="summary-card" id="summary-card">${summaryHTML(t, m.key)}</div>`;
  el('stage-body').innerHTML = body;
  el('stage-footer').innerHTML = `<button class="next-btn ${curStage === 5 ? 'coral' : ''}" id="next-btn" onclick="nextStage()">${m.nextLabel}</button><div class="next-hint" id="next-hint"></div>`;
  updateGate();
}
function stepHTML(label, hint, id, val) {
  return `<div class="stage-step">
    <div class="st-label">${label}</div>
    <div class="st-hint">${hint}</div>
    <textarea id="${id}" placeholder="${hint}">${esc(val)}</textarea></div>`;
}
function toggleHelp() { el('help-sheet').classList.toggle('show'); }

function summaryHTML(t, key) {
  const d = t.stageData[key] || {};
  if (key === 'define') {
    if (!d.core && !d.goal && !d.blocker && !d.success) return '<div class="sc-title">本步小结</div><div class="sc-row" style="color:var(--muted)">边写边会自动记下这里 ✍️</div>';
    return `<div class="sc-title">本步小结</div>
      ${d.core ? `<div class="sc-row"><b>核心：</b>${esc(d.core)}</div>` : ''}
      ${d.goal ? `<div class="sc-row"><b>目标：</b>${esc(d.goal)}</div>` : ''}
      ${d.blocker ? `<div class="sc-row"><b>卡点：</b>${esc(d.blocker)}</div>` : ''}
      ${d.success ? `<div class="sc-row"><b>标准：</b>${esc(d.success)}</div>` : ''}`;
  }
  if (key === 'collab') {
    let h = '<div class="sc-title">本步小结</div>';
    h += d.leaning ? `<div class="sc-row"><b>我的判断：</b>${esc(d.leaning)}</div>` : '<div class="sc-row" style="color:var(--muted)">先写下你的判断</div>';
    h += `<div class="sc-row"><b>风险标记：</b>${d.risk ? '是（需查来源）' : '否'}</div>`;
    return h;
  }
  if (key === 'verify') {
    if (!d.action && !d.actual) return '<div class="sc-title">本步小结</div><div class="sc-row" style="color:var(--muted)">记完动作和结果会自动出现在这里</div>';
    return `<div class="sc-title">本步小结</div>
      ${d.action ? `<div class="sc-row"><b>动作：</b>${esc(d.action)}</div>` : ''}
      ${d.expected ? `<div class="sc-row"><b>预期：</b>${esc(d.expected)}</div>` : ''}
      ${d.actual ? `<div class="sc-row"><b>实际：</b>${esc(d.actual)}</div>` : ''}
      ${d.judgment ? `<div class="sc-row"><b>判断：</b>${d.judgment === 'valid' ? '✅ 有效' : '❌ 错了'}</div>` : ''}
      ${d.source ? `<div class="sc-row"><b>来源：</b>${esc(d.source)}</div>` : ''}`;
  }
  if (key === 'improve') {
    return d.note ? `<div class="sc-title">本步小结</div><div class="sc-row">${esc(d.note)}</div>` : '<div class="sc-title">本步小结</div><div class="sc-row" style="color:var(--muted)">挑一个点写下来</div>';
  }
  return '';
}
function setJudge(v) {
  const t = getCur(); t.stageData.collab = t.stageData.collab || {};
  t.stageData.collab.judgment = v; save();
  el('j-valid').classList.toggle('on', v === 'valid');
  el('j-wrong').classList.toggle('on', v === 'wrong');
  el('summary-card').innerHTML = summaryHTML(t, 'verify'); updateGate();
}
function updateGate() {
  const t = getCur(); if (!t) return;
  const m = STAGE_META[curStage].key;
  const nb = el('next-btn');
  const hint = el('next-hint');
  if (m === 'collab') {
    const lean = (el('f-leaning').value || '').trim();
    el('collab-options').style.display = lean.length >= 8 ? 'block' : 'none';
    nb.disabled = lean.length < 8;
    if (hint) hint.textContent = lean.length < 8 ? '先写下你的判断（至少 8 个字），下一步才会亮起' : '';
  } else if (m === 'verify') {
    const act = (el('f-action').value || '').trim();
    const act2 = (el('f-actual').value || '').trim();
    const risk = el('f-risk').checked;
    const src = (el('f-source').value || '').trim();
    nb.disabled = !(act && act2) || (risk && !src);
    el('risk-bar').style.display = risk ? 'block' : 'none';
    if (hint) {
      if (!(act && act2)) hint.textContent = '记一个“动作”和“真实结果”，下一步才会亮起';
      else if (risk && !src) hint.textContent = '这条涉及风险，先贴一个来源再收尾';
      else hint.textContent = '';
    }
  } else { nb.disabled = false; if (hint) hint.textContent = ''; }
}
function collectStage() {
  const t = getCur(); if (!t) return;
  const key = STAGE_META[curStage].key;
  const d = t.stageData[key] || {};
  if (key === 'define') { d.core = el('f-core').value; d.goal = el('f-goal').value; d.blocker = el('f-blocker').value; d.success = el('f-success').value; }
  else if (key === 'collab') { d.leaning = el('f-leaning').value; d.risk = el('f-risk').checked; }
  else if (key === 'verify') { d.action = el('f-action').value; d.expected = el('f-expected').value; d.actual = el('f-actual').value; d.source = el('f-source').value; d.risk = el('f-risk').checked; if (!d.judgment) d.judgment = el('j-valid').classList.contains('on') ? 'valid' : (el('j-wrong').classList.contains('on') ? 'wrong' : null); }
  else if (key === 'improve') { d.note = el('f-note').value; }
  t.stageData[key] = d; t.updatedAt = Date.now(); save();
}
function onStageInput() {
  collectStage();
  const t = getCur();
  el('summary-card').innerHTML = summaryHTML(t, STAGE_META[curStage].key);
  updateGate();
}
function nextStage() {
  const t = getCur(); if (!t) return;
  collectStage();
  if (curStage < 5) { t.stagePointer = curStage + 1; curStage = curStage + 1; save(); renderStage(); }
  else { t.status = 'done'; t.stagePointer = 5; save(); goHome(); toast('收尾啦 🎉'); }
}
function saveDraft() {
  if (curThreadId) { collectStage(); toast('已存草稿 💾'); }
  else toast('没有可保存的内容');
}
document.addEventListener('input', e => {
  if (el('s-stage').classList.contains('active') && e.target.closest('#stage-body')) onStageInput();
});

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
  const defined = threads.filter(t => t.stageData.define && t.stageData.define.core).length;
  const verified = threads.filter(t => t.stageData.verify && t.stageData.verify.actual).length;
  const judged = threads.filter(t => t.stageData.collab && t.stageData.collab.leaning).length;
  const risk = threads.filter(t => t.stageData.collab && t.stageData.collab.risk).length;
  const score = Math.min(100, total * 10 + defined * 15 + verified * 20);
  el('ring-num').textContent = score;
  el('grow-label').textContent = total ? '思维肌肉 · 成长中' : '思维肌肉';
  el('grow-sub').textContent = total ? `发现 ${total} · 定义 ${defined} · 验证 ${verified}` : '先去记下你的第一条线索吧';
  const disc = Math.min(100, total * 12);
  const def = total ? Math.round(defined / total * 100) : 0;
  const ver = total ? Math.round(verified / total * 100) : 0;
  const cal = total ? Math.round(judged / total * 100) : 0;
  el('radar-svg').innerHTML = drawRadar([disc, def, ver, cal]);
  const weak = Math.min(disc, def, ver, cal);
  el('radar-note').textContent = total ? `最弱项已用橙色标出，优先练 💪（当前最弱 ${weak}）` : '记几条线索后，这里会画出你的能力雷达';
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
  renderHomeThreads();
  if (!DB.user.ageConfirmed) el('age-gate').classList.add('active');
  else el('age-gate').classList.remove('active');
}
init();
