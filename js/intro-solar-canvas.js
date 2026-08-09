/* ============================================================
   卦阁 v8 · 太阳系开屏（Canvas 2D 版）—— window.Intro2
   纯 Canvas2D 绘制：任何浏览器必支持，绝无黑屏/变形问题
   - 星空背景：渐变 + 闪烁星星 + 星云
   - 太阳：发光渐变圆 + 光晕
   - 八大行星：分散在轨道上，绕日公转
   - 标题居中，不遮行星
   ============================================================ */
(function () {
  /* 八大行星：轨道半径(相对0-1)、大小、颜色、速度 */
  var PLANETS = [
    { R: 0.14, size: 0.026, speed: 1.55, col: '#8f7d6b' },   // 水星（灰褐）
    { R: 0.20, size: 0.038, speed: 1.20, col: '#e6d3a3' },   // 金星（米黄）
    { R: 0.27, size: 0.042, speed: 1.00, col: '#3b6fa8' },   // 地球（海洋蓝）
    { R: 0.33, size: 0.034, speed: 0.82, col: '#c96a3b' },   // 火星（铁锈红）
    { R: 0.44, size: 0.070, speed: 0.55, col: '#c9a06a' },   // 木星（橙棕）
    { R: 0.53, size: 0.060, speed: 0.40, col: '#d9bd8a' },   // 土星（淡金）
    { R: 0.61, size: 0.046, speed: 0.28, col: '#6f9fc7' },   // 天王（青）
    { R: 0.68, size: 0.046, speed: 0.20, col: '#2c5a9e' }    // 海王（深蓝）
  ];

  /* 颜色变亮/变暗（hex → 调整亮度） */
  function adjust(col, amt) {
    var c = col.replace('#', '');
    var n = parseInt(c, 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, Math.round(r + amt * 255)));
    g = Math.max(0, Math.min(255, Math.round(g + amt * 255)));
    b = Math.max(0, Math.min(255, Math.round(b + amt * 255)));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  function lighten(col, amt) { return adjust(col, amt); }
  function darken(col, amt) { return adjust(col, -amt); }

  function play(canvas, overlay, onDone) {
    var ctx = null;
    try { ctx = canvas.getContext('2d'); } catch (e) {}
    if (!ctx) { if (onDone) onDone(); return; }

    var finished = false;
    var finish = function () { if (!finished) { finished = true; if (onDone) onDone(); } };

    var raf = null, start = performance.now(), skip = false;
    var W = 0, H = 0;

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      var rect = canvas.getBoundingClientRect();
      W = rect.width || canvas.clientWidth || window.innerWidth;
      H = rect.height || canvas.clientHeight || window.innerHeight;
      canvas.width = Math.max(1, Math.round(W * dpr));
      canvas.height = Math.max(1, Math.round(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    /* 预生成星星（相对位置固定，闪烁动画） */
    var stars = [];
    /* 用网格+随机偏移，让星星均匀铺满（智能星空感），数量更多更密 */
    var GRID = 18;
    for (var i = 0; i < GRID; i++) {
      for (var j = 0; j < GRID; j++) {
        stars.push({
          x: (i + 0.5 + (Math.random() - 0.5) * 0.8) / GRID,
          y: (j + 0.5 + (Math.random() - 0.5) * 0.8) / GRID,
          r: Math.random() * 1.8 + 0.3,
          ph: Math.random() * 6.28,
          sp: 0.5 + Math.random() * 2,
          bright: Math.random() < 0.2
        });
      }
    }
    /* 星云色块（相对位置，更丰富） */
    var nebulas = [];
    for (var j = 0; j < 9; j++) {
      nebulas.push({
        x: Math.random(), y: Math.random(),
        r: 0.18 + Math.random() * 0.32,
        col: Math.random() < 0.5 ? 'rgba(140, 110, 230, ' : 'rgba(100, 140, 220, '
      });
    }

    function frame() {
      if (skip) return;
      var t = (performance.now() - start) / 1000;
      var cx = W / 2, cy = H / 2;

      /* 背景：深空渐变 */
      var bg = ctx.createRadialGradient(cx, cy * 0.8, 10, cx, cy, Math.max(W, H) * 0.8);
      bg.addColorStop(0, '#120a24');
      bg.addColorStop(0.5, '#0b0618');
      bg.addColorStop(1, '#04020a');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      /* 星云色块（更明显） */
      for (var n = 0; n < nebulas.length; n++) {
        var nb = nebulas[n];
        var g = ctx.createRadialGradient(nb.x * W, nb.y * H, 0, nb.x * W, nb.y * H, nb.r * Math.min(W, H));
        g.addColorStop(0, nb.col + '0.30)');
        g.addColorStop(1, nb.col + '0)');
        ctx.fillStyle = g;
        ctx.fillRect(nb.x * W - nb.r * W, nb.y * H - nb.r * H, nb.r * W * 2, nb.r * H * 2);
      }

      /* 星星（闪烁，更亮更大） */
      for (var s = 0; s < stars.length; s++) {
        var st = stars[s];
        var alpha = 0.4 + 0.6 * Math.abs(Math.sin(st.ph + t * st.sp));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = st.bright ? '#f0e6ff' : '#ffffff';
        ctx.beginPath();
        ctx.arc(st.x * W, st.y * H, st.r * 1.3, 0, 6.28);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      /* 轨道（淡圈，拉大更清晰） */
      ctx.strokeStyle = 'rgba(212, 176, 106, 0.3)';
      ctx.lineWidth = 1.2;
      var orbitR = Math.min(W, H) * 0.50;
      for (var p = 0; p < PLANETS.length; p++) {
        ctx.beginPath();
        ctx.arc(cx, cy, orbitR * PLANETS[p].R, 0, 6.28);
        ctx.stroke();
      }

      /* 太阳：发光圆 + 光晕 */
      var sunR = Math.min(W, H) * 0.08;
      var sunGlow = ctx.createRadialGradient(cx, cy, sunR * 0.3, cx, cy, sunR * 2.2);
      sunGlow.addColorStop(0, 'rgba(255, 230, 150, 0.9)');
      sunGlow.addColorStop(0.3, 'rgba(255, 200, 100, 0.5)');
      sunGlow.addColorStop(1, 'rgba(255, 180, 80, 0)');
      ctx.fillStyle = sunGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, sunR * 2.2, 0, 6.28);
      ctx.fill();
      // 太阳本体
      var sunG = ctx.createRadialGradient(cx - sunR * 0.3, cy - sunR * 0.3, sunR * 0.1, cx, cy, sunR);
      sunG.addColorStop(0, '#ffe9b8');
      sunG.addColorStop(0.5, '#f5c96a');
      sunG.addColorStop(1, '#ff9d2e');
      ctx.fillStyle = sunG;
      ctx.beginPath();
      ctx.arc(cx, cy, sunR, 0, 6.28);
      ctx.fill();

      /* 八大行星（分散轨道上，绕日公转） */
      for (var i = 0; i < PLANETS.length; i++) {
        var pl = PLANETS[i];
        var ang = pl.speed * t + i * 0.8;
        var px = cx + Math.cos(ang) * orbitR * pl.R;
        var py = cy + Math.sin(ang) * orbitR * pl.R;
        var pr = Math.min(W, H) * pl.size;

        // 柔和大气光晕（范围更大，更柔和）
        var glow = ctx.createRadialGradient(px, py, pr * 0.3, px, py, pr * 2.0);
        glow.addColorStop(0, lighten(pl.col, 0.12));
        glow.addColorStop(0.45, pl.col);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, pr * 2.0, 0, 6.28);
        ctx.fill();
        ctx.globalAlpha = 1;

        // 行星本体：丰富光照层次（受光高光 + 主色 + 暗部）
        var pg = ctx.createRadialGradient(
          px - pr * 0.45, py - pr * 0.45, pr * 0.02,
          px - pr * 0.1, py - pr * 0.1, pr * 1.3
        );
        pg.addColorStop(0, lighten(pl.col, 0.35));
        pg.addColorStop(0.35, lighten(pl.col, 0.1));
        pg.addColorStop(0.7, pl.col);
        pg.addColorStop(1, darken(pl.col, 0.45));
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, 6.28);
        ctx.fill();

        // 行星带：三条柔和色带（气态巨行星质感，更细腻）
        ctx.globalAlpha = 0.32;
        ctx.strokeStyle = darken(pl.col, 0.3);
        ctx.lineWidth = pr * 0.12;
        ctx.beginPath();
        ctx.ellipse(px, py, pr * 0.92, pr * 0.2, -0.35, 0, 6.28);
        ctx.stroke();
        ctx.globalAlpha = 0.26;
        ctx.strokeStyle = lighten(pl.col, 0.2);
        ctx.lineWidth = pr * 0.09;
        ctx.beginPath();
        ctx.ellipse(px, py, pr * 0.86, pr * 0.16, 0.5, 0, 6.28);
        ctx.stroke();
        ctx.globalAlpha = 0.22;
        ctx.strokeStyle = darken(pl.col, 0.45);
        ctx.lineWidth = pr * 0.07;
        ctx.beginPath();
        ctx.ellipse(px, py, pr * 0.78, pr * 0.13, 0.1, 0, 6.28);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // 土星环
        if (i === 5) {
          ctx.strokeStyle = 'rgba(220, 200, 120, 0.6)';
          ctx.lineWidth = pr * 0.4;
          ctx.beginPath();
          ctx.ellipse(px, py, pr * 1.8, pr * 0.6, -0.4, 0, 6.28);
          ctx.stroke();
        }
      }

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    function stop() {
      if (skip) return;
      skip = true;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      finish();
    }
    overlay.addEventListener('pointerdown', stop);
    setTimeout(stop, 5000);
  }

  window.Intro2 = { play: play };
})();
