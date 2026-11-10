/* MODES
 * 四种练习模式（打字 / 写作 / 听写 / 阅读 / 跟读）+ 全局事件绑定与初始化
 * 由原单文件 app.js 按功能拆出，加载顺序：core → words → island → modes
 */
'use strict';

/* ================= 打字练习 ================= */
const drill = { source:'', typed:'', spans:[], startTs:0, timer:null, keys:0, err:0, correct:0, done:false, miss:{}, id:'', title:'' };
const ta = $('#type-input');

function startDrill(id, title, text){
  Object.assign(drill, { source:text, typed:'', spans:[], startTs:0, timer:null, keys:0, err:0, correct:0, done:false, miss:{}, id, title });
  ta.value = '';
  $('#t-title').textContent = title;
  drill.zh = ZH[drill.id] || null;
  renderSource();
  $('#t-time').textContent = '00:00'; $('#t-wpm').textContent = '0';
  $('#t-acc').textContent = '100%'; $('#t-prog').textContent = '0%';
  $('#t-bar').style.width = '0%';
  $('#btn-zh').style.display = drill.zh ? '' : 'none';
  setZhOn(store.get('ieltsType.zhOn', true));
  if(drill.spans.length) placeAnchor(drill.spans[0]);
  showView('type');
  setTimeout(() => ta.focus(), 60);
}
function renderSource(){
  const box = $('#type-source'); box.innerHTML = '';
  const paras = drill.source.split(/\n+/);
  const seps = drill.source.match(/\n+/g) || [];
  const zhs = drill.zh ? drill.zh.split(/\n+/).filter(x => x.trim()) : null;
  drill.spans = [];
  const frag = document.createDocumentFragment();
  paras.forEach((p, j) => {
    const pd = document.createElement('div');
    pd.className = 'src-para';
    for(const ch of p){
      const sp = document.createElement('span'); sp.className = 'ch';
      sp.textContent = ch;
      pd.appendChild(sp); drill.spans.push(sp);
    }
    if(seps[j]){
      for(const ch of seps[j]){
        const sp = document.createElement('span'); sp.className = 'ch nl';
        sp.textContent = '⏎';
        pd.appendChild(sp); drill.spans.push(sp);
      }
    }
    if(zhs && zhs[j] !== undefined){
      const z = document.createElement('div');
      z.className = 'para-zh';
      z.textContent = zhs[j];
      pd.appendChild(z);
    }
    frag.appendChild(pd);
  });
  box.appendChild(frag);
}
function setZhOn(on){
  drill.zhOn = on;
  $('#type-source').classList.toggle('no-zh', !on);
  const b = $('#btn-zh');
  b.classList.toggle('on', on);
  b.textContent = on ? '中文对照 开' : '中文对照 关';
}
ta.addEventListener('keydown', e => {
  if(drill.done) return;
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key)) e.preventDefault();
  else if(e.key === 'Tab') e.preventDefault();
  else if((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'v'){ e.preventDefault(); toast('练习中禁止粘贴，请手动输入'); }
});
ta.addEventListener('paste', e => { e.preventDefault(); toast('练习中禁止粘贴，请手动输入'); });
ta.addEventListener('mousedown', e => { e.preventDefault(); ta.focus(); });
ta.addEventListener('input', () => {
  if(drill.done) return;
  let v = ta.value.replace(/\r\n?/g, '\n');
  if(v.length > drill.source.length) v = v.slice(0, drill.source.length);
  ta.value = v; /* 重新赋值同时把光标固定到末尾，只允许向后追加 */
  if(v.length && !drill.startTs){
    drill.startTs = Date.now();
    drill.timer = setInterval(() => { $('#t-time').textContent = fmtTime((Date.now() - drill.startTs) / 1000); }, 250);
  }
  const prev = drill.typed.length;
  for(let i = prev; i < v.length; i++){
    drill.keys++;
    if(v[i] !== drill.source[i]){ drill.err++; drill.miss[drill.source[i]] = (drill.miss[drill.source[i]] || 0) + 1; }
  }
  drill.typed = v;
  refreshDrill();
  if(v.length >= drill.source.length && drill.source.length) finishDrill();
});
$('#type-area').addEventListener('click', () => ta.focus());

function refreshDrill(){
  const s = drill.source, t = drill.typed;
  let correct = 0;
  for(let i = 0; i < drill.spans.length; i++){
    const el = drill.spans[i];
    el.classList.remove('ok', 'bad', 'cur');
    if(i < t.length){
      if(t[i] === s[i]){ el.classList.add('ok'); correct++; } else el.classList.add('bad');
    }else if(i === t.length) el.classList.add('cur');
  }
  drill.correct = correct;
  islandSet('', (drill.startTs ? Math.round((correct / 5) / ((Date.now() - drill.startTs) / 60000)) : 0) + ' WPM · ' + fmtTime(drill.startTs ? (Date.now() - drill.startTs) / 1000 : 0), 'typing');
  const prog = s.length ? Math.round(t.length / s.length * 100) : 0;
  $('#t-bar').style.width = prog + '%';
  $('#t-prog').textContent = prog + '%';
  const acc = drill.keys ? Math.max(0, Math.round((1 - drill.err / drill.keys) * 100)) : 100;
  $('#t-acc').textContent = acc + '%';
  const el = drill.startTs ? (Date.now() - drill.startTs) / 1000 : 0;
  $('#t-wpm').textContent = el > 0 ? Math.round((correct / 5) / (el / 60)) : 0;
  $('#t-time').textContent = fmtTime(el);
  const cur = drill.spans[Math.min(t.length, drill.spans.length - 1)];
  if(cur){
    cur.scrollIntoView({ block: 'center' });
    placeAnchor(cur);
  }
}
/* 把隐形输入框(光标锚点)移到当前字符处，让浏览器的原生光标滚动与实际打字位置一致，避免页面乱跳 */
function placeAnchor(cur){
  ta.style.left = cur.offsetLeft + 'px';
  ta.style.top = cur.offsetTop + 'px';
}
function finishDrill(){
  if(drill.done) return;
  drill.done = true;
  clearInterval(drill.timer);
  const sec = drill.startTs ? (Date.now() - drill.startTs) / 1000 : 0;
  const acc = drill.keys ? Math.max(0, Math.round((1 - drill.err / drill.keys) * 100)) : 100;
  const wpm = sec > 0 ? Math.round((drill.correct / 5) / (sec / 60)) : 0;
  let unfixed = 0;
  for(let i = 0; i < drill.typed.length; i++) if(drill.typed[i] !== drill.source[i]) unfixed++;
  const best = store.get('ieltsType.best', {});
  let isNew = false;
  if(drill.id && (!best[drill.id] || wpm > (best[drill.id].wpm || 0))){
    best[drill.id] = { wpm, acc, date: new Date().toLocaleDateString('zh-CN') };
    store.set('ieltsType.best', best);
    isNew = true;
  }
  beep('done');
  islandPulse();
  const missArr = Object.entries(drill.miss).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const bestLine = isNew
    ? '<div class="newrecord">新纪录！已保存为该文章最佳成绩</div>'
    : (best[drill.id] ? '<div class="kv">该文章最佳：' + best[drill.id].wpm + ' WPM · ' + best[drill.id].acc + '%</div>' : '');
  showModal(
    '<h3>练习完成</h3>' +
    '<div class="bigstats">' +
      '<div class="bigstat"><i>速度</i><b>' + wpm + '</b><i>WPM</i></div>' +
      '<div class="bigstat"><i>正确率</i><b>' + acc + '%</b><i>&nbsp;</i></div>' +
      '<div class="bigstat"><i>用时</i><b>' + fmtTime(sec) + '</b><i>&nbsp;</i></div>' +
    '</div>' +
    '<div class="kv">键入字符 ' + drill.keys + ' · 错误按键 ' + drill.err + ' 次 · 未改正 ' + unfixed + ' 处</div>' +
    bestLine +
    (missArr.length ? '<div class="kv" style="margin-top:10px">易错字符：' + missArr.map(([c, n]) => '<span class="miss-chip">' + (c === ' ' ? '空格' : esc(c)) + ' ×' + n + '</span>').join('') + '</div>' : '') +
    '<div class="modal-actions">' +
      '<button class="btn primary" data-act="retry">再练一次</button>' +
      '<button class="btn" data-act="home">换一篇 / 返回</button>' +
    '</div>'
  );
}

/* ================= 写作模拟 ================= */
const essay = { id:'', prompt:'', min:250, dur:2400, left:2400, started:false, paused:false, over:false, timer:null };

function startEssay(id, prompt, min){
  clearInterval(essay.timer);
  Object.assign(essay, { id, prompt, min, started:false, paused:false, over:false, timer:null });
  const d = store.get('ielts.draft.' + id, null);
  if(d && d.text && d.text.trim() && d.left != null && d.dur != null){
    essay.dur = d.dur; essay.left = d.left;
    const m = essay.left / 60;
    $('#essay-dur').value = String([20, 40, 60].reduce((a, b) => Math.abs(b - m) < Math.abs(a - m) ? b : a));
  }else{
    essay.dur = parseInt($('#essay-dur').value, 10) * 60 || 2400;
    essay.left = essay.dur;
    store.del('ielts.draft.' + id);
  }
  const restored = !!(d && d.text && d.text.trim() && d.left != null);
  const mit0 = LIB.find(x => x.id === id);
  if(!restored && mit0 && mit0.kind === 't1'){
    $('#essay-dur').value = '20';
    essay.dur = 1200; essay.left = 1200;
  }
  $('#essay-prompt').textContent = prompt;
  $('#essay-chart').innerHTML = (mit0 && mit0.chart) ? '<div class="chart-box">' + mit0.chart + '</div>' : '';
  $('#essay-chart').style.display = (mit0 && mit0.chart) ? '' : 'none';
  const tipsHtml = (mit0 && mit0.tips) ? '<div class="rd-instr">写法要点</div><ul class="tips-ul">' + mit0.tips.map(t2 => '<li>' + esc(t2) + '</li>').join('') + '</ul>' : '';
  const sentsHtml = (mit0 && mit0.sents) ? '<div class="rd-instr" style="margin-top:12px">常用句型</div>' + mit0.sents.map(s2 => '<div class="sent-item"><div class="sent-en">' + esc(s2[0]) + '</div><div class="sent-zh">' + esc(s2[1]) + '</div></div>').join('') : '';
  $('#essay-tips').innerHTML = tipsHtml + sentsHtml;
  $('#essay-tips').style.display = (tipsHtml || sentsHtml) ? '' : 'none';
  const zc = ZH[id];
  const pzh = ZH_PROMPT[id];
  $('#essay-prompt-zh').style.display = pzh ? '' : 'none';
  $('#essay-prompt-zh').textContent = pzh ? '题目大意：' + pzh : '';
  const mit = LIB.find(x => x.id === id);
  if(mit && zc){
    $('#essay-model').style.display = '';
    $('#essay-model').open = false;
    const body = $('#essay-model-body'); body.innerHTML = '';
    const ens = mit.text.split(/\n+/).map(x => x.trim()).filter(Boolean);
    const zhs = zc.split(/\n+/).map(x => x.trim()).filter(Boolean);
    ens.forEach((p, i) => {
      const e = document.createElement('div'); e.className = 'm-en'; e.textContent = p; body.appendChild(e);
      if(zhs[i]){ const z = document.createElement('div'); z.className = 'm-zh'; z.textContent = zhs[i]; body.appendChild(z); }
    });
  }else $('#essay-model').style.display = 'none';
  $('#essay-target').textContent = '最低字数：' + min + ' 词 · 计时从你敲下第一个字母开始';
  $('#essay-time').textContent = fmtTime(essay.left);
  $('#essay-time').classList.remove('warn');
  $('#essay-words').textContent = '0';
  $('#essay-badge').textContent = '';
  $('#essay-badge').className = 'wbadge';
  $('#essay-input').value = restored ? d.text : '';
  $('#essay-input').readOnly = false;
  $('#btn-essay-pause').disabled = true;
  $('#btn-essay-pause').textContent = '暂停计时';
  showView('essay');
  setTimeout(() => $('#essay-input').focus(), 60);
  if(restored) toast('已恢复上次草稿（' + countWords(d.text) + ' 词）');
}
$('#essay-input').addEventListener('input', () => {
  if(essay.over) return;
  if(!essay.started){
    essay.started = true;
    essay.timer = setInterval(essayTick, 500);
    $('#btn-essay-pause').disabled = false;
  }
  updateEssayBadge();
  store.set('ielts.draft.' + essay.id, { text: $('#essay-input').value, left: Math.round(essay.left), dur: essay.dur }, '写作草稿');
});
$('#essay-input').addEventListener('keydown', e => { if(e.key === 'Tab') e.preventDefault(); });
function updateEssayBadge(){
  const w = countWords($('#essay-input').value.replace(/\r/g, ''));
  $('#essay-words').textContent = w;
  const b = $('#essay-badge');
  if(w === 0){ b.textContent = ''; b.className = 'wbadge'; }
  else if(w < essay.min){ b.textContent = '还差 ' + (essay.min - w) + ' 词达标'; b.className = 'wbadge low'; }
  else if(w <= essay.min + 80){ b.textContent = '字数达标 ✓'; b.className = 'wbadge good'; }
  else{ b.textContent = '字数偏多，注意质量'; b.className = 'wbadge mid'; }
}
function essayTick(){
  if(essay.paused || !essay.started || essay.over) return;
  essay.left -= 0.5;
  if(essay.left <= 0){ essay.left = 0; $('#essay-time').textContent = '00:00'; finishEssay(true); return; }
  $('#essay-time').textContent = fmtTime(essay.left);
  $('#essay-time').classList.toggle('warn', essay.left <= 300);
  islandSet('', '写作 ' + fmtTime(essay.left), 'essay');
}
$('#essay-dur').onchange = e => {
  if(essay.started){ toast('已开始作答，时长不能再修改'); e.target.value = String(Math.round(essay.dur / 60)); return; }
  essay.dur = parseInt(e.target.value, 10) * 60;
  essay.left = essay.dur;
  $('#essay-time').textContent = fmtTime(essay.left);
  $('#essay-time').classList.remove('warn');
};
$('#btn-essay-pause').onclick = () => {
  if(!essay.started || essay.over) return;
  essay.paused = !essay.paused;
  $('#btn-essay-pause').textContent = essay.paused ? '继续计时' : '暂停计时';
  toast(essay.paused ? '计时已暂停（仅供练习）' : '计时继续');
};
$('#btn-essay-submit').onclick = () => finishEssay(false);

/* 保存当前作文为本地 txt 文件（右上角按钮 + 提交弹窗共用） */
function essaySaveFile(){
  const text = $('#essay-input').value.replace(/\r/g, '');
  if(!text.trim()){ toast('还没有内容，先写点吧'); return; }
  const id = essay.id || 'essay';
  const mit = LIB.find(x => x.id === id);
  const src = mit ? mit.title : (id === 'custom' ? '自定义题目' : id);
  const d = new Date(), p2 = n => String(n).padStart(2, '0');
  const ymd = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  const hm = p2(d.getHours()) + ':' + p2(d.getMinutes());
  const head =
    '【题目】' + (essay.prompt || src) + '\r\n' +
    '【来源】' + src + '（' + id + '）\r\n' +
    '【字数】' + countWords(text) + ' 词\r\n' +
    '【保存时间】' + ymd + ' ' + hm + ':' + p2(d.getSeconds()) + '\r\n' +
    '\r\n' + '─'.repeat(28) + '\r\n\r\n';
  const safe = s => String(s).replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 40) || '作文';
  const name = '雅思作文-' + safe(src) + '-' + ymd.replace(/-/g, '') + '-' + hm.replace(':', '') + '.txt';
  // 带 BOM，避免 Windows 记事本打开中文乱码
  const blob = new Blob(['\ufeff' + head + text + '\r\n'], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  toast('已保存到下载目录：' + name, 6000);
}
$('#btn-essay-save').onclick = essaySaveFile;
function finishEssay(auto){
  if(essay.over) return;
  essay.over = true;
  clearInterval(essay.timer);
  const text = $('#essay-input').value.replace(/\r/g, '');
  const used = auto ? essay.dur : (essay.started ? essay.dur - essay.left : 0);
  const words = countWords(text);
  const paras = text.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean).length;
  const linkers = ['however','moreover','furthermore','in addition','therefore','consequently','nevertheless','on the other hand','for instance','for example','in conclusion','firstly','secondly','finally','although','whereas','despite','in contrast','as a result','similarly','overall'];
  const low = ' ' + text.toLowerCase().replace(/[^a-z'\s]/g, ' ').replace(/\s+/g, ' ') + ' ';
  const lk = linkers.map(l => {
    const pat = ' ' + l + ' '; let c = 0, idx = 0;
    while((idx = low.indexOf(pat, idx)) !== -1){ c++; idx += 1; }
    return [l, c];
  }).filter(x => x[1] > 0);
  store.del('ielts.draft.' + essay.id);
  $('#essay-input').readOnly = true;
  if(auto) beep('alarm');
  islandPulse();
  showModal(
    '<h3>' + (auto ? '时间到，已自动提交' : '写作已提交') + '</h3>' +
    '<div class="bigstats">' +
      '<div class="bigstat"><i>用时</i><b>' + fmtTime(used) + '</b><i>&nbsp;</i></div>' +
      '<div class="bigstat"><i>字数</i><b>' + words + '</b><i>words</i></div>' +
      '<div class="bigstat"><i>段落</i><b>' + paras + '</b><i>&nbsp;</i></div>' +
    '</div>' +
    '<div class="kv">' + (words < essay.min ? '字数低于 ' + essay.min + ' 词，考试中会被扣分（任务完成度）' : '字数达到 ' + essay.min + ' 词要求') + '</div>' +
    (lk.length
      ? '<div class="kv" style="margin-top:8px">连接词使用：' + lk.map(([w, c]) => '<span class="miss-chip ok">' + esc(w) + ' ×' + c + '</span>').join(' ') + '</div>'
      : '<div class="kv" style="margin-top:8px">未检测到连接词，建议使用 however / moreover / for example 等增强连贯性。</div>') +
    '<div class="modal-actions">' +
      '<button class="btn" data-act="essay-copy">复制全文</button>' +
      '<button class="btn" data-act="essay-save">保存到文件</button>' +
      '<button class="btn primary" data-act="essay-retry">重写一遍</button>' +
      '<button class="btn" data-act="essay-home">返回首页</button>' +
    '</div>'
  );
}

/* ================= 听写练习 ================= */
const dict = { sent:[], idx:0, pass:0, skip:0, wOk:0, wTot:0, rate:parseFloat(store.get('ieltsType.rate', '0.95')), voice:null, id:'', title:'', rawText:'' };

function startDict(id, title, text){
  if(!('speechSynthesis' in window)){ toast('当前浏览器不支持语音朗读，请使用 Edge 或 Chrome'); return; }
  loadVoices();
  const ds = DICT_SENTS[id];
  let pairs = (ds && ds.length)
    ? ds.map(x => ({ en: x.en, zh: x.zh }))
    : splitSentences(text).filter(s => s.length > 2).map(s => ({ en: s, zh: null }));
  if(!pairs.length){ toast('没有可用的句子'); return; }
  if($('#dict-shuffle').checked) pairs = shuffleArr(pairs);
  Object.assign(dict, { id, title, rawText:text, idx:0, pass:0, skip:0, wOk:0, wTot:0,
    sent: pairs.map(p => p.en), zhArr: pairs.map(p => p.zh), hasZh: pairs.some(p => p.zh) });
  $('#dict-title').textContent = title;
  $('#dict-input').value = '';
  $('#dict-fb').innerHTML = '';
  $('#btn-dict-check').disabled = false;
  $('#btn-dict-next').disabled = true;
  showView('dict');
  renderDictMeta();
  buildVoiceSelect();
  setTimeout(() => $('#dict-input').focus(), 80);
  playSentence();
}
function loadVoices(){
  const vs = speechSynthesis.getVoices();
  dict.voice = vs.find(v => /en[-_]GB/i.test(v.lang)) || vs.find(v => v.lang && /^en/i.test(v.lang)) || vs[0] || null;
}
function buildVoiceSelect(){
  const vs = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang));
  const sel = $('#dict-voice'); sel.innerHTML = '';
  if(!vs.length){ sel.innerHTML = '<option>默认语音</option>'; return; }
  vs.forEach(v => {
    const o = document.createElement('option');
    o.value = v.name; o.textContent = v.name + ' (' + v.lang + ')';
    sel.appendChild(o);
  });
  const pick = vs.find(v => /GB/i.test(v.lang)) || vs[0];
  sel.value = pick.name; dict.voice = pick;
  sel.onchange = () => { dict.voice = vs.find(v => v.name === sel.value) || null; playSentence(); };
}
function playSentence(){
  const s = dict.sent[dict.idx]; if(!s) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(s);
  if(dict.voice) u.voice = dict.voice;
  u.lang = dict.voice ? dict.voice.lang : 'en-GB';
  u.rate = dict.rate; u.pitch = 1;
  speechSynthesis.speak(u);
}
function renderDictMeta(){
  $('#dict-pos').textContent = '第 ' + (dict.idx + 1) + ' / ' + dict.sent.length + ' 句' + (dict.skip ? '（跳过 ' + dict.skip + '）' : '');
  $('#dict-score').textContent = '✓ ' + dict.pass;
  $('#btn-dict-zh').style.display = dict.hasZh ? '' : 'none';
  islandSet('', '第 ' + (dict.idx + 1) + '/' + dict.sent.length + ' 句 · ✓' + dict.pass, 'dict');
}
const tok = s => s.trim().split(/\s+/).filter(Boolean);
const wkey = t => t.toLowerCase().replace(/[^a-z0-9']/g, '');
const stripAll = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
function diffSets(a, b){
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for(let i = n - 1; i >= 0; i--) for(let j = m - 1; j >= 0; j--)
    dp[i][j] = a[i] === b[j] ? dp[i+1][j+1] + 1 : Math.max(dp[i+1][j], dp[i][j+1]);
  const ma = new Set(), mb = new Set();
  let i = 0, j = 0;
  while(i < n && j < m){
    if(a[i] === b[j]){ ma.add(i); mb.add(j); i++; j++; }
    else if(dp[i+1][j] >= dp[i][j+1]) i++;
    else j++;
  }
  return { ma, mb };
}
const zhLine = () => dict.hasZh ? '<div class="fb-zh">' + esc(dict.zhArr[dict.idx]) + '</div>' : '';
function dictZhHint(){
  if(!dict.hasZh || $('#dict-fb .fb-zh')) return;
  const d = document.createElement('div'); d.className = 'fb-zh'; d.textContent = '' + dict.zhArr[dict.idx];
  $('#dict-fb').appendChild(d);
}
function checkDict(){
  const target = dict.sent[dict.idx];
  const user = $('#dict-input').value.trim();
  if(!user){ toast('请先输入你听到的句子'); return; }
  const tk0 = tok(target), uk0 = tok(user);
  const tk = tk0.map(wkey), uk = uk0.map(wkey);
  const eq = (tk.join(' ') === uk.join(' ')) || stripAll(user) === stripAll(target);
  const { ma, mb } = diffSets(tk, uk);
  const wok = eq ? tk0.length : ma.size;
  dict.wTot += tk0.length; dict.wOk += wok;
  if(eq) dict.pass++;
  renderDictMeta();
  const fb = $('#dict-fb');
  if(eq){
    fb.innerHTML = '<div class="fb-ok">✓ 完全正确！</div><div class="fb-sent">' + esc(target) + '</div>' + zhLine();
  }else{
    const tl = tk0.map((w, i) => '<span class="' + (ma.has(i) ? 'w-ok' : 'w-miss') + '">' + esc(w) + '</span>').join(' ');
    const ul = uk0.map((w, i) => '<span class="' + (mb.has(i) ? 'w-ok' : 'w-extra') + '">' + esc(w) + '</span>').join(' ') || '<i style="color:#98a2b3">(未输入)</i>';
    fb.innerHTML =
      '<div class="fb-bad">✗ 有 ' + (tk0.length - ma.size) + ' 处不一致</div>' +
      '<div class="fb-line"><span class="fb-label">正确答案</span>' + tl + '</div>' +
      '<div class="fb-line"><span class="fb-label">你的输入</span>' + ul + '</div>' +
      '<div class="fb-tip">点播放键重听对比哪里没听清，然后点「下一句」。</div>' + zhLine();
  }
  $('#btn-dict-check').disabled = true;
  $('#btn-dict-next').disabled = false;
}
function revealDict(){
  const target = dict.sent[dict.idx];
  dict.skip++;
  renderDictMeta();
  $('#dict-fb').innerHTML = '<div class="fb-bad">答案已显示（本句不计入「完全正确」）</div><div class="fb-sent">' + esc(target) + '</div>' + zhLine();
  $('#btn-dict-check').disabled = true;
  $('#btn-dict-next').disabled = false;
}
function nextDict(){
  if(dict.idx + 1 >= dict.sent.length){ finishDict(); return; }
  dict.idx++;
  $('#dict-input').value = '';
  $('#dict-fb').innerHTML = '';
  $('#btn-dict-check').disabled = false;
  $('#btn-dict-next').disabled = true;
  renderDictMeta();
  $('#dict-input').focus();
  playSentence();
}
function finishDict(){
  const acc = dict.wTot ? Math.round(dict.wOk / dict.wTot * 100) : 0;
  beep('done');
  islandPulse();
  showModal(
    '<h3>听写完成</h3>' +
    '<div class="bigstats">' +
      '<div class="bigstat"><i>完全正确</i><b>' + dict.pass + '/' + dict.sent.length + '</b><i>句</i></div>' +
      '<div class="bigstat"><i>单词正确率</i><b>' + acc + '%</b><i>&nbsp;</i></div>' +
      '<div class="bigstat"><i>跳过</i><b>' + dict.skip + '</b><i>句</i></div>' +
    '</div>' +
    '<div class="kv">小建议：反复练同一份材料，直到每句都能一次写对；听力填空最怕的就是拼写。</div>' +
    '<div class="modal-actions">' +
      '<button class="btn primary" data-act="dict-again">再来一轮</button>' +
      '<button class="btn" data-act="dict-home">返回首页</button>' +
    '</div>'
  );
}
$('#dict-input').addEventListener('keydown', e => {
  if(e.key === 'Enter' && !e.shiftKey){
    e.preventDefault();
    if(!$('#btn-dict-check').disabled) checkDict();
    else if(!$('#btn-dict-next').disabled) nextDict();
  }
});
if('speechSynthesis' in window){
  loadVoices();
  speechSynthesis.onvoiceschanged = () => { if(!dict.voice) loadVoices(); };
}

/* ================= 阅读理解引擎 ================= */
const ICO_SAY = '<svg viewBox="0 0 24 24"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6"/><path d="M17.8 6.8a7.6 7.6 0 0 1 0 10.4"/></svg>';
const ROM = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii'];
const rd = { p: null, ans: {}, graded: false, left: 0, timer: null, total: 0, confirmArm: false, unanswered: 0 };
function rdShow(sub){
  $('#rd-home').style.display = sub === 'home' ? '' : 'none';
  $('#rd-test').style.display = sub === 'test' ? '' : 'none';
}
function renderReadingHome(){
  const best = store.get('ieltsType.reading', {});
  const wrap = $('#rd-lists'); wrap.innerHTML = '';
  RD_PASSAGES.forEach(p => {
    const n = rdCount(p);
    const b = best[p.id];
    const div = document.createElement('div');
    div.className = 'w-list';
    div.innerHTML = '<h4>' + esc(p.title) + '</h4>'
      + '<div class="w-meta">' + countWords(p.text) + ' 词 · ' + n + ' 题 · 建议 ' + p.time + ' 分钟' + (b ? ' · 最佳 ' + b.c + '/' + b.t : '') + '</div>'
      + '<div class="w-bar"><div style="width:' + (b ? Math.round(b.c / b.t * 100) : 0) + '%"></div></div>';
    div.onclick = () => startReading(p.id);
    wrap.appendChild(div);
  });
}
function rdCount(p){ let n = 0; p.groups.forEach(g => n += g.items.length); return n; }
function startReading(id){
  const p = RD_PASSAGES.find(x => x.id === id);
  if(rd.timer) clearInterval(rd.timer);
  Object.assign(rd, { p, ans: {}, graded: false, left: p.time * 60, timer: null, total: rdCount(p), confirmArm: false, unanswered: 0 });
  $('#rd-title').textContent = p.title;
  $('#rd-total').textContent = rd.total;
  $('#rd-ans').textContent = '0';
  renderTime();
  $('#btn-rd-submit').textContent = '交卷';
  $('#btn-rd-submit').disabled = false;
  renderPassage();
  renderQuestions(false);
  rdShow('test');
  window.scrollTo(0, 0);
  rd.timer = setInterval(() => {
    rd.left -= 0.5;
    if(rd.left <= 0){ rd.left = 0; renderTime(); gradeReading(true); return; }
    renderTime();
  }, 500);
}
function renderTime(){ const el = $('#rd-time'); el.textContent = fmtTime(rd.left); el.classList.toggle('warn', rd.left <= 60); islandSet('', fmtTime(rd.left) + ' · 已答 ' + filledCount() + '/' + rd.total, 'reading'); }
function renderPassage(){
  const paras = rd.p.text.split(/\n+/);
  $('#rd-passage').innerHTML = '<h3>' + esc(rd.p.title) + '</h3>' + paras.map(t => {
    const m = t.match(/^([A-Z])\s+([\s\S]*)$/);
    return m ? '<p class="rd-para"><b>' + m[1] + '</b>' + esc(m[2]) + '</p>' : '<p class="rd-para">' + esc(t) + '</p>';
  }).join('');
}
function flatItems(){ let n = 0; const out = []; rd.p.groups.forEach(g => g.items.forEach(it => { n++; out.push({ g, it, n }); })); return out; }
function rdIsCorrect(g, it, user){
  if(user === undefined || user === null || user === '') return false;
  if(g.type === 'tf') return user === it.a;
  if(g.type === 'mc' || g.type === 'heads') return Number(user) === it.a;
  if(g.type === 'gap') return [it.a].concat(it.alt || []).some(x => String(x).toLowerCase() === String(user).trim().toLowerCase());
  return false;
}
function filledCount(){ return Object.values(rd.ans).filter(v => v !== '' && v != null).length; }
function updateAnsCount(){ $('#rd-ans').textContent = filledCount(); islandSet('', fmtTime(rd.left) + ' · 已答 ' + filledCount() + '/' + rd.total, 'reading'); }
function renderQuestions(graded){
  let html = '', n = 0;
  rd.p.groups.forEach(g => {
    html += '<div class="rd-group"><h4>' + esc(g.label) + '</h4><div class="rd-instr">' + esc(g.instr) + '</div>';
    if(g.type === 'heads') html += '<div class="rd-instr">' + g.heads.map((h, i) => ROM[i] + '. ' + esc(h)).join('<br>') + '</div>';
    g.items.forEach(it => {
      n++;
      const user = rd.ans[n];
      const ok = graded && rdIsCorrect(g, it, user);
      html += '<div class="rd-q' + (graded ? (ok ? ' ok' : ' bad') : '') + '">';
      html += '<div class="rd-qtext"><span class="rd-qnum">' + n + '</span>';
      if(g.type === 'heads'){
        html += '段落 ' + esc(it.para);
      }else{
        html += esc(it.q).replace('___', '<input class="rd-gap-in" data-gap="' + n + '" value="' + esc(user || '') + '"' + (graded ? ' disabled' : '') + '>');
      }
      if(graded) html += ok ? ' <span class="rd-opt correct" style="cursor:default">✓ 正确</span>' : ' <span class="rd-opt wrongpick" style="cursor:default">✗ 错误</span>';
      html += '</div>';
      if(g.type === 'tf'){
        html += '<div class="rd-opts">' + ['TRUE', 'FALSE', 'NOT GIVEN'].map(o => {
          let cls = 'rd-opt';
          if(!graded && user === o) cls += ' sel';
          if(graded && o === it.a) cls = 'rd-opt correct';
          if(graded && user === o && o !== it.a) cls = 'rd-opt wrongpick';
          return '<button class="' + cls + '" data-tf="' + n + '" data-v="' + o + '"' + (graded ? ' disabled' : '') + '>' + o + '</button>';
        }).join('') + '</div>';
      }else if(g.type === 'mc'){
        html += '<div class="rd-opts rd-mc">' + it.opts.map((o, i) => {
          let cls = 'rd-opt';
          if(!graded && String(user) === String(i)) cls += ' sel';
          if(graded && i === it.a) cls += ' correct';
          if(graded && String(user) === String(i) && i !== it.a) cls += ' wrongpick';
          return '<button class="' + cls + '" data-mc="' + n + '" data-i="' + i + '"' + (graded ? ' disabled' : '') + '>' + String.fromCharCode(65 + i) + '. ' + esc(o) + '</button>';
        }).join('') + '</div>';
      }else if(g.type === 'heads'){
        html += '<div style="margin-top:8px"><select class="rd-sel" data-hd="' + n + '"' + (graded ? ' disabled' : '') + '><option value="">— 选择标题 —</option>'
          + g.heads.map((h, i) => '<option value="' + i + '"' + (String(user) === String(i) ? ' selected' : '') + '>' + ROM[i] + '. ' + esc(h) + '</option>').join('')
          + '</select></div>';
      }
      if(graded){
        let correctText, userText;
        if(g.type === 'tf'){ correctText = it.a; userText = user || '(未答)'; }
        else if(g.type === 'mc'){ correctText = String.fromCharCode(65 + it.a) + '. ' + it.opts[it.a]; userText = user == null || user === '' ? '(未答)' : String.fromCharCode(65 + Number(user)) + '. ' + it.opts[Number(user)]; }
        else if(g.type === 'heads'){ correctText = ROM[it.a] + '. ' + g.heads[it.a]; userText = user == null || user === '' ? '(未答)' : ROM[Number(user)] + '. ' + g.heads[Number(user)]; }
        else { correctText = it.a; userText = user ? esc(user) : '(未填)'; }
        html += '<div class="rd-fb">' + (ok ? '<span class="c">✓ 回答正确</span>' : '<span class="w">你的答案：' + userText + '</span>　') + '<span class="c">正确答案：' + esc(correctText) + '</span><span class="exp">解析：' + esc(it.exp) + '</span></div>';
      }
      html += '</div>';
    });
    html += '</div>';
  });
  $('#rd-questions').innerHTML = html;
}
function gradeReading(auto){
  if(rd.graded) return;
  rd.graded = true;
  clearInterval(rd.timer);
  let c = 0;
  flatItems().forEach(({ g, it, n }) => { if(rdIsCorrect(g, it, rd.ans[n])) c++; });
  const t = rd.total, pct = Math.round(c / t * 100), used = rd.p.time * 60 - rd.left;
  rd.unanswered = t - filledCount();
  const band = pct >= 85 ? '已达到 7 分水平' : pct >= 70 ? '约 6-6.5 分水平' : pct >= 55 ? '约 5.5-6 分水平' : '建议先巩固词汇与长难句';
  const best = store.get('ieltsType.reading', {});
  let isNew = false;
  if(!best[rd.p.id] || c > best[rd.p.id].c){ best[rd.p.id] = { c, t, date: new Date().toLocaleDateString('zh-CN') }; store.set('ieltsType.reading', best); isNew = true; }
  beep(auto ? 'alarm' : 'done');
  islandPulse();
  renderTime();
  renderQuestions(true);
  showModal('<h3>' + (auto ? '时间到，已自动交卷' : '交卷完成') + '</h3>'
    + '<div class="bigstats">'
    + '<div class="bigstat"><i>正确</i><b>' + c + '/' + t + '</b><i>&nbsp;</i></div>'
    + '<div class="bigstat"><i>正确率</i><b>' + pct + '%</b><i>&nbsp;</i></div>'
    + '<div class="bigstat"><i>用时</i><b>' + fmtTime(used) + '</b><i>&nbsp;</i></div>'
    + '</div>'
    + '<div class="kv">' + band + (rd.unanswered ? ' · 有 ' + rd.unanswered + ' 题未作答' : '') + '</div>'
    + (isNew ? '<div class="newrecord">新纪录！' : '<div style="height:8px"></div>')
    + '<div class="modal-actions">'
    + '<button class="btn primary" data-act="rd-review">查看解析</button>'
    + '<button class="btn" data-act="rd-retry">重做</button>'
    + '<button class="btn" data-act="rd-home">返回列表</button>'
    + '</div>');
}
$('#btn-rd-back').onclick = goHome;
$('#btn-rd-exit').onclick = () => { if(rd.timer) clearInterval(rd.timer); rdShow('home'); renderReadingHome(); };
$('#btn-rd-submit').onclick = () => {
  if(rd.graded) return;
  const un = rd.total - filledCount();
  if(!rd.confirmArm && un > 0){ rd.confirmArm = true; toast('还有 ' + un + ' 题未作答，再次点击「交卷」确认提交'); return; }
  gradeReading(false);
};
$('#rd-questions').addEventListener('click', e => {
  const tf = e.target.closest('[data-tf]');
  if(tf && !tf.disabled){ rd.ans[tf.dataset.tf] = tf.dataset.v; [...tf.parentNode.querySelectorAll('.rd-opt')].forEach(b => b.classList.remove('sel')); tf.classList.add('sel'); updateAnsCount(); }
  const mc = e.target.closest('[data-mc]');
  if(mc && !mc.disabled){ rd.ans[mc.dataset.mc] = mc.dataset.i; [...mc.parentNode.querySelectorAll('.rd-opt')].forEach(b => b.classList.remove('sel')); mc.classList.add('sel'); updateAnsCount(); }
});
$('#rd-questions').addEventListener('change', e => {
  const hd = e.target.closest('[data-hd]');
  if(hd){ rd.ans[hd.dataset.hd] = hd.value; updateAnsCount(); }
});
$('#rd-questions').addEventListener('input', e => {
  const gp = e.target.closest('[data-gap]');
  if(gp){ rd.ans[gp.dataset.gap] = gp.value; updateAnsCount(); }
});

/* ================= 跟读练习 ================= */
const SH_SETS = [
  { id: 'l-sec1', name: 'Section 1 · 高频句 14 句' },
  { id: 'l-sec2dir', name: 'Section 2 · 方向与须知 10 句' },
  { id: 'l-sec4notes', name: 'Section 4 · 学术笔记句 10 句' },
  { id: 'b-longsent', name: '进阶 · 长难句 10 句' }
];
const sh = { setIdx: 0, sents: [], idx: 0, done: 0, rec: null, chunks: [], recUrl: null, stream: null, playing: false };
function renderShadowHome(){
  const micOk = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const wrap = $('#sh-lists'); wrap.innerHTML = '';
  SH_SETS.forEach((s, i) => {
    const n = (DICT_SENTS[s.id] || []).length;
    const div = document.createElement('div');
    div.className = 'w-list';
    div.innerHTML = '<h4>' + esc(s.name) + '</h4><div class="w-meta">' + n + ' 句 · 朗读 + 跟读' + (micOk ? ' + 录音对比' : '') + '</div>';
    div.onclick = () => startShadowing(i);
    wrap.appendChild(div);
  });
  if(!micOk){
    const note = document.createElement('div');
    note.className = 'w-empty';
    note.textContent = '当前环境不支持麦克风录音，仍可进行纯跟读练习';
    wrap.appendChild(note);
  }
}
function shShow(sub){
  $('#sh-home').style.display = sub === 'home' ? '' : 'none';
  $('#sh-test').style.display = sub === 'test' ? '' : 'none';
}
function startShadowing(setIdx){
  const s = SH_SETS[setIdx];
  shStopAll();
  Object.assign(sh, { setIdx, sents: (DICT_SENTS[s.id] || []).map(x => x.en), idx: 0, done: 0, rec: null, chunks: [], recUrl: null, stream: null });
  $('#sh-title').textContent = s.name;
  $('#sh-total').textContent = sh.sents.length;
  shShow('test');
  renderShadowCard();
}
function shStopAll(){
  if(window.speechSynthesis) speechSynthesis.cancel();
  sh.playing = false;
  if(sh.stream){ try{ sh.stream.getTracks().forEach(t => t.stop()); }catch(e){} sh.stream = null; }
}
function renderShadowCard(){
  const s = SH_SETS[sh.setIdx];
  const sent = sh.sents[sh.idx];
  const zh = (DICT_SENTS[s.id] || [])[sh.idx];
  $('#sh-idx').textContent = sh.idx + 1;
  islandSet('', '跟读 ' + (sh.idx + 1) + '/' + sh.sents.length, 'shadow');
  const micOk = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  $('#sh-card').innerHTML =
    '<div class="w-kind">跟读 · 听原音 → 模仿 → 对比</div>'
    + '<div class="sh-sent' + (sent.length > 90 ? ' long' : '') + '">' + esc(sent) + '</div>'
    + '<div class="sh-zh" id="sh-zh" style="display:none">' + esc(zh ? zh.zh : '') + '</div>'
    + '<div class="sh-ctrl">'
    + '<button class="w-say" id="sh-play" title="播放原音">' + ICO_SAY + '</button>'
    + '<div class="sh-opts">'
    + '<label class="sh-lab">语速 <select id="sh-rate" class="sel"><option value="0.6">0.6 慢速</option><option value="0.8">0.8 较慢</option><option value="0.95" selected>0.95 标准</option><option value="1.1">1.1 稍快</option></select></label>'
    + '<label class="sh-lab"><input type="checkbox" id="sh-loop"> 循环播放</label>'
    + '<label class="sh-lab"><input type="checkbox" id="sh-showzh"> 显示中文</label>'
    + '</div></div>'
    + (micOk
      ? '<div class="sh-recrow"><button class="btn" id="sh-rec">开始录音</button><audio id="sh-mine" controls style="display:none"></audio></div><div class="w-note">录音后点 ▶ 播放自己的声音，和原音对比语调与重音；可反复重录。</div>'
      : '<div class="w-note">（当前环境不支持麦克风，纯跟读同样有效：听一句，大声模仿一句）</div>')
    + '<div class="w-ops"><button class="btn" id="sh-skip">跳过这句</button>'
    + (sh.idx + 1 < sh.sents.length
      ? '<button class="w-btn plain" id="sh-next">已读顺，下一句 →</button>'
      : '<button class="w-btn good" id="sh-next">完成本轮</button>')
    + '</div>';
  $('#sh-play').onclick = shPlay;
  $('#sh-rate').onchange = () => { if(sh.playing) shPlay(); };
  $('#sh-loop').onchange = e => { if(e.target.checked){ shPlay(); } else { if(window.speechSynthesis) speechSynthesis.cancel(); sh.playing = false; } };
  $('#sh-showzh').onchange = e => { $('#sh-zh').style.display = e.target.checked ? '' : 'none'; };
  if(micOk) $('#sh-rec').onclick = shToggleRec;
  $('#sh-skip').onclick = () => shNext(true);
  $('#sh-next').onclick = () => shNext(false);
  sh.playing = false;
  setTimeout(shPlay, 250);
}
function shPlay(){
  const u = new SpeechSynthesisUtterance(sh.sents[sh.idx]);
  if(dict.voice) u.voice = dict.voice;
  u.lang = dict.voice ? dict.voice.lang : 'en-GB';
  u.rate = parseFloat($('#sh-rate').value) || 0.95;
  sh.playing = true;
  u.onend = () => { if($('#sh-loop') && $('#sh-loop').checked && sh.playing) shPlay(); else sh.playing = false; };
  if(window.speechSynthesis) speechSynthesis.cancel();
  speechSynthesis.speak(u);
}
async function shToggleRec(){
  if(sh.rec){ try{ sh.rec.stop(); }catch(e){} return; }
  try{
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    sh.stream = stream;
    const mr = new MediaRecorder(stream);
    sh.chunks = [];
    mr.ondataavailable = e => { if(e.data && e.data.size) sh.chunks.push(e.data); };
    mr.onstop = () => {
      try{ stream.getTracks().forEach(t => t.stop()); }catch(e){}
      const blob = new Blob(sh.chunks, { type: mr.mimeType || 'audio/webm' });
      if(sh.recUrl) URL.revokeObjectURL(sh.recUrl);
      sh.recUrl = URL.createObjectURL(blob);
      const player = document.getElementById('sh-mine');
      if(player){ player.src = sh.recUrl; player.style.display = ''; }
      sh.rec = null;
      const b = document.getElementById('sh-rec');
      if(b){ b.textContent = '重新录音'; b.classList.remove('rec'); }
    };
    mr.start();
    sh.rec = mr;
    const b = document.getElementById('sh-rec');
    if(b){ b.textContent = '停止录音'; b.classList.add('rec'); }
  }catch(e){
    const b = document.getElementById('sh-rec');
    if(b) b.style.display = 'none';
    toast('无法使用麦克风（' + (e.name || '未知错误') + '），可继续纯跟读');
  }
}
function shNext(skipped){
  shStopAll();
  if(sh.rec){ try{ sh.rec.stop(); }catch(e){} sh.rec = null; }
  if(sh.recUrl){ URL.revokeObjectURL(sh.recUrl); sh.recUrl = null; }
  if(!skipped) sh.done++;
  if(sh.idx + 1 >= sh.sents.length){
    beep('done');
    showModal('<h3>跟读完成</h3>'
      + '<div class="bigstats">'
      + '<div class="bigstat"><i>本轮句子</i><b>' + sh.sents.length + '</b><i>句</i></div>'
      + '<div class="bigstat"><i>主动跟读</i><b>' + sh.done + '</b><i>句</i></div>'
      + '<div class="bigstat"><i>跳过</i><b>' + (sh.sents.length - sh.done) + '</b><i>句</i></div>'
      + '</div>'
      + '<div class="kv">跟读的诀窍是"模仿到像"：注意句子的重音、连读和语调起伏。同一句跟 3 遍比读 10 句新句子更有效。</div>'
      + '<div class="modal-actions">'
      + '<button class="btn primary" data-act="sh-again">再来一轮</button>'
      + '<button class="btn" data-act="sh-home">返回</button>'
      + '</div>');
    shShow('home');
    renderShadowHome();
    return;
  }
  sh.idx++;
  renderShadowCard();
}
$('#btn-sh-back').onclick = goHome;
$('#btn-sh-exit').onclick = () => { shStopAll(); if(sh.rec){ try{ sh.rec.stop(); }catch(e){} sh.rec = null; } shShow('home'); renderShadowHome(); };

/* ================= 弹窗 ================= */
function showModal(html){
  $('#modal-body').innerHTML = html;
  $('#modal').classList.add('open');
}
function closeModal(){ $('#modal').classList.remove('open'); }
$('#modal').addEventListener('click', e => {
  if(e.target === $('#modal')){ closeModal(); return; }
  const act = e.target.closest('[data-act]');
  if(!act) return;
  const a = act.dataset.act;
  if(a === 'retry'){ closeModal(); startDrill(drill.id, drill.title, drill.source); }
  else if(a === 'home'){ closeModal(); goHome(); }
  else if(a === 'dict-again'){ closeModal(); startDict(dict.id, dict.title, dict.rawText); }
  else if(a === 'dict-home'){ closeModal(); goHome(); }
  else if(a === 'essay-copy'){
    const t = $('#essay-input').value;
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(() => toast('已复制全文到剪贴板'), () => toast('复制失败，请手动选择文本'));
    else toast('复制失败，请手动选择文本');
  }
  else if(a === 'essay-save'){ closeModal(); essaySaveFile(); }
  else if(a === 'essay-retry'){ closeModal(); startEssay(essay.id, essay.prompt, essay.min); }
  else if(a === 'essay-home'){ closeModal(); goHome(); }
  else if(a === 'w-again'){ closeModal(); startSession(wSess.scope); }
  else if(a === 'w-home'){ closeModal(); renderWordsHome(); wShow('home'); }
  else if(a === 'rd-review'){ closeModal(); }
  else if(a === 'rd-retry'){ closeModal(); startReading(rd.p.id); }
  else if(a === 'rd-home'){ closeModal(); rdShow('home'); renderReadingHome(); }
  else if(a === 'sh-again'){ closeModal(); startShadowing(sh.setIdx); }
  else if(a === 'sh-home'){ closeModal(); renderShadowHome(); shShow('home'); }
});

/* ================= 全局事件 ================= */
document.addEventListener('keydown', e => {
  if(e.key === 'Escape'){
    if($('#island').classList.contains('open')){ islandClose(); return; }
    if($('#modal').classList.contains('open')){ closeModal(); return; }
    if(curView !== 'home') goHome();
  }
});
$$('.mode-card').forEach(c => c.onclick = () => {
  if(c.dataset.mode === 'words'){
    $$('.mode-card').forEach(x => x.classList.toggle('active', x === c));
    if(window.speechSynthesis) speechSynthesis.cancel();
    showView('words');
    /* 强制回到首页分栏：否则中途离开学习后回来会停在一道已作答、选项全禁用的死题上 */
    wShow('home');
    renderWordsHome();
  }else if(c.dataset.mode === 'reading'){
    $$('.mode-card').forEach(x => x.classList.toggle('active', x === c));
    showView('reading');
    renderReadingHome();
  }else if(c.dataset.mode === 'shadow'){
    $$('.mode-card').forEach(x => x.classList.toggle('active', x === c));
    showView('shadow');
    renderShadowHome();
  }else setMode(c.dataset.mode);
});
$('#custom-textarea').addEventListener('input', () => {
  selId = 'custom';
  $$('.lib-item').forEach(x => x.classList.remove('active'));
  $('#custom-text').classList.add('active-custom');
  $('#custom-essay').classList.remove('active-custom');
});
$('#custom-prompt').addEventListener('input', () => {
  selId = 'custom';
  $$('.lib-item').forEach(x => x.classList.remove('active'));
  $('#custom-essay').classList.add('active-custom');
});
$('#btn-type-back').onclick = goHome;
$('#btn-type-restart').onclick = () => startDrill(drill.id, drill.title, drill.source);
$('#btn-zh').onclick = () => { const on = !drill.zhOn; setZhOn(on); store.set('ieltsType.zhOn', on); };
$('#btn-essay-back').onclick = goHome;
$('#btn-dict-back').onclick = goHome;
$('#btn-dict-play').onclick = playSentence;
$('#btn-dict-zh').onclick = dictZhHint;
$('#btn-dict-reveal').onclick = revealDict;
$('#btn-dict-check').onclick = checkDict;
$('#btn-dict-next').onclick = nextDict;
$('#dict-rate').onchange = e => {
  dict.rate = parseFloat(e.target.value) || 0.95;
  store.set('ieltsType.rate', String(dict.rate));
  playSentence();
};

/* ================= 数据备份与恢复 ================= */
function collectData(){
  const data = {};
  for(let i = 0; i < localStorage.length; i++){
    const k = localStorage.key(i);
    if(!k || !(k.startsWith('ieltsType.') || k.startsWith('ielts.'))) continue;
    try{ data[k] = JSON.parse(localStorage.getItem(k)); }catch(e){ data[k] = localStorage.getItem(k); }
  }
  return data;
}
function updateBackupInfo(){
  const d = collectData();
  const words = d['ieltsType.words'] ? Object.keys(d['ieltsType.words']).length : 0;
  const best = d['ieltsType.best'] ? Object.keys(d['ieltsType.best']).length : 0;
  const drafts = Object.keys(d).filter(k => k.startsWith('ielts.draft.')).length;
  $('#backup-info').textContent = '当前存档：单词记忆 ' + words + ' 词 · 打字成绩 ' + best + ' 篇 · 写作草稿 ' + drafts + ' 份';
}
$('#backup-box').addEventListener('toggle', () => { if($('#backup-box').open) updateBackupInfo(); });
$('#btn-export').onclick = () => {
  const payload = { app: 'ielts-typing-trainer', version: 1, exportedAt: new Date().toISOString(), data: collectData() };
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const d = new Date(), pad = n => String(n).padStart(2, '0');
  a.download = '雅思打字存档-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  toast('存档已导出，在浏览器下载目录里');
};
$('#btn-import').onclick = () => $('#import-file').click();
$('#import-file').addEventListener('change', e => {
  const f = e.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const payload = JSON.parse(reader.result);
      const data = payload && payload.data;
      if(!data || typeof data !== 'object' || payload.app !== 'ielts-typing-trainer') throw new Error('bad file');
      let n = 0;
      for(const [k, v] of Object.entries(data)){
        if(!(k.startsWith('ieltsType.') || k.startsWith('ielts.'))) continue;
        localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
        n++;
      }
      WREC = store.get('ieltsType.words', {});
      dict.rate = parseFloat(store.get('ieltsType.rate', '0.95'));
      $('#dict-rate').value = String(dict.rate);
      renderLib();
      renderWordsHome();
      updateBackupInfo();
      toast('导入成功：共 ' + n + ' 项数据已恢复 ✓');
    }catch(err){ toast('导入失败：请选择本程序导出的存档文件'); }
  };
  reader.readAsText(f);
  e.target.value = '';
});

/* ================= 初始化 ================= */
$('#dict-rate').value = String(dict.rate);
$('#chip-count').textContent = '内置 ' + LIB.length + ' 篇 · 中英对照';
renderLib();
