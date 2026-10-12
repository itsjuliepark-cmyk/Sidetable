# Sidetable 웹앱

- Harvard, MIT 파일럿에서 실제로 쓰는 웹앱
- 앱스토어 설치 없이 브라우저 링크로 접속, 홈 화면에 추가하면 앱처럼 사용 가능
- 외부 패키지 없는 Node 서버 파일 하나와 JSON 데이터 파일 하나로 동작 (Amie 베타와 같은 구조)
- 화면 이름은 Sidetable, 코드 폴더(sixtop/)와 환경 변수(SIXTOP_*)는 예전 이름 그대로
- Harvard는 HBS뿐 아니라 College, Kennedy School, Law, Medical, SEAS 등 모든 학교 가입 가능
- 학교 밖 사람을 받을 때는 `public/shared.js`의 `SCHOOLS`에 학교와 이메일 도메인만 추가
- 기획은 [CONCEPT.md](../CONCEPT.md), 사업 검토는 [BUSINESS.md](../BUSINESS.md), 초기 프로토타입은 [sixtop.html](../sixtop.html)

## 로컬에서 실행

```bash
npm run seed
```

```bash
npm run dev
```

- `seed`: 샘플 회원 40명(Harvard 20, MIT 20)과 데모 데이터 생성, Jordan으로 들어가는 링크 출력
  - 지난주 테크 디너: 다음 날 픽과 1:1 채팅까지 끝난 상태, 같은 멤버의 round two 예약 완료
  - 이번 주: Jordan에게 온 초대장 두 장(테크, 소셜), 테크 테이블 캡틴은 Jordan
  - 다음 주: 34명이 가능한 저녁을 이미 고른 상태라 관리자 화면에서 바로 테이블 구성 가능
  - 그 밖에 Hang 6개, Board 글, Long table 신청 15명, 가상의 제휴 식당 4곳
- `dev`: 관리자 키는 `local-admin`, 인증 코드는 메일 대신 화면에 표시, 실제 파일럿에는 사용 금지
- 웹앱 주소 <http://localhost:8800>, 관리자 페이지 <http://localhost:8800/admin>
- 폰 데모(`npm run demo`)는 일요일 밤을 기다리지 않고 저녁을 고르는 즉시 초대장 생성

## 실제 파일럿 실행

```bash
SIXTOP_ADMIN_KEY=choose-a-long-secret SIXTOP_PUBLIC_URL=https://your-domain npm start
```

| 환경 변수 | 기본값 | 설명 |
|---|---|---|
| `SIXTOP_ADMIN_KEY` | 실행마다 랜덤, 로그에 출력 | 관리자 페이지 키, 길고 복잡하게 설정 |
| `PORT` | 8800 | Railway 등에서는 자동 지정 |
| `SIXTOP_DATA_DIR` | `./data` | 회원, 테이블, 채팅, 사진 저장 위치, 반드시 영구 디스크 사용 |
| `SIXTOP_PUBLIC_URL` | 없음 | 초대 링크, 클럽 링크, 식당 링크의 기본 주소 |
| `SIXTOP_TZ` | `America/New_York` | 마감, 장소 공개 등 시각 계산 기준 |
| `SIXTOP_AREA` | `Central Square` | 새로 여는 밤의 기본 동네 |
| `RESEND_API_KEY`, `SIXTOP_MAIL_FROM` | 없음 | 인증 코드와 식당 메일을 보내는 [Resend](https://resend.com) 키와 보내는 주소, 없으면 가입 불가 |
| `SIXTOP_MAIL` | 없음 | `show`면 인증 코드를 화면에 표시, 로컬 개발과 데모 전용 |
| `SIXTOP_AUTO_WEEK` | 없음 | `1`이면 일요일 20시에 다음 주 테이블 자동 구성과 공개 |
| `SIXTOP_LONG_TIME` | `19:00` | Long table 시작 시각 |
| `SIXTOP_PUSH_DAY` | 4 | 한 사람이 하루에 받는 알림 최대 개수 |
| `SIXTOP_VAPID_PUBLIC`, `SIXTOP_VAPID_PRIVATE` | 처음 실행 때 생성해 데이터 폴더에 저장 | 푸시 알림 키, 바꾸면 회원 전원 알림 재설정 필요 |

## 한 주 운영

관리자 탭: Tables, Places, Ops, Pop-ups, People, Roles, Links, Reports

| 언제 | 내용 |
|---|---|
| 처음 한 번 | Links 탭에서 클럽별 가입 링크 생성 후 클럽 채널에 공유, 제휴 식당은 Places, 운영팀은 Ops 탭에 등록 |
| 일요일 18:00까지 | 회원이 다음 주 디너 횟수(1~5)와 가능한 저녁(월~금) 선택 |
| 일요일 저녁 | Tables 탭에서 Build the tables로 테이블 구성, 확인 후 Publish the week, 식당과 캡틴은 자동 배정 |
| 일요일 22:00 | 제휴 식당마다 그 주 계획 메일 발송 |
| 공개 직후 | 회원에게 초대장과 단톡방 오픈, Charlie가 테이블 소개와 그 주 질문 게시 |
| 전날 09:00 | 정오까지는 무료로 바꿀 수 있다는 알림 |
| 전날 정오 | 무료 변경 마감, 식당에 최종 인원 발송 |
| 당일 정오 | 식당 주소 공개, 단톡방에 캡틴 이름 게시 |
| 당일 저녁 | 테이블에서 Table deck 3라운드 진행 |
| 다음 날 10:00 | 피드백 알림: 참석 여부, 평점, 다시 보고 싶은 사람, round two 여부 |
| 그 뒤 | 서로 고른 사람끼리 1:1 채팅 오픈, 관리자는 출석 표시 |

- `SIXTOP_AUTO_WEEK=1`이면 일요일 20시에 구성과 공개까지 자동 진행
- 특별한 밤은 Tables 탭의 A special night에서 날짜와 동네를 정해 따로 모집, 3일 전 마감
- 관리자 화면 맨 위 숫자는 BUSINESS.md의 합격선 지표와 동일

## 화면

### 첫 화면

- 25초짜리 세로 영상이 화면 가득 재생, 위에 Sidetable 로고, 가운데 Charlie의 문장, 아래에 Sign in과 Join
- 영상은 네 장면으로 구성
  1. 밤의 도시와 과학 이미지, "Six people who build things, one table, zero small talk"
  2. 코드, 로봇, 현미경, 칩이 점점 빠르게 바뀌는 장면
  3. 함께 만드는 사람들, "Talk AI, bio and robots until they stack the chairs"
  4. 웃고 건배하는 저녁, "Come for the tech talk, stay for the friends"
- 자동 재생이 막히면 첫 프레임을 보여주고 터치하면 재생, 움직임 줄이기 설정이면 재생 생략
- 영상 원본은 모두 [Mixkit](https://mixkit.co) 무료 라이선스 (상업적 사용 가능, 출처 표기 불필요)

```bash
npm run film
```

- 첫 화면 영상을 다시 만드는 명령, ffmpeg 필요 (`winget install Gyan.FFmpeg`)
- 원본 클립 번호와 색 보정은 `art/make-film.js`, 결과물은 `public/video/film.mp4`
- 컷을 바꾸면 `index.html`의 `FILM_T`도 `film.json`에 맞춰 수정

### 회원 화면

- Amie와 같은 부드러운 라이트 톤, Harvard는 로즈, MIT는 미스트 블루
- 배경은 색 안개가 천천히 흐르는 Amie의 "방", 탭마다 다른 색

| 탭 | 내용 |
|---|---|
| Tables | Charlie의 초대장, 내 Hang, 이번 달 카드, 다음 주 계획 |
| Hangs | 누구나 여는 번개 모임, 소셜 또는 테크 주제 |
| Board | 읽을거리, 질문, 핫테이크, 출시 소식, 행사, 채용 |
| People | 같이 앉았던 사람 목록과 1:1 메시지 |
| Me | 프로필, Friend Persona, 테이블 크기, 캡틴 설정, 알림, 쉬기 |

- 1:1 채팅은 디너 뒤 서로 고른 경우, 서로 Wave 한 경우, 소개 요청을 수락한 경우에만 오픈
- 서로 고른 사이는 같은 저녁을 고르면 같은 테이블로 배정

### 가입

- 학교 이메일 인증 후 이름, 학교와 과정, 졸업 연도만 입력
- 디너 종류는 Tech + social(기본), Tech tables only, Mostly social 중 선택
- 성향 질문은 네 축: Listen↔Spark, Playful↔Deep, Easygoing↔Planner, Ritual↔Adventure
- 테이블은 Harvard와 MIT 반반, 한 학교가 절반을 넘지 않게 구성

## Tonight’s question

- 테이블마다 그 주 가장 뜨거운 질문 하나로 편을 갈라 이야기하는 게임
- 단톡방 상단의 한 줄짜리 바에서 진행, 카드는 누르면 열리는 시트에서 확인

| 언제 | 내용 |
|---|---|
| 테이블 공개 | Charlie가 질문 카드 3장 게시, 카드마다 지금 뜨거운 이유와 기사 링크 |
| 투표 | 탭 한 번으로 투표, 전원이 투표하거나 전날 정오가 되면 마감 |
| 편 고르기 | A 또는 B를 비밀로 선택, 다른 사람에게는 고른 인원만 표시 |
| 디너 시작 | 결과 공개, Table deck 2라운드를 이 질문으로 진행 |
| 다음 날 아침 | 입장 다시 선택, 마음을 바꾼 사람이 있으면 Charlie가 언급 |

- 카드 형식: Balance game, Hot take, Place your bet, Would you rather, Be honest
- 소셜 테이블은 테크 질문 대신 친해지는 질문
- Hang도 같은 게임, 투표는 시작 1시간 전 마감
- 카드는 `public/shared.js`의 `CARDS`에 65장, 테크 카드는 1~2주마다 교체 권장
- 카드 선택은 코드로 처리해 추가 비용 없음
- Claude로 매주 새 카드 초안을 만들면 한 달 약 $10, 사람 검수는 주 15~20분

## 못 가게 됐을 때

- 초대장의 I can’t make it에서 두 가지 중 선택
- Find me another evening: 앞으로 7일 중 가능한 저녁을 고르면 같은 종류 테이블의 빈자리로 새 초대장 발송
  - 차단한 사람 제외, 학교 비율 유지, 테크는 같은 트랙 우선
  - 빈자리가 없으면 대기, 자리가 나면 자동 배정
- Just skip this one: 이번만 빠지기, 전날 정오 이후면 늦은 변경 1점
- 테이블이 세 명 아래로 줄면 다른 테이블과 합치거나 종료
- 서버 코드: `reinvite`, `chairFits`, `openChair`, `fillChair`, `pruneStandby`

## 한 번으로 끝나지 않게

- 친해지려면 같은 사람을 여러 번 만나야 해서 테이블과 테이블을 잇는 장치 마련
- 가벼운 친구가 되기까지 약 50시간, 디너 한 번은 3시간

### Round two

- 다음 날 아침 같은 멤버로 2주 뒤에 다시 만날지 직접 선택, 기본값 없음
- 4~5명 테이블은 3명, 6명 테이블은 4명이 yes면 같은 요일 2주 뒤로 예약
- 장소는 지난번 식당 우선, 자리가 없으면 다른 제휴 식당
- yes 한 사람만 자리 배정, 남는 자리는 새 사람 최대 2명
- 한 표가 모자라면 단톡방에 One more yes 게시
- round two 뒤에도 같은 방식으로 round three
- 서로 차단한 사이는 제외, 두 명만 남으면 취소

### 그 밖의 연결 장치

- 같은 얼굴 다시: 서로 고른 사이는 같은 저녁을 고르면 같은 테이블, 저녁 고르기 화면에 그 사람들 얼굴 표시
- Since last time: 다음 테이블 전까지 해 볼 일을 한 줄로 적으면 다음 테이블에서 Charlie가 언급
- Your October: 이번 달 테이블을 실에 꿴 구슬처럼 보여주는 Tables 탭 카드
- Long table: 매달 마지막 목요일, 그 달 테이블에 앉았던 사람이 모두 모이는 저녁
- 서버 코드: `roundTwo`, `againNudge`, `fillRounds`, `setLoose`, `looseFor`, `monthView`, `setLong`

## 장소와 운영

### 식당 예약 방식

- OpenTable, Resy 등은 외부 서비스용 공개 예약 API가 없어 Sidetable에서 직접 예약 불가
- 대신 제휴 식당이 정해진 저녁에 테이블 몇 개를 Sidetable용으로 확보, Sidetable은 자리를 채우고 연락만 담당
- Timeleft와 같은 방식

### 식당

- 관리자 Places 탭에서 이름, 주소, 요일, 테이블 수, 연락처, 휴무일, 계약 조건 등록
- 기본은 상시 확보, 식당이 못 받는다고 알려올 때만 제외
- 저녁마다 확인을 원하는 식당은 매번 확인 모드, 확인 전에는 회원에게 주소 비공개
- 초대장이 나갈 때 자리가 남은 제휴 식당으로 자동 배치, 같은 동네와 덜 붐비는 곳 우선
- 식당이 받는 메일: 일요일 밤 주간 계획, 전날 정오 최종 인원, 이후 변경 사항
- 회원 이름과 프로필 없이 인원, 시간, 식단 메모, 캡틴 이름만 전달
- 식당 전용 페이지(`/place?k=…`)에서 로그인 없이 확인 또는 거절
- 식당이 거절하면 다른 제휴 식당으로 이동, 옮길 곳이 없으면 당번이 처리

### 회원

- 전날 정오까지 무료 변경
- 그 뒤 취소는 1점, 노쇼는 2점, 60일 안에 3점이면 2주 동안 초대 중단
- 세 명 아래로 줄면 다른 테이블과 합치거나 종료, 둘만 남는 저녁은 데이트처럼 보일 수 있어 만들지 않음
- 닫힌 테이블 사람은 다음 주 우선 배정
- 캡틴: 테이블마다 한 명이 5분 먼저 도착해 일행 확인과 각자 계산 요청
  - 최근에 맡지 않은 사람 순서, Me에서 제외 가능, 두 시간 전까지 넘기기 가능

### 운영팀

- 처음에는 창업자와 캠퍼스 리드 1~2명이 하루씩 돌아가며 당번
- 당번은 자리 없는 테이블, 답 없는 식당, 당일 변동 알림을 메일로 받아 Ops 탭에서 처리
- Long table 장소는 운영팀이 6~8주 전에 직접 예약, 좌석이 차면 대기, RSVP는 5일 전 마감
- 서버 코드: `placeTable`, `savePlace`, `syncBooking`, `placeAnswer`, `placeMail`, `shrink`, `closeTable`, `lateChanges`, `pickCaptain`, `alertOps`, 식당 페이지는 `public/place.html`

## Board

- Harvard와 MIT 사람들의 게시판
- 글 종류: Worth reading, Ask, Hot take, Shipped, Event, 채용 공고는 Roles 탭
- 핫테이크는 Agree, Disagree 투표, 모든 글에 하트와 댓글
- People은 회원 명부가 아니라 내가 만난 사람 목록, 서버도 그 사람들만 전송

## 테이블 구성 규칙

- 코드는 [server/tables.js](server/tables.js), 테스트는 `test/tables.test.js`
- 필수 조건: 4~6명, 두 학교 이상, 한 학교가 절반 이하, 서로 차단한 사람 제외
- 이미 같이 앉았던 사람끼리는 최대한 다른 테이블 (재회 테이블은 예외)
- 매칭 비중: 테크 테이블은 주제 60, 사람 40 / 소셜 테이블은 주제 20, 사람 80
- 사람이 모자란 트랙은 가까운 트랙과 합치고, 자리를 못 받은 사람은 다음 디너에 우선 배정
- 같은 seed면 같은 결과

## 배포 (Railway)

```bash
npm install -g @railway/cli
```

- 이 폴더에서 `railway login`, `railway init`, `railway up`, `railway domain` 순서로 실행
- Railway 대시보드에서 Volume을 `/data`에 연결
- 환경 변수 `SIXTOP_ADMIN_KEY`, `SIXTOP_DATA_DIR=/data`, `SIXTOP_PUBLIC_URL` 입력
- 푸시 알림은 HTTPS에서만 동작, 아이폰은 홈 화면에 추가해야 알림 사용 가능 (iOS 16.4 이상)

## 데이터와 개인정보

- 데이터 폴더에 이름, 학교 이메일, 사진, 생활 단계 저장, 외부 공개 금지, 파일럿 후 삭제
- 모든 회원은 Harvard 또는 MIT 이메일을 6자리 코드로 인증, 인증 전에는 이용 불가
- 프로필 사진은 필수, 인증된 회원에게만 표시
- 생활 단계는 매칭에만 사용, 테이블에서는 두 명 이상일 때 숫자로만 언급
- 샘플 회원 얼굴은 AI로 만든 초상화 (실제 인물 아님)
- Delete my account를 누르면 사진과 프로필 즉시 삭제

## 아직 없는 것

| 항목 | 지금 | 다음 단계 |
|---|---|---|
| 학교 이메일 발송 | Resend 연동 완료, 실제 발송은 미확인 | 보내는 도메인 인증, harvard.edu와 mit.edu 수신 확인 |
| 개인정보 동의 | 없음 | 베타 전 가입 동의 화면 추가 |
| 사진 주소 보안 | 사진 주소에 로그인 토큰 포함 | 베타 전 사진 전용 토큰으로 변경 |
| 늦은 변경 수수료 | 점수제 | 카드 등록 후 1인 약 $15, 가입 때 미리 고지 |
| Long table 결제 | 비용 안내 문구만 | 선결제 좌석 또는 후원 |
| 식당 예약 시스템 연동 | 메일, 식당 전용 페이지, 전화 | 규모가 커지면 OpenTable, Resy 공식 제휴 신청 |

## 파일

```
server/server.js   API, 관리자 API, 저장, 알림, 정적 파일
server/tables.js   테이블 구성 (점수, 규칙, Charlie의 "왜 이 사람들")
server/push.js     웹 푸시
public/index.html  회원 화면
public/admin.html  관리자 페이지
public/place.html  제휴 식당 전용 페이지
public/shared.js   화면과 서버가 함께 쓰는 질문, 트랙, 페르소나, 질문 카드
public/app.css     디자인, 첫 화면 영상, 배경
public/manifest.webmanifest, public/sw.js  홈 화면 추가와 푸시 알림
public/video/      첫 화면 영상
art/make-film.js   첫 화면 영상 제작
scripts/seed.js    샘플 데이터 (실제 데이터에는 사용 금지)
scripts/dev.js     로컬 개발용 실행
scripts/build-demo.js  폰 데모 한 파일 생성
test/              npm test (테이블 구성 8개, 서버 32개)
```
