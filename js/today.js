/* ============================================================
   卦阁 v4 · 今日融合面板 —— window.TodayApp
   黄历 / 时辰吉凶 / 生肖运程 / 星座今日 / 每日一签 / 塔罗指引
   聚合各模块数据，一键跳转 + AI 综合解读
   ============================================================ */
(function () {
  const U = window.AppUtil;
  const TD = window.TODAY_DATA;

  const GAN_WUXING = { '甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水' };
  const ANIMALS = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
  const POS_NAME = { '艮':'东北', '坎':'正北', '坤':'西南', '震':'正东', '巽':'东南', '乾':'西北', '兑':'正西', '离':'正南' };

  let el = null;

  /* 当日农历数据 */
  function todayLunar() {
    try {
      const n = new Date();
      return Solar.fromYmdHms(n.getFullYear(), n.getMonth() + 1, n.getDate(), 12, 0, 0).getLunar();
    } catch (e) { return null; }
  }
  function yearAnimal(y) { return ANIMALS[((y - 4) % 12 + 12) % 12]; }

  /* 大阿卡纳编号 → 罗马数字（牌面符号用） */
  function roman(n) {
    if (n === 0) return '〇';
    const map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let s = '';
    for (const [v, r] of map) while (n >= v) { s += r; n -= v; }
    return s;
  }

  function render(sec) {
    el = sec;
    const lunar = todayLunar();
    const now = new Date();
    const weekday = '日一二三四五六'.charAt(now.getDay());

    /* 黄历字段 */
    const dayYi = (lunar && lunar.getDayYi) ? (lunar.getDayYi() || []) : [];
    const dayJi = (lunar && lunar.getDayJi) ? (lunar.getDayJi() || []) : [];
    const chong = (lunar && lunar.getDayChongDesc) ? lunar.getDayChongDesc() : '';
    const jiShen = (lunar && lunar.getDayJiShen) ? (lunar.getDayJiShen() || []) : [];
    const xiongSha = (lunar && lunar.getDayXiongSha) ? (lunar.getDayXiongSha() || []) : [];
    const zhiXing = (lunar && lunar.getZhiXing) ? lunar.getZhiXing() : '';
    const xiu = (lunar && lunar.getXiu) ? lunar.getXiu() : '';
    const ganZhi = (lunar && lunar.getDayInGanZhi) ? lunar.getDayInGanZhi() : '';
    const dayGan = ganZhi.charAt(0);
    const dayWx = GAN_WUXING[dayGan] || '';
    const elementDay = TD.elementDay[dayWx];
    const pengGan = (lunar && lunar.getPengZuGan) ? lunar.getPengZuGan() : '';
    const pengZhi = (lunar && lunar.getPengZuZhi) ? lunar.getPengZuZhi() : '';
    const posCai = (lunar && lunar.getDayPositionCai) ? lunar.getDayPositionCai() : '';
    const posFu = (lunar && lunar.getDayPositionFu) ? lunar.getDayPositionFu() : '';
    const posXi = (lunar && lunar.getDayPositionXi) ? lunar.getDayPositionXi() : '';
    const jianchu = zhiXing ? (TD.jianchu[zhiXing] || '') : '';

    const times = (lunar && lunar.getTimes) ? lunar.getTimes().map(t => ({
      gz: t.getGanZhi(), ts: t.getTianShen(), luck: t.getTianShenType()
    })) : [];

    /* 生肖今日运程 */
    const animal = lunar ? lunar.getYearShengXiao() : yearAnimal(now.getFullYear());
    const aSeed = U.hashStr(U.todayStr() + '|animal|' + animal);
    const animalOverall = (TD.animalOverall[animal] && U.pick(TD.animalOverall[animal], aSeed)) || '';
    const aLove = U.pick(TD.shared.love, U.hashStr(U.todayStr() + '|animal|' + animal + '|love'));
    const aCareer = U.pick(TD.shared.career, U.hashStr(U.todayStr() + '|animal|' + animal + '|career'));
    const aWealth = U.pick(TD.shared.wealth, U.hashStr(U.todayStr() + '|animal|' + animal + '|wealth'));

    /* 星座今日（跨模块） */
    let sign = null, f = null;
    try {
      const birth = AppStore.get('xingzuo.birth', U.todayStr());
      const bd = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(birth);
      if (bd && window.XingzuoApp) { sign = window.XingzuoApp.getSign(+bd[2], +bd[3]); f = window.XingzuoApp.getFortune(sign.name, 'day'); }
    } catch (e) {}

    /* 每日一签（跨模块） */
    let daily = null;
    try { if (window.QianApp) daily = window.QianApp.getDaily('general'); } catch (e) {}

    /* 塔罗今日（跨模块） */
    let tarot = null;
    try { if (window.TarotApp) tarot = window.TarotApp.getDailyCard(); } catch (e) {}

    const lunarStr = lunar ? (lunar.getYearInChinese() + '年 ' + lunar.getMonthInChinese() + '月 ' + lunar.getDayInChinese()) : '';

    /* 生肖运程 */
    const animalHtml = `
      <div class="card">
        <div class="card-title">今日生肖 · ${animal}</div>
        <div class="today-animal">
          <p class="today-animal-overall">${animalOverall}</p>
          <div class="fortune-grid">
            <div class="fortune-item"><h4>爱情</h4><p>${U.escapeHtml(aLove)}</p></div>
            <div class="fortune-item"><h4>事业</h4><p>${U.escapeHtml(aCareer)}</p></div>
            <div class="fortune-item"><h4>财运</h4><p>${U.escapeHtml(aWealth)}</p></div>
          </div>
        </div>
      </div>`;

    /* 星座今日 */
    const signHtml = (sign && f) ? `
      <div class="card">
        <div class="card-title">今日星座 · ${sign.name}</div>
        <div class="today-sign-head">
          <span class="today-sign-sym">${sign.symbol}</span>
          <div class="today-sign-score"><b>${f.overallScore}</b><i>运势指数</i></div>
        </div>
        <p class="today-sign-overall">${U.escapeHtml(f.overall)}</p>
        <div class="lucky-strip">
          <span class="lucky-chip">💖 爱情 ${U.escapeHtml(f.love)}</span>
          <span class="lucky-chip">🎐 幸运 ${f.luckyNumber} / ${f.luckyColor}</span>
          <span class="lucky-chip">💑 贵人 ${f.luckyPerson}</span>
        </div>
        <button class="btn-ghost go-btn" data-tab="xingzuo" style="margin-top:12px">前往星座 · 查看本周运势与档案 →</button>
      </div>` : '';

    /* 每日一签 */
    const dailyHtml = daily ? `
      <div class="card">
        <div class="card-title">今日一签 · 综合</div>
        <div class="qian-result">
          <div class="qian-level ${(window.QIAN_DATA.levels && window.QIAN_DATA.levels[daily.stick.level]) || 'l2'}">${daily.stick.level}</div>
          <div class="qian-poem">${daily.stick.poem.replace(/。/g, '。<br>')}</div>
          <div class="qian-text"><p>${U.escapeHtml(daily.stick.text)}</p></div>
        </div>
        <button class="btn-ghost go-btn" data-tab="qian" style="margin-top:12px">前往抽签 · 为其他事项摇一签 →</button>
      </div>` : '';

    /* 塔罗今日 */
    const tarotHtml = tarot ? `
      <div class="card">
        <div class="card-title">今日塔罗指引</div>
        <div class="today-tarot">
          <div class="today-tarot-face">${roman(tarot.card.no)}</div>
          <div class="today-tarot-info">
            <div class="today-tarot-name">${tarot.card.name} <span>${tarot.reverse ? '逆位' : '正位'}</span></div>
            <div class="today-tarot-kw">${(tarot.reverse ? tarot.card.reverse : tarot.card.upright).join(' · ')}</div>
            <p class="today-tarot-text">${U.escapeHtml(tarot.reverse ? tarot.card.reverseText : tarot.card.uprightText)}</p>
          </div>
        </div>
        <button class="btn-ghost go-btn" data-tab="tarot" style="margin-top:12px">前往塔罗 · 三张牌阵或查看牌意 →</button>
      </div>` : '';

    sec.innerHTML = `
      <div class="card today-hero">
        <div class="card-title">今日黄历</div>
        <div class="today-date">
          <div class="today-d1">${now.getMonth() + 1} 月 ${now.getDate()} 日 · 星期${weekday}</div>
          <div class="today-d2">${lunarStr} · ${ganZhi}日 · 生肖${animal}</div>
          <div class="today-d3">${zhiXing ? zhiXing + '日 · ' : ''}${xiu ? '值日' + xiu + '宿' : ''}${dayWx ? ' · 五行' + dayWx : ''}</div>
        </div>
        <div class="today-yiji">
          <div class="yiji-line"><b class="yi">宜</b><span>${dayYi.join('、') || '—'}</span></div>
          <div class="yiji-line"><b class="ji">忌</b><span>${dayJi.join('、') || '—'}</span></div>
        </div>
        <div class="today-meta">
          <span>冲煞 ${chong || '—'}</span>
          ${jiShen.length ? '<span>吉神 ' + jiShen.slice(0, 4).join(' ') + '</span>' : ''}
          ${xiongSha.length ? '<span>凶煞 ' + xiongSha.slice(0, 3).join(' ') + '</span>' : ''}
        </div>
        <div class="today-pos">
          <span>💰 财神 ${POS_NAME[posCai] || posCai || '—'}</span>
          <span>🙏 喜神 ${POS_NAME[posXi] || posXi || '—'}</span>
          <span>🍀 福神 ${POS_NAME[posFu] || posFu || '—'}</span>
        </div>
        ${elementDay ? `<div class="today-element">今日五行属 <b style="color:var(--wx-${dayWx === '金' ? 'gold' : dayWx === '木' ? 'wood' : dayWx === '水' ? 'water' : dayWx === '火' ? 'fire' : 'earth'})">${dayWx}</b> · 宜 ${elementDay.yi} · ${elementDay.note}</div>` : ''}
        ${pengGan || pengZhi ? `<div class="today-pengzu">彭祖百忌 · ${pengGan}　${pengZhi}</div>` : ''}
        ${jianchu ? `<div class="today-jianchu">${zhiXing}日 · ${jianchu}</div>` : ''}
      </div>

      <div class="card">
        <div class="card-title">时辰吉凶</div>
        <div class="today-times">
          ${times.length ? times.map(t => `
            <div class="today-time ${t.luck.indexOf('黄道') >= 0 ? 'good' : 'bad'}">
              <div class="tt-gz">${t.gz}</div>
              <div class="tt-luck">${t.luck}</div>
              <div class="tt-ts">${t.ts}</div>
            </div>`).join('') : '<div class="ai-note">暂无时辰数据</div>'}
        </div>
      </div>

      ${animalHtml}
      ${signHtml}
      ${dailyHtml}
      ${tarotHtml}

      <div class="card">
        <div class="card-title">今日总运</div>
        <button class="ai-btn book-btn" id="todayAiBtn">✨ 今日运程详批</button>
        <div id="todayAiOut"></div>
        <div class="ai-note">综合黄历 · 生肖 · 星座 · 灵签 · 塔罗的每日开运指引</div>
      </div>`;

    /* 跳转按钮 */
    sec.querySelectorAll('.go-btn').forEach(b => {
      b.addEventListener('click', () => { if (window.AppUtil.switchTab) window.AppUtil.switchTab(b.dataset.tab); });
    });

    /* AI 综合解读 */
    const aiBtn = sec.querySelector('#todayAiBtn');
    if (aiBtn) aiBtn.addEventListener('click', async () => {
      const out = sec.querySelector('#todayAiOut');
      const payload = { date: U.todayStr(), weekday, lunar: lunarStr, ganZhi, chong, animal,
        zodiac: sign ? sign.name : '', fortune: f || null,
        daily: daily ? { level: daily.stick.level, poem: daily.stick.poem, text: daily.stick.text } : null,
        tarot: tarot ? { name: tarot.card.name, orientation: tarot.reverse ? '逆位' : '正位', keywords: (tarot.reverse ? tarot.card.reverse : tarot.card.upright) } : null };
      aiBtn.disabled = true;
      out.innerHTML = '<div class="ai-loading"><div class="spinner"></div><div>今日运程推演中…</div></div>';
      try {
        const res = await window.AI.ask('/api/today-analysis', payload, () => localToday(payload));
        out.innerHTML = res.degraded
          ? '<div class="ai-note ai-degraded">本阁藏卷已为你批注</div><div class="tarot-reading">' + localTodayHtml(payload) + '</div>'
          : '<div class="tarot-reading">' + window.AI.renderText(res.text) + '</div>';
      } finally { aiBtn.disabled = false; }
    });
  }

  /* AI 本地降级 */
  function localToday(p) {
    const lines = [
      '【今日基调】' + p.lunar + '，日值' + p.ganZhi + '。' + (p.chong ? '今日冲煞' + p.chong + '，行事宜留余地。' : ''),
      '【生肖运程】属' + p.animal + '者今日' + (p.animal ? TD.animalOverall[p.animal] ? U.pick(TD.animalOverall[p.animal], U.hashStr(U.todayStr() + '|animal|' + p.animal)) : '' : ''),
    ];
    if (p.zodiac && p.fortune) lines.push('【星座指引】' + p.zodiac + '今日综合指数 ' + p.fortune.overallScore + '。' + p.fortune.overall);
    if (p.daily) lines.push('【灵签启示】今日抽得「' + p.daily.level + '」签：' + p.daily.poem + ' ' + p.daily.text);
    if (p.tarot) lines.push('【塔罗寄语】今日指引是「' + p.tarot.name + '」（' + p.tarot.orientation + '），关键词：' + p.tarot.keywords.join('、') + '。');
    lines.push('【开运建议】' + ((p.fortune && p.fortune.tip) || '宜保持平和心态，感恩当下，善待身边的每一个人。'));
    return lines.join('\n');
  }
  function localTodayHtml(p) {
    return window.AI.renderText(localToday(p));
  }

  window.TodayApp = { render, init() {} };
})();
