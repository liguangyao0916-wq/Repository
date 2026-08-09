/* ============================================================
   卦阁 v7 · 开场「太阳系运行」动画 —— window.Intro2
   纯 WebGL 实时渲染（零依赖、离线可用、全链路容错）
   真正意义上的太阳系天体运行：
   - 中心发光太阳（核心 + 双层眩光光晕）
   - 八大行星：水金地火木土天海，各据轨道绕日公转（内快外慢）
   - 轨道环线清晰可见，盘面微微倾斜，相机环绕太阳缓缓旋转
   - 行星风格各异：地球蓝绿、火星红、木星土星条纹、土星带环、海王星深蓝
   - 深空星野 + 闪烁星光
   任何异常自动降级 Canvas2D 太阳系，绝不黑屏卡住
   ============================================================ */
(function () {
  var VERT = [
    'attribute vec3 aPos;',
    'uniform mat4 uModel;',
    'uniform mat4 uVP;',
    'varying vec3 vPos;',
    'varying vec3 vNormal;',
    'void main(){',
    '  vec4 world = uModel * vec4(aPos, 1.0);',
    '  vPos = world.xyz;',
    '  vNormal = normalize(mat3(uModel) * aPos);',
    '  gl_Position = uVP * world;',
    '}'
  ].join('\n');

  /* 行星表面：光照 + 条纹/斑块/冰冠 + 大气辉光 */
  var FRAG_PLANET = [
    'precision mediump float;',
    'varying vec3 vPos;',
    'varying vec3 vNormal;',
    'uniform vec3 uLight;',
    'uniform vec3 uColorA;',
    'uniform vec3 uColorB;',
    'uniform float uType;',
    'uniform float uTime;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }',
    'float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y); }',
    'float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<4;i++){ v+=a*noise(p); p=p*2.13+vec2(1.7,3.1); a*=0.5; } return v; }',
    'void main(){',
    '  vec3 n = normalize(vNormal);',
    '  vec3 d = normalize(vPos);',
    '  float lon = atan(d.z, d.x);',
    '  float lat = asin(clamp(d.y, -1.0, 1.0));',
    '  vec2 p = vec2(lon, lat);',
    '  float band = fbm(vec2(lon*3.0+4.0, lat*9.0));',
    '  float detail = fbm(vec2(lon*7.0, lat*12.0)+9.0);',
    '  float stripe = 0.5 + 0.5 * sin(lat*11.0 + band*5.0 + detail*3.0);',
    '  vec3 col;',
    '  if (uType < 0.5) {',
    '    col = mix(uColorA, uColorB, smoothstep(0.15, 0.85, stripe));',
    '  } else if (uType < 1.5) {',
    '    float land = smoothstep(0.40, 0.62, fbm(p*2.0+2.0));',
    '    col = mix(uColorA, uColorB, land);',
    '  } else if (uType < 2.5) {',
    '    float ice = smoothstep(0.62, 0.9, abs(lat));',
    '    col = mix(uColorA, uColorB, band*0.6);',
    '    col = mix(col, vec3(0.95, 0.97, 1.0), ice*0.9);',
    '  } else {',
    '    col = mix(uColorA, uColorB, smoothstep(0.2, 0.8, stripe*0.5 + detail*0.6));',
    '  }',
    '  float diff = max(dot(n, uLight), 0.0);',
    '  col *= (0.14 + 0.86*diff);',
    '  vec3 hv = normalize(uLight + vec3(0.0, 0.0, 1.0));',
    '  col += vec3(1.0, 0.98, 0.92) * pow(max(dot(n, hv), 0.0), 30.0) * diff * 0.3;',
    '  float fres = pow(1.0 - max(dot(n, vec3(0.0,0.0,1.0)), 0.0), 2.8);',
    '  col += mix(uColorB, vec3(0.85,0.9,1.0), 0.5) * fres * 0.5;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* 太阳核心：自发光，不随光照变暗 */
  var FRAG_SUN = [
    'precision mediump float;',
    'varying vec3 vPos;',
    'varying vec3 vNormal;',
    'uniform float uTime;',
    'uniform vec3 uColor;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }',
    'float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y); }',
    'void main(){',
    '  float boil = noise(vNormal.xy*5.0 + uTime*0.6) * 0.5 + noise(vNormal.zy*9.0 - uTime*0.4) * 0.5;',
    '  vec3 col = uColor * (0.85 + 0.35*boil);',
    '  float fres = pow(1.0 - max(dot(normalize(vNormal), vec3(0.0,0.0,1.0)), 0.0), 1.5);',
    '  col += vec3(1.0, 0.9, 0.6) * fres * 0.8;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* 光晕：加法混合，径向渐变发光球 */
  var FRAG_GLOW = [
    'precision mediump float;',
    'varying vec3 vNormal;',
    'varying vec3 vPos;',
    'uniform vec3 uColor;',
    'uniform float uStrength;',
    'void main(){',
    '  float a = pow(1.0 - max(dot(normalize(vNormal), vec3(0.0,0.0,1.0)), 0.0), 2.0);',
    '  gl_FragColor = vec4(uColor, a * uStrength);',
    '}'
  ].join('\n');

  /* 行星环 */
  var FRAG_RING = [
    'precision mediump float;',
    'varying vec3 vPos;',
    'uniform vec3 uColor;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }',
    'float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y); }',
    'void main(){',
    '  float r = length(vPos.xz);',
    '  /* 卡西尼缝：环中段一条暗缝，更真实 */',
    '  float cassini = 1.0 - smoothstep(0.04, 0.09, abs(r - 1.06));',
    '  float band = 0.3 + 0.7 * noise(vec2(r*42.0, 3.0));',
    '  vec3 col = uColor * band * (1.0 - cassini * 0.85);',
    '  gl_FragColor = vec4(col, 0.97);',
    '}'
  ].join('\n');

  /* 轨道环：纯线段圆 */
  var VERT_ORBIT = [
    'attribute vec3 aPos;',
    'uniform mat4 uVP;',
    'void main(){ gl_Position = uVP * vec4(aPos, 1.0); }'
  ].join('\n');
  var FRAG_ORBIT = [
    'precision mediump float;',
    'uniform vec3 uColor;',
    'uniform float uAlpha;',
    'void main(){ gl_FragColor = vec4(uColor, uAlpha); }'
  ].join('\n');

  /* 星空 */
  var VERT_SKY = [
    'attribute vec2 aPos;',
    'varying vec2 vUv;',
    'void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');
  var FRAG_SKY = [
    'precision mediump float;',
    'varying vec2 vUv;',
    'uniform float uTime;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }',
    'void main(){',
    '  vec2 p = vUv;',
    '  /* 深空星云渐变：紫蓝 + 靛 + 微金，多层叠加 */',
    '  float neb1 = sin(p.x*5.0 + p.y*3.5 + uTime*0.015)*0.5 + 0.5;',
    '  float neb2 = sin(p.y*6.0 - p.x*4.0 + uTime*0.012 + 2.0)*0.5 + 0.5;',
    '  vec3 base = vec3(0.02, 0.015, 0.06);',
    '  base += vec3(0.12, 0.08, 0.24) * neb1 * 0.5;',
    '  base += vec3(0.06, 0.10, 0.22) * neb2 * 0.4;',
    '  base += vec3(0.10, 0.08, 0.05) * neb1 * neb2 * 0.3;',
    '  vec3 col = base;',
    '  vec2 g1 = p*46.0; vec2 id1 = floor(g1); vec2 f1 = fract(g1)-0.5;',
    '  float h1 = hash(id1); float tw1 = 0.55+0.45*sin(uTime*(1.0+h1*5.0)+h1*40.0);',
    '  col += vec3(1.0) * smoothstep(0.25+h1*0.2, 0.0, length(f1)) * step(0.985, h1) * tw1 * 0.4;',
    '  vec2 g2 = p*90.0; vec2 id2 = floor(g2); vec2 f2 = fract(g2)-0.5;',
    '  float h2 = hash(id2); float tw2 = 0.55+0.45*sin(uTime*(1.0+h2*4.0)+h2*33.0);',
    '  col += vec3(1.0) * smoothstep(0.2+h2*0.25, 0.0, length(f2)) * step(0.99, h2) * tw2;',
    '  vec2 g3 = p*160.0; vec2 id3 = floor(g3); vec2 f3 = fract(g3)-0.5;',
    '  float h3 = hash(id3); float tw3 = 0.55+0.45*sin(uTime*(1.0+h3*3.0)+h3*27.0);',
    '  col += vec3(1.0) * smoothstep(0.15+h3*0.2, 0.0, length(f3)) * step(0.993, h3) * tw3;',
    '  vec2 g4 = p*70.0; vec2 id4 = floor(g4); vec2 f4 = fract(g4)-0.5;',
    '  float h4 = hash(id4);',
    '  col += mix(vec3(0.9,0.95,1.0), vec3(1.0,0.9,0.7), step(0.5, h4)) * smoothstep(0.22, 0.0, length(f4)) * step(0.9985, h4) * 0.8;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* ---------- 工具 ---------- */
  function createShader(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { if (window.console) console.warn('shader:', gl.getShaderInfoLog(sh)); return null; }
    return sh;
  }
  function createProgram(gl, vs, fs) {
    var p = gl.createProgram();
    gl.attachShader(p, createShader(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, createShader(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { if (window.console) console.warn('link:', gl.getProgramInfoLog(p)); return null; }
    return p;
  }
  function buildSphere(lat, lon) {
    var pos = [], idx = [];
    for (var i = 0; i <= lat; i++) {
      var v = i / lat, phi = v * Math.PI, y = Math.cos(phi), r = Math.sin(phi);
      for (var j = 0; j <= lon; j++) {
        var u = j / lon, th = u * Math.PI * 2;
        pos.push(r * Math.cos(th), y, r * Math.sin(th));
      }
    }
    for (var i = 0; i < lat; i++) for (var j = 0; j < lon; j++) {
      var a = i * (lon + 1) + j, b = a + lon + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    return { pos: new Float32Array(pos), idx: new Uint16Array(idx) };
  }
  function buildRing(inner, outer, seg) {
    var pos = [], idx = [];
    for (var i = 0; i <= seg; i++) {
      var u = i / seg, th = u * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
      pos.push(c * inner, 0, s * inner);
      pos.push(c * outer, 0, s * outer);
    }
    for (var i = 0; i < seg; i++) { var a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    return { pos: new Float32Array(pos), idx: new Uint16Array(idx) };
  }
  function buildOrbit(radius, seg) {
    var pos = [];
    for (var i = 0; i <= seg; i++) {
      var th = (i / seg) * Math.PI * 2;
      pos.push(Math.cos(th) * radius, 0, Math.sin(th) * radius);
    }
    return new Float32Array(pos);
  }
  function mat4Perspective(fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
  }
  function lookAt(eye, center, up) {
    var zx = eye[0]-center[0], zy = eye[1]-center[1], zz = eye[2]-center[2];
    var zl = Math.sqrt(zx*zx+zy*zy+zz*zz)||1; zx/=zl; zy/=zl; zz/=zl;
    var xx = up[1]*zz-up[2]*zy, xy = up[2]*zx-up[0]*zz, xz = up[0]*zy-up[1]*zx;
    var xl = Math.sqrt(xx*xx+xy*xy+xz*xz)||1; xx/=xl; xy/=xl; xz/=xl;
    var yx = zy*xz-zz*xy, yy = zz*xx-zx*xz, yz = zx*xy-zy*xx;
    return [xx,yx,zx,0, xy,yy,zy,0, xz,yz,zz,0,
      -(xx*eye[0]+xy*eye[1]+xz*eye[2]), -(yx*eye[0]+yy*eye[1]+yz*eye[2]), -(zx*eye[0]+zy*eye[1]+zz*eye[2]), 1];
  }
  function mul(a, b) {
    var o = new Array(16);
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) o[c*4+r] = a[0*4+r]*b[c*4+0] + a[1*4+r]*b[c*4+1] + a[2*4+r]*b[c*4+2] + a[3*4+r]*b[c*4+3];
    return o;
  }
  function trs(tx, ty, tz, ang, tilt, s) {
    var cy = Math.cos(ang), sy = Math.sin(ang), cz = Math.cos(tilt), sz = Math.sin(tilt);
    var m00 = cy*cz, m01 = -sy, m02 = cy*sz;
    var m10 = sy*cz, m11 = cy, m12 = sy*sz;
    var m20 = -sz, m21 = 0, m22 = cz;
    return [m00*s, m10*s, m20*s, 0, m01*s, m11*s, m21*s, 0, m02*s, m12*s, m22*s, 0, tx, ty, tz, 1];
  }

  /* ============ 太阳系配置 ============ */
  /* 八大行星：相位、轨道半径、大小、速度、表面类型、颜色、是否带环
     竖屏手机优先：轨道更紧凑、行星更大，确保一眼看清整个太阳系 */
  var PLANETS = [
    { ph: 0.0,  R: 0.95, size: 0.20, speed: 1.55, type: 3, ring: 0, tilt: 0.1, cA: [0.62,0.62,0.62], cB: [0.35,0.35,0.38] },
    { ph: 0.7,  R: 1.25, size: 0.28, speed: 1.20, type: 3, ring: 0, tilt: 0.1, cA: [0.92,0.82,0.55], cB: [0.65,0.5,0.3] },
    { ph: 1.4,  R: 1.55, size: 0.30, speed: 1.00, type: 1, ring: 0, tilt: 0.4, cA: [0.16,0.45,0.8],  cB: [0.14,0.55,0.2] },
    { ph: 2.1,  R: 1.85, size: 0.24, speed: 0.82, type: 3, ring: 0, tilt: 0.2, cA: [0.85,0.45,0.25], cB: [0.5,0.2,0.12] },
    { ph: 2.8,  R: 2.35, size: 0.52, speed: 0.55, type: 0, ring: 0, tilt: 0.1, cA: [0.85,0.65,0.42], cB: [0.5,0.32,0.18] },
    { ph: 3.5,  R: 2.75, size: 0.46, speed: 0.40, type: 0, ring: 1, tilt: 0.35,cA: [0.92,0.78,0.5],  cB: [0.6,0.42,0.22] },
    { ph: 4.2,  R: 3.10, size: 0.34, speed: 0.28, type: 2, ring: 0, tilt: 0.7, cA: [0.5,0.75,0.85], cB: [0.25,0.5,0.6] },
    { ph: 4.9,  R: 3.40, size: 0.34, speed: 0.20, type: 3, ring: 0, tilt: 0.3, cA: [0.2,0.4,0.9],   cB: [0.08,0.2,0.5] }
  ];
  var ORBIT_COLORS = [
    [0.6,0.6,0.65], [0.9,0.8,0.55], [0.3,0.6,0.9], [0.85,0.5,0.3],
    [0.85,0.68,0.45], [0.9,0.8,0.55], [0.5,0.75,0.85], [0.3,0.5,0.9]
  ];
  var SUN_COLOR = [1.0, 0.88, 0.55];

  /* ============ 主入口 ============ */
  function play(canvas, overlay, onDone) {
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var gl = null;
    // 苹果 iOS Safari 兼容：不用 alpha:false（会导致变色），用透明+明确底色；
    // 关 antialias 避免 iOS 渲染 bug，用 preserveDrawingBuffer 兜底
    try {
      gl = canvas.getContext('webgl', { antialias: false, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' })
        || canvas.getContext('experimental-webgl', { antialias: false, alpha: true, preserveDrawingBuffer: true });
    } catch (e) { gl = null; }

    var finished = false;
    var finish = function () { if (!finished) { finished = true; if (onDone) onDone(); } };
    if (!gl || reduced) { fallback(canvas, finish); return; }

    var planetProg = null, sunProg = null, glowProg = null, ringProg = null, orbitProg = null, skyProg = null;
    try {
      planetProg = createProgram(gl, VERT, FRAG_PLANET);
      sunProg = createProgram(gl, VERT, FRAG_SUN);
      glowProg = createProgram(gl, VERT, FRAG_GLOW);
      ringProg = createProgram(gl, VERT, FRAG_RING);
      orbitProg = createProgram(gl, VERT_ORBIT, FRAG_ORBIT);
      skyProg = createProgram(gl, VERT_SKY, FRAG_SKY);
      if (!planetProg || !sunProg || !orbitProg || !skyProg) throw new Error('init failed');
    } catch (e) { fallback(canvas, finish); return; }

    var sphere = buildSphere(42, 84);
    var ring = buildRing(0.78, 1.38, 48);   // 更宽的环，接近真实土星比例
    var orbitBufs = PLANETS.map(function (p) { return buildOrbit(p.R, 96); });

    function bindGeom(prog, geom) {
      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, geom.pos, gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
      var ibuf = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geom.idx, gl.STATIC_DRAW);
      return geom.idx.length;
    }
    function bindOrbit(prog, data, n) {
      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
      return n;
    }

    var skyBuf = null;
    if (skyProg) {
      skyBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
      var sk = gl.getAttribLocation(skyProg, 'aPos');
      gl.enableVertexAttribArray(sk);
      gl.vertexAttribPointer(sk, 2, gl.FLOAT, false, 0, 0);
    }

    gl.clearColor(0.04, 0.03, 0.09, 1);   // 深紫黑底，柔和（iOS 上避免纯黑反差过大变色）
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);

    var light = [0.5, 0.5, 0.62]; var ll = Math.sqrt(light[0]*light[0]+light[1]*light[1]+light[2]*light[2]); light = [light[0]/ll, light[1]/ll, light[2]/ll];

    var raf = null, start = performance.now(), skip = false;
    function resize() {
      // 苹果 Retina DPR 最高到 3，不能用 min(1.5) 硬截断（会导致 canvas 与 CSS 尺寸不匹配 → 变形/模糊）
      var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      var rect = canvas.getBoundingClientRect();
      var w = rect.width || canvas.clientWidth || window.innerWidth;
      var h = rect.height || canvas.clientHeight || window.innerHeight;
      var pw = Math.max(1, Math.round(w * dpr));
      var ph = Math.max(1, Math.round(h * dpr));
      // 仅在尺寸变化时才重设，避免每帧抖动
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      gl.viewport(0, 0, pw, ph);
    }
    resize();
    window.addEventListener('orientationchange', function () { setTimeout(resize, 300); });
    window.addEventListener('resize', resize);

    function frame() {
      if (skip) return;
      var t = (performance.now() - start) / 1000;
      var w = canvas.width, h = canvas.height;
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      /* 星空 */
      if (skyProg && skyBuf) {
        gl.useProgram(skyProg);
        gl.disable(gl.DEPTH_TEST);
        gl.uniform1f(gl.getUniformLocation(skyProg, 'uTime'), t);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.enable(gl.DEPTH_TEST);
      }

      /* 相机：俯视太阳系盘面，拉远避免行星重叠，环绕缓转 */
      var camAng = t * 0.07;
      var dist = 5.6 - Math.sin(t * 0.5) * 0.1;
      var eye = [Math.sin(camAng) * dist, 2.6, Math.cos(camAng) * dist];
      var proj = mat4Perspective(50 * Math.PI / 180, w / h, 0.1, 30);
      var view = lookAt(eye, [0, 0, 0], [0, 1, 0]);
      var vp = mul(proj, view);

      /* 轨道环线 */
      if (orbitProg) {
        gl.useProgram(orbitProg);
        gl.uniformMatrix4fv(gl.getUniformLocation(orbitProg, 'uVP'), false, vp);
        for (var oi = 0; oi < PLANETS.length; oi++) {
          bindOrbit(orbitProg, orbitBufs[oi], 97);
          gl.uniform3f(gl.getUniformLocation(orbitProg, 'uColor'), ORBIT_COLORS[oi][0], ORBIT_COLORS[oi][1], ORBIT_COLORS[oi][2]);
          gl.uniform1f(gl.getUniformLocation(orbitProg, 'uAlpha'), 0.7);
          gl.drawArrays(gl.LINE_STRIP, 0, 97);
        }
      }

      /* 太阳：核心 + 双层光晕（加法混合） */
      gl.useProgram(sunProg);
      var sunN = bindGeom(sunProg, sphere);
      gl.uniformMatrix4fv(gl.getUniformLocation(sunProg, 'uModel'), false, trs(0, 0, 0, 0, 0, 0.32));
      gl.uniformMatrix4fv(gl.getUniformLocation(sunProg, 'uVP'), false, vp);
      gl.uniform1f(gl.getUniformLocation(sunProg, 'uTime'), t);
      gl.uniform3f(gl.getUniformLocation(sunProg, 'uColor'), SUN_COLOR[0], SUN_COLOR[1], SUN_COLOR[2]);
      gl.drawElements(gl.TRIANGLES, sunN, gl.UNSIGNED_SHORT, 0);

      if (glowProg) {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        gl.depthMask(false);
        gl.useProgram(glowProg);
        var glowN = bindGeom(glowProg, sphere);
        gl.uniformMatrix4fv(gl.getUniformLocation(glowProg, 'uVP'), false, vp);
        /* 内层强光 */
        gl.uniformMatrix4fv(gl.getUniformLocation(glowProg, 'uModel'), false, trs(0,0,0, 0,0, 0.95));
        gl.uniform3f(gl.getUniformLocation(glowProg, 'uColor'), 1.0, 0.78, 0.42);
        gl.uniform1f(gl.getUniformLocation(glowProg, 'uStrength'), 0.85);
        gl.drawElements(gl.TRIANGLES, glowN, gl.UNSIGNED_SHORT, 0);
        /* 外层柔光 */
        gl.uniformMatrix4fv(gl.getUniformLocation(glowProg, 'uModel'), false, trs(0,0,0, 0,0, 1.85));
        gl.uniform3f(gl.getUniformLocation(glowProg, 'uColor'), 1.0, 0.82, 0.5);
        gl.uniform1f(gl.getUniformLocation(glowProg, 'uStrength'), 0.4);
        gl.drawElements(gl.TRIANGLES, glowN, gl.UNSIGNED_SHORT, 0);
        gl.depthMask(true);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }

      /* 八大行星公转 */
      var i, p, ang, x, z;
      for (i = 0; i < PLANETS.length; i++) {
        p = PLANETS[i];
        ang = p.ph + t * p.speed;
        x = Math.cos(ang) * p.R;
        z = Math.sin(ang) * p.R;

        gl.useProgram(planetProg);
        var pn = bindGeom(planetProg, sphere);
        gl.uniformMatrix4fv(gl.getUniformLocation(planetProg, 'uModel'), false, trs(x, 0, z, t * 0.5, p.tilt, p.size));
        gl.uniformMatrix4fv(gl.getUniformLocation(planetProg, 'uVP'), false, vp);
        gl.uniform3f(gl.getUniformLocation(planetProg, 'uLight'), light[0], light[1], light[2]);
        gl.uniform3f(gl.getUniformLocation(planetProg, 'uColorA'), p.cA[0], p.cA[1], p.cA[2]);
        gl.uniform3f(gl.getUniformLocation(planetProg, 'uColorB'), p.cB[0], p.cB[1], p.cB[2]);
        gl.uniform1f(gl.getUniformLocation(planetProg, 'uType'), p.type);
        gl.uniform1f(gl.getUniformLocation(planetProg, 'uTime'), t);
        gl.drawElements(gl.TRIANGLES, pn, gl.UNSIGNED_SHORT, 0);

        /* 土星/天王星带环 */
        if (p.ring && ringProg) {
          gl.useProgram(ringProg);
          var rn = bindGeom(ringProg, ring);
          gl.uniformMatrix4fv(gl.getUniformLocation(ringProg, 'uModel'), false, trs(x, 0, z, 0, p.tilt + 0.5, p.size));
          gl.uniformMatrix4fv(gl.getUniformLocation(ringProg, 'uVP'), false, vp);
          gl.uniform3f(gl.getUniformLocation(ringProg, 'uColor'), p.cA[0], p.cA[1], p.cA[2]);
          gl.drawElements(gl.TRIANGLES, rn, gl.UNSIGNED_SHORT, 0);
        }
      }

      /* 行星发光晕：加法混合，每颗行星一层柔和光晕（更立体） */
      if (glowProg) {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        gl.depthMask(false);
        gl.useProgram(glowProg);
        var planetGlowN = bindGeom(glowProg, sphere);
        gl.uniformMatrix4fv(gl.getUniformLocation(glowProg, 'uVP'), false, vp);
        for (i = 0; i < PLANETS.length; i++) {
          p = PLANETS[i];
          ang = p.ph + t * p.speed;
          x = Math.cos(ang) * p.R;
          z = Math.sin(ang) * p.R;
          gl.uniformMatrix4fv(gl.getUniformLocation(glowProg, 'uModel'), false, trs(x, 0, z, 0, 0, p.size * 1.8));
          gl.uniform3f(gl.getUniformLocation(glowProg, 'uColor'), p.cA[0], p.cA[1], p.cA[2]);
          gl.uniform1f(gl.getUniformLocation(glowProg, 'uStrength'), 0.28);
          gl.drawElements(gl.TRIANGLES, planetGlowN, gl.UNSIGNED_SHORT, 0);
        }
        gl.depthMask(true);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
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
    var onTouch = function (e) {
      // 仅当 splash 还在时 preventDefault（避免移除后残留拦截输入框键盘）
      if (!finished && !document.getElementById('splash')) return;
      e.preventDefault();
      stop();
    };
    var onPointer = function (e) {
      if (!finished && !document.getElementById('splash')) return;
      stop();
    };
    overlay.addEventListener('pointerdown', onPointer);
    overlay.addEventListener('touchstart', onTouch, { passive: false });
    setTimeout(stop, 3000);
    // 动画结束后主动解绑，确保不干扰页面输入
    var cleanup = function () {
      overlay.removeEventListener('pointerdown', onPointer);
      overlay.removeEventListener('touchstart', onTouch);
    };
    finish = function () { if (!finished) { finished = true; cleanup(); if (onDone) onDone(); } };
  }

  /* ---------- Canvas2D 降级：太阳系示意图 ---------- */
  function fallback(canvas, done) {
    var ctx = null;
    try { ctx = canvas.getContext('2d'); } catch (e) {}
    if (!ctx) { done(); return; }
    var raf = null, start = performance.now(), skip = false;
    function resize() { canvas.width = canvas.clientWidth || innerWidth; canvas.height = canvas.clientHeight || innerHeight; }
    resize(); window.addEventListener('resize', resize);
    var cols = ['#999', '#e8d28a', '#4a9ad8', '#d0703a', '#d9a860', '#d8c070', '#7ab8d0', '#3a6ad0'];
    var R = [0.80, 1.02, 1.26, 1.50, 1.92, 2.22, 2.50, 2.72];
    var sp = [1.55, 1.20, 1.00, 0.82, 0.55, 0.40, 0.28, 0.20];
    var sz = [4.5, 6, 6.5, 5.5, 13, 11, 7.5, 7.5];
    function frame() {
      if (skip) return;
      var t = (performance.now() - start) / 1000;
      var w = canvas.width, h = canvas.height, cx = w / 2, cy = h / 2;
      var scale = Math.min(w, h) / 8.4;   // 缩放轨道（更紧凑）
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#04030c'; ctx.fillRect(0, 0, w, h);
      var i;
      for (i = 0; i < 110; i++) { ctx.globalAlpha = 0.3 + 0.7*Math.abs(Math.sin(t+i)); ctx.fillStyle = '#fff'; ctx.fillRect((i*137.5)%w, (i*97.3)%h, 1.4, 1.4); }
      ctx.globalAlpha = 1;
      /* 轨道 */
      for (i = 0; i < 8; i++) { ctx.globalAlpha = 0.45; ctx.strokeStyle = cols[i]; ctx.beginPath(); ctx.arc(cx, cy, R[i]*scale, 0, 6.283); ctx.stroke(); }
      ctx.globalAlpha = 1;
      /* 太阳光晕 */
      var sg = ctx.createRadialGradient(cx, cy, 2, cx, cy, 46);
      sg.addColorStop(0, 'rgba(255,240,180,1)'); sg.addColorStop(0.3, 'rgba(255,200,120,.9)'); sg.addColorStop(1, 'rgba(255,180,80,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cx, cy, 46, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#fff8d0'; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, 6.283); ctx.fill();
      /* 行星 */
      for (i = 0; i < 8; i++) {
        var a = t * sp[i] + i * 0.6;
        var x = cx + Math.cos(a) * R[i] * scale, y = cy + Math.sin(a) * R[i] * scale * 0.5;   // 扁椭圆显立体
        var g = ctx.createRadialGradient(x - 1, y - 1, 0.5, x, y, sz[i]);
        g.addColorStop(0, '#fff'); g.addColorStop(0.3, cols[i]); g.addColorStop(1, '#0a0a18');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, sz[i], 0, 6.283); ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    function stop() { if (skip) return; skip = true; if (raf) cancelAnimationFrame(raf); window.removeEventListener('resize', resize); done(); }
    canvas.addEventListener('pointerdown', stop);
    canvas.addEventListener('touchstart', function (e) { e.preventDefault(); stop(); }, { passive: false });
    setTimeout(stop, 3000);
  }

  window.Intro2 = { play: play };
})();
