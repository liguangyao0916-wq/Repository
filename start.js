/**
 * 卦阁 · 星命塔签 启动脚本 v4
 * 用法: node ~/bazi-app/start.js
 * 功能:
 *   - 本地静态服务
 *   - /api/status             解盘引擎可用性探测
 *   - /api/bazi-analysis      AI 命理大盘解析 (单篇)
 *   - /api/bazi-book          AI 命之书 (分章报告)
 *   - /api/bazi-chat          追问对话 (多轮, 保留上下文)
 *   - /api/bazi-liunian       流年运势 (按年)
 *   - /api/xingzuo-analysis   星座运势散文
 *   - /api/tarot-reading      塔罗牌阵解读
 *   - /api/qian-reading       灵签详解
 *   - 自动调起浏览器
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dir = __dirname;
const port = 8080;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/* ---------- 加载共享门派知识库（浏览器数据文件） ---------- */
const _win = {};
try {
  new Function('window', fs.readFileSync(path.join(dir, 'js/data/bazi-schools-data.js'), 'utf-8'))(_win);
} catch (e) {}
const SCHOOLS = (_win.BAZI_SCHOOLS && _win.BAZI_SCHOOLS.schools) || [];

/* ---------- DeepSeek API Key ---------- */
function getApiKey() {
  if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY.trim();
  if (process.env.ANTHROPIC_AUTH_TOKEN) return process.env.ANTHROPIC_AUTH_TOKEN.trim();
  try {
    const k = fs.readFileSync(path.join(dir, 'api.key'), 'utf-8').trim();
    if (k) return k;
  } catch (e) {}
  return null;
}

/* ---------- DeepSeek 调用 ---------- */
async function callDeepSeek(messages, opts = {}) {
  const key = getApiKey();
  if (!key) return { ok: false, error: '未配置 DeepSeek API Key' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), (opts.timeout || 90) * 1000);
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({
        model: opts.model || 'deepseek-chat',
        messages,
        temperature: opts.temperature ?? 0.75,
        max_tokens: opts.max_tokens || 2200,
      }),
      signal: controller.signal
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, error: 'DeepSeek 接口错误 HTTP ' + res.status + (body ? '：' + body.slice(0, 120) : '') };
    }
    const data = await res.json();
    const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '').trim();
    if (!text) return { ok: false, error: 'DeepSeek 返回内容为空' };
    return { ok: true, text };
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? '解盘请求超时，请重试' : '解盘请求失败：' + e.message };
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- 命盘数据串接 ---------- */
function buildContext(payload) {
  const wxd = payload.wxDist || {};
  const wxStr = ['金','木','水','火','土'].map(w => w + ':' + (wxd[w] || 0) + '个').join('，');
  return [
    '【命主信息】',
    '公历生日：' + (payload.birth || ''),
    '农历生日：' + (payload.lunar || ''),
    '性别：' + (payload.sex || ''),
    '生肖：' + (payload.shengxiao || ''),
    '',
    '【命盘数据】',
    '四柱：' + (payload.bazi || ''),
    '日主：' + (payload.rizhu || '') + '（' + (payload.rizhuWx || '') + '）',
    '五行分布：' + wxStr,
    '五行缺失：' + ((payload.missing || []).join('、') || '无'),
    (payload.yunDesc || ''),
  ].join('\n');
}

const SYSTEM = '你是一位精通中国传统命理学的资深命理师，严谨、温和、条理清晰，输出使用流畅现代中文，避免恐吓与绝对化用语。';

/* 写作要求：专业术语夹杂 + 人性化口吻（像资深大师对谈，不是教科书） */
const PLAIN_TALK = `
写作要求（务必遵守）：
1. 【术语夹杂】大胆使用专业术语（如四柱、十神、纳音、藏干、空亡、用神、格局、大运、流年、刑冲合害、七杀、正官、正位逆位、牌阵、大阿卡纳等），显出专业功底；但每用一次术语，就紧跟一句大白话或生活化比喻解释，例如："你七杀重（可以理解为你骨子里有股不服输的狠劲，像自带一股锐气）"、"这张牌逆位（就是能量没顺过来，卡住了）"。
2. 【人性口吻】像一位阅历丰富、说话随和的老师傅在跟老朋友聊天：会用"你看""说白了""别慌""这事儿吧"这类口语，穿插一点点幽默和人情味，让人读着亲切、有温度。
3. 【因人而异】结合命主具体情况（性别、五行、缺失、牌面）说，别套模板；说到具体点，让命主觉得"这说的就是我"。
4. 【现代结合】把古语命理嫁接到现代生活（事业、感情、财务、健康、人际）上，给实在可用的建议，不说空话。
5. 【禁用编码】正文不要 markdown 符号（**、*、#、-、下划线）、代码、英文缩写，标题用【】。`;

/* 各接口在 prompt 后统一追加的写作要求 */
const PLAIN_REQ = (extra) => '\n' + PLAIN_TALK + (extra ? '\n' + extra : '');

/* ---------- 各接口处理器 ---------- */
async function handleBaziAnalysis(payload) {
  const ctx = buildContext(payload);
  const prompt = `请根据以下命盘信息，为命主撰写一篇约1200字的命理大盘解析，结构清晰、段落分明。
${PLAIN_REQ()}
${ctx}`;
  return callDeepSeek([
    { role: 'system', content: SYSTEM },
    { role: 'user', content: prompt }
  ], { max_tokens: 1800 });
}

async function handleBaziBook(payload) {
  const ctx = buildContext(payload);
  const prompt = `你是命理师。请根据命盘为命主撰写一本"命之书"，按章节输出，每章用【】标出标题，每章约180-250字，全书约1600字。章节如下：

【命格总论】
【性格特质】
【事业运势】
【财富格局】
【婚姻感情】
【健康提示】
【流年指引】

要求：结合具体八字具体分析，语言温和积极。
${PLAIN_REQ()}
${ctx}`;
  return callDeepSeek([
    { role: 'system', content: SYSTEM },
    { role: 'user', content: prompt }
  ], { max_tokens: 2600, temperature: 0.8 });
}

async function handleBaziChat(payload) {
  const ctx = buildContext(payload);
  const history = payload.history || [];
  const question = payload.question || '';
  const messages = [
    { role: 'system', content: SYSTEM + '\n\n命盘背景：\n' + ctx + PLAIN_REQ('\n回答要像一位亲切的命理师在面对面答疑：先听懂对方在问什么，再用人话回答；术语必须白话解释；不用任何 markdown 符号。') },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: question }
  ];
  return callDeepSeek(messages, { max_tokens: 1200, temperature: 0.8 });
}

async function handleBaziLiunian(payload) {
  const ctx = buildContext(payload);
  const year = payload.year || new Date().getFullYear();
  const prompt = `请根据命主命盘，撰写 ${year} 年（${payload.nianGanZhi || ''}年）的流年运势分析，约400字，包含：整体运势、事业、财运、感情、健康、开运建议。语言温和积极。
${PLAIN_REQ()}
${ctx}`;
  return callDeepSeek([
    { role: 'system', content: SYSTEM },
    { role: 'user', content: prompt }
  ], { max_tokens: 900, temperature: 0.8 });
}

/* ---------- 今日总运 AI ---------- */
async function handleTodayAnalysis(payload) {
  const lines = [
    '日期：' + (payload.date || ''),
    '星期：' + (payload.weekday ? '星期' + payload.weekday : ''),
    '农历：' + (payload.lunar || ''),
    '干支日：' + (payload.ganZhi || ''),
    '冲煞：' + (payload.chong || ''),
    '生肖：' + (payload.animal || ''),
  ];
  const f = payload.fortune || {};
  if (payload.zodiac) {
    lines.push('星座：' + payload.zodiac + '，综合指数 ' + (f.overallScore != null ? f.overallScore + '/100' : ''));
    lines.push('星座整体：' + (f.overall || ''));
    lines.push('星座爱情：' + (f.love || ''));
    lines.push('星座事业：' + (f.career || ''));
    lines.push('星座财运：' + (f.wealth || ''));
    lines.push('开运：' + (f.tip || ''));
  }
  if (payload.daily) lines.push('今日灵签：' + payload.daily.level + '签，' + payload.daily.poem + ' ' + payload.daily.text);
  if (payload.tarot) lines.push('今日塔罗：' + payload.tarot.name + '（' + payload.tarot.orientation + '），关键词 ' + payload.tarot.keywords.join('、'));
  const prompt = `你是一位通晓黄历与命理的现代运势师。请根据以下今日信息，写一篇约500字的"今日总运"开运指南，语言温暖积极、有条理，按【今日基调】【生肖提醒】【星座提示】【今日灵签与塔罗】【开运锦囊】分节。
${PLAIN_REQ()}
${lines.join('\n')}`;
  return callDeepSeek([
    { role: 'system', content: '你是一位温暖专业的现代运势师，通晓黄历与传统命理，用流畅现代中文写作，不恐吓、不绝对化。' },
    { role: 'user', content: prompt }
  ], { max_tokens: 800, temperature: 0.8 });
}

/* ---------- 门派精解 AI ---------- */
async function handleBaziSchool(payload) {
  const ctx = buildContext(payload);
  const school = SCHOOLS.find(s => s.key === payload.school) || SCHOOLS[0];
  const prompt = `你是精通${school.name}的资深命理师，师承${school.classics.join('、')}等古籍。

本派核心方法：${school.method}

请用${school.name}的视角，为下面这个命盘撰写约1500字的深度解析。要求：
1. 严格使用本派术语与断法（如子平讲格局用神、盲派讲象法宫位、调候讲寒暖、纳音讲本命、禄命以年为主、星宗观星曜），但遇到术语必须紧随其后白话解释
2. 结合具体四柱、五行、十神数据，不要泛泛而谈
3. 结构清晰，分章节，每章用【】标标题，例如【命局总断】【本派析命】【古籍印证】【流年指引】【开运建议】
4. 语言温和积极，避免恐吓与绝对化
${PLAIN_REQ()}
命盘信息：
${ctx}`;
  return callDeepSeek([
    { role: 'system', content: '你是一位精通中国传统命理学的资深命理师，严谨、温和、条理清晰，输出使用流畅现代中文，避免恐吓与绝对化用语。' },
    { role: 'user', content: prompt }
  ], { max_tokens: 2800, temperature: 0.8 });
}

/* ---------- 星座运势 AI ---------- */
async function handleXingzuoAnalysis(payload) {
  const f = payload.fortune || {};
  const ctx = [
    '日期：' + (f.date || ''),
    '时段：' + (payload.period === 'week' ? '本周' : '今日'),
    '星座：' + (payload.zodiac || ''),
    '综合指数：' + (f.overallScore != null ? f.overallScore + '/100' : ''),
    '综合：' + (f.overall || ''),
    '爱情：' + (f.love || ''),
    '事业：' + (f.career || ''),
    '财运：' + (f.wealth || ''),
    '健康：' + (f.health || ''),
    '开运：' + (f.tip || ''),
    '宜：' + ((f.yi || []).join('、') || '—') + '；忌：' + ((f.ji || []).join('、') || '—'),
  ].join('\n');
  const prompt = `你是一位温柔细致的现代占星师。请根据以下 ${payload.zodiac || '该星座'} 当日/本周运势数据，写一篇约400字的运势散文，结构清晰、语言亲和，按【整体】【爱情】【事业】【财运】【健康】【开运】分节。
${PLAIN_REQ()}
${ctx}`;
  return callDeepSeek([
    { role: 'system', content: '你是一位现代占星师，温暖、专业、不恐吓，用流畅现代中文写作。' },
    { role: 'user', content: prompt }
  ], { max_tokens: 700, temperature: 0.8 });
}

/* ---------- 塔罗解读 AI ---------- */
async function handleTarotReading(payload) {
  const cards = (payload.cards || []).map(c =>
    '「' + c.name + '」' + (c.orientation === 'reverse' ? '逆位' : '正位') + '（关键词：' +
    (c.orientation === 'reverse' ? (c.reverse || []).join('、') : (c.upright || []).join('、')) + '）').join('\n');
  const prompt = `你是一位通晓心理与象征、洞察力极强的塔罗解读师。请为以下牌阵做精炼而有深度的全盘解读。
牌阵：${payload.spread === 'three' ? '三张（过去/现在/未来）' : payload.spread === 'choice' ? '二选一（选择A/选择B）' : '单张（今日指引）'}
所问之事：${payload.question || '（未说明）'}

所抽之牌：
${cards}

要求：
1. 全文控制在300字左右，精炼有力，直击要害，不要空泛套话
2. 按【牌阵总览】【逐张深解】【行动建议】分节
3. 逐张深解时，指出该牌在"事业/爱情/财运/健康"中最相关的一个领域的启示
4. 结合牌的正逆位与象征，给出可操作的建议
${PLAIN_REQ()}`;

  return callDeepSeek([
    { role: 'system', content: '你是一位温和专业、洞察力极强的塔罗解读师，善用象征与心理洞察，用流畅现代中文写作，措辞精炼、避免套话与恐吓。' },
    { role: 'user', content: prompt }
  ], { max_tokens: 600, temperature: 0.75 });
}

/* ---------- 灵签详解 AI ---------- */
async function handleQianReading(payload) {
  const prompt = `你是一位解签人。请围绕下面这支签写约300字的深度详解。
分类：${payload.category || ''}　第 ${payload.no || ''} 签　签级：${payload.level || ''}
签诗：${payload.poem || ''}
白话：${payload.text || ''}

要求：
1. 全文300字左右，精炼深入
2. 按【签意】【事业/姻缘/财运/健康启示】【行动建议】分节
3. 结合签级吉凶（上上/上/中/下）给出温和务实的点拨，不要空泛套话
${PLAIN_REQ()}`;
  return callDeepSeek([
    { role: 'system', content: '你是一位传统而温和、洞察力强的解签人，用语亲切、点拨到位，用流畅现代中文写作，措辞精炼。' },
    { role: 'user', content: prompt }
  ], { max_tokens: 500, temperature: 0.75 });
}

/* ---------- HTTP 服务 ---------- */
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      let payload = {};
      try { payload = JSON.parse(body); } catch (e) {}
      let result;
      switch (url.pathname) {
        case '/api/status':          result = { ok: true, ai: !!getApiKey() }; break;
        case '/api/bazi-school':   result = await handleBaziSchool(payload); break;
        case '/api/today-analysis': result = await handleTodayAnalysis(payload); break;
        case '/api/bazi-analysis': result = await handleBaziAnalysis(payload); break;
        case '/api/bazi-book':     result = await handleBaziBook(payload); break;
        case '/api/bazi-chat':     result = await handleBaziChat(payload); break;
        case '/api/bazi-liunian':  result = await handleBaziLiunian(payload); break;
        case '/api/xingzuo-analysis': result = await handleXingzuoAnalysis(payload); break;
        case '/api/tarot-reading': result = await handleTarotReading(payload); break;
        case '/api/qian-reading':  result = await handleQianReading(payload); break;
        default: res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{"error":"Not Found"}'); return;
      }
      res.writeHead(result.ok ? 200 : 502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
    });
    return;
  }

  const urlPath = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname);
  const file = path.normalize(path.join(dir, urlPath));
  if (!file.startsWith(dir)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('404 Not Found'); return; }
    // 本地工具：所有资源 no-cache，确保每次刷新都拿最新代码（避免旧 JS 缓存导致切 tab 失效）
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
});

/* 局域网 IP（供同 WiFi 的其它设备访问）——优先普通 WiFi(wlan0)，避开热点直连(p2p) */
function getLANIP() {
  try {
    const os = require('os');
    const ifs = os.networkInterfaces();
    const candidates = [];
    for (const name in ifs) {
      for (const a of ifs[name] || []) {
        if (a.family === 'IPv4' && !a.internal) candidates.push({ name, addr: a.address });
      }
    }
    // 优先 wlan0；其次含 "wlan" 的；再其次任意非 p2p 的
    const pick = candidates.find(c => c.name === 'wlan0')
      || candidates.find(c => c.name.indexOf('wlan') >= 0)
      || candidates.find(c => c.name.indexOf('p2p') < 0)
      || candidates[0];
    if (pick) return pick.addr;
  } catch (e) {}
  return null;
}

server.listen(port, '0.0.0.0', () => {
  console.log('========================================');
  console.log('  ☯ 卦阁 · 星命塔签 v4');
  console.log('  本机访问:  http://localhost:' + port);
  console.log('  --- 其它设备可用的地址（连哪个网用哪个） ---');
  try {
    const os = require('os');
    const ifs = os.networkInterfaces();
    for (const name in ifs) {
      for (const a of ifs[name] || []) {
        if (a.family === 'IPv4' && !a.internal) {
          console.log('  http://' + a.address + ':' + port + '  [' + name + ']');
        }
      }
    }
  } catch (e) {}
  console.log('========================================');
  console.log('  模块: 星座/八字/塔罗/抽签 ✅');
  console.log('  解盘引擎: ' + (getApiKey() ? '已就绪' : '⚠️ 未配置（自动使用内置经卷）'));
  console.log('========================================');
  openBrowser('http://localhost:' + port);
});

function openBrowser(url) {
  // 优先系统默认浏览器（不带 -p，让系统自己选）
  try {
    execSync('am start -a android.intent.action.VIEW -d "' + url + '"', { stdio: 'ignore' });
    console.log('✅ 已用系统默认浏览器打开');
    return;
  } catch (e) {}
  // 其次 X 浏览器
  try {
    execSync('am start -a android.intent.action.VIEW -d "' + url + '" -p com.mmbox.xbrowser', { stdio: 'ignore' });
    console.log('✅ 已用 X 浏览器打开');
    return;
  } catch (e) {
    console.log('❌ 无法自动打开浏览器，请手动访问: ' + url);
  }
}

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') { console.log('端口被占用，可能已在运行'); openBrowser('http://localhost:' + port); }
  else console.log('❌ 启动失败:', e.message);
});
