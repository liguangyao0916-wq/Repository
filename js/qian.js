/* ============================================================
   卦阁 v4 · 趣味抽签模块 —— window.QianApp
   摇签动画 + 分类抽签 + 每日一签（日期种子确定性）
   ============================================================ */
(function () {
  const U = window.AppUtil;
  const D = window.QIAN_DATA;

  let el = null;
  let currentCat = 'general';

  function catOf(key) { return D.cats.find(c => c.key === key) || D.cats[3]; }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* 每日一签：同一分类按日期种子确定，当天稳定 */
  function getDaily(catKey) {
    const cat = D.cats.find(c => c.key === catKey) || D.cats[3];
    const idx = U.hashStr(U.todayStr() + '|qian|' + cat.key) % cat.sticks.length;
    return { cat, stick: cat.sticks[idx] };
  }

  /* 当日黄历宜忌 */
  function todayYiJi() {
    try {
      const lunar = Solar.fromYmdHms(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate(), 12, 0, 0).getLunar();
      return { yi: (lunar.getDayYi() || []).slice(0, 3), ji: (lunar.getDayJi() || []).slice(0, 3) };
    } catch (e) { return { yi: [], ji: [] }; }
  }

  /* ---------- 渲染 ---------- */
  function render(sec) {
    el = sec;

    const catBtns = D.cats.map(c =>
      `<button data-cat="${c.key}" class="${c.key===currentCat?'active':''}">${c.icon} ${c.name}</button>`).join('');

    sec.innerHTML = `
      <div class="card">
        <div class="card-title">灵签占卜</div>
        <p class="tarot-question">选一个类别，心中默念所求之事，摇动签筒。</p>
        <div class="qian-cat-choose">${catBtns}</div>
        <div class="qian-cylinder" id="qianCylinder">
          <div class="sticks" id="qianSticks"></div>
          <div class="tube"></div>
        </div>
        <button class="btn-primary" id="qianDraw">🎋 摇 签</button>
        <button class="btn-ghost" id="qianDaily" style="margin-top:10px">📅 今日一签（综合）</button>
        <div class="form-hint">摇签随机问当下事 · 今日一签按日期固定，次日更新</div>
      </div>

      <div class="card" id="qianResultWrap" style="display:none">
        <div class="card-title">解签</div>
        <div id="qianResult"></div>
      </div>`;

    // 预先铺一些签杆
    const sticks = sec.querySelector('#qianSticks');
    for (let i = 0; i < 8; i++) {
      const s = document.createElement('i');
      s.style.left = (12 + Math.random() * 34) + 'px';
      s.style.transform = 'rotate(' + (Math.random() * 22 - 11) + 'deg)';
      sticks.appendChild(s);
    }

    sec.querySelector('.qian-cat-choose').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      currentCat = b.dataset.cat;
      sec.querySelectorAll('.qian-cat-choose button').forEach(x => x.classList.toggle('active', x === b));
    });
    sec.querySelector('#qianDraw').addEventListener('click', draw);
    sec.querySelector('#qianDaily').addEventListener('click', () => {
      const { cat, stick } = getDaily('general');
      const wrap = sec.querySelector('#qianResultWrap');
      wrap.style.display = 'block';
      showResult(wrap, cat, stick, true);
      window.scrollTo(0, wrap.offsetTop - 70);
    });
  }

  function draw() {
    if (!el) return;
    const cyl = el.querySelector('#qianCylinder');
    const btn = el.querySelector('#qianDraw');
    const wrap = el.querySelector('#qianResultWrap');

    btn.disabled = true;
    cyl.classList.remove('shaking');
    // 强制 reflow 让动画可重复触发
    void cyl.offsetWidth;
    cyl.classList.add('shaking');

    // 动画中完成抽选
    const cat = catOf(currentCat);
    const stick = shuffle(cat.sticks)[0];

    setTimeout(() => {
      cyl.classList.remove('shaking');
      showResult(wrap, cat, stick);
      btn.disabled = false;
      window.scrollTo(0, wrap.offsetTop - 70);
    }, 1000);
  }

  function showResult(wrap, cat, stick, isDaily) {
    wrap.style.display = 'block';
    const lvlClass = D.levels[stick.level] || 'l2';
    const result = wrap.querySelector('#qianResult');
    const yj = todayYiJi();
    const yjHtml = (yj.yi.length || yj.ji.length)
      ? `<div class="qian-yiji">今日黄历 · <b style="color:var(--green)">宜</b> ${yj.yi.join('、') || '—'}　<b style="color:var(--red)">忌</b> ${yj.ji.join('、') || '—'}</div>`
      : '';

    /* 签级详解 + 分方向 */
    const ld = (D.levelDetail && D.levelDetail[stick.level]) || null;
    const dirHtml = ld ? `
      <div class="qian-detail">
        <div class="qian-detail-head">${ld.name} · 详解</div>
        <p class="qian-detail-desc">${ld.desc}</p>
        <div class="qian-detail-advice"><b>建议</b>　${ld.advice}</div>
        <div class="qian-dir-tabs" id="qianDirTabs">
          <button data-dir="career" class="active">事业</button>
          <button data-dir="love">姻缘</button>
          <button data-dir="wealth">财运</button>
          <button data-dir="health">健康</button>
        </div>
        <div class="qian-dir-body" id="qianDirBody">${ld.directions.career}</div>
      </div>` : '';

    result.innerHTML = `
      <div class="qian-result">
        <div class="qian-level ${lvlClass}">${stick.level}</div>
        <div class="qian-poem">${stick.poem.replace(/。/g, '。<br>')}</div>
        <div class="qian-text"><p>${U.escapeHtml(stick.text)}</p></div>
        <div class="qian-no">${cat.name}签 · 第 ${stick.no} 签${isDaily ? ' · 每日一签' : ''}</div>
        ${yjHtml}
      </div>
      ${dirHtml}
      <div id="qianAiBar"></div>`;

    /* 分方向切换 */
    const dirTabs = result.querySelector('#qianDirTabs');
    if (dirTabs && ld) {
      dirTabs.addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        dirTabs.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
        result.querySelector('#qianDirBody').textContent = ld.directions[b.dataset.dir];
      });
    }

    // AI 增强
    const bar = result.querySelector('#qianAiBar');
    bar.innerHTML = `<button class="ai-btn night-btn" id="qianAiBtn">✨ 解签详解</button>
      <div id="qianAiOut"></div>`;
    bar.querySelector('#qianAiBtn').addEventListener('click', async (e) => {
      e.target.disabled = true;
      const out = bar.querySelector('#qianAiOut');
      out.innerHTML = '<div class="ai-loading"><div class="spinner"></div><div>解签中…</div></div>';
      try {
        const res = await window.AI.ask('/api/qian-reading',
          { category: cat.name, no: stick.no, level: stick.level, poem: stick.poem, text: stick.text },
          () => localReading(cat, stick));
        out.innerHTML = res.degraded
          ? '<div class="ai-note ai-degraded">本阁藏卷已为你解签</div><div class="tarot-reading">' + localReadingHtml(cat, stick) + '</div>'
          : '<div class="tarot-reading">' + window.AI.renderText(res.text) + '</div>';
      } finally { e.target.disabled = false; }
    });
  }

  function localReading(cat, stick) {
    const meaning = { '上上': '这是最上乘的签，意味着所求之事前景光明，宜把握当下、积极行动。', '上': '上吉之签，诸事顺遂可期，稳中求进，收获自来。', '中': '中平之签，事情需要耐心与时间，戒骄戒躁，踏实前行。', '下': '此签略逊，眼下宜保守谨慎、静待时机，低谷过后自有转圜。' }[stick.level] || '';
    return '【解签】' + meaning + '\n【签意】' + stick.text + '\n【建议】在' + cat.name + '之事上，保持心态平稳，不因一时得失而动摇，脚踏实地终会有回报。';
  }
  function localReadingHtml(cat, stick) {
    return window.AI.renderText(localReading(cat, stick));
  }

  /* ---------- 模块接口 ---------- */
  window.QianApp = {
    render,
    init() {},
    /* 供「今日」融合模块复用 */
    getDaily
  };
})();
