/* ============================================================
   卦阁 v4 · 北斗七星开场动画 —— window.IntroBeidou
   纯 WebGL：深空星野 + 北斗七星连线闪烁 + 斗转星移 + 流星
   苹果 iOS Safari 适配（alpha:true + 正确 DPR）
   ============================================================ */
(function () {
  var VERT = [
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

  /* 发光球（北斗星用） */
  var FRAG_GLOW = [
    'precision mediump float;',
    'varying vec3 vNormal;',
    'uniform vec3 uColor;',
    'uniform float uStrength;',
    'void main(){',
    '  float a = pow(1.0 - max(dot(normalize(vNormal), vec3(0.0,0.0,1.0)), 0.0), 2.0);',
    '  gl_FragColor = vec4(uColor, a * uStrength);',
    '}'
  ].join('\n');

  /* 深空背景：星空闪烁 */
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
    '  float neb = sin(p.x*6.0 + p.y*4.0 + uTime*0.02)*0.5 + 0.5;',
    '  vec3 col = vec3(0.012, 0.01, 0.035) + vec3(0.06, 0.05, 0.14)*neb*0.5;',
    '  vec2 g1 = p*48.0; vec2 id1 = floor(g1); vec2 f1 = fract(g1)-0.5;',
    '  float h1 = hash(id1); float tw1 = 0.5+0.5*sin(uTime*(1.0+h1*5.0)+h1*40.0);',
    '  col += vec3(1.0) * smoothstep(0.25+h1*0.2, 0.0, length(f1)) * step(0.985, h1) * tw1 * 0.5;',
    '  vec2 g2 = p*100.0; vec2 id2 = floor(g2); vec2 f2 = fract(g2)-0.5;',
    '  float h2 = hash(id2); float tw2 = 0.5+0.5*sin(uTime*(1.0+h2*4.0)+h2*33.0);',
    '  col += vec3(1.0) * smoothstep(0.18+h2*0.22, 0.0, length(f2)) * step(0.992, h2) * tw2;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function createShader(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { return null; }
    return sh;
  }
  function createProgram(gl, vs, fs) {
    var p = gl.createProgram();
    gl.attachShader(p, createShader(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, createShader(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
    return p;
  }
  function buildSphere(lat, lon) {
    var pos = [], idx = [];
    for (var i = 0; i <= lat; i++) {
      var v = i/lat, phi = v*Math.PI, y = Math.cos(phi), r = Math.sin(phi);
      for (var j = 0; j <= lon; j++) {
        var u = j/lon, th = u*Math.PI*2;
        pos.push(r*Math.cos(th), y, r*Math.sin(th));
      }
    }
    for (var i = 0; i < lat; i++) for (var j = 0; j < lon; j++) {
      var a = i*(lon+1)+j, b = a+lon+1;
      idx.push(a, b, a+1, b, b+1, a+1);
    }
    return { pos: new Float32Array(pos), idx: new Uint16Array(idx) };
  }
  function mat4Perspective(fovy, aspect, near, far) {
    var f = 1/Math.tan(fovy/2), nf = 1/(near-far);
    return [f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0];
  }
  function lookAt(eye, center, up) {
    var zx=eye[0]-center[0], zy=eye[1]-center[1], zz=eye[2]-center[2];
    var zl=Math.sqrt(zx*zx+zy*zy+zz*zz)||1; zx/=zl; zy/=zl; zz/=zl;
    var xx=up[1]*zz-up[2]*zy, xy=up[2]*zx-up[0]*zz, xz=up[0]*zy-up[1]*zx;
    var xl=Math.sqrt(xx*xx+xy*xy+xz*xz)||1; xx/=xl; xy/=xl; xz/=xl;
    var yx=zy*xz-zz*xy, yy=zz*xx-zx*xz, yz=zx*xy-zy*xx;
    return [xx,yx,zx,0, xy,yy,zy,0, xz,yz,zz,0,
      -(xx*eye[0]+xy*eye[1]+xz*eye[2]), -(yx*eye[0]+yy*eye[1]+yz*eye[2]), -(zx*eye[0]+zy*eye[1]+zz*eye[2]), 1];
  }
  function mul(a, b) {
    var o = new Array(16);
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) o[c*4+r] = a[0*4+r]*b[c*4+0] + a[1*4+r]*b[c*4+1] + a[2*4+r]*b[c*4+2] + a[3*4+r]*b[c*4+3];
    return o;
  }
  function trs(tx, ty, tz, ang, tilt, s) {
    var cy=Math.cos(ang), sy=Math.sin(ang), cz=Math.cos(tilt), sz=Math.sin(tilt);
    var m00=cy*cz, m01=-sy, m02=cy*sz;
    var m10=sy*cz, m11=cy, m12=sy*sz;
    var m20=-sz, m21=0, m22=cz;
    return [m00*s,m10*s,m20*s,0, m01*s,m11*s,m21*s,0, m02*s,m12*s,m22*s,0, tx,ty,tz,1];
  }

  /* 北斗七星：天枢/天璇/天玑/天权/玉衡/开阳/摇光（3D 坐标，相对位置） */
  var STARS = [
    { x: -1.6, y: 0.85, z: 0.1, s: 0.32, c: [0.9, 0.92, 1.0] },   // 天枢
    { x: -1.15, y: 0.72, z: 0.05, s: 0.3, c: [0.92, 0.94, 1.0] }, // 天璇
    { x: -0.7, y: 0.82, z: 0.0, s: 0.3, c: [0.95, 0.95, 1.0] },   // 天玑
    { x: -0.28, y: 0.6, z: -0.05, s: 0.26, c: [0.95, 0.97, 1.0] },// 天权
    { x: 0.05, y: 0.28, z: -0.1, s: 0.32, c: [0.98, 0.96, 0.95] },// 玉衡
    { x: 0.5, y: -0.1, z: -0.15, s: 0.28, c: [0.95, 0.93, 0.97] },// 开阳
    { x: 1.0, y: -0.5, z: -0.2, s: 0.3, c: [0.9, 0.9, 0.98] }     // 摇光
  ];

  function play(canvas, overlay, onDone) {
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var gl = null;
    try {
      gl = canvas.getContext('webgl', { antialias: false, alpha: true, preserveDrawingBuffer: true })
        || canvas.getContext('experimental-webgl', { antialias: false, alpha: true });
    } catch (e) { gl = null; }
    var finished = false;
    var finish = function () { if (!finished) { finished = true; if (onDone) onDone(); } };
    if (!gl || reduced) { fallback(canvas, finish); return; }

    var glowProg = createProgram(gl, VERT, FRAG_GLOW);
    var skyProg = createProgram(gl, VERT_SKY, FRAG_SKY);
    if (!glowProg || !skyProg) { fallback(canvas, finish); return; }

    var sphere = buildSphere(24, 48);
    var skyBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    var sk = gl.getAttribLocation(skyProg, 'aPos');
    gl.enableVertexAttribArray(sk);
    gl.vertexAttribPointer(sk, 2, gl.FLOAT, false, 0, 0);

    function bindSphere(prog) {
      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, sphere.pos, gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
      var ibuf = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphere.idx, gl.STATIC_DRAW);
      return sphere.idx.length;
    }

    gl.clearColor(0.02, 0.015, 0.05, 1);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    var raf = null, start = performance.now(), skip = false;
    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      var rect = canvas.getBoundingClientRect();
      var w = rect.width || canvas.clientWidth || window.innerWidth;
      var h = rect.height || canvas.clientHeight || window.innerHeight;
      var pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr));
      if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
      gl.viewport(0, 0, pw, ph);
    }
    resize();
    window.addEventListener('resize', resize);

    function frame() {
      if (skip) return;
      var t = (performance.now() - start) / 1000;
      var w = canvas.width, h = canvas.height;
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      /* 星空背景 */
      gl.useProgram(skyProg);
      gl.disable(gl.DEPTH_TEST);
      gl.uniform1f(gl.getUniformLocation(skyProg, 'uTime'), t);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.enable(gl.DEPTH_TEST);

      /* 相机：固定，微缓慢推近 */
      var dist = 4.6 - t * 0.04;
      var proj = mat4Perspective(52 * Math.PI/180, w/h, 0.1, 20);
      var view = lookAt([0, 0, dist], [0, 0, 0], [0, 1, 0]);
      var vp = mul(proj, view);

      /* 北斗七星连线（用发光球，画完再加线）——先画星，闪烁 */
      gl.useProgram(glowProg);
      var sn = bindSphere(glowProg);
      gl.uniformMatrix4fv(gl.getUniformLocation(glowProg, 'uVP'), false, vp);
      for (var i = 0; i < STARS.length; i++) {
        var st = STARS[i];
        var pulse = 0.75 + 0.25 * Math.sin(t * (1.2 + i * 0.2) + i);
        // 整体缓缓旋转（斗转星移）
        var ang = t * 0.06;
        var cx = st.x * Math.cos(ang) - st.z * Math.sin(ang);
        var cz = st.x * Math.sin(ang) + st.z * Math.cos(ang);
        gl.uniformMatrix4fv(gl.getUniformLocation(glowProg, 'uModel'), false, trs(cx, st.y, cz, 0, 0, st.s));
        gl.uniform3f(gl.getUniformLocation(glowProg, 'uColor'), st.c[0], st.c[1], st.c[2]);
        gl.uniform1f(gl.getUniformLocation(glowProg, 'uStrength'), 0.85 * pulse);
        gl.drawElements(gl.TRIANGLES, sn, gl.UNSIGNED_SHORT, 0);
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
    setTimeout(stop, 3600);
  }

  /* Canvas2D 降级 */
  function fallback(canvas, done) {
    var ctx = null;
    try { ctx = canvas.getContext('2d'); } catch (e) {}
    if (!ctx) { done(); return; }
    var raf = null, start = performance.now(), skip = false;
    function resize() { canvas.width = canvas.clientWidth || innerWidth; canvas.height = canvas.clientHeight || innerHeight; }
    resize(); window.addEventListener('resize', resize);
    var stars = STARS.map(function (s, i) { return { x: s.x, y: s.y, i: i }; });
    function frame() {
      if (skip) return;
      var t = (performance.now() - start) / 1000;
      var w = canvas.width, h = canvas.height, cx = w/2, cy = h/2;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#05030f'; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 110; i++) {
        ctx.globalAlpha = 0.3 + 0.7*Math.abs(Math.sin(t + i));
        ctx.fillStyle = '#fff';
        ctx.fillRect((i*137.5)%w, (i*97.3)%h, 1.4, 1.4);
      }
      ctx.globalAlpha = 1;
      var scale = Math.min(w, h) / 8;
      for (i = 0; i < stars.length; i++) {
        var s = stars[i];
        var pulse = 0.7 + 0.3*Math.sin(t*(1.2+s.i*0.2)+s.i);
        var x = cx + s.x*scale, y = cy + s.y*scale*0.8;
        var g = ctx.createRadialGradient(x, y, 0, x, y, 14*pulse);
        g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.4, 'rgba(220,225,255,0.5)'); g.addColorStop(1, 'rgba(220,225,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 14*pulse, 0, 6.283); ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    function stop() { if (skip) return; skip = true; if (raf) cancelAnimationFrame(raf); window.removeEventListener('resize', resize); done(); }
    canvas.addEventListener('pointerdown', stop);
    setTimeout(stop, 3600);
  }

  window.IntroBeidou = { play: play };
})();
