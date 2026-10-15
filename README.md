# Solside

Upstage Solar 기반 AI 브라우저 프로토타입(Electron)과 랜딩 사이트입니다. Aside에서 영감을 받은 비공식 프로젝트입니다.

- `app/`: Electron 앱. `cd app && npm install && cp .env.example .env`(UPSTAGE_API_KEY 입력, 또는 앱의 ⚙ 설정에서 입력) 후 `npm start`.
- `site/`: 정적 랜딩 사이트와 Node 서버(`node server.js`). 다운로드 파일은 `site/downloads/`에 두며 저장소에는 포함하지 않습니다.

## 맥에서 서명된 DMG 빌드
`cd app && npm run dist:mac`. Developer ID 인증서가 키체인에 있으면 자동 서명됩니다. 공증은 `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` 환경변수를 사용하세요. 비밀 값은 코드에 넣지 마세요.

## 다운로드
서명·공증된 DMG는 [Releases](https://github.com/hunkim/solside/releases)에 있습니다. Vercel 배포는 Root Directory를 `site`로 지정하세요.
