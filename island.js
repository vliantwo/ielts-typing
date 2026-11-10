/* ISLAND
 * 每日计划 + 灵动岛
 * 由原单文件 app.js 按功能拆出，加载顺序：core → words → island → modes
 */
'use strict';

/* ================= 每日计划：打卡 / 热力图 / 提醒 ================= */
const K_PLAN = 'ieltsType.plan';
/* 读取计划，无数据时返回默认结构 */
function getPlan(){
  return store.get(K_PLAN, { goal: 20, days: {}, remind: '', remindOn: false, lastRemind: '' });
}
function setPlan(p){ store.set(K_PLAN, p); }
/* 本地时区 YYYY-MM-DD（toISOString 返回 UTC，会串日期，不能用） */
function dayKeyOf(dt){
  return dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
}
function todayKey(){ return dayKeyOf(new Date()); }
/* 每次评分后累计答题数；新词/复习分开记，达到目标自动打卡 */
function planBump(isNew){
  const p = getPlan();
  const k = todayKey();
  const d = p.days[k] || { ans: 0, rv: 0, nw: 0, ok: false };
  d.ans++;
  if(isNew) d.nw++; else d.rv++;
  let justOk = false;
  if(d.ans >= p.goal && !d.ok){ d.ok = true; justOk = true; }
  p.days[k] = d;
  setPlan(p);
  if(justOk){
    const streak = planStreak(p);
    toast('今日打卡成功 · 连续 ' + streak + ' 天', 3500);
    beep('done');
  }
}
/* 连续打卡天数：从今天（若已达标）或昨天（若今天未达标）向前数 */
function planStreak(p){
  const d = new Date();
  const k0 = todayKey();
  if(!(p.days[k0] && p.days[k0].ok)) d.setDate(d.getDate() - 1);
  let n = 0;
  while(true){
    const k = dayKeyOf(d);
    if(p.days[k] && p.days[k].ok){ n++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return n;
}
/* 提醒定时器：30 秒检查一次，仅页面打开时有效，每天最多触发一次 */
setInterval(() => {
  const p = getPlan();
  if(!p.remindOn || !p.remind) return;
  const now = new Date();
  const hm = p.remind.split(':').map(Number);
  const cur = now.getHours() * 60 + now.getMinutes();
  const target = hm[0] * 60 + hm[1];
  const k = todayKey();
  if(cur >= target && !(p.days[k] && p.days[k].ok) && p.lastRemind !== k){
    const rec = p.days[k];
    const left = Math.max(0, p.goal - (rec ? rec.ans : 0));
    toast('到点背单词啦 —— 今日目标还差 ' + left + ' 题', 6000);
    beep('alarm');
    p.lastRemind = k;
    setPlan(p);
  }
}, 30000);

/* ================= 灵动岛 ================= */
const ISL_NAMES = { idle: '雅思训练台', typing: '打字练习', essay: '写作模拟', reading: '阅读理解', words: '单词记忆', dict: '听写练习', shadow: '跟读练习' };
const island = { open: false, mode: 'idle', icon: '', text: '' };
function islandSet(icon, text, mode){
  island.icon = icon; island.text = text;
  if(mode) island.mode = mode;
  if(!island.open) $('#isl-mini').innerHTML = (icon ? '<span class="isl-ic">' + icon + '</span>' : '') + '<span>' + esc(text) + '</span>';
}
function islandIdle(){
  const now = new Date(), pad = n => String(n).padStart(2, '0');
  const p = getPlan();
  const k = todayKey();
  const t = p.days[k] || {};
  const learned = WORDS.filter(w => WREC[w.id]).length;
  const streak = planStreak(p);
  if(streak > 0){
    islandSet('', pad(now.getHours()) + ':' + pad(now.getMinutes()) + ' · 🔥' + streak + '天 · ' + (t.ans || 0) + '/' + p.goal + '题', 'idle');
  }else{
    islandSet('', pad(now.getHours()) + ':' + pad(now.getMinutes()) + (learned ? ' · 今日词库 ' + learned + ' 词' : ' · 点我开始'), 'idle');
  }
}
function islandPulse(){
  const el = $('#island');
  el.classList.remove('pulse');
  void el.offsetWidth;
  el.classList.add('pulse');
}
/* 面板高度按内容自适应，避免内容被 212px 高度裁掉（仅展开态生效，收起时必须清掉，否则岛会被撑成大椭圆） */
function islandFit(){
  const el = $('#island'), panel = $('#isl-panel');
  if(!el || !panel) return;
  if(!island.open){ el.style.height = ''; return; }
  const max = Math.max(160, window.innerHeight - 40);
  el.style.height = Math.min(panel.scrollHeight, max) + 'px';
}
function islandClose(){
  const el = $('#island');
  el.classList.remove('open');
  el.style.height = '';
  island.open = false;
}
function islandRenderPanel(){
  if(island.mode === 'idle'){
    const p = getPlan();
    const k = todayKey();
    const t = p.days[k] || { ans:0, rv:0, nw:0, ok:false };
    const due = WORDS.filter(w => WREC[w.id] && WREC[w.id].due <= Date.now()).length;
    const fresh = WORDS.filter(w => !WREC[w.id]).length;
    const dailyNew = (document.getElementById('w-daily') || {}).value || 10;
    const streak = planStreak(p);
    const learned = WORDS.filter(w => WREC[w.id]).length;
    const left = Math.max(0, p.goal - t.ans);
    const pct = Math.min(100, Math.round(t.ans / Math.max(1, p.goal) * 100));
    /* 近 HEAT_DAYS 天打卡：达标打 ✓，练了未达标打 ·，今天描边 */
    let heat = '', heatOk = 0;
    const nowD = new Date();
    const WK = ['日','一','二','三','四','五','六'];
    for(let i = HEAT_DAYS - 1; i >= 0; i--){
      const d = new Date(nowD); d.setDate(d.getDate() - i);
      const dk = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      const rec = p.days[dk], ans = (rec && rec.ans) || 0, ok = !!(rec && rec.ok);
      let cls = '';
      if(ok){ cls = ' ok'; heatOk++; }
      else if(ans > 0){ cls = ' part'; }
      /* 格子里显示日期（几号），一眼能看出是每一天 */
      heat += '<span class="iph' + cls + (i === 0 ? ' today' : '') + '" title="'
        + dk + ' 周' + WK[d.getDay()] + ' · ' + ans + ' 题' + (ok ? ' · 已打卡' : '') + '">' + d.getDate() + '</span>';
    }
    $('#isl-panel').innerHTML =
      '<div class="isl-head">'
      +   '<span>今日计划</span>'
      +   '<span class="isl-streak' + (streak > 0 ? '' : ' idle') + '">' + (streak > 0 ? '🔥 ' + streak + '天' : '尚未打卡') + '</span>'
      + '</div>'
      + '<div class="isl-sub">' + (t.ok ? '已打卡 ✓' : '还差 ' + left + ' 题达标') + '</div>'
      + '<div class="isl-plan-bar"><div style="width:' + pct + '%"></div></div>'
      + '<div class="isl-plan-tasks">'
      +   '<div class="isl-plan-row"><span>📖 复习到期</span><b>' + due + ' 词 · 已练 ' + t.rv + '</b></div>'
      +   '<div class="isl-plan-row"><span>✨ 新词目标</span><b>' + dailyNew + ' 个 · 已学 ' + t.nw + '</b></div>'
      +   '<div class="isl-plan-row"><span>🎯 答题目标</span><b>' + t.ans + ' / ' + p.goal + (t.ok ? ' ✓' : '') + '</b></div>'
      + '</div>'
      + '<div class="isl-heat-cap"><span>近 ' + HEAT_DAYS + ' 天打卡</span><b>' + heatOk + ' 天达标</b></div>'
      + '<div class="isl-plan-heat">' + heat + '</div>'
      + '<div class="isl-plan-sets">'
      +   '<label>目标 <select class="plan-goal isl-sel">' + [10,20,30,50,100].map(n => '<option value="'+n+'"' + (n===p.goal?' selected':'') + '>'+n+'</option>').join('') + '</select></label>'
      +   '<label><input type="time" class="plan-remind isl-time" value="' + esc(p.remind || '') + '"></label>'
      +   '<label><input type="checkbox" class="plan-remind-on"' + (p.remindOn?' checked':'') + '></label>'
      + '</div>'
      + '<div class="isl-foot-mini">已学 ' + learned + '/' + WORDS.length + ' · 待复习 ' + due + ' · 新词 ' + fresh + '</div>'
      + '<div class="isl-btns"><button class="isl-btn ghost" data-isl="close">收起</button><button class="isl-btn primary" id="isl-start">开始今日学习 →</button></div>';
    /* 用 onchange 赋值而非 addEventListener：#isl-panel 是常驻节点，每次渲染都 add 会不断叠加监听 */
    const panel = $('#isl-panel');
    panel.onchange = e => {
      const tg = e.target;
      if(!tg || !tg.classList) return;
      const pp = getPlan();
      if(tg.classList.contains('plan-goal')){
        pp.goal = parseInt(tg.value, 10) || 20;
        /* 目标被调低到今日已完成题数以下时直接算达标，避免显示「还差 0 题」却没打卡 */
        const rec = pp.days[todayKey()];
        if(rec && rec.ans >= pp.goal) rec.ok = true;
      }
      else if(tg.classList.contains('plan-remind')){ pp.remind = tg.value || ''; }
      else if(tg.classList.contains('plan-remind-on')){ pp.remindOn = !!tg.checked; }
      else return;
      setPlan(pp);
      islandRenderPanel();   // 设置变了就重渲染面板
    };
    const startBtn = panel.querySelector('#isl-start');
    if(startBtn) startBtn.onclick = () => {
      islandClose();
      startSession();    // 默认今日学习（startSession 无参 = 全部词库）
    };
    islandFit();
    return;   // idle 已处理，不走后面的通用渲染
  }
  const cells = [];
  const t = id => { const el = document.getElementById(id); return el ? el.textContent.trim() : '—'; };
  if(island.mode === 'typing'){
    cells.push(['速度', t('t-wpm') + ' WPM'], ['正确率', t('t-acc')], ['进度', t('t-prog')], ['用时', t('t-time')]);
  }else if(island.mode === 'essay'){
    cells.push(['剩余时间', t('essay-time')], ['字数', t('essay-words')], ['词数徽标', t('essay-badge') || '—'], ['模式', '写作模拟']);
  }else if(island.mode === 'reading'){
    cells.push(['剩余时间', t('rd-time')], ['已答', t('rd-ans') + '/' + t('rd-total')], ['状态', '进行中'], ['交卷', '点右侧按钮']);
  }else if(island.mode === 'words'){
    const bar = document.getElementById('w-st-bar');
    cells.push(['本轮进度', bar ? bar.style.width : '—'], ['当前组', (document.getElementById('w-st-title') || {}).textContent || '—'], ['引擎', '记忆曲线'], ['技巧', '忘记→快复习']);
  }else if(island.mode === 'dict'){
    cells.push(['进度', t('dict-pos')], ['完全正确', t('dict-score')], ['模式', '听写'], ['提示', '可重听']);
  }else if(island.mode === 'shadow'){
    cells.push(['当前句', t('sh-idx') + '/' + t('sh-total')], ['模式', '跟读'], ['技巧', '模仿语调'], ['提示', '循环播放']);
  }
  $('#isl-panel').innerHTML =
    '<div class="isl-head">' + (ISL_NAMES[island.mode] || island.mode) + '</div>'
    + '<div class="isl-stats">' + cells.map(c => '<div class="isl-cell"><i>' + esc(c[0]) + '</i><b>' + esc(String(c[1])) + '</b></div>').join('') + '</div>'
    + '<div class="isl-btns"><button class="isl-btn ghost" data-isl="close">收起</button>'
    + '</div>';
  islandFit();
}
/* 点击岛外任意处自动收起 */
document.addEventListener('click', e => {
  if(island.open && !e.target.closest('#island')){
    islandClose();
  }
});
$('#island').addEventListener('click', e => {
  const act = e.target.closest('[data-isl]');
  if(act){
    e.stopPropagation();
    if(act.dataset.isl === 'close'){ islandClose(); }
    else if(act.dataset.isl === 'home'){ islandClose(); closeModal(); goHome(); }
    return;
  }
  /* 展开态点面板里的控件（目标下拉 / 提醒时间 / 开关）时不要被当成「点岛」而收起 */
  if(island.open && e.target.closest('.isl-panel')) return;
  island.open = !island.open;
  $('#island').classList.toggle('open', island.open);
  if(island.open) islandRenderPanel(); else $('#island').style.height = '';
});
setInterval(() => { if(island.mode === 'idle') islandIdle(); }, ISLAND_IDLE_MS);
/* 窗口尺寸变化（手机旋转/缩放）后按内容重新算高度，否则展开面板会留白或被裁 */
window.addEventListener('resize', () => { if(island.open) islandFit(); });
islandIdle();

/* 回车键快捷操作：单词学习卡确认/翻面，跟读模式下一句 */
document.addEventListener('keydown', e => {
  if(e.key !== 'Enter' || e.isComposing) return;
  if(e.target && (e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON' || e.target.id === 'w-in')) return;
  if(document.getElementById('modal').classList.contains('open')) return;
  if(curView === 'words' && document.getElementById('w-study').style.display !== 'none'){
    const act = document.getElementById('w-go-spell') || document.getElementById('w-reveal') || document.querySelector('#w-card [data-g="2"]');
    if(act){ e.preventDefault(); act.click(); }
  }else if(curView === 'shadow' && document.getElementById('sh-test').style.display !== 'none'){
    const nx = document.getElementById('sh-next');
    if(nx){ e.preventDefault(); nx.click(); }
  }
});

/* 按压涟漪反馈 */
document.addEventListener('pointerdown', e => {
  const b = e.target.closest('.btn, .w-btn, .playbtn, .w-say');
  if(!b || b.disabled) return;
  const r = b.getBoundingClientRect();
  const d = Math.max(r.width, r.height) * 2.2;
  const s = document.createElement('span');
  s.className = 'ripple';
  s.style.width = s.style.height = d + 'px';
  s.style.left = (e.clientX - r.left - d / 2) + 'px';
  s.style.top = (e.clientY - r.top - d / 2) + 'px';
  b.appendChild(s);
  setTimeout(() => s.remove(), 600);
});
