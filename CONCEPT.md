# Hash Table 컨셉 (v0.2)

- 초기 컨셉 문서, 현재 동작은 [app/README.md](app/README.md) 기준
- 사업 검토는 [BUSINESS.md](BUSINESS.md), 초기 프로토타입은 [sixtop.html](sixtop.html)

현재 버전과 달라진 점

- 테이블 이름: Topic, Kindred → 테크, 소셜
- 트랙: 4개 → 14개
- 초대 방식: 매주 디너 횟수(1~5)를 고르면 초대장 발송
- 성향 축: Host↔Guest → Easygoing↔Planner
- 노쇼 대책: 보증금 대신 늦은 변경 점수제
- 캡틴: 클럽 리더 대신 회원이 돌아가며 담당, 세 가지 미션과 스트라이프
- Industry table: 업계 게스트가 함께하는 테이블, 스트라이프가 있는 캡틴 우선
- 형태: 앱스토어 앱이 아닌 웹앱

## 한 줄 정의

- 큰 모임에 지친 사람에게, 관심사가 같고 잘 맞을 사람끼리 4~6인 디너 테이블을 만들어주는 웹앱
- 이름 Hash Table: 개발자라면 다 아는 자료구조, 비슷한 것끼리 같은 칸(테이블)에 모으는 구조라 관심사로 자리를 정하는 서비스와 같은 원리
- #은 해시태그이기도 해서 관심사 태그로 사람을 모은다는 뜻도 함께
- 슬로건: Six seats. Both sides of the Charles.
- 찰스강은 HBS와 MIT, Boston과 Cambridge 사이를 모두 흐르는 강이라 퍼블릭 런칭 후에도 사용 가능
- 보조 문구: Fewer people. Better conversations.

## v0.2 결정 사항

| 항목 | 결정 |
|---|---|
| Amie와의 관계 | 완전히 분리, 엔진과 서버, 디자인만 공유 |
| 시작 | Harvard × MIT, 양쪽 테크 클럽과 공식 협업 |
| 장기 목표 | Greater Boston 퍼블릭 런칭 |
| 첫 주제 | Generative AI, Healthcare AI, Entrepreneurship, Climate 4개 트랙 |
| 매칭 | 관심사와 함께 사람끼리 잘 맞는지까지 고려 |

## 누구를 위한 서비스인가

| 이런 사람 | 지금의 문제 |
|---|---|
| 큰 리셉션, 믹서, 클럽 행사에 지친 사람 | 명함만 주고받고 다시 만나는 사람은 없음 |
| 깊은 대화를 원하는 사람 | 스몰톡만 하다 끝나는 저녁 |
| 보스턴에 새로 왔거나 졸업 후에도 남는 사람 | 학교 밖 친구 부족 |
| 커플, 기혼자 | 데이팅 앱 같은 모임은 부담 |

## 설계 1: Tech 연관 관심사를 공유하는 사람들을 연결

- "친구 사귀기 모임"은 외로워 보일까 봐 망설이지만 "Healthcare AI 디너"는 명분이 있어 부담 없음
- 그래서 첫 테이블은 주제 중심의 Topic table, 테크 클럽과 협업하기에도 자연스러운 형식
- 매칭은 처음부터 사람끼리 잘 맞는지도 함께 고려
- 첫 테이블을 경험한 사람에게 주제와 상관없이 잘 맞을 사람들로 꾸린 Kindred table 제안

## 설계 2: 두 겹의 프로필, 두 종류의 테이블

### 프로필

| 층 | 내용 | 받는 방법 |
|---|---|---|
| A. What you love | 트랙, 세부 관심사, 앵글(만들기, 투자, 운영, 연구, 분야 전환), 핫테이크 | 칩 선택, 핫테이크 3개 |
| B. How you connect | Friend Persona, 만남 빈도, 생활 단계, 같이 하고 싶은 활동, 원하는 관계 | Friend test (Amie 테스트의 친구 버전) |

### 테이블

| | Topic table | Kindred table |
|---|---|---|
| 한 줄 | 같은 주제에 빠진 사람들 | 진짜 친구가 될 것 같은 사람들 |
| 매칭 비중 | 주제 60, 사람 40 | 주제 20, 사람 80 |
| 주제 | 트랙 하나 (예: Healthcare AI) | 여섯 명의 공통점에서 Charlie가 고른 대화거리 |
| 요일 | 수요일 19:30 | 금요일 19:30 |
| 시작 시점 | 처음부터 | 파일럿 3주차부터 |
| Table deck | Origins → The split → Napkin startup | Origins → Go deeper → Plan the next one |
| 다음 단계 | 같은 트랙의 다음 테이블, 1:1 커피 | 재회 테이블, 단골 모임 |

- 두 테이블 모두 HBS와 MIT를 반씩 섞어 구성
- 퍼블릭 이후에는 동네, 학교, 직장을 섞는 방향

## 데이팅 앱과 다른 점

| | Amie (데이팅) | Hash Table (찐친) |
|---|---|---|
| 보는 것 | 끌림, 외모 취향, 연애 스타일 | 유머, 대화 깊이, 만남 빈도, 생활 단계, 같이 할 활동 |
| 닮음과 다름 | 일부 축은 서로 다를수록 좋음 | 대부분 비슷할수록 좋음, 예외는 말하는 사람과 듣는 사람, 약속을 잡는 사람과 따라가는 사람 |
| 단위 | 1:1 | 그룹 먼저, 1:1은 서로 고른 경우에만 |
| 성공 기준 | 한 번의 매칭 | 같은 사람과 여러 번 다시 만나기 |
| 사진 | 매칭의 핵심 | 식당에서 서로 알아보는 용도로만 사용 |
| 성별 | 성별, 지향 필터 | 섞는 것이 기본, 연애 상태는 생활 단계로만 |
| 결과 | Love Persona | Friend Persona |

### 근거

- 친구가 되기까지 걸리는 시간: 가벼운 친구 약 50시간, 친구 약 90시간, 가까운 친구 200시간 이상 (Hall, 2019)
- 디너 한 번은 3시간이라 반복 만남 설계가 핵심
- 비슷한 사람끼리 친구가 되는 경향 (homophily, McPherson 외, 2001)
- 자기 개방을 조금씩 늘리면 빨리 가까워지는 효과 (Aron 외, 1997, "36 questions"), Table deck 라운드 순서에 반영

## Friend test (약 3분)

- Amie처럼 상황 질문에 답하면 Charlie가 바로 반응하는 형식

### 네 가지 축

| 축 | 양 끝 | 매칭 방식 |
|---|---|---|
| 대화 | Spark(먼저 꺼냄) ↔ Listen(잘 들어줌) | 섞어서 배치, 테이블당 Spark 1~3명 |
| 원하는 대화 | Deep ↔ Playful | 비슷하게, 기대하는 깊이가 다르면 둘 다 지루함 |
| 약속 | Host(약속을 잡음) ↔ Guest(잘 따라옴) | 테이블마다 Host 1명 이상, 없으면 다시 모이지 않음 |
| 우정의 모양 | Ritual(늘 가던 곳) ↔ Adventure(새로운 것) | 비슷하게 |

### 예시 유형

| 코드 | 이름 | 한 줄 |
|---|---|---|
| SDHR | The Hearth Keeper | 모두가 두고두고 이야기하는 디너를 매달 여는 사람 |
| SPHA | The Instigator | "잠깐, 우리 이거 해볼까?"로 최고의 밤을 만드는 사람 |
| LDGR | The Confidant | 친구 한 명과 폰 없이 보내는 두 시간을 제일 좋아하는 사람 |
| LDHA | The Curator | 작은 전시, 숨은 바, 책 한 권을 찾아 친구를 데려가는 사람 |
| LPHR | The Group-Chat Keeper | 단톡방을 살리고 생일을 챙기는 사람 |
| LPGA | The Easy Yes | 복잡한 것 없이 언제든 OK인 사람 |

### 질문

| # | 질문 | 주로 보는 것 |
|---|---|---|
| 1 | 금요일 7시, 갑자기 약속이 깨졌다면? | Host/Guest, Spark/Listen |
| 2 | 새벽 2시까지 이어갈 수 있는 대화는? | Deep/Playful |
| 3 | 단톡방이 2주째 조용하다면? | Host/Guest |
| 4 | 친구들과의 이상적인 토요일은? | Ritual/Adventure |
| 5 | 만남 빈도, 생활 단계, 같이 하고 싶은 활동, 원하는 관계 | 비슷한 사람끼리 매칭, 활동은 디너 뒤 약속에 활용 |

### 사람 핏 점수

| 요소 | 가중치 | 방향 |
|---|---|---|
| 대화 깊이 (Deep/Playful) | 20% | 비슷하게 |
| 만남 빈도와 원하는 관계 | 20% | 비슷하게 |
| 생활 단계 | 15% | 비슷하게 (아이 있는 사람끼리, 새로 온 사람끼리) |
| 같이 할 활동 | 15% | 많이 겹칠수록 좋음 |
| Ritual/Adventure | 10% | 비슷하게 |
| Spark/Listen 균형 | 10% | 섞어서 |
| Host 포함 | 10% | 테이블마다 1명 이상 필수 |

- 주제 핏(관심사 겹침, 핫테이크 의견 차, 앵글 섞기)은 v0.1과 동일

## 찐친이 되기까지

| 단계 | 내용 | 시점 |
|---|---|---|
| 1. 첫 테이블 | Topic table | 1주차 |
| 2. See again? | 다시 보고 싶은 사람 선택, 서로 고른 경우만 공개 | 다음 날 아침 |
| 3. Round two | 대부분 yes면 2주 뒤 같은 요일, 같은 장소로 같은 사람끼리 다시 모임, 새 사람은 추가하지 않음 | 3주차 |
| 4. 단골 테이블 | round two 뒤에도 yes면 다시 2주 뒤 | 2~3개월 |
| 5. 디너 밖 약속 | 활동이 겹치면 Charlie가 러닝, 클라이밍 같은 약속 제안 | 언제든 |

- 테이블 사이는 "Before your next table" 한 줄로 연결, 다음 테이블에서 그 이야기로 시작
- 1:1은 서로 고른 경우에만 열리고, 데이트처럼 들리지 않게 이름도 "Coffee?"
- North star는 같은 사람과 세 번째로 만난 쌍의 수, 친구가 되어 간다는 가장 직접적인 신호

## 테크 4개 트랙

| 트랙 | 세부 관심사 | 협업할 클럽 | 핫테이크 예시 |
|---|---|---|---|
| Generative AI | AI agents, Foundation models, AI products & UX, AI & the future of work, Developer tools, AI policy & safety | 테크, AI 클럽 | "AGI arrives before our 10-year reunion." |
| Healthcare AI | Clinical AI, Drug discovery & bio, Digital health, Health systems & payers, Medtech & devices, Mental health | 헬스케어 클럽 | "Hospitals will buy AI long before doctors trust it." |
| Entrepreneurship | Finding a cofounder, Fundraising, Consumer, B2B & SaaS, Lab spinouts, Search funds & ETA | 창업 클럽 | "You should start a company right out of school." |
| Climate | Energy & the grid, Carbon removal, Climate fintech, Mobility & EVs, Food & ag, Climate policy | 에너지, 기후 클럽 | "AI’s power demand is a climate opportunity, not a problem." |

- 한 주에 트랙마다 HBS 6명, MIT 6명이 모이지 않으면 가장 가까운 트랙과 합치기
- 덜 찬 테이블로 여는 것보다 나은 선택

## 테크 클럽 공식 협업

| | 내용 |
|---|---|
| 클럽이 얻는 것 | 큰 행사 후 소그룹 후속 프로그램을 운영 부담 없이 확보, HBS×MIT 공동 프로그램이라는 타이틀 |
| 우리가 얻는 것 | 첫 모집, 신뢰, 클럽 뉴스레터와 슬랙 채널 |
| 형태 | 트랙마다 양쪽 클럽 한 쌍, 예: Healthcare Club × Hash Table |
| 클럽 리더 역할 | 첫 2주 동안 테이블마다 1명씩 Table captain |
| 요청 사항 | 학기 중 수요일 4번, 클럽 채널 공지 2번, 첫 디너 디저트 지원(선택) |
| 피치 한 줄 | "Your big events fill the room. We make sure people meet again." |

- 학생 클럽과 영리 서비스의 공동 브랜딩, Harvard와 MIT 이름과 로고 사용은 학교 규정 확인 필요
- 학교가 보증하는 것처럼 보이지 않도록 주의, 파일럿 전에 양쪽 학생처 규정 확인

## Harvard × MIT에서 Greater Boston으로

| 단계 | 시기 (예시) | 대상 | 인증 | 다음 단계 조건 |
|---|---|---|---|---|
| 0. 파일럿 | 2026 가을 | HBS × MIT Sloan, 테크 4트랙 | 학교 이메일 | 참석률 90%, 재신청 60%, 재회 테이블 성사 |
| 1. 캠퍼스 | 2027 봄 | Harvard, MIT 대학원 전체와 박사후연구원, Kindred table 정식 오픈 | 학교 이메일 | 세 번째 만남 쌍의 꾸준한 증가 |
| 2. 보스턴 학교와 동문 | 2027 가을 | Tufts, BU, Northeastern, BC 등 대학원과 보스턴 거주 동문 | 학교, 동문 이메일 | 동네별로 매주 테이블이 찰 만큼의 인원 |
| 3. Greater Boston | 2028 | 22세 이상 누구나, 신청과 기존 회원 추천 | 신분증, 셀피, 직장 또는 LinkedIn | |

퍼블릭으로 갈 때 지킬 것

- 처음 멤버가 문화를 만들기 때문에 캠퍼스 멤버를 퍼블릭 초기 테이블에 섞어 배정
- 동네 단위로 오픈: Cambridge, Back Bay, South End, Seaport, Somerville 순서, 동네마다 식당 2~3곳 확보
- 주제 확장: Books & Ideas, Food & Boston, Running & Outdoors처럼 학교 밖 사람도 공감할 주제
- 본격적인 수익은 퍼블릭 단계의 월 멤버십부터

## 데이팅처럼 보이지 않게

- 매칭에 외모, 연애 성향, 지향 미사용
- 성별은 섞는 것이 기본, 여성 전용 테이블 옵션은 결정 필요
- 단톡방과 1:1 이름은 "Coffee?", "Reunion table"처럼 친구 사이의 말로
- 신고 사유에 "Treated this like a date" 포함
- 시작 화면과 테이블 규칙에 커플, 기혼자 환영과 "Not a dating app" 명시

## 디너 중: Table deck

| 라운드 | Topic table | Kindred table |
|---|---|---|
| 1 (10분) | Origins: "What did you almost do instead of business school?" | Origins: "Where’s home, and what do you miss about it?" |
| 2 (20분) | The split: 의견이 갈린 핫테이크로 반대편 변호하기 | Go deeper: "What’s something you’re proud of that nobody here would guess?" |
| 3 (20분) | Napkin startup: Sloan은 무엇을 만들지, HBS는 누가 돈을 낼지 | Plan the next one: 3주 안에 같이 할 일 하나, 그 자리에서 날짜 정하기 |
| 마지막 | 다시 보고 싶은 사람 선택 (다음 날 웹앱에서, 비공개) | 동일 |

- Kindred table의 3라운드가 재회로 이어지는 연결 고리

## 파일럿 (4주)

| 항목 | 계획 |
|---|---|
| 기간 | 수요일 4번, 3~4주차에는 금요일 Kindred table 추가 |
| 인원 | 80명(HBS 40, MIT 40), 주당 약 48명, 트랙마다 2테이블 |
| 모집 | 트랙별 클럽 4쌍, 클럽 리더가 Table captain |
| 장소 | Central Square 식당 2~3곳 (Harvard Square와 Kendall에서 한 정거장) |
| 비용 | 식사는 각자, 보증금 $10 (참석하면 반환) |
| 운영 | 첫 2주는 알고리즘 결과를 사람이 확인한 뒤 배정 |

### 성공 기준

| 지표 | 목표 |
|---|---|
| North star: 세 번째 만남 쌍 | 파일럿 기간 20쌍 이상 |
| 참석률 | 90% 이상 |
| 테이블 평점 | 4.3 / 5 이상 |
| 3주 안 재신청 | 60% 이상 |
| 서로 고른 쌍 | 참석자 절반 이상이 1명 이상과 매칭 |
| Kindred table 신청 | Topic table 참석자의 40% 이상 |

## 리스크

| 리스크 | 대응 |
|---|---|
| "친구 찾는 앱"이라는 민망함 | 입구는 주제, Kindred table은 한 번 다녀온 사람에게만 제안 |
| 트랙 4개로 인원 분산 | 트랙당 12명 미만이면 가까운 트랙과 합치기 |
| 한 번 만나고 끝나는 관계 | Host 필수, Plan the next one 라운드, 재회 테이블 |
| HBS 쪽의 대화 독점 | Spark 균형, 라운드마다 돌아가며 말하기 |
| 피칭이나 리크루팅 자리로 변질 | 테이블당 투자자 최대 2명, 피칭 금지 |
| 학교 이름 사용 | 학교 보증처럼 보이는 표현 금지, 학생처 규정 확인 |
| 퍼블릭 확장 후 분위기 변화 | 신청과 추천제, 동네 단위 오픈, 캠퍼스 멤버와 섞어 배정 |

## 정해야 할 것

1. 이름: Hash Table로 변경(2026-10-17), 그 전 이름은 Sidetable(2026-10-06), Tech Table은 SF의 Tech2Table과 겹쳐 제외, 퍼블릭 전 상표와 도메인 확인 필요
2. Kindred table 요일: 금요일(추천) 또는 일요일 브런치
3. 여성 전용 테이블: 파일럿부터, 캠퍼스 단계부터, 하지 않음 중 선택
4. 트랙 오픈: 클럽 4쌍이 모두 잡히면 동시에, 아니면 Generative AI와 Entrepreneurship 먼저
