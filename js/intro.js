/* ============================================================
   卦阁 v4 · 开场 3D 星球动画 —— window.Intro
   纯 WebGL 实时渲染（零依赖、离线可用）：
   - 程序化行星表面：海洋 / 大陆 / 极地冰盖 / 动态云层（多层分形噪声）
   - 物理光照：漫反射 + 海洋高光 + 环境光 + 边缘大气辉光（菲涅尔）
   - 深空背景：3D 星野 + 暗淡星云
   - 行星轴倾斜约 20°，缓慢优雅自转
   WebGL 不可用时自动降级为纯色径向渐变星球，绝不卡住页面。
   ============================================================ */
(function () {
  const VERT = [
    'attribute vec3 aPos;',
    'attribute vec2 aUv;',
    'uniform mat4 uModel;',
    'uniform mat4 uVP;',
    'varying vec3 vPos;',
    'varying vec3 vNormal;',
    'varying vec2 vUv;',
    'void main(){',
    '  vec4 world = uModel * vec4(aPos, 1.0);',
    '  vPos = world.xyz;',
    '  vNormal = normalize(mat3(uModel) * aPos);',
    '  vUv = aUv;',
    '  gl_Position = uVP * world;',
    '}'
  ].join('\n');

  /* 行星表面着色器：海洋层次 / 大陆地貌 / 极地冰盖 / 立体云层 / 大气辉光 */
  const FRAG_PLANET = [
    'precision mediump float;',
    'varying vec3 vPos;',
    'varying vec3 vNormal;',
    'uniform vec3 uLight;',
    'uniform float uTime;',
    '',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }',
    'float noise(vec2 p){',
    '  vec2 i = floor(p), f = fract(p);',
    '  f = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),',
    '             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);',
    '}',
    'float fbm(vec2 p){',
    '  float v = 0.0, a = 0.5;',
    '  for (int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.03 + vec2(0.7, 1.3); a *= 0.5; }',
    '  return v;',
    '}',
    'void main(){',
    '  vec3 n = normalize(vNormal);',
    '  vec3 d = normalize(vPos);',
    '  float lon = atan(d.z, d.x);',
    '  float lat = asin(clamp(d.y, -1.0, 1.0));',
    '',
    '  /* 大陆：双层噪声，产生大陆轮廓 + 内部山脉起伏 */',
    '  float cont = fbm(vec2(lon * 2.1 + 3.0, lat * 3.0 + 1.0));',
    '  float contDetail = fbm(vec2(lon * 5.0 + 2.0, lat * 6.0 + 4.0));',
    '  float landMask = smoothstep(0.42, 0.60, cont);',
    '',
    '  /* 海洋：近岸浅蓝 → 深海 */',
    '  vec3 shallow = vec3(0.02, 0.30, 0.46);',
    '  vec3 deep = vec3(0.003, 0.08, 0.20);',
    '  float coast = smoothstep(0.60, 0.78, cont);',
    '  vec3 ocean = mix(shallow, deep, coast);',
    '',
    '  /* 大陆：低地绿 → 高原土黄 → 山脊泛白 */',
    '  vec3 lowland = vec3(0.18, 0.42, 0.16);',
    '  vec3 highland = vec3(0.55, 0.44, 0.26);',
    '  float elev = smoothstep(0.4, 0.85, contDetail);',
    '  vec3 land = mix(lowland, highland, elev);',
    '  float peak = smoothstep(0.82, 0.97, contDetail);',
    '  land = mix(land, vec3(0.78, 0.74, 0.66), peak * 0.6);',
    '',
    '  /* 极地冰盖 */',
    '  float ice = smoothstep(0.68, 0.94, abs(lat));',
    '  vec3 surface = mix(mix(ocean, land, landMask), vec3(0.94, 0.96, 0.99), ice * 0.9);',
    '',
    '  /* 光照：环境 + 漫反射 */',
    '  float diff = max(dot(n, uLight), 0.0);',
    '  vec3 col = surface * (0.10 + 0.90 * diff);',
    '  vec3 hv = normalize(uLight + vec3(0.0, 0.0, 1.0));',
    '  float spec = pow(max(dot(n, hv), 0.0), 26.0) * (1.0 - landMask) * diff;',
    '  col += vec3(0.9, 0.95, 1.0) * spec * 0.45;',
    '',
    '  /* 立体云层：双层云，浅色高光 + 暗影立体感 */',
    '  float cloudA = fbm(vec2(lon * 5.0 - uTime * 0.014, lat * 5.0 + 2.0));',
    '  float cloudB = fbm(vec2(lon * 9.0 + uTime * 0.01, lat * 9.0 + 6.0));',
    '  float cloud = smoothstep(0.60, 0.85, cloudA * 0.7 + cloudB * 0.3);',
    '  float cloudL = max(dot(n, uLight), 0.0);',
    '  vec3 ccol = mix(vec3(0.72, 0.76, 0.84), vec3(1.0), cloudL);',
    '  col = mix(col, ccol, cloud * 0.6);',
    '  /* 云影：云层背光侧投下淡影 */',
    '  col *= (1.0 - cloud * (1.0 - cloudL) * 0.35);',
    '',
    '  /* 边缘大气辉光（菲涅尔），暖金偏蓝的柔和大气 */',
    '  float fres = pow(1.0 - max(dot(n, vec3(0.0, 0.0, 1.0)), 0.0), 2.6);',
    '  vec3 atmo = mix(vec3(0.35, 0.6, 0.95), vec3(0.9, 0.7, 0.5), diff);',
    '  col += atmo * fres * 0.55;',
    '',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* 大气壳（外发光）：仅边缘可见 */
  const FRAG_ATMO = [
    'precision mediump float;',
    'varying vec3 vNormal;',
    'uniform vec3 uColor;',
    'void main(){',
    '  float a = pow(1.0 - max(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 0.0), 2.2);',
    '  gl_FragColor = vec4(uColor, a * 0.55);',
    '}'
  ].join('\n');

  /* 深空背景全屏三角形顶点着色器 */
  const VERT_SKY = [
    'attribute vec2 aPos;',
    'varying vec2 vUv;',
    'void main(){',
    '  vUv = aPos * 0.5 + 0.5;',   // [-1,3] 三角 → [0,2] uv
    '  gl_Position = vec4(aPos, 0.0, 1.0);',
    '}'
  ].join('\n');

  /* 深空背景：3D 星野 + 星云 */
  const FRAG_SKY = [
    'precision mediump float;',
    'varying vec2 vUv;',
    'uniform float uTime;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }',
    'float nebula(vec2 p){ return sin(p.x * 5.0 + p.y * 3.0) * 0.5 + 0.5; }',
    'void main(){',
    '  vec2 p = vUv;',
    '  float star = 0.0;',
    '  vec2 g = p * 40.0;',
    '  vec2 id = floor(g);',
    '  vec2 f = fract(g) - 0.5;',
    '  float h = hash(id);',
    '  float r = 0.45 * (0.5 + h);',
    '  float d = length(f);',
    '  float s = smoothstep(r, 0.0, d) * step(0.90, h);',
    '  /* 闪烁 */',
    '  float tw = 0.5 + 0.5 * sin(uTime * (1.0 + h * 4.0) + h * 40.0);',
    '  star = max(star, s * (0.4 + 0.6 * tw));',
    '  /* 星云暗带：深紫星云，契合主题 */',
    '  float neb = nebula(p);',
    '  vec3 col = vec3(0.015, 0.01, 0.035) + vec3(0.07, 0.04, 0.13) * neb * 0.55;',
    '  col += vec3(star) * (0.6 + 0.4 * tw);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* ---------- 工具 ---------- */
  function createShader(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn('shader error:', gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  }
  function createProgram(gl, vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, createShader(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, createShader(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn('link error'); return null; }
    return p;
  }
  function mat4Identity() { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; }
  /* 简易透视投影 */
  function mat4Perspective(fovy, aspect, near, far) {
    const f = 1.0 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    return [f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0];
  }
  /* 视点：从 +Z 看向原点，略微抬高 */
  function mat4LookAt(eye, center, up) {
    const z = norm(sub(eye, center)); const x = norm(cross(up, z)); const y = cross(z, x);
    return [x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0,
      -dot(x,eye), -dot(y,eye), -dot(z,eye), 1];
  }
  function sub(a,b){ return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
  function cross(a,b){ return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
  function dot(a,b){ return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
  function norm(a){ const l=Math.sqrt(dot(a,a))||1; return [a[0]/l,a[1]/l,a[2]/l]; }
  /* 绕 Y 轴旋转 * 绕 Z 倾斜：行星轴向倾斜 22° */
  function mat4TiltRotate(angle) {
    const tilt = 22 * Math.PI / 180;
    const cz = Math.cos(tilt), sz = Math.sin(tilt);
    const cy = Math.cos(angle), sy = Math.sin(angle);
    // R = Rz(tilt) * Ry(angle)
    const m = mat4Identity();
    // 列主序：先应用 Ry，再 Rz
    // Rz * Ry
    const r00 = cz * cy, r01 = -cz * sy, r02 = sz;
    const r10 = cy,     r11 = sy,     r12 = 0;
    const r20 = -sz * cy, r21 = sz * sy, r22 = cz;
    // 转成列主序
    return [r00, r10, r20, 0,  r01, r11, r21, 0,  r02, r12, r22, 0,  0,0,0,1];
  }
  function mat4Mul(a, b) {
    const o = new Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c*4+r] = a[0*4+r]*b[c*4+0] + a[1*4+r]*b[c*4+1] + a[2*4+r]*b[c*4+2] + a[3*4+r]*b[c*4+3];
    }
    return o;
  }

  /* 生成 UV 球体几何（positions + uv + 法线即方向） */
  function buildSphere(latSeg, lonSeg) {
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= latSeg; i++) {
      const v = i / latSeg;
      const phi = v * Math.PI;              // 0..π
      const y = Math.cos(phi);
      const r = Math.sin(phi);
      for (let j = 0; j <= lonSeg; j++) {
        const u = j / lonSeg;
        const theta = u * Math.PI * 2;
        pos.push(r * Math.cos(theta), y, r * Math.sin(theta));
        uv.push(u, v);
      }
    }
    for (let i = 0; i < latSeg; i++) {
      for (let j = 0; j < lonSeg; j++) {
        const a = i * (lonSeg + 1) + j;
        const b = a + lonSeg + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    return { pos: new Float32Array(pos), uv: new Float32Array(uv), idx: new Uint16Array(idx) };
  }

  /* ============ 主入口 ============ */
  function play(canvas, overlay, onDone) {
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let gl = null;
    // 苹果 iOS Safari 兼容：不用 alpha:false（导致变色），关 antialias 避免渲染 bug
    try { gl = canvas.getContext('webgl', { antialias: false, alpha: true, preserveDrawingBuffer: true }) || canvas.getContext('experimental-webgl', { antialias: false, alpha: true }); } catch (e) { gl = null; }

    const finish = () => { if (onDone) onDone(); };

    if (!gl || reduced) {
      // 降级：Canvas2D 渐变星球 + 自转高光（WebGL 不可用或用户关闭动效）
      fallback(canvas, onDone);
      return;
    }

    const vs = createProgram(gl, VERT, FRAG_PLANET);
    if (!vs) { fallback(canvas, onDone); return; }

    /* 统一几何缓冲 */
    const sphere = buildSphere(64, 128);
    function bindSphere(prog) {
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, sphere.pos, gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
      const ibuf = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphere.idx, gl.STATIC_DRAW);
    }

    /* 背景星空 */
    const skyProg = createProgram(gl, VERT_SKY, FRAG_SKY);
    let skyBuf = null;
    if (skyProg) {
      skyBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(skyProg, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    }

    /* 大气壳 */
    const atmoProg = createProgram(gl, VERT, FRAG_ATMO);

    gl.clearColor(0.04, 0.03, 0.09, 1.0);   // 深紫黑底（iOS 上避免纯黑反差变色）
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    let eye = [0, 0.25, 3.1];
    const center = [0, 0, 0];
    const light = norm([0.55, 0.45, 0.62]);   // 恒定光照方向

    let raf = null, start = performance.now(), skip = false;

    function resize() {
      // 苹果 Retina DPR 可达 3，不能硬截断到 1.5（导致 canvas 与 CSS 尺寸不匹配 → 变形模糊）
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const rect = canvas.getBoundingClientRect();
      const w = rect.width || canvas.clientWidth || window.innerWidth;
      const h = rect.height || canvas.clientHeight || window.innerHeight;
      const pw = Math.max(1, Math.round(w * dpr));
      const ph = Math.max(1, Math.round(h * dpr));
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      gl.viewport(0, 0, pw, ph);
    }
    resize();
    window.addEventListener('resize', resize);

    function frame() {
      if (skip) return;
      const t = (performance.now() - start) / 1000;
      const w = canvas.width, h = canvas.height;

      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      /* 背景星空 */
      if (skyProg && skyBuf) {
        gl.useProgram(skyProg);
        gl.disable(gl.DEPTH_TEST);
        gl.uniform1f(gl.getUniformLocation(skyProg, 'uTime'), t);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.enable(gl.DEPTH_TEST);
      }

      /* 视角投影：相机轻微环绕 + 缓慢推近，优雅纵深 */
      const camA = t * 0.045;
      const camDist = 3.15 - t * 0.03;
      eye = [Math.sin(camA) * camDist * 0.25, 0.28 + Math.sin(t * 0.3) * 0.05, Math.cos(camA) * camDist];
      const aspect = w / h;
      const proj = mat4Perspective(50 * Math.PI / 180, aspect, 0.1, 20);
      const view = mat4LookAt(eye, center, [0, 1, 0]);
      const vp = mat4Mul(proj, view);

      /* 星球：缓慢优雅自转 + 轴向倾斜 */
      const model = mat4TiltRotate(t * 0.045);
      gl.useProgram(vs);
      bindSphere(vs);
      gl.uniformMatrix4fv(gl.getUniformLocation(vs, 'uModel'), false, model);
      gl.uniformMatrix4fv(gl.getUniformLocation(vs, 'uVP'), false, vp);
      gl.uniform3f(gl.getUniformLocation(vs, 'uLight'), light[0], light[1], light[2]);
      gl.uniform1f(gl.getUniformLocation(vs, 'uTime'), t);
      gl.drawElements(gl.TRIANGLES, sphere.idx.length, gl.UNSIGNED_SHORT, 0);

      /* 大气壳：放大 1.08，暖紫蓝渐变辉光（配合深紫主题） */
      if (atmoProg) {
        const s = 1.08;
        const am = [s,0,0,0, 0,s,0,0, 0,0,s,0, 0,0,0,1];
        gl.useProgram(atmoProg);
        bindSphere(atmoProg);
        gl.uniformMatrix4fv(gl.getUniformLocation(atmoProg, 'uModel'), false, am);
        gl.uniformMatrix4fv(gl.getUniformLocation(atmoProg, 'uVP'), false, vp);
        gl.uniform3f(gl.getUniformLocation(atmoProg, 'uColor'), 0.55, 0.45, 0.95);
        gl.drawElements(gl.TRIANGLES, sphere.idx.length, gl.UNSIGNED_SHORT, 0);
      }

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    overlay.addEventListener('pointerdown', () => {
      skip = true;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      finish();
    });

    /* 自动淡出时长 */
    setTimeout(() => {
      if (skip) return;
      skip = true;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      finish();
    }, 4400);
  }

  /* Canvas2D 降级：简单渐变星球 */
  function fallback(canvas, onDone) {
    const ctx = canvas.getContext('2d');
    if (!ctx) { onDone(); return; }
    let raf = null, start = performance.now(), skip = false;
    function resize() { canvas.width = canvas.clientWidth || innerWidth; canvas.height = canvas.clientHeight || innerHeight; }
    resize(); window.addEventListener('resize', resize);
    function frame() {
      if (skip) return;
      const t = (performance.now() - start) / 1000;
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      // 深紫夜空背景
      const bg = ctx.createRadialGradient(w * 0.5, h * 0.2, 10, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
      bg.addColorStop(0, '#1a1030'); bg.addColorStop(1, '#0b0615');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      // 星空
      for (let i = 0; i < 130; i++) {
        const sx = (i * 137.5) % w, sy = (i * 97.3) % h;
        const a = 0.3 + 0.7 * Math.abs(Math.sin(t + i));
        ctx.globalAlpha = a * 0.8; ctx.fillStyle = i % 7 === 0 ? '#cbb8ff' : '#fff';
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }
      ctx.globalAlpha = 1;
      // 星球
      const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.30;
      const g = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.4, r * 0.1, cx, cy, r);
      g.addColorStop(0, '#5a92cc'); g.addColorStop(0.6, '#1d5a8a'); g.addColorStop(1, '#0a2240');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.fill();
      // 大陆斑驳
      ctx.globalAlpha = 0.25; ctx.fillStyle = '#3f7d4a';
      for (let i = 0; i < 22; i++) {
        const px = cx + Math.cos(i * 2.7 + t * 0.1) * r * 0.55;
        const py = cy + Math.sin(i * 1.9 + t * 0.08) * r * 0.45;
        ctx.beginPath(); ctx.arc(px, py, r * 0.12 * (0.5 + (i % 3) * 0.2), 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // 高光旋转
      const shine = ctx.createRadialGradient(cx + Math.cos(t * 0.5) * r * 0.5, cy - r * 0.3, 0, cx, cy, r);
      shine.addColorStop(0, 'rgba(255,255,255,0.4)'); shine.addColorStop(0.3, 'rgba(255,255,255,0)');
      ctx.fillStyle = shine; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.fill();
      // 紫色大气光晕
      const atmo = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.15);
      atmo.addColorStop(0, 'rgba(140,110,230,0)'); atmo.addColorStop(0.75, 'rgba(140,110,230,0.14)'); atmo.addColorStop(1, 'rgba(140,110,230,0)');
      ctx.fillStyle = atmo; ctx.beginPath(); ctx.arc(cx, cy, r * 1.15, 0, 6.283); ctx.fill();
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    function done() { if (skip) return; skip = true; if (raf) cancelAnimationFrame(raf); window.removeEventListener('resize', resize); onDone(); }
    canvas.addEventListener('pointerdown', done);
    setTimeout(done, 3200);
  }

  window.Intro = { play };
})();
