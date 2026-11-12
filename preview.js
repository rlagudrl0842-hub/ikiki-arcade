import { PE_BY, mvFor } from './pe2data.js';
import { tutorial as peTutorial } from './pe2draw.js';
// 게임별 시범 미리보기: 대형 화면(설명 시간)과 참가자 폰(도움 버튼)에서 같은 애니메이션
// 손가락을 처음 대는 곳 → 움직이는 방향·누르는 시점 → 결과를 ①②③ 순서로 보여 줌. 문구는 실제 게임 코드 규칙과 맞춤
// 연령: kid(영아·유아) 그림+짧은 말 / elem(초등) 쉬운 동사 / adult(중등 이상) 간결·정확

const K = (kid, elem, adult) => ({ kid, elem, adult: adult ?? elem });
// t: 그림 종류 · steps: [①, ②, ③] (연령별) · goal: 팀 목표와 이기는 방법(한 문장) · score: 점수 기준
export const DEMO = {
  dodge: { t: 'joy', haz: 'warn', steps: K(['동그라미에 손가락', '가고 싶은 쪽으로 쭉', '노란 원 밖으로 피해요'], ['아래 조이스틱에 손가락을 대요', '가고 싶은 쪽으로 밀어요 (떼면 멈춤)', '노란 경고 원 밖으로 피하면 하트를 지켜요'], ['조이스틱을 누른 채', '민 방향·거리만큼 이동, 떼면 정지', '경고 원 안에서 번개를 맞으면 하트 −1']), goal: '끝까지 많이 살아남은 팀이 이겨요', score: '살아남은 시간 + 남은 하트 (팀 평균)' },
  zombie: { t: 'joy', haz: 'zombie', steps: K(['동그라미에 손가락', '쭉 밀어서 도망', '초록 좀비를 피해요'], ['조이스틱에 손가락을 대요', '밀어서 움직여요', '좀비에 닿으면 나도 좀비! 좀비는 사람을 잡아요'], ['조이스틱 입력', '이동', '접촉 시 감염 · 좀비는 잡은 수로 점수']), goal: '사람은 오래 살아남고, 좀비는 많이 잡을수록 팀 점수', score: '사람: 생존 시간 · 좀비: 잡은 수 (팀 평균)' },
  paint: { t: 'joy', haz: 'paint', steps: K(['동그라미에 손가락', '이리저리 움직여요', '지나간 바닥이 우리 색!'], ['조이스틱에 손가락을 대요', '돌아다니며 칠해요', '지나간 칸이 우리 팀 색 (남의 땅도 덮어써요)'], null), goal: '1인당 칠한 땅이 넓은 팀이 이겨요', score: '우리 팀 땅 넓이 ÷ 인원' },
  gems: { t: 'joy', haz: 'gem', steps: K(['동그라미에 손가락', '보석 쪽으로 쭉', '보석을 먹어요'], ['조이스틱에 손가락을 대요', '보석 쪽으로 밀어요', '보석에 닿으면 획득 (큰 보석 5점)'], null), goal: '보석 점수 평균이 높은 팀이 이겨요', score: '모은 보석 점수 (팀 평균)' },
  crown: { t: 'joy', haz: 'crown', steps: K(['동그라미에 손가락', '금색 원으로 쭉', '원 안에 있어요'], ['조이스틱에 손가락을 대요', '움직이는 황금 원 쪽으로 밀어요', '원 안에 머무는 동안 점수가 올라요'], null), goal: '황금 원 안에 오래 머문 팀이 이겨요', score: '원 안에 머문 시간 (팀 평균)' },
  mugung: { t: 'hold', label: '꾹 = 앞으로', steps: K(['큰 버튼에 손가락', '꾹 누르면 앞으로', '술래가 보면 손 떼기!'], ['큰 버튼에 손가락을 대요', '꾹 누르는 동안 앞으로 가요', '술래가 돌아보면 바로 손을 떼요 (움직이면 탈락)'], null), goal: '결승선에 빨리 도착한 사람이 많은 팀이 이겨요', score: '도착 순서·거리 (팀 평균)' },
  dalgona: { t: 'trace', steps: K(['선 위에 손가락', '천천히 따라 그려요', '선 밖은 금이 가요'], ['모양 선 위에 손가락을 대요', '선을 따라 천천히 그려요', '선 밖으로 나가면 금이 가요'], null), goal: '정확하게 많이 떼어 낸 팀이 이겨요', score: '정확도 × 완성 개수' },
  rope: { t: 'timing', label: '점프!', steps: K(['점프 버튼을 봐요', '줄이 바닥에 닿을 때 콕', '다 같이 성공!'], ['점프 버튼에 손가락을 올려요', '줄이 바닥에 닿는 순간 눌러요', '팀원 대부분이 성공해야 줄이 계속 돌아요'], null), goal: '다 같이 성공한 점프 수가 많은 팀이 이겨요', score: '팀 성공 점프 수 · 줄이 점점 빨라져요' },
  tuho: { t: 'swipeUp', obj: '🏹', tgt: '🏺', steps: K(['화살을 잡아요', '위로 휙 밀어요', '항아리에 쏙!'], ['아래 화살에 손가락을 대요', '위로 휙 밀어 던져요 (빠를수록 멀리)', '항아리에 넣으면 10점, 정중앙 15점'], null), goal: '평균 점수가 높은 팀이 이겨요', score: '넣으면 10점 · 정중앙 15점' },
  runner: { t: 'tap', label: '점프', steps: K(['화면을 봐요', '톡 = 점프', '장애물을 넘어요'], ['화면 아무 곳에 손가락', '장애물 앞에서 톡! 점프', '부딪히면 잠깐 멈춰요'], null), goal: '멀리 달린 팀이 이겨요', score: '달린 거리 (팀 평균)' },
  flappy: { t: 'tap', label: '날갯짓', rep: 4, steps: K(['화면을 봐요', '톡톡 = 날갯짓', '기둥 틈으로 통과'], ['화면에 손가락', '톡톡 누를 때마다 위로 날아요', '기둥 사이 틈을 통과해요'], null), goal: '많이 통과한 팀이 이겨요', score: '통과한 기둥 수' },
  fruit: { t: 'slash', steps: K(['과일을 봐요', '손가락으로 쓱!', '과일이 잘려요 (폭탄은 안 돼요)'], ['과일 옆에 손가락을 대요', '과일을 지나가게 쓱 그어요', '자르면 점수, 💣 폭탄은 −5'], null), goal: '과일 점수 평균이 높은 팀이 이겨요', score: '과일 점수 · 황금 +5 · 폭탄 −5' },
  stairs: { t: 'twoBtn', a: '↩ 방향 바꾸기', b: '↑ 오르기', steps: K(['두 버튼을 봐요', '같은 쪽이면 오르기', '반대쪽이면 방향 바꾸기'], ['아래 두 버튼에 손가락', '다음 계단이 같은 방향이면 "오르기"', '반대 방향이면 "방향 바꾸기" (틀리면 떨어져요)'], null), goal: '많이 오른 팀이 이겨요', score: '오른 계단 수' },
  bridge: { t: 'bridge', steps: K(['화면에 손가락', '꾹 = 막대가 쑥쑥', '떼면 다리가 놓여요'], ['화면에 손가락을 대요', '꾹 누르는 동안 막대가 길어져요', '딱 맞을 때 떼면 다음 기둥으로 건너요'], null), goal: '많이 건넌 팀이 이겨요', score: '건넌 기둥 수 (정중앙 보너스)' },
  fishing: { t: 'fish', steps: K(['찌를 봐요', '쑥 들어가면 콕!', '꾹/떼기로 감아요'], ['찌를 보고 기다려요', '찌가 쑥 들어가면 바로 탭 (챔질)', '꾹 누르면 감기·떼면 풀기 — 흰 막대를 초록 안에'], null), goal: '물고기 점수가 높은 팀이 이겨요', score: '잡은 물고기 점수 (희귀할수록 높음)' },
  curling: { t: 'curl', steps: K(['스톤을 잡아요', '위로 쓱 밀어요', '문지르면 더 멀리!'], ['아래 스톤에 손가락을 대요', '위로 밀어 던져요: 빠를수록 멀리, 옆으로 비스듬히 밀면 그쪽으로 휘어요', '스톤이 가는 동안 화면을 빠르게 문지르면(스위핑) 덜 멈춰서 더 멀리 가요'], ['스톤 위치에서 터치 시작', '위로 놓는 속도 = 거리, 가로 성분 = 좌우 방향', '이동 중 문지르기 = 마찰 감소(최대 약 60%)']), goal: '스톤 3개를 하우스 정중앙에 가깝게 — 팀 평균이 높은 팀이 이겨요', score: '스톤마다 100 − 중앙과의 거리 (3개 평균)' },
  penalty: { t: 'grid', cells: 6, cols: 3, label: '⚽', steps: K(['골대를 봐요', '차고 싶은 칸을 콕', '골인!'], ['골대 6칸을 봐요', '차고 싶은 칸을 터치해요', '골키퍼가 못 막으면 골! (위 구석은 잘 안 막지만 빗나갈 수도)'], null), goal: '골을 많이 넣은 팀이 이겨요', score: '골 수' },
  basket: { t: 'swipeUp', obj: '🏀', tgt: '🗑️', move: true, steps: K(['공을 잡아요', '위로 휙!', '골대에 쏙!'], ['아래 공에 손가락을 대요', '위로 휙 던져요 (골대가 움직여요)', '골 2점 · 클린슛 3점'], null), goal: '평균 점수가 높은 팀이 이겨요', score: '골 2점 · 클린슛 3점' },
  fire: { t: 'timing', label: '펑!', vertical: true, steps: K(['로켓을 봐요', '제일 높을 때 콕!', '큰 불꽃 펑!'], ['펑 버튼에 손가락을 올려요', '로켓이 가장 높이 올라간 순간 눌러요', '딱 맞을수록 큰 불꽃 = 높은 점수'], null), goal: '타이밍 평균이 좋은 팀이 이겨요', score: '최고점에 가까울수록 고득점' },
  rhythm: { t: 'lanes', steps: K(['세 줄을 봐요', '노트가 선에 닿을 때 그 줄을 콕', 'PERFECT!'], ['아래 판정선과 세 줄을 봐요', '노트가 선에 닿는 순간 같은 줄을 터치', '딱 맞으면 PERFECT(3점), 조금 빠르거나 늦으면 GOOD(2점), 많이 벗어나면 MISS(콤보 끊김)'], ['판정선 = 화면 아래 가로선', '노트 도달 시각에 해당 줄 터치', 'PERFECT ±35% 창 / GOOD / MISS(빠름·늦음 표시) · 연속 성공 = 콤보']), goal: '정확도 점수 평균이 높은 팀이 이겨요 (팀원 연속 성공이 대형 화면에)', score: 'PERFECT 3 · GOOD 2 · 콤보' },
  eggs: { t: 'dragH', steps: K(['바구니에 손가락', '좌우로 쓱쓱', '달걀을 받아요'], ['바구니에 손가락을 대요', '좌우로 끌어서 움직여요', '달걀을 받고 돌멩이는 피해요'], null), goal: '많이 받은 팀이 이겨요', score: '달걀 수 · 황금 +3 · 돌 −2' },
  burger: { t: 'order', steps: K(['주문을 봐요', '순서대로 콕콕', '버거 완성!'], ['위의 주문서를 봐요', '같은 순서로 재료 버튼을 눌러요', '틀리면 처음부터 · 완성하면 다음 주문'], null), goal: '버거를 많이 만든 팀이 이겨요', score: '완성한 버거 (재료가 많을수록 ↑)' },
  bell: { t: 'choice', n: 4, quiz: true, steps: K(['문제를 봐요', '정답 그림을 콕', '제출 완료!'], ['큰 화면의 문제를 읽어요', '내 폰에서 정답 보기를 눌러요 (한 번만)', '"제출 완료" → 모두 내면 정답을 함께 공개'], ['문제는 대형 화면', '보기 순서는 사람마다 다름 · 1회 제출', '공개 전까지 정답·정답률 비공개']), goal: '맞힌 문제가 많은 팀이 이겨요 (틀려도 다음 문제 맞히면 부활)', score: '맞힌 수 + 끝까지 생존 보너스' },
  tele: { t: 'choice', n: 4, steps: K(['문제를 봐요', '마음에 드는 답을 콕', '친구랑 같으면 점수!'], ['질문을 읽어요', '팀원들이 많이 고를 것 같은 답을 눌러요', '팀원과 같은 답이 많을수록 점수'], null), goal: '팀원끼리 같은 답을 많이 고른 팀이 이겨요', score: '팀과 일치한 비율' },
  mino: { t: 'choice', n: 2, steps: K(['두 그림을 봐요', '하나를 콕', '적은 쪽이 살아요'], ['둘 중 하나를 골라요', '버튼을 눌러요', '더 적은 사람이 고른 쪽만 살아남아요'], null), goal: '오래 살아남은 팀이 이겨요', score: '살아남은 라운드 수' },
  draw: { t: 'draw', steps: K(['그림을 봐요', '정답을 콕', '빨리 맞히면 점수!'], ['그리는 사람: 단어를 손가락으로 그려요', '나머지: 큰 화면 그림을 보고 정답을 눌러요', '빨리 맞힐수록 점수 (틀리면 2.5초 쉬기)'], null), goal: '팀원들이 빨리 많이 맞힌 팀이 이겨요', score: '맞힌 속도 · 그린 사람은 팀원이 맞힌 만큼' },
  spot: { t: 'spot', steps: K(['두 그림을 봐요', '다른 곳을 콕', '찾았다!'], ['위·아래 그림을 비교해요', '다른 곳을 아래 그림에서 터치해요', '틀리게 누르면 1초 쉬어요'], null), goal: '많이 찾은 팀이 이겨요', score: '찾은 개수' },
  hilo: { t: 'choice', n: 2, hilo: true, steps: K(['카드를 봐요', '높다/낮다 콕', '맞히면 점수'], ['지금 카드 숫자를 봐요', '다음 카드가 높을지 낮을지 눌러요', '연속으로 맞히면 점수가 커져요'], null), goal: '점수가 높은 팀이 이겨요', score: '맞히면 1점 + 연속 보너스' },
  shout: { t: 'shout', steps: K(['마이크 버튼 콕', '와아아! 크게', '버튼 연타도 돼요'], ['"마이크 켜기"를 눌러요 (안 돼도 괜찮아요)', '신호가 나오면 크게 "와아!"', '마이크 대신 응원 버튼 연타도 돼요'], null), goal: '함성이 가장 큰 팀이 이겨요', score: '함성 크기 평균 (마지막 2배)' },
  hold: { t: 'hold', label: '꾹 유지', long: true, steps: K(['버튼에 손가락', '시작 전부터 꾹!', '끝까지 떼지 마요'], ['버튼에 손가락을 대요 (카운트다운 중에도)', '꾹 누른 채 버텨요', '손을 떼면 탈락 · 화면 속임수에 속지 마요'], null), goal: '오래 버틴 사람이 많은 팀이 이겨요', score: '버틴 시간' },
  pe_freeze: { t: 'pe', steps: K(['화면 동작을 봐요', '음악에 맞춰 따라 해요', '"얼음!" 하면 멈춰요'], ['큰 화면 동작을 봐요', '음악에 맞춰 따라 해요', '"얼음!"이면 그대로 멈춰요'], null), goal: '잘 멈춘 팀에 진행자가 점수를 줘요', score: '진행자 판정 점수' },
  pe_simon: { t: 'pe', steps: K(['말을 잘 들어요', '"가라사대"면 따라 해요', '그냥 말하면 멈춰요'], ['진행 말을 잘 들어요', '"가라사대"라고 할 때만 따라 해요', '그냥 말하면 따라 하지 않아요'], null), goal: '속지 않은 팀에 진행자가 점수를 줘요', score: '진행자 판정 점수' },
  pe_mission: { t: 'pe', steps: K(['미션을 봐요', '팀이 같이 해요', '먼저 끝내요'], ['큰 화면 미션을 읽어요', '팀원 모두 함께 해내요', '먼저 끝낸 팀부터 점수'], null), goal: '미션을 빨리 끝낸 팀이 이겨요', score: '1등 3점 · 2등 2점 · 나머지 1점' },
  sync: { t: 'timing', label: '쿵!', team: true, steps: K(['북을 봐요', '쿵! 할 때 다 같이 콕', '같이 맞추면 점수'], ['탭 버튼에 손가락을 올려요', '원이 북에 닿는 "쿵!" 순간 팀원 모두 탭', '✋ 쉬는 박자엔 누르면 안 돼요'], null), goal: '박자마다 같이 맞춘 팀원 비율이 높은 팀이 이겨요', score: '박자별 팀 성공 비율 평균' },
  relay: { t: 'relay', steps: K(['내 차례를 기다려요', '내 차례면 콕콕콕', '다 채우면 친구 차례'], ['내 차례가 되면 진동이 와요', '빠르게 연타해서 게이지를 채워요', '다 채우면 다음 친구에게 바통 (잠깐 안 누르면 넘어가요)'], null), goal: '이어 달린 구간이 많은 팀이 이겨요', score: '팀 구간 수' },
  balloon: { t: 'balloon', steps: K(['위의 색을 봐요', '그 색 풍선만 콕', '다른 색은 −1'], ['위에 나온 목표 색을 봐요', '그 색 풍선만 터치해요', '다른 색은 −1 · 팀이 3초 안에 많이 맞히면 팀 콤보(+2·+3)'], null), goal: '팀 평균 점수가 높은 팀이 이겨요 (팀 콤보로 함께!)', score: '맞힌 풍선 +1~3 · 틀린 색 −1' },
  bombpass: { t: 'bomb', steps: K(['폭탄이 와요', '같은 색 버튼 콕', '다른 팀으로 휙!'], ['폭탄이 오면 진동이 와요', '화면에 나온 색과 같은 버튼을 눌러요', '다른 팀에게 넘어가요 (심지가 다 타면 들고 있던 팀 폭발)'], null), goal: '폭발이 적은 팀이 이겨요', score: '우리 팀 폭발 ÷ 전체 폭발 (적을수록 좋음)' },
  boss: { t: 'grid', cells: 9, cols: 3, label: '🎯', boss: true, steps: K(['칸을 봐요', '반짝이는 칸 콕!', '보스를 공격!'], ['칸들 중 빛나는 약점을 찾아요', '나타나자마자 그 칸을 터치 (빠르면 치명타 ×2)', '다른 칸은 0.6초 막혀요 · 팀 공격으로 보스 체력을 깎아요'], null), goal: '보스를 먼저 쓰러뜨린 팀이 이겨요 (체력은 팀 인원에 맞춤)', score: '처치 순서 · 못 쓰러뜨리면 깎은 체력 %' },
  towerup: { t: 'tower', steps: K(['내 차례를 기다려요', '블록이 탑 위에 오면 콕', '높이 쌓아요'], ['내 차례가 되면 진동이 와요', '움직이는 블록이 탑과 겹칠 때 탭', '겹친 만큼만 남아요 · 딱 맞으면 PERFECT'], null), goal: '탑 평균 높이가 높은 팀이 이겨요 (차례대로 번갈아)', score: '탑 평균 층수' },
  tug: { t: 'tap', label: '영차!', rep: 6, team: true, steps: K(['영차 버튼에 손가락', '콕콕콕 빨리!', '우리 쪽으로 끌어와요'], ['"영차!" 버튼을 봐요', '팀원과 함께 빠르게 연타해요', '매듭을 우리 쪽 선까지 끌어오면 1승']), goal: '우리 팀 쪽 선까지 매듭을 끌어오면 1승 · 많이 이긴 팀이 1등', score: '이긴 판 수 → 매듭 위치' },
  ljump: { t: 'timing', label: '점프!', steps: K(['콕콕콕 달려요', '선 앞에서 점프!', '바늘 가운데서 콕'], ['버튼을 연타해 빨리 달려요', '발구르기 선 바로 앞에서 "점프"', '각도 바늘이 45° 근처일 때 콕 (3번 중 최고 기록)']), goal: '3번 뛰어 가장 멀리 뛴 기록으로 겨뤄요', score: '최고 기록(m) · 파울은 0m' },
  ath: { t: 'twoBtn', a: '왼발', b: '오른발', steps: K(['두 버튼을 봐요', '총소리가 나면 번갈아 톡톡', '결승선까지!'], ['아래 왼발·오른발 버튼에 손가락', '"탕!" 출발 신호가 나면 왼·오 번갈아 빠르게 (총소리 전에 누르면 부정 출발)', '1초에 7번이면 최고 속도 · 400m·800m는 체력 조절'], null), goal: '빨리 결승선에 들어온 사람(팀)이 이겨요', score: '경주 순위 점수 (팀은 1인 평균) · 기록은 게임 계산' },
  bowl: { t: 'swipeUp', obj: '🎳', tgt: '🎯', steps: K(['공을 잡아요', '위로 쓱!', '핀을 넘어뜨려요'], ['레인 아래쪽 공 근처에 손가락을 대요', '노리는 방향으로 위로 쓱 밀어요 (빠를수록 세게)', '맨 앞 핀 바로 옆을 맞히면 스트라이크!']), goal: '핀을 많이 넘어뜨려 높은 점수를 내요', score: '넘어뜨린 핀 + 스트라이크·스페어 보너스' },
};
export const ageKey = (mode) => (['baby', 'kid'].includes(mode) ? 'kid' : ['mid', 'high', 'adult'].includes(mode) ? 'adult' : 'elem');
export function demoText(game, mode) { const d = DEMO[game]; if (!d && PE_BY[game]) { const g = PE_BY[game]; return { steps: g.tut.slice(0, 3), goal: g.win, score: g.score }; } if (!d) return null; const a = ageKey(mode); return { steps: d.steps[a] || d.steps.elem, goal: d.goal, score: d.score }; }

// ---------------- 게임 설명 상자 (설명 화면 · 미리보기 공용) ----------------
// 폰을 어떻게 들고 무엇을 누르는지 (조작 종류별) — 실제 게임 화면의 조작과 같게
const HOLD = {
  joy: '📱 세로로 들고 · 화면 아래 동그란 조이스틱을 엄지로 밀어 움직여요 (폰을 기울여도 돼요)', hold: '📱 세로로 들고 · 큰 버튼을 누르고 있으면 움직이고, 떼면 멈춰요',
  trace: '📱 세로로 들고 · 손가락으로 점선 모양을 따라 천천히 그어요', timing: '📱 세로로 들고 · 큰 버튼을 알맞은 순간에 눌러요', swipeUp: '📱 세로로 들고 · 아래에서 위로 쓱 밀어 던져요 (빠를수록 세게)',
  tap: '📱 세로로 들고 · 큰 버튼(또는 화면)을 눌러요', slash: '📱 세로로 들고 · 화면을 손가락으로 쓱 그어 잘라요', twoBtn: '📱 세로로 들고 · 아래 두 버튼(방향 바꾸기·오르기)을 번갈아 눌러요',
  bridge: '📱 세로로 들고 · 누르고 있으면 다리가 길어지고 떼면 놓여요', fish: '📱 세로로 들고 · 찌가 쑥 들어가면 화면을 눌러 낚아요', curl: '📱 세로로 들고 · 스톤을 위로 밀어 던지고, 화면을 문질러 길을 닦아요',
  grid: '📱 세로로 들고 · 화면의 칸을 눌러요', lanes: '📱 세로로 들고 · 음표가 아래 줄에 닿을 때 그 줄을 눌러요', dragH: '📱 세로로 들고 · 바구니를 좌우로 끌어요', order: '📱 세로로 들고 · 주문 순서대로 재료 버튼을 눌러요',
  choice: '📱 세로로 들고 · 보기 중 하나를 눌러요 (한 번 고르면 끝)', draw: '📱 세로로 들고 · 그리는 사람은 화면에 그림, 나머지는 보기를 눌러 맞혀요', spot: '📱 세로로 들고 · 아래 "찾는 그림"에서 다른 곳을 눌러요 (위 원본은 보기만)',
  shout: '📱 세로로 들고 · 버튼을 마구 누르거나 소리를 질러요', relay: '📱 세로로 들고 · 내 차례(화면이 바뀜)에 버튼을 빠르게 눌러 게이지를 채워요', balloon: '📱 세로로 들고 · 지금 정해진 색 풍선만 눌러요',
  bomb: '📱 세로로 들고 · 폭탄이 오면 다른 팀 버튼을 눌러 넘겨요', tower: '📱 세로로 들고 · 블록이 아래 탑과 겹칠 때 "떨어뜨리기"를 눌러요', pe: '🙌 폰 없이 · 큰 화면과 진행자 신호를 보고 몸으로 해요',
};
// 실수하거나 제때 못 눌렀을 때
const MISS = {
  dodge: '번개에 맞으면 하트가 줄고, 다 잃으면 관전', zombie: '사람이 잡히면 좀비가 돼서 계속 뛰어요', paint: '실수 없음 · 다른 팀이 내 땅을 다시 칠할 수 있어요', gems: '부딪혀도 실수 없음 · 시간 안에 많이 모으면 돼요', crown: '황금 원 밖에 있으면 점수가 안 올라가요 · 원을 따라가요',
  mugung: '술래가 돌아볼 때 움직이다 걸리면 탈락', dalgona: '선 밖으로 나가면 금이 가요 (정확도 점수가 낮아져요)', rope: '팀원 대부분이 제때 못 뛰면 줄이 걸려요 (팀 성공 수가 안 늘어요)', tuho: '항아리에 못 넣으면 0점 · 바로 다시 던져요', runner: '장애물에 부딪히면 잠깐 멈췄다 다시 달려요',
  flappy: '기둥에 부딪히면 잠깐 멈췄다가 다시 날아요 (통과한 수는 그대로)', fruit: '💣 폭탄을 자르면 −5점', stairs: '방향을 틀리면 떨어져 잠깐 멈췄다가 그 자리부터 다시 (오른 계단은 그대로)', bridge: '막대가 짧거나 길면 떨어졌다가 같은 기둥에서 다시', fishing: '챔질이 늦으면 놓치고, 장력 게이지가 초록색 밖으로 나가면 줄이 끊기거나 도망가요',
  curling: '하우스(과녁)에서 멀거나 밖이면 점수가 적어요 · 스톤 3개', penalty: '키퍼가 막거나 빗나가면 0골', basket: '빗나가면 0점 · 바로 다시 던져요', fire: '최고점에서 멀수록 작은 불꽃(점수 적음) · 안 누르면 0점', rhythm: '놓친 음표는 0점 · 콤보가 끊겨요',
  eggs: '달걀을 놓치면 점수 없음 · 돌멩이를 받으면 −2점', burger: '순서가 틀리면 그 버거를 처음부터 다시', bell: '틀리면 탈락이지만 다음 문제를 맞히면 바로 부활 · 시간 안에 안 고르면 오답', tele: '정답은 없어요 · 시간 안에 안 고르면 그 문제는 점수 없음', mino: '많은 쪽을 고르면 탈락 · 탈락해도 살아남는 쪽을 맞히면 부활',
  draw: '못 맞혀도 감점 없음 · 빨리 맞힐수록 점수가 커요', spot: '틀린 곳을 누르면 1초 동안 못 눌러요', hilo: '틀리면 연속 보너스가 끊겨요 · 같은 숫자면 모두 정답', shout: '실수 없음 · 마이크가 안 되면 버튼 연타로 응원해요', hold: '손을 떼면 그때까지 버틴 시간이 기록돼요 (영아·유아는 다시 누르면 이어서)',
  sync: '✋ 쉬는 박자에 누르면 안 돼요 · 함께 맞춘 사람이 적으면 점수가 적어요', relay: '내 차례가 아니면 눌러도 안 들어가요 · 3초 동안 안 누르면 바통이 다음 친구에게', balloon: '다른 색 풍선을 누르면 점수가 깎여요', bombpass: '심지가 다 탈 때 들고 있던 팀이 폭발 −1 · 틀린 색을 누르면 1초 멈춤', boss: '약점이 아닌 칸을 누르면 잠깐 막혀요',
  towerup: '어긋난 만큼 블록이 잘려 좁아져요 · 내 차례에 4초 안에 안 누르면 다음 친구 차례', tug: '실수 없음 · 1인당 초당 12번까지만 인정', ljump: '선을 넘으면 파울(0m) · 3번 중 최고 기록', bowl: '도랑에 빠지면 0개 · 한 프레임에 2번', ath: '총소리 전에 누르면 부정 출발(경고 후 재출발) · 같은 쪽만 연속으로 누르면 안 나가요',
};
const SCORE_WAY = { avg: '팀원 점수의 평균이 팀 점수 (인원이 달라도 공정)', sum: '팀원 점수를 모두 더한 값이 팀 점수', top: '팀에서 잘한 사람들(상위 몇 명) 평균이 팀 점수', rep: '팀 대표의 점수가 팀 점수' };
export function howTo(game, { team = false, scoring = 'avg', race = false } = {}) {
  const d = DEMO[game]; const t = d?.t || (PE_BY[game] ? 'pe' : null);
  return {
    hold: HOLD[t] || '📱 세로로 들고 · 화면 안내를 따라 눌러요',
    miss: MISS[game] || (PE_BY[game] ? '진행자가 보고 판정해요 · 틀려도 다음 라운드에 다시 참여' : '실수해도 바로 다시 할 수 있어요'),
    team: team ? '🤝 팀 게임: 팀원 모두의 입력이 합쳐져 팀 점수가 돼요' : `🤝 ${SCORE_WAY[scoring] || SCORE_WAY.avg}`,
    watch: `👀 게임 중 위쪽 줄: 우리 팀 순위·1위와 차이 · 내 순위·앞사람과 차이${race ? ' · 트랙에서 앞선 사람(팀)과 내 위치' : ''}`,
  };
}

// ---------------- 그리기 ----------------
const FINGER = (c, x, y, s, down) => { c.save(); c.globalAlpha = 0.95; if (down) { c.fillStyle = '#ffd43b55'; c.beginPath(); c.arc(x, y, s * 0.9, 0, 7); c.fill(); } c.font = `${s * 1.4}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'top'; c.fillText('👆', x + s * 0.15, y - s * 0.1); c.restore(); };
const ARROW = (c, x1, y1, x2, y2, col = '#ffd43b', w = 6) => { c.strokeStyle = col; c.fillStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); const a = Math.atan2(y2 - y1, x2 - x1); c.beginPath(); c.moveTo(x2, y2); c.lineTo(x2 - Math.cos(a - 0.5) * w * 3, y2 - Math.sin(a - 0.5) * w * 3); c.lineTo(x2 - Math.cos(a + 0.5) * w * 3, y2 - Math.sin(a + 0.5) * w * 3); c.fill(); };
const TXT = (c, s, x, y, px, col = '#fff', al = 'center') => { c.fillStyle = col; c.font = `900 ${px}px sans-serif`; c.textAlign = al; c.textBaseline = 'middle'; c.fillText(s, x, y); };
const RR = (c, x, y, w, hh, r, fill, stroke) => { c.beginPath(); c.roundRect(x, y, w, hh, r); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 3; c.stroke(); } };
const lerp = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));
const ease = (k) => (k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k));

// k: 0~1 (한 번 반복), 반환: 지금 단계 0·1·2
function drawDemo(c, W, H, d, k, col) {
  const s = Math.min(W, H) / 10; // 손가락 크기 기준
  // 폰 틀
  const pw = Math.min(W * 0.62, H * 0.5), ph = pw * 1.75 > H * 0.92 ? H * 0.92 : pw * 1.75; const px = (W - pw) / 2, py = (H - ph) / 2;
  RR(c, px - 10, py - 10, pw + 20, ph + 20, 28, '#0b0e24', '#ffffff55'); RR(c, px, py, pw, ph, 20, '#1b2250');
  const X = (u) => px + u * pw, Y = (v) => py + v * ph;
  let step = k < 0.33 ? 0 : k < 0.66 ? 1 : 2;
  switch (d.t) {
    case 'joy': {
      const fx = X(0.5), fy = Y(0.3); RR(c, X(0.06), Y(0.05), pw * 0.88, ph * 0.5, 14, '#0f1736');
      const dir = [Math.cos(0.7), -Math.sin(0.7)]; const push = ease((k - 0.3) / 0.35); const me = [fx + dir[0] * push * pw * 0.3, fy + dir[1] * push * ph * 0.15];
      if (d.haz === 'warn') { c.fillStyle = `rgba(255,212,59,${0.25 + 0.2 * Math.sin(k * 30)})`; c.beginPath(); c.arc(fx, fy, pw * 0.16, 0, 7); c.fill(); c.strokeStyle = '#ffd43b'; c.lineWidth = 3; c.stroke(); if (k > 0.75) TXT(c, '⚡', fx, fy, s * 1.3); }
      if (d.haz === 'zombie') TXT(c, '🧟', fx - pw * 0.25, fy + ph * 0.08 - push * 10, s * 1.1);
      if (d.haz === 'paint') { c.fillStyle = col + '88'; for (let i = 0; i < 12; i++) { const q = i / 12 * push; c.fillRect(fx + dir[0] * q * pw * 0.3 - 10, fy + dir[1] * q * ph * 0.15 - 10, 20, 20); } }
      if (d.haz === 'gem') TXT(c, k > 0.66 ? '+5' : '💎', fx + dir[0] * pw * 0.3, fy + dir[1] * ph * 0.15, s * (k > 0.66 ? 0.8 : 0.9), '#ffd43b');
      if (d.haz === 'crown') { c.strokeStyle = '#ffd43b'; c.lineWidth = 5; c.beginPath(); c.arc(fx + dir[0] * pw * 0.3, fy + dir[1] * ph * 0.15, pw * 0.12, 0, 7); c.stroke(); }
      c.fillStyle = col; c.beginPath(); c.arc(me[0], me[1], s * 0.35, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke();
      const jx = X(0.5), jy = Y(0.78), jr = pw * 0.22; c.fillStyle = '#ffffff18'; c.beginPath(); c.arc(jx, jy, jr, 0, 7); c.fill(); c.strokeStyle = '#ffffff55'; c.stroke();
      const kx = jx + dir[0] * jr * 0.6 * push, ky = jy + dir[1] * jr * 0.6 * push; c.fillStyle = '#fff'; c.beginPath(); c.arc(kx, ky, jr * 0.38, 0, 7); c.fill();
      if (k > 0.1) FINGER(c, kx, ky, s, true); if (k > 0.3 && k < 0.66) ARROW(c, jx, jy, jx + dir[0] * jr * 1.2, jy + dir[1] * jr * 1.2);
      break;
    }
    case 'hold': case 'bridge': {
      const on = k > 0.2 && k < (d.long ? 0.95 : 0.66); const bx = X(0.5), by = Y(0.72), br = pw * 0.3;
      if (d.t === 'bridge') { c.fillStyle = '#556'; c.fillRect(X(0.1), Y(0.45), pw * 0.18, ph * 0.3); c.fillRect(X(0.62), Y(0.45), pw * 0.22, ph * 0.3); const len = ease((Math.min(k, 0.66) - 0.2) / 0.4) * pw * 0.42; c.save(); c.translate(X(0.28), Y(0.45)); c.rotate(k > 0.66 ? -Math.PI / 2 + ease((k - 0.66) / 0.12) * Math.PI / 2 : -Math.PI / 2); c.fillStyle = '#ffd43b'; c.fillRect(0, -4, len, 8); c.restore(); if (k > 0.8) TXT(c, '건넜다! +1', X(0.5), Y(0.28), s * 0.6, '#2fd27a'); FINGER(c, X(0.5), Y(0.85), s, on); break; }
      if (!d.long) { const prog = ease((Math.min(k, 0.66) - 0.2) / 0.46); c.fillStyle = '#ffffff22'; c.fillRect(X(0.1), Y(0.12), pw * 0.8, 14); c.fillStyle = col; c.fillRect(X(0.1), Y(0.12), pw * 0.8 * prog, 14); TXT(c, '🏃', X(0.1) + pw * 0.8 * prog, Y(0.22), s * 0.8); if (k > 0.66) TXT(c, '👀 멈춤!', X(0.5), Y(0.36), s * 0.7, '#ff4d6d'); }
      else TXT(c, on ? '버티는 중…' : '탈락!', X(0.5), Y(0.3), s * 0.6, on ? '#2fd27a' : '#ff4d6d');
      c.fillStyle = on ? '#ffd43b' : col; c.beginPath(); c.arc(bx, by, br * (on ? 0.94 : 1), 0, 7); c.fill(); TXT(c, d.label || '꾹', bx, by, s * 0.55, '#111');
      FINGER(c, bx, by - 10, s, on); break;
    }
    case 'tap': case 'timing': case 'relay': {
      const n = d.rep || (d.t === 'relay' ? 6 : 3); const ph2 = (k * n) % 1; const down = ph2 < 0.18 && k > 0.2;
      if (d.t === 'timing') {
        const hit = 0.5; const pos = (k * 2) % 1; // 다가오는 표시
        if (d.vertical) { const y = Y(0.6) - Math.sin(pos * Math.PI) * ph * 0.42; TXT(c, '🚀', X(0.5), y, s * 0.9); c.strokeStyle = '#ffd43b88'; c.setLineDash([8, 8]); c.beginPath(); c.moveTo(X(0.1), Y(0.18)); c.lineTo(X(0.9), Y(0.18)); c.stroke(); c.setLineDash([]); }
        else { const x = X(0.12) + pos * pw * 0.76; c.strokeStyle = '#fff'; c.lineWidth = 4; c.beginPath(); c.moveTo(X(0.5), Y(0.2)); c.lineTo(X(0.5), Y(0.5)); c.stroke(); TXT(c, d.team ? '🥁' : '〰', X(0.5), Y(0.15), s * 0.8); c.fillStyle = '#ffd43b'; c.beginPath(); c.arc(x, Y(0.35), s * 0.3, 0, 7); c.fill(); }
        const near = Math.abs(pos - hit) < 0.06; const press = near && k > 0.2;
        RR(c, X(0.15), Y(0.68), pw * 0.7, ph * 0.18, 24, press ? '#ffd43b' : col); TXT(c, d.label || '탭', X(0.5), Y(0.77), s * 0.6, '#111');
        if (press) TXT(c, d.team ? '다 같이!' : '지금!', X(0.5), Y(0.58), s * 0.7, '#ffd43b');
        FINGER(c, X(0.5), Y(0.75), s, press); step = k < 0.25 ? 0 : press || k < 0.7 ? 1 : 2; break;
      }
      if (d.t === 'relay') { const mine = k > 0.25 && k < 0.8; c.fillStyle = '#ffffff22'; c.fillRect(X(0.1), Y(0.2), pw * 0.8, 18); c.fillStyle = col; c.fillRect(X(0.1), Y(0.2), pw * 0.8 * ease((k - 0.25) / 0.5), 18); TXT(c, mine ? '🏃 내 차례!' : k >= 0.8 ? '바통 터치 →' : '기다려요', X(0.5), Y(0.12), s * 0.55); RR(c, X(0.15), Y(0.45), pw * 0.7, ph * 0.35, 24, mine ? col : '#333a66'); TXT(c, '👟 탭탭탭', X(0.5), Y(0.62), s * 0.6, '#111'); if (mine) FINGER(c, X(0.5), Y(0.6), s, down); break; }
      TXT(c, d.label === '점프' ? '🦖' : '🐤', X(0.35), Y(0.4) - (down ? 30 : 0), s * 1.1); TXT(c, d.label === '점프' ? '🌵' : '▮', X(0.75), Y(0.42), s * 0.9, '#2fd27a');
      if (k > 0.66) TXT(c, '+1', X(0.5), Y(0.2), s * 0.7, '#2fd27a');
      FINGER(c, X(0.5), Y(0.72), s, down); TXT(c, `톡 = ${d.label}`, X(0.5), Y(0.9), s * 0.45); break;
    }
    case 'swipeUp': case 'curl': {
      const sx = X(0.5), sy = Y(0.86); const fly = ease((k - 0.4) / 0.3);
      if (d.t === 'curl') { [[1, '#3d8bff'], [0.66, '#fff'], [0.33, '#ff4d6d']].forEach(([q, cc]) => { c.fillStyle = cc; c.beginPath(); c.arc(X(0.5), Y(0.2), pw * 0.22 * q, 0, 7); c.fill(); }); }
      else { const tx = X(0.5) + (d.move ? Math.sin(k * 6) * pw * 0.2 : 0); TXT(c, d.tgt, tx, Y(0.16), s * 1.2); }
      const ox = lerp(sx, d.t === 'curl' ? X(0.55) : X(0.5), fly), oy = lerp(sy, Y(d.t === 'curl' ? 0.22 : 0.18), fly);
      if (d.t === 'curl') { c.fillStyle = '#6b7280'; c.beginPath(); c.arc(ox, oy, s * 0.4, 0, 7); c.fill(); c.fillStyle = col; c.beginPath(); c.arc(ox, oy, s * 0.26, 0, 7); c.fill(); } else TXT(c, d.obj, ox, oy, s);
      if (k < 0.4) { const fy = lerp(sy, Y(0.55), ease((k - 0.12) / 0.28)); FINGER(c, sx, fy, s, k > 0.12); if (k > 0.15) ARROW(c, sx, sy, sx + (d.t === 'curl' ? 12 : 0), Y(0.5)); }
      if (d.t === 'curl' && k >= 0.45 && k < 0.8) { const zx = X(0.5) + Math.sin(k * 80) * pw * 0.25; FINGER(c, zx, Y(0.6), s, true); TXT(c, '↔ 문지르기 = 스위핑', X(0.5), Y(0.72), s * 0.42, '#ffd43b'); step = 1; }
      if (k > 0.75) TXT(c, d.t === 'curl' ? '중앙에 가까울수록 고득점' : '골인! +10', X(0.5), Y(0.42), s * 0.5, '#2fd27a');
      break;
    }
    case 'slash': {
      const fr = [['🍉', 0.3], ['🍎', 0.55], ['💣', 0.8]]; const sw = ease((k - 0.3) / 0.25);
      fr.forEach(([e, u], i) => { const cut = i < 2 && k > 0.45 + i * 0.05; TXT(c, cut ? '✨' : e, X(u), Y(0.35 + Math.sin(k * 3 + i) * 0.05), s * 1.1); });
      if (k > 0.25 && k < 0.6) { c.strokeStyle = '#ffffffcc'; c.lineWidth = 6; c.beginPath(); c.moveTo(X(0.12), Y(0.45)); c.lineTo(lerp(X(0.12), X(0.68), sw), lerp(Y(0.45), Y(0.28), sw)); c.stroke(); FINGER(c, lerp(X(0.12), X(0.68), sw), lerp(Y(0.45), Y(0.28), sw), s, true); }
      if (k > 0.66) TXT(c, '+2 콤보!', X(0.45), Y(0.6), s * 0.6, '#2fd27a'); if (k > 0.66) TXT(c, '💣 피해요', X(0.8), Y(0.55), s * 0.4, '#ff4d6d');
      break;
    }
    case 'trace': {
      c.strokeStyle = '#d9a35b'; c.lineWidth = 10; c.beginPath(); c.arc(X(0.5), Y(0.4), pw * 0.28, 0, 7); c.stroke();
      const a = -Math.PI / 2 + ease((k - 0.15) / 0.6) * Math.PI * 1.8; c.strokeStyle = col; c.lineWidth = 6; c.beginPath(); c.arc(X(0.5), Y(0.4), pw * 0.28, -Math.PI / 2, a); c.stroke();
      FINGER(c, X(0.5) + Math.cos(a) * pw * 0.28, Y(0.4) + Math.sin(a) * pw * 0.28, s, k > 0.15); if (k > 0.8) TXT(c, '완성! 정확도 92%', X(0.5), Y(0.82), s * 0.5, '#2fd27a'); break;
    }
    case 'choice': case 'order': {
      const n = d.n || 4; const pick = 1; const tapped = k > 0.45;
      if (d.t === 'order') { TXT(c, '주문: 🍞🥩🧀🍞', X(0.5), Y(0.12), s * 0.5); const ks = ['🍞', '🥩', '🧀', '🥬']; ks.forEach((e, i) => { RR(c, X(0.08 + (i % 2) * 0.44), Y(0.55 + Math.floor(i / 2) * 0.18), pw * 0.4, ph * 0.15, 16, '#2a335c'); TXT(c, e, X(0.28 + (i % 2) * 0.44), Y(0.625 + Math.floor(i / 2) * 0.18), s * 0.7); }); const seq = [0, 1, 2, 0]; const i = Math.min(3, Math.floor(ease((k - 0.2) / 0.6) * 4)); FINGER(c, X(0.28 + (seq[i] % 2) * 0.44), Y(0.625 + Math.floor(seq[i] / 2) * 0.18), s, true); TXT(c, `내 버거: ${['🍞', '🍞🥩', '🍞🥩🧀', '🍞🥩🧀🍞'][i]}`, X(0.5), Y(0.3), s * 0.5); break; }
      TXT(c, d.hilo ? '7 → ?' : d.quiz ? '문제는 큰 화면에' : '질문', X(0.5), Y(0.14), s * 0.55);
      if (d.quiz && tapped && k < 0.85) { RR(c, X(0.1), Y(0.3), pw * 0.8, ph * 0.45, 18, '#2a335c', '#ffffff55'); TXT(c, '📨 제출 완료', X(0.5), Y(0.48), s * 0.6); TXT(c, '모두 내면 함께 공개', X(0.5), Y(0.6), s * 0.38, '#9aa3c7'); }
      else for (let i = 0; i < n; i++) { const r = n === 2 ? [X(0.08 + i * 0.44), Y(0.4), pw * 0.4, ph * 0.3] : [X(0.08 + (i % 2) * 0.44), Y(0.3 + Math.floor(i / 2) * 0.2), pw * 0.4, ph * 0.17]; const right = d.quiz && k > 0.85 && i === pick; RR(c, ...r, 16, right ? '#2fd27a' : i === pick && tapped ? col : '#2a335c', '#ffffff33'); TXT(c, d.hilo ? ['⬆ 높다', '⬇ 낮다'][i] : `${'①②③④'[i]}`, r[0] + r[2] / 2, r[1] + r[3] / 2, s * 0.55); }
      if (!tapped) FINGER(c, X(0.08 + (pick % 2) * 0.44) + pw * 0.2, n === 2 ? Y(0.55) : Y(0.38), s, k > 0.3);
      if (d.quiz && k > 0.85) TXT(c, '정답 공개! 🎉', X(0.5), Y(0.82), s * 0.55, '#2fd27a');
      break;
    }
    case 'grid': {
      const n = d.cells, cols = d.cols, rows = n / cols; const lit = Math.floor(k * 3) % n === 0 ? 4 : (Math.floor(k * 3) * 5) % n; const gx = X(0.08), gy = Y(d.boss ? 0.25 : 0.2), cw = pw * 0.84 / cols, chh = ph * (d.boss ? 0.5 : 0.36) / rows;
      if (d.boss) { TXT(c, '🐉', X(0.5), Y(0.12), s * 1.1); c.fillStyle = '#ff4d6d'; c.fillRect(X(0.15), Y(0.2), pw * 0.7 * (1 - k * 0.4), 10); }
      else { c.strokeStyle = '#fff'; c.lineWidth = 5; c.strokeRect(gx, gy, pw * 0.84, ph * 0.36); TXT(c, '🧤', X(0.5), Y(0.5), s * 0.9); }
      for (let i = 0; i < n; i++) { const x = gx + (i % cols) * cw, y = gy + Math.floor(i / cols) * chh; RR(c, x + 4, y + 4, cw - 8, chh - 8, 12, i === lit && d.boss ? '#ffd43b' : '#ffffff10', '#ffffff33'); if (i === lit) TXT(c, d.label, x + cw / 2, y + chh / 2, s * 0.6); }
      const lx = gx + (lit % cols) * cw + cw / 2, ly = gy + Math.floor(lit / cols) * chh + chh / 2; FINGER(c, lx, ly, s, (k * 3) % 1 > 0.4);
      if ((k * 3) % 1 > 0.55) TXT(c, d.boss ? ((k * 3) % 1 < 0.7 ? '⚡ 치명타 ×2' : '💥 명중') : '골!', X(0.5), Y(0.86), s * 0.55, '#ffd43b');
      break;
    }
    case 'lanes': {
      const lw = pw * 0.8 / 3; const lineY = Y(0.75); c.strokeStyle = '#ffd43b'; c.lineWidth = 5; c.beginPath(); c.moveTo(X(0.1), lineY); c.lineTo(X(0.9), lineY); c.stroke();
      for (let i = 0; i < 3; i++) { c.strokeStyle = '#ffffff22'; c.strokeRect(X(0.1) + i * lw, Y(0.05), lw, ph * 0.85); }
      const ny = lerp(Y(0.08), lineY + 30, ((k * 1.5) % 1) / 0.9); c.fillStyle = col; RR(c, X(0.1) + lw + 8, ny - 14, lw - 16, 28, 10, col);
      const at = Math.abs(ny - lineY) < 22; FINGER(c, X(0.1) + lw * 1.5, lineY + 10, s, at);
      if (at) TXT(c, 'PERFECT', X(0.5), lineY - 60, s * 0.6, '#ffd43b'); TXT(c, '빠름 · 늦음은 GOOD', X(0.5), Y(0.9), s * 0.38, '#9aa3c7');
      step = k < 0.3 ? 0 : at ? 2 : 1; break;
    }
    case 'dragH': {
      const bx = X(0.5) + Math.sin(k * 6.28) * pw * 0.3; TXT(c, '🥚', X(0.5) + Math.sin(k * 6.28 - 0.4) * pw * 0.3, Y(0.15 + ((k * 2) % 1) * 0.6), s * 0.8); TXT(c, '🧺', bx, Y(0.82), s * 1.1); FINGER(c, bx, Y(0.84), s, true); ARROW(c, bx - 40, Y(0.7), bx + 40, Y(0.7)); break;
    }
    case 'twoBtn': {
      TXT(c, '🧗', X(0.5), Y(0.35) - (k > 0.4 ? 20 : 0), s); for (let i = 0; i < 4; i++) c.fillRect(X(0.3 + (i % 2) * 0.2), Y(0.45 - i * 0.07), pw * 0.18, 8);
      RR(c, X(0.05), Y(0.72), pw * 0.42, ph * 0.18, 16, '#2a335c'); RR(c, X(0.53), Y(0.72), pw * 0.42, ph * 0.18, 16, col); TXT(c, d.a, X(0.26), Y(0.81), s * 0.38); TXT(c, d.b, X(0.74), Y(0.81), s * 0.4, '#111');
      FINGER(c, k < 0.6 ? X(0.74) : X(0.26), Y(0.8), s, (k * 4) % 1 < 0.3); break;
    }
    case 'fish': {
      const bite = k > 0.25 && k < 0.45; TXT(c, bite ? '🔴 쑥!' : '🎣', X(0.5), Y(0.25) + (bite ? 18 : 0), s); if (bite) TXT(c, '지금! 챔질', X(0.5), Y(0.12), s * 0.55, '#ffd43b');
      if (k > 0.45) { const bw = pw * 0.7; c.fillStyle = '#00000055'; c.fillRect(X(0.15), Y(0.5), bw, 26); c.fillStyle = '#2fd27a88'; c.fillRect(X(0.15) + bw * 0.25, Y(0.5), bw * 0.5, 26); c.fillStyle = '#fff'; c.fillRect(X(0.15) + bw * (0.45 + Math.sin(k * 25) * 0.15), Y(0.48), 6, 32); TXT(c, '꾹=감기 · 떼기=풀기', X(0.5), Y(0.62), s * 0.4); }
      FINGER(c, X(0.5), Y(0.8), s, bite || (k > 0.5 && (k * 8) % 1 < 0.5)); if (k > 0.85) TXT(c, '🐟 잡았다!', X(0.5), Y(0.4), s * 0.6, '#2fd27a'); break;
    }
    case 'draw': { c.strokeStyle = '#fff'; c.lineWidth = 6; c.beginPath(); for (let i = 0; i <= 30 * ease(k / 0.45); i++) { const a = i / 30 * 6.28; const x = X(0.5) + Math.cos(a) * pw * 0.2, y = Y(0.25) + Math.sin(a) * pw * 0.2; if (i) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke(); ['🍎', '🌞', '⚽'].forEach((e, i) => { RR(c, X(0.06 + i * 0.31), Y(0.62), pw * 0.27, ph * 0.14, 14, k > 0.6 && i === 1 ? '#2fd27a' : '#2a335c'); TXT(c, e, X(0.195 + i * 0.31), Y(0.69), s * 0.7); }); FINGER(c, k < 0.45 ? X(0.5) + Math.cos(k / 0.45 * 6.28) * pw * 0.2 : X(0.505), k < 0.45 ? Y(0.25) + Math.sin(k / 0.45 * 6.28) * pw * 0.2 : Y(0.69), s, true); if (k > 0.66) TXT(c, '정답! +빠를수록', X(0.5), Y(0.86), s * 0.45, '#2fd27a'); break; }
    case 'spot': { RR(c, X(0.1), Y(0.06), pw * 0.8, ph * 0.38, 12, '#2a335c'); RR(c, X(0.1), Y(0.48), pw * 0.8, ph * 0.38, 12, '#2a335c'); TXT(c, '🍎 ⚽ 🎸', X(0.5), Y(0.25), s * 0.7); TXT(c, `🍎 ${k > 0.6 ? '✅' : '🏀'} 🎸`, X(0.5), Y(0.67), s * 0.7); FINGER(c, X(0.5), Y(0.68), s, k > 0.45 && k < 0.6); break; }
    case 'shout': { RR(c, X(0.15), Y(0.15), pw * 0.7, ph * 0.18, 20, '#2a335c'); TXT(c, '🎤 마이크 켜기', X(0.5), Y(0.24), s * 0.45); const lv = Math.abs(Math.sin(k * 20)) * (k > 0.3 ? 1 : 0.2); c.fillStyle = '#ff922b'; c.fillRect(X(0.15), Y(0.45), pw * 0.7 * lv, 24); TXT(c, k > 0.3 ? '와아아아!' : '', X(0.5), Y(0.4), s * 0.6, '#ffd43b'); RR(c, X(0.15), Y(0.62), pw * 0.7, ph * 0.2, 20, col); TXT(c, '📣 응원 연타', X(0.5), Y(0.72), s * 0.45, '#111'); FINGER(c, k < 0.3 ? X(0.5) : X(0.5), k < 0.3 ? Y(0.24) : Y(0.72), s, (k * 8) % 1 < 0.4); break; }
    case 'pe': { const t = k * 6.28; c.strokeStyle = '#fff'; c.lineWidth = 8; const cx = X(0.5), cy = Y(0.4); c.beginPath(); c.arc(cx, cy - 70, 22, 0, 7); c.stroke(); c.beginPath(); c.moveTo(cx, cy - 48); c.lineTo(cx, cy + 30); c.moveTo(cx, cy - 30); c.lineTo(cx - 50 * Math.cos(t), cy - 30 - 50 * Math.abs(Math.sin(t))); c.moveTo(cx, cy - 30); c.lineTo(cx + 50 * Math.cos(t), cy - 30 - 50 * Math.abs(Math.sin(t))); c.moveTo(cx, cy + 30); c.lineTo(cx - 30, cy + 90); c.moveTo(cx, cy + 30); c.lineTo(cx + 30, cy + 90); c.stroke(); TXT(c, k > 0.66 ? '🧊 얼음!' : '🎵', X(0.5), Y(0.12), s * 0.7, '#7cf3ff'); if (k > 0.75) TXT(c, '진행자 +1', X(0.5), Y(0.86), s * 0.5, '#2fd27a'); break; }
    case 'balloon': { const tg = '#3d8bff'; RR(c, X(0.1), Y(0.03), pw * 0.8, ph * 0.08, 14, '#0b0e24'); c.fillStyle = tg; c.beginPath(); c.arc(X(0.2), Y(0.07), 12, 0, 7); c.fill(); TXT(c, '파랑만 콕!', X(0.55), Y(0.07), s * 0.45); [['#3d8bff', 0.3], ['#ff4d6d', 0.55], ['#3d8bff', 0.78]].forEach(([cc, u], i) => { const y = Y(0.9 - ((k + i * 0.2) % 1) * 0.75); const popped = i === 0 && k > 0.45; if (popped) TXT(c, '+1', X(u), Y(0.45), s * 0.6, '#2fd27a'); else { c.fillStyle = cc; c.beginPath(); c.ellipse(X(u), y, s * 0.45, s * 0.55, 0, 0, 7); c.fill(); } }); if (k > 0.25 && k < 0.45) FINGER(c, X(0.3), Y(0.9 - ((k) % 1) * 0.75), s, true); if (k > 0.66) TXT(c, '빨강 ✕ −1', X(0.55), Y(0.82), s * 0.4, '#ff4d6d'); break; }
    case 'bomb': { const pass = k > 0.55; TXT(c, '💣', pass ? lerp(X(0.5), X(1.2), (k - 0.55) / 0.3) : X(0.5), Y(0.25), s * 1.4); c.fillStyle = '#ffd43b'; c.fillRect(X(0.15), Y(0.42), pw * 0.7 * (1 - k * 0.6), 12); TXT(c, '🔴 빨강을 눌러요', X(0.5), Y(0.52), s * 0.45); ['#ff4d6d', '#3d8bff', '#ffd43b'].forEach((cc, i) => RR(c, X(0.06 + i * 0.31), Y(0.6), pw * 0.27, ph * 0.22, 16, cc)); FINGER(c, X(0.195), Y(0.7), s, k > 0.4 && k < 0.6); if (pass) TXT(c, '다른 팀으로 휙!', X(0.5), Y(0.9), s * 0.45, '#2fd27a'); break; }
    case 'tower': { const blocks = 3 + (k > 0.6 ? 1 : 0); for (let i = 0; i < blocks; i++) c.fillRect(X(0.32), Y(0.8 - i * 0.07), pw * 0.36, ph * 0.06); const mx = k < 0.6 ? X(0.1) + ((Math.sin(k * 10) + 1) / 2) * pw * 0.44 : X(0.32); c.fillStyle = '#ffd43b'; c.fillRect(mx, Y(0.8 - blocks * 0.07 - (k < 0.6 ? 0.1 : 0)), pw * 0.36, ph * 0.06); FINGER(c, X(0.5), Y(0.9), s, k > 0.5 && k < 0.62); if (k > 0.62) TXT(c, 'PERFECT!', X(0.5), Y(0.3), s * 0.6, '#ffd43b'); break; }
    default: TXT(c, '👆', X(0.5), Y(0.5), s * 1.5);
  }
  return step;
}

// 미리보기 붙이기: root에 캔버스 + 단계 글을 넣고 반복 재생. 반환: { stop() }
export function mountDemo(root, game, { mode = 'elem', color = '#ffd43b', sec = 6, big = false, h, t0 = performance.now(), space = 'gym' }) {
  const d = DEMO[game];
  if (!d && PE_BY[game]) {
    // 폰 없는 체육: 동작·성공·점수·안전 4장 튜토리얼
    const cv = document.createElement('canvas'); cv.className = 'demo-cv petut'; const box = h('div', { class: `demo pe ${big ? 'big' : ''}` }, cv); root.append(box);
    const lv = { baby: 0, kid: 1, elem: 2, mid: 3, high: 4, adult: 5 }[mode] ?? 2; let dead = false;
    const frame = () => { if (dead || !box.isConnected && performance.now() - t0 > 500) return; const r = cv.getBoundingClientRect(); const dpr = Math.min(2, devicePixelRatio || 1); const W = Math.max(10, Math.round(r.width * dpr)), H = Math.max(10, Math.round(r.height * dpr)); if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; } peTutorial(cv.getContext('2d'), W, H, PE_BY[game], (performance.now() - t0) / 1000, lv, space, mvFor); requestAnimationFrame(frame); };
    requestAnimationFrame(frame); return { stop() { dead = true; box.remove(); }, el: box };
  }
  if (!d) return { stop() {} };
  const tx = demoText(game, mode);
  const cv = document.createElement('canvas'); cv.className = 'demo-cv';
  const steps = h('ol', { class: 'demo-steps' }, ...tx.steps.map((s, i) => h('li', { 'data-i': i }, h('b', {}, '①②③'[i]), ' ', s)));
  const box = h('div', { class: `demo ${big ? 'big' : ''}` }, cv, steps);
  root.append(box);
  let dead = false; let lastStep = -1;
  const frame = () => {
    if (dead || !box.isConnected && performance.now() - t0 > 500) { dead = true; return; }
    const r = cv.getBoundingClientRect(); const dpr = Math.min(2, devicePixelRatio || 1); const W = Math.max(10, Math.round(r.width * dpr)), H = Math.max(10, Math.round(r.height * dpr)); if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const c = cv.getContext('2d'); c.clearRect(0, 0, W, H);
    const k = (((performance.now() - t0) / 1000) % sec) / sec;
    const st = drawDemo(c, W, H, d, k, color);
    if (st !== lastStep) { lastStep = st; steps.querySelectorAll('li').forEach((li, i) => li.classList.toggle('on', i === st)); }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return { stop() { dead = true; box.remove(); }, el: box };
}
