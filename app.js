// 화면 동작: 버튼 누르면 무슨 일이 일어나는지
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- 저장소 (이 기기 안에만) ----------
const store = {
  get(key, def) { try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; } },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};
let policies = store.get("policies", []);

// 증권·약관 원본 파일 창고 (이 기기의 IndexedDB — 큰 파일도 저장 가능)
const fileDB = {
  open() {
    return (this._p ||= new Promise((res, rej) => {
      const r = indexedDB.open("insurance-files", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("files");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
  },
  async run(mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction("files", mode);
      const req = fn(tx.objectStore("files"));
      tx.oncomplete = () => res(req && req.result);
      tx.onerror = () => rej(tx.error);
    });
  },
  put: (k, v) => fileDB.run("readwrite", (s) => s.put(v, k)),
  get: (k) => fileDB.run("readonly", (s) => s.get(k)),
  del: (k) => fileDB.run("readwrite", (s) => s.delete(k)),
};
const DOC_KINDS = { 증권: "📄 증권", 약관: "📘 약관" };
let pendingFiles = { 증권: null, 약관: null };
let editingId = null;
const save = () => store.set("policies", policies);

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add("hidden"), 2200);
}

// ---------- 탭 ----------
function showTab(name) {
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.id === "tab-" + name));
  if (name === "home") renderHome();
  if (name === "overlap") renderOverlap();
  window.scrollTo(0, 0);
}
document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
document.addEventListener("click", (e) => { const g = e.target.closest("[data-goto]"); if (g) showTab(g.dataset.goto); });

// ---------- 1. 내 보험 ----------
function renderHome() {
  const empty = policies.length === 0;
  $("#emptyHome").classList.toggle("hidden", !empty);
  const premium = policies.reduce((s, p) => s + (Number(p.premium) || 0), 0);
  const covCount = policies.reduce((s, p) => s + (p.coverages || []).length, 0);
  $("#summary").innerHTML = empty ? "" : `
    <div class="stat"><div class="k">가입한 보험</div><div class="v">${policies.length}개</div></div>
    <div class="stat"><div class="k">보장 항목</div><div class="v">${covCount}개</div></div>
    <div class="stat"><div class="k">월 보험료 합계</div><div class="v">${won(premium)}</div></div>`;

  $("#policyList").innerHTML = policies.map((p) => `
    <article class="policy">
      <header>
        <div>
          <div class="name">${esc(p.product)}</div>
          <div class="meta">${esc(p.company)} · ${esc(p.startDate || "?")} ~ ${esc(p.endDate || "?")}</div>
          <div><span class="tag">${esc(p.type)}</span>${p.premium ? `<span class="tag">월 ${won(p.premium)}</span>` : ""}</div>
          <div class="doclinks">${Object.keys(DOC_KINDS).map((k) => p.docs && p.docs[k]
            ? `<button class="tag have" data-view="${esc(p.id)}" data-kind="${k}">✅ ${k} 보기</button>`
            : `<span class="tag miss">⚠️ ${k} 없음</span>`).join("")}</div>
          ${!(p.docs && p.docs.약관) ? `<div class="meta">약관이 없어서 질병코드·면책·감액 조건을 확인 못 했어요</div>` : ""}
        </div>
        <div>
          <button class="btn small ghost" data-edit="${esc(p.id)}">수정</button>
          <button class="btn small danger" data-del="${esc(p.id)}">삭제</button>
        </div>
      </header>
      <table class="covs">
        ${(p.coverages || []).map((c) => `
          <tr>
            <td>${esc(c.name)}<div class="codes">${esc(c.category)} · ${esc(c.cause || "모두")} · ${esc((c.codes || ["*"]).join(", ").replace("*", "모든 질병/상해"))}${c.waitingDays ? ` · 면책 ${c.waitingDays}일` : ""}</div></td>
            <td class="amt">${won(c.amount)}${c.category === "입원" || c.category === "통원" ? "/일·회" : ""}</td>
          </tr>`).join("")}
      </table>
    </article>`).join("");
}
$("#policyList").addEventListener("click", (e) => {
  const del = e.target.closest("[data-del]");
  const edit = e.target.closest("[data-edit]");
  const view = e.target.closest("[data-view]");
  if (view) {
    fileDB.get(`${view.dataset.view}:${view.dataset.kind}`).then((f) => {
      if (!f) return toast("파일을 찾을 수 없어요 (다른 기기에서 등록했나요?)");
      window.open(URL.createObjectURL(f), "_blank");
    });
  }
  if (del && confirm("이 보험을 지울까요?")) {
    policies = policies.filter((p) => p.id !== del.dataset.del);
    Object.keys(DOC_KINDS).forEach((k) => fileDB.del(`${del.dataset.del}:${k}`).catch(() => {}));
    save(); renderHome(); toast("지웠어요");
  }
  if (edit) { fillForm(policies.find((p) => p.id === edit.dataset.edit)); showTab("add"); }
});
$("#loadSample").addEventListener("click", () => {
  policies = JSON.parse(JSON.stringify(SAMPLE_POLICIES));
  save(); renderHome(); toast("예시 보험을 불러왔어요");
});

// ---------- 2. 청구 확인 ----------
$("#cDate").value = new Date().toISOString().slice(0, 10);
$("#cCode").addEventListener("input", () => {
  const v = $("#cCode").value.trim();
  const p = parseCode(v);
  $("#cCodeName").textContent = !v ? "" : p ? `👉 ${p.raw}: ${describeCode(v)}${isInjuryCode(v) ? " (상해)" : " (질병)"}` : "코드 모양이 이상해요. 예: C50, I63.9";
});
$("#runClaim").addEventListener("click", () => {
  const event = {
    code: $("#cCode").value.trim(),
    date: $("#cDate").value,
    diagnosis: $("#cDiag").checked,
    surgery: $("#cSurg").checked,
    hospitalDays: $("#cDays").value,
    outpatientVisits: $("#cVisits").value,
    medicalCost: $("#cCost").value,
  };
  if (!parseCode(event.code)) { toast("질병코드를 먼저 넣어주세요 (예: C50)"); return; }
  if (!policies.length) { toast("먼저 보험을 등록해주세요"); return; }

  const { results, total } = checkClaim(policies, event);
  const label = { 가능: "✅ 청구 가능", 확인필요: "⚠️ 확인 필요", 불가: "❌ 해당 안 됨" };
  $("#claimResult").innerHTML = `
    <div class="total">
      <div class="k">${esc(event.code.toUpperCase())} ${esc(describeCode(event.code))} — 예상 보험금 합계</div>
      <div class="v">${won(total)}</div>
      <div class="k">해당 보장 ${results.length}개 중 받을 수 있는 것 ${results.filter((r) => r.amount > 0).length}개</div>
    </div>
    ${results.length ? results.map((r) => `
      <div class="result ${r.status}">
        <div class="top-line"><span>${esc(r.coverage.name)}</span><span>${won(r.amount)}</span></div>
        <div class="meta"><span class="badge ${r.status}">${label[r.status]}</span> ${esc(r.policy.company)} · ${esc(r.policy.product)}</div>
        ${r.reasons.length ? `<ul>${r.reasons.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      </div>`).join("") : `<div class="panel">이 코드와 상황에 해당하는 보장을 못 찾았어요. 입원·수술·병원비 칸도 채워보세요.</div>`}
    <div class="panel">
      <h3>📎 청구할 때 챙길 서류</h3>
      <ul>${requiredDocs(event).map((d) => `<li>${esc(d)}</li>`).join("")}</ul>
      <p class="disclaimer">※ 예상 금액이에요. 실제 지급은 보험사 심사·약관에 따라 달라요. 보험금 청구는 보통 사고일로부터 3년 안에 해야 해요.</p>
    </div>`;
  $("#claimResult").scrollIntoView({ behavior: "smooth" });
});

// ---------- 3. 중복 체크 ----------
function renderOverlap() {
  const list = findOverlaps(policies);
  if (!policies.length) { $("#overlapResult").innerHTML = `<div class="empty">먼저 보험을 등록해주세요.</div>`; return; }
  if (!list.length) { $("#overlapResult").innerHTML = `<div class="box info"><h3>👍 겹치는 보장이 없어요</h3>서로 다른 보험끼리 같은 보장이 발견되지 않았어요.</div>`; return; }
  $("#overlapResult").innerHTML = list.map((o) => `
    <div class="box ${o.kind}">
      <h3>${o.kind === "warn" ? "⚠️" : "ℹ️"} ${esc(o.name)} — ${o.items.length}곳에 있어요</h3>
      <p>${esc(o.message)}</p>
      <table class="covs">
        ${o.items.map((x) => `<tr><td>${esc(x.p.company)} · ${esc(x.p.product)}</td><td class="amt">${won(x.c.amount)}</td></tr>`).join("")}
        ${o.kind === "info" ? `<tr><td><b>합치면</b></td><td class="amt">${won(o.total)}</td></tr>` : ""}
      </table>
    </div>`).join("");
}

// ---------- 4. 보험 추가 ----------
const CATS = ["진단", "수술", "입원", "통원", "실손", "사망", "기타"];
const CAUSES = ["질병", "상해", "모두"];
function covRowHTML(c = {}) {
  const opt = (arr, v) => arr.map((x) => `<option ${x === v ? "selected" : ""}>${x}</option>`).join("");
  return `
    <div class="covrow">
      <label>보장 이름 <input data-f="name" value="${esc(c.name)}" placeholder="예: 일반암 진단비" /></label>
      <div class="grid">
        <label>종류 <select data-f="category">${opt(CATS, c.category || "진단")}</select></label>
        <label>원인 <select data-f="cause">${opt(CAUSES, c.cause || "질병")}</select></label>
        <label>금액(원) <input data-f="amount" type="number" value="${esc(c.amount)}" /></label>
        <label>질병코드 범위 <input data-f="codes" value="${esc((c.codes || []).join(", "))}" placeholder="예: C00-C97 (모든 질병이면 *)" /></label>
        <label>면책기간(일) <input data-f="waitingDays" type="number" value="${esc(c.waitingDays || "")}" placeholder="약관에 적힌 일수" /></label>
        <label>감액기간(년) <input data-f="reductionYears" type="number" value="${esc(c.reductionYears || "")}" /></label>
      </div>
      <label>근거 (약관 몇 조, 몇 쪽) <input data-f="source" value="${esc(c.source)}" placeholder="예: 약관 제3조 p.45" /></label>
      ${c.note ? `<div class="hint">💬 ${esc(c.note)}</div>` : ""}
      <input type="hidden" data-f="extra" value="${esc(JSON.stringify(c))}" />
      <button class="btn small danger" data-rm>이 줄 삭제</button>
    </div>`;
}
$("#addCov").addEventListener("click", () => $("#covRows").insertAdjacentHTML("beforeend", covRowHTML()));
$("#covRows").addEventListener("click", (e) => { if (e.target.closest("[data-rm]")) e.target.closest(".covrow").remove(); });

function fillForm(p = {}, keepFiles = false) {
  editingId = p.id || null;
  editingDocs = { ...(p.docs || {}) };
  if (!keepFiles) {
    pendingFiles = { 증권: null, 약관: null };
    $("#docPolicy").value = "";
    $("#docTerms").value = "";
    $("#aiStatus").textContent = "";
  }
  showDocState();
  $("#fCompany").value = p.company || "";
  $("#fProduct").value = p.product || "";
  $("#fType").value = p.type === "실손" ? "실손" : "정액";
  $("#fPremium").value = p.premium || "";
  $("#fStart").value = p.startDate || "";
  $("#fEnd").value = p.endDate || "";
  $("#covRows").innerHTML = (p.coverages && p.coverages.length ? p.coverages : [{}]).map(covRowHTML).join("");
}
let editingDocs = {};
function showDocState() {
  for (const [k, el] of [["증권", "#docPolicyNow"], ["약관", "#docTermsNow"]]) {
    const f = pendingFiles[k];
    $(el).textContent = f ? `📎 새 파일: ${f.name}` : editingDocs[k] ? `✅ 저장된 파일: ${editingDocs[k]}` : "";
  }
}
$("#docPolicy").addEventListener("change", (e) => { pendingFiles.증권 = e.target.files[0] || null; showDocState(); });
$("#docTerms").addEventListener("change", (e) => { pendingFiles.약관 = e.target.files[0] || null; showDocState(); });

function readForm() {
  const coverages = [...document.querySelectorAll(".covrow")].map((row) => {
    const g = (f) => row.querySelector(`[data-f="${f}"]`).value.trim();
    let extra = {};
    try { extra = JSON.parse(g("extra") || "{}"); } catch {}
    return {
      ...extra, // AI가 읽어온 세부 조건(감액비율, 소액암 등)은 그대로 유지
      name: g("name"),
      category: g("category"),
      cause: g("cause"),
      amount: Number(g("amount")) || 0,
      codes: g("codes") ? g("codes").split(/[,\s]+/).filter(Boolean).map((s) => s.toUpperCase()) : [],
      waitingDays: Number(g("waitingDays")) || 0,
      reductionYears: Number(g("reductionYears")) || 0,
      source: g("source"),
    };
  }).filter((c) => c.name);
  return {
    id: editingId || "p-" + Date.now(),
    company: $("#fCompany").value.trim(),
    product: $("#fProduct").value.trim(),
    type: $("#fType").value,
    premium: Number($("#fPremium").value) || 0,
    startDate: $("#fStart").value,
    endDate: $("#fEnd").value,
    docs: { ...editingDocs },
    coverages,
  };
}
$("#savePolicy").addEventListener("click", async () => {
  const p = readForm();
  if (!p.company || !p.product) { toast("보험사와 상품 이름을 넣어주세요"); return; }
  if (!p.coverages.length) { toast("보장 내용을 한 줄 이상 넣어주세요"); return; }
  if (!pendingFiles.증권 && !p.docs.증권 && !confirm("증권 파일 없이 저장할까요? (나중에 수정에서 올릴 수 있어요)")) return;
  try {
    for (const k of Object.keys(DOC_KINDS)) {
      if (pendingFiles[k]) { await fileDB.put(`${p.id}:${k}`, pendingFiles[k]); p.docs[k] = pendingFiles[k].name; }
    }
  } catch { toast("파일 저장에 실패했어요 (저장 공간을 확인해주세요)"); }
  const i = policies.findIndex((x) => x.id === p.id);
  if (i >= 0) policies[i] = p; else policies.push(p);
  save(); fillForm(); toast("저장했어요!"); showTab("home");
});
$("#resetForm").addEventListener("click", () => fillForm());

$("#aiRun").addEventListener("click", async () => {
  const policyFile = pendingFiles.증권;
  const termsFile = pendingFiles.약관;
  const text = $("#aiText").value.trim();
  if (!policyFile && !termsFile && !text) { toast("증권 파일을 먼저 올려주세요"); return; }
  const s = store.get("settings", {});
  const btn = $("#aiRun");
  btn.disabled = true;
  try {
    const p = await askGemini({ apiKey: s.key, model: s.model, policyFile, termsFile, text, onStep: (m) => ($("#aiStatus").textContent = m) });
    fillForm({ ...p, id: editingId, docs: editingDocs }, true);
    const n = (p.coverages || []).length;
    $("#aiStatus").textContent = `✅ 다 읽었어요! 보장 ${n}개를 찾았어요.` + (termsFile ? "" : " (약관이 없어서 면책·감액 같은 조건은 비어 있을 수 있어요)") + " ② 에서 확인하고 저장하세요.";
  } catch (err) {
    $("#aiStatus").textContent = "❌ " + err.message;
  } finally {
    btn.disabled = false;
  }
});

// ---------- 5. 설정 ----------
const settings = store.get("settings", {});
$("#sKey").value = settings.key || "";
$("#sModel").value = settings.model || "";
$("#saveSettings").addEventListener("click", () => {
  store.set("settings", { key: $("#sKey").value.trim(), model: $("#sModel").value.trim() || "gemini-2.5-flash" });
  toast("설정을 저장했어요");
});
$("#exportData").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(policies, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "내보험-백업.json";
  a.click();
});
$("#importData").addEventListener("change", async (e) => {
  try {
    const data = JSON.parse(await e.target.files[0].text());
    if (!Array.isArray(data)) throw new Error();
    policies = data; save(); toast("불러왔어요"); showTab("home");
  } catch { toast("백업 파일이 아닌 것 같아요"); }
});
$("#clearData").addEventListener("click", () => {
  if (confirm("등록한 보험을 전부 지울까요? (되돌릴 수 없어요)")) { policies = []; save(); renderHome(); toast("전부 지웠어요"); }
});

fillForm();
renderHome();
