// 오래된 문법(ES5)으로만 씀 — 최신 화면 코드가 못 뜨는 기기에서도 이 파일은 실행됨
// 1) 기기 오류를 서버 기록으로 보냄 (오류 글·게임·기기 종류·화면 크기만, 비밀값 없음) → 태블릿 빈 화면 원인 확인용
// 2) 5초 안에 화면이 안 뜨면 빈 화면 대신 안내 + 다시 시도
(function () {
  var sent = 0, lastMsg = '';
  window.__clog = function (where, game, e) {
    try {
      var msg = String((e && (e.message || e.reason)) || e || '').slice(0, 300);
      if (sent >= 8 || msg === lastMsg) return; sent++; lastMsg = msg; window.__lastErr = msg;
      var x = new XMLHttpRequest(); x.open('POST', '/api/clog', true); x.setRequestHeader('Content-Type', 'application/json');
      x.send(JSON.stringify({ where: where, game: game || '', msg: msg + (e && e.filename ? ' @' + String(e.filename).split('/').pop() + ':' + e.lineno : ''), ua: navigator.userAgent, vp: innerWidth + 'x' + innerHeight }));
    } catch (_) { /* */ }
  };
  window.addEventListener('error', function (e) { if (e && (e.message || e.filename)) window.__clog('error', '', e); }, true);
  window.addEventListener('unhandledrejection', function (e) { window.__clog('promise', '', { message: String(e && e.reason && (e.reason.message || e.reason)) }); });
  setTimeout(function () {
    if (window.__appOk) return; var a = document.getElementById('app'); if (!a || a.children.length) return;
    window.__clog('boot', '', { message: 'app not started' + (window.__lastErr ? ': ' + window.__lastErr : '') });
    a.innerHTML = '<div style="padding:28px;text-align:center;font-size:18px;line-height:1.6;color:#fff"><b style="font-size:22px">이 기기에서 화면을 열지 못했어요</b><br>크롬·사파리·삼성 인터넷을 최신으로 업데이트하거나, 다른 기기로 들어와 주세요.<br><br><a href="' + location.pathname + location.search + '" style="color:#ffd43b;font-size:20px">🔄 다시 시도</a>' + (window.__lastErr ? '<div style="margin-top:18px;font-size:12px;opacity:.6">' + String(window.__lastErr).replace(/</g, '&lt;').slice(0, 120) + '</div>' : '') + '</div>';
  }, 5000);
})();
