// 첫 화면: 참가 코드만 넣고 바로 행사로 (QR이 안 되는 기기용) — 옛 브라우저도 되도록 단순한 문법만 사용
(function () {
  var f = document.getElementById('f'), inp = document.getElementById('code'), msg = document.getElementById('msg'), btn = document.getElementById('go');
  function clean(v) { v = String(v || '').toUpperCase(); var m = v.match(/[?&]E=([A-Z0-9]+)/) || v.match(/\/J\/([A-Z0-9]+)/); if (m) v = m[1]; return v.replace(/[^A-Z0-9]/g, ''); }
  f.onsubmit = function () {
    var c = clean(inp.value); msg.textContent = '';
    if (c.length < 4) { msg.textContent = '참가 코드 6자리를 넣어 주세요'; inp.focus(); return false; }
    btn.disabled = true; btn.textContent = '확인 중…';
    var x = new XMLHttpRequest(); x.open('GET', '/api/public/' + encodeURIComponent(c)); x.timeout = 10000;
    x.onload = function () {
      btn.disabled = false; btn.textContent = '📱 입장하기';
      var r = null; try { r = JSON.parse(x.responseText); } catch (e) {}
      if (x.status === 200 && r) { if (r.phase === 'ended') { msg.textContent = '이미 끝난 행사예요 (' + r.name + ')'; return; } location.href = '/play.html?e=' + encodeURIComponent(c); }
      else if (x.status === 404) msg.textContent = '없는 참가 코드예요. 큰 화면의 코드를 다시 확인해 주세요' + (/[01OI]/.test(String(inp.value).toUpperCase()) ? ' (코드에는 숫자 0·1, 영어 O·I가 없어요)' : '');
      else msg.textContent = '잠시 후 다시 눌러 주세요';
    };
    x.onerror = x.ontimeout = function () { btn.disabled = false; btn.textContent = '📱 입장하기'; msg.textContent = '인터넷 연결을 확인해 주세요'; };
    x.send(); return false;
  };
})();
