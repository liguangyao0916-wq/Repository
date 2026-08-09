/* ============================================================
   卦阁 v4 · app.js —— 路由 / 懒渲染 / 存储 / 共享工具
   ============================================================ */
(function () {

  /* ---------- 共享工具 ---------- */
  /* 确定性字符串哈希：同输入 → 同输出，用于"当天结果稳定" */
  function hashStr(s) {
    let h = 1779033703 ^ s.length;
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return h >>> 0;
  }

  function pick(arr, seed) { return arr[seed % arr.length]; }

  function todayStr(d) {
    d = d || new Date();
    const pad = (n) => (n < 10 ? '0' : '') + n;
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /* 简易 HTML 转义：所有用户输入拼入 HTML 前必须经此 */
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------- AppStore：localStorage 封装 ---------- */
  const STORE_KEY = 'guage.v4';
  const AppStore = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(STORE_KEY);
        if (!raw) return fallback;
        const obj = JSON.parse(raw);
        return (key in obj) ? obj[key] : fallback;
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try {
        const raw = localStorage.getItem(STORE_KEY);
        const obj = raw ? JSON.parse(raw) : {};
        obj[key] = value;
        localStorage.setItem(STORE_KEY, JSON.stringify(obj));
      } catch (e) {}
    }
  };

  /* ---------- 路由 / 懒渲染 ---------- */
  /* 惰性解析：app.js 先于模块加载，调用时才取 window 上的模块对象 */
  const MODULE_OF = {
    today: () => window.TodayApp,
    xingzuo: () => window.XingzuoApp,
    bazi: () => window.BaziApp,
    tarot: () => window.TarotApp,
    qian: () => window.QianApp
  };
  const rendered = new Set();
  const scrollPos = {};          // 每个 tab 各自的滚动位置
  let current = 'today';

  function showTab(name) {
    const app = MODULE_OF[name] ? MODULE_OF[name]() : null;
    if (!app) return;
    // 离开前记住当前模块的滚动位置
    if (scrollPos[current] !== undefined) scrollPos[current] = window.scrollY || 0;
    current = name;
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.module').forEach(s => s.classList.toggle('active', s.dataset.module === name));
    const sec = document.querySelector('.module[data-module="' + name + '"]');
    if (!rendered.has(name)) {
      try {
        app.render(sec);
        rendered.add(name);   // 只有渲染成功才标记，失败下次进入会重试
      } catch (e) { console.error('模块渲染失败（下次进入将重试）:', name, e); }
    }
    if (app.init) app.init();
    // 回到该模块的滚动位置（首次进入/无记录则顶部）；用 auto 避免 smooth 切换顿挫
    const saved = scrollPos[name] || 0;
    window.scrollTo({ top: saved, behavior: 'auto' });
  }

  /* ---------- 进入主界面（模块可能还在 defer 加载，带重试） ---------- */
  let entered = false;
  function enterApp() {
    if (entered) return;
    if (window.TodayApp) {
      entered = true;
      // 强制彻底清除 splash（双保险：先内联隐藏，再移除 DOM）
      const sp = document.getElementById('splash');
      if (sp) {
        sp.style.display = 'none';
        sp.style.visibility = 'hidden';
        sp.style.pointerEvents = 'none';
        if (sp.parentNode) sp.parentNode.removeChild(sp);
      }
      // 兜底：300ms 后再查一次，确保绝不残留
      setTimeout(() => {
        const s2 = document.getElementById('splash');
        if (s2 && s2.parentNode) { s2.style.display = 'none'; s2.parentNode.removeChild(s2); }
      }, 300);
      showTab('today');
    } else {
      setTimeout(enterApp, 80);   // 等 defer 模块就绪后进入
    }
  }

  /* ---------- 开场动画 ---------- */
  function startIntro() {
    const splash = document.getElementById('splash');
    if (!splash) { enterApp(); return; }
    const canvas = document.getElementById('introCanvas');
    const exit = () => {
      if (splash.dataset.done) return;
      splash.dataset.done = '1';
      splash.classList.add('fade');
      setTimeout(() => { if (splash.parentNode) splash.parentNode.removeChild(splash); }, 650);
      enterApp();
    };
    // 模板选择：URL 参数 ?intro=planet|solar|beidou（默认 solar=太阳系）
    const params = new URLSearchParams(location.search);
    const choice = params.get('intro') || 'solar';
    const tryPlay = (name) => {
      const app = { planet: window.Intro, solar: window.Intro2, beidou: window.IntroBeidou }[name];
      if (app && canvas) { try { app.play(canvas, splash, exit); return true; } catch (e) {} }
      return false;
    };
    // 依次尝试：选定的 → 太阳系 → 单星球 → 北斗 → 快速进入
    if (tryPlay(choice)) return;
    if (choice !== 'solar' && tryPlay('solar')) return;
    if (choice !== 'planet' && tryPlay('planet')) return;
    if (choice !== 'beidou' && tryPlay('beidou')) return;
    setTimeout(exit, 250);
  }

  /* ---------- 启动 ---------- */
  /* 立即绑定 tab（splash 之上的静态按钮，此刻已存在），无需等 DOMContentLoaded */
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => showTab(tab.dataset.tab));
  });

  /* 开场动画立即启动（intro 脚本小而快，不等 lunar.js 等 defer 大脚本） */
  startIntro();

  /* PWA 注册 */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    });
  }

  /* 暴露到 window，供各模块共用 */
  window.AppUtil = { hashStr, pick, todayStr, escapeHtml, switchTab: showTab };
  window.AppStore = AppStore;

})();
