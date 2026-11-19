# TeamFlow — React

중소기업용 통합 협업 시스템 (React 버전)

## 프로젝트 구조

```
src/
├── context/
│   └── AppContext.jsx      # 전역 상태 관리 (React Context)
├── components/
│   ├── Sidebar.jsx         # 사이드바 네비게이션
│   ├── Topbar.jsx          # 상단 바 + 알림
│   ├── Modal.jsx           # 모달 컴포넌트
│   └── Toast.jsx           # 토스트 알림
├── pages/
│   ├── Auth.jsx            # 로그인 / 회원가입
│   ├── Dashboard.jsx       # 대시보드
│   ├── Issues.jsx          # 이슈 관리 (목록 + 칸반)
│   └── OtherPages.jsx      # Projects, Meetings, CodeReview, Chat, Github, Stats
├── styles/
│   └── global.css          # 전역 스타일
├── App.jsx                 # 루트 컴포넌트
└── index.js                # 엔트리 포인트
```

## 시작하기

```bash
# 1. 의존성 설치
npm install

# 2. 개발 서버 실행
npm start

# 3. 빌드
npm run build
```

## GitHub에 올리기

```bash
git init
git add .
git commit -m "feat: TeamFlow React 초기 세팅"
git remote add origin https://github.com/본인계정/teamflow-app.git
git push -u origin main
```

## GitHub Pages 배포

```bash
# package.json에 homepage 추가 후
npm install --save-dev gh-pages
npm run build
npx gh-pages -d build
```
