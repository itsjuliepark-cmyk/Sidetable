# Sidetable: 보스턴에서 찐친 찾기 (컨셉 v0.2)

> 앱 이름은 Sidetable이에요(2026-10-06). 큰 행사 옆의 작은 테이블, 사이드 프로젝트 얘기, 본론보다 깊어지는 옆자리 대화라는 뜻이에요. 앱 안의 테이블 이름(tech table, social table)은 그대로예요.
> 프로토타입: [sixtop.html](sixtop.html) (브라우저로 열면 왼쪽에 화면 목록과 설명이 있어요)
> 사업화 검토: [BUSINESS.md](BUSINESS.md)
> 실제로 돌아가는 파일럿 앱: [app/README.md](app/README.md)

## v0.2에서 정해진 것

| 항목 | 결정 |
|---|---|
| Amie와의 관계 | **완전히 분리.** 엔진, 서버, 디자인, 말투만 가져와요 |
| 시작 | Harvard × MIT. **양쪽 테크 클럽과 공식 협업** |
| 장기 목표 | **Greater Boston 퍼블릭 런칭** |
| 첫 주제 | Tech 안의 4개 트랙: **Generative AI, Healthcare AI, Entrepreneurship, Climate** |
| 매칭 | 주제만이 아니라 **사람끼리 잘 맞는지(찐친 핏)**도 같이 봐요 |

## 한 줄 정의

**큰 모임에 지친 사람들을 위해, 정말 좋아하는 주제와 잘 맞을 사람으로 4~6인 디너 테이블을 만들어주는 앱.**

- 슬로건: *Six seats. Both sides of the Charles.* 찰스강은 HBS와 MIT 사이에도, Boston과 Cambridge 사이에도 흘러서 퍼블릭 런칭 때도 그대로 쓸 수 있어요.
- 보조 문구: *Fewer people. Better conversations.*

### 누구를 위한 앱인가

| 이런 사람 | 지금 겪는 것 |
|---|---|
| 큰 리셉션, 믹서, 클럽 행사에 지친 사람 | 200명 방에서 명함만 바꾸고 아무도 다시 안 만나요 |
| 깊은 대화를 하고 싶은 사람 | 스몰톡만 하다 집에 와요 |
| 보스턴에 새로 왔거나, 졸업 후에도 남는 사람 | 학교 밖 친구가 없어요 |
| 커플·기혼자 | 데이팅 앱 냄새가 나는 모임에는 못 가요 |

## 핵심 설계 1: 주제는 입구, 찐친은 엔진

"친구 사귀기 모임"에는 사람들이 신청을 망설여요. 외로워 보일까 봐서요. 그런데 **"Healthcare AI 디너"에는 부담 없이 신청해요.** 명분이 있으니까요.

그래서 이렇게 가요.
1. **입구는 주제예요.** 첫 테이블은 Topic table이에요. 테크 클럽과 협업하기도 자연스러워요.
2. **매칭 엔진은 처음부터 사람 핏을 같이 봐요.** 같은 주제를 좋아하는 사람 중에서도 나랑 잘 맞을 사람을 앉혀요.
3. **신뢰가 생기면 Kindred table을 열어요.** 첫 테이블에 다녀온 사람에게 "주제와 상관없이, 당신과 잘 맞을 다섯 명을 찾았어요"를 보여줘요.

## 핵심 설계 2: 두 겹의 프로필, 두 종류의 테이블

### 프로필

| 층 | 무엇 | 어떻게 받나 |
|---|---|---|
| **A. What you love** | 트랙, 세부 관심사, 앵글(만드는/투자하는/운영하는/연구하는/넘어오는 쪽), 핫테이크 | 칩 선택, 핫테이크 3개 |
| **B. How you connect** | Friend Persona(4축), 만남 리듬, 생활 단계, 같이 하고 싶은 활동, 찾는 관계 | **Friend test**: Amie 테스트의 친구 버전 |

### 테이블

| | **Topic table** | **Kindred table** |
|---|---|---|
| 한 줄 | 같은 주제에 꽂힌 사람들 | 진짜 친구가 될 것 같은 사람들 |
| 매칭 비중 | 주제 60 : 사람 40 | 주제 20 : 사람 80 |
| 주제 | 트랙 하나 (예: Healthcare AI) | 6명의 교집합에서 Charlie가 대화 씨앗을 골라요 |
| 요일 | 수요일 19:30 | 금요일 19:30 |
| 열리는 시점 | 처음부터 | 첫 테이블 이후 (파일럿 3주차부터) |
| Table deck | Origins → The split → Napkin startup | Origins → Go deeper → Plan the next one |
| 다음 단계 | 같은 트랙 다음 테이블, 1:1 커피 | 재회 테이블 → 단골 모임(크루) |

두 테이블 모두 HBS와 MIT를 반씩 섞어요(퍼블릭 이후에는 동네·학교·직장을 섞어요).

## 데이팅에서 찐친으로 바꿀 때 달라지는 것

| | Amie (데이팅) | Sidetable (찐친) |
|---|---|---|
| 보는 것 | 끌림, 외모 취향, 연애 스타일, 딜브레이커 | **유머, 대화 깊이, 만남 리듬, 주도성, 생활 단계, 같이 할 활동** |
| 닮음 vs 다름 | 일부 축은 다를수록 좋음 (리드/따라감) | **대부분 닮을수록 좋아요.** 친구는 비슷한 사람끼리 돼요. 다를수록 좋은 건 두 가지뿐: 말하는 사람/듣는 사람, 약속 잡는 사람/따라가는 사람 |
| 단위 | 1:1 | **그룹 먼저.** 1:1은 서로 고른 경우에만, "커피"로 |
| 성공 | 한 번 매칭되면 성공 | **여러 번 다시 만나야 성공.** 친구는 시간이 만들어요 |
| 사진 | 매칭의 핵심 | 식당에서 알아보는 용도만. 매칭에 안 써요 |
| 성별 | 성별·지향 필터 | **섞는 게 기본.** 연애 상태는 "생활 단계"로만 받아요 |
| 결과 | Love Persona | **Friend Persona** |

### 근거

- **친구가 되는 데는 시간이 들어요.** Jeffrey Hall(2019, *Journal of Social and Personal Relationships*)에 따르면 아는 사이에서 가벼운 친구까지 약 50시간, 친구까지 약 90시간, 가까운 친구는 200시간 이상이 걸려요. 디너 한 번은 3시간이에요. 그래서 **반복을 설계해야 해요.**
- **비슷한 사람끼리 친구가 돼요.** 사회학의 homophily(McPherson 외, 2001). 가치관, 유머, 생활 단계가 비슷할수록 관계가 오래가요.
- **자기 개방을 조금씩 높이면 빨리 가까워져요.** Aron 외(1997)의 "36 questions" 실험에서는 처음 만난 두 사람이 45분 만에 꽤 가까워졌어요. 이걸 Table deck 라운드 순서에 써요.

## Friend test (약 3분)

Amie처럼 상황 질문을 던지고, 맨 위 **"Charlie is reading you"** 패널이 답마다 움직여요.

### 4축 → Friend Persona 16유형

| 축 | 양 끝 | 매칭에서 |
|---|---|---|
| 대화에서 | **Spark** (먼저 꺼냄) ↔ **Listen** (잘 들음) | 섞어요. 테이블당 Spark 1~3명 |
| 원하는 대화 | **Deep** ↔ **Playful** | **비슷하게.** 깊이 기대치가 다르면 둘 다 지루해요 |
| 약속 | **Host** (약속을 잡음) ↔ **Guest** (잘 따라옴) | **테이블마다 Host 최소 1명.** 없으면 아무도 다시 안 만나요 |
| 우정의 모양 | **Ritual** (늘 가던 곳) ↔ **Adventure** (새로운 것) | 비슷하게 |

예시 유형:

| 코드 | 이름 | 한 줄 |
|---|---|---|
| S·D·H·R | The Hearth Keeper | 다들 아직도 얘기하는 디너를 여는 사람. 그것도 매달 |
| S·P·H·A | The Instigator | "잠깐, 우리 이거 해볼까?"로 최고의 밤이 시작돼요 |
| L·D·G·R | The Confidant | 두 시간, 친구 한 명, 폰 없이. 그게 당신의 밤 |
| L·D·H·A | The Curator | 작은 전시, 숨은 바, 책 한 권을 찾아서 한 명을 데려가요 |
| L·P·H·R | The Group-Chat Keeper | 단톡방을 살리고, 생일을 챙기고, 밈을 돌려요 |
| L·P·G·A | The Easy Yes | 드라마 없이, 재미있게, 언제든 OK |

### 질문 (축 4문항 + 생활 1화면)

| # | 질문 | 주로 재는 것 |
|---|---|---|
| 1 | 금요일 7시, 약속이 깨졌어요. 당신은? | Host/Guest, Spark/Listen |
| 2 | 새벽 2시까지 깨어 있을 수 있는 대화는? | Deep/Playful |
| 3 | 단톡방이 2주째 조용해요. 당신은? | Host/Guest |
| 4 | 친구들과의 이상적인 토요일은? | Ritual/Adventure |
| 5 | 생활 화면: 친한 친구를 얼마나 자주 보고 싶은지, 지금 생활 단계(보스턴에 새로 옴, 연애 중, 결혼, 부모, 유학생, 졸업 후에도 보스턴), 같이 하고 싶은 활동(찰스강 러닝, 클라이밍, 요리, 셀틱스 등), 찾는 관계(매달 보는 크루 / 가까운 친구 한두 명 / 생각을 나눌 사람 / 같이 놀 사람) | 비슷하게 맞추고, 활동은 디너 다음 약속의 재료로 써요 |

### 사람 핏 점수

| 요소 | 가중치 | 방향 |
|---|---|---|
| 대화 깊이 (Deep/Playful) | 20% | 비슷하게 |
| 만남 리듬 + 찾는 관계 | 20% | 비슷하게 (매주 보고 싶은 사람과 한 달에 한 번이 좋은 사람은 엇갈려요) |
| 생활 단계 | 15% | 비슷하게 (아이 있는 사람끼리, 새로 온 사람끼리) |
| 같이 할 활동 겹침 | 15% | 많이 겹칠수록. 디너 다음 약속이 쉬워져요 |
| Ritual/Adventure | 10% | 비슷하게 |
| Spark/Listen 균형 | 10% | 섞기 |
| Host 있음 | 10% | 테이블에 1명 이상 (없으면 하드 룰 위반) |

주제 핏(관심사 겹침, 핫테이크 갈림, 앵글 섞기)은 v0.1 그대로예요.

## 찐친까지 가는 사다리

| 단계 | 무엇 | 언제 |
|---|---|---|
| 1. 첫 테이블 | Topic table | 1주차 |
| 2. See again? | 서로 고른 사람을 확인해요. 고르지 않은 건 아무도 몰라요 | 다음 날 아침 |
| 3. **Round two** | 테이블 대부분이 yes면 **같은 요일 2주 뒤 같은 장소**로 바로 예약. 빈 의자 최대 2개는 새 얼굴 | 3주차 |
| 4. **Round three, 단골 테이블** | round two에서도 yes면 또 2주 뒤. 서로 고른 사람은 같은 저녁을 고르면 같이 앉혀요 | 2~3개월 |
| 4½. **Long table** | 매달 마지막 목요일, 그 달 테이블에 앉은 사람 모두 한 자리에 | 매달 |
| 5. 디너 밖 약속 | 활동이 겹치면 Charlie가 가볍게 제안해요 ("Priya도 달려요. 토요일 8시 찰스강 한 바퀴?") | 언제든 |

테이블 사이는 "Before your next table" 한 줄로 이어져요. 다음 테이블이 그걸 보고 묻고, 다음 날 아침 Done을 체크해요.

1:1은 서로 고른 경우에만 열고, 이름도 "Coffee?"예요. 데이트처럼 느껴지지 않게요.

**North star: 같은 사람과 세 번째로 만난 쌍의 수.** 친구가 되고 있다는 가장 가까운 신호예요.

## 테크 4개 트랙

| 트랙 | 세부 관심사 | 협업할 클럽 (양쪽) | 핫테이크 예시 |
|---|---|---|---|
| **Generative AI** | AI agents, Foundation models, AI products & UX, AI & the future of work, Developer tools, AI policy & safety | 테크·AI 클럽 | "AGI arrives before our 10-year reunion." |
| **Healthcare AI** | Clinical AI, Drug discovery & bio, Digital health, Health systems & payers, Medtech & devices, Mental health | 헬스케어 클럽 | "Hospitals will buy AI long before doctors trust it." |
| **Entrepreneurship** | Finding a cofounder, Fundraising, Consumer, B2B & SaaS, Lab spinouts, Search funds & ETA | 창업 클럽 | "You should start a company right out of school." |
| **Climate** | Energy & the grid, Carbon removal, Climate fintech, Mobility & EVs, Food & ag, Climate policy | 에너지·기후 클럽 | "AI’s power demand is a climate opportunity, not a problem." |

**운영 룰:** 한 주에 트랙마다 HBS 6명 + MIT 6명(두 테이블)이 안 모이면, 그 주는 가장 가까운 트랙과 합쳐요(예: Healthcare AI ↔ Generative AI). 테이블이 덜 찬 채로 열리는 것보다 나아요.

## 테크 클럽 공식 협업

| | 내용 |
|---|---|
| 클럽이 얻는 것 | 큰 행사 다음의 **소그룹 후속 프로그램을 운영 부담 없이** 가져가요. HBS×MIT 공동 프로그램이라는 이야기도 생겨요. 참석 데이터는 집계로만 공유해요 |
| 우리가 얻는 것 | 첫 모집, 신뢰, 클럽 뉴스레터·슬랙 채널 |
| 형태 | 트랙마다 양쪽 클럽 한 쌍. 예: "Healthcare Club × Sidetable: Healthcare AI tables" |
| 클럽 리더 역할 | 첫 2주 동안 **Table captain**. 테이블마다 1명이 앉아서 분위기를 잡아요 |
| 요청할 것 | 학기 중 4번의 수요일, 각 클럽 채널에 공지 2번, 선택 사항으로 첫 디너 디저트 지원 |
| 피치 한 줄 | "Your big events fill the room. We make sure people meet again." |

**확인할 것:** 학생 클럽은 영리 서비스와의 공동 브랜딩에 학교 규정이 있을 수 있고, Harvard·MIT 이름과 로고는 쓰는 데 제한이 있어요. **학교가 보증하는 것처럼 보이면 안 돼요.** 파일럿 전에 양쪽 학생처(student life) 규정을 확인해요.

## Harvard × MIT → Greater Boston

| 단계 | 언제 (예시) | 누구 | 인증 | 다음 단계로 가는 조건 |
|---|---|---|---|---|
| 0. 파일럿 | 2026 가을 | HBS × MIT Sloan, 테크 4트랙 | 학교 이메일 | 참석률 90%, 재신청 60%, 재회 테이블 성사 |
| 1. 캠퍼스 | 2027 봄 | Harvard·MIT 대학원 전체 + 박사후연구원. Kindred table 정식 오픈, 테크 밖 룸 2개 | 학교 이메일 | 세 번째 만남 쌍이 꾸준히 늘어남 |
| 2. 보스턴 학교 + 동문 | 2027 가을 | Tufts, BU, Northeastern, BC 등 대학원 + 보스턴에 사는 동문 | 학교·동문 이메일 | 동네별로 테이블이 매주 찰 만큼 |
| 3. Greater Boston | 2028 | 22세 이상 누구나. **신청 + 기존 회원 추천** | 신분증 + 셀피 + 직장/LinkedIn | — |

퍼블릭으로 갈 때 지켜야 할 것:
- **처음 멤버가 문화를 만들어요.** 캠퍼스 단계의 Host 유형과 Table captain이 퍼블릭 초기 테이블에 섞여 앉아요.
- **동네 단위로 열어요.** Cambridge, Back Bay, South End, Seaport, Somerville 순으로, 동네마다 식당 2~3곳과 고정 6인석을 잡아요.
- **룸을 넓혀요.** Tech 다음은 Books & Ideas, Food & Boston, Running & Outdoors처럼 학교 밖 사람도 공감하는 주제예요.
- 퍼블릭 회원은 학생보다 기꺼이 돈을 내요. 수익은 3단계부터가 본격이에요(월 멤버십).

## 데이팅처럼 보이지 않게

- 매칭에 외모, 연애 성향, 지향을 쓰지 않아요.
- 성별은 섞는 게 기본이에요. **여성 전용 테이블을 옵션으로 둘지**는 정해야 해요(친구 앱에서는 흔한 요구예요).
- 단톡방과 1:1의 이름을 "Coffee?", "Reunion table"처럼 친구 언어로 써요.
- 신고 사유에 "Treated this like a date"를 넣어요.
- 커플·기혼자 환영 문구를 시작 화면에 둬요. 테이블 규칙에도 "Not a dating app"이 있어요.

## 디너 중: Table deck

| 라운드 | Topic table | Kindred table |
|---|---|---|
| 1 (10분) | **Origins**: "What did you almost do instead of business school?" | **Origins**: "Where’s home, and what do you miss about it?" |
| 2 (20분) | **The split**: 테이블이 갈린 핫테이크, 반대편 변호하기 | **Go deeper**: "What’s something you’re proud of that nobody here would guess?" 듣는 사람이 질문 하나씩 |
| 3 (20분) | **Napkin startup**: Sloan은 뭘 만드는지, HBS는 누가 돈을 내는지 | **Plan the next one**: 3주 안에 같이 할 것 하나. 그 자리에서 Host와 날짜를 정해요 |
| 마지막 | Who do you want to see again? (다음 날 앱에서, 비공개) | 같음 |

Kindred의 3라운드가 사다리 3단계(재회)로 이어지는 장치예요.

## 파일럿 (4주)

| 항목 | 계획 |
|---|---|
| 기간 | 4번의 수요일 + 3·4주차 금요일 Kindred table |
| 인원 | 80명 모집 (HBS 40 + MIT 40). 주당 약 48명 → 트랙마다 2테이블 |
| 모집 | 트랙별 클럽 4쌍 + 클럽 리더 Table captain |
| 장소 | Central Square 식당 2~3곳 (Harvard Sq에서 한 정거장, Kendall에서 한 정거장) |
| 비용 | 식사는 각자, 보증금 $10 (오면 반환) |
| 운영 | 첫 2주는 알고리즘 결과를 사람이 확인하고 배정 |

### 성공 기준

| 지표 | 목표 |
|---|---|
| **North star: 세 번째 만남 쌍** | 파일럿 끝까지 20쌍 이상 |
| 참석률 | 90% 이상 |
| 테이블 평점 | 4.3 / 5 이상 |
| 다시 신청 (3주 안) | 60% 이상 |
| See again 상호 선택 | 참석자 절반 이상이 1명 이상 |
| Kindred table 신청 | Topic table 참석자의 40% 이상 |

## 리스크

| 리스크 | 대응 |
|---|---|
| "친구 찾는 앱"이라는 민망함 | 입구는 주제. Kindred는 한 번 다녀온 사람에게만 권해요 |
| 트랙 4개로 인원이 흩어짐 | 트랙당 12명 미만이면 가까운 트랙과 합쳐요 |
| 한 번 만나고 끝 | Host 하드 룰, Plan the next one 라운드, 재회 테이블 |
| HBS 쪽이 말을 다 함 | Spark 균형, 라운드마다 돌아가며 말하기 |
| 피칭·리크루팅 자리화 | 투자자 최대 2명, "No pitching" 규칙 |
| 학교 이름 사용 문제 | 학교 보증처럼 보이는 표현 금지, 학생처 규정 확인 |
| 퍼블릭 확장 때 분위기 변화 | 신청 + 추천제, 동네 단위 오픈, 캠퍼스 멤버를 섞어 앉힘 |

## 정해야 할 것

1. **이름**: Sidetable(2026-10-06). Sidetable은 SF의 Tech2Table과 겹쳐서 바꿨어요. 웹 검색으로는 같은 이름의 서비스가 안 보였지만, 퍼블릭 전에 USPTO 상표 검색과 도메인 확인을 해요
2. **Kindred table 요일**: 금요일(추천) / 일요일 브런치
3. **여성 전용 테이블 옵션**: 파일럿부터 / 캠퍼스 단계부터 / 안 함
4. **트랙 4개 동시 오픈 vs 2개 먼저**: 클럽 4쌍이 다 잡히면 동시, 아니면 Generative AI + Entrepreneurship 먼저
