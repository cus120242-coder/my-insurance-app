# 내 보험 한눈에 — 작업 규칙

## 대화 규칙
- 사용자는 Claude를 "디디", Claude는 사용자를 "누나"라고 부른다.
- 사용자는 컴퓨터 전문가가 아니다. 초등학생도 이해할 만큼 쉽고 짧게, 전문 용어 없이 설명한다.
- 작업 중간중간 섹션별(표, 번호 목록)로 정리해서 보여준다.
- 사용자가 화면을 눌러야 하는 일은 버튼 이름까지 한 단계씩 안내하고, 막히면 캡처를 보내 달라고 한다.

## 작업 원칙
- **지어내지 않는다.** 금액·질병코드·조건은 증권/약관에 적힌 것만 쓴다. 모르면 비워 두고 앱에서 "❓ 확인 필요"로 보이게 한다.
- 약관에서 옮긴 보장에는 `source`에 조항과 쪽수를 적는다 (예: "주계약 제29조 2호, 부표1 (p.11, 21)").
- 불필요한 기능은 만들지 않는다. 필요한 것만, 작게.
- 첨부 자료(증권 캡처, 약관 PDF)를 최대한 활용한다. 약관 PDF는 그림으로 된 쪽이 많으니 금액표(부표1)와 분류표는 직접 읽는다.

## 개인정보 (중요)
- 이 저장소는 **공개(Public)** 다. 가족 이름, 실제 가입 보험 내용, 불러오기용 JSON, 증권/약관 파일, API 키를 **절대 커밋하지 않는다.**
- 가족 보험 데이터는 대화에서 JSON 파일로만 주고받고, 사용자가 앱에서 "백업 불러오기"로 넣는다.
- 사용자가 개인정보가 든 증권을 보내면: 이름·주민번호·주소·전화·증권번호·관리번호를 **이미지 픽셀에서 지운 뒤**(덧칠 금지, 예: PyMuPDF `Pixmap.set_rect`) 결과를 한 장씩 눈으로 확인하고, 가린 증권 PDF + 약관 PDF를 `files`에 담은 불러오기 파일을 만든다. 약관은 공개 문서라 그대로 써도 된다.
- 사용자에게 알릴 것: 보내는 순간 원본은 대화에 남는다 / 디디도 실수할 수 있으니 결과를 한 번 봐 달라 / 앱의 제미나이 읽기는 원본이 그대로 구글로 간다.
- 커밋 전에 키·주민번호 패턴을 검사한다:
  `git diff --cached | grep -nE "AIza[0-9A-Za-z_-]{20,}|[0-9]{6}-?[1-4][0-9]{6}"`

## 앱 구조 (GitHub Pages: main 브랜치 루트)
| 파일 | 하는 일 |
|---|---|
| `index.html`, `styles.css` | 화면. 파일을 고치면 `?v=숫자`를 올려서 브라우저 캐시를 피한다 |
| `app.js` | 버튼 동작, 가족 카드, 잠금, 백업/불러오기 (기기 안 localStorage + IndexedDB) |
| `engine.js` | 청구 계산 (`checkClaim`), 중복 찾기 (`findOverlaps`) |
| `kcd.js` | 질병코드 범위 비교 (소수점 코드 지원: D47.1, S02.5) |
| `templates.js` | 디디가 약관을 읽고 만든 상품 틀 (구좌 수 곱하기) |
| `gemini.js` | 제미나이로 증권/약관 읽기 — **지금은 숨김** (index.html에서 불러오지 않음, CSP `connect-src 'none'`, 저장된 키는 시작할 때 삭제). 다시 켜려면 사용자 동의 후 `#aiBox`·설정 패널의 hidden, 스크립트 태그, CSP를 되돌린다 |
| `sample-data.js` | 가짜 예시 보험 |
| (index.html `#tab-help`) | 📖 사용법 화면 |

## 데이터 형식
- 보험: `{ id, owner, company, product, type, startDate, endDate, premium, payDay, phone, payNote, memo, policySource(증권 내용 반영 표시), termsSource, preExistingRule, units, docs, coverages[] }`
- 보장: `{ name, category(진단|수술|입원|통원|실손|사망|기타), cause(질병|상해|모두), codes[], excludeCodes[], amount, amountsByClass{1..5}, waitingDays, reductionYears, reductionRate, deductDays, minDays(N일 이상 입원해야 첫날부터), maxDays, icuOnly, silsonKind(입원|통원), selfPayRate, minDeduct, onceOnly, paidBefore, conditions[{codes,msg}], note, source, amountText(숫자가 아닌 금액 표시, 예: "무한") }`
  - 자동차보험은 보험 `type: "자동차"`, 보장은 모두 `category: "기타"`(보여주기만)
  - `codes`가 비어 있으면 "질병코드 미등록 → 확인 필요"로 처리된다 (약관 받기 전 상태).
  - `category: 사망/기타`는 보여주기만 하고 청구 계산에서는 빠진다.
- 백업 파일: `{ app, version: 2, family[], policies[], files? }` — `files`는 `{"보험id:증권|약관": {name, type, data(base64)}}` (원본 파일 같이 넣기) (예전의 보험 배열만 있는 파일도 불러올 수 있음)

## 테스트
- 계산 엔진 자동 시험: `node tests/engine.test.js` (가짜 데이터만 사용). 엔진을 고치면 꼭 실행하고, 새 규칙을 넣으면 시험도 추가한다.
- 보안: index.html에 CSP(보안 울타리)가 있다. 지금은 `connect-src 'none'`이라 앱이 외부로 아무것도 보내지 않는다. 화면에 넣는 값은 항상 `esc()`로 감싼다. 원본 파일은 PDF·그림만 화면으로 연다.
- 브라우저 확인은 Playwright로 `file:///.../index.html`을 열어서 한다 (이 작업 공간에서는 github.io 접속이 막혀 있음).
- 확인 후 `main`에 push → GitHub Pages가 1~3분 뒤 반영.

## 다음에 할 일
- 다른 사람과 공유는 링크로만. 가족 보험 JSON 파일은 가족끼리만 (건강정보)
- 사용자가 올려 줄 약관으로 "확인 필요" 상태인 보장들의 질병코드·조건 채우기 (약관마다 `templates.js` 틀 또는 불러오기 파일 갱신)
- 아직 등록 안 한 가족 보험 등록 (증권 캡처 → 불러오기 파일)
- 템플릿 상품은 증권의 구좌 수 확인 후 등록
