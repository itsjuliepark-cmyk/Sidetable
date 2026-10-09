# Sidetable 클로즈드 베타 앱

> 앱 이름은 **Sidetable**이에요(2026-10-06: Sixtop → Sidetable → Sidetable. Sidetable은 SF의 테크 디너 시리즈 Tech2Table과 겹쳐서 바꿨어요). 화면에 보이는 이름만 바뀌었고, 코드 폴더(sixtop/), 저장소 키(sixtopToken), 환경 변수(SIXTOP_*)는 그대로예요.

Harvard × MIT 파일럿용으로 실제로 돌아가는 앱이에요. Harvard는 HBS만이 아니라 모든 학교(College, Kennedy School, Law, Medical, SEAS 등)가 들어올 수 있고, 나중에는 학교 밖 사람도 받을 수 있게 학교를 “커뮤니티” 데이터로 다뤄요(`public/shared.js`의 `SCHOOLS`에 항목과 이메일 도메인을 추가하면 돼요). Amie 베타와 같은 구조예요: Node 파일 하나, 의존성 없음, 데이터는 JSON 파일 하나.
기획은 [../CONCEPT.md](../CONCEPT.md), 사업 검토는 [../BUSINESS.md](../BUSINESS.md), 클릭 프로토타입은 [../sixtop.html](../sixtop.html)에 있어요.

## 로컬에서 바로 써보기

```bash
npm run seed
```

```bash
npm run dev
```

- `seed`가 데모 회원 40명(Harvard 20: 비즈니스스쿨, College, Kennedy School 등 / MIT 20)을 만들고, Jordan으로 들어가는 링크를 출력해요. Jordan에게는 이번 주 봉인된 초대장 두 장(테크 하나, 소셜 하나)이 있어요.
  - 2주 전 저녁: 테이블, 다음 날 픽, 서로 고른 사람과의 1:1 채팅까지 끝난 상태
  - 이틀 뒤 저녁: 테이블 공개, 단톡방에 Charlie 인사와 몇 개의 메시지
  - 다음 주: 34명이 가능한 저녁과 디너 횟수(1~5)를 표시해 둔 상태 (관리자에서 바로 Build 가능)
  - Hang 6개 (소셜 3, 토픽 3): 회원이 연 모임에 몇 명씩 조인, Jordan은 그중 하나에 조인. 각 hang에 질문 카드 3장과 미리 들어온 표가 있고, Jordan의 climate lunch는 Jordan이 투표하면 마감돼요
- 폰 데모에서는 저녁을 고르면(디너 횟수만큼) 일요일 밤을 기다리지 않고 바로 다음 주 테이블이 짜이고 초대장이 열려요(테크 테이블 먼저). 실제 앱에서는 그 자리에 “On its way, sealed until Sunday night” 봉투가 떠 있어요
- `dev`는 관리자 키를 `local-admin`으로 고정하고, 학교 이메일 인증 코드를 메일 대신 화면에 보여줘요(`SIXTOP_MAIL=show`). **실제 파일럿에서는 쓰지 마세요.**
- 앱: <http://localhost:8800>, 관리자: <http://localhost:8800/admin>

## 실제 파일럿 실행

```bash
SIXTOP_ADMIN_KEY=choose-a-long-secret SIXTOP_PUBLIC_URL=https://your-domain npm start
```

| 환경 변수 | 기본값 | 의미 |
|---|---|---|
| `SIXTOP_ADMIN_KEY` | 실행마다 랜덤(로그에 출력) | 관리자 페이지 키. 길게 정해요 |
| `PORT` | 8800 | 포트. Railway 같은 곳은 자동으로 정해요 |
| `SIXTOP_DATA_DIR` | `./data` | 회원, 테이블, 채팅, 사진. **영구 디스크에 두세요** |
| `SIXTOP_PUBLIC_URL` | 없음 | 초대·클럽 링크의 주소 |
| `SIXTOP_TZ` | `America/New_York` | 마감, 장소 공개, 다음 날 질문 시각의 기준 |
| `SIXTOP_AREA` | `Central Square` | 새 밤의 기본 동네 |
| `RESEND_API_KEY`, `SIXTOP_MAIL_FROM` | 없음 | 학교 이메일 인증 코드를 보내는 [Resend](https://resend.com) 키와 보내는 주소(예: `Sidetable <hello@your-domain>`). **없으면 아무도 가입할 수 없어요** |
| `SIXTOP_MAIL` | 없음 | `show`면 코드를 메일 대신 화면에 보여줘요. 로컬 개발과 폰 데모 전용 |
| `SIXTOP_PUSH_DAY` | 4 | 한 사람이 하루에 받는 알림 최대 수 |
| `SIXTOP_VAPID_PUBLIC`, `SIXTOP_VAPID_PRIVATE` | 처음 한 번 만들어 데이터 폴더에 저장 | 푸시 알림 키. 바뀌면 모두 알림을 다시 켜야 해요 |

## 매주 운영 순서 (관리자 페이지)

| 언제 | 할 일 |
|---|---|
| 처음 한 번 | **Links** 탭에서 클럽마다 가입 링크를 만들어 클럽 채널에 공유해요. 개인 초대는 **People** 탭에서 |
| 일주일 전쯤 | **Nights**에서 밤을 열어요(Topic 또는 Kindred, 날짜, 시간, 동네). "Ping everyone"이면 알림이 가요 |
| 매주 (일요일 18:00 마감) | 회원은 Tables 탭에서 다음 주 디너 횟수(1~5)와 가능한 저녁(월~금)을 골라요. 관리자 **Tables** 탭 맨 위 **Build the tables**가 저녁마다 테크·소셜 테이블을 반반 섞어 짜요(사람 많은 저녁부터, 하루 한 번, 각자 고른 횟수까지). 확인하고 **Publish the week**. 테이블마다 제휴 식당과 캡틴이 자동으로 정해져요. `SIXTOP_AUTO_WEEK=1`이면 일요일 20시에 저절로 짜고 공개해요 |
| 일요일 22:00 | 제휴 식당마다 그 주 계획 메일(필요한 저녁, release할 저녁) |
| 특별한 밤 (선택) | 아래 방식으로 따로 열 수도 있어요. 마감(밤 3일 전 23:59)까지 좌석 예약 |
| 마감 다음 날 | 밤을 눌러 **Draft tables**. 테이블마다 적합도와 경고(투자자 3명, 이전에 같이 앉음, 학교 섞임)가 보여요. 필요하면 사람을 옮기고, 테이블마다 식당을 넣고 **Publish** |
| 공개 직후 | 회원 앱에 테이블과 단톡방이 열리고, Charlie가 "왜 이 사람들인지"와 워밍업 질문을 올려요 |
| 전날 09:00 | 회원에게 "못 가면 정오까지 알려주세요, 무료예요" 알림 |
| 전날 정오 | 무료 변경 마감. 식당에 최종 인원(테이블별 인원, 식단, 캡틴 이름). 그 뒤 바뀌면 업데이트 메일 |
| 당일 정오 | 식당 주소가 공개되고 알림이 가요(매번 확인하는 식당은 확인된 경우만, 아니면 당번 알림). 단톡방에 캡틴과 "Since last time"이 올라가요 |
| 당일 저녁 | 회원은 앱에서 Table deck(3라운드)을 써요. 관리자는 "Send to all tables"로 모든 테이블에 Charlie 메시지를 보낼 수 있어요 |
| 다음 날 10시 | "How was the table?" 알림. 온 사람, 평점, 다시 보고 싶은 사람, 같은 테이블 다음 달 |
| 그 뒤 | 서로 고른 사람끼리 1:1 채팅이 열리고, 둘 다 두 달 안에 좌석을 잡으면 **자동으로 같은 테이블(재회)**에 앉아요. 관리자 화면에서 "came" 체크로 참석을 확정할 수 있어요 |

맨 위 숫자는 BUSINESS.md의 합격선과 같아요: 참석률, 평점, 3주 안 재신청, 서로 고른 쌍, 두 번·세 번 만난 쌍, 같은 테이블 요청, Topic → Kindred 전환.

## 앱 구성

**첫 화면은 실제 영상이에요.** Amie 첫 화면처럼 세로 영상이 화면 가득 돌고, 위에 Sidetable 워드마크, 가운데 Charlie의 문장이 장면에 맞춰 타이핑되고, 아래에 Sign in · Join이 있어요. Join을 누르면 밤 유리 같은 시트가 올라와요(초대제 안내, 데모에서는 "Try it as Jordan"). 영상은 25초, 컷 33개예요:

1. 밤의 도시, 빛나는 세포, DNA 홀로그램, 점으로 된 구 (천천히 디졸브) — "Six people who build things, one table, *zero small talk*"
2. 코드가 비친 안경, 피펫, 로봇 눈, 현미경, 뇌 스캔, 칩, VR, 데이터센터… 컷이 점점 빨라지고 위에는 아무 글자도 없어요
3. 흰 플래시 뒤 같이 만드는 사람들: 포스트잇 브레인스토밍, 3D 모델 앞의 두 엔지니어, 플립차트, 로봇을 납땜하는 메이커, 노트북에 모인 팀, 터지는 웃음, 성공한 순간의 하이파이브, 가운데로 모인 손 — "Talk AI, bio and robots until they *stack the chairs*"
4. 맥주 따르기, 미친 듯이 웃는 얼굴들, 병맥주와 샴페인 건배, 촛불 켠 저녁 테이블, 밤의 도시 — "Come for the tech talk, stay for the *friends*"

몽환적인 그레이드(검정을 띄우고, 그림자에 틸·바이올렛, 하이라이트에 살구빛 할레이션, 비네트)는 `art/make-film.js`가 입혀요. 화면에서는 밤 보라빛 셰이드, 위에서 내려오는 안개빛, 필름 그레인이 더해져요. 큰 화면에서는 폰 바깥 방이 영상 색으로 은은하게 물들어요. 자동 재생이 막히면(저전력 모드 등) 첫 프레임과 문장이 그대로 보이고, 화면을 한 번 만지면 시작해요. 움직임 줄이기 설정이면 재생하지 않아요.

그 뒤 앱은 Amie와 같은 부드러운 라이트 톤(로즈 = Harvard, 미스트 블루 = MIT)이에요. 화면 뒤에 사진을 깔지 않고, Amie의 "방"처럼 네 개의 색 안개가 천천히 흘러요. 탭마다 빛이 달라요(This week 살구·로즈, Hangs 라일락·민트, 테이블 촛불빛, People 로즈·라일락, Me 미스트). 테이블 화면의 강도 그림 대신 빛의 띠로 그려요.

```bash
npm run film
```

첫 화면 영상을 다시 만들어요(ffmpeg 필요, 없으면 `winget install Gyan.FFmpeg`, 다른 위치면 `FFMPEG`에 bin 폴더). 장면마다 Mixkit 원본에서 필요한 부분만 읽어 `art/.film`에 캐시하고, `public/video/film.mp4`(약 4.7MB), `public/img/film.jpg`(포스터), 막 시작 시각이 담긴 `public/video/film.json`을 써요. 컷을 바꾸면 `index.html`의 `FILM_T`도 film.json의 acts에 맞춰 고쳐요. 영상은 서버가 바이트 범위로 보내요(아이폰 Safari 필수).

**영상 출처:** 모두 [Mixkit](https://mixkit.co) 무료 라이선스예요(상업적 사용 가능, 출처 표기 불필요, 영상 자체를 따로 재판매하는 것은 불가). 쓴 클립 번호는 `art/make-film.js`에 있어요.

| 탭 | 내용 |
|---|---|
| Tables | **Your tables**: Charlie의 초대장(봉인된 봉투 → 열면 레터프레스 초대장 → 누가 오는지), 내 Hang, **다음 주 계획**: 디너 횟수 1~5회와 가능한 저녁(월~금). Charlie가 테크·소셜(잘 맞을 사람) 테이블을 섞어요. 아직 초대장이 없으면 “Your first tech table” 카드가 세 단계(저녁 고르기 → 일요일 밤 테이블 확정 → 초대장 도착)를 보여줘요 |
| Hangs | 누구나 여는 번개. 소셜(커피, 음식, 산책, 게임, 운동, 코워킹, 문화) 또는 토픽(테크 트랙), "한 시간 뒤 / 오늘 밤 / 내일 / 주말". 카드에서 바로 I’m in, 호스트와 참여자 카드, 단톡방 |
| People | Your people(같이 앉았거나 hang을 함께한 사람, 대화가 열린 사람만), Messages(1:1) |
| Board | Worth reading, Ask, Hot take, Shipped, Event, Roles(테크 롤과 인트로 요청) |
| Me | 프로필, Friend Persona, 테이블 크기(4명 · 6명 · 상관없음), 알림, 쉬기 |

테이블 화면(관심사 칩을 누르면 공유하는 사람끼리 선이 이어져요), 단톡방, Table deck, 다음 날 픽은 일정에서 들어가요.

1:1 채팅이 열리는 경우는 세 가지예요: 테이블 뒤 서로 고름, People에서 서로 Wave, 인트로 수락. Wave도 상대가 다시 Wave 하기 전에는 알려지지 않아요. 서로 Wave 한 두 사람은 같은 밤에 좌석을 잡으면 같은 테이블에 앉아요.

### 가입 첫 단계와 성향 질문

- 학교는 인증한 이메일이 정해요. 첫 단계에서는 이름, **무엇을 공부하는지**(Harvard: Business School, College, Kennedy School, Law, Medical, Public Health, SEAS, PhD, Design, Education / MIT: Sloan, Undergraduate, Engineering, EECS, Science, Media Lab 등), **Class of**(2027~2030, PhD·포닥, 최근 졸업)만 물어요. 지금 기준 가장 최근 MBA 입학 기수는 Class of 2028이에요.
- 디너 종류는 **Tech + social**(기본, 맨 위) → Tech tables only → Mostly social 순서예요.
- 성향의 네 축은 Listen↔Spark, Playful↔Deep, **Easygoing↔Planner**, Ritual↔Adventure예요. “Host”라는 말 때문에 답을 피하지 않게 바꿨고, 페르소나 코드는 글자 대신 단어로 보여줘요.
- 테이블은 여전히 Harvard와 MIT를 섞어요(한쪽이 절반을 넘지 않게). 학교 밖 사람을 받게 되면 이 규칙을 커뮤니티 단위로 넓히면 돼요.

## Tonight’s question: 테이블마다 하는 게임

Sidetable은 사람만 모아주는 앱이 아니에요. 모든 테이블이 그 주에 가장 뜨거운 질문 하나를 두고 편을 갈라 이야기해요. 단톡방 맨 위에 고정된 카드가 단계별로 바뀌어요.

| 언제 | 무엇 |
|---|---|
| 테이블 공개 | Charlie가 **메뉴 3장**을 올려요. 테이블 트랙과 멤버 관심사에 맞춰 고르고, 형식은 서로 달라요: Balance game(A vs B), Hot take(동의·반대), Place your bet(예측), Would you rather. 카드마다 열기(불꽃 1~3), 왜 지금 뜨거운지 한 줄, **읽을거리 1~2개(실제 기사 링크)**가 붙어요. 소셜 테이블과 소셜 hang은 테크 카드 없이 **친해지는 질문**만 받아요(인간관계, 요즘 일상, 작은 고백: “Be honest” 형식 포함). 카드마다 이야기를 꺼내는 후속 질문이 붙고, 소셜 hang은 분위기(커피, 산책, 보드게임, 코워크 등)에 맞는 카드가 먼저 나와요. 같은 사람이 같은 질문을 두 번 받지 않아요 |
| 투표 | 탭 한 번. 누가 어디에 투표했는지 얼굴로 보여요. 전원이 투표하거나 디너 전날 정오가 되면 마감되고, 아무도 안 하면 Charlie가 골라요 |
| 편 고르기 | A 또는 B를 비밀로 골라요. 다른 사람에게는 “6명 중 4명이 골랐어요”만 보여요. **Call the split**: A를 고를 사람 수를 맞히는 미니 게임 |
| 디너 시작 | 결과 공개: 4–2 같은 막대와 각 편의 이름, 정확히 맞힌 사람(“Called it exactly”), 혼자 버틴 사람. Table deck의 2라운드가 이 질문으로 바뀌어요(소수 편이 먼저, 그다음 반대편 논리로 1분씩, 다시 투표) |
| 다음 날 아침 | “토론 뒤 어디에 섰나요?”를 다시 골라요. Charlie가 “Last night Yuna changed their mind. That counts as winning.”을 남겨요 |

단톡방에서는 헤더 아래 **한 줄짜리 바**(상태 + Vote/Pick a side 버튼)만 고정되고, 카드는 탭하면 올라오는 시트에서 봐요. 메시지를 가리지 않아요. Charlie의 가장 최근 게임 메시지에도 같은 버튼이 붙어요.

Tables 탭의 초대장 아래 “Your table is voting…” 알림, 초대장의 P.S., 테이블 화면의 요약 카드가 모두 같은 상태를 보여주고, 누르면 단톡방이 시트가 열린 채로 떠요. 관리자 Tables 화면에서 테이블마다 메뉴와 표, 고른 질문, 편 갈림, 마음을 바꾼 수를 볼 수 있어요.

**Hang도 같은 게임을 해요(“The big question”).** Hang을 올리면 Charlie가 hang 종류(테크 트랙 또는 소셜 분위기)에 맞춘 카드 3장을 hang 단톡방에 올려요. 차이점: 투표는 시작 1시간 전에 마감(최소 20분은 보장)되고, 사람이 계속 들어오니 3명 이상이 모두 투표했을 때만 일찍 마감돼요. 공개는 hang 시작 시각에 돼요. 아직 참여하지 않은 사람은 hang 페이지에서 미리보기만 보고(“Join and you get a say”), 참여하면 투표할 수 있어요. 코드는 테이블과 같은 엔진이에요(`gctx()`가 테이블/hang 차이를 흡수).

**질문 카드 관리:** 카드는 `public/shared.js`의 `CARDS`에 있어요(지금 52장: 테크 17, 친해지는 질문 35). 테크 카드는 1~2주마다 새로 쓰는 걸 권해요. 링크는 2026년 10월 6일에 하나씩 열리는 걸 확인했어요(Axios, Techdirt는 봇 차단이라 브라우저에서만 열려요).

**비용:** 테이블마다 드는 돈은 없어요(카드 고르기는 코드). 매주 새 카드를 Claude로 초안 잡는다면, 뉴스 검색 40번($10/1,000번 → $0.40)과 Claude Opus 5.5 토큰(입력 약 30만 × $4/백만 + 출력 약 3만 × $20/백만 ≈ $1.80)으로 **주당 약 $2–3, 한 달 $10 안팎**이에요. 사람이 링크와 문구를 확인하는 데 주당 15–20분. 다음 단계는 관리자 화면에서 카드를 쓰고 고치는 편집기와 주간 초안 스크립트예요.

## 못 가게 됐을 때: 다른 저녁으로

초대장이나 테이블 화면에서 "I can’t make it"을 누르면 시트가 떠요.

- **Find me another evening:** 앞으로 7일 중 되는 저녁(서버가 보스턴 시간 기준으로 줘요)을 고르면, Charlie가 같은 종류(테크/소셜) 테이블의 빈 의자(최대 6명)를 찾아 바로 새 초대장을 보내요. 차단한 사람과는 안 앉히고, 학교 비율(한 학교가 절반 이하)을 지키고, 테크는 내 트랙 테이블을 먼저 찾아요. 새 테이블 단톡방에는 "○○ pulled up a chair"가 올라가요
- **규칙:** 실제로 빠진 테이블에 대해서만, 테이블당 한 번, 저녁을 하나 이상 골라야 해요. 이미 빠졌거나 다른 자리가 있는 날, 쉬는 중이거나 프로필이 덜 된 사람에게는 의자를 주지 않아요
- **빈자리가 없으면 대기(standby):** Tables 탭에 "Looking for another evening" 카드가 떠요. 그 저녁에 누가 자리를 포기하면 그 의자가 자동으로 대기 1순위에게 가요. 고른 마지막 저녁이 지나면 대기는 저절로 끝나고, 정규 매칭으로 자리가 생겨도 끝나요
- **Just skip this one:** 그냥 이번만 빠져요. 전날 정오가 지났으면 늦은 변경(1점)으로 기록돼요. 빠진 테이블의 주소와 단톡방은 더 이상 안 보여요. 테이블이 세 명 아래로 내려가면 합치거나 닫아요(아래 "장소와 운영")
- 서버: reinvite, chairFits, openChair, fillChair, pruneStandby (server.js), API /api/reinvite, /api/standby-stop

## 한 번으로 끝나지 않게: round two, since last time, your month

테이블 하나가 끝나면 그걸로 끝나는 게 아니라 다음 테이블로 이어지게 만든 장치예요. 친해지려면 같은 사람을 여러 번 만나야 하니까요 (캐주얼 친구까지 약 50시간, 테이블 하나는 3시간).

- **Round two (같은 테이블 다시):** 다음 날 아침 "Round two in two weeks?" 질문에 "Yes, round two" 또는 "Not this time"을 직접 골라요(기본값 없음, 안 고르면 no). 테이블 인원의 60% 이상(4~5명 테이블이면 3명, 6명이면 4명)이 yes면 Charlie가 **같은 요일 2주 뒤**로 바로 예약해요. 장소는 지난번 식당에 자리가 있으면 그대로, 없으면 다른 제휴 식당이에요. yes 한 사람만 앉고, 그날 이미 다른 저녁이 있는 사람은 빠져요. 한 표 남았을 때는 단톡방에 "One more yes"가 올라가요. 예약되면 옛 단톡방에 "Booked"가 올라가고, 새 초대장(봉투에 "Round two")과 새 단톡방(지난번 질문 결과, 마음 바꾼 사람, 새 의자)이 생겨요. Round two도 같은 방식으로 round three로 이어져요
- **빈 의자 두 개:** 돌아온 사람에 최대 2명까지 새 사람을 더해요. 그 주 매칭(publishWeek) 때 그 저녁을 고르고 아직 자리가 남은 사람으로 채워요(학교 비율 유지). 그래서 고정 멤버끼리만 닫히지 않아요
- **같은 얼굴 다시:** 서로 고른 사이(또는 서로 wave)는 같은 저녁을 고르면 같은 종류 테이블로 묶어 같이 앉혀요. 저녁 고르기 화면에서 그 사람들의 얼굴이 그 요일 위에 떠요. 이미 테이블이 있는 저녁은 점선으로 막혀요. 초대장과 테이블 화면에는 "Back together with…"와 "Your second table together"가 붙어요
- **Since last time (다음 테이블까지 한 줄):** 다음 날 아침 "Before your next table, I’ll…" 한 줄(선택, 90자). 내 다음 테이블들의 테이블 화면에 보이고, 그날 정오에 Charlie가 단톡방에 꺼내요. 그다음 아침에 Done 또는 Not yet을 골라요
- **Your October (한 달의 실):** Tables 탭 카드. 이번 달 테이블이 실 위의 구슬(T, S, round는 작은 숫자, hang은 작은 점)로 보이고 누르면 열려요. 몇 명 만났는지, 서로 고른 사람 수, 다음 테이블까지의 한 줄이 같이 보여요
- **Long table (한 달의 마무리):** 매달 마지막 목요일 저녁 7시, 그 달에 테이블에 앉은 사람 모두를 한 긴 테이블로. "I’m in"으로 참석하고, 내가 아는 사람 중 누가 가는지 얼굴로 보여요. 다른 테이블 사람들끼리도 이어지게요
- **규칙:** 서로 차단하거나 신고한 사이는 round two에도 같이 앉지 않아요. 새 날짜가 3일 이상 남았을 때만 예약해요(늦게 온 피드백으로 지난 날짜에 잡히지 않게). 예약 뒤에 들어온 yes도 자리가 있으면 앉아요. 빈 의자는 지난 테이블에 없던 사람에게만 가요(no라고 한 사람은 다시 안 앉혀요). 취소가 이어져 두 명만 남으면 Charlie가 round two를 취소하고 두 단톡방에 알려요(둘만의 저녁은 데이트처럼 보이니까요). 다음 테이블까지의 한 줄은 하나만 열려 있고(가장 최근 테이블 것), 3주가 지나면 사라져요. 한 달은 지난달 long table 다음 날부터 이번 달 long table까지예요(그래서 30일, 31일 디너는 다음 달로 가요)
- 서버: roundTwo, againNudge, fillRounds, setLoose, looseFor, looseNote, monthView, setLong, availView의 pals와 has (server.js), API /api/feedback(again, next, prevDone), /api/long

## 장소와 운영: 식당 예약은 누가, 취소되면 어떻게

**앱이 식당 예약 시스템에 직접 예약하지 않아요.** OpenTable, Resy, Tock, SevenRooms 모두 외부 앱이 쓸 수 있는 공개 예약 API가 없고(제휴 심사 후 일부만), 몰래 복제한 예약은 취소·차단 대상이에요. 그래서 Timeleft처럼 **제휴 식당이 정해진 저녁에 테이블 몇 개를 Sidetable용으로 잡아두고**, 앱은 그 자리를 채우고 알리는 일을 해요.

**식당 쪽 (관리자 Places 탭)**
- **등록:** 이름, 주소, 동네, 잡아둘 요일, 저녁당 테이블 수, 테이블당 최대 인원, 메일, 담당자, 전화, 휴무일, 회원에게 보일 메모, 계약 조건(그쪽 말 그대로)
- **두 방식:** 기본은 **상시 확보(standing hold)**: 잡아둔 자리는 식당이 "못 해요"라고 할 때만 빠져요. 저녁마다 확인받고 싶은 식당은 **매번 확인(confirms each evening)**: 확인 전까지 회원에게 주소가 안 보이고, 마감(이틀 전 정오, 늦게 잡힌 건 전날 아침 10시)이 지나면 재알림과 당번 알림이 가요
- **백업 식당:** 맨 마지막에 쓰고, 필요할 때만 연락해요
- **자동 배치:** 초대장이 나갈 때(publish, publishWeek, round two, 다른 저녁 찾기) 그 저녁에 자리가 남은 제휴 식당에 넣어요. 같은 동네 먼저, 덜 붐비는 곳 먼저, round two는 지난번 식당 먼저, 백업은 마지막. 식당이 못 한다고 한 날과 휴무일에는 안 넣어요
- **식당이 받는 메일:** 일요일 밤 10시 **주간 계획**(저녁별 필요한 테이블, 안 쓰는 저녁은 "release 해주세요"), 그 뒤 새로 잡힌 저녁은 따로 알림, **전날 정오 최종 인원**(테이블별 인원, 시간, 식단 메모, 캡틴 이름), 그 뒤 바뀌면 **업데이트**, 저녁이 비면 **release** 메일. 이름이나 프로필은 절대 안 가요(캡틴 이름만)
- **식당 전용 페이지** `/place?k=…`: 로그인 없이 앞으로 3주 저녁별 인원과 상태를 보고 "Confirm" 또는 "We can’t host this one"을 눌러요. 관리자는 링크 복사와 새 링크 발급(옛 링크 무효)을 할 수 있어요
- **식당이 못 한다고 하면:** 그 저녁 테이블을 다른 제휴 식당으로 옮겨요. 주소가 이미 공개된 뒤면 단톡방과 알림으로 바뀐 곳을 알려요. 옮길 곳이 없으면 당번에게 알림이 가고, 당번은 직접 장소를 넣거나 **Call it off**로 테이블을 닫아요(그 사람들은 다음 주 우선순위 + 다른 저녁 찾기). 확정해 놓고 이틀 안에 취소한 게 90일에 두 번이면 "이 식당과 이야기할 때" 알림이 떠요

**회원 쪽 규칙**
- **무료 변경은 전날 정오까지**(식당에 최종 인원이 가는 시점). 전날 아침 9시에 "내일 저녁이에요, 못 가면 정오까지 알려주세요" 알림이 가요. 초대장과 테이블 화면에 "Free to change until …"이 보여요
- **늦은 변경:** 그 뒤 취소는 1점(실제로 테이블에 앉아 있던 경우만. 마감 뒤에 빈자리를 받은 사람은 3시간 안에 돌려주면 무료), 관리자가 표시한 노쇼는 2점(다음 날 아침 못 갔다고 직접 말했으면 1점). 60일 안에 3점이면 2주 동안 초대가 쉬어요(Hang과 특별한 밤 예약도 쉬어요). 쉬는 기간이 끝나면 점수는 새로 시작해요. 다음 날 아침 "I couldn’t go"라고 말한 것만으로는 점수가 아니에요. 관리자 출석 표시는 came / no-show / 비움 세 가지이고, no-show를 지우면 그 때문에 걸린 쉼도 풀려요. 카드 결제를 붙이면 점수 대신 소액 수수료(보스턴 식당 노쇼 수수료는 보통 1인 $15~25)로 바꿀 수 있어요
- **사람이 빠지면:** 한 명은 그냥 한 자리 작아져요(대기자가 있으면 채워요). 세 명 아래로 내려가면 그날 다른 테이블에 자리가 있으면 합치고(같은 식당 먼저), 없으면 테이블을 닫아요. 둘만 남은 저녁은 데이트처럼 보이니까요. 닫힌 테이블 사람들은 다음 주 우선, Tables에서 바로 "Find me another evening"
- **캡틴:** 테이블마다 한 명이 5분 먼저 와서 문 앞에서 "Sidetable, party of 5"라고 말하고, 따로 계산을 부탁하고, 다들 앉으면 덱을 열어요. 최근에 안 한 사람부터 돌아가며 맡고, "Happy to"라고 한 사람 먼저, "Rather not"은 제외(Me에서 설정). 두 시간 전까지 "Pass it on"으로 넘길 수 있어요. 당일 정오에 단톡방에 이름이 올라가고, 식당에는 캡틴 이름만 가요

**운영팀 (관리자 Ops 탭)**
- 처음엔 창업자(ops lead) + 캠퍼스 리드 1~2명. 하루 한 명씩 **당번**을 돌아가며 맡아요(요일별 rota)
- 당번은 알림을 메일로 받아요: 자리 없는 테이블, 답 없는 식당, 당일 바뀐 테이블(합침, 닫힘), 주소 공개 시각에 확정 안 된 자리, 자꾸 취소하는 식당. Ops 탭에서 처리하고 Done
- 제휴 계약, 일요일 공개, Long table 예약은 ops lead 몫이에요

**Long table:** 장소는 사람이 6~8주 전에 직접 예약해요(근처 프라이빗 룸은 평일 최소 주문액이 보통 $2,500~6,500이고 인원 확정이 1주 전쯤). 관리자가 장소, 좌석 수, 비용 안내("$35 at the door" 또는 "Hosted by ○○")를 넣으면 회원 카드에 보여요. 좌석이 차면 대기줄, RSVP는 5일 전 정오에 마감(그때 인원을 장소에 보내요). 마감 뒤에도 못 온다고 하면 대기 1번이 자리를 받아요

- 서버: placeTable, savePlace, syncBooking, placeAnswer, placeMail, placeView, placesAdmin, shrink, closeTable, callOff, lateChanges, coolCheck, pickCaptain, captainMove, captainNote, alertOps, saveOps, setLong, promoteLong (server.js), 페이지 public/place.html, API /api/place, /api/captain, /api/captain-pref, /api/seen, /api/admin/place*, /api/admin/table-off, /api/admin/ops, /api/admin/alert-done

## Board: 정보 공유 게시판

하단 탭은 Tables, Hangs, **Board**, People, Me예요. Board는 Harvard와 MIT 사람들이 올리는 게시판이에요.

- 화면은 흰 배경에 목록 하나예요(위에 글쓰기 칸, 종류 탭 한 줄). 정보가 많아 보이지 않게 카드 색, 트랙 필터, 소개 문구는 뺐어요
- 글 종류 다섯 가지: Worth reading(읽을거리 링크), Ask(공동창업자, 베타 유저, 소개 요청), Hot take(동의/반대 투표), Shipped(출시, 투자 마감), Event(보스턴의 토크, 데모 나이트, 밋업). 종류와 트랙으로 걸러 볼 수 있어요
- 테이크는 Agree/Disagree 버튼, 모든 글에 하트. 글을 누르면 댓글을 보고 달 수 있어요. 내 글은 지울 수 있어요
- 예전 People의 Roles(채용 공고, 소개 요청)는 Board의 Roles 탭으로 옮겼어요
- 서버는 기존 Pulse API를 그대로 써요(/api/pulse, /api/post, /api/vote, /api/plus, /api/reply, /api/post-delete). 종류는 shared.js의 POSTS

People은 **회원 명부가 아니에요.** 같이 테이블이나 hang에 앉았던 사람, 또는 대화가 열린 사람(서로 고른 사람, 서로 wave, 소개)만 “Your people”에 나와요. 서버도 그 사람들만 보내요(/api/people). 모르는 사람은 테이블과 hang에서 Charlie가 소개해 줘요. 탭은 People과 Messages 두 개예요.

## 테이블 짜는 규칙

코드: [server/tables.js](server/tables.js) (입출력 없는 순수 함수, 테스트 14개)

- **지키는 것:** 4~6명, 두 학교 이상, 한 학교가 절반을 넘지 않음, 서로 차단한 사람은 같이 안 앉힘
- **강하게 피하는 것:** 이미 같이 앉았던 사람(재회 제외). 매주 같은 트랙이 만나면 일부는 피할 수 없어서, 최소로 줄이고 관리자에게 경고로 보여줘요
- **점수:** Topic은 주제 60 : 사람 40, Kindred는 주제 20 : 사람 80. 세부는 CONCEPT.md
- 사람이 모자란 트랙은 가까운 트랙과 합치고, 학교 비율 때문에 못 앉는 사람은 대기자로 가요. 대기했던 사람은 다음 밤에 먼저 앉아요
- 같은 seed면 같은 결과예요. 관리자 화면에서 seed를 바꾸면 다른 배치를 볼 수 있어요

## 배포 (Railway, Amie와 같은 방식)

```bash
npm install -g @railway/cli
```

이 폴더에서 `railway login`, `railway init`, `railway up`, `railway domain`. Railway 대시보드에서:
- Volume을 `/data`에 붙여요
- `SIXTOP_ADMIN_KEY`, `SIXTOP_DATA_DIR=/data`, `SIXTOP_PUBLIC_URL=https://(받은 도메인)`을 넣어요

푸시 알림은 HTTPS에서만 돼요. 아이폰은 홈 화면에 추가한 뒤에 켤 수 있어요(앱 안내 문구 있음).

## 데이터와 개인정보

- 데이터 폴더에 이름, 학교 이메일, 사진, 생활 단계(결혼, 부모 등)가 있어요. **비공개로 두고, 파일럿 뒤에 지우세요.**
- 생활 단계는 매칭에만 쓰고, 테이블에는 "보스턴에 새로 옴", "유학생", "졸업 후에도 보스턴"만 두 명 이상일 때 숫자로 말해요.
- **모든 회원은 Harvard 또는 MIT 이메일(harvard.edu, hbs.edu, mit.edu와 그 하위 도메인, 예: college.harvard.edu)을 6자리 코드로 인증해요.** 클럽 링크 가입, 관리자 개인 초대, 새 폰에서 다시 로그인 모두 같은 방식이에요. 인증 전에는 아무 기능도 쓸 수 없고, 학교는 인증된 이메일을 따라가요.
- **프로필 사진은 필수예요.** 사진은 인증을 마친 Harvard·MIT 회원에게만 보여요(테이블, Hang, People 카드). 서로 차단한 사람에게는 안 보여요. 다음 날 픽은 서로 골랐을 때만 알려줘요.
- 데모 회원 40명의 얼굴은 Amie 프로젝트에서 AI로 만든 초상화예요(실제 인물 아님). `scripts/make-faces.ps1`이 `scripts/faces.js`를 만들어요.
- 회원이 "Delete my account"를 누르면 사진과 프로필이 지워지고 링크가 멈춰요.

## 아직 없는 것

| 항목 | 지금 | 다음 단계 |
|---|---|---|
| 학교 이메일 인증 | 6자리 코드, Resend로 발송 (코드 테스트는 끝났지만 실제 발송은 키를 넣고 확인 필요) | 보내는 도메인 인증(SPF, DKIM) |
| 늦은 변경 수수료 | 점수제(늦은 취소 1점, 노쇼 2점, 60일 3점이면 2주 쉼) | Stripe 카드 등록 후 1인 $15 정도, 가입 때 미리 고지(매사추세츠 수수료 고지 규정) |
| 로그인 | 개인 링크 또는 학교 이메일 코드 | 링크를 잃어도 학교 이메일로 다시 로그인해요 |
| Long table 결제 | 비용 안내 문구만 | 선결제 좌석(최소 주문액을 70% 참석 기준으로 나눠 가격 책정) 또는 후원 |
| 식당 예약 시스템 연동 | 제휴 메일, 식당 전용 페이지, 전화 | 규모가 커지면 OpenTable·Resy 공식 제휴 신청 (222가 이 방식) |

## 파일

```
server/server.js   API, 관리자 API, 저장, 알림, 정적 파일
server/tables.js   테이블 짜기 (점수, 규칙, Charlie의 "왜 이 사람들")
server/push.js     웹 푸시 (Amie 베타에서 가져옴)
public/index.html  회원 앱 (가입, 온보딩, 이번 주, 번개, 테이블, 단톡방, 다음 날, 사람들, 나)
public/admin.html  관리자 페이지
public/shared.js   앱과 서버가 같이 쓰는 질문, 트랙, 페르소나
public/app.css     프로토타입과 같은 디자인 (Amie C), 첫 화면 영상, 방(aura)
public/video/      첫 화면 영상 (npm run film)
art/make-film.js   첫 화면 영상 만들기 (Mixkit 원본 → 세로 컷, 그레이드, 편집)
scripts/seed.js    데모 데이터 (실제 데이터에 쓰지 마세요)
scripts/dev.js     로컬 개발용 실행
scripts/build-demo.js  폰 데모 한 파일 (dist/sixtop-demo.html + dist/video/film.mp4, 아티팩트에 같이 올려요)
test/              npm test
```
