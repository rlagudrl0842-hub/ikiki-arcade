# 실제 크롬으로 진행자·대형 화면·참가자 폰 3대를 띄워 20종 게임을 화면까지 돌려 보는 E2E 테스트
# 사용: 서버 실행 후  python3 test/e2e_browser.py http://localhost:8099 test1234 [출력폴더] [게임목록]
import sys, os, json, time, urllib.request
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8099'
PW = sys.argv[2] if len(sys.argv) > 2 else 'test1234'
OUT = sys.argv[3] if len(sys.argv) > 3 else 'shots'
ONLY = sys.argv[4].split(',') if len(sys.argv) > 4 else None
MODE = os.environ.get('MODE', 'elem')
os.makedirs(OUT, exist_ok=True)
errors = []

def api(path, body=None, token=None):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body is not None else None, headers={'Content-Type': 'application/json', **({'Authorization': 'Bearer ' + token} if token else {})}, method='POST' if body is not None else 'GET')
    with urllib.request.urlopen(req) as r: return json.loads(r.read())

def watch(page, name):
    page.on('pageerror', lambda e: errors.append(f'[{name}] pageerror: {e}'))
    page.on('console', lambda m: errors.append(f'[{name}] console.{m.type}: {m.text}') if m.type == 'error' else None)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--autoplay-policy=no-user-gesture-required'])
    # 진행자
    admin = b.new_context(viewport={'width': 1280, 'height': 900}).new_page(); watch(admin, 'admin')
    admin.goto(BASE + '/admin.html')
    admin.fill('input[type=password]', PW); admin.press('input[type=password]', 'Enter')
    admin.wait_for_selector('text=새 행사')
    admin.fill('input[placeholder^="행사 이름"]', 'E2E 테스트 운동회')
    admin.select_option('.newev select >> nth=0', MODE)
    admin.select_option('.newev select >> nth=1', '3')
    admin.click('.newev .chk')  # 자동 진행 끄기 (수동으로 확인)
    admin.click('text=＋ 행사 만들기')
    admin.wait_for_selector('.ctrl')
    admin.screenshot(path=f'{OUT}/01_admin_console.png')
    token = admin.evaluate("JSON.parse(localStorage.getItem('ikiki:admin'))")
    eid = admin.evaluate("location.hash.split('=')[1]")
    ev = api(f'/api/events/{eid}', token=token)
    code = ev['event']['code']
    api(f'/api/events/{eid}/update', {'settings': {'joinUrl': BASE}}, token)
    # 대형 화면
    sc = b.new_context(viewport={'width': 1920, 'height': 1080}).new_page(); watch(sc, 'screen')
    sc.goto(f'{BASE}/screen.html?e={code}'); sc.click('#gate'); sc.wait_for_selector('.lobbyv')
    # 참가자 폰 3대 (아이폰 / 갤럭시 / 작은 폰)
    devs = [p.devices['iPhone 13'], p.devices['Galaxy S9+'], {**p.devices['iPhone SE'], 'viewport': {'width': 320, 'height': 568}}]
    phones = []
    for i, d in enumerate(devs):
        pg = b.new_context(**d).new_page(); watch(pg, f'phone{i}')
        pg.goto(f'{BASE}/play.html?e={code}')
        pg.wait_for_selector('.tp')
        pg.fill('input.inp', ['민준', '서연', '하준'][i])
        if MODE == 'mixed': pg.click('.ap >> nth=%d' % (i % 3))
        pg.click(f'.tp >> nth={i % 3}')
        pg.click('button:has-text("참가하기")')
        pg.wait_for_selector('.lobby')
        phones.append(pg)
    phones[0].screenshot(path=f'{OUT}/02_phone_lobby.png')
    time.sleep(0.8)
    sc.screenshot(path=f'{OUT}/03_screen_lobby.png')
    # 새로고침해도 참가 유지
    phones[1].reload(); phones[1].wait_for_selector('.lobby')

    games = api('/api/games')['games']
    pl = [{'game': g['id'], 'weight': 2 if g['id'] == 'throne' else 1} for g in games if not ONLY or g['id'] in ONLY]
    api(f'/api/events/{eid}/update', {'settings': {'playlist': pl}}, token)
    def cmd(op, arg=None):
        st = api(f'/api/events/{eid}', token=token)
        return api(f'/api/events/{eid}/command', {'op': op, 'arg': arg or {}, 'seq': st['seq']}, token)
    def act(pg, gid):
        # 화면의 주요 버튼을 실제로 눌러 봄
        sel = {'mash': '.tapbig', 'tug': '.tapbig', 'race': '.foot', 'bomb': '.passbtn', 'nunchi': '.pk', 'tensec': '.btn.huge', 'survivor': '.door', 'vault': '.key', 'mole': '.hole', 'reaction': '.react', 'rps': '.rpsb', 'numhunt': '.num:not(.empty)', 'memory': '.mem', 'colortrap': '.ct', 'ox': '.oxb', 'tower': '.towercv', 'fatebox': '.box', 'bingo': '.bc.s0', 'roulette': '.btn.huge', 'throne': '.tapbig, .react, .mem, .hole, .ct'}.get(gid)
        try:
            for _ in range(6):
                loc = pg.locator(sel).first
                if loc.count(): loc.click(timeout=600, force=True)
                time.sleep(0.12)
        except Exception: pass
    for i, g in enumerate(pl):
        gid = g['game']
        cmd('intro', {'idx': i}); time.sleep(0.8)
        if i < 3: sc.screenshot(path=f'{OUT}/g{i+1:02d}_{gid}_0intro_screen.png')
        cmd('start'); time.sleep(4.2)
        for pg in phones: act(pg, gid)
        time.sleep(0.6)
        phones[i % 3].screenshot(path=f'{OUT}/g{i+1:02d}_{gid}_1phone.png')
        sc.screenshot(path=f'{OUT}/g{i+1:02d}_{gid}_2screen.png')
        st = api(f'/api/events/{eid}', token=token)
        if st['phase'] == 'playing': cmd('endNow')
        else:
            for _ in range(60):
                if api(f'/api/events/{eid}', token=token)['phase'] == 'results': break
                time.sleep(0.5)
        time.sleep(1.2)
        if i < 2 or gid in ('roulette', 'throne'): sc.screenshot(path=f'{OUT}/g{i+1:02d}_{gid}_3results.png'); phones[0].screenshot(path=f'{OUT}/g{i+1:02d}_{gid}_4phone_result.png')
        cmd('next'); time.sleep(0.3)
    cmd('ceremony'); time.sleep(1)
    for k in range(5):
        cmd('ceremonyNext'); time.sleep(1.2)
        if k in (2, 3): sc.screenshot(path=f'{OUT}/c{k}_ceremony.png')
    phones[0].screenshot(path=f'{OUT}/c_phone_end.png'); sc.screenshot(path=f'{OUT}/c_screen_end.png')
    admin.click('text=🏆 점수'); time.sleep(0.6); admin.screenshot(path=f'{OUT}/05_admin_score.png')
    # 화면이 가로로 넘치는지 확인 (모바일 잘림 검사)
    for i, pg in enumerate(phones):
        ov = pg.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
        if ov: errors.append(f'[phone{i}] 가로 스크롤 발생 (화면 잘림)')
    b.close()

print(json.dumps({'errors': errors[:50], 'count': len(errors)}, ensure_ascii=False, indent=1))
