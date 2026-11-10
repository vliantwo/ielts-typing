/* CORE
 * 基础层：可调参数 / 小工具 / 内置材料 / 视图切换 / 首页
 * 由原单文件 app.js 按功能拆出，加载顺序：core → words → island → modes
 */
'use strict';

/* 雅思单词记忆 · 应用脚本（由 index.html 内联脚本按原顺序合并） */
/* ============================================================
 * 第 1 段：主程序：单词 / 每日计划 / 灵动岛 / 打字 / 阅读 / 写作
 * ============================================================ */
'use strict';
/* ================= 可调参数（节奏/数量都集中在这里） ================= */
const SP_TIME = 3000;          // 复习快题倒计时（毫秒）
const DUE_PER_ROUND = 20;      // 每轮最多复习的到期词
const NEW_PER_GROUP = 5;       // 每答几题插入一个新词流程
const HEAT_DAYS = 14;          // 岛面板打卡热力图天数
const ISLAND_IDLE_MS = 5000;   // 灵动岛空闲多久后复位

/* ================= 小工具 ================= */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const store = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); }catch(e){ return d; } },
  set(k, v, what){
    try{ localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch(e){ storeWarn(e, what); return false; }
  },
  del(k){ try{ localStorage.removeItem(k); }catch(e){} }
};
/* 本地存储写不进去时不再是哑巴：弹红色长提示（12 秒节流，避免逐字输入时刷屏） */
let storeWarnT = 0;
function storeWarn(e, what){
  const now = Date.now();
  if(now - storeWarnT < 12000) return;
  storeWarnT = now;
  const quota = !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);
  toast(
    quota
      ? '⚠️ 浏览器本地存储已满' + (what ? '，' + what + '没能保存' : '，刚才的内容没能自动保存') + '。请马上点「保存」把作文导出；到右上角「自定义背景」里点「恢复默认」可释放空间。'
      : '⚠️ 本地存储写入失败' + (what ? '，' + what + '没能保存' : '') + '。请点「保存」导出内容。',
    9000, 'alert'
  );
}
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const fmtTime = s => { s = Math.max(0, Math.floor(s)); return String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0'); };
const countWords = t => (t||'').trim() ? t.trim().split(/\s+/).length : 0;
let toastT = null;
function toast(msg, ms, cls){
  const el = $('#toast'); el.textContent = msg;
  el.className = 'show' + (cls ? ' ' + cls : '');
  clearTimeout(toastT); toastT = setTimeout(() => { el.className = ''; }, ms || 2200);
}
function beep(kind){
  try{
    const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return;
    const ctx = beep.ctx || (beep.ctx = new AC());
    if(ctx.state === 'suspended') ctx.resume();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    const t = ctx.currentTime; o.type = 'sine';
    if(kind === 'alarm'){
      o.frequency.setValueAtTime(880, t); o.frequency.setValueAtTime(660, t+.15); o.frequency.setValueAtTime(880, t+.3);
      g.gain.setValueAtTime(.08, t); g.gain.linearRampToValueAtTime(0, t+.55);
      o.start(t); o.stop(t+.55);
    }else{
      o.frequency.setValueAtTime(740, t); o.frequency.setValueAtTime(988, t+.12);
      g.gain.setValueAtTime(.07, t); g.gain.linearRampToValueAtTime(0, t+.3);
      o.start(t); o.stop(t+.3);
    }
  }catch(e){}
}
function shuffleArr(a){
  const r = a.slice();
  for(let i = r.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}
function normalizeText(t){
  return t.replace(/\r\n?/g, '\n').replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'")
          .replace(/[\u2014\u2013]/g, '-').replace(/\n{3,}/g, '\n\n').trim();
}
let SENT_RE = null;
try{ SENT_RE = new RegExp('(?<=[.!?])\\s+'); }catch(e){}
function splitSentences(t){
  const out = [];
  t.split(/\n+/).forEach(line => {
    const parts = SENT_RE ? line.split(SENT_RE) : [line];
    parts.forEach(s => { s = s.trim(); if(s.length > 1) out.push(s); });
  });
  return out;
}

/* ================= 内置材料 ================= */
const CATS = {
  basics:  { name: '基础词句', color: '#7c3aed' },
  t1:      { name: '图表作文', color: '#0f9b8e' },
  writing: { name: '写作范文', color: '#e31837' },
  reading: { name: '学术阅读', color: '#2856b6' },
  listen:  { name: '听力句子', color: '#0e8a4d' },
  numbers: { name: '数字专项', color: '#b45309' }
};

const LISTEN_SENTENCES = [
  "My name is Anna Pickford. That's P-I-C-K-F-O-R-D.",
  "The address is Number 42, Harbury Road. That's H-A-R-B-U-R-Y.",
  "The annual membership fee is 65 pounds, or 40 pounds for students.",
  "We open at 9.15 on weekdays, and at 10 o'clock at weekends.",
  "You can collect your tickets any time after 5 p.m. on Thursday.",
  "Your booking reference is R729KX.",
  "Could you call back after half past eight tomorrow morning?",
  "The course runs from the 14th of July until the 22nd of August.",
  "Her mobile number is 07700 900581.",
  "The post code is GU7 4BX.",
  "We're located opposite the railway station, next to the post office.",
  "The total comes to 87 pounds and 50 pence.",
  "The meeting has been moved from Tuesday the 3rd to Friday the 6th.",
  "Please bring your passport and two recent photographs when you register."
];

const LIB = [];

/* ================= 中文对照数据（与 LIB 的 id 一一对应） ================= */
const ZH = {};

const ZH_PROMPT = {
  'w-tech': '如今，人们彼此交流的方式因科技而改变。科技在哪些方面影响了人们建立的各种人际关系？这是积极还是消极的发展？',
  'w-transport': '一些人认为政府应该把钱花在改善公共交通上，另一些人则认为修建更多道路是更好的解决办法。讨论这两种观点并给出你的意见。',
  'w-university': '大学教育应该对所有学生免费。你在多大程度上同意或不同意？',
  'w-letter': '你最近搬到了一座新城市。给住在别处的一位说英语的朋友写信，信中需说明：你为什么搬家；描述你的新家和周边环境；邀请朋友来拜访你。至少写 150 词，不需要写地址。',
  'w-remote': '在家办公正变得越来越流行。这种发展的优点是否大于缺点？',
  'w-ads': '有人说广告鼓励我们购买并不真正需要的东西；也有人说广告向我们介绍可能改善生活的新产品。你同意哪种观点？',
  'w-tourism': '国际旅游给许多地方带来了巨大利益，但人们也担心它对当地居民和环境的影响。国际旅游的缺点是否大于优点？',
  't1-line': '折线图显示 1990 至 2020 年间某城市三家博物馆的参观人数。',
  't1-bar': '柱状图显示某市家庭 1995、2005、2015 年三种交通方式的开支占比。',
  't1-pie': '两幅饼图显示某国家家庭 1990 和 2010 年五类支出的分布。',
  't1-table': '表格显示 2000、2010、2020 年三个国家的电影观影人次。',
  't1-process': '流程图展示废旧玻璃瓶回收的各个阶段。',
  't1-map': '两幅地图展示某城镇中心 1995 年至今的变化。',
  't1-mixed': '折线图和表格显示 2000 至 2020 年家庭休闲时长与休闲支出的变化。'
};

/* 听写模式专用：逐句中英对照 */
const DICT_SENTS = {
  'l-sec1': [
    { en: "My name is Anna Pickford. That's P-I-C-K-F-O-R-D.", zh: '我叫安娜·皮克福德，拼写是 P-I-C-K-F-O-R-D。' },
    { en: "The address is Number 42, Harbury Road. That's H-A-R-B-U-R-Y.", zh: '地址是哈伯里路 42 号，"哈伯里"的拼写是 H-A-R-B-U-R-Y。' },
    { en: 'The annual membership fee is 65 pounds, or 40 pounds for students.', zh: '年度会员费是 65 英镑，学生是 40 英镑。' },
    { en: "We open at 9.15 on weekdays, and at 10 o'clock at weekends.", zh: '我们工作日 9 点 15 分开门，周末 10 点开门。' },
    { en: 'You can collect your tickets any time after 5 p.m. on Thursday.', zh: '周四下午 5 点以后随时可以来取票。' },
    { en: 'Your booking reference is R729KX.', zh: '您的预订编号是 R729KX。' },
    { en: 'Could you call back after half past eight tomorrow morning?', zh: '明天早上八点半以后再打来好吗？' },
    { en: 'The course runs from the 14th of July until the 22nd of August.', zh: '课程从 7 月 14 日一直上到 8 月 22 日。' },
    { en: 'Her mobile number is 07700 900581.', zh: '她的手机号是 07700 900581。' },
    { en: 'The post code is GU7 4BX.', zh: '邮编是 GU7 4BX。' },
    { en: "We're located opposite the railway station, next to the post office.", zh: '我们的位置在火车站对面、邮局旁边。' },
    { en: 'The total comes to 87 pounds and 50 pence.', zh: '总共是 87 英镑 50 便士。' },
    { en: 'The meeting has been moved from Tuesday the 3rd to Friday the 6th.', zh: '会议已从 3 号星期二改到 6 号星期五。' },
    { en: 'Please bring your passport and two recent photographs when you register.', zh: '注册时请携带护照和两张近照。' }
  ],
  'l-sec2dir': [
    { en: 'As you leave the station, turn left and the museum is the third building on your right.', zh: '出车站后向左转，博物馆是右手边第三栋建筑。' },
    { en: 'The visitor centre is behind the main hall, opposite the car park.', zh: '游客中心在正厅后面、停车场对面。' },
    { en: 'Follow the path along the river until you reach the footbridge, then cross over.', zh: '沿河边小路一直走到人行桥，然后过桥。' },
    { en: 'The lecture theatre is on the second floor, at the end of the corridor.', zh: '演讲厅在二楼，走廊尽头。' },
    { en: 'The entrance fee is eight pounds, but children under five go free.', zh: '门票 8 英镑，5 岁以下儿童免费。' },
    { en: 'Guided tours of the gardens start every hour, on the half hour.', zh: '花园导览每小时一班，逢半点出发。' },
    { en: 'The cafe closes half an hour before the rest of the building.', zh: '咖啡馆比其他区域提前半小时关门。' },
    { en: 'If you lose your way, ask at the information desk near the main gate.', zh: '如果迷路了，请到正门附近的问询处询问。' },
    { en: 'Photography is allowed in the gallery, but please do not use flash.', zh: '馆内可以拍照，但请不要使用闪光灯。' },
    { en: 'The nearest bus stop is a five-minute walk from the west entrance.', zh: '最近的公交站在西门步行五分钟的地方。' }
  ],
  'l-sec4notes': [
    { en: 'The researchers collected data from over two thousand households in rural areas.', zh: '研究人员从农村地区的两千多户家庭收集了数据。' },
    { en: 'The results of the survey were surprising in three respects.', zh: '调查结果在三个方面出人意料。' },
    { en: 'Deforestation in the region increased by almost forty per cent in a single decade.', zh: '该地区的森林砍伐在十年间增加了近百分之四十。' },
    { en: 'The experiment was repeated several times to confirm the initial findings.', zh: '实验重复了多次，以证实初步发现。' },
    { en: 'There are two main explanations for this phenomenon, neither of which is complete.', zh: '对这一现象主要有两种解释，但都不够完整。' },
    { en: 'The second stage of the project will focus on water quality.', zh: '项目的第二阶段将关注水质。' },
    { en: 'Migration patterns appear to be closely linked to changes in temperature.', zh: '迁徙模式似乎与温度变化密切相关。' },
    { en: 'One limitation of the study is the small size of the sample.', zh: '这项研究的一个局限是样本规模较小。' },
    { en: 'The government introduced the policy in response to public pressure.', zh: '政府是在公众压力之下推出这项政策的。' },
    { en: 'Further research is needed before any firm conclusions can be drawn.', zh: '在得出确切结论之前，还需要进一步研究。' }
  ],
  'b-longsent': [
    { en: 'Although the number of students studying abroad has increased dramatically over the past decade, the proportion who return home immediately after graduation remains relatively low.', zh: '尽管过去十年出国留学的学生人数大幅增加，但毕业后立即回国的人数比例仍然相对较低。' },
    { en: 'What policymakers often fail to recognise is that the long-term benefits of early childhood education far outweigh the initial costs involved.', zh: '政策制定者往往未能认识到的是，早期儿童教育的长期收益远超其初期投入的成本。' },
    { en: 'The assumption that economic growth automatically leads to improvements in public health has been challenged by evidence from several developing countries.', zh: '经济增长会自动带来公共健康改善这一假设，已受到来自几个发展中国家的证据的挑战。' },
    { en: 'Not until renewable energy became cheaper than coal did many utility companies begin to reconsider their investment strategies.', zh: '直到可再生能源变得比煤炭更便宜，许多公用事业公司才开始重新考虑其投资策略。' },
    { en: 'While it is true that automation displaces certain categories of workers, history suggests that technological change tends to create more jobs than it destroys.', zh: '虽然自动化确实取代了某些类别的工人，但历史表明，技术变革创造的工作岗位往往多于它摧毁的。' },
    { en: "The researchers, whose findings were published last month, argue that the decline in bee populations cannot be attributed to a single cause.", zh: '研究结果上月发表的那些研究者认为，蜜蜂数量的下降不能归因于单一原因。' },
    { en: "Had the government acted on the committee's recommendations a decade earlier, the current housing shortage might have been avoided altogether.", zh: '如果政府早在十年前就按照委员会的建议行事，当前的住房短缺或许完全可以避免。' },
    { en: 'Among the factors contributing to urban congestion, the most significant is arguably the absence of reliable and affordable public transport.', zh: '在造成城市拥堵的诸多因素中，最主要的或许当属缺乏可靠且实惠的公共交通。' },
    { en: 'It is precisely because these traditions have been passed down through generations that they continue to hold meaning for young people today.', zh: '正是因为这些传统代代相传，它们才至今仍对年轻人具有意义。' },
    { en: 'Whether we like it or not, the way we work, learn and communicate has been permanently reshaped by the technologies that surround us.', zh: '无论我们是否愿意，我们工作、学习和交流的方式已被身边的技术永久地重塑了。' }
  ]
};

/* ================= 视图切换 ================= */
let curView = 'home';
function showView(v){
  $$('.view').forEach(x => x.classList.remove('active'));
  $('#view-' + v).classList.add('active');
  window.scrollTo(0, 0);
  curView = v;
  if(v === 'home') renderLib();
}
function goHome(){
  if(window.speechSynthesis) speechSynthesis.cancel();
  if(drill.timer) clearInterval(drill.timer);
  if(essay.timer) clearInterval(essay.timer);
  if(rd.timer) clearInterval(rd.timer);
  shStopAll();
  try{ if(sh.rec){ sh.rec.stop(); } }catch(e){}
  clearTimeout(wSess.spTimer); clearTimeout(wSess.spAdv);
  islandIdle();
  $$('.mode-card').forEach(c => c.classList.toggle('active', c.dataset.mode === curMode));
  showView('home');
}

/* ================= 首页 ================= */
let curMode = 'type', selId = null, catFilter = 'all';
function setMode(m){
  curMode = m; selId = null; catFilter = 'all';
  $$('.mode-card').forEach(c => c.classList.toggle('active', c.dataset.mode === m));
  $('#lib-title').textContent = m === 'type' ? '选择练习文章' : m === 'dict' ? '选择听写材料' : '选择写作题目';
  $('#lib-hint').textContent = m === 'dict' ? '内置材料附中文提示，任何文本都会按句子朗读' : m === 'essay' ? 'Task 2 目标 250 词以上 · 附题目中文大意' : '全部材料附中文对照，练习页可开关';
  $('#custom-text').style.display = m === 'essay' ? 'none' : 'block';
  $('#custom-essay').style.display = m === 'essay' ? 'block' : 'none';
  renderLib();
}
function renderLib(){
  const list = $('#lib-list'); list.innerHTML = '';
  let items = curMode === 'essay' ? LIB.filter(x => x.prompt) : LIB;
  const cf = $('#cat-filter');
  if(curMode === 'essay'){
    cf.style.display = 'none';
  }else{
    cf.style.display = 'flex';
    cf.innerHTML = '';
    const cats = ['all', ...new Set(LIB.map(x => x.cat))];
    cats.forEach(c => {
      const n = c === 'all' ? LIB.length : LIB.filter(x => x.cat === c).length;
      const b = document.createElement('button');
      b.className = 'cat-chip' + (catFilter === c ? ' active' : '');
      b.textContent = (c === 'all' ? '全部' : CATS[c].name) + ' ' + n;
      b.onclick = () => { catFilter = c; renderLib(); };
      cf.appendChild(b);
    });
    if(catFilter !== 'all') items = items.filter(x => x.cat === catFilter);
  }
  if(!items.length){ list.innerHTML = '<div style="color:#8a93a5;font-size:13px">该分类暂无材料</div>'; return; }
  if(!selId || (selId !== 'custom' && !items.some(i => i.id === selId))) selId = items.length ? items[0].id : 'custom';
  const best = store.get('ieltsType.best', {});
  const addCard = it => {
    const div = document.createElement('div');
    div.className = 'lib-item' + (selId === it.id ? ' active' : '');
    let metas = [];
    if(curMode === 'essay'){
      metas.push('<span class="badge-pill" style="color:#e31837;background:rgba(227,24,55,.08)">' + (it.kind === 't1' ? 'Task 1 · 图表作文' : it.minWords === 150 ? 'Task 1 · 书信' : 'Task 2 · 大作文') + '</span>');
      metas.push('<span>目标 ' + it.minWords + ' 词</span>');
    }else{
      metas.push('<span class="badge-pill" style="color:' + CATS[it.cat].color + ';background:' + CATS[it.cat].color + '14">' + CATS[it.cat].name + '</span>');
      metas.push('<span>' + countWords(it.text) + ' 词</span>');
      if(curMode === 'dict') metas.push('<span>' + splitSentences(it.text).length + ' 句</span>');
      if(curMode === 'type' && best[it.id]) metas.push('<span style="color:#b45309;font-weight:600">最佳 ' + best[it.id].wpm + ' WPM · ' + best[it.id].acc + '%</span>');
    }
    div.innerHTML = '<div class="lib-title">' + esc(it.title) + (selId === it.id ? '<span class="lib-check">已选</span>' : '') + '</div>'
      + '<div class="lib-meta">' + metas.map(m => '<span>' + m + '</span>').join('<i>·</i>') + '</div>'
      + (curMode === 'essay' ? '<div class="lib-excerpt">' + esc(it.prompt) + '</div>' : '');
    div.onclick = () => { selId = it.id; renderLib(); };
    list.appendChild(div);
  };
  const addHead = t => {
    const h = document.createElement('div');
    h.className = 'lib-sechead';
    h.innerHTML = t;
    list.appendChild(h);
  };
  if(curMode === 'essay'){
    addHead('Task 2 · 大作文 <span>250 词以上 · 建议 40 分钟</span>');
    items.filter(x => x.kind !== 't1').forEach(addCard);
    addHead('Task 1 · 小作文 <span>150 词以上 · 建议 20 分钟</span>');
    items.filter(x => x.kind === 't1').forEach(addCard);
  }else{
    items.forEach(addCard);
  }
  const cw = curMode === 'essay' ? $('#custom-essay') : $('#custom-text');
  cw.classList.toggle('active-custom', selId === 'custom');
  $('#btn-start').textContent = curMode === 'type' ? '开始打字练习 →' : curMode === 'dict' ? '开始听写练习 →' : '进入写作模拟 →';
  let pt = '自定义内容', pm = curMode === 'essay' ? '使用下方粘贴的写作题目' : '使用下方粘贴的文章练习';
  const picked = items.find(x => x.id === selId);
  if(picked){
    pt = picked.title;
    pm = curMode === 'essay'
      ? (picked.kind === 't1' ? 'Task 1 图表 · 目标 150 词 · 20 分钟' : picked.minWords === 150 ? 'Task 1 书信 · 目标 150 词' : 'Task 2 大作文 · 目标 250 词')
      : CATS[picked.cat].name + ' · ' + countWords(picked.text) + ' 词' + (curMode === 'dict' ? ' · ' + splitSentences(picked.text).length + ' 句' : '');
  }else{
    const cv = (curMode === 'essay' ? $('#custom-prompt') : $('#custom-textarea')).value.trim();
    if(cv) pm += '：「' + (cv.length > 24 ? cv.slice(0, 24) + '…' : cv) + '」';
  }
  $('#pick-title').textContent = pt;
  $('#pick-meta').textContent = pm;
  renderHomeStats();
}
function renderHomeStats(){
  const learned = WORDS.filter(w => WREC[w.id]).length;
  const due = WORDS.filter(w => WREC[w.id] && WREC[w.id].due <= Date.now()).length;
  const best = store.get('ieltsType.best', {});
  const bestWpm = Object.values(best).reduce((m, r) => Math.max(m, r.wpm || 0), 0);
  const doneN = Object.keys(best).length;
  $('#hero-stats').innerHTML = [
    ['单词已学', learned + '/' + WORDS.length],
    ['待复习', due],
    ['打字最佳', (bestWpm || 0) + ' WPM'],
    ['已练文章', doneN + ' 篇']
  ].map(s => '<div class="hstat"><i>' + s[0] + '</i><b>' + s[1] + '</b></div>').join('');
  const drafts = Object.keys(localStorage).filter(k => k.startsWith('ielts.draft.')).length;
  const set = (id, t) => { const el = document.getElementById(id); if(el) el.textContent = t; };
  set('live-type', doneN ? '最佳 ' + bestWpm + ' WPM · 已练 ' + doneN + ' 篇' : '23 篇材料任选');
  set('live-dict', '23 篇材料 · 逐句朗读听写');
  set('live-essay', drafts ? drafts + ' 份草稿进行中' : '40 分钟全真计时');
  set('live-words', learned ? '已学 ' + learned + ' 词 · 待复习 ' + due : '6000 词待你解锁');
  set('live-reading', RD_PASSAGES.length + ' 篇真题长度 · 自动批改解析');
  set('live-shadow', '4 组听力材料 · 领读 + 录音对比');
}

$('#btn-start').onclick = () => {
  if(curMode === 'type' || curMode === 'dict'){
    let text = '', id = 'custom', title = '自定义文本';
    if(selId === 'custom'){
      text = $('#custom-textarea').value;
      if(!text.trim()){ toast('请先在「自定义文本」里粘贴内容'); return; }
    }else{
      const it = LIB.find(x => x.id === selId); text = it.text; id = it.id; title = it.title;
    }
    text = normalizeText(text);
    if(curMode === 'type') startDrill(id, title, text);
    else startDict(id, title, text);
  }else{
    let prompt = '', min = 250, id = 'custom';
    if(selId === 'custom'){
      prompt = $('#custom-prompt').value;
      if(!prompt.trim()){ toast('请先在「自定义写作题目」里粘贴题目'); return; }
    }else{
      const it = LIB.find(x => x.id === selId); prompt = it.prompt; min = it.minWords || 250; id = it.id;
    }
    startEssay(id, prompt, min);
  }
};
