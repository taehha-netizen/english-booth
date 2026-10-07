# english-booth
영어부스 운영에 필요한 앱을 만드는 공간

## 🏰 Welcome to Hogwarts (마법학교 영어 체험 부스)

「2026 도전! 영어인증 한마당」 초등 체험 부스용 웹앱입니다.
설치 없이 브라우저(크롬 권장)에서 바로 실행됩니다.

| 단계 | 앱 | 하는 일 |
|---|---|---|
| 2 | 🎩 `sorting.html` Sorting Ceremony | 영어 질문 4개 → 모자가 기숙사 추천 → 학생이 최종 선택(Your Choice) |
| 3 | 🪄 `spell.html` Spell Challenge | 그림 보고 영어 단어 말하기 (음성 인식, Beginner/Advanced) |
| 4 | 🗝️ `forbidden.html` Forbidden Room | 단서 듣고 물건 찾기 ("Don't touch the ...!") → 위치를 문장으로 말하기 |
| 5 | 🥤 `final.html` Final Spell | 컵스택 영어 지시문 보여주기·읽어주기 (원어민 부재 시 대체) |

첫 화면 `index.html`의 **선생님 메뉴**에서 참여 현황(기숙사별 인원 등), 읽어주기 속도, 소리·마이크 점검을 할 수 있습니다.

### 사용 방법
1. 태블릿에서 **크롬**으로 접속 (음성 인식은 크롬 + 인터넷 연결 필요)
2. 처음 🎤를 누르면 마이크 권한 **허용**
3. 마이크가 안 될 때는 선생님이 **✔ 통과** 버튼으로 진행

### 단어·질문 바꾸기
각 HTML 파일 위쪽의 목록(`WORDS`, `QUESTIONS`, `SPOTS`, `ITEMS`, `SETS`)만 고치면 됩니다.

### 로컬 실행
```bash
python3 -m http.server 8000   # → http://localhost:8000
```
