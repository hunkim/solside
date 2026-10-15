# Solside

Electron 기반 AI 브라우저 (Solside 스타일).

## 실행
```
npm install
cp .env.example .env   # AI_API_KEY 입력
npm start              # 리눅스 root/컨테이너면: npm run start:nosandbox
```
환경변수: AI_BASE_URL(기본 openrouter), AI_API_KEY, AI_MODEL(기본 upstage/solar-pro4). 키는 코드에 없고 .env(gitignore)에서만 읽음.

## 구현됨
- 탭(WebContentsView), 주소창(URL/검색), 뒤로/앞으로/새로고침, 새 탭/닫기, 영구 세션(persist:solside, 로그인 유지), Ctrl+T/Ctrl+L
- 북마크 사이드바(userData/bookmarks.json)
- AI 패널: 페이지 요약, 질의응답, 도구 호출 에이전트(get_page_text/click/type/scroll/navigate/finish, 최대 12단계), 키 없으면 안내 표시
- 최근 작업 목록(userData/tasks.json, 클릭하면 프롬프트 재입력)

## 미구현/한계
- 실제 LLM 호출은 API 키가 없어 end-to-end 검증 못함
- 에이전트 확인(승인) 단계 없음, 스크린샷/비전 없음, iframe·shadow DOM 요소 조작 불가
- 히스토리, 다운로드 UI, 시크릿 모드, 탭 드래그, 확장 프로그램, 패널 리사이즈 없음
- 페이지 내용 기반 프롬프트 인젝션 위험: 로그인된 사이트 조작 시 주의

`npm run smoke` : 키 누락 처리 스모크 테스트. `npm run check` : 구문 검사.
