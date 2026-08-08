/* ============================================================
   卦阁 v4 · 星座运势模块 —— window.XingzuoApp
   生日→星座 / 今日·本周运势 / 星座档案 / 配对速览 / 四象解读
   ============================================================ */
(function () {
  const U = window.AppUtil;
  const D = window.XINGZUO_DATA;

  /* 日期 → 星座 */
  function zodiacOf(month, day) {
    for (const s of D.signs) {
      const [sm, sd] = s.start, [em, ed] = s.end;
      if (sm < em) { // 不跨年：如 3.21-4.19
        if ((month === sm && day >= sd) || (month > sm && month < em) || (month === em && day <= ed)) return s;
      } else { // 跨年：如 12.22-1.19
        if ((month === sm && day >= sd) || month > sm || (month === em && day <= ed)) return s;
      }
    }
    return D.signs[0];
  }

  function parseDate(str) {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(str || '');
    if (!m) return null;
    return { y: +m[1], mo: +m[2], d: +m[3] };
  }

  /* ISO 周编号 */
  function isoWeek(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yStart) / 86400000) + 1) / 7);
  }

  /* 当日宜忌（复用 lunar 引擎） */
  function todayYiJi() {
    try {
      const lunar = Solar.fromYmdHms(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate(), 12, 0, 0).getLunar();
      return { yi: (lunar.getDayYi() || []).slice(0, 3), ji: (lunar.getDayJi() || []).slice(0, 3) };
    } catch (e) { return { yi: [], ji: [] }; }
  }

  /* 生成运势对象（确定性） */
  function buildFortune(zodiacName, period) {
    const today = new Date();
    const seedStr = period === 'week'
      ? (today.getFullYear() + '-W' + isoWeek(today) + '|' + zodiacName)
      : (U.todayStr() + '|' + zodiacName);
    const seed = U.hashStr(seedStr);
    const pick = (pool) => U.pick(pool, seed);
    const overallScore = U.hashStr(seedStr + '|score') % 101;

    const sign = D.signs.find(s => s.name === zodiacName);
    const yiji = period === 'day' ? todayYiJi() : { yi: [], ji: [] };

    return {
      date: U.todayStr(),
      period,
      zodiac: zodiacName,
      symbol: sign.symbol,
      element: sign.element,
      overallScore,
      overall: pick(D.textPools.overall),
      love: pick(D.textPools.love),
      career: pick(D.textPools.career),
      wealth: pick(D.textPools.wealth),
      health: pick(D.textPools.health),
      tip: pick(D.textPools.tip),
      luckyNumber: U.pick(sign.num, seed >>> 3),
      luckyColor: U.pick(sign.color, (seed >>> 7) % 7),
      luckyPerson: U.pick(sign.luckyPerson, seed >>> 11),
      matchZodiac: U.pick(sign.match, seed >>> 13),
      yi: yiji.yi,
      ji: yiji.ji
    };
  }

  /* ---------- 渲染 ---------- */
  let el = null;
  let currentPeriod = 'day';

  function scoreRing(score) {
    const C = 2 * Math.PI * 40;
    const len = (score / 100) * C;
    return `
    <div class="score-ring">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <defs><linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ecd9ab"/><stop offset="100%" stop-color="#a8844a"/>
        </linearGradient></defs>
        <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="7"/>
        <circle cx="48" cy="48" r="40" fill="none" stroke="url(#scoreGrad)" stroke-width="7" stroke-linecap="round"
          stroke-dasharray="${len.toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 48 48)"/>
      </svg>
      <div class="score-num">${score}</div>
    </div>`;
  }

  function renderResult(sec) {
    let birth = AppStore.get('xingzuo.birth', U.todayStr());
    let bd = parseDate(birth);
    // 兜底：localStorage 异常（空/格式错）时回退今天，避免整块崩溃
    if (!bd) { bd = { y: new Date().getFullYear(), mo: new Date().getMonth() + 1, d: new Date().getDate() }; birth = U.todayStr(); }
    const sign = zodiacOf(bd.mo, bd.d);
    const f = buildFortune(sign.name, currentPeriod);
    const prof = sign.profile;
    const elem = D.elements[sign.element];

    const periodBtn = (key, label) => `<button class="${currentPeriod===key?'active':''}" data-period="${key}">${label}</button>`;

    let yijiHtml = '';
    if (f.yi.length || f.ji.length) {
      yijiHtml = `<div class="fortune-item full">
        <h4>今日宜忌</h4>
        <p><b style="color:var(--green)">宜</b> ${f.yi.join('、') || '—'} 　<b style="color:var(--red)">忌</b> ${f.ji.join('、') || '—'}</p>
      </div>`;
    }

    const matchBest = sign.match.best.map(m =>
      `<div class="match-row"><div class="match-name">${m.name}</div><div class="match-note">${m.note}</div></div>`).join('');
    const matchWorst = sign.match.worst.map(m =>
      `<div class="match-row"><div class="match-name">${m.name}</div><div class="match-note">${m.note}</div></div>`).join('');

    sec.innerHTML = `
      <div class="card">
        <div class="card-title">生辰定位星座</div>
        <div class="form-row">
          <label>出生日期</label>
          <input type="date" id="xzBirth" value="${birth}" min="1900-01-01" max="2100-12-31">
        </div>
        <div class="form-hint">输入你的阳历生日，即可知晓所属星座与每日运势</div>
      </div>

      <div class="card">
        <div class="card-title">${currentPeriod === 'day' ? '今日' : '本周'} · 星座运势</div>
        <div class="zodiac-hero">
          <div class="zodiac-symbol">${sign.symbol}</div>
          <div class="zodiac-name">${sign.name}</div>
          <div class="zodiac-en">${sign.en} · ${sign.element}象星座 · ${prof.guardian}守护</div>
        </div>
        <div class="period-switch">
          ${periodBtn('day', '今日')}
          ${periodBtn('week', '本周')}
        </div>
        <div class="score-ring-wrap">
          ${scoreRing(f.overallScore)}
          <div class="score-tags">
            <div><span class="lbl">运势指数</span></div>
            <div><span class="lbl">幸运数字</span> ${f.luckyNumber}</div>
            <div><span class="lbl">幸运颜色</span> ${f.luckyColor}</div>
          </div>
        </div>
        <div class="fortune-grid">
          <div class="fortune-item full"><h4>综合</h4><p>${U.escapeHtml(f.overall)}</p></div>
          <div class="fortune-item"><h4>爱情</h4><p>${U.escapeHtml(f.love)}</p></div>
          <div class="fortune-item"><h4>事业</h4><p>${U.escapeHtml(f.career)}</p></div>
          <div class="fortune-item"><h4>财运</h4><p>${U.escapeHtml(f.wealth)}</p></div>
          <div class="fortune-item"><h4>健康</h4><p>${U.escapeHtml(f.health)}</p></div>
          ${yijiHtml}
        </div>
        <div class="lucky-strip">
          <span class="lucky-chip">💖 贵人 ${f.luckyPerson}</span>
          <span class="lucky-chip">💑 速配 ${f.matchZodiac}</span>
          <span class="lucky-chip">🎐 开运 ${U.escapeHtml(f.tip)}</span>
        </div>
      </div>

      <div class="card">
        <div class="card-title">${sign.name} · 星座档案</div>
        <div class="prof-row">
          <div class="prof-kv"><span>守护星</span><b>${prof.guardian}</b></div>
          <div class="prof-kv"><span>星座特质</span><b>${prof.quality}星座</b></div>
          <div class="prof-kv"><span>日期区间</span><b>${prof.dateLabel}</b></div>
          <div class="prof-kv"><span>幸运日</span><b>${prof.luckyDay}</b></div>
          <div class="prof-kv"><span>幸运石</span><b>${prof.luckyStone}</b></div>
          <div class="prof-kv"><span>幸运花</span><b>${prof.luckyFlower}</b></div>
        </div>
        <div class="prof-sec"><h4>性格特质</h4><p>${prof.personality}</p></div>
        <div class="prof-sec"><h4>爱情观</h4><p>${prof.love}</p></div>
        <div class="prof-sec"><h4>事业特质</h4><p>${prof.career}</p></div>
        <div class="prof-sec"><h4>财富特质</h4><p>${prof.wealth}</p></div>
        <div class="prof-tagrow">
          <span class="prof-tag good">👍 ${prof.strength}</span>
          <span class="prof-tag bad">⚠️ ${prof.weakness}</span>
        </div>
        <div class="prof-sec"><h4>开运物</h4><p>${prof.luckyTalisman} · 幸运数字 ${sign.num.join('、')} · 幸运颜色 ${sign.color.join('、')}</p></div>
      </div>

      <div class="card">
        <div class="card-title">配对速览</div>
        <div class="match-col">
          <h4>💞 天生合拍</h4>
          ${matchBest}
          <h4>💔 需要磨合</h4>
          ${matchWorst}
        </div>
        <div class="prof-sec"><h4>${sign.element}象 · ${elem.keyword}</h4>
          <p>${elem.traits}</p>
          <p style="margin-top:6px"><b>爱情提示</b>：${elem.love}</p>
          <p style="margin-top:6px"><b>开运建议</b>：${elem.advice}</p>
        </div>
      </div>

      <div class="card">
        <div class="card-title">今日详批</div>
        <button class="ai-btn book-btn" id="xzAiBtn">✨ 详批今日运势</button>
        <div id="xzAiOut"></div>
        <div class="ai-note">由本阁经卷与师者智慧为您批注</div>
      </div>`;

    // 事件绑定
    sec.querySelector('#xzBirth').addEventListener('change', (e) => {
      const v = e.target.value;
      if (v) { AppStore.set('xingzuo.birth', v); renderResult(sec); }
    });
    sec.querySelectorAll('.period-switch button').forEach(b => {
      b.addEventListener('click', () => { currentPeriod = b.dataset.period; renderResult(sec); });
    });
    const aiBtn = sec.querySelector('#xzAiBtn');
    if (aiBtn) aiBtn.addEventListener('click', async () => {
      const out = sec.querySelector('#xzAiOut');
      const bd2 = parseDate(AppStore.get('xingzuo.birth', U.todayStr()));
      const s2 = zodiacOf(bd2.mo, bd2.d);
      const f2 = buildFortune(s2.name, currentPeriod);
      aiBtn.disabled = true;
      out.innerHTML = '<div class="ai-loading"><div class="spinner"></div><div>解读生成中…</div></div>';
      try {
        const res = await window.AI.ask('/api/xingzuo-analysis',
          { date: f2.date, period: f2.period, zodiac: f2.zodiac, fortune: f2 },
          () => localReading(f2));
        out.innerHTML = res.degraded
          ? '<div class="ai-note ai-degraded">本阁藏卷已为你批注</div><div class="tarot-reading">' + localReadingHtml(f2) + '</div>'
          : '<div class="tarot-reading">' + window.AI.renderText(res.text) + '</div>';
      } finally { aiBtn.disabled = false; }
    });
  }

  /* AI 本地降级解读 */
  function localReading(f) {
    return '【今日指引】' + f.overall + '\n【爱情】' + f.love + '\n【事业】' + f.career +
      '\n【财运】' + f.wealth + '\n【健康】' + f.health + '\n【开运】幸运数字 ' + f.luckyNumber +
      '，幸运色 ' + f.luckyColor + '，贵人星座 ' + f.luckyPerson + '。' + f.tip;
  }
  function localReadingHtml(f) {
    return window.AI.renderText(localReading(f));
  }

  /* ---------- 模块接口 ---------- */
  window.XingzuoApp = {
    render(sec) { el = sec; renderResult(sec); },
    init() {},
    /* 供「今日」融合模块复用 */
    getSign(month, day) { return zodiacOf(month, day); },
    getFortune(zodiacName, period) { return buildFortune(zodiacName, period || 'day'); }
  };

})();
