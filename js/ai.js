/* ============================================================
   卦阁 v4 · AI 增强层 —— window.AI
   探测 AI 可用性；统一 ask()；失败/无 key 时本地降级
   本地降级构建器（八字：命之书 / 问卦 / 流年）复用 BaziApp 字典
   ============================================================ */
(function () {
  const U = window.AppUtil;

  let status = null;   // null=未探测, true/false

  /* 后端地址列表：优先 URL ?api= 参数，其次 localStorage 'guage.api'，支持逗号分隔多后端
     多后端时自动轮换：先用第一个，探测失败自动换下一个，直到找到可用的 */
  function apiCandidates() {
    try {
      const p = new URLSearchParams(location.search);
      if (p.get('api')) return p.get('api').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
      const saved = localStorage.getItem('guage.api');
      if (saved) return saved.split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
    } catch (e) {}
    return [''];
  }

  async function apiBase() {
    const cands = apiCandidates();
    if (cands.length === 1) return cands[0];
    // 多后端：探测第一个可用
    for (const c of cands) {
      try {
        const r = await fetch(c + '/api/status', { method: 'POST' });
        const j = await r.json();
        if (j && j.ai) return c;
      } catch (e) {}
    }
    return cands[0]; // 全不通，退回第一个（走降级）
  }

  async function probe() {
    // 已确认可用则直接返回；失败不缓存（下次再试），避免"开VPN后仍降级"
    if (status === true) return true;
    try {
      const base = await apiBase();
      // 必须带 body {path:'/api/status'}，让后端 status 分支识别（不调 DeepSeek，判定 AI 可用）
      const r = await fetch(base + '/api/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/api/status' }),
        signal: AbortSignal.timeout(6000)
      });
      const j = await r.json();
      status = !!(j && j.ai) || null;
      return status === true;
    } catch (e) { status = null; return false; }
  }

  /* 清洗解盘文本：去除一切机器编码（markdown 粗体/斜体/标题/列表/行内码/链接），
     使输出读起来像一位真人命理师的手记。标题符号统一为【】便于展示。 */
  function cleanText(t) {
    if (!t) return '';
    return String(t)
      .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')          // ***粗斜体***
      .replace(/\*\*([^*]+)\*\*/g, '$1')               // **粗体**
      .replace(/\*([^*]+)\*/g, '$1')                   // *斜体*
      .replace(/__([^_]+)__/g, '$1')                   // __粗体__
      .replace(/`([^`]+)`/g, '$1')                     // 行内代码
      .replace(/^#{1,6}\s*(.+?)\s*$/gm, '【$1】')      // markdown 标题 →【标题】
      .replace(/^>\s*/gm, '')                          // 引用符号
      .replace(/^\s*[-*•]\s+/gm, '')                   // 无序列表符
      .replace(/^\s*\d+[.、．]\s+/gm, '')               // 有序列表符
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')         // 链接 [字](url)
      .replace(/<br\s*\/?\s*>/gi, '\n')                // html br → 换行
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  async function ask(path, payload, localBuilder) {
    const aiOk = await probe();
    if (!aiOk) return { text: cleanText(localBuilder ? localBuilder() : ''), degraded: true };
    try {
      const r = await fetch(await apiBase() + path, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const j = await r.json();
      if (j && j.ok && j.text) return { text: cleanText(j.text), degraded: false };
      return { text: cleanText(localBuilder ? localBuilder() : ''), degraded: true };
    } catch (e) {
      return { text: cleanText(localBuilder ? localBuilder() : ''), degraded: true };
    }
  }

  /* ============ 八字本地降级构建器 ============ */
  const dicts = () => (window.BaziApp && window.BaziApp.dicts) || {};

  const baziLocal = {
    book(p) {
      const d = dicts();
      const rizhu = p.rizhu || '';
      const rizhuWx = p.rizhuWx || '';
      const missing = p.missing || [];
      const sx = p.shengxiao || '';
      const wxStr = (p.wxDist ? ['金', '木', '水', '火', '土'].map(w => w + ':' + (p.wxDist[w] || 0)).join(' ') : '');
      const personReading = (d.DAYGAN_READING && d.DAYGAN_READING[rizhuWx]) || '日主禀赋各有千秋，善用所长即可。';
      const sxReading = (d.SHENGXIAO && d.SHENGXIAO[sx]) || '踏实温和，持守本心。';
      const missingReading = missing.length
        ? missing.map(w => (d.MISSING_READING && d.MISSING_READING[w]) || w + '是值得留意补足的方向。').join('')
        : '四柱五行俱全，格局较为周正。';

      return [
        '【命格总论】命主四柱为 ' + p.bazi + '，日主 ' + rizhu + '，五行属「' + rizhuWx + '」。' + personReading + ' ' + missingReading,
        '【性格特质】日主 ' + rizhuWx + ' 性，主 ' + (rizhuWx === '金' ? '刚毅果断' : rizhuWx === '木' ? '仁厚向上' : rizhuWx === '水' ? '聪慧变通' : rizhuWx === '火' ? '热情明理' : '敦厚稳重') + '。生肖属' + sx + '，' + sxReading + '。',
        '【事业运势】五行分布：' + wxStr + '。日主得气则行事顺遂，建议顺五行之旺势择业——旺于' + (p.wxDist && Object.entries(p.wxDist).sort((a, b) => b[1] - a[1])[0] ? Object.entries(p.wxDist).sort((a, b) => b[1] - a[1])[0][0] : '土') + '者宜稳健实干之业，喜动者宜拓展外向之途。',
        '【财富格局】财运与日主喜忌相关。' + (missing.length ? '五行缺 ' + missing.join('、') + '，补足调候则财气渐旺。' : '五行俱全，财源渠道较广，宜开源节流、细水长流。'),
        '【婚姻感情】命局讲究阴阳调和。' + (p.sex === '男' ? '男命以财星为妻（财星，可理解为吸引你、让你愿意付出的人缘与家室），日主得养则姻缘和美。' : '女命以官星为夫（官星，可理解为与你情投意合、相互扶持的另一半），性情温润则家庭和睦。') + '建议多沟通、常体谅，感情自会稳中有升。',
        '【健康提示】' + (missing.length ? '五行缺 ' + missing.join('、') + ' 者，对应脏腑宜多养护：' + missing.map(w => ({ '金': '肺', '木': '肝', '水': '肾', '火': '心', '土': '脾' })[w] + '（' + w + '）').join('、') + '。' : '五行均衡，体魄康健，注意作息规律、劳逸结合即可。'),
        '【流年指引】' + (p.yunDesc || '') + ' 近期宜稳中求进，遇事多思而后行，把握贵人相助之时，规避冲动冒进之险。'
      ].join('\n');
    },

    chat(q, p) {
      const kw = q || '';
      const missing = (p && p.missing) || [];
      const wxStr = (p && p.wxDist) ? ['金', '木', '水', '火', '土'].map(w => w + ':' + (p.wxDist[w] || 0)).join(' ') : '';
      /* 命局强弱：日主五行个数占比判断 */
      const rizhuWx = (p && p.rizhuWx) || '';
      const selfCount = (p && p.wxDist && p.wxDist[rizhuWx]) || 0;
      const strength = selfCount >= 3 ? '身强' : selfCount <= 1 ? '身弱' : '中和';
      const yongShen = strength === '身强' ? '喜克泄耗，宜主动拼搏、担起责任、往外走' : strength === '身弱' ? '喜生扶，宜借贵人、结伴同行、先稳后进' : '顺势而为，讲究平衡';
      const strengthHint = '你命局' + rizhuWx + '之气' + selfCount + '处，属' + strength + '——' + yongShen + '。';
      if (/财/.test(kw)) return '就财运而言，你命局五行分布为：' + wxStr + '。' + strengthHint + (missing.length ? '五行缺 ' + missing.join('、') + '，宜补足调候以旺财库。' : '五行俱全，财源较广。') + '近期正财为主，宜踏实积累、理性规划，切忌冲动消费或投机冒进。开源节流双管齐下，财运自会稳步增长。';
      if (/工作|事业|职业|上班/.test(kw)) return '就事业而言，你命主日干属' + ((p && p.rizhuWx) || '') + '性，宜顺五行之旺势择业：' + (missing.length ? '补足所缺，扬长避短。' : '天资周正，选择面广。') + strengthHint + '建议聚焦一个方向深耕，把长板做到极致，贵人自会被你的专注吸引而来。';
      if (/感情|婚姻|姻缘|对象|恋爱|婚/.test(kw)) return '就感情而言，命局讲究阴阳调和、相生相济。' + (p && p.sex === '男' ? '男命以财星为妻（财星，可理解为吸引你、让你愿意付出的人缘与家室），日主得养则姻缘和美。' : '女命以官星为夫（官星，可理解为与你情投意合、相互扶持的另一半），性情温润则家庭和睦。') + strengthHint + '感情里真诚比技巧重要，多沟通、多体谅，顺其自然，良缘自会靠近。';
      if (/健康|身体|病|睡/.test(kw)) return '就健康而言，' + (missing.length ? '你五行缺 ' + missing.join('、') + '，对应脏腑宜多加养护，规律作息、适度运动为要。' : '你五行均衡，体魄底子不错，注意劳逸结合、情绪疏解即可。') + strengthHint + '身体是最大的本钱，别拿健康换效率。';
      if (/转运|运气|流年|明年|今年/.test(kw)) return '就运势而言，流年更替、五行流转是常理。' + strengthHint + '把握当下能把握的，保持谦逊与努力，转运之年自会到来。建议今年多积累、少折腾，静待时机成熟再发力。';
      if (/[0-9]{4}年/.test(kw)) return '年份运势受流年干支与大运互动影响。' + strengthHint + '建议在该年多行正道、广结善缘，顺势而为，遇事多听取长辈或专业意见，自能趋吉避凶。';
      return '命理之道重在指引而非预言。你此刻的关切，正是命运之轮转动的声音——建议你先稳住眼前的小事，把日子过扎实，许多答案会自然浮现。若有具体所问（财运、事业、感情、健康、某一年运势），欢迎再问。';
    },

    liunian(year, nianGanZhi, p) {
      const sx = (p && p.shengxiao) || '';
      const missing = (p && p.missing) || [];
      return [
        '【整体运势】' + year + ' 年（' + (nianGanZhi || '') + '年）对你而言是' + (missing.length ? '调候补缺、稳中求进' : '根基扎实、顺势而上') + '的一年。保持平常心，好运自会不期而至。',
        '【事业】宜深耕本行、打磨技能，避免频繁变动。把握年中出现的合作机会，务实者终有回报。',
        '【财运】正财平稳，偏财宜谨慎。先储蓄、后消费，投资理财以稳健为先，落袋为安。',
        '【感情】' + (p && p.sex === '男' ? '多陪伴、多倾听，感情自然升温。' : '多表达、少猜疑，用心经营方得长久。') + '单身者桃花运渐起，顺其自然即可。',
        '【健康】注意作息与情绪管理，适度运动增强体质。' + (missing.length ? '五行缺 ' + missing.join('、') + ' 者，宜多亲近对应五行之物与方位。' : ''),
        '【开运建议】常怀感恩，广结善缘；身佩五行调候之物，向喜用之方行；每日读一句正能量的话，心态即风水。'
      ].join('\n');
    }
  };

  /* 把解盘文本渲染成 HTML：标题行（【】开头 或 一、二、三 编号）→ h4，正文 → p。
     标题与正文均做 HTML 转义，杜绝 XSS。 */
  function renderText(text) {
    const U = window.AppUtil;
    return String(text || '').split('\n').map(l => l.trim()).filter(Boolean)
      .map(l => (/^【.+】/.test(l) || /^[一二三四五六七八九十]+[、.．]/.test(l))
        ? '<h4>' + U.escapeHtml(l.replace(/^【|】$/g, '').replace(/^[一二三四五六七八九十]+[、.．]\s*/, '')) + '</h4>'
        : '<p>' + U.escapeHtml(l) + '</p>').join('');
  }

  function resetProbe() { status = null; }

  window.AI = { probe, ask, baziLocal, cleanText, renderText, resetProbe };
})();
