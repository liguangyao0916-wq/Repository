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
    if (!btn || !panel) return;

    var listening = false;

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

    function apiBase() {
      try {
        var p = new URLSearchParams(location.search);
        if (p.get('api')) return p.get('api').replace(/\/$/, '');
        var saved = localStorage.getItem('guage.api');
        if (saved) return saved.replace(/\/$/, '');
      } catch (e) {}
      return '';
    }
    function askAI(text) {
      var path = apiBase() + '/api/voice-chat';
      fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text })
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok && j.text) {
          addMsg('ai', j.text);
          speak(j.text);
          status.textContent = '回复完成，可继续说话';
        } else {
          addMsg('ai', '（未连接AI，可本地聊聊）' + (j && j.error ? '：' + j.error : ''));
          status.textContent = 'AI未配置，显示内置';
        }
      }).catch(function () {
        addMsg('ai', '（AI连接失败）');
        status.textContent = '连接失败';
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
