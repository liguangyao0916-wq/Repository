/* ============================================================
   卦阁 v4 · 塔罗占卜模块 —— window.TarotApp
   78 张牌（22 大阿卡纳 + 56 小阿卡纳）
   单张今日指引 / 三张过去现在未来 / 二选一抉择 / 牌意全览
   ============================================================ */
(function () {
  const U = window.AppUtil;
  const MAJORS = window.TAROT_DATA;
  const MINOR = window.TAROT_MINOR;

  const SUIT_EN = { wands: 'Wands', cups: 'Cups', swords: 'Swords', pentacles: 'Pentacles' };
  const CARD_EN = ['Ace', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
  /* 16 张宫廷牌英文名（四花色 × 侍从/骑士/王后/国王） */
  const COURT_EN = {
    '权杖侍从': 'Page of Wands', '权杖骑士': 'Knight of Wands', '权杖王后': 'Queen of Wands', '权杖国王': 'King of Wands',
    '圣杯侍从': 'Page of Cups', '圣杯骑士': 'Knight of Cups', '圣杯王后': 'Queen of Cups', '圣杯国王': 'King of Cups',
    '宝剑侍从': 'Page of Swords', '宝剑骑士': 'Knight of Swords', '宝剑王后': 'Queen of Swords', '宝剑国王': 'King of Swords',
    '金币侍从': 'Page of Pentacles', '金币骑士': 'Knight of Pentacles', '金币王后': 'Queen of Pentacles', '金币国王': 'King of Pentacles'
  };

  /* 生成完整牌组（大 + 小），统一字段 */
  function fullDeck() {
    const deck = MAJORS.map(c => Object.assign({}, c, { group: 'major' }));
    MINOR.suits.forEach(s => {
      const suitLabel = s.name;
      s.cards.forEach(c => {
        deck.push({
          no: c.no, name: c.name, group: s.key,
          en: CARD_EN[c.no - 1] + ' of ' + SUIT_EN[s.key],
          upright: c.up, reverse: c.rev,
          uprightText: c.upText, reverseText: c.revText,
          suitName: suitLabel, element: s.element
        });
      });
      s.courts.forEach(c => {
        deck.push({
          no: '', name: c.name, group: s.key,
          en: COURT_EN[c.name] || (c.name + ' of ' + SUIT_EN[s.key]),
          upright: c.up, reverse: c.rev,
          uprightText: c.upText, reverseText: c.revText,
          suitName: suitLabel, element: s.element
        });
      });
    });
    return deck;
  }

  function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* 单张今日指引：大阿卡纳 + 日期种子（当天稳定） */
  function dailyOne() {
    const idx = U.hashStr(U.todayStr() + '|tarot') % MAJORS.length;
    const isRev = U.hashStr(U.todayStr() + '|tarot|rev') % 2 === 1;
    return { card: MAJORS[idx], reverse: isRev };
  }

  /* ============ 分领域解读 ============ */
  const DOMAINS = window.TAROT_DOMAINS || {};
  const DOMAIN_LABEL = { career: '事业', love: '爱情', money: '财运', health: '健康' };
  /* 小阿卡纳花色 → 领域权重主题 */
  const MINOR_DOMAIN_THEME = {
    wands: { career: '行动与进取', love: '热情与勇气', money: '开拓之财', health: '活力与精力' },
    cups: { career: '协作与人脉', love: '情感与联结', money: '人缘之财', health: '情绪与睡眠' },
    swords: { career: '思维与决断', love: '沟通与磨合', money: '判断之财', health: '思虑与压力' },
    pentacles: { career: '务实与积累', love: '陪伴与安稳', money: '正财与储蓄', health: '身体与作息' }
  };
  /* 每张牌的分领域文本：大阿卡纳用手写，小阿卡纳用"花色主题 + 关键词"生成 */
  function domainText(card, reverse, domain) {
    const i = reverse ? 1 : 0;
    if (card.group === 'major' && DOMAINS[card.name] && DOMAINS[card.name][domain]) {
      return DOMAINS[card.name][domain][i];
    }
    const theme = (MINOR_DOMAIN_THEME[card.group] && MINOR_DOMAIN_THEME[card.group][domain]) || '整体运势';
    const kw = (reverse ? card.reverse : card.upright).join('、');
    const tone = reverse ? '宜谨慎，防' : '宜把握，利';
    return theme + '上，此牌' + tone + (reverse ? '其失' : '其得') + '——关键词：' + kw + '。';
  }
  function domainHtml(card, reverse) {
    return Object.keys(DOMAIN_LABEL).map(d =>
      '<div class="t-domain"><span class="t-domain-label">' + DOMAIN_LABEL[d] + '</span><span class="t-domain-text">' + U.escapeHtml(domainText(card, reverse, d)) + '</span></div>').join('');
  }

  /* ---------- 状态 ---------- */
  let el = null;
  let spread = 'one';      // one | three | choice
  let question = '';
  let drawn = null;

  /* ---------- 渲染 ---------- */
  function render(sec) {
    el = sec;
    sec.innerHTML = `
      <div class="card">
        <div class="card-title">塔罗占卜</div>
        <p class="tarot-question">在脑海中默念你的问题，然后选择牌阵。塔罗牌为你揭示潜意识深处的指引。</p>
        <div class="spread-choose">
          <button data-spread="one" class="${spread==='one'?'active':''}">单张 · 今日指引</button>
          <button data-spread="three" class="${spread==='three'?'active':''}">三张 · 过去/现在/未来</button>
          <button data-spread="choice" class="${spread==='choice'?'active':''}">二选一 · 抉择</button>
        </div>
        <input type="text" id="tarotQ" class="tarot-question-input" placeholder="心中默念的问题（可不填）" value="${U.escapeHtml(question)}">
        <button class="btn-primary" id="tarotDraw">🔮 洗牌抽牌</button>
        <div class="form-hint">单张牌阵按当天日期确定，明天再抽会有新的指引</div>
      </div>

      <div class="card" id="tarotResultWrap" style="display:none">
        <div class="card-title">塔罗启示</div>
        <div id="tarotResult"></div>
      </div>

      <div class="card">
        <div class="card-title">牌意全览</div>
        <p class="tarot-question">共 78 张牌（22 张大阿卡纳 + 56 张小阿卡纳），点击查看每张牌的正逆位含义。</p>
        <div class="lib-tabs" id="libTabs">
          <button data-group="major" class="active">大阿卡纳</button>
          <button data-group="wands">权杖</button>
          <button data-group="cups">圣杯</button>
          <button data-group="swords">宝剑</button>
          <button data-group="pentacles">金币</button>
        </div>
        <div class="lib-list" id="libList"></div>
      </div>`;

    sec.querySelector('.spread-choose').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      spread = b.dataset.spread;
      sec.querySelectorAll('.spread-choose button').forEach(x => x.classList.toggle('active', x === b));
    });
    sec.querySelector('#tarotQ').addEventListener('input', (e) => { question = e.target.value; });
    sec.querySelector('#tarotDraw').addEventListener('click', draw);
    sec.querySelector('#libTabs').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      sec.querySelectorAll('#libTabs button').forEach(x => x.classList.toggle('active', x === b));
      renderLibrary(b.dataset.group);
    });
    renderLibrary('major');
  }

  /* ---------- 牌意库 ---------- */
  /* 牌意库统一用 fullDeck() 规范化后的字段（大小阿卡纳字段名一致，避免崩溃） */
  function renderLibrary(group) {
    const list = el.querySelector('#libList');
    const deck = fullDeck();
    let html = '';
    if (group === 'major') {
      html = deck.filter(c => c.group === 'major').map(c => libCardHtml(c, '大阿卡纳')).join('');
    } else {
      const suit = MINOR.suits.find(s => s.key === group);
      if (suit) {
        html = '<div class="lib-suit-intro"><b>' + suit.name + '（' + suit.element + '）</b> · ' + suit.domain + '<br>' + suit.intro + '</div>';
        html += deck.filter(c => c.group === group).map(c => libCardHtml(c, suit.name)).join('');
      }
    }
    list.innerHTML = html;
  }
  function libCardHtml(c, suitLabel) {
    return `
      <div class="lib-card">
        <div class="lib-head">
          <span class="lib-name">${c.name}</span>
          <span class="lib-en">${c.en} · ${suitLabel}</span>
        </div>
        <div class="lib-kw up">正位 <i>${c.upright.join(' · ')}</i></div>
        <div class="lib-kw rev">逆位 <i>${c.reverse.join(' · ')}</i></div>
        <div class="lib-text up">${c.uprightText}</div>
        <div class="lib-text rev">${c.reverseText}</div>
      </div>`;
  }

  /* ---------- 抽牌 ---------- */
  function draw() {
    if (!el) return;
    const drawBtn = el.querySelector('#tarotDraw');
    if (drawBtn && drawBtn.disabled) return;   // 防连续点击重抽
    if (drawBtn) drawBtn.disabled = true;
    try {
      if (spread === 'one') drawn = [dailyOne()];
    else if (spread === 'three') {
      const deck = fullDeck();
      drawn = shuffled(deck).slice(0, 3).map(c => ({ card: c, reverse: Math.random() < 0.5 }));
    } else {
      const deck = fullDeck();
      drawn = shuffled(deck).slice(0, 2).map(c => ({ card: c, reverse: Math.random() < 0.5 }));
    }

    const labels = spread === 'three' ? ['过去', '现在', '未来'] : spread === 'choice' ? ['选择 A', '选择 B'] : ['今日指引'];
    const wrap = el.querySelector('#tarotResultWrap');
    wrap.style.display = 'block';
    const result = el.querySelector('#tarotResult');

    const slots = drawn.map((d, i) => `
      <div>
        <div class="tarot-slot" data-i="${i}">
          <div class="tarot-inner">
            <div class="tarot-face tarot-back">🜲</div>
            <div class="tarot-face tarot-front">
              <span class="t-no">${d.card.no}</span>
              <div class="t-name">${d.card.name}</div>
              <div class="t-orient ${d.reverse?'down':'up'}">${d.reverse?'逆位':'正位'}</div>
              <div class="t-kw">${d.reverse ? d.card.reverse.join(' · ') : d.card.upright.join(' · ')}</div>
            </div>
          </div>
        </div>
        <div class="tarot-slot-label">${labels[i]}</div>
      </div>`).join('');

    result.innerHTML = `
      <div class="tarot-cards">${slots}</div>
      <div class="ai-note" style="margin-top:14px">轻触卡牌翻面</div>
      <div id="tarotReading" style="display:none"></div>
      <div id="tarotAiBar"></div>`;

      result.querySelectorAll('.tarot-slot').forEach(slot => {
        slot.addEventListener('click', () => {
          slot.classList.add('flipped');
          slot.querySelector('.tarot-inner').style.pointerEvents = 'none';
          checkAllFlipped();
        });
      });
      window.scrollTo(0, wrap.offsetTop);
    } finally {
      if (drawBtn) drawBtn.disabled = false;
    }
  }

  function checkAllFlipped() {
    if (!el || !drawn) return;
    const total = el.querySelectorAll('.tarot-slot').length;
    const flipped = el.querySelectorAll('.tarot-slot.flipped').length;
    if (flipped === total) showReading();
  }

  function showReading() {
    if (!el || !drawn) return;
    const reading = el.querySelector('#tarotReading');
    const bar = el.querySelector('#tarotAiBar');
    reading.style.display = 'block';

    const labels = spread === 'three' ? ['过去', '现在', '未来'] : spread === 'choice' ? ['选择 A', '选择 B'] : ['今日指引'];
    const heads = drawn.map((d, i) =>
      '<p class="card-head">' + labels[i] + ' · ' + d.card.name + (d.reverse ? '（逆位）' : '（正位）') + '</p>');
    const bodies = drawn.map(d => '<p>' + (d.reverse ? d.card.reverseText : d.card.uprightText) + '</p>');

    reading.innerHTML = drawn.map((d, i) =>
      heads[i] + '<p style="font-size:13px;color:var(--text-dim)">' + d.card.en + (d.card.suitName ? ' · ' + d.card.suitName : '') + ' · 关键词：' + (d.reverse ? d.card.reverse.join('、') : d.card.upright.join('、')) + '</p>' + bodies[i] +
      '<div class="t-domains">' + domainHtml(d.card, d.reverse) + '</div>').join('');

    // AI 增强入口
    const q = question.trim() || (spread === 'one' ? '今日指引' : spread === 'three' ? '过去/现在/未来' : '二选一抉择');
    bar.innerHTML = `<button class="ai-btn night-btn" id="tarotAiBtn">✨ 深度解牌</button>
      <div id="tarotAiOut"></div>`;
    bar.querySelector('#tarotAiBtn').addEventListener('click', async (e) => {
      e.target.disabled = true;
      const out = bar.querySelector('#tarotAiOut');
      out.innerHTML = '<div class="ai-loading"><div class="spinner"></div><div>解读生成中…</div></div>';
      try {
        const payload = { spread, question: q, cards: drawn.map(d => ({
          name: d.card.name, en: d.card.en, orientation: d.reverse ? 'reverse' : 'upright',
          upright: d.card.upright, reverse: d.card.reverse
        })) };
        const res = await window.AI.ask('/api/tarot-reading', payload, () => localReading());
        out.innerHTML = res.degraded
          ? '<div class="ai-note ai-degraded">本阁藏卷已为你解牌</div><div class="tarot-reading">' + localReadingHtml() + '</div>'
          : '<div class="tarot-reading">' + window.AI.renderText(res.text) + '</div>';
      } finally { e.target.disabled = false; }
    });
  }

  function localReading() {
    if (!drawn) return '';
    const labels = spread === 'three' ? ['过去', '现在', '未来'] : spread === 'choice' ? ['选择 A', '选择 B'] : ['今日指引'];
    const lines = drawn.map((d, i) => {
      const main = d.reverse ? d.card.reverseText : d.card.uprightText;
      return labels[i] + '是「' + d.card.name + '」' + (d.reverse ? '逆位' : '正位') + '。' + main;
    });
    let overall;
    if (spread === 'one') overall = '这一张牌代表着你此刻最需要听见的声音。';
    else if (spread === 'three') overall = '三张牌串联起一条时间线，过去铺垫了现在，现在正酝酿着未来。';
    else overall = '两张牌代表你面前的两条路。你真正的答案，往往藏在哪个选择让你心里更安稳之间。';
    return '【牌阵解读】\n' + lines.join('\n') + '\n【整体提示】' + overall + (question.trim() ? '\n关于你心中所问，答案正随着你对牌面的领悟渐渐清晰。' : '');
  }
  function localReadingHtml() {
    return window.AI.renderText(localReading());
  }

  /* ---------- 模块接口 ---------- */
  window.TarotApp = {
    render,
    init() {},
    /* 供「今日」融合模块复用：当日大阿卡纳指引 */
    getDailyCard() { return dailyOne(); },
    getDeck() { return fullDeck(); }
  };
})();
