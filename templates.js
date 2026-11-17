// 디디가 약관을 직접 읽고 정리한 "보험 틀"
// 금액은 약관의 "보험금 지급기준표"(1구좌 / 가입금액 기준) 그대로예요.
// 실제 받는 돈 = 기준 금액 × 구좌 수 (증권에서 확인)
// 각 보장의 source 에 약관 쪽수를 적어 두었어요. 약관에 없는 건 넣지 않았어요.

// ---- 약관 분류표(부표)에 적힌 질병코드 ----
const SH_KIDS_CODES = {
  // 부표5 백혈병·골수암 (p.30)
  leukemia: ["C90-C95"],
  // 부표6 대상이 되는 악성신생물(기타피부암·갑상샘암 제외) (p.31)
  cancer: ["C00-C14", "C15-C26", "C30-C39", "C40-C41", "C43", "C45-C49", "C50", "C51-C58", "C60-C63", "C64-C68", "C69-C72", "C74", "C75", "C76-C80", "C81-C96", "C97", "D45", "D46", "D47.1", "D47.3", "L41.2"],
  // 부표7 상피내의 신생물 (p.31)
  inSitu: ["D00-D07", "D09"],
  // 부표8 행동양식 불명 또는 미상의 신생물 = 경계성종양 (p.32), D47.1·D47.3 제외
  borderline: ["D37-D44", "D47", "D48", "D76.0"],
  // 부표12 고액치료비관련 질병 (p.33)
  highCost: ["C90-C95", "C81-C85", "C40-C41", "C70-C72", "D32-D33", "I20-I25", "I60-I69"],
  // 부표13 화상 (p.34)
  burn: ["T20-T32"],
  // 부표14 남성·여성주요질환 (p.34~35)
  mfCommon: ["L20", "J45-J46", "J20-J21", "J12-J18", "J30-J36", "E10-E14", "K35-K38", "A00-A09", "K40-K46", "G00-G03", "B15-B19", "K71-K74", "N17-N19", "E00-E06", "I10-I13", "I15"],
  mfMale: ["N00-N08", "N10-N16", "N20-N23", "N25-N29", "N31", "N35", "N40"],
  mfFemale: ["D24-D28", "D39", "N60-N64", "N70-N74", "N81", "N82", "N87"],
  // 부표15 시청각질환 (p.36)
  sight: ["H00-H06", "H10-H13", "H15-H22", "H25-H28", "H30-H36", "H40-H42", "H43-H45", "H46-H48", "H49-H52", "H53-H54", "H55-H59", "H60-H62", "H65-H75", "H80-H83", "H90-H95"],
  // 부표16 질병 및 재해: A00~Y98 중 정신(F00~F99)·선천이상(Q00~Q99) 제외 (p.36)
  allIllness: ["A00-Y98"],
  allIllnessExclude: ["F00-F99", "Q00-Q99"],
  // 부표2 재해: S00~Y84 (p.22)
  injury: ["S00-Y84"],
  // 부표19 재해골절(치아파절 제외) (p.39)
  fracture: ["S02", "S12", "S22", "S32", "S42", "S52", "S62", "S72", "S82", "S92", "T02", "T08", "T10", "T12", "T14.2"],
  // 선천이상특약 부표4 선천이상 (p.52~53)
  congenital: ["Q00-Q07", "Q10-Q18", "Q20-Q28", "Q30-Q45", "Q50-Q56", "Q60-Q87", "Q89-Q93", "Q95-Q99"],
};

const SH_KIDS_GENDER = [
  { codes: SH_KIDS_CODES.mfMale, msg: "이 코드는 남자아이만 해당돼요 (부표14 비뇨생식기계 질환, p.35)" },
  { codes: SH_KIDS_CODES.mfFemale, msg: "이 코드는 여자아이만 해당돼요 (부표14 부인과 질환, p.35)" },
];

const POLICY_TEMPLATES = [
  {
    id: "shinhan-kids-2009",
    label: "신한생명 · 무배당 신한아이사랑보험名作 (2009년 약관)",
    company: "신한생명",
    product: "무배당 신한아이사랑보험名作",
    type: "정액",
    termsSource: "신한아이사랑보험名作 약관 (2009)",
    preExistingRule: "가입(청약)일 전 5년 안에 이 병으로 진단·치료받았다면 보장이 안 돼요. 단, 가입 후 5년 동안 그 병으로 추가 진단·치료가 없었다면 그 뒤로는 보장돼요 (주계약 제30조 ②③, p.12)",
    // 증권에서 넣어야 하는 것
    units: [
      { key: "main", label: "주계약 구좌 수", hint: "증권의 주계약 가입금액/구좌", default: 1 },
      { key: "outpatient", label: "통원특약 구좌 수 (없으면 0)", hint: "증권 특약란 확인", default: 0 },
      { key: "congenital", label: "선천이상특약 가입금액 (만원, 없으면 0)", hint: "약관 기준 200만원", default: 0, perUnit: 200 },
    ],
    coverages: [
      // ---------- 주계약 (부표1, p.21~22) ----------
      { unit: "main", name: "백혈병·골수암 진단급여금", category: "진단", cause: "질병", codes: SH_KIDS_CODES.leukemia, amount: 100000000, reductionYears: 1, reductionRate: 0.5, onceOnly: true, note: "다른 암을 먼저 받은 뒤 백혈병·골수암이면 차액만 더 줘요 (제30조 ⑨)", source: "주계약 제29조 2호·제30조 ⑧, 부표1·부표5 (p.11, 13, 21, 30)" },
      { unit: "main", name: "백혈병·골수암 이외의 암 진단급여금", category: "진단", cause: "질병", codes: SH_KIDS_CODES.cancer, excludeCodes: SH_KIDS_CODES.leukemia, amount: 50000000, reductionYears: 1, reductionRate: 0.5, onceOnly: true, source: "주계약 제29조 2호·제30조 ⑧, 부표1·부표6 (p.11, 13, 21, 31)" },
      { unit: "main", name: "기타피부암 진단급여금", category: "진단", cause: "질병", codes: ["C44"], amount: 3000000, onceOnly: true, source: "주계약 제15조·제29조 2호, 부표1 (p.9, 11, 21)" },
      { unit: "main", name: "갑상샘암 진단급여금", category: "진단", cause: "질병", codes: ["C73"], amount: 3000000, onceOnly: true, source: "주계약 제15조·제29조 2호, 부표1 (p.9, 11, 21)" },
      { unit: "main", name: "상피내암 진단급여금", category: "진단", cause: "질병", codes: SH_KIDS_CODES.inSitu, amount: 3000000, onceOnly: true, source: "주계약 제16조·제29조 2호, 부표1·부표7 (p.9, 11, 21, 31)" },
      { unit: "main", name: "경계성종양 진단급여금", category: "진단", cause: "질병", codes: SH_KIDS_CODES.borderline, excludeCodes: ["D47.1", "D47.3"], amount: 3000000, onceOnly: true, source: "주계약 제17조·제29조 2호, 부표1·부표8 (p.9, 11, 21, 32)" },
      { unit: "main", name: "수술급여금", category: "수술", cause: "모두", codes: SH_KIDS_CODES.allIllness, excludeCodes: SH_KIDS_CODES.allIllnessExclude, amountsByClass: { 1: 100000, 2: 300000, 3: 500000, 4: 1000000, 5: 3000000 }, note: "같은 날 여러 수술이면 가장 높은 1종류만 줘요. 수술 종류는 약관 37~38쪽 수술분류표로 정해요", source: "주계약 제29조 10호·제30조 ㉓, 부표1·부표17 (p.12, 14, 21, 37~38)" },
      { unit: "main", name: "특정질병수술급여금 (고액치료비관련 질병)", category: "수술", cause: "질병", codes: SH_KIDS_CODES.highCost, amount: 2000000, note: "수술급여금에 더해서 줘요", source: "주계약 제29조 9호, 부표1·부표12 (p.12, 21, 33)" },
      { unit: "main", name: "특정질병수술급여금 (화상)", category: "수술", cause: "모두", codes: SH_KIDS_CODES.burn, amount: 500000, note: "수술급여금에 더해서 줘요", source: "주계약 제29조 9호, 부표1·부표13 (p.12, 21, 34)" },
      { unit: "main", name: "입원급여금", category: "입원", cause: "모두", codes: SH_KIDS_CODES.allIllness, excludeCodes: SH_KIDS_CODES.allIllnessExclude, amount: 30000, deductDays: 3, maxDays: 120, note: "4일 이상 입원해야 하고, 3일을 넘긴 날부터 하루씩 줘요", source: "주계약 제29조 12호, 부표1·부표16 (p.12, 21, 36)" },
      { unit: "main", name: "특정질병입원급여금 (고액치료비관련 질병)", category: "입원", cause: "질병", codes: SH_KIDS_CODES.highCost, amount: 70000, deductDays: 3, maxDays: 120, note: "입원급여금에 더해서 줘요", source: "주계약 제29조 11호, 부표1·부표12 (p.12, 21, 33)" },
      { unit: "main", name: "특정질병입원급여금 (화상)", category: "입원", cause: "모두", codes: SH_KIDS_CODES.burn, amount: 70000, deductDays: 3, maxDays: 120, note: "입원급여금에 더해서 줘요", source: "주계약 제29조 11호, 부표1·부표13 (p.12, 21, 34)" },
      { unit: "main", name: "특정질병입원급여금 (남성·여성주요질환)", category: "입원", cause: "질병", codes: [...SH_KIDS_CODES.mfCommon, ...SH_KIDS_CODES.mfMale, ...SH_KIDS_CODES.mfFemale], conditions: SH_KIDS_GENDER, amount: 20000, deductDays: 3, maxDays: 120, note: "입원급여금에 더해서 줘요", source: "주계약 제29조 11호, 부표1·부표14 (p.12, 21, 34~35)" },
      { unit: "main", name: "특정질병입원급여금 (시청각질환)", category: "입원", cause: "질병", codes: SH_KIDS_CODES.sight, amount: 20000, deductDays: 3, maxDays: 120, note: "입원급여금에 더해서 줘요", source: "주계약 제29조 11호, 부표1·부표15 (p.12, 21, 36)" },
      { unit: "main", name: "재해골절치료자금", category: "진단", cause: "상해", codes: SH_KIDS_CODES.fracture, excludeCodes: ["S02.5"], amount: 300000, note: "골절 1회당. 치아가 깨진 건(S02.5) 빼요", source: "주계약 제27조·제29조 13호, 부표1·부표19 (p.11, 12, 22, 39)" },
      { unit: "main", name: "통원급여금 (고액치료비관련 질병)", category: "통원", cause: "질병", codes: SH_KIDS_CODES.highCost, amount: 30000, source: "주계약 제29조 14호, 부표1 (p.12, 22)" },
      { unit: "main", name: "통원급여금 (시청각질환)", category: "통원", cause: "질병", codes: SH_KIDS_CODES.sight, amount: 10000, source: "주계약 제29조 14호, 부표1 (p.12, 22)" },
      { unit: "main", name: "통원급여금 (재해)", category: "통원", cause: "상해", codes: SH_KIDS_CODES.injury, amount: 10000, source: "주계약 제29조 14호, 부표1·부표2 (p.12, 22)" },
      // 질병코드로 자동 계산할 수 없는 보장 (보여주기만 해요)
      { unit: "main", name: "조혈모세포이식수술급여금 (최초 1회)", category: "기타", cause: "모두", codes: ["*"], amount: 20000000, onceOnly: true, source: "주계약 제29조 7호, 부표1 (p.12, 21)" },
      { unit: "main", name: "법정전염병진단급여금 (진단 1회당)", category: "기타", cause: "질병", codes: ["*"], amount: 500000, note: "부표9의 전염병(병 이름으로 정해져 있어요)", source: "주계약 제29조 8호, 부표1·부표9 (p.12, 21, 32)" },
      { unit: "main", name: "유괴·납치위로금 (30세 이전, 최초 1회)", category: "기타", cause: "모두", codes: ["*"], amount: 5000000, source: "주계약 제29조 6호, 부표1 (p.12, 21)" },
      { unit: "main", name: "스쿨존교통재해장해급여금 (× 장해지급률, 13세 이전)", category: "기타", cause: "상해", codes: ["*"], amount: 200000000, source: "주계약 제29조 5호, 부표1 (p.12, 21)" },
      { unit: "main", name: "교통재해장해급여금 (× 장해지급률)", category: "기타", cause: "상해", codes: ["*"], amount: 120000000, source: "주계약 제29조 3호, 부표1 (p.11, 21)" },
      { unit: "main", name: "일반재해장해급여금 (× 장해지급률)", category: "기타", cause: "상해", codes: ["*"], amount: 60000000, source: "주계약 제29조 4호, 부표1 (p.12, 21)" },

      // ---------- 통원특약 (특약 1구좌, 부표1 p.46) ----------
      { unit: "outpatient", name: "[통원특약] 통원치료비 (남성·여성주요질환)", category: "통원", cause: "질병", codes: [...SH_KIDS_CODES.mfCommon, ...SH_KIDS_CODES.mfMale, ...SH_KIDS_CODES.mfFemale], conditions: SH_KIDS_GENDER, amount: 10000, source: "통원특약 제12조, 부표1 (p.42~43, 46)" },

      // ---------- 新선천이상보장특약 (가입금액 200만원 기준, 부표1 p.52) ----------
      { unit: "congenital", name: "[선천이상특약] 선천이상입원급여금", category: "입원", cause: "질병", codes: SH_KIDS_CODES.congenital, amount: 20000, deductDays: 3, maxDays: 120, source: "선천이상특약 제11조·제12조 ⑩⑪, 부표1·부표4 (p.48~49, 52~53)" },
      { unit: "congenital", name: "[선천이상특약] 선천이상수술급여금", category: "수술", cause: "질병", codes: SH_KIDS_CODES.congenital, amount: 1000000, source: "선천이상특약 제11조, 부표1·부표4 (p.48~49, 52~53)" },
    ],
  },
];

// 구좌 수를 곱해서 실제 금액으로 바꾼 보장 목록 만들기
function buildFromTemplate(tpl, unitValues) {
  const mult = {};
  for (const u of tpl.units) {
    const v = Number(unitValues[u.key]) || 0;
    mult[u.key] = u.perUnit ? v / u.perUnit : v;
  }
  const coverages = tpl.coverages
    .filter((c) => (mult[c.unit] || 0) > 0)
    .map(({ unit, ...c }) => {
      const m = mult[unit];
      const out = { ...c, amount: Math.round(c.amount * m) };
      if (c.amountsByClass) out.amountsByClass = Object.fromEntries(Object.entries(c.amountsByClass).map(([k, v]) => [k, Math.round(v * m)]));
      if (m !== 1) out.note = [c.note, `기준 금액 × ${m} (${unit === "congenital" ? "가입금액" : "구좌"})`].filter(Boolean).join(" · ");
      return out;
    });
  return {
    company: tpl.company,
    product: tpl.product,
    type: tpl.type,
    templateId: tpl.id,
    termsSource: tpl.termsSource,
    preExistingRule: tpl.preExistingRule,
    units: unitValues,
    coverages,
  };
}

if (typeof module !== "undefined") module.exports = { POLICY_TEMPLATES, buildFromTemplate, SH_KIDS_CODES };
