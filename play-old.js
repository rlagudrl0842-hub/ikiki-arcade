// 아주 오래된 브라우저는 게임 화면을 그리지 못함 → 빈 화면 대신 안내 (5초 안에 화면이 안 뜨면)
setTimeout(function () { if (window.__appOk) return; var a = document.getElementById('app'); if (!a || a.children.length) return;
  a.innerHTML = '<div style="padding:28px;text-align:center;font-size:18px;line-height:1.6;color:#fff"><b style="font-size:22px">이 기기의 인터넷 앱이 오래됐어요</b><br>크롬·사파리·삼성 인터넷을 최신으로 업데이트하거나, 다른 기기로 들어와 주세요.<br><br><a href="/play.html" style="color:#ffd43b">다시 시도</a></div>'; }, 5000);
