// 질병코드(KCD) 사전 + 코드 범위 비교 도구
// 자주 쓰는 코드만 넣은 "작은 사전"이에요. 필요하면 계속 추가하면 돼요.

const KCD_DICT = [
  // 범위(큰 묶음) — 구체적인 코드가 없을 때 이 이름을 보여줘요
  { code: "A00-B99", name: "감염병·기생충 질환" },
  { code: "C00-C97", name: "암 (악성신생물)" },
  { code: "D00-D09", name: "제자리암 (상피내암)" },
  { code: "D37-D48", name: "경계성 종양" },
  { code: "E00-E90", name: "내분비·대사 질환" },
  { code: "F00-F99", name: "정신·행동 장애" },
  { code: "G00-G99", name: "신경계 질환" },
  { code: "I00-I99", name: "순환기(심장·혈관) 질환" },
  { code: "I60-I69", name: "뇌혈관 질환" },
  { code: "I20-I25", name: "허혈성 심장질환" },
  { code: "J00-J99", name: "호흡기 질환" },
  { code: "K00-K93", name: "소화기 질환" },
  { code: "M00-M99", name: "근골격계 질환" },
  { code: "N00-N99", name: "비뇨생식기 질환" },
  { code: "O00-O99", name: "임신·출산" },
  { code: "S00-T98", name: "상해 (다침·골절·중독 등)" },

  // 자주 찾는 구체적인 코드
  { code: "C16", name: "위암" },
  { code: "C18", name: "대장암 (결장)" },
  { code: "C20", name: "직장암" },
  { code: "C22", name: "간암" },
  { code: "C25", name: "췌장암" },
  { code: "C34", name: "폐암" },
  { code: "C44", name: "기타 피부암" },
  { code: "C50", name: "유방암" },
  { code: "C53", name: "자궁경부암" },
  { code: "C61", name: "전립선암" },
  { code: "C73", name: "갑상선암" },
  { code: "D05", name: "유방 제자리암" },
  { code: "E11", name: "제2형 당뇨병" },
  { code: "E78", name: "고지혈증" },
  { code: "I10", name: "고혈압" },
  { code: "I21", name: "급성 심근경색" },
  { code: "I20", name: "협심증" },
  { code: "I60", name: "지주막하출혈 (뇌출혈)" },
  { code: "I61", name: "뇌내출혈 (뇌출혈)" },
  { code: "I62", name: "기타 뇌출혈" },
  { code: "I63", name: "뇌경색" },
  { code: "J18", name: "폐렴" },
  { code: "K35", name: "급성 충수염 (맹장염)" },
  { code: "K80", name: "담석증" },
  { code: "M51", name: "추간판 장애 (허리디스크)" },
  { code: "M50", name: "경추간판 장애 (목디스크)" },
  { code: "M17", name: "무릎 관절증" },
  { code: "N20", name: "신장·요관 결석" },
  { code: "S82", name: "다리 골절 (발목 포함)" },
  { code: "S52", name: "팔 골절" },
  { code: "S72", name: "넙다리(대퇴) 골절" },
  { code: "S06", name: "머리 손상 (뇌진탕 등)" },
];

// "C50.9" → { letter: "C", major: 50, minor: "9", index: 250 }  (A=0, B=1, C=2 ... 로 바꿔서 숫자로 비교)
function parseCode(code) {
  const m = String(code).trim().toUpperCase().match(/^([A-Z])\s*(\d{1,2})(?:\.?(\d*))?$/);
  if (!m) return null;
  const letter = m[1];
  const major = parseInt(m[2], 10);
  const minor = m[3] || "";
  return { letter, major, minor, index: (letter.charCodeAt(0) - 65) * 100 + major, raw: `${letter}${String(major).padStart(2, "0")}${minor ? "." + minor : ""}` };
}

// 범위 비교용 숫자: "D47" 은 D47.0~D47.9 전체, "D47.1" 은 D47.1(과 D47.1x)만
function codeValue(c, asEnd) {
  if (!c.minor) return c.index + (asEnd ? 0.99999 : 0);
  const frac = Number("0." + c.minor);
  return c.index + (asEnd ? frac + Math.pow(10, -c.minor.length) - 0.00001 : frac);
}

// "C00-C97", "C50", "D47.1" 같은 범위 안에 코드가 들어가는지
function codeInRange(code, range) {
  if (range === "*") return true;
  const c = typeof code === "string" ? parseCode(code) : code;
  if (!c) return false;
  const [a, b] = String(range).split("-").map((s) => parseCode(s));
  if (!a) return false;
  const v = codeValue(c, false);
  return v >= codeValue(a, false) && v <= codeValue(b || a, true);
}

// 여러 범위 중 하나라도 맞으면 true
function codeInAny(code, ranges) {
  return (ranges || []).some((r) => codeInRange(code, r));
}

// 상해(S, T 코드)인지
function isInjuryCode(code) {
  const c = parseCode(code);
  return !!c && (c.letter === "S" || c.letter === "T");
}

// 코드 이름 찾기: 가장 좁은(구체적인) 것을 우선
function describeCode(code) {
  const c = parseCode(code);
  if (!c) return null;
  const hits = KCD_DICT.filter((d) => codeInRange(c, d.code)).map((d) => {
    const [a, b] = d.code.split("-").map(parseCode);
    return { ...d, width: (b ? b.index : a.index) - a.index };
  });
  hits.sort((x, y) => x.width - y.width);
  return hits.length ? hits[0].name : "사전에 없는 코드 (그래도 검사는 돼요)";
}

if (typeof module !== "undefined") module.exports = { KCD_DICT, parseCode, codeInRange, codeInAny, isInjuryCode, describeCode };
