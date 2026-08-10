/* 观星台 · 全局语音对话：说话→转文字→AI回复→语音读出 */
(function () {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var SYNTH = window.speechSynthesis;

  function init() {
    var btn = document.getElementById('voiceChatBtn');
    var panel = document.getElementById('voiceChatPanel');
    var speakBtn = document.getElementById('voiceSpeakBtn');
    var closeBtn = document.getElementById('voiceCloseBtn');
    var status = document.getElementById('voiceStatus');
    var log = document.getElementById('voiceChatLog');
    var apiInput = document.getElementById('voiceApiInput');
    var apiSave = document.getElementById('voiceApiSave');
    if (!btn || !panel) return;

    var listening = false;

    /* 后端地址设置：打开面板时回显当前配置，保存后写 localStorage 并重置 AI 探测 */
    function currentApiConfig() {
      try { return localStorage.getItem('guage.api') || ''; } catch (e) { return ''; }
    }
    if (apiInput) {
      apiInput.value = currentApiConfig();
      if (apiSave) {
        apiSave.addEventListener('click', function () {
          var v = (apiInput.value || '').trim();
          try { localStorage.setItem('guage.api', v); } catch (e) {}
          // 重置 AI 探测缓存，让下次走新后端
          try { window.AI && window.AI.resetProbe && window.AI.resetProbe(); } catch (e) {}
          status.textContent = v ? '已保存后端，可继续说话' : '已清空，使用内置';
        });
      }
    }

    function addMsg(role, text) {
      var d = document.createElement('div');
      d.className = 'voice-msg ' + role;
      d.textContent = text;
      log.appendChild(d);
      log.scrollTop = log.scrollHeight;
    }
    function speak(text) {
      if (!SYNTH) return;
      try {
        SYNTH.cancel();
        var u = new SpeechSynthesisUtterance(text);
        u.lang = 'zh-CN';
        u.rate = 1;
        SYNTH.speak(u);
      } catch (e) {}
    }

    btn.addEventListener('click', function () {
      panel.classList.toggle('hidden');
    });
    closeBtn.addEventListener('click', function () {
      panel.classList.add('hidden');
      if (listening) { try { SR && new SR().stop(); } catch (e) {} }
    });

    speakBtn.addEventListener('click', function () {
      if (!SR) { status.textContent = '此浏览器不支持语音识别'; return; }
      if (listening) { try { rec.stop(); } catch (e) {} return; }
      var rec = new SR();
      rec.lang = 'zh-CN';
      rec.interimResults = false;
      listening = true;
      status.textContent = '正在聆听…';
      speakBtn.textContent = '停止';

      rec.onresult = function (ev) {
        var text = ev.results[0][0].transcript;
        status.textContent = '已识别，正在向AI提问…';
        addMsg('you', text);
        askAI(text);
        listening = false;
        speakBtn.textContent = '开始说话';
      };
      rec.onerror = function () {
        status.textContent = '识别出错，再试一次';
        listening = false;
        speakBtn.textContent = '开始说话';
      };
      rec.onend = function () {
        listening = false;
        speakBtn.textContent = '开始说话';
      };
      try { rec.start(); } catch (e) { status.textContent = '启动失败'; listening = false; }
    });

    function apiCandidates() {
      try {
        var p = new URLSearchParams(location.search);
        if (p.get('api')) return p.get('api').split(',').map(function (s) { return s.trim().replace(/\/$/, ''); }).filter(Boolean);
        var saved = localStorage.getItem('guage.api');
        if (saved) return saved.split(',').map(function (s) { return s.trim().replace(/\/$/, ''); }).filter(Boolean);
      } catch (e) {}
      return [''];
    }
    function askAI(text) {
      var cands = apiCandidates();
      // 逐个候选后端尝试，第一个成功就用它（多后端自动切换）
      function tryNext(i) {
        if (i >= cands.length) {
          addMsg('ai', '（未连接AI，可本地聊聊）');
          status.textContent = 'AI未配置，显示内置';
          return;
        }
        fetch(cands[i] + '/api/voice-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: text })
        }).then(function (r) { return r.json(); }).then(function (j) {
          if (j && j.ok && j.text) {
            addMsg('ai', j.text);
            speak(j.text);
            status.textContent = '回复完成，可继续说话';
          } else {
            tryNext(i + 1); // 这个不通，试下一个
          }
        }).catch(function () {
          tryNext(i + 1);
        });
      }
      tryNext(0);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
