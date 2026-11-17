// 제미나이(Gemini) AI에게 "보험증권 사진/PDF를 읽고 표로 정리해줘" 라고 부탁하는 부분
// API 키는 누나 휴대폰/컴퓨터 브라우저 안에만 저장돼요.

const GEMINI_PROMPT = `너는 한국 보험증권과 약관을 읽는 전문가야.
첨부된 보험증권(또는 약관)을 읽고 아래 JSON 형식 "하나만" 돌려줘. 설명 문장은 쓰지 마.

{
  "company": "보험사 이름",
  "product": "상품 이름",
  "type": "정액" 또는 "실손",
  "startDate": "YYYY-MM-DD (계약일/보장 시작일)",
  "endDate": "YYYY-MM-DD (만기일, 모르면 빈 문자열)",
  "premium": 월 보험료 숫자(원),
  "coverages": [
    {
      "name": "담보(보장) 이름 그대로",
      "category": "진단" | "수술" | "입원" | "통원" | "실손" | "사망" | "기타",
      "cause": "질병" | "상해" | "모두",
      "codes": ["해당 질병코드 범위, 예: C00-C97, I60-I69. 모든 질병이면 *"],
      "excludeCodes": ["제외되는 코드 범위 (없으면 빈 배열)"],
      "amount": 가입금액 숫자(원). 입원일당은 하루 금액, 실손은 한도,
      "waitingDays": 면책기간 일수 (서류에 없으면 null),
      "reductionYears": 감액기간 년수 (서류에 없으면 null),
      "reductionRate": 감액기간 지급비율 (예: 0.5),
      "smallCancerCodes": ["소액암으로 분류되는 코드, 예: C73, C44"],
      "smallCancerRate": 소액암 지급비율 (예: 0.2),
      "deductDays": 입원일당 공제 일수 (예: 3일 초과부터면 3),
      "selfPayRate": 실손 본인부담률 (예: 0.2),
      "minDeduct": 실손 최소 공제금액(원),
      "note": "중요한 조건을 쉬운 말로 한 줄",
      "source": "근거 위치, 예: 약관 제3조(보험금 지급사유) p.45 / 증권 2쪽"
    }
  ]
}

서류 읽는 법:
- [보험증권]에서: 보험사, 상품명, 계약일, 만기일, 월 보험료, 담보 이름과 가입금액을 가져와.
- [약관]에서: 각 담보의 질병코드 범위(분류표), 면책기간, 감액기간·비율, 소액암·유사암 분류, 입원 공제일, 실손 본인부담률을 찾아.
- 증권의 담보 이름과 약관의 담보 이름을 짝지어서 하나의 coverage로 합쳐.
- 증권과 약관이 다르면 금액은 증권을, 규칙은 약관을 믿어.

규칙:
- 금액은 "3,000만원" → 30000000 처럼 숫자로 바꿔.
- source에는 찾은 근거 위치를 꼭 적어.
- 절대 추측하지 마. 서류에 실제로 적힌 것만 써.
- 서류에서 못 찾은 값은 null(코드는 빈 배열 [])로 두고, note에 "확인 필요: 무엇"이라고 써.
- 모든 질병/상해를 보장한다고 서류에 적혀 있을 때만 codes를 ["*"]로 써.`;

async function fileToBase64(file) {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(binary);
}

const INLINE_LIMIT = 15 * 1024 * 1024; // 15MB 넘으면 "파일 업로드" 방식으로 보내요

// 큰 파일(두꺼운 약관)은 제미나이 파일 창고에 먼저 올리고 주소만 전달
async function uploadToGemini(apiKey, file) {
  const base = "https://generativelanguage.googleapis.com";
  const start = await fetch(`${base}/upload/v1beta/files`, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(file.size),
      "X-Goog-Upload-Header-Content-Type": file.type || "application/pdf",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: file.name || "document" } }),
  });
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!start.ok || !uploadUrl) throw new Error("큰 파일 업로드를 시작하지 못했어요. 파일을 나눠서(15MB 이하) 올려보세요.");
  const up = await fetch(uploadUrl, {
    method: "POST",
    headers: { "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize" },
    body: file,
  });
  if (!up.ok) throw new Error(`파일 업로드 실패 (${up.status})`);
  let info = (await up.json()).file;
  for (let i = 0; i < 30 && info.state === "PROCESSING"; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    info = await (await fetch(`${base}/v1beta/${info.name}`, { headers: { "x-goog-api-key": apiKey } })).json();
  }
  if (info.state === "FAILED") throw new Error("제미나이가 파일을 처리하지 못했어요.");
  return { file_data: { mime_type: info.mimeType || file.type, file_uri: info.uri } };
}

async function filePart(apiKey, file) {
  if (file.size > INLINE_LIMIT) return uploadToGemini(apiKey, file);
  return { inline_data: { mime_type: file.type || "application/pdf", data: await fileToBase64(file) } };
}

// policyFile = 증권, termsFile = 약관, text = 붙여넣은 글
async function askGemini({ apiKey, model, policyFile, termsFile, text, onStep }) {
  if (!apiKey) throw new Error("설정 탭에서 Gemini API 키를 먼저 넣어주세요.");
  const step = onStep || (() => {});
  const parts = [{ text: GEMINI_PROMPT }];
  if (policyFile) { step("📄 증권 준비 중..."); parts.push({ text: "[보험증권]" }, await filePart(apiKey, policyFile)); }
  if (termsFile) { step("📘 약관 준비 중... (두꺼우면 조금 걸려요)"); parts.push({ text: "[약관]" }, await filePart(apiKey, termsFile)); }
  if (text) parts.push({ text: "[붙여넣은 내용]\n" + text });

  step("🤖 제미나이가 읽는 중이에요... (30초~2분)");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model || "gemini-2.5-flash")}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: "application/json", temperature: 0.1 } }),
  });
  if (!res.ok) throw new Error(`제미나이 응답 오류 (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const out = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  const jsonText = out.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  return JSON.parse(jsonText);
}
