# Sidetable

하버드와 MIT에서 시작하는 테크 커뮤니티 플랫폼. 관심사가 맞는 4~6명이 작은 저녁 테이블로 꾸준히 다시 만나요.

| 폴더, 파일 | 내용 |
|---|---|
| `app/` | 앱 전체 (Node 서버, 웹앱, 관리자 페이지, 식당 페이지, 테스트, 데모 빌드). 자세한 설명은 [app/README.md](app/README.md) |
| `CONCEPT.md` | 제품 컨셉과 설계 원칙 |
| `BUSINESS.md` | 사업 모델, 경쟁, 식당 운영 조사 |
| `sixtop.html` | 초기 디자인 프로토타입 (참고용) |

## 바로 실행해보기

Node 18 이상이면 돼요. 설치할 패키지는 없어요.

```bash
cd app
npm run seed      # 샘플 회원 40명과 테이블을 만들어요 (가짜 데이터)
npm run dev       # http://localhost:8800, 터미널에 샘플 회원 링크와 관리자 키가 나와요
npm test          # 서버 테스트
npm run demo      # 폰 데모 한 파일 빌드 (dist/sixtop-demo.html)
```

- `app/data/`(회원 데이터, 사진, 푸시 키)와 `app/dist/`(빌드 결과)는 레포에 없어요. 위 명령으로 다시 만들어요.
- 비밀 값(관리자 키, Resend 키)은 코드에 없고 환경 변수로 넣어요. 목록은 app/README.md의 "실제 파일럿 실행"에 있어요.
- 샘플 회원의 얼굴은 AI로 만든 이미지이고 실제 인물이 아니에요.
