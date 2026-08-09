/* ============================================================
   卦阁 v9 · 高级感星球开屏 —— window.IntroPlanetPro
   参考用户参考图：带环行星 + 程序化条纹纹理 + 大气光晕 + 深空星空
   WebGL 高质量着色器，任何支持 WebGL 的设备正常显示
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

  /* 行星表面：程序化条纹（木星/土星风格）+ 光照 + 大气光晕 */
  var FRAG_PLANET = [
    'precision mediump float;',
    'varying vec3 vPos;',
    'varying vec3 vNormal;',
    'uniform vec3 uLight;',
    'uniform float uTime;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }',
    'float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y); }',
    'float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.1+vec2(1.7,3.1); a*=0.5; } return v; }',
    'void main(){',
    '  vec3 n = normalize(vNormal);',
    '  vec3 d = normalize(vPos);',
    '  float lat = asin(clamp(d.y, -1.0, 1.0));',
    '  float lon = atan(d.z, d.x);',
    '',
    '  /* 木星/土星风格条纹：纬线 + 扰动 */',
    '  float band = fbm(vec2(lon*3.0 + uTime*0.02, lat*7.0));',
    '  float stripe = 0.5 + 0.5 * sin(lat*10.0 + band*3.5 + fbm(vec2(lon*6.0, lat*9.0))*2.5);',
    '  float zone = smoothstep(0.2, 0.8, stripe);',
    '',
    '  /* 颜色：暖金 + 棕 + 白带 */',
    '  vec3 c1 = vec3(0.78, 0.60, 0.38);',   // 棕金
    '  vec3 c2 = vec3(0.92, 0.80, 0.60);',   // 浅金
    '  vec3 c3 = vec3(1.0, 0.95, 0.85);',    // 白带
    '  vec3 col = mix(c1, c2, zone);',
    '  float white = smoothstep(0.75, 0.85, stripe);',
    '  col = mix(col, c3, white * 0.8);',
    '  /* 微斑块 */',
    '  col *= (0.92 + 0.08 * fbm(vec2(lon*8.0, lat*10.0)));',
    '',
    '  /* 光照：环境 + 漫反射 */',
    '  float diff = max(dot(n, uLight), 0.0);',
    '  col *= (0.12 + 0.88 * diff);',
    '  vec3 hv = normalize(uLight + vec3(0.0,0.0,1.0));',
    '  col += vec3(1.0, 0.95, 0.85) * pow(max(dot(n,hv),0.0), 32.0) * diff * 0.3;',
    '',
    '  /* 大气光晕（边缘暖光） */',
    '  float fres = pow(1.0 - max(dot(n, vec3(0.0,0.0,1.0)), 0.0), 2.5);',
    '  col += vec3(0.9, 0.7, 0.5) * fres * 0.5;',
    '',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* 行星环 */
  var FRAG_RING = [
    'precision mediump float;',
    'varying vec3 vPos;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }',
    'float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y); }',
    'void main(){',
    '  float r = length(vPos.xz);',
    '  float band = 0.4 + 0.6 * noise(vec2(r*40.0, 3.0));',
    '  float cassini = 1.0 - smoothstep(0.02, 0.06, abs(r - 1.08));',
    '  vec3 col = vec3(0.9, 0.75, 0.5) * band * (1.0 - cassini * 0.9);',
    '  gl_FragColor = vec4(col, 0.95);',
    '}'
  ].join('\n');

  /* 深空背景：星空 + 星云 */
  var VERT_SKY = [
    'attribute vec2 aPos;',
    'varying vec2 vUv;',
    'void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }'
  ].join('\n');
  var FRAG_SKY = [
    'precision mediump float;',
    'varying vec2 vUv;',
    'uniform float uTime;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }',
    'void main(){',
    '  vec2 p = vUv;',
    '  /* 星云渐变 */',
    '  float neb1 = sin(p.x*4.0 + p.y*2.8 + uTime*0.02)*0.5+0.5;',
    '  float neb2 = sin(p.y*5.0 - p.x*3.2 + uTime*0.015+2.0)*0.5+0.5;',
    '  vec3 col = vec3(0.04,0.03,0.12);',
    '  col += vec3(0.18,0.11,0.36)*neb1;',
    '  col += vec3(0.10,0.15,0.32)*neb2;',
    '  col += vec3(0.14,0.10,0.05)*neb1*neb2;',
    '  /* 星星 */',
    '  vec2 g1 = p*50.0; vec2 id1=floor(g1); vec2 f1=fract(g1)-0.5;',
    '  float h1 = hash(id1); float tw1 = 0.5+0.5*sin(uTime*(1.0+h1*5.0)+h1*40.0);',
    '  col += vec3(1.0)*smoothstep(0.22+h1*0.2,0.0,length(f1))*step(0.99,h1)*tw1*0.9;',
    '  vec2 g2 = p*100.0; vec2 id2=floor(g2); vec2 f2=fract(g2)-0.5;',
    '  float h2 = hash(id2); float tw2 = 0.5+0.5*sin(uTime*(1.0+h2*4.0)+h2*33.0);',
    '  col += vec3(1.0)*smoothstep(0.18+h2*0.2,0.0,length(f2))*step(0.995,h2)*tw2;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function createShader(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { console.warn('shader', gl.getShaderInfoLog(sh)); return null; }
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
    var pos=[], uv=[], idx=[];
    for (var i=0;i<=lat;i++) {
      var v=i/lat, phi=v*Math.PI, y=Math.cos(phi), r=Math.sin(phi);
      for (var j=0;j<=lon;j++) {
        var u=j/lon, th=u*Math.PI*2;
        pos.push(r*Math.cos(th), y, r*Math.sin(th)); uv.push(u, v);
      }
    }
    for (var i=0;i<lat;i++) for (var j=0;j<lon;j++) {
      var a=i*(lon+1)+j, b=a+lon+1;
      idx.push(a,b,a+1, b,b+1,a+1);
    }
    return { pos:new Float32Array(pos), uv:new Float32Array(uv), idx:new Uint16Array(idx) };
  }
  function buildRing(inner, outer, seg) {
    var pos=[], uv=[], idx=[];
    for (var i=0;i<=seg;i++) {
      var u=i/seg, th=u*Math.PI*2, c=Math.cos(th), s=Math.sin(th);
      pos.push(c*inner,0,s*inner); uv.push(u,0);
      pos.push(c*outer,0,s*outer); uv.push(u,1);
    }
    for (var i=0;i<seg;i++) { var a=i*2; idx.push(a,a+1,a+2, a+1,a+3,a+2); }
    return { pos:new Float32Array(pos), uv:new Float32Array(uv), idx:new Uint16Array(idx) };
  }
  function mat4Perspective(fovy, aspect, near, far) {
    var f=1/Math.tan(fovy/2), nf=1/(near-far);
    return [f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0];
  }
  function lookAt(eye, center, up) {
    var zx=eye[0]-center[0],zy=eye[1]-center[1],zz=eye[2]-center[2];
    var zl=Math.sqrt(zx*zx+zy*zy+zz*zz)||1; zx/=zl; zy/=zl; zz/=zl;
    var xx=up[1]*zz-up[2]*zy, xy=up[2]*zx-up[0]*zz, xz=up[0]*zy-up[1]*zx;
    var xl=Math.sqrt(xx*xx+xy*xy+xz*xz)||1; xx/=xl; xy/=xl; xz/=xl;
    var yx=zy*xz-zz*xy, yy=zz*xx-zx*xz, yz=zx*xy-zy*xx;
    return [xx,yx,zx,0, xy,yy,zy,0, xz,yz,zz,0,
      -(xx*eye[0]+xy*eye[1]+xz*eye[2]), -(yx*eye[0]+yy*eye[1]+yz*eye[2]), -(zx*eye[0]+zy*eye[1]+zz*eye[2]), 1];
  }
  function mul(a,b) {
    var o=new Array(16);
    for (var c=0;c<4;c++) for (var r=0;r<4;r++) o[c*4+r]=a[0*4+r]*b[c*4+0]+a[1*4+r]*b[c*4+1]+a[2*4+r]*b[c*4+2]+a[3*4+r]*b[c*4+3];
    return o;
  }
  function trs(tx,ty,tz,ang,tilt,s) {
    var cy=Math.cos(ang),sy=Math.sin(ang),cz=Math.cos(tilt),sz=Math.sin(tilt);
    var m00=cy*cz,m01=-sy,m02=cy*sz;
    var m10=sy*cz,m11=cy,m12=sy*sz;
    var m20=-sz,m21=0,m22=cz;
    return [m00*s,m10*s,m20*s,0, m01*s,m11*s,m21*s,0, m02*s,m12*s,m22*s,0, tx,ty,tz,1];
  }

  function play(canvas, overlay, onDone) {
    var gl = null;
    try {
      gl = canvas.getContext('webgl', { antialias:false, alpha:true, preserveDrawingBuffer:true })
        || canvas.getContext('experimental-webgl', { antialias:false, alpha:true });
    } catch (e) { gl = null; }
    var finished = false;
    var finish = function () { if (!finished) { finished = true; if (onDone) onDone(); } };
    if (!gl) { finish(); return; }

    var planetProg = createProgram(gl, VERT, FRAG_PLANET);
    var ringProg = createProgram(gl, VERT, FRAG_RING);
    var skyProg = createProgram(gl, VERT_SKY, FRAG_SKY);
    if (!planetProg || !ringProg || !skyProg) { finish(); return; }

    var sphere = buildSphere(64, 128);
    var ring = buildRing(0.85, 1.35, 64);

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
    var skyBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
    var sk = gl.getAttribLocation(skyProg, 'aPos');
    gl.enableVertexAttribArray(sk);
    gl.vertexAttribPointer(sk, 2, gl.FLOAT, false, 0, 0);

    gl.clearColor(0, 0, 0, 1);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    var light = [0.5, 0.5, 0.62]; var ll = Math.sqrt(light[0]*light[0]+light[1]*light[1]+light[2]*light[2]); light=[light[0]/ll, light[1]/ll, light[2]/ll];
    var raf = null, start = performance.now(), skip = false;

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      var rect = canvas.getBoundingClientRect();
      var w = rect.width || canvas.clientWidth || window.innerWidth;
      var h = rect.height || canvas.clientHeight || window.innerHeight;
      var pw = Math.max(1, Math.round(w*dpr)), ph = Math.max(1, Math.round(h*dpr));
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

      /* 星空 */
      gl.useProgram(skyProg);
      gl.disable(gl.DEPTH_TEST);
      gl.uniform1f(gl.getUniformLocation(skyProg, 'uTime'), t);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.enable(gl.DEPTH_TEST);

      /* 相机 */
      var proj = mat4Perspective(45 * Math.PI/180, w/h, 0.1, 20);
      var view = lookAt([0, 0.3, 4.2], [0, 0, 0], [0, 1, 0]);
      var vp = mul(proj, view);

      /* 行星：缓慢自转 + 倾斜 */
      var spin = t * 0.1;
      var model = trs(0, 0, 0, spin, 0.35, 1.1);
      gl.useProgram(planetProg);
      var pn = bindGeom(planetProg, sphere);
      gl.uniformMatrix4fv(gl.getUniformLocation(planetProg, 'uModel'), false, model);
      gl.uniformMatrix4fv(gl.getUniformLocation(planetProg, 'uVP'), false, vp);
      gl.uniform3f(gl.getUniformLocation(planetProg, 'uLight'), light[0], light[1], light[2]);
      gl.uniform1f(gl.getUniformLocation(planetProg, 'uTime'), t);
      gl.drawElements(gl.TRIANGLES, pn, gl.UNSIGNED_SHORT, 0);

      /* 环 */
      var ringModel = trs(0, 0, 0, 0, 0.5, 1.15);
      gl.useProgram(ringProg);
      var rn = bindGeom(ringProg, ring);
      gl.uniformMatrix4fv(gl.getUniformLocation(ringProg, 'uModel'), false, ringModel);
      gl.uniformMatrix4fv(gl.getUniformLocation(ringProg, 'uVP'), false, vp);
      gl.drawElements(gl.TRIANGLES, rn, gl.UNSIGNED_SHORT, 0);

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
    setTimeout(stop, 6000);
  }

  window.IntroPlanetPro = { play: play };
})();
