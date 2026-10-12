# Sidetable 앱

> 화면에 보이는 이름은 Sidetable (2026-10-06, Sixtop → Tech Table → Sidetable). 코드 폴더(sixtop/), 저장소 키(sixtopToken), 환경 변수(SIXTOP_*)는 예전 이름 그대로

Harvard와 MIT 파일럿에서 실제로 쓰는 앱. Amie 베타와 같은 구조로, 외부 패키지 없는 Node 파일 하나와 데이터용 JSON 파일 하나로 동작

- Harvard는 HBS뿐 아니라 College, Kennedy School, Law, Medical, SEAS 등 모든 학교 가입 가능
- 학교는 "커뮤니티" 데이터로 관리. 나중에 학교 밖 사람을 받을 때는 `public/shared.js`의 `SCHOOLS`에 항목과 이메일 도메인만 추가
- 기획은 [../CONCEPT.md](../CONCEPT.md), 사업 검토는 [../BUSINESS.md](../BUSINESS.md), 초기 클릭 프로토타입은 [../sixtop.html](../sixtop.html)

## 로컬에서 실행

```bash
npm run seed
```

```bash
npm run dev
```

- `seed`: 샘플 회원 40명(Harvard 20, MIT 20)과 테이블을 만들고 Jordan으로 들어가는 링크 출력
  - 일주일 전 테크 디너: 다음 날 픽, 서로 고른 두 사람과의 1:1 채팅까지 끝난 상태. 같은 테이블의 round two도 예약 완료
  - 이번 주: Jordan 앞으로 봉인된 초대장 두 장(테크 하나, 소셜 하나). 테크 테이블 캡틴은 Jordan
  - 다음 주: 34명이 가능한 저녁과 디너 횟수(1~5)를 이미 표시한 상태라 관리자 화면에서 바로 Build 가능
  - 그 밖에 Hang 6개(소셜 3, 토픽 3)와 질문 카드 투표, Board 글, 이번 달 Long table 신청 15명, 가상의 제휴 식당 4곳
- `dev`: 관리자 키를 `local-admin`으로 고정하고, 학교 이메일 인증 코드를 메일 대신 화면에 표시(`SIXTOP_MAIL=show`). **실제 파일럿에는 사용 금지**
- 앱은 <http://localhost:8800>, 관리자 페이지는 <http://localhost:8800/admin>
- 폰 데모(`npm run demo`)에서는 일요일 밤을 기다리지 않고, 저녁을 고르는 즉시 다음 주 테이블과 초대장 생성. 실제 앱에서는 그 자리에 "On its way, sealed until Sunday night" 봉투 표시

## 실제 파일럿 실행

```bash
SIXTOP_ADMIN_KEY=choose-a-long-secret SIXTOP_PUBLIC_URL=https://your-domain npm start
```

| 환경 변수 | 기본값 | 설명 |
|---|---|---|
| `SIXTOP_ADMIN_KEY` | 실행마다 랜덤(로그에 출력) | 관리자 페이지 키, 길고 복잡하게 |
| `PORT` | 8800 | 포트, Railway 같은 곳에서는 자동 지정 |
| `SIXTOP_DATA_DIR` | `./data` | 회원, 테이블, 채팅, 사진 저장 위치. **반드시 영구 디스크에** |
| `SIXTOP_PUBLIC_URL` | 없음 | 초대 링크, 클럽 링크, 식당 링크의 기본 주소 |
| `SIXTOP_TZ` | `America/New_York` | 마감, 장소 공개, 다음 날 질문 시각의 기준 시간대 |
| `SIXTOP_AREA` | `Central Square` | 새로 여는 밤의 기본 동네 |
| `RESEND_API_KEY`, `SIXTOP_MAIL_FROM` | 없음 | 인증 코드와 식당 메일을 보내는 [Resend](https://resend.com) 키와 보내는 주소(예: `Sidetable <hello@your-domain>`). **없으면 아무도 가입 불가** |
| `SIXTOP_MAIL` | 없음 | `show`면 코드를 메일 대신 화면에 표시. 로컬 개발과 폰 데모 전용 |
| `SIXTOP_AUTO_WEEK` | 없음 | `1`이면 일요일 20시에 다음 주 테이블 자동 구성과 공개 |
| `SIXTOP_LONG_TIME` | `19:00` | Long table 시작 시각 |
| `SIXTOP_PUSH_DAY` | 4 | 한 사람이 하루에 받는 알림 최대 개수 |
| `SIXTOP_VAPID_PUBLIC`, `SIXTOP_VAPID_PRIVATE` | 처음 한 번 만들어 데이터 폴더에 저장 | 푸시 알림 키. 바뀌면 모든 회원이 알림을 다시 켜야 하니 주의 |

## 한 주 운영 흐름 (관리자 페이지)

관리자 탭: Tables, Places, Ops, Pop-ups, People, Roles, Links, Reports

| 언제 | 내용 |
|---|---|
| 처음 한 번 | **Links** 탭에서 클럽별 가입 링크를 만들어 클럽 채널에 공유. 개인 초대는 **People**, 제휴 식당은 **Places**, 운영팀과 당번은 **Ops** 탭에서 |
| 일요일 18:00까지 | 회원이 Tables 탭에서 다음 주 디너 횟수(1~5)와 가능한 저녁(월~금) 선택 |
| 일요일 저녁 | **Tables** 탭의 **Build the tables**로 저녁별 테크, 소셜 테이블 구성(사람 많은 저녁부터, 하루 한 번, 각자 고른 횟수까지). 확인 후 **Publish the week**. 테이블마다 제휴 식당과 캡틴 자동 배정. `SIXTOP_AUTO_WEEK=1`이면 20시에 자동 진행 |
| 일요일 22:00 | 제휴 식당마다 그 주 계획 메일 발송(필요한 저녁, 비워도 되는 저녁) |
| 공개 직후 | 회원 앱에 초대장과 단톡방 오픈. Charlie가 "왜 이 사람들인지"와 그 주 질문 메뉴를 단톡방에 게시 |
| 전날 09:00 | 회원에게 "정오까지 알려주면 무료 변경" 알림 |
| 전날 정오 | 무료 변경 마감. 식당에 최종 인원(테이블별 인원, 식단, 캡틴 이름) 발송, 이후 변동은 업데이트 메일로 |
| 당일 정오 | 식당 주소 공개와 회원 알림('매번 확인' 식당은 확인을 마친 경우에만 공개, 미확인 시 당번에게 알림). 단톡방에 캡틴 이름과 "Since last time" 게시 |
| 당일 저녁 | 회원은 Table deck(3라운드)으로 진행. 관리자는 "Send to all tables"로 모든 테이블에 Charlie 메시지 발송 가능 |
| 다음 날 10:00 | "How was the table?" 알림: 참석 여부, 평점, 다시 보고 싶은 사람, round two 여부, 다음 테이블까지의 한 줄 |
| 그 뒤 | 서로 고른 사람끼리 1:1 채팅 오픈, 두 달 안에 같은 저녁을 고르면 같은 테이블로 배정. 관리자는 출석을 came / no-show로 표시 |

**특별한 밤(선택):** 주간 흐름과 별개로 Tables 탭의 "A special night"에서 날짜와 동네를 정해 좌석 신청 오픈. 행사 3일 전 23:59 신청 마감, 이후 **Draft tables**로 테이블 확인과 조정, 그다음 **Publish**

관리자 맨 위 숫자는 BUSINESS.md 합격선과 같은 지표: 참석률, 평점, 3주 안 재신청, 서로 고른 쌍, 두 번째와 세 번째 만남, round two 예약, Long table 신청 등

## 화면 구성

**첫 화면은 실제 영상.** Amie 첫 화면처럼 세로 영상이 화면 가득 돌아가고, 위에는 Sidetable 워드마크, 가운데에는 장면에 맞춰 타이핑되는 Charlie의 문장, 아래에는 Sign in과 Join. Join을 누르면 초대제 안내 시트(데모에서는 "Try it as Jordan")가 올라오는 구성. 영상 길이 25초, 컷 33개:

1. 밤의 도시, 빛나는 세포, DNA 홀로그램, 점으로 된 구가 천천히 이어지는 장면 — "Six people who build things, one table, *zero small talk*"
2. 코드가 비친 안경, 피펫, 로봇 눈, 현미경, 뇌 스캔, 칩, VR, 데이터센터. 컷이 점점 빨라지고 글자는 없음
3. 흰 플래시 뒤 함께 만드는 사람들: 포스트잇 브레인스토밍, 3D 모델 앞의 두 엔지니어, 로봇을 납땜하는 메이커, 노트북 앞에 모인 팀, 터지는 웃음, 하이파이브, 가운데로 모인 손 — "Talk AI, bio and robots until they *stack the chairs*"
4. 맥주 따르기, 크게 웃는 얼굴들, 건배, 촛불 켠 저녁 테이블, 밤의 도시 — "Come for the tech talk, stay for the *friends*"

- 몽환적인 색감(살짝 띄운 검정, 그림자의 틸과 바이올렛, 하이라이트의 살구빛 번짐, 비네트)은 `art/make-film.js`에서 처리. 영상 위에 보랏빛 밤 그림자, 상단에서 내려오는 안개빛, 필름 그레인 추가
- 큰 화면에서는 폰 바깥 배경까지 영상 색으로 은은하게 물드는 연출
- 자동 재생이 막힌 경우(저전력 모드 등) 첫 프레임과 문장을 그대로 보여주고 한 번 터치하면 재생. 움직임 줄이기 설정이면 재생 생략

앱 본문은 Amie와 같은 부드러운 라이트 톤(로즈는 Harvard, 미스트 블루는 MIT). 화면 뒤에는 사진 대신 네 가지 색 안개가 천천히 흐르는 Amie의 "방" 구성이고, 탭마다 빛의 색이 다름(Hangs 라일락과 민트, 테이블 촛불빛, People 로즈와 라일락, Me 미스트). Tables 탭과 테크 테이블 화면은 첫 화면 영상의 스틸 여섯 장이 파스텔 톤 아래에서 천천히 바뀌는 배경, Board는 흰 바탕에 위쪽만 파스텔

```bash
npm run film
```

첫 화면 영상 다시 만들기(ffmpeg 필요, 없으면 `winget install Gyan.FFmpeg`, 다른 위치에 있으면 `FFMPEG`에 bin 폴더 지정)

- 장면마다 Mixkit 원본에서 필요한 부분만 받아 `art/.film`에 캐시하고, `public/video/film.mp4`(약 4.7MB), `public/img/film.jpg`(포스터), 막별 시작 시각을 담은 `public/video/film.json` 생성
- 컷을 바꾸면 `index.html`의 `FILM_T`도 film.json의 acts에 맞춰 수정 필요
- 영상은 서버가 바이트 범위로 전송(아이폰 Safari에서 필수)
- **영상 출처:** 모두 [Mixkit](https://mixkit.co) 무료 라이선스(상업적 사용 가능, 출처 표기 불필요, 영상 자체의 재판매만 불가). 사용한 클립 번호는 `art/make-film.js`에

| 탭 | 내용 |
|---|---|
| Tables | Charlie의 초대장(봉인된 봉투 → 열면 초대장 → 누가 오는지), 내 Hang, 이번 달 카드(Your October), 다음 주 계획(디너 횟수 1~5, 가능한 저녁). 초대장이 아직 없으면 "Your first tech table" 카드로 세 단계 안내 |
| Hangs | 누구나 여는 번개. 소셜(커피, 음식, 산책, 게임, 운동, 코워킹, 문화) 또는 토픽(테크 트랙), 시간은 "한 시간 뒤, 오늘 밤, 내일, 주말". 카드에서 바로 I’m in, 호스트와 참여자 카드, 단톡방 |
| Board | Worth reading, Ask, Hot take, Shipped, Event, Roles(테크 채용과 소개 요청) |
| People | Your people(같이 앉았거나 hang을 함께한 사람, 대화가 열린 사람만), Messages(1:1) |
| Me | 프로필, Friend Persona, 테이블 크기(4명, 6명, 상관없음), 캡틴 설정, 알림, 쉬기 |

- 테이블 화면에서 관심사 칩을 누르면 그 관심사를 가진 사람에게 금색 테두리 표시. 단톡방, Table deck, 다음 날 픽은 초대장과 테이블 화면에서 진입
- 1:1 채팅이 열리는 경우는 세 가지: 디너 뒤 서로 고른 경우, People에서 서로 Wave, 소개 요청 수락. Wave는 상대도 Wave 하기 전까지 비공개
- 서로 Wave 한 두 사람은 같은 저녁을 고르면 같은 테이블로 배정

### 가입과 성향 질문

- 학교는 인증한 이메일 기준. 첫 단계 질문은 이름, **소속 학교와 과정**(Harvard: Business School, College, Kennedy School, Law, Medical, Public Health, SEAS, PhD, Design, Education / MIT: Sloan, Undergraduate, Engineering, EECS, Science, Media Lab 등), **Class of**(2027~2030, PhD와 포닥, 최근 졸업)뿐. 현재 가장 최근 MBA 입학 기수는 Class of 2028
- 디너 종류 선택지 순서: **Tech + social**(기본) → Tech tables only → Mostly social
- 성향 네 축: Listen↔Spark, Playful↔Deep, **Easygoing↔Planner**, Ritual↔Adventure. "Host"라는 단어 때문에 답을 피하는 일이 없도록 Easygoing↔Planner로 변경, 페르소나 코드도 글자 대신 단어로 표시
- 테이블은 Harvard와 MIT를 반반 섞는 원칙(한쪽이 절반을 넘지 않게). 학교 밖 사람을 받을 때는 이 규칙을 커뮤니티 단위로 확장

## Tonight’s question: 테이블마다 하는 게임

사람만 모아주는 데서 끝나지 않고, 테이블마다 그 주에 가장 뜨거운 질문 하나로 편을 갈라 이야기하는 장치. 단톡방 맨 위 고정 카드가 단계별로 바뀌는 흐름

| 언제 | 내용 |
|---|---|
| 테이블 공개 | Charlie가 **메뉴 3장** 게시. 테이블 트랙과 멤버 관심사에 맞춘, 형식이 서로 다른 세 장: Balance game(A vs B), Hot take(동의, 반대), Place your bet(예측), Would you rather, Be honest. 카드마다 열기(불꽃 1~3), 지금 뜨거운 이유 한 줄, 실제 기사 링크 1~2개 |
| 투표 | 탭 한 번, 누가 어디에 투표했는지 얼굴로 표시. 전원이 투표하거나 디너 전날 정오가 되면 마감, 아무도 안 하면 Charlie가 선택 |
| 편 고르기 | A 또는 B를 비밀로 선택. 다른 사람에게는 "4 of 6 picked a side"처럼 인원만 표시. **Call the split**: A를 고를 사람 수를 맞히는 미니 게임 |
| 디너 시작 | 결과 공개: 4–2 같은 막대와 편별 이름, 정확히 맞힌 사람("Called it exactly"), 혼자 버틴 사람. Table deck 2라운드가 이 질문으로 바뀌는 구성(소수 편부터, 그다음 반대편 논리로 1분씩, 다시 투표) |
| 다음 날 아침 | 토론 뒤의 입장을 다시 선택. 마음을 바꾼 사람이 있으면 Charlie가 "That counts as winning."으로 마무리 |

- 소셜 테이블과 소셜 hang은 테크 카드 없이 친해지는 질문(인간관계, 요즘 일상, 작은 고백)만. 소셜 hang은 분위기(커피, 산책, 보드게임, 코워크 등)에 맞는 카드 우선. 한 사람에게 같은 질문이 두 번 나오지 않도록 조정
- 테이블 화면에는 긴 질문 대신 키워드 칩 표시
- 단톡방에는 헤더 아래 **한 줄짜리 바**(상태 + Vote 또는 Pick a side 버튼)만 고정되고, 카드는 탭하면 올라오는 시트에서 확인. 메시지를 가리지 않는 배치. Charlie의 가장 최근 게임 메시지에도 같은 버튼
- Tables 탭의 "Your table is voting…" 알림, 초대장의 P.S., 테이블 화면의 요약 카드가 모두 같은 상태를 보여주고, 누르면 시트가 열린 채로 단톡방 진입
- 관리자 Tables 화면에서 테이블별 메뉴와 득표, 고른 질문, 편 갈림, 마음을 바꾼 사람 수 확인 가능

**Hang도 같은 게임("The big question").** Hang을 올리면 Charlie가 hang 종류(테크 트랙 또는 소셜 분위기)에 맞춘 카드 3장을 hang 단톡방에 게시

- 투표는 시작 1시간 전 마감(투표 시간은 최소 20분 보장). 중간에 들어오는 사람이 많아, 참여자가 3명 이상이고 전원이 투표한 경우에만 조기 마감
- 결과 공개는 hang 시작 시각
- 아직 참여하지 않은 사람은 hang 페이지에서 미리보기만("Join and you get a say"), 참여하면 투표 가능
- 테이블과 같은 엔진(`gctx()`가 테이블과 hang의 차이를 흡수)

**질문 카드 관리:** 카드는 `public/shared.js`의 `CARDS`에 65장(테크 17, 친해지는 질문 48). 테크 카드는 1~2주마다 교체 권장. 링크는 2026-10-06 기준으로 하나씩 열어 확인(Axios, Techdirt는 봇 차단 때문에 브라우저에서만 열림)

**비용:** 테이블당 추가 비용 없음(카드 선택은 코드로 처리). 매주 새 카드 초안을 Claude로 만든다면 뉴스 검색 40번($10/1,000번, 약 $0.40)과 Claude Opus 5.5 토큰(입력 약 30만 × $4/백만 + 출력 약 3만 × $20/백만, 약 $1.80)으로 **주당 약 $2~3, 한 달 $10 안팎**. 사람이 링크와 문구를 확인하는 데 주당 15~20분. 다음 단계는 관리자 화면의 카드 편집기와 주간 초안 스크립트

## 못 가게 됐을 때: 다른 저녁으로

초대장이나 테이블 화면의 "I can’t make it"에서 시트로 진행

- **Find me another evening:** 앞으로 7일 중 가능한 저녁(보스턴 시간 기준)을 고르면, Charlie가 같은 종류(테크 또는 소셜) 테이블의 빈 의자(정원 6명)를 찾아 바로 새 초대장 발송. 배정 조건은 차단한 사람 제외, 학교 비율(한 학교가 절반 이하) 유지, 테크는 내 트랙 테이블 우선. 새 테이블 단톡방에는 "○○ pulled up a chair" 게시
- **조건:** 실제로 빠진 테이블에 한해 테이블당 한 번, 저녁은 하나 이상 선택. 이미 다른 테이블이 잡힌 날은 선택 불가, 쉬는 중이거나 프로필을 다 채우지 않은 사람도 제외
- **빈자리가 없으면 대기(standby):** Tables 탭에 "Looking for another evening" 카드 표시. 그 저녁에 누가 자리를 포기하면 대기 1순위에게 자동 배정. 고른 마지막 저녁이 지나거나 정규 매칭으로 자리가 생기면 대기 종료
- **Just skip this one:** 이번 한 번만 빠지기. 전날 정오가 지났으면 늦은 변경(1점)으로 기록. 빠진 테이블의 주소와 단톡방은 더 이상 볼 수 없음. 테이블이 세 명 아래로 줄면 다른 테이블과 합치거나 종료(아래 "장소와 운영")
- 서버: reinvite, chairFits, openChair, fillChair, pruneStandby (server.js), API /api/reinvite, /api/standby-stop

## 한 번으로 끝나지 않게: round two, since last time, your month

테이블 하나로 끝나지 않고 다음 테이블로 이어지게 하는 장치. 친해지려면 같은 사람을 여러 번 만나야 하기 때문(가벼운 친구가 되기까지 약 50시간, 테이블 하나는 3시간)

- **Round two (같은 테이블 다시):** 다음 날 아침 "Round two in two weeks?"에 "Yes, round two" 또는 "Not this time"을 직접 선택(기본값 없이, 고르지 않으면 no)
  - 테이블 인원의 60% 이상(4~5명 테이블은 3명, 6명 테이블은 4명)이 yes면 **같은 요일 2주 뒤**로 바로 예약
  - 장소는 지난번 식당에 자리가 있으면 그대로, 없으면 다른 제휴 식당
  - yes 한 사람만 자리 배정, 그날 이미 다른 저녁이 있는 사람은 제외
  - 한 표가 모자랄 때는 단톡방에 "One more yes" 게시. 예약되면 기존 단톡방에 "Booked", 새 초대장(봉투에 "Round two")과 새 단톡방(지난번 질문 결과, 마음을 바꾼 사람, 새로 온 사람) 생성
  - round two에서도 같은 방식으로 round three
- **빈 의자 두 개:** 돌아온 사람 외에 새 사람 최대 2명. 그 주 매칭(publishWeek) 때 그 저녁을 골랐고 디너 횟수가 남은 사람으로 채우되 학교 비율은 유지. 고정 멤버끼리 닫힌 모임이 되지 않게 하려는 장치
- **같은 얼굴 다시:** 서로 고른 사이(또는 서로 wave 한 사이)는 같은 저녁을 고르면 같은 종류 테이블로 묶어 배정. 저녁 고르기 화면에서 그 사람들의 얼굴이 해당 요일 위에 표시되고, 이미 테이블이 있는 저녁은 점선으로 비활성화. 초대장과 테이블 화면에는 "Back together with…", "Your second table together" 표시
- **Since last time (다음 테이블까지 한 줄):** 다음 날 아침 "Before your next table, I’ll…" 한 줄 작성(선택, 90자). 내 다음 테이블 화면에 보이고, 그날 정오에 Charlie가 단톡방에서 언급. 그다음 날 아침 Done 또는 Not yet 선택
- **Your October (한 달의 실):** Tables 탭 카드. 이번 달 테이블이 실 위의 구슬로 표시되고(T, S, round는 작은 숫자, hang은 작은 점) 누르면 해당 테이블로 이동. 만난 사람 수, 서로 고른 사람 수, 다음 테이블까지의 한 줄도 함께
- **Long table (한 달의 마무리):** 매달 마지막 목요일 저녁 7시, 그 달 테이블에 앉았던 사람 모두가 긴 테이블 하나에 모이는 저녁. "I’m in"으로 참석, 아는 사람 중 누가 가는지 얼굴로 표시. 다른 테이블 사람들끼리도 이어주는 자리
- **세부 규칙**
  - 서로 차단하거나 신고한 사이는 round two에서도 같은 테이블 배정 없음
  - 새 날짜가 3일 이상 남았을 때만 예약(늦게 들어온 피드백으로 지난 날짜가 잡히지 않도록)
  - 예약 뒤에 들어온 yes도 자리가 있으면 배정
  - 빈 의자는 지난 테이블에 없던 사람에게만(no라고 한 사람은 다시 배정하지 않음)
  - 취소가 이어져 두 명만 남으면 round two 취소, 기존 단톡방과 새 단톡방 모두에 안내(둘만의 저녁은 데이트처럼 보일 수 있어서)
  - 다음 테이블까지의 한 줄은 가장 최근 테이블에서 쓴 한 줄만 유지, 3주 뒤 자동 소멸
  - 한 달의 기준은 지난달 Long table 다음 날부터 이번 달 Long table까지(그래서 30일, 31일 디너는 다음 달로)
- 서버: roundTwo, againNudge, fillRounds, setLoose, looseFor, looseNote, monthView, setLong, availView의 pals와 has (server.js), API /api/feedback(again, next, prevDone), /api/long

## 장소와 운영: 식당 예약과 취소 처리

**앱이 식당 예약 시스템으로 직접 예약하지 않는 구조.** OpenTable, Resy, Tock, SevenRooms 모두 외부 앱용 공개 예약 API가 없고(제휴 심사를 통과한 일부만 가능), 비공식 경로(봇, 스크래핑)로 잡은 예약은 취소와 계정 차단 대상. 그래서 Timeleft처럼 **제휴 식당이 정해진 저녁에 테이블 몇 개를 Sidetable용으로 잡아두고**, 앱은 그 자리를 채우고 알리는 역할

**식당 쪽 (관리자 Places 탭)**
- **등록 항목:** 이름, 주소, 동네, 잡아둘 요일, 저녁당 테이블 수, 테이블당 최대 인원, 메일, 담당자, 전화, 휴무일, 회원에게 보일 메모, 계약 조건(식당 표현 그대로)
- **두 가지 방식:** 기본은 **상시 확보(standing hold)**로, 식당이 못 받는다고 알려올 때만 빠지는 구조. 저녁마다 확인받기를 원하는 식당은 **매번 확인(confirms each evening)**: 확인 전까지 회원에게 주소 비공개, 마감(이틀 전 정오, 늦게 잡힌 건 전날 오전 10시)이 지나면 재알림과 당번 알림
- **백업 식당:** 맨 마지막 순서, 필요할 때만 연락
- **자동 배치:** 초대장이 나갈 때(publish, publishWeek, round two, 다른 저녁 찾기) 그 저녁에 자리가 남은 제휴 식당으로 배치. 같은 동네 우선, 덜 붐비는 곳 우선, round two는 지난번 식당 우선, 백업은 마지막. 식당이 거절한 날과 휴무일은 제외
- **식당이 받는 메일:** 일요일 밤 10시 **주간 계획**(저녁별 필요한 테이블, 안 쓰는 저녁은 비워달라는 안내), 그 뒤 새로 잡힌 저녁은 별도 알림, **전날 정오 최종 인원**(테이블별 인원, 시간, 식단 메모, 캡틴 이름), 이후 변동 시 **업데이트**, 저녁이 비면 **release** 안내. 회원 이름과 프로필은 보내지 않고 캡틴 이름만
- **식당 전용 페이지** `/place?k=…`: 로그인 없이 앞으로 3주의 저녁별 인원과 상태를 보고 "Confirm" 또는 "We can’t host this one" 선택. 관리자는 링크 복사와 새 링크 발급(기존 링크 무효) 가능
- **식당이 못 받는 경우:** 그 저녁 테이블을 다른 제휴 식당으로 이동. 주소가 이미 공개된 뒤라면 단톡방과 알림으로 바뀐 장소 안내. 옮길 곳이 없으면 당번에게 알림이 가고, 당번이 직접 장소를 입력하거나 **Call it off**로 테이블 종료(해당 회원은 다음 주 우선 배정, 바로 다른 저녁 찾기 가능). 90일 안에 확정 후 이틀 이내 취소가 두 번이면 당번에게 "이 식당과 한번 이야기해 볼 때" 알림

**회원 쪽 규칙**
- **무료 변경은 전날 정오까지**(식당에 최종 인원이 가는 시점). 전날 오전 9시에 "정오까지 알려주면 무료" 알림, 초대장과 테이블 화면에는 "Free to change until …" 표시
- **늦은 변경**
  - 그 뒤 취소는 1점. 마감 시점에 이미 테이블에 배정돼 있던 경우만 해당하고, 마감 뒤에 빈자리를 받은 사람은 3시간 안에 돌려주면 무료
  - 관리자가 표시한 노쇼는 2점(다음 날 아침 못 갔다고 직접 말한 경우는 1점)
  - 60일 안에 3점이면 2주 동안 초대 중단(Hang과 특별한 밤 예약 포함). 중단 기간이 끝나면 점수는 새로 시작
  - 다음 날 아침 "I couldn’t go"라고 말한 것만으로는 점수 없음
  - 관리자 출석 표시는 came, no-show, 비움 세 가지. no-show를 지우면 그 때문에 걸린 중단도 해제
  - 나중에 카드 결제를 붙이면 점수 대신 소액 수수료로 전환 가능(보스턴 식당 노쇼 수수료는 보통 1인 $15~25)
- **사람이 빠지면:** 한 명이면 한 자리 줄어드는 정도(대기자가 있으면 채움). 세 명 아래로 줄면(둘만의 저녁은 데이트처럼 보일 수 있어서) 그날 자리가 있는 다른 테이블과 합치고(같은 식당 우선), 없으면 테이블 종료. 닫힌 테이블 사람은 다음 주 우선 배정, Tables에서 바로 "Find me another evening" 가능
- **캡틴:** 테이블마다 한 명이 5분 먼저 도착해 문 앞에서 "Sidetable, party of 5"로 일행 확인, 각자 계산 요청, 다 모이면 덱 시작. 순서는 최근에 맡지 않은 사람부터, "Happy to"를 고른 사람 우선, "Rather not"은 제외(Me에서 설정). 두 시간 전까지 "Pass it on"으로 넘기기 가능. 당일 정오에 단톡방에 이름 게시, 식당에는 캡틴 이름만 전달

**운영팀 (관리자 Ops 탭)**
- 처음에는 창업자(ops lead)와 캠퍼스 리드 1~2명. 요일별 rota로 하루 한 명씩 **당번**
- 당번이 메일로 받는 알림: 자리 없는 테이블, 답 없는 식당, 당일 바뀐 테이블(합침, 종료), 주소 공개 시각까지 확정되지 않은 자리, 자꾸 취소하는 식당. Ops 탭에서 처리 후 Done
- 제휴 계약, 일요일 공개, Long table 예약은 ops lead 담당

**Long table:** 장소는 운영팀이 6~8주 전에 직접 예약(근처 프라이빗 룸은 평일 최소 주문액이 보통 $2,500~6,500, 인원 확정은 1주 전쯤). 관리자가 장소, 좌석 수, 비용 안내("$35 at the door" 또는 "Hosted by ○○")를 입력하면 회원 카드에 표시. 좌석이 차면 대기줄, RSVP는 5일 전 정오 마감(그때 인원을 장소에 전달). 마감 뒤 못 온다는 사람이 생기면 대기 1번에게 자리 배정

- 서버: placeTable, savePlace, syncBooking, placeAnswer, placeMail, placeView, placesAdmin, shrink, closeTable, callOff, lateChanges, coolCheck, pickCaptain, captainMove, captainNote, alertOps, saveOps, setLong, promoteLong (server.js), 페이지 public/place.html, API /api/place, /api/captain, /api/captain-pref, /api/seen, /api/admin/place*, /api/admin/table-off, /api/admin/ops, /api/admin/alert-done

## Board: 정보 공유 게시판

하단 탭 순서는 Tables, Hangs, **Board**, People, Me. Board는 Harvard와 MIT 사람들의 게시판

- 흰 배경에 목록 하나(위에 글쓰기 칸, 종류 탭 한 줄). 정보가 많아 보이지 않도록 카드 색, 트랙 필터, 소개 문구는 생략
- 글 종류 다섯 가지: Worth reading(읽을거리 링크), Ask(공동창업자, 베타 유저, 소개 요청), Hot take(동의, 반대 투표), Shipped(출시, 투자 유치), Event(보스턴의 토크, 데모 나이트, 밋업)
- 테이크에는 Agree, Disagree 버튼, 모든 글에 하트. 글을 누르면 댓글 확인과 작성, 내 글은 삭제 가능
- 예전 People 탭의 Roles(채용 공고, 소개 요청)는 Board의 Roles 탭으로 이동
- 서버는 기존 Pulse API 그대로(/api/pulse, /api/post, /api/vote, /api/plus, /api/reply, /api/post-delete), 글 종류는 shared.js의 POSTS

People은 **회원 명부가 아닌, 내가 만난 사람들의 목록.** 같은 테이블이나 hang에 앉았던 사람, 대화가 열린 사람(서로 고름, 서로 wave, 소개)만 "Your people"에 표시되고 서버도 그 사람들만 전송(/api/people). 모르는 사람은 테이블과 hang에서 Charlie가 소개하는 방식. 탭은 People과 Messages 두 개

## 테이블 구성 규칙

코드: [server/tables.js](server/tables.js) (입출력 없는 순수 함수, 테스트는 test/tables.test.js)

- **반드시 지키는 것:** 4~6명, 두 학교 이상, 한 학교가 절반을 넘지 않게, 서로 차단한 사람은 같은 테이블 배정 없음
- **최대한 피하는 것:** 이미 같이 앉았던 사람끼리 다시 배정(재회는 예외). 매주 같은 트랙끼리 만나면 일부는 피할 수 없어서, 최소한으로 줄이고 관리자에게 경고로 표시
- **점수:** 테크 테이블(코드상 topic)은 주제 60 : 사람 40, 소셜 테이블(코드상 kindred)은 주제 20 : 사람 80. 세부 내용은 CONCEPT.md
- 사람이 모자란 트랙은 가까운 트랙과 합치고, 학교 비율 때문에 자리를 못 받은 사람은 대기로. 대기했던 사람은 다음 디너에 우선 배정
- 같은 seed면 같은 결과. 관리자 화면에서 seed를 바꾸면 다른 배치 확인 가능

## 배포 (Railway, Amie와 같은 방식)

```bash
npm install -g @railway/cli
```

이 폴더에서 `railway login`, `railway init`, `railway up`, `railway domain` 순서로 실행. Railway 대시보드에서:
- Volume을 `/data`에 연결
- `SIXTOP_ADMIN_KEY`, `SIXTOP_DATA_DIR=/data`, `SIXTOP_PUBLIC_URL=https://(받은 도메인)` 입력

푸시 알림은 HTTPS에서만 동작. 아이폰은 홈 화면에 추가한 뒤에 알림을 켤 수 있음(앱 안에 안내 문구 포함)

## 데이터와 개인정보

- 데이터 폴더에는 이름, 학교 이메일, 사진, 생활 단계(결혼, 부모 등) 저장. **외부 공개 금지, 파일럿이 끝나면 삭제**
- 생활 단계는 매칭에만 사용. 테이블에서는 "보스턴에 새로 옴", "유학생", "졸업 후에도 보스턴"만, 두 명 이상일 때 숫자로만 언급
- **모든 회원은 Harvard 또는 MIT 이메일(harvard.edu, hbs.edu, mit.edu와 하위 도메인, 예: college.harvard.edu)을 6자리 코드로 인증.** 클럽 링크 가입, 관리자 개인 초대, 새 폰에서 다시 로그인 모두 같은 방식. 인증 전에는 아무 기능도 사용 불가, 학교는 인증된 이메일 기준
- **프로필 사진은 필수.** 사진은 인증을 마친 Harvard, MIT 회원에게만 표시(테이블, Hang, People 카드), 서로 차단한 사람에게는 비공개. 다음 날 픽은 서로 골랐을 때만 공개
- 샘플 회원 40명의 얼굴은 Amie 프로젝트에서 AI로 만든 초상화(실제 인물 아님). `scripts/make-faces.ps1`로 `scripts/faces.js` 생성
- 회원이 "Delete my account"를 누르면 사진과 프로필 삭제, 링크도 즉시 중단

## 아직 없는 것

| 항목 | 지금 | 다음 단계 |
|---|---|---|
| 학교 이메일 인증 | 6자리 코드, Resend로 발송 (코드 흐름은 테스트 완료, 실제 발송은 키를 넣고 확인 필요) | 보내는 도메인 인증(SPF, DKIM), 실제 harvard.edu, mit.edu 주소로 수신 확인 |
| 개인정보 안내와 가입 동의 | 없음 | 베타 전 추가 필요(사진, 학교 메일, 생활 단계 수집 안내) |
| 사진 주소 보안 | 사진 주소에 로그인 토큰 포함 | 베타 전 사진 전용 토큰 방식으로 변경 |
| 늦은 변경 수수료 | 점수제(늦은 취소 1점, 노쇼 2점, 60일 3점이면 2주 중단) | Stripe 카드 등록 후 1인 $15 정도, 가입 때 미리 고지(매사추세츠 수수료 고지 규정) |
| 로그인 | 개인 링크 또는 학교 이메일 코드 | 링크를 잃어도 학교 이메일로 다시 로그인하는 흐름 유지 |
| Long table 결제 | 비용 안내 문구만 | 선결제 좌석(최소 주문액을 70% 참석 기준으로 나눠 가격 책정) 또는 후원 |
| 식당 예약 시스템 연동 | 제휴 메일, 식당 전용 페이지, 전화 | 규모가 커지면 OpenTable, Resy 공식 제휴 신청(222가 이 방식) |

## 파일

```
server/server.js   API, 관리자 API, 저장, 알림, 정적 파일
server/tables.js   테이블 구성 (점수, 규칙, Charlie의 "왜 이 사람들")
server/push.js     웹 푸시 (Amie 베타에서 가져옴)
public/index.html  회원 앱 (가입, 온보딩, Tables, Hangs, 테이블, 단톡방, 다음 날, Board, People, Me)
public/admin.html  관리자 페이지
public/place.html  제휴 식당 전용 페이지
public/shared.js   앱과 서버가 함께 쓰는 질문, 트랙, 페르소나, 질문 카드
public/app.css     프로토타입과 같은 디자인 (Amie C), 첫 화면 영상, 방(aura)
public/video/      첫 화면 영상 (npm run film)
art/make-film.js   첫 화면 영상 제작 (Mixkit 원본 → 세로 컷, 색 보정, 편집)
scripts/seed.js    샘플 데이터 (실제 데이터에는 사용 금지)
scripts/dev.js     로컬 개발용 실행
scripts/build-demo.js  폰 데모 한 파일 (dist/sixtop-demo.html + dist/video/film.mp4, 아티팩트에 함께 업로드)
test/              npm test (테이블 구성 8개, 서버 32개)
```
