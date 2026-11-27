// 계산 엔진 자동 시험 (가짜 예시 데이터만 사용)
// 실행: node tests/engine.test.js
const assert = require("assert");
const path = require("path");
Object.assign(globalThis, require(path.join(__dirname, "../kcd.js")));
const { checkClaim, findOverlaps, groupByCompany, findCodesInText, claimDeadline, daysLeft } = require(path.join(__dirname, "../engine.js"));
const { POLICY_TEMPLATES, buildFromTemplate } = require(path.join(__dirname, "../templates.js"));

let n = 0;
const t = (name, fn) => { fn(); n++; console.log("✅", name); };
const pol = (covs, extra = {}) => ({ id: "x", startDate: "2020-01-01", coverages: covs, ...extra });
const find = (res, name) => res.results.find((r) => r.coverage.name === name);

t("질병코드 범위 (소수점 포함)", () => {
  assert(codeInRange("C50.9", "C00-C97"));
  assert(codeInRange("D47.12", "D47.1"));
  assert(!codeInRange("D47.2", "D47.1"));
  assert(!codeInRange("T14", "T14.2"));
  assert(isInjuryCode("S82.1") && !isInjuryCode("J18"));
});

t("면책기간 90일 안이면 ❌", () => {
  const r = checkClaim([pol([{ name: "암", category: "진단", cause: "질병", codes: ["C00-C97"], amount: 1000, waitingDays: 90 }])], { code: "C50", date: "2020-02-01", diagnosis: true });
  assert.equal(r.results[0].status, "불가");
});

t("감액기간 1년 안이면 50%", () => {
  const r = checkClaim([pol([{ name: "암", category: "진단", cause: "질병", codes: ["C00-C97"], amount: 1000, reductionYears: 1, reductionRate: 0.5 }])], { code: "C50", date: "2020-06-01", diagnosis: true });
  assert.equal(r.results[0].amount, 500);
});

t("입원일당: 3일 넘긴 날부터, 최대 일수", () => {
  const c = { name: "입원", category: "입원", cause: "질병", codes: ["*"], amount: 10, deductDays: 3, maxDays: 5 };
  assert.equal(checkClaim([pol([c])], { code: "J18", date: "2021-01-01", hospitalDays: 10 }).results[0].amount, 50);
  assert.equal(checkClaim([pol([c])], { code: "J18", date: "2021-01-01", hospitalDays: 3 }).results[0].status, "불가");
});

t("N일 이상 입원해야 첫날부터 지급 (minDays)", () => {
  const c = { name: "9대입원", category: "입원", cause: "질병", codes: ["*"], amount: 10, minDays: 4, maxDays: 123 };
  assert.equal(checkClaim([pol([c])], { code: "I63", date: "2021-01-01", hospitalDays: 7 }).results[0].amount, 70);
  assert.equal(checkClaim([pol([c])], { code: "I63", date: "2021-01-01", hospitalDays: 3 }).results[0].status, "불가");
});

t("중환자실 입원비는 중환자실 날짜만", () => {
  const c = { name: "ICU", category: "입원", cause: "모두", codes: ["*"], amount: 10, icuOnly: true, maxDays: 10 };
  assert.equal(checkClaim([pol([c])], { code: "J18", date: "2021-01-01", hospitalDays: 20, icuDays: 12 }).results[0].amount, 100);
});

t("실손: 입원/통원 구분, 통원은 1회마다 공제", () => {
  const inp = { name: "입원실손", category: "실손", silsonKind: "입원", cause: "질병", codes: ["*"], amount: 1e8, selfPayRate: 0 };
  const out = { name: "통원실손", category: "실손", silsonKind: "통원", cause: "질병", codes: ["*"], amount: 300000, selfPayRate: 0, minDeduct: 5000 };
  const a = checkClaim([pol([inp, out])], { code: "J06", date: "2021-01-01", outpatientVisits: 2, medicalCost: 30000 });
  assert.equal(a.results.length, 1); assert.equal(a.results[0].amount, 20000);
  const b = checkClaim([pol([inp, out])], { code: "J18", date: "2021-01-01", hospitalDays: 5, medicalCost: 800000 });
  assert.equal(b.results.length, 1); assert.equal(b.results[0].amount, 800000);
});

t("모르는 값은 지어내지 않음 (❓ 확인 필요, 0원)", () => {
  const r = checkClaim([pol([{ name: "코드없음", category: "진단", cause: "질병", codes: [], amount: 1000 }])], { code: "C50", date: "2021-01-01", diagnosis: true });
  assert.equal(r.results[0].status, "확인필요"); assert.equal(r.results[0].amount, 0);
  const s = checkClaim([pol([{ name: "실손", category: "실손", cause: "질병", codes: ["*"], amount: 1e6 }])], { code: "J18", date: "2021-01-01", medicalCost: 1000 });
  assert.equal(s.results[0].amount, 0);
});

t("최초 1회 보장을 이미 받았으면 ❌", () => {
  const r = checkClaim([pol([{ name: "암", category: "진단", cause: "질병", codes: ["C00-C97"], amount: 1000, onceOnly: true, paidBefore: true }])], { code: "C50", date: "2021-01-01", diagnosis: true });
  assert.equal(r.results[0].status, "불가");
});

t("제외 코드와 확인 조건", () => {
  const c = { name: "질병입원", category: "입원", cause: "질병", codes: ["*"], excludeCodes: ["F04-F99"], conditions: [{ codes: ["O00-O99"], msg: "임신" }], amount: 10, maxDays: 10 };
  assert.equal(checkClaim([pol([c])], { code: "F32", date: "2021-01-01", hospitalDays: 2 }).results.length, 0);
  assert.equal(checkClaim([pol([c])], { code: "O80", date: "2021-01-01", hospitalDays: 2 }).results[0].status, "확인필요");
});

t("확실한 금액과 확인 필요 금액을 따로 계산", () => {
  const r = checkClaim([pol([
    { name: "A", category: "진단", cause: "질병", codes: ["C73"], amount: 100 },
    { name: "B", category: "진단", cause: "질병", codes: ["C73"], amount: 50, conditions: [{ codes: ["C73"], msg: "초기만" }] },
  ])], { code: "C73", date: "2021-01-01", diagnosis: true });
  assert.equal(r.sure, 100); assert.equal(r.maybe, 50);
});

t("약관 틀: 구좌 수를 곱하고 수술 종별 금액 사용", () => {
  const p = { id: "t", startDate: "2010-03-01", ...buildFromTemplate(POLICY_TEMPLATES[0], { main: 2, outpatient: 0, congenital: 0 }) };
  const r = checkClaim([p], { code: "S82.1", date: "2026-01-01", diagnosis: true, surgery: true, surgeryClass: "3" });
  assert.equal(find(r, "수술급여금").amount, 1000000);
  assert.equal(find(r, "재해골절치료자금").amount, 600000);
  assert.equal(checkClaim([p], { code: "S02.5", date: "2026-01-01", diagnosis: true }).results.length, 0);
});

t("실손 중복 찾기", () => {
  const s = { name: "실손", category: "실손", cause: "모두", codes: ["*"], amount: 1 };
  const o = findOverlaps([{ id: "a", coverages: [s] }, { id: "b", coverages: [s] }]);
  assert.equal(o.length, 1); assert.equal(o[0].kind, "warn");
});

t("어느 보험사에 청구할지 회사별로 묶기", () => {
  const a = { id: "a", company: "가나생명", phone: "1588", startDate: "2010-01-01", coverages: [
    { name: "암진단", category: "진단", cause: "질병", codes: ["C00-C97"], amount: 100 },
    { name: "코드없음", category: "진단", cause: "질병", codes: [], amount: 50 }] };
  const b = { id: "b", company: "다라화재", startDate: "2010-01-01", coverages: [{ name: "암진단", category: "진단", cause: "질병", codes: ["C00-C97"], amount: 300 }] };
  const c = { id: "c", company: "마바손보", startDate: "2030-01-01", coverages: [{ name: "암진단", category: "진단", cause: "질병", codes: ["C00-C97"], amount: 900 }] };
  const g = groupByCompany(checkClaim([a, b, c], { code: "C50", date: "2021-01-01", diagnosis: true }).results);
  assert.deepEqual(g.map((x) => x.company), ["다라화재", "가나생명"]); // 가입 전 사고(❌)인 회사는 빠져요
  assert.equal(g[1].sure, 100); assert.equal(g[1].items.length, 2); assert.equal(g[1].phone, "1588");
});

t("사진 글자에서 질병코드 후보 찾기", () => {
  const r = findCodesInText("진료확인서 질병분류기호 k35 , 8 주상병 K35.8 부상병 J20 전화 02-123-4567 TEL A4 KB10");
  assert.deepEqual(r.map((x) => x.code), ["K35.8", "J20"]);
  assert.equal(findCodesInText("").length, 0);
});

t("청구 마감일은 3년 뒤, 남은 날 계산", () => {
  assert.equal(claimDeadline("2026-11-01"), "2029-11-01");
  assert.equal(claimDeadline("2024-02-29"), "2027-02-28");
  assert.equal(claimDeadline(""), "");
  assert.equal(daysLeft("2026-12-01", new Date(2026, 10, 27)), 4);
  assert.equal(daysLeft("2026-11-20", new Date(2026, 10, 27)), -7);
});

console.log(`\n모두 통과: ${n}개`);
