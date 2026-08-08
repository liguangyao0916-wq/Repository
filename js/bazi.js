/* ============================================================
   卦阁 v4 · 八字排盘模块 —— window.BaziApp
   自旧版单文件移植：命主信息 / 四柱 / 五行 / 大运 / 命之书 / 问卦 / 流年
   新增：子时流派切换（setSect 1/2）+ localStorage 记忆上次录入
   ============================================================ */
(function () {
  const U = window.AppUtil;

  /* ---------- 五行字典 ---------- */
  const GAN_WUXING = { '甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水' };
  const ZHI_WUXING = { '子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水' };
  const WUXING_COLOR = { '金':'#d4a017','木':'#7fae57','水':'#6aa7d8','火':'#c9796b','土':'#b39b7c' };
  const WUXING_LIST = ['金','木','水','火','土'];

  const DAYGAN_READING = {
    '金': '金主义，代表刚毅果决。日主为金者，性格坚毅刚强，重义气、讲信用，做事果断有原则，但有时过于刚硬倔强，不易变通。锋芒毕露时易伤己伤人，宜学会圆融。',
    '木': '木主仁，代表生长与生发。日主为木者，仁慈温和，正直有恻隐之心，富有同情心与上进心，生机勃勃。缺点是容易优柔寡断、思虑过多，需培养决断力。',
    '水': '水主智，代表智慧与流动。日主为水者，聪明机敏，善于变通，适应力强，思想活跃，社交手腕好。缺点是情绪易起伏、心思变化快，定力稍显不足。',
    '火': '火主礼，代表热情与文明。日主为火者，热情开朗，光明磊落，富有感染力与行动力，礼仪周到，重情重义。缺点是急躁冲动，性子急易上火，需多一份沉稳。',
    '土': '土主信，代表承载与厚重。日主为土者，敦厚诚实，稳重可靠，包容心强，有责任感，做事踏实守本分。缺点是偏保守固执，不够灵活，应变稍慢。'
  };
  const MISSING_READING = {
    '金': '五行缺金：性格中或多一分柔仁、少一分刚毅，魄力与决断力稍显不足。补金之道——白色、金色属金，可多亲近金属、白色饰物，方位宜西方。',
    '木': '五行缺木：活力与生发之气不足，易感乏累、进取心平平。补木之道——绿色属木，多接触绿植、树木，方位宜东方，晨起舒展。',
    '水': '五行缺水：思虑或欠周密，情感表达偏内敛，机敏之性稍欠。补水之道——黑色、蓝色属水，近水而行，多饮清茶，方位宜北方。',
    '火': '五行缺火：热情与行动力稍弱，遇事易迟疑、少冲劲。补火之道——红色属火，多晒太阳、常明火，方位宜南方，多锻炼。',
    '土': '五行缺土：安定与包容之基略薄，根基感稍欠，情绪易漂浮。补土之道——黄色属土，多亲近大地田园，方宜居中位，养花草。'
  };
  const SHENGXIAO = { '鼠':'机智聪慧，善于理财','牛':'勤恳踏实，任劳任怨','虎':'勇敢果断，气势不凡','兔':'温和善良，心思细腻','龙':'自信大气，志向高远','蛇':'冷静睿智，洞察敏锐','马':'热情奔放，行动力强','羊':'温和文雅，与人为善','猴':'聪明灵巧，活泼机敏','鸡':'自信勤奋，讲究仪表','狗':'忠诚正直，重情重义','猪':'宽厚随和，乐观知足' };
  const WUXING_MEANING = {
    '金': '金气旺则果断刚毅，主决断与变革之力',
    '木': '木气旺则生机勃发，主成长与进取之势',
    '水': '水气旺则智慧通达，主变通与谋略之才',
    '火': '火气旺则热情充沛，主行动与爆发之力',
    '土': '土气旺则敦厚稳重，主承载与守信之德'
  };
  const BOOK_ICONS = { '命格总论':'☯','性格特质':'🧠','事业运势':'🏆','财富格局':'💰','婚姻感情':'💕','健康提示':'🌿','流年指引':'🗓' };

  /* ---------- 状态 ---------- */
  let el = null;
  let sect = 2;              // 2 晚子时(日柱按当天,默认) | 1 早子时(日柱按次日)
  let sex = 1;               // 1 男 | 0 女
  let school = 'ziping';     // 门派：子平/盲派/调候/纳音/禄命/星宗
  let lastPayload = null;    // 供 AI 使用
  let chatHistory = [];
  let liunianCache = {};

  const SCHOOLS = (window.BAZI_SCHOOLS && window.BAZI_SCHOOLS.schools) || [];
  const ST = (k) => SCHOOLS.find(s => s.key === k) || SCHOOLS[0];

  /* ---------- 表单持久化 ---------- */
  function saveForm() {
    AppStore.set('bazi.last', {
      year: el.querySelector('#year').value,
      month: el.querySelector('#month').value,
      day: el.querySelector('#day').value,
      hour: el.querySelector('#hour').value,
      minute: el.querySelector('#minute').value,
      sex, sect
    });
  }
  function loadForm() {
    const saved = AppStore.get('bazi.last', null);
    if (saved) {
      const setVal = (id, v) => { const n = el.querySelector(id); if (n && v != null) n.value = v; };
      setVal('#year', saved.year); setVal('#month', saved.month); setVal('#day', saved.day);
      setVal('#hour', saved.hour); setVal('#minute', saved.minute);
      if (saved.sex != null) sex = +saved.sex;
      if (saved.sect != null) sect = +saved.sect;
    }
  }

  /* ---------- 排盘数据 ---------- */
  function buildPayload() {
    const y = parseInt(el.querySelector('#year').value);
    const mo = parseInt(el.querySelector('#month').value);
    const d = parseInt(el.querySelector('#day').value);
    const h = parseInt(el.querySelector('#hour').value);
    const mi = parseInt(el.querySelector('#minute').value);
    if (!y || !mo || !d || isNaN(h) || isNaN(mi)) return null;
    // 校验日期真实性（防止 2月30日/4月31日 这类非法日期被静默算成错盘）
    const checkDate = new Date(y, mo - 1, d);
    if (checkDate.getFullYear() !== y || checkDate.getMonth() !== mo - 1 || checkDate.getDate() !== d) return null;

    let solar, lunar, ec;
    try {
      solar = Solar.fromYmdHms(y, mo, d, h, mi, 0);
      lunar = solar.getLunar();
      ec = lunar.getEightChar();
      ec.setSect(sect);
    } catch (e) { return null; }

    const wxCount = { '金':0, '木':0, '水':0, '火':0, '土':0 };
    [ec.getYearGan(), ec.getMonthGan(), ec.getDayGan(), ec.getTimeGan()].forEach(g => wxCount[GAN_WUXING[g]]++);
    [ec.getYearZhi(), ec.getMonthZhi(), ec.getDayZhi(), ec.getTimeZhi()].forEach(z => wxCount[ZHI_WUXING[z]]++);
    const missing = WUXING_LIST.filter(w => wxCount[w] === 0);

    let yunDesc = '';
    try {
      const yun = ec.getYun(sex, sect);
      yunDesc = '大运：' + yun.getDaYun().slice(1, 11).map(x => x.getStartAge() + '岁' + x.getGanZhi()).join('、') + '。';
    } catch (e) {}

    return {
      payload: { birth: solar.toYmdHms(), lunar: lunar.toString(), sex: sex === 1 ? '男' : '女',
        shengxiao: lunar.getYearShengXiao(), bazi: ec.toString(), rizhu: ec.getDayGan(),
        rizhuWx: GAN_WUXING[ec.getDayGan()], wxDist: wxCount, missing, yunDesc },
      solar, lunar, ec, wxCount, missing
    };
  }

  /* ---------- 渲染主结果 ---------- */
  function renderResult(data) {
    const { payload, solar, lunar, ec, wxCount, missing } = data;
    const maxWx = WUXING_LIST.reduce((a, b) => wxCount[a] >= wxCount[b] ? a : b);

    const pillars = [
      { label:'年柱', gan: ec.getYearGan(), zhi: ec.getYearZhi(), ssg: ec.getYearShiShenGan(), hide: ec.getYearHideGan(), nayin: ec.getYearNaYin(), isDay:false },
      { label:'月柱', gan: ec.getMonthGan(), zhi: ec.getMonthZhi(), ssg: ec.getMonthShiShenGan(), hide: ec.getMonthHideGan(), nayin: ec.getMonthNaYin(), isDay:false },
      { label:'日柱', gan: ec.getDayGan(), zhi: ec.getDayZhi(), ssg: '日主', hide: ec.getDayHideGan(), nayin: ec.getDayNaYin(), isDay:true },
      { label:'时柱', gan: ec.getTimeGan(), zhi: ec.getTimeZhi(), ssg: ec.getTimeShiShenGan(), hide: ec.getTimeHideGan(), nayin: ec.getTimeNaYin(), isDay:false },
    ];
    const hideColored = (gans) => gans.map(g => '<span style="color:' + WUXING_COLOR[GAN_WUXING[g]] + '">' + g + '</span>').join('');
    const pillarHTML = pillars.map(p => `
      <div class="pillar${p.isDay ? ' day-pillar' : ''}">
        <div class="pillar-label">${p.label}</div>
        <div class="gan">${p.gan}</div>
        <div class="zhi">${p.zhi}</div>
        <div class="ssg">${p.ssg}</div>
        <div class="hide">藏干：${hideColored(p.hide)}</div>
        <div class="nayin">${p.nayin}</div>
      </div>`).join('');

    let yunHTML = '暂无';
    try {
      const yun = ec.getYun(sex, sect);
      const daYun = yun.getDaYun().slice(1, 11);
      /* 每段大运下的小运（逐年） */
      const xiaoyunBlocks = daYun.map((x, i) => {
        let xiaoyunHtml = '';
        try {
          const xy = x.getXiaoYun() || [];
          xiaoyunHtml = `
            <div class="xiaoyun-wrap${i === 0 ? '' : ' hidden'}">
              ${xy.map(sy => `<div class="xiaoyun-item">
                <div class="xy-year">${sy.getYear()}年</div>
                <div class="xy-age">${sy.getAge()}岁</div>
                <div class="xy-gz">${sy.getGanZhi()}</div>
              </div>`).join('')}
            </div>`;
        } catch (e) {}
        return `<div class="dayun-block">
          <button class="dayun-head" data-xy="${i}">
            <span class="dh-age">${x.getStartAge()}岁</span>
            <span class="dh-gz">${x.getGanZhi()}</span>
            <span class="dh-year">${x.getStartYear()}年</span>
            <span class="dh-toggle">小运 ▾</span>
          </button>
          ${xiaoyunHtml}
        </div>`;
      }).join('');
      yunHTML = `
        <table class="info-table" style="margin-bottom:12px">
          <tr><td>起运时间</td><td>出生后约 ${yun.getStartYear()} 年 ${yun.getStartMonth()} 个月 ${yun.getStartDay()} 日起运</td></tr>
        </table>
        <div class="dayun-list">${xiaoyunBlocks}</div>`;
    } catch (e) {}

    const maxCount = Math.max(...WUXING_LIST.map(w => wxCount[w]), 1);
    const wxHTML = WUXING_LIST.map(w => `
      <div class="wuxing-row">
        <div class="wx-label" style="color:${WUXING_COLOR[w]}">${w}</div>
        <div class="wx-bar-bg"><div class="wx-bar" style="width:${wxCount[w] / maxCount * 100}%;background:${WUXING_COLOR[w]}"></div></div>
        <div class="wx-count">${wxCount[w]}</div>
      </div>`).join('');

    const dayGanWx = GAN_WUXING[ec.getDayGan()];
    let reading = '<p>' + DAYGAN_READING[dayGanWx] + '</p>';
    reading += '<p>命主生肖属' + lunar.getYearShengXiao() + '——' + SHENGXIAO[lunar.getYearShengXiao()] + '。</p>';
    if (missing.length > 0) missing.forEach(w => reading += '<p>' + MISSING_READING[w] + '</p>');
    else reading += '<p>四柱五行俱全，格局较为平衡，先天禀赋较为周全，运势起伏相对平稳。</p>';
    reading += '<p>命局中五行以「' + maxWx + '」最旺，' + WUXING_MEANING[maxWx] + '。</p>';

    let xunKong = '';
    try { xunKong = ec.getDayXunKong(); } catch (e) {}

    /* 十神解读 */
    const SS = (window.BAZI_DATA && window.BAZI_DATA.shishen) || {};
    const ssRows = [
      { label: '年柱', gan: ec.getYearShiShenGan(), zhi: ec.getYearShiShenZhi() },
      { label: '月柱', gan: ec.getMonthShiShenGan(), zhi: ec.getMonthShiShenZhi() },
      { label: '日柱', gan: '日主', zhi: ec.getDayShiShenZhi() },
      { label: '时柱', gan: ec.getTimeShiShenGan(), zhi: ec.getTimeShiShenZhi() }
    ];
    const shishenHtml = ssRows.map(r => `
      <div class="ss-row">
        <div class="ss-label">${r.label}</div>
        <div class="ss-body">
          <div class="ss-gan"><b>${r.gan}</b>${SS[r.gan] ? '<span>' + SS[r.gan] + '</span>' : '<span>以日主为中心</span>'}</div>
          <div class="ss-zhi">藏干十神：${(r.zhi || []).map(z => '<span class="ss-zhi-item">' + z + '</span>').join('')}</div>
        </div>
      </div>`).join('');

    /* 纳音解读 */
    const NAYIN = (window.BAZI_DATA && window.BAZI_DATA.nayin) || {};
    const dayNayin = NAYIN[ec.getDayNaYin()] || '纳音取五行之气以观气质基调。';
    const yearNayin = NAYIN[ec.getYearNaYin()] || '纳音取五行之气以观气质基调。';

    /* 神煞推算 */
    const SHD = (window.SHENSHA_DATA) || null;
    const shenshaHtml = SHD ? buildShenshaHtml(ec) : '<div class="ai-note">神煞数据加载中…</div>';

    el.querySelector('#baziResult').innerHTML = `
    <div class="card">
      <div class="card-title">命主信息</div>
      <table class="info-table">
        <tr><td>公历生日</td><td>${solar.toYmdHms()}</td></tr>
        <tr><td>农历生日</td><td>${lunar.toString()}</td></tr>
        <tr><td>生肖属相</td><td>${lunar.getYearShengXiao()}<span class="tag">${lunar.getYearInChinese()}</span></td></tr>
        <tr><td>胎元</td><td>${ec.getTaiYuan()}（${ec.getTaiYuanNaYin()}）</td></tr>
        <tr><td>命宫</td><td>${ec.getMingGong()}（${ec.getMingGongNaYin()}）</td></tr>
        <tr><td>身宫</td><td>${ec.getShenGong()}（${ec.getShenGongNaYin()}）</td></tr>
        ${xunKong ? `<tr><td>日柱空亡</td><td>${xunKong}（落空之支，逢冲填实则解）</td></tr>` : ''}
      </table>
    </div>

    <div class="card">
      <div class="card-title">四柱命盘</div>
      <div class="bazi-grid">${pillarHTML}</div>
      <div class="pillar-meta">
        <span>胎元 ${ec.getTaiYuan()}</span>
        <span>命宫 ${ec.getMingGong()}</span>
        <span>身宫 ${ec.getShenGong()}</span>
        <span>大运${sex === 1 ? '顺行' : '逆行'}</span>
        <span>流派 ${sect === 1 ? '早子时' : '晚子时'}</span>
      </div>
    </div>

    <div class="card">
      <div class="card-title">五行格局</div>
      ${wxHTML}
      <div class="wx-tip">${missing.length > 0
        ? '命局五行缺 <b style="color:var(--red)">' + missing.join('、') + '</b>，' + missing.map(w => MISSING_READING[w].split('——')[0]).join('、') + '，是值得留意补足的方向。'
        : '五行俱全，无明显缺失，先天格局较为周正。'}</div>
    </div>

    <div class="card">
      <div class="card-title">大运走势</div>
      ${yunHTML}
    </div>

    <div class="card">
      <div class="card-title">命理解读</div>
      <div class="reading">${reading}</div>
    </div>

    <div class="card">
      <div class="card-title">十神解读</div>
      ${shishenHtml}
      <div class="form-hint">十神以日主为"我"，其余天干地支与我的生克关系定之。此处列四柱天干十神与藏干十神。</div>
    </div>

    <div class="card">
      <div class="card-title">纳音 · 五行归属</div>
      <div class="nayin-row">
        <div class="nayin-item"><div class="nayin-label">日柱纳音</div><div class="nayin-name">${ec.getDayNaYin()}</div><p>${dayNayin}</p></div>
        <div class="nayin-item"><div class="nayin-label">年柱纳音</div><div class="nayin-name">${ec.getYearNaYin()}</div><p>${yearNayin}</p></div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">神煞一览</div>
      ${shenshaHtml}
      <div class="form-hint">神煞以年干/日干、年支/日支为基准推算。吉神多为助力，凶煞多为历练，吉凶互参方得其用。</div>
    </div>

    <div class="card">
      <div class="card-title">门派精解</div>
      <p class="form-hint">同一命盘，门派视角各异：子平重格局用神，盲派重干支象法，调候看寒暖燥湿，纳音论气质本命，禄命以年为根，星宗观星曜宫度。</p>
      <div class="school-tabs" id="schoolTabs">${schoolTabsHtml()}</div>
      <div id="schoolContent"></div>
    </div>

    <div class="card">
      <div class="card-title">命之书</div>
      <div id="bookArea">
        <button class="ai-btn book-btn" id="bookBtn">📖 打开我的命之书</button>
        <div id="bookLoading" class="ai-loading hidden"><div class="spinner"></div><div>命之书撰写中，请稍候…</div></div>
        <div class="ai-note">命之书由本阁经卷编纂 · 分七章 · 字字为你而写</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">问卦 · 师者答疑</div>
      <div class="chat-box" id="chatBox">
        <div class="chat-msg ai"><div class="bubble"><p>命盘已就绪。关于你的命运，有什么想问的吗？比如事业、财运、感情、健康、某年运势…</p></div></div>
      </div>
      <div class="chat-input-row">
        <input type="text" id="chatInput" placeholder="输入你的问题…">
        <button id="chatSend">问</button>
      </div>
      <div class="chat-suggests">
        <button data-q="我今年的财运如何？">今年财运</button>
        <button data-q="我适合做什么工作？">适合职业</button>
        <button data-q="我的婚姻感情怎么样？">婚姻感情</button>
        <button data-q="我需要注意健康吗？">健康注意</button>
        <button data-q="哪一年是我的转运年？">转运年份</button>
      </div>
    </div>

    <div class="card">
      <div class="card-title">流年运势</div>
      <div id="liunianArea">
        <div class="liunian-years" id="liunianYears"></div>
        <div id="liunianContent"><div class="ai-note">选择年份，查看该年运势详解</div></div>
      </div>
    </div>`;

    // 绑定交互
    bindBook();
    bindChat();
    bindSchools();
    bindXiaoyun();
    renderLiunianYears();
    // 滚动到结果
    const r = el.querySelector('#baziResult');
    r.scrollIntoView({ behavior: 'smooth' });
  }

  /* ============ 神煞推算 ============ */
  function buildShenshaHtml(ec) {
    const SS = window.SHENSHA_DATA;
    const yearGan = ec.getYearGan(), dayGan = ec.getDayGan();
    const yearZhi = ec.getYearZhi(), dayZhi = ec.getDayZhi();
    const monthZhi = ec.getMonthZhi();
    const dayPillar = ec.getDayGan() + ec.getDayZhi();
    const pillars = [
      { label: '年柱', gan: yearGan, zhi: yearZhi },
      { label: '月柱', gan: ec.getMonthGan(), zhi: monthZhi },
      { label: '日柱', gan: dayGan, zhi: dayZhi },
      { label: '时柱', gan: ec.getTimeGan(), zhi: ec.getTimeZhi() }
    ];
    const allGans = pillars.map(p => p.gan);
    const allZhis = pillars.map(p => p.zhi);

    /* 汇总每柱命中的神煞 */
    const found = {};   // 神煞名 -> [柱子名]
    function mark(name, pillarLabel) {
      if (!found[name]) found[name] = [];
      if (found[name].indexOf(pillarLabel) < 0) found[name].push(pillarLabel);
    }
    /* --- 天干查支类（以日干为主、年干为辅） --- */
    pillars.forEach(p => {
      curPillar = p.label;
      const z = p.zhi;
      /* 天干查支类 */
      const tyD = SS.tianyi[dayGan] || []; if (tyD.indexOf(z) >= 0) mark('天乙贵人', p.label);
      const tyY = SS.tianyi[yearGan] || []; if (tyY.indexOf(z) >= 0 && tyD.indexOf(z) < 0) mark('天乙贵人', p.label);
      if (SS.wenchang[dayGan] === z || SS.wenchang[yearGan] === z) mark('文昌贵人', p.label);
      if (SS.lu[dayGan] === z || SS.lu[yearGan] === z) mark('禄神', p.label);
      if (SS.yangren[dayGan] === z) mark('羊刃', p.label);
      if (SS.jinyu[dayGan] === z || SS.jinyu[yearGan] === z) mark('金舆', p.label);
      if (SS.xuetang[dayGan] === z || SS.xuetang[yearGan] === z) mark('学堂', p.label);
      const tjD = SS.taiji[dayGan] || []; if (tjD.indexOf(z) >= 0) mark('太极贵人', p.label);
      const tjY = SS.taiji[yearGan] || []; if (tjY.indexOf(z) >= 0 && tjD.indexOf(z) < 0) mark('太极贵人', p.label);
      const fxD = SS.fuxing[dayGan] || []; if (fxD.indexOf(z) >= 0) mark('福星贵人', p.label);
      const fxY = SS.fuxing[yearGan] || []; if (fxY.indexOf(z) >= 0 && fxD.indexOf(z) < 0) mark('福星贵人', p.label);
      /* 金神（以年干查，四柱地支见即论） */
      const js = SS.jinshen[yearGan] || []; if (js.indexOf(z) >= 0) mark('金神', p.label);
      /* 地支查支类（年支/日支为基准） */
      Object.keys(SS.zhiTable).forEach(k => {
        const map = SS.zhiTable[k];
        const cn = { yima: '驿马', taohua: '桃花', huagai: '华盖', jiangxing: '将星', jiesha: '劫煞', zaisha: '灾煞', wangshen: '亡神', guchen: '孤辰', guasu: '寡宿', hongluan: '红鸾', tianxi: '天喜' }[k];
        if (map[yearZhi] === z || map[dayZhi] === z) mark(cn, p.label);
      });
      /* 天德/月德（以月支查，四柱干支见） */
      const td = SS.tiande[monthZhi];
      if (td) {
        if (td[1] === 'g') { if (allGans.indexOf(td[0]) >= 0) mark('天德贵人', p.label); }
        else if (allZhis.indexOf(td[0]) >= 0) mark('天德贵人', p.label);
      }
      const yd = SS.yuede[monthZhi];
      if (yd && allGans.indexOf(yd) >= 0) mark('月德贵人', p.label);
      /* 天医（月支逆推一辰，四柱地支见） */
      if (SS.tianyi2[monthZhi] && allZhis.indexOf(SS.tianyi2[monthZhi]) >= 0) mark('天医', p.label);
      /* 解神（月支六冲，四柱地支见） */
      if (SS.jieshen[monthZhi] && allZhis.indexOf(SS.jieshen[monthZhi]) >= 0) mark('解神', p.label);
      /* 月德合、月空（月支三合查干） */
      const ydh = SS.yuedehe[monthZhi]; if (ydh && allGans.indexOf(ydh) >= 0) mark('月德合', p.label);
      const yk = SS.yuekong[monthZhi]; if (yk && allGans.indexOf(yk) >= 0) mark('月空', p.label);
      /* 德秀贵人（月支三合局，简化口径：德或秀之干现即可） */
      SS.dexium.forEach(group => {
        if (group.branches.indexOf(monthZhi) >= 0) {
          const deHit = allGans.some(g => group.de.indexOf(g) >= 0);
          const xiuHit = allGans.some(g => group.xiu.indexOf(g) >= 0);
          if (deHit && xiuHit) mark('德秀贵人', p.label);
        }
      });
      /* 天赦（季节查日柱） */
      const season = ['寅','卯','辰'].indexOf(monthZhi) >= 0 ? 'spring' : ['巳','午','未'].indexOf(monthZhi) >= 0 ? 'summer' : ['申','酉','戌'].indexOf(monthZhi) >= 0 ? 'autumn' : 'winter';
      const sheDay = { spring: '戊寅', summer: '甲午', autumn: '戊申', winter: '甲子' }[season];
      if (dayPillar === sheDay) mark('天赦', '日柱');
      /* 词馆（日干查，对日柱干支） */
      const cg = SS.cigu[dayGan]; if (cg && cg === dayPillar) mark('词馆', '日柱');
      /* 天厨（日干/年干查支） */
      if (SS.tianchu[dayGan] === z || SS.tianchu[yearGan] === z) mark('天厨贵人', p.label);
      /* 天官（日干/年干查支） */
      if (SS.tianguan[dayGan] === z || SS.tianguan[yearGan] === z) mark('天官贵人', p.label);
      /* 国印（日干/年干查支） */
      if (SS.guoyin[dayGan] === z || SS.guoyin[yearGan] === z) mark('国印贵人', p.label);
      /* 红艳（日干查支） */
      if (SS.hongyan[dayGan] === z) mark('红艳煞', p.label);
      /* 飞刃（日干查支 = 羊刃对冲） */
      if (SS.feiren[dayGan] === z) mark('飞刃', p.label);
      /* 六厄（年支三合局查支） */
      if (SS.liue[yearZhi] === z || SS.liue[dayZhi] === z) mark('六厄', p.label);
      /* 三奇贵人（顺次连续出现） */
      ['heaven', 'earth', 'human'].forEach(k => {
        const arr = SS.sanqi[k];
        const hits = pillars.filter(pp => arr.indexOf(pp.gan) >= 0);
        if (hits.length === 3) mark('三奇贵人', p.label);
      });
      /* 天罗地网：男忌天罗(戌亥)、女忌地网(辰巳)，看四柱地支 */
      const tl = sex === 1 ? SS.tianluodi.tian : SS.tianluodi.di;
      if (tl.indexOf(z) >= 0) mark('天罗地网', p.label);
    });

    /* 日柱直接判：魁罡、十恶大败、进神、退神、阴差阳错、孤鸾、八专、日贵、日德、禄马同乡、四废 */
    if (SS.kuigang.indexOf(dayPillar) >= 0) mark('魁罡', '日柱');
    if (SS.shiedabai.indexOf(dayPillar) >= 0) mark('十恶大败', '日柱');
    if (SS.jinshenDay.indexOf(dayPillar) >= 0) mark('进神', '日柱');
    if (SS.tuishenDay.indexOf(dayPillar) >= 0) mark('退神', '日柱');
    if (SS.yinchayangcuo.indexOf(dayPillar) >= 0) mark('阴差阳错', '日柱');
    if (SS.guluan.indexOf(dayPillar) >= 0) mark('孤鸾煞', '日柱');
    if (SS.bazhuan.indexOf(dayPillar) >= 0) mark('八专', '日柱');
    if (SS.rigu.indexOf(dayPillar) >= 0) mark('日贵', '日柱');
    if (SS.ride.indexOf(dayPillar) >= 0) mark('日德', '日柱');
    if (SS.lumaton.indexOf(dayPillar) >= 0) mark('禄马同乡', '日柱');
    /* 四废（季节查日柱干支） */
    const season2 = ['寅','卯','辰'].indexOf(monthZhi) >= 0 ? 'spring' : ['巳','午','未'].indexOf(monthZhi) >= 0 ? 'summer' : ['申','酉','戌'].indexOf(monthZhi) >= 0 ? 'autumn' : 'winter';
    const siqi = SS.siqi[season2];
    if (siqi && siqi.some(([g, zh]) => ec.getDayGan() === g && ec.getDayZhi() === zh)) mark('四废', '日柱');

    /* 分类 */
    const KIND = SS.kind || {};

    /* 按四柱排列 */
    const pillarOrder = ['年柱', '月柱', '日柱', '时柱'];
    const rows = pillarOrder.map(pLabel => {
      const tags = Object.keys(found).filter(n => found[n].indexOf(pLabel) >= 0);
      if (tags.length === 0) return null;
      return `<div class="ss-pillar-row">
        <div class="ss-pillar-label">${pLabel}</div>
        <div class="ss-pillar-tags">${tags.map(t =>
          `<span class="ss-tag ${KIND[t] || 'dong'}" title="${(SS.meaning[t] || '').replace(/"/g, '&quot;')}">${t}</span>`).join('')}</div>
      </div>`;
    }).filter(Boolean).join('');

    /* 下方附每个神煞的白话解读 */
    const nameMap = { '天乙贵人': 1, '文昌贵人': 2, '禄神': 3, '羊刃': 4, '驿马': 5, '桃花': 6, '华盖': 7, '将星': 8, '红鸾': 9, '天喜': 10, '劫煞': 11, '灾煞': 12, '亡神': 13, '孤辰': 14, '寡宿': 15, '金舆': 16, '学堂': 17, '金神': 18, '天德贵人': 19, '月德贵人': 20, '太极贵人': 21, '福星贵人': 22, '德秀贵人': 23, '魁罡': 24, '十恶大败': 25, '天医': 26, '天赦': 27, '解神': 28, '词馆': 29, '天厨贵人': 30, '天官贵人': 31, '国印贵人': 32, '红艳煞': 33, '飞刃': 34, '六厄': 35, '进神': 36, '退神': 37, '阴差阳错': 38, '孤鸾煞': 39, '八专': 40, '日贵': 41, '日德': 42, '禄马同乡': 43, '四废': 44, '三奇贵人': 45, '天罗地网': 46, '月德合': 47, '月空': 48 };
    const order = Object.keys(found).sort((a, b) => (nameMap[a] || 99) - (nameMap[b] || 99));

    if (order.length === 0) return '<div class="ai-note">命局神煞较少，格局清正。</div>';

    const legends = order.map(name => `
      <div class="ss-legend">
        <div class="ss-legend-name ${KIND[name] || 'dong'}">${name}</div>
        <div class="ss-legend-text">${SS.meaning[name] || ''}</div>
      </div>`).join('');

    return `<div class="ss-pillars">${rows}</div><div class="ss-legends">${legends}</div>`;
  }

  /* ============ 大运·小运展开 ============ */
  function bindXiaoyun() {
    const heads = el.querySelectorAll('.dayun-head');
    heads.forEach((h, i) => {
      h.addEventListener('click', () => {
        // 折叠其它，展开当前
        el.querySelectorAll('.dayun-block').forEach((b, j) => {
          const xy = b.querySelector('.xiaoyun-wrap');
          if (xy) xy.classList.toggle('hidden', j !== i);
        });
        heads.forEach((x, j) => x.classList.toggle('open', j === i));
      });
    });
  }

  /* ============ 门派精解 ============ */
  function schoolTabsHtml() {
    return SCHOOLS.map(s =>
      `<button data-school="${s.key}" class="${s.key === school ? 'active' : ''}">${s.icon} ${s.name}</button>`).join('');
  }

  function bindSchools() {
    const tabs = el.querySelector('#schoolTabs');
    if (!tabs) return;
    tabs.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      school = b.dataset.school;
      tabs.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
      renderSchoolContent();
    });
    renderSchoolContent();
  }

  function renderSchoolContent() {
    const box = el.querySelector('#schoolContent');
    if (!box) return;
    const s = ST(school);
    const data = buildPayload();
    const local = data ? buildSchoolLocal(s, data) : '<div class="ai-note">请先起盘</div>';
    box.innerHTML = `
      <div class="school-head">
        <div class="school-name">${s.icon} ${s.name}</div>
        <div class="school-tagline">${s.tagline}</div>
        <div class="school-classics">📖 古籍：${s.classics.join(' · ')}</div>
        <div class="school-method">${U.escapeHtml(s.method)}</div>
      </div>
      <div class="school-reading">${local}</div>
      <button class="ai-btn night-btn" id="schoolAiBtn" ${data ? '' : 'disabled'}>✨ ${s.name} · 门派精解（约1500字）</button>
      <div id="schoolAiOut"></div>`;
    const aiBtn = box.querySelector('#schoolAiBtn');
    if (aiBtn && data) aiBtn.addEventListener('click', async () => {
      const out = box.querySelector('#schoolAiOut');
      aiBtn.disabled = true;
      out.innerHTML = '<div class="ai-loading"><div class="spinner"></div><div>' + s.name + '推演中，请稍候…</div></div>';
      try {
        const res = await window.AI.ask('/api/bazi-school',
          { ...lastPayload, school: s.key },
          () => buildSchoolLocal(s, data));
        out.innerHTML = res.degraded
          ? '<div class="ai-note ai-degraded">本阁藏卷已为你批注</div>'
          : '<div class="tarot-reading">' + window.AI.renderText(res.text) + '</div>';
      } finally { aiBtn.disabled = false; }
    });
  }

  /* 各门派本地断语（无 AI 时展示 / AI 失败降级） */
  function buildSchoolLocal(s, data) {
    const { ec, lunar, wxCount, missing } = data;
    const dayWx = GAN_WUXING[ec.getDayGan()];
    try {
      switch (s.key) {
        case 'ziping': return zipingReading(ec, wxCount, missing, dayWx);
        case 'mangpai': return mangpaiReading(ec);
        case 'tiaohou': return tiaohouReading(data, ec, dayWx);
        case 'nayin': return nayinReading(ec);
        case 'luming': return lumingReading(ec, lunar);
        case 'xingzong': return xingzongReading(lunar, data);
        default: return '<p>请选择门派。</p>';
      }
    } catch (e) { return '<p>该派断语生成中遇到问题，可点击上方按钮让师者精解。</p>'; }
  }

  function zipingReading(ec, wxCount, missing, dayWx) {
    const monthSS = ec.getMonthShiShenGan();
    const ge = ['比肩', '劫财'].indexOf(monthSS) >= 0 ? '月令建禄·羊刃之格，不立正格，宜以财官为用' : '月令取「' + monthSS + '格」';
    const self = wxCount[dayWx] || 0;
    const strength = self >= 3 ? '偏强' : self <= 1 ? '偏弱' : '中和';
    const yong = strength === '偏强' ? '喜克泄耗——以财官食伤为用，宜务实求财、担责任事'
      : strength === '偏弱' ? '喜生扶——以印星比劫为用，宜贵人提携、结伴同行'
      : '中和之造，宜顺其自然，辅以调候流通';
    const yao = missing.length ? '依《神峰通考》病药之说，命局缺' + missing.join('、') + '为"病"，宜补' + missing.join('、') + '为"药"。' : '命局五行俱全，无偏枯之病，格局较为周正。';
    return '<p>【格局】' + ge + '，日主' + ec.getDayGan() + '（' + dayWx + '），身' + strength + '。</p><p>【用神】' + yong + '。</p><p>【病药】' + yao + '</p>';
  }

  function mangpaiReading(ec) {
    const dzh = (ec.getDayShiShenZhi() || [])[0] || '';
    const spouse = { '正财': '配偶持家有方、温婉务实', '偏财': '配偶能干活络、善于经营', '正官': '配偶端正自律、颇有主见', '七杀': '配偶精明强势、能干敢当', '正印': '配偶贤惠护佑、如亲如长', '偏印': '配偶心思细密、自成一方', '食神': '配偶温厚有福、能生口福之财', '伤官': '配偶聪慧外露、个性鲜明', '比肩': '配偶个性平实、旗鼓相当', '劫财': '配偶爽利有主见，喜竞争' }[dzh] || '日支所藏之象，须细参';
    const yss = ec.getYearShiShenGan();
    const yearNote = yss === '比肩' || yss === '劫财' ? '年上比劫，兄弟朋友缘分深，亦主早年有分财之争。' : yss === '正印' ? '年上正印，祖上积德、长辈有荫。' : yss === '七杀' ? '年上七杀，祖辈或早年压力较大，能磨砺成器。' : '年柱为根，承祖上之余荫。';
    const tss = ec.getTimeShiShenGan();
    const timeNote = tss === '食神' ? '时上食神，晚年有福荫、子息得力。' : tss === '七杀' ? '时上七杀，子息管教宜严，晚运须防操劳。' : tss === '正财' ? '时上正财，老来财帛安稳。' : '时柱为归宿，晚景宜静守福泽。';
    const stems = [ec.getYearGan(), ec.getMonthGan(), ec.getDayGan(), ec.getTimeGan()];
    const duoshi = stems.indexOf('食神') >= 0 && stems.indexOf('偏印') >= 0;
    return '<p>【宫位】日支为配偶宫，' + spouse + '。</p><p>【主客】' + yearNote + '</p><p>【时柱】' + timeNote + '</p>' +
      (duoshi ? '<p>【象断】干支见枭神与食神并现，有"枭神夺食"之象，主才华与口福易受压制，宜防儿孙缘与创意受阻。</p>' : '<p>【象断】四柱干支流通，象法上以"气通"为吉，主一生多顺遂之机。</p>');
  }

  function tiaohouReading(data, ec, dayWx) {
    const m = data.solar.getMonth();
    const climate = m >= 2 && m <= 4 ? ['春生', '木旺湿寒', '喜火暖局、以泄木气'] :
      m >= 5 && m <= 7 ? ['夏生', '火旺燥热', '喜水润局、以济火炎'] :
      m >= 8 && m <= 10 ? ['秋生', '金旺偏燥', '喜水泄金、以调肃杀'] :
      ['冬生', '水旺寒凉', '喜火暖局、以解冰寒'];
    const dayAdvice = { '金': '日主金，喜火炼以成器、水泄以成流', '木': '日主木，喜水滋以生发、火泄以疏通', '水': '日主水，喜火调以温暖、土制以成堤', '火': '日主火，喜水润以制炎、土泄以沉稳', '土': '日主土，喜火生以厚德、金泄以流通' }[dayWx] || '';
    return '<p>【气候】' + climate[0] + '，' + climate[1] + '。依《穷通宝鉴》，' + climate[2] + '。</p><p>【日主】' + dayAdvice + '。</p><p>【调候】以' + (m >= 5 && m <= 7 ? '水' : m >= 2 && m <= 4 ? '火' : m >= 8 && m <= 10 ? '水' : '火') + '为调候之神，得之则格局清润，失之则偏枯。</p>';
  }

  function nayinReading(ec) {
    const NAYIN = (window.BAZI_DATA && window.BAZI_DATA.nayin) || {};
    const dy = ec.getDayNaYin(), yy = ec.getYearNaYin();
    const d = NAYIN[dy] || '', y = NAYIN[yy] || '';
    return '<p>【年命】' + yy + '——' + y + '</p><p>【日柱】' + dy + '——' + d + '</p><p>【合参】年命为根基，日柱为体用，二者相配，定气质之基调与贵气之所向。</p>';
  }

  function lumingReading(ec, lunar) {
    const yg = ec.getYearGan(), yw = GAN_WUXING[yg];
    return '<p>【本命】年干' + yg + '属' + yw + '，为命之元、根之所在，主根基与祖上。</p><p>【支元】年支' + ec.getYearZhi() + '（生肖' + lunar.getYearShengXiao() + '），为命之宅，定先天禀赋与天性。</p><p>【古法】依《李虚中命书》，禄马财官以年月日时三垣为体，年干通根得令，则根基深厚；逢天乙、驿马等神煞，主贵人与动中求财之缘。</p>';
  }

  function xingzongReading(lunar, data) {
    const star = { '鼠': '水星', '牛': '土星', '虎': '木星', '兔': '太阴', '龙': '岁星', '蛇': '火星', '马': '太阳', '羊': '太阴', '猴': '金星', '鸡': '金星', '狗': '镇星', '猪': '水星' }[lunar.getYearShengXiao()] || '本命星';
    return '<p>【本命星】生肖属' + lunar.getYearShengXiao() + '，命主' + star + '，主' + ({ '太阳': '光明磊落、气场外显', '太阴': '温润细腻、内敛多思', '水星': '聪慧善言、思维活络', '金星': '重义气、善交际', '火星': '行动果决、热情外放', '木星': '豁达包容、乐于开拓', '土星': '稳重持守、务实坚韧', '岁星': '福泽绵长、宽厚大方', '镇星': '厚重可靠、坐镇一方' }[star] || '性情有定') + '。</p><p>【观星】依《果老星宗》之法，当以生辰推七政四余入十二宫，看星曜庙旺陷弱。本应用以生肖、月份粗排宫度，供玩味之资——精确排盘可参阅《果老星宗》《星平会海》。</p>';
  }

  /* ---------- 命之书 ---------- */
  function bindBook() {
    el.querySelector('#bookBtn').addEventListener('click', genBook);
  }
  async function genBook() {
    if (!lastPayload) { alert('请先「起盘」'); return; }
    const btn = el.querySelector('#bookBtn');
    const loading = el.querySelector('#bookLoading');
    btn.disabled = true;
    loading.classList.remove('hidden');
    try {
      const res = await window.AI.ask('/api/bazi-book', lastPayload, () => window.AI.baziLocal.book(lastPayload));
      renderBook(res.text, res.degraded);
    } catch (e) {
      el.querySelector('#bookArea').innerHTML = '<div class="ai-note" style="color:var(--red)">⚠️ ' + U.escapeHtml(e.message) + '</div>';
    } finally {
      btn.disabled = false;
      loading.classList.add('hidden');
    }
  }

  function renderBook(text, degraded) {
    const chapters = [];
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let cur = null;
    for (const line of lines) {
      const m = line.match(/^【(.+?)】/);
      if (m) { cur = { title: m[1], paras: [] }; chapters.push(cur); }
      else if (cur && line) cur.paras.push(line);
    }
    if (chapters.length === 0) chapters.push({ title: '命之书', paras: lines });

    const covers = chapters.map((ch, i) => `
      <div class="book-cover${i === 0 ? ' active' : ''}" data-chap="${i}">
        <div class="icon">${BOOK_ICONS[ch.title] || '☯'}</div>
        <div class="name">${ch.title}</div>
      </div>`).join('');

    const bodies = chapters.map((ch, i) => `
      <div class="book-chapter${i === 0 ? ' show' : ''}" id="chap-${i}">
        <h3>${ch.title}</h3>
        ${ch.paras.map(p => '<p>' + U.escapeHtml(p) + '</p>').join('')}
      </div>`).join('');

    el.querySelector('#bookArea').innerHTML = `
      ${degraded ? '<div class="ai-note ai-degraded">AI 未配置，已展示本地命之书</div>' : ''}
      <div class="book-covers">${covers}</div>
      ${bodies}
      <div class="ai-note" style="margin-top:12px;padding-top:10px;border-top:1px dashed var(--line)">命之书由 AI 或本地引擎生成，仅供娱乐参考</div>`;

    el.querySelectorAll('.book-cover').forEach(c => {
      c.addEventListener('click', () => {
        const i = +c.dataset.chap;
        el.querySelectorAll('.book-cover').forEach((x, j) => x.classList.toggle('active', j === i));
        el.querySelectorAll('.book-chapter').forEach((x, j) => x.classList.toggle('show', j === i));
      });
    });
  }

  /* ---------- 问卦 ---------- */
  function bindChat() {
    const input = el.querySelector('#chatInput');
    el.querySelector('#chatSend').addEventListener('click', () => sendChat());
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
    el.querySelectorAll('.chat-suggests button').forEach(b => {
      b.addEventListener('click', () => { input.value = b.dataset.q; sendChat(); });
    });
  }
  function addChatMsg(role, content) {
    const box = el.querySelector('#chatBox');
    const div = document.createElement('div');
    div.className = 'chat-msg ' + role;
    if (role === 'ai') {
      const inner = content.split('\n').map(p => '<p>' + U.escapeHtml(p) + '</p>').join('');
      div.innerHTML = '<div class="bubble">' + inner + '</div>';
    } else {
      div.innerHTML = '<div class="bubble">' + U.escapeHtml(content) + '</div>';
    }
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }
  async function sendChat() {
    const input = el.querySelector('#chatInput');
    const q = input.value.trim();
    if (!q) return;
    if (!lastPayload) { alert('请先「起盘」'); return; }
    input.value = '';
    addChatMsg('user', q);
    const box = el.querySelector('#chatBox');
    const typing = document.createElement('div');
    typing.className = 'chat-msg ai';
    typing.innerHTML = '<div class="bubble chat-typing"><span class="dots">命理推演中</span></div>';
    box.appendChild(typing);
    box.scrollTop = box.scrollHeight;
    try {
      const res = await window.AI.ask('/api/bazi-chat',
        { ...lastPayload, question: q, history: chatHistory.slice(-10) },
        () => window.AI.baziLocal.chat(q, lastPayload));
      typing.remove();
      chatHistory.push({ role: 'user', content: q });
      chatHistory.push({ role: 'assistant', content: res.text });
      addChatMsg('ai', (res.degraded ? '[本地解读] ' : '') + res.text);
    } catch (e) {
      typing.remove();
      addChatMsg('ai', '⚠️ ' + e.message);
    }
  }

  /* ---------- 流年 ---------- */
  function renderLiunianYears() {
    const now = new Date().getFullYear();
    const years = [];
    for (let y = now - 5; y <= now + 5; y++) years.push(y);
    const c = el.querySelector('#liunianYears');
    c.innerHTML = years.map(y => `<button data-year="${y}" class="${y === now ? 'active' : ''}">${y}</button>`).join('');
    c.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => loadLiunian(parseInt(b.dataset.year)));
    });
    loadLiunian(now);
  }
  async function loadLiunian(year) {
    if (!lastPayload) return;
    const btns = el.querySelectorAll('#liunianYears button');
    btns.forEach(b => b.classList.toggle('active', parseInt(b.dataset.year) === year));
    const content = el.querySelector('#liunianContent');
    if (liunianCache[year]) { content.innerHTML = liunianCache[year]; return; }
    content.innerHTML = '<div class="ai-loading"><div class="spinner"></div><div>' + year + ' 年运势推演中…</div></div>';
    let nianGanZhi = '';
    try { nianGanZhi = Solar.fromYmdHms(year, 6, 15, 12, 0, 0).getLunar().getYearInGanZhi(); } catch (e) {}
    try {
      const res = await window.AI.ask('/api/bazi-liunian', { ...lastPayload, year, nianGanZhi },
        () => window.AI.baziLocal.liunian(year, nianGanZhi, lastPayload));
      const html = window.AI.renderText(res.text);
      content.innerHTML = (res.degraded ? '<div class="ai-note ai-degraded">本阁藏卷已为你批注</div>' : '') + html;
      liunianCache[year] = content.innerHTML;
    } catch (e) {
      content.innerHTML = '<div class="ai-note" style="color:var(--red)">⚠️ ' + U.escapeHtml(e.message) + '</div>';
    }
  }

  /* ---------- 计算入口 ---------- */
  function calculate() {
    const data = buildPayload();
    if (!data) {
      // 清掉可能残留的旧命盘，避免用户误以为是当前输入的结果
      if (el.querySelector('#baziResult')) el.querySelector('#baziResult').innerHTML = '';
      alert('出生信息有误：请检查年/月/日/时是否填写完整，并确认日期真实有效（如 2 月不应有 30 日）。');
      return;
    }
    lastPayload = data.payload;
    saveForm();
    // 换盘后清空旧命盘的缓存，避免流年/对话串盘
    liunianCache = {};
    chatHistory = [];
    renderResult(data);
  }

  /* ---------- 输入校验 ---------- */
  function clampInput(sec) {
    const map = { year:[1900,2100], month:[1,12], day:[1,31], hour:[0,23], minute:[0,59] };
    for (const id in map) {
      const inp = sec.querySelector('#' + id);
      const [lo, hi] = map[id];
      if (!inp) continue;
      if (inp.value < lo) inp.value = lo;
      if (inp.value > hi) inp.value = hi;
    }
  }

  /* ---------- 模块渲染 ---------- */
  function render(sec) {
    el = sec;
    el.innerHTML = `
      <div class="card">
        <div class="card-title">生辰录入</div>
        <div class="form-row">
          <label>出生日期（<b>公历</b>）</label>
          <div class="three-col">
            <div><input type="number" id="year" placeholder="年" min="1900" max="2100" value="1990"></div>
            <div><input type="number" id="month" placeholder="月" min="1" max="12" value="5"></div>
            <div><input type="number" id="day" placeholder="日" min="1" max="31" value="15"></div>
          </div>
        </div>
        <div class="form-row">
          <label>出生时间（<b>24小时制</b>）</label>
          <div class="three-col">
            <div><input type="number" id="hour" placeholder="时" min="0" max="23" value="8"></div>
            <div><input type="number" id="minute" placeholder="分" min="0" max="59" value="0"></div>
            <div></div>
          </div>
        </div>
        <div class="form-row">
          <label>性别</label>
          <div class="seg-select">
            <div class="seg-btn" data-sex="1">男</div>
            <div class="seg-btn" data-sex="0">女</div>
          </div>
        </div>
        <div class="form-row">
          <label>子时流派</label>
          <div class="seg-select">
            <div class="seg-btn" data-sect="2">晚子时</div>
            <div class="seg-btn" data-sect="1">早子时</div>
          </div>
          <div class="form-hint">仅影响子时（23:00-01:00）出生者：晚子时按当天日柱，早子时按次日日柱</div>
        </div>
        <button class="btn-primary" id="baziCalc">起 盘</button>
      </div>
      <div id="baziResult"></div>`;

    // 回填上次录入
    loadForm();

    // 性别/流派按钮
    el.querySelectorAll('.seg-btn[data-sex]').forEach(b => {
      b.classList.toggle('active', +b.dataset.sex === sex);
      b.addEventListener('click', () => {
        sex = +b.dataset.sex;
        el.querySelectorAll('.seg-btn[data-sex]').forEach(x => x.classList.toggle('active', x === b));
      });
    });
    el.querySelectorAll('.seg-btn[data-sect]').forEach(b => {
      b.classList.toggle('active', +b.dataset.sect === sect);
      b.addEventListener('click', () => {
        sect = +b.dataset.sect;
        el.querySelectorAll('.seg-btn[data-sect]').forEach(x => x.classList.toggle('active', x === b));
        // 已起盘时重排
        if (lastPayload) calculate();
      });
    });

    el.querySelector('#baziCalc').addEventListener('click', calculate);

    // 输入校验
    ['year', 'month', 'day', 'hour', 'minute'].forEach(id => {
      el.querySelector('#' + id).addEventListener('blur', () => clampInput(el));
    });
  }

  /* ---------- 模块接口 ---------- */
  window.BaziApp = {
    render,
    init() {},
    dicts: { GAN_WUXING, ZHI_WUXING, WUXING_LIST, DAYGAN_READING, MISSING_READING, SHENGXIAO, WUXING_MEANING }
  };
})();
