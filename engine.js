// 보험 계산 엔진: "이 병이면 어떤 보험에서 얼마 받을 수 있나?" + "겹치는 보장 찾기"
// 화면(app.js)과 분리해 두어서, 나중에 앱(안드로이드/아이폰)으로 옮겨도 그대로 쓸 수 있어요.

if (typeof require !== "undefined" && typeof codeInAny === "undefined") {
  Object.assign(globalThis, require("./kcd.js"));
}

const CATEGORY_LABEL = {
  진단: "진단비 (병을 진단받으면 한 번에)",
  수술: "수술비",
  입원: "입원일당 (입원 하루마다)",
  통원: "통원비 (병원 다닐 때마다)",
  실손: "실손의료비 (실제 낸 병원비 돌려받기)",
  사망: "사망·후유장해",
  기타: "기타",
};

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}
function addYears(dateStr, years) {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + Number(years || 0));
  return d;
}
const won = (n) => Math.round(Number(n) || 0).toLocaleString("ko-KR") + "원";

// 이 보장이 이 질병코드에 해당하나?
function coverageMatchesCode(cov, code) {
  const injury = isInjuryCode(code);
  if (cov.cause === "상해" && !injury) return false;
  if (cov.cause === "질병" && injury) return false;
  if (codeInAny(code, cov.excludeCodes)) return false;
  if (!cov.codes || !cov.codes.length) return true; // 범위를 모르면 일단 보여주고 '확인 필요'로 표시
  return codeInAny(code, cov.codes);
}

/**
 * 청구 가능 여부 계산
 * event = { code, date, diagnosis, surgery, surgeryClass, hospitalDays, icuDays, outpatientVisits, medicalCost, preExisting }
 * 결과: 보장마다 { status: "가능" | "확인필요" | "불가", amount, reasons[] }
 */
function checkClaim(policies, event) {
  const results = [];
  const eventDate = new Date(event.date || Date.now());

  for (const p of policies) {
    for (const cov of p.coverages || []) {
      if (!coverageMatchesCode(cov, event.code)) continue;

      const r = { policy: p, coverage: cov, status: "가능", amount: 0, reasons: [] };
      const unknown = (msg) => { if (r.status === "가능") r.status = "확인필요"; r.reasons.push("❓ " + msg); };
      const codesUnknown = !cov.codes || !cov.codes.length;

      // 1) 이 사건이 이 보장 종류에 해당하나?
      // 중환자실 입원비는 중환자실에 있던 날만 세요
      const days = cov.icuOnly ? Number(event.icuDays) || 0 : Number(event.hospitalDays) || 0;
      const visits = Number(event.outpatientVisits) || 0;
      const cost = Number(event.medicalCost) || 0;
      if (cov.category === "진단" && !event.diagnosis) continue;
      if (cov.category === "수술" && !event.surgery) continue;
      if (cov.category === "입원" && days <= 0) continue;
      if (cov.category === "통원" && visits <= 0) continue;
      if (cov.category === "실손" && cost <= 0) continue;
      // 실손 입원/통원 구분: 입원 실손은 입원했을 때만, 통원 실손은 입원 없이 병원 다녔을 때만
      if (cov.silsonKind === "입원" && !(Number(event.hospitalDays) > 0)) continue;
      if (cov.silsonKind === "통원" && (Number(event.hospitalDays) > 0 || visits <= 0)) continue;
      if (cov.category === "사망" || cov.category === "기타") continue;

      // 2) 보험 기간 확인
      if (p.startDate && eventDate < new Date(p.startDate)) {
        r.status = "불가";
        r.reasons.push("보험 가입 전에 생긴 일이에요");
      }
      if (p.endDate && eventDate > new Date(p.endDate)) {
        r.status = "불가";
        r.reasons.push("보험 기간(만기)이 끝난 뒤예요");
      }

      // 3) 기본 금액 계산
      let amount = 0;
      const limit = Number(cov.amount) || 0;
      if (cov.category === "수술" && cov.amountsByClass) {
        // 수술 종류(1~5종)에 따라 금액이 다른 보장
        const table = Object.entries(cov.amountsByClass).map(([k, v]) => `${k}종 ${Number(v).toLocaleString()}원`).join(", ");
        const cls = String(event.surgeryClass || "");
        if (cls && cov.amountsByClass[cls] != null) {
          amount = Number(cov.amountsByClass[cls]);
          r.reasons.push(`${cls}종 수술 (${table})`);
        } else {
          amount = 0;
          unknown(`수술 종류(1~5종)를 골라야 금액을 알 수 있어요: ${table}`);
        }
      } else if (cov.category === "진단" || cov.category === "수술") {
        amount = limit;
      } else if (cov.category === "입원") {
        const deduct = Number(cov.deductDays) || 0;
        const maxDays = Number(cov.maxDays) || Infinity;
        const paidDays = Math.min(Math.max(days - deduct, 0), maxDays);
        if (!cov.maxDays) unknown("최대 지급 일수가 등록 안 됐어요 (약관 확인)");
        if (paidDays === 0 && deduct) { r.status = "불가"; r.reasons.push(`입원이 ${deduct}일을 넘어야 받을 수 있어요`); }
        amount = limit * paidDays;
        r.reasons.push(`${limit.toLocaleString()}원 × ${paidDays}일` + (deduct ? ` (처음 ${deduct}일은 빼고)` : ""));
      } else if (cov.category === "통원") {
        amount = limit * visits;
        r.reasons.push(`${limit.toLocaleString()}원 × ${visits}회`);
      } else if (cov.category === "실손") {
        if (cov.selfPayRate == null || cov.selfPayRate === "") {
          unknown("본인부담률이 등록 안 돼서 금액을 계산할 수 없어요 (약관·증권 확인)");
          amount = 0;
        } else {
          // 통원 실손은 병원 1번 갈 때마다 공제·한도가 따로 적용돼요
          const times = cov.silsonKind === "통원" ? Math.max(visits, 1) : 1;
          const minDeduct = (Number(cov.minDeduct) || 0) * times;
          const selfPay = Math.max(cost * Number(cov.selfPayRate), minDeduct);
          amount = Math.min(Math.max(cost - selfPay, 0), (limit || Infinity) * times);
          r.reasons.push(`병원비 ${won(cost)} 중 본인부담 ${won(selfPay)} 빼고`);
        }
      }

      // 4) 면책기간 (예: 암은 가입 후 90일 동안 보장 안 됨)
      if (r.status !== "불가" && cov.waitingDays && p.startDate) {
        const okFrom = addDays(p.startDate, cov.waitingDays);
        if (eventDate < okFrom) {
          r.status = "불가";
          r.reasons.push(`면책기간이에요 (가입 후 ${cov.waitingDays}일 지나야 보장, ${okFrom.toLocaleDateString("ko-KR")}부터)`);
        }
      }

      // 5) 감액기간 (예: 가입 1년 안에는 50%만)
      if (r.status !== "불가" && cov.reductionYears && p.startDate) {
        const fullFrom = addYears(p.startDate, cov.reductionYears);
        if (eventDate < fullFrom) {
          r.status = "확인필요";
          if (cov.reductionRate == null || cov.reductionRate === "") {
            r.reasons.push(`❓ 감액기간이에요 (${fullFrom.toLocaleDateString("ko-KR")}부터 100%). 감액 비율이 등록 안 돼서 실제로는 이 금액보다 적어요`);
          } else {
            amount = amount * Number(cov.reductionRate);
            r.reasons.push(`감액기간이라 ${Math.round(cov.reductionRate * 100)}%만 나와요 (${fullFrom.toLocaleDateString("ko-KR")}부터 100%)`);
          }
        }
      }

      // 6) 소액암(갑상선암 등) 특별 규칙
      if (cov.smallCancerCodes && codeInAny(event.code, cov.smallCancerCodes)) {
        r.status = r.status === "불가" ? "불가" : "확인필요";
        if (cov.smallCancerRate == null || cov.smallCancerRate === "") {
          r.reasons.push("❓ 소액암으로 분류돼요. 지급 비율이 등록 안 돼서 실제로는 이 금액보다 적어요");
        } else {
          amount = amount * Number(cov.smallCancerRate);
          r.reasons.push(`소액암으로 분류돼서 ${Math.round(cov.smallCancerRate * 100)}%만 나와요`);
        }
      }

      // 7) 최초 1회만 주는 보장
      if (cov.onceOnly) {
        if (cov.paidBefore) { r.status = "불가"; r.reasons.push("최초 1회만 주는 보장인데, 이미 받은 적이 있어요"); }
        else r.reasons.push("최초 1회만 주는 보장이에요 (전에 받은 적이 있으면 안 나와요)");
      }

      // 8) 가입 전부터 앓던 병
      if (event.preExisting && r.status !== "불가" && cov.cause !== "상해" && !isInjuryCode(event.code)) {
        if (p.preExistingRule) unknown(p.preExistingRule);
        else unknown("가입 전부터 앓던 병이에요. 이 보험이 이런 경우를 보장하는지 약관을 확인해야 해요");
      }

      // 9) 특정 조건이 붙은 코드 (예: 남자아이만, 여자아이만)
      for (const cond of cov.conditions || []) {
        if (codeInAny(event.code, cond.codes)) unknown(cond.msg);
      }

      if (cov.note) r.reasons.push("메모: " + cov.note);
      if (cov.source) r.reasons.push("📘 근거: " + cov.source);
      if (codesUnknown) { unknown("질병코드 범위가 등록 안 돼서 이 병이 해당되는지 몰라요 (약관 확인)"); amount = 0; }
      if (!(p.docs && p.docs.약관) && !p.termsSource) r.reasons.push("약관 미등록 — 면책·감액 같은 조건을 확인 못 했어요");
      r.amount = r.status === "불가" ? 0 : Math.round(amount);
      results.push(r);
    }
  }

  // 10) 실손보험이 여러 개면: 실제 낸 돈까지만 나눠서 받아요 (비례보상)
  const silson = results.filter((r) => r.coverage.category === "실손" && r.status !== "불가");
  if (silson.length > 1) {
    const sum = silson.reduce((s, r) => s + r.amount, 0);
    const cap = Math.max(...silson.map((r) => r.amount));
    for (const r of silson) {
      r.amount = Math.round((r.amount / sum) * cap);
      r.status = "확인필요";
      r.reasons.push(`실손이 ${silson.length}개라 나눠서 받아요 (합쳐도 최대 ${won(cap)})`);
    }
  }

  const total = results.reduce((s, r) => s + r.amount, 0);
  const order = { 가능: 0, 확인필요: 1, 불가: 2 };
  results.sort((a, b) => order[a.status] - order[b.status] || b.amount - a.amount);
  return { results, total };
}

// 서로 다른 보험에 같은 종류 보장이 겹치는지 찾기
function findOverlaps(policies) {
  const items = [];
  for (const p of policies) for (const c of p.coverages || []) items.push({ p, c });

  const groups = new Map();
  for (const it of items) {
    const key = `${it.c.category}|${it.c.cause || "모두"}|${(it.c.codes || ["*"]).join(",")}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }

  const overlaps = [];
  for (const list of groups.values()) {
    const companies = new Set(list.map((x) => x.p.id));
    if (companies.size < 2) continue;
    const c = list[0].c;
    const isSilson = c.category === "실손";
    overlaps.push({
      category: c.category,
      name: c.name,
      items: list,
      total: list.reduce((s, x) => s + (Number(x.c.amount) || 0), 0),
      kind: isSilson ? "warn" : "info",
      message: isSilson
        ? "실손보험은 여러 개 있어도 실제 낸 병원비까지만 나눠서 받아요. 보험료만 두 번 낼 수 있으니 하나로 정리할지 상담해 보세요."
        : "정액 보장(진단비·수술비 등)은 겹치면 각각 다 받을 수 있어요. 대신 보험료가 많이 나가는지 함께 확인해 보세요.",
    });
  }
  return overlaps;
}

// 청구할 때 보통 필요한 서류
function requiredDocs(event) {
  const docs = new Set(["보험금 청구서 (보험사 앱/홈페이지)", "신분증 사본"]);
  if (event.diagnosis) docs.add("진단서 (질병코드가 적힌 것)");
  if (event.surgery) docs.add("수술확인서");
  if (Number(event.hospitalDays) > 0) docs.add("입퇴원 확인서");
  if (Number(event.medicalCost) > 0) {
    docs.add("진료비 영수증");
    docs.add("진료비 세부내역서");
  }
  if (Number(event.outpatientVisits) > 0) docs.add("통원 확인서 또는 처방전");
  return [...docs];
}

if (typeof module !== "undefined") module.exports = { checkClaim, findOverlaps, requiredDocs, coverageMatchesCode, CATEGORY_LABEL, won };
