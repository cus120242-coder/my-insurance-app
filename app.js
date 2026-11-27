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

// ---------- 가족 ----------
const ownerOf = (p) => (p.owner || "").trim() || "나";
// 가족 명단 (보험이 없어도 카드로 보여줘요) + 보험에 적힌 사람
let family = store.get("family", []);
const saveFamily = () => store.set("family", family);
const members = () => [...new Set([...family, ...policies.map(ownerOf)])];
let currentMember = "전체";

// ---------- 캐릭터 ----------
// 이름과 보험 종류로 저절로 골라요 (집 보험만 있으면 🏠, 자동차 보험만 있으면 🚗). 직접 바꿀 수도 있어요
let avatars = store.get("avatars", {});
const saveAvatars = () => store.set("avatars", avatars);
const AVATAR_CHOICES = Object.keys(AVATARS);
// 캐릭터 그림 (size: 큰 카드용 "lg", 글자 옆 "sm")
const face = (m, size = "sm") => `<span class="av av-${size}">${AVATARS[avatarOf(m)].svg}</span>`;
function avatarOf(m) {
  const picked = avatarId(avatars[m]);
  if (picked) return picked;
  const list = policies.filter((p) => ownerOf(p) === m);
  if (/집|주택|아파트|빌라/.test(m) || (list.length && list.every((p) => p.type === "주택"))) return "house";
  if (/자동차|차$|^차/.test(m) || (list.length && list.every((p) => p.type === "자동차"))) return "car";
  const rules = [[/할머니/, "grandma"], [/할아버지/, "grandpa"], [/엄마|어머니|아내|와이프/, "mom"], [/아빠|아버지|남편/, "dad"],
    [/딸|언니|누나|여동생/, "girl"], [/아들|오빠|형|남동생/, "boy"], [/아기|아가|막내/, "baby"]];
  for (const [re, id] of rules) if (re.test(m)) return id;
  return "me";
}
const visible = () => (currentMember === "전체" ? policies : policies.filter((p) => ownerOf(p) === currentMember));
// 보험 종류 나누기: 보험사 이름으로 생명/손해, 실손 보장이 있으면 실비
const insurerKind = (p) => /생명|라이프/.test(p.company || "") ? "생명" : /화재|손해|손보|해상/.test(p.company || "") ? "손해" : "";
const hasSilbi = (p) => (p.coverages || []).some((c) => c.category === "실손");
const isCar = (p) => p.type === "자동차";
const isHouse = (p) => p.type === "주택";
const isThing = (p) => isCar(p) || isHouse(p); // 사람이 아닌 차·집 보험 (보장 설명만 보여줘요)
const KIND_FILTERS = { 전체: () => true, 생명: (p) => insurerKind(p) === "생명", 손해: (p) => insurerKind(p) === "손해" && !isThing(p), 실비: hasSilbi, 자동차: isCar, 집: isHouse };
const KIND_LABEL = { 전체: "전체", 생명: "🏛️ 생명보험", 손해: "🔥 손해보험(화재)", 실비: "🏥 실비", 자동차: "🚗 자동차", 집: "🏠 집" };
let currentKind = "전체";
// 보험료 다 낸 보험: payEnd("YYYY-MM", 마지막으로 내는 달)가 지나면 저절로 "납입 완료"로 바뀌고 합계에서 빠져요
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const paidOff = (p) => /^\d{4}-\d{2}$/.test(p.payEnd || "") && thisMonth() > p.payEnd;
const payEndText = (p) => { const [y, m] = String(p.payEnd).split("-"); return `${y}년 ${Number(m)}월`; };
const monthly = (list) => list.reduce((s, p) => s + (paidOff(p) ? 0 : Number(p.premium) || 0), 0);

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
  if (name === "claim") { fillWho(); renderClaimTodo(); }
  window.scrollTo(0, 0);
}
document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
document.addEventListener("click", (e) => { const g = e.target.closest("[data-goto]"); if (g) showTab(g.dataset.goto); });

// ---------- 1. 내 보험 ----------
function shortCodes(codes, cause) {
  if (!codes || !codes.length) return "코드 미등록";
  if (codes.includes("*")) return cause === "상해" ? "모든 상해" : cause === "질병" ? "모든 질병" : "모든 질병/상해";
  return codes.length > 4 ? codes.slice(0, 4).join(", ") + ` 외 ${codes.length - 4}개` : codes.join(", ");
}
function renderHome() {
  renderClaimAlert();
  const empty = policies.length === 0;
  $("#emptyHome").classList.toggle("hidden", !empty);
  if (currentMember !== "전체" && !members().includes(currentMember)) currentMember = "전체";
  const fam = members();
  $("#family").innerHTML = fam.map((m) => {
    const list = policies.filter((p) => ownerOf(p) === m);
    return `
    <button class="fam ${m === currentMember ? "active" : ""}" data-member="${esc(m)}">
      <div class="face">${face(m, "lg")}</div>
      <div class="who">${esc(m)}</div>
      <div class="sm">보험 ${list.length}개</div>
      <div class="money">월 ${won(monthly(list))}</div>
    </button>`;
  }).join("") + `<button class="fam add" data-addmember>＋<br />가족 추가</button>`;
  $("#memberTools").innerHTML = currentMember === "전체" ? "" : `
    <span>${face(currentMember)} <b>${esc(currentMember)}</b> 보험만 보는 중</span>
    <button class="btn small ghost" data-allmembers>전체 보기</button>
    <button class="btn small ghost" data-pickface>캐릭터 바꾸기</button>
    <button class="btn small ghost" data-renamemember>이름 바꾸기</button>
    <button class="btn small danger" data-removemember>명단에서 빼기</button>`;

  const byMember = visible();
  $("#kindFilter").innerHTML = empty ? "" : Object.keys(KIND_FILTERS).map((k) => {
    const n = byMember.filter(KIND_FILTERS[k]).length;
    return `<button class="kind ${k === currentKind ? "active" : ""}" data-kind-filter="${k}">${KIND_LABEL[k]} <b>${n}</b></button>`;
  }).join("");
  const list = byMember.filter(KIND_FILTERS[currentKind]);
  const covCount = list.reduce((s, p) => s + (p.coverages || []).length, 0);
  $("#summary").innerHTML = empty ? "" : `
    <div class="stat"><div class="k">${currentMember === "전체" ? "가족 전체 보험" : esc(currentMember) + "의 보험"}</div><div class="v">${list.length}개</div></div>
    <div class="stat"><div class="k">보장 항목</div><div class="v">${covCount}개</div></div>
    <div class="stat"><div class="k">월 보험료 합계</div><div class="v">${won(monthly(list))}</div></div>`;

  $("#policyList").innerHTML = list.map((p) => `
    <article class="policy">
      <header>
        <div>
          <div class="name">${esc(p.product)}</div>
          <div class="meta">${esc(p.company)} · ${esc(p.startDate || "?")} ~ ${esc(p.endDate || "?")}</div>
          <div><span class="tag owner">${face(ownerOf(p))} ${esc(ownerOf(p))}</span>${isCar(p) ? `<span class="tag fire">🚗 자동차보험</span>` : isHouse(p) ? `<span class="tag fire">🏠 집 보험</span>` : insurerKind(p) ? `<span class="tag ${insurerKind(p) === "생명" ? "life" : "fire"}">${insurerKind(p) === "생명" ? "🏛️ 생명보험" : "🔥 손해보험"}</span>` : ""}${hasSilbi(p) ? `<span class="tag silbi">🏥 실비 포함</span>` : ""}<span class="tag">${esc(p.type)}</span>${paidOff(p) ? `<span class="tag have">✅ 납입 완료 (${esc(payEndText(p))}까지 냄)</span>` : p.premium ? `<span class="tag money">월 ${won(p.premium)}</span>${p.payEnd ? `<span class="tag">${esc(payEndText(p))}까지 납입</span>` : ""}` : ""}${p.payDay ? `<span class="tag">매월 ${esc(p.payDay)}일 납입</span>` : ""}</div>
          ${p.payNote ? `<div class="meta">💳 ${esc(p.payNote)}</div>` : ""}
          ${p.memo ? `<details class="memo"><summary>📝 꼭 알아둘 조건</summary><ul>${String(p.memo).split("\n").filter(Boolean).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></details>` : ""}
          ${p.phone ? `<div class="meta">☎️ 고객센터 <a class="phone" href="tel:${esc(String(p.phone).replace(/[^0-9+]/g, ""))}">${esc(p.phone)}</a></div>` : ""}
          <div class="doclinks">${Object.keys(DOC_KINDS).map((k) => p.docs && p.docs[k]
            ? `<button class="tag have" data-view="${esc(p.id)}" data-kind="${k}">✅ ${k} 보기</button>`
            : k === "약관" && p.termsSource ? `<span class="tag have">📘 약관 반영됨</span>`
            : k === "증권" && p.policySource ? `<span class="tag have">📄 증권 반영됨</span>`
            : `<span class="tag miss">⚠️ ${k} 없음</span>`).join("")}</div>
          ${p.termsSource ? `<div class="meta">📘 약관 규칙: 디디가 정리한 「${esc(p.termsSource)}」${p.units ? ` · 주계약 ${esc(p.units.main)}구좌` : ""}</div>` : !(p.docs && p.docs.약관) ? `<div class="meta">약관이 없어서 질병코드·면책·감액 조건을 확인 못 했어요</div>` : ""}
        </div>
        <div>
          <button class="btn small ghost" data-edit="${esc(p.id)}">수정</button>
          <button class="btn small danger" data-del="${esc(p.id)}">삭제</button>
        </div>
      </header>
      <table class="covs">
        ${(p.coverages || []).map((c) => `
          <tr>
            <td>${esc(c.name)}${c.paidBefore ? ` <span class="tag miss">이미 받음</span>` : ""}<div class="codes">${isThing(p) ? esc(c.note || "") : `${esc(c.category)} · ${esc(c.cause || "모두")} · ${esc(shortCodes(c.codes, c.cause))}${c.waitingDays ? ` · 면책 ${c.waitingDays}일` : ""}`}</div></td>
            <td class="amt${c.amountText ? " txt" : ""}">${c.amountText ? esc(c.amountText) : c.amountsByClass ? Object.entries(c.amountsByClass).map(([k, v]) => `${esc(k)}종 ${won(v)}`).join("<br />") : won(c.amount) + (c.category === "입원" ? "/일" : c.category === "통원" ? "/회" : "")}</td>
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
      // PDF·그림만 화면으로 열어요. 다른 종류(예: 웹페이지)는 앱 안에서 실행되지 않게 내려받기로만 처리해요
      const safe = /^(application\/pdf|image\/(png|jpeg|webp|gif))$/.test(f.type);
      const url = URL.createObjectURL(safe ? f : new Blob([f], { type: "application/octet-stream" }));
      if (safe) window.open(url, "_blank");
      else { const a = document.createElement("a"); a.href = url; a.download = f.name || "file"; a.click(); }
    });
  }
  if (del && confirm("이 보험을 지울까요?")) {
    policies = policies.filter((p) => p.id !== del.dataset.del);
    Object.keys(DOC_KINDS).forEach((k) => fileDB.del(`${del.dataset.del}:${k}`).catch(() => {}));
    save(); renderHome(); toast("지웠어요");
  }
  if (edit) { fillForm(policies.find((p) => p.id === edit.dataset.edit)); showTab("add"); }
});
$("#kindFilter").addEventListener("click", (e) => {
  const b = e.target.closest("[data-kind-filter]");
  if (b) { currentKind = b.dataset.kindFilter; renderHome(); }
});
$("#family").addEventListener("click", (e) => {
  const b = e.target.closest("[data-member]");
  if (b) { currentMember = currentMember === b.dataset.member ? "전체" : b.dataset.member; renderHome(); }
  if (e.target.closest("[data-addmember]")) {
    const name = (prompt("가족 이름을 넣어주세요 (예: 엄마, 아빠, 큰딸, 작은딸)") || "").trim();
    if (!name) return;
    if (members().includes(name)) return toast("이미 있는 이름이에요. 딸이 둘이면 '큰딸', '작은딸'처럼 다르게 써주세요");
    family.push(name); saveFamily(); renderHome(); toast(`${name}을(를) 추가했어요`);
  }
});
$("#memberTools").addEventListener("click", (e) => {
  const m = currentMember;
  if (e.target.closest("[data-allmembers]")) { currentMember = "전체"; renderHome(); }
  if (e.target.closest("[data-pickface]")) {
    const old = $("#facePicker");
    if (old) return old.remove();
    $("#memberTools").insertAdjacentHTML("beforeend", `<div id="facePicker" class="facepicker">${AVATAR_CHOICES.map((f) => `<button data-face="${f}" class="${avatarOf(m) === f ? "active" : ""}" title="${AVATARS[f].label}">${AVATARS[f].svg}</button>`).join("")}<button data-face="" class="auto">처음대로</button></div>`);
  }
  const f = e.target.closest("[data-face]");
  if (f) {
    if (f.dataset.face) avatars[m] = f.dataset.face; else delete avatars[m];
    saveAvatars(); renderHome(); toast("캐릭터를 바꿨어요");
  }
  if (e.target.closest("[data-renamemember]")) {
    const name = (prompt("새 이름", m) || "").trim();
    if (!name || name === m) return;
    if (members().includes(name)) return toast("이미 있는 이름이에요");
    family = members().map((x) => (x === m ? name : x)); saveFamily();
    if (avatars[m]) { avatars[name] = avatars[m]; delete avatars[m]; saveAvatars(); }
    policies.forEach((p) => { if (ownerOf(p) === m) p.owner = name; }); save();
    currentMember = name; renderHome(); toast("이름을 바꿨어요");
  }
  if (e.target.closest("[data-removemember]")) {
    if (policies.some((p) => ownerOf(p) === m)) return toast(`${m}의 보험이 있어서 뺄 수 없어요. 보험을 먼저 지우거나 다른 사람으로 옮겨주세요`);
    family = family.filter((x) => x !== m); saveFamily(); currentMember = "전체"; renderHome(); toast("명단에서 뺐어요");
  }
});
$("#loadSample").addEventListener("click", () => {
  policies = JSON.parse(JSON.stringify(SAMPLE_POLICIES));
  save(); renderHome(); toast("예시 보험을 불러왔어요");
});

// ---------- 2. 청구 확인 ----------
$("#cDate").value = new Date().toISOString().slice(0, 10);
function fillWho() {
  const fam = members();
  const prev = $("#cWho").value;
  $("#cWho").innerHTML = fam.map((m) => `<option ${m === prev || (!prev && m === currentMember) ? "selected" : ""}>${esc(m)}</option>`).join("");
}
$("#cCode").addEventListener("input", () => {
  const v = $("#cCode").value.trim();
  const p = parseCode(v);
  $("#cCodeName").textContent = !v ? "" : p ? `👉 ${p.raw}: ${describeCode(v)}${isInjuryCode(v) ? " (상해)" : " (질병)"}` : "코드 모양이 이상해요. 예: C50, I63.9";
});
// 병원 서류: 화면에서 보기만 하고 저장하지 않아요 (앱을 닫으면 사라져요)
let claimDocs = [];
function renderClaimDocs() {
  $("#cDocList").innerHTML = claimDocs.map((d, i) => `
    <div class="doc">
      ${d.type.startsWith("image/") ? `<img src="${d.url}" alt="${esc(d.name)}" />` : `<a class="pdf" href="${d.url}" target="_blank" rel="noopener">📄 ${esc(d.name)} (눌러서 보기)</a>`}
      <button class="x" data-deldoc="${i}" aria-label="빼기">✕</button>
    </div>`).join("");
  $("#cReadCode").classList.toggle("hidden", !claimDocs.length);
  if (!claimDocs.length) $("#cOcr").innerHTML = "";
}

// 사진에서 질병코드 읽기: 도구(ocr 폴더)는 버튼을 누를 때만 불러오고, 모두 이 기기 안에서 읽어요
let ocrLoading = null;
function loadOcr() {
  return (ocrLoading ||= new Promise((res, rej) => {
    const sc = document.createElement("script");
    sc.src = "ocr/tesseract.min.js";
    sc.onload = res;
    sc.onerror = () => { ocrLoading = null; sc.remove(); rej(new Error("load")); };
    document.head.appendChild(sc);
  }));
}
$("#cReadCode").addEventListener("click", async () => {
  const imgs = claimDocs.filter((d) => d.type.startsWith("image/"));
  if (!imgs.length) return toast("사진을 올려주세요. PDF는 화면을 캡처해서 사진으로 올리면 읽을 수 있어요");
  const btn = $("#cReadCode"), box = $("#cOcr");
  const say = (t) => { box.innerHTML = `<p class="hint">⏳ ${t}</p>`; };
  btn.disabled = true;
  try {
    say("읽는 도구를 준비하는 중… (처음 한 번은 약 7MB를 받아서 조금 걸려요)");
    await loadOcr();
    const worker = await Tesseract.createWorker("eng", 1, {
      workerPath: "ocr/worker.min.js", corePath: "ocr", langPath: "ocr", workerBlobURL: false,
      logger: (m) => { if (m.status === "recognizing text") say(`글자 읽는 중… ${Math.round(m.progress * 100)}%`); },
    });
    // 서류는 표 모양이라 "흩어진 글자 찾기"(11)로 먼저 읽고, 못 찾으면 "보통 문서"(3)로 한 번 더
    let codes = [];
    for (const psm of ["11", "3"]) {
      await worker.setParameters({ tessedit_pageseg_mode: psm });
      let text = "";
      for (const d of imgs) text += "\n" + (await worker.recognize(d.file)).data.text;
      codes = findCodesInText(text);
      if (codes.length) break;
    }
    await worker.terminate();
    box.innerHTML = codes.length
      ? `<p class="hint">찾은 코드예요. <b>서류에 적힌 것과 같은지 눈으로 확인</b>하고 눌러주세요 (가끔 틀리게 읽어요)</p>
         <div class="codechips">${codes.map((c) => `<button class="tag have" data-pickcode="${esc(c.code)}">${esc(c.code)}${c.known ? " " + esc(c.name) : ""}</button>`).join("")}</div>`
      : `<div class="box warn">질병코드를 못 찾았어요. 코드 칸이 크고 밝게 나오게 다시 찍거나, 직접 넣어주세요.</div>`;
  } catch {
    box.innerHTML = `<div class="box warn">읽지 못했어요. 처음 한 번은 인터넷이 켜져 있어야 해요. 다시 눌러 주세요.</div>`;
  }
  btn.disabled = false;
});
$("#cOcr").addEventListener("click", (e) => {
  const b = e.target.closest("[data-pickcode]");
  if (!b) return;
  $("#cCode").value = b.dataset.pickcode;
  $("#cCode").dispatchEvent(new Event("input"));
  toast(`${b.dataset.pickcode}를 넣었어요`);
});

// ---------- 청구할 일 + 3년 마감 알림 (이 기기 안에만 저장, 서류 사진은 저장 안 함) ----------
let claims = store.get("claims", []);
const saveClaims = () => store.set("claims", claims);
let lastClaim = null;
const claimDone = (c) => c.companies.length > 0 && c.companies.every((x) => x.done);
const ddayText = (n) => (n > 0 ? `D-${n}` : n === 0 ? "오늘 마감" : "마감 지남");
const pendingClaims = () => claims.filter((c) => !claimDone(c)).sort((a, b) => (a.date < b.date ? -1 : 1));
function renderClaimAlert() {
  const list = pendingClaims();
  if (!list.length) { $("#claimAlert").innerHTML = ""; return; }
  const c = list[0], n = daysLeft(claimDeadline(c.date));
  $("#claimAlert").innerHTML = `
    <div class="box ${n <= 90 ? "warn" : "info"} alert">
      <b>⏰ 아직 청구 안 한 일 ${list.length}개</b>
      <div>가장 급한 것: ${face(c.who)} ${esc(c.who)} · ${esc(c.code)} — 마감 ${esc(claimDeadline(c.date))} (<b>${ddayText(n)}</b>)</div>
      <button class="btn small" data-goto="claim">보러 가기</button>
    </div>`;
}
function renderClaimTodo() {
  if (!claims.length) { $("#claimTodo").innerHTML = ""; return; }
  const sorted = [...pendingClaims(), ...claims.filter(claimDone)];
  $("#claimTodo").innerHTML = `<h2 class="person">⏰ 청구할 일 (${pendingClaims().length}개 남음)</h2>
    <p class="hint">보험금은 치료받은 날부터 <b>3년 안에</b> 청구해야 해요 (상법 제662조). 청구한 회사는 체크해 두세요.</p>` +
    sorted.map((c) => {
      const dl = claimDeadline(c.date), n = daysLeft(dl), done = claimDone(c);
      return `
      <div class="panel todo ${done ? "done" : n <= 90 ? "urgent" : ""}">
        <div class="top-line"><span>${face(c.who)} ${esc(c.who)} · ${esc(c.code)} ${esc(describeCode(c.code) || "")}</span><span class="dday">${done ? "✅ 끝" : ddayText(n)}</span></div>
        <div class="hint">치료받은 날 ${esc(c.date)} → 청구 마감 <b>${esc(dl)}</b></div>
        ${!done && n < 0 ? `<div class="box warn">⛔ 3년이 지났어요. 그래도 보험사에 한 번 물어보세요.</div>` : ""}
        <div class="todo-co">${c.companies.map((x, i) => `<label class="chk"><input type="checkbox" data-claimdone="${esc(c.id)}|${i}" ${x.done ? "checked" : ""} /> 🏢 ${esc(x.name)} 청구했어요</label>`).join("") || `<span class="hint">청구할 보험사를 못 찾았어요</span>`}</div>
        <div class="todo-btns">
          ${done ? "" : `<button class="btn small ghost" data-ics="${esc(c.id)}">📅 폰 달력에 마감일 넣기</button>`}
          <button class="btn small ghost" data-delclaim="${esc(c.id)}">🗑️ 지우기</button>
        </div>
      </div>`;
    }).join("");
}
// 폰 달력 파일(.ics): 마감 30일 전·7일 전에 폰이 알려줘요. 건강정보(질병코드)는 넣지 않아요
function icsEsc(t) { return String(t).replace(/[\\;,]/g, (c) => "\\" + c).replace(/\n/g, " "); }
function downloadIcs(c) {
  const dl = claimDeadline(c.date), d = dl.replace(/-/g, "");
  const next = new Date(dl + "T00:00:00Z"); next.setUTCDate(next.getUTCDate() + 1);
  const d2 = next.toISOString().slice(0, 10).replace(/-/g, "");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const alarm = (days) => ["BEGIN:VALARM", `TRIGGER:-P${days}D`, "ACTION:DISPLAY", `DESCRIPTION:보험 청구 마감 ${days}일 전`, "END:VALARM"];
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//my-insurance-app//KO", "BEGIN:VEVENT",
    `UID:${c.id}@my-insurance-app`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${d2}`,
    `SUMMARY:${icsEsc(`보험 청구 마감 (${c.who})`)}`, `DESCRIPTION:${icsEsc(`청구할 곳: ${c.companies.filter((x) => !x.done).map((x) => x.name).join(", ")}`)}`,
    ...alarm(30), ...alarm(7), "END:VEVENT", "END:VCALENDAR"];
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" }));
  a.download = `보험청구마감-${dl}.ics`;
  a.click();
  toast("받은 파일을 열면 폰 달력에 들어가요");
}
$("#claimTodo").addEventListener("change", (e) => {
  const cb = e.target.closest("[data-claimdone]");
  if (!cb) return;
  const [id, i] = cb.dataset.claimdone.split("|");
  const c = claims.find((x) => x.id === id);
  if (c) { c.companies[Number(i)].done = cb.checked; saveClaims(); renderClaimTodo(); if (claimDone(c)) toast("다 청구했어요! 👏"); }
});
$("#claimTodo").addEventListener("click", (e) => {
  const ics = e.target.closest("[data-ics]"), del = e.target.closest("[data-delclaim]");
  if (ics) { const c = claims.find((x) => x.id === ics.dataset.ics); if (c) downloadIcs(c); }
  if (del && confirm("이 청구할 일을 지울까요?")) { claims = claims.filter((x) => x.id !== del.dataset.delclaim); saveClaims(); renderClaimTodo(); }
});
$("#claimResult").addEventListener("click", (e) => {
  if (!e.target.closest("#saveClaim") || !lastClaim) return;
  const same = claims.find((x) => x.who === lastClaim.who && x.code === lastClaim.code && x.date === lastClaim.date);
  if (same) {
    for (const co of lastClaim.companies) if (!same.companies.some((x) => x.name === co.name)) same.companies.push(co);
  } else claims.push({ id: "c" + Date.now().toString(36), ...lastClaim });
  saveClaims(); renderClaimTodo(); toast("청구할 일에 저장했어요. 맨 위에서 볼 수 있어요");
  window.scrollTo({ top: 0, behavior: "smooth" });
});
$("#cDocs").addEventListener("change", (e) => {
  for (const f of e.target.files) {
    if (!(f.type.startsWith("image/") || f.type === "application/pdf")) { toast("사진이나 PDF만 올릴 수 있어요"); continue; }
    claimDocs.push({ name: f.name, type: f.type, file: f, url: URL.createObjectURL(f) });
  }
  e.target.value = "";
  renderClaimDocs();
});
$("#cDocList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-deldoc]");
  if (!b) return;
  URL.revokeObjectURL(claimDocs[b.dataset.deldoc].url);
  claimDocs.splice(Number(b.dataset.deldoc), 1);
  renderClaimDocs();
});

function companyHTML(groups) {
  if (!groups.length) return `<div class="box warn"><h3>🏢 어디에 청구할까요?</h3>받을 수 있는 보험사를 못 찾았어요. 입원·수술·병원비 칸도 채워보세요.</div>`;
  return `<div class="box info">
      <h3>🏢 어디에 청구할까요? (${groups.length}곳)</h3>
      <p class="hint">회사마다 청구서를 <b>따로</b> 내요. 같은 서류 사진을 각 회사 앱에 올리면 돼요.</p>
    </div>` + groups.map((g) => `
    <div class="panel company">
      <h3><span>🏢 ${esc(g.company)}</span><span>${g.sure || !g.maybe ? won(g.sure) : "⚠️ " + won(g.maybe)}</span></h3>
      ${g.sure && g.maybe ? `<div class="hint">⚠️ 확인 필요 ${won(g.maybe)} 더</div>` : !g.sure && g.maybe ? `<div class="hint">⚠️ 조건을 확인해야 하는 금액이에요</div>` : ""}
      ${g.phone ? `<div class="meta">☎️ <a class="phone" href="tel:${esc(String(g.phone).replace(/[^0-9+]/g, ""))}">${esc(g.phone)}</a></div>` : `<div class="hint">☎️ 전화번호 미등록 (보험 수정에서 넣을 수 있어요)</div>`}
      <ul>${g.items.map((r) => `<li>${r.status === "가능" ? "✅" : "⚠️"} ${esc(r.coverage.name)} — ${r.amount ? won(r.amount) : "금액 ❓"} <small>(${esc(r.policy.product || "")})</small></li>`).join("")}</ul>
    </div>`).join("");
}

$("#runClaim").addEventListener("click", () => {
  const event = {
    code: $("#cCode").value.trim(),
    date: $("#cDate").value,
    diagnosis: $("#cDiag").checked,
    surgery: $("#cSurg").checked,
    surgeryClass: $("#cSurgClass").value,
    preExisting: $("#cPre").checked,
    hospitalDays: $("#cDays").value,
    icuDays: $("#cIcu").value,
    outpatientVisits: $("#cVisits").value,
    medicalCost: $("#cCost").value,
  };
  if (!parseCode(event.code)) { toast("질병코드를 먼저 넣어주세요 (예: C50)"); return; }
  if (!policies.length) { toast("먼저 보험을 등록해주세요"); return; }
  const who = $("#cWho").value;
  const { results, sure, maybe } = checkClaim(policies.filter((p) => ownerOf(p) === who), event);
  const label = { 가능: "✅ 청구 가능", 확인필요: "⚠️ 확인 필요", 불가: "❌ 해당 안 됨" };
  const groups = groupByCompany(results);
  const deadline = claimDeadline(event.date);
  lastClaim = deadline ? { who, code: parseCode(event.code).raw, date: event.date, companies: groups.map((g) => ({ name: g.company, done: false })) } : null;
  $("#claimResult").innerHTML = `
    <div class="total">
      <div class="k">${face(who)} ${esc(who)} · ${esc(event.code.toUpperCase())} ${esc(describeCode(event.code))} — ✅ 확실한 예상 보험금</div>
      <div class="v">${won(sure)}</div>
      ${maybe ? `<div class="k">⚠️ 확인 필요 금액 ${won(maybe)} 더 (조건에 맞는 것만 받아요. 서로 겹치면 일부만)</div>` : ""}
      <div class="k">해당 보장 ${results.length}개 중 받을 수 있는 것 ${results.filter((r) => r.amount > 0).length}개</div>
    </div>
    ${companyHTML(groups)}
    <div class="panel">
      <h3>⏰ 청구 마감일</h3>
      ${deadline ? `<p>치료받은 날부터 3년 → <b>${esc(deadline)}</b>까지 (${ddayText(daysLeft(deadline))})</p>
        ${groups.length ? `<button class="btn" id="saveClaim">💾 청구할 일로 저장 (마감 알림)</button>
        <p class="hint">저장하면 📋 내 보험 맨 위에 아직 청구 안 한 일이 보여요. 서류 사진은 저장하지 않아요.</p>` : ""}`
        : `<p class="hint">진단·치료받은 날을 넣으면 마감일을 알려줘요.</p>`}
    </div>
    <h3 class="person">📋 보장별 자세히</h3>
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
  if (!policies.length) { $("#overlapResult").innerHTML = `<div class="empty">먼저 보험을 등록해주세요.</div>`; return; }
  $("#overlapResult").innerHTML = `<p class="hint">겹치는 보장은 <b>같은 사람</b>의 보험끼리만 비교해요.</p>` + members().map((m) => {
    const list = findOverlaps(policies.filter((p) => ownerOf(p) === m));
    return `<h3 class="person">${face(m)} ${esc(m)}</h3>` + (list.length ? overlapHTML(list) : `<div class="box info">👍 겹치는 보장이 없어요</div>`);
  }).join("");
}
function overlapHTML(list) {
  return list.map((o) => `
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
      <label class="chk"><input type="checkbox" data-f="paidBefore" ${c.paidBefore ? "checked" : ""} /> 이 보장은 이미 받았어요 ${c.onceOnly ? "<b>(최초 1회만 주는 보장)</b>" : ""}</label>
      <input type="hidden" data-f="extra" value="${esc(JSON.stringify(c))}" />
      <button class="btn small danger" data-rm>이 줄 삭제</button>
    </div>`;
}
$("#addCov").addEventListener("click", () => $("#covRows").insertAdjacentHTML("beforeend", covRowHTML()));
$("#covRows").addEventListener("click", (e) => { if (e.target.closest("[data-rm]")) e.target.closest(".covrow").remove(); });

function fillForm(p = {}, keepFiles = false) {
  editingId = p.id || null;
  editingDocs = { ...(p.docs || {}) };
  editingExtra = { templateId: p.templateId, policySource: p.policySource, termsSource: p.termsSource, preExistingRule: p.preExistingRule, units: p.units, memo: p.memo, payNote: p.payNote, payEnd: p.payEnd };
  if (!keepFiles) {
    pendingFiles = { 증권: null, 약관: null };
    $("#docPolicy").value = "";
    $("#docTerms").value = "";
    $("#aiStatus").textContent = "";
  }
  showDocState();
  $("#fOwner").value = p.owner || (currentMember !== "전체" ? currentMember : "");
  $("#ownerList").innerHTML = members().map((m) => `<option value="${esc(m)}">`).join("");
  $("#fPayDay").value = p.payDay || "";
  $("#fPhone").value = p.phone || "";
  $("#fCompany").value = p.company || "";
  $("#fProduct").value = p.product || "";
  $("#fType").value = p.type === "실손" ? "실손" : "정액";
  $("#fPremium").value = p.premium || "";
  $("#fStart").value = p.startDate || "";
  $("#fEnd").value = p.endDate || "";
  $("#covRows").innerHTML = (p.coverages && p.coverages.length ? p.coverages : [{}]).map(covRowHTML).join("");
}
let editingDocs = {};
let editingExtra = {};
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
      paidBefore: row.querySelector('[data-f="paidBefore"]').checked,
    };
  }).filter((c) => c.name);
  return {
    id: editingId || "p-" + Date.now(),
    owner: $("#fOwner").value.trim() || "나",
    payDay: Number($("#fPayDay").value) || "",
    phone: $("#fPhone").value.trim(),
    company: $("#fCompany").value.trim(),
    product: $("#fProduct").value.trim(),
    type: $("#fType").value,
    premium: Number($("#fPremium").value) || 0,
    startDate: $("#fStart").value,
    endDate: $("#fEnd").value,
    ...Object.fromEntries(Object.entries(editingExtra).filter(([, v]) => v != null)),
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
  if (!family.includes(p.owner)) { family = [...members().filter((x) => x !== p.owner), p.owner]; saveFamily(); }
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
    fillForm({ ...p, id: editingId, docs: editingDocs, owner: $("#fOwner").value, payDay: $("#fPayDay").value, phone: $("#fPhone").value }, true);
    const n = (p.coverages || []).length;
    $("#aiStatus").textContent = `✅ 다 읽었어요! 보장 ${n}개를 찾았어요.` + (termsFile ? "" : " (약관이 없어서 면책·감액 같은 조건은 비어 있을 수 있어요)") + " ② 에서 확인하고 저장하세요.";
  } catch (err) {
    $("#aiStatus").textContent = "❌ " + err.message;
  } finally {
    btn.disabled = false;
  }
});

// ---------- 디디가 정리한 약관 틀 ----------
$("#tplSelect").innerHTML += POLICY_TEMPLATES.map((t) => `<option value="${esc(t.id)}">${esc(t.label)}</option>`).join("");
$("#tplSelect").addEventListener("change", () => {
  const t = POLICY_TEMPLATES.find((x) => x.id === $("#tplSelect").value);
  $("#tplUnits").innerHTML = t ? `<div class="row2">${t.units.map((u) => `
    <label>${esc(u.label)} <input type="number" min="0" step="any" data-unit="${esc(u.key)}" value="${u.default}" /><small class="hint">${esc(u.hint)}</small></label>`).join("")}</div>` : "";
});
$("#tplApply").addEventListener("click", () => {
  const t = POLICY_TEMPLATES.find((x) => x.id === $("#tplSelect").value);
  if (!t) return toast("목록에서 보험을 먼저 골라주세요");
  const units = {};
  document.querySelectorAll("[data-unit]").forEach((i) => (units[i.dataset.unit] = Number(i.value) || 0));
  if (!units.main) return toast("주계약 구좌 수를 넣어주세요 (증권에 있어요)");
  const built = buildFromTemplate(t, units);
  fillForm({ ...built, id: editingId, docs: editingDocs, owner: $("#fOwner").value, payDay: $("#fPayDay").value, phone: $("#fPhone").value, premium: $("#fPremium").value, startDate: $("#fStart").value, endDate: $("#fEnd").value }, true);
  $("#aiStatus").textContent = "";
  toast(`보장 ${built.coverages.length}개를 채웠어요. ②에서 누구 보험인지·가입일을 넣고 저장하세요`);
  $("#fOwner").scrollIntoView({ behavior: "smooth" });
});

// ---------- 5. 설정 ----------
// 제미나이 기능을 숨겼으니, 예전에 저장한 키는 이 기기에서 지워요 (키 자체는 구글 AI 스튜디오에 그대로 있어요)
{ const s0 = store.get("settings", {}); if (s0.key) { delete s0.key; store.set("settings", s0); } }
const settings = store.get("settings", {});
$("#sKey").value = settings.key || "";
$("#sModel").value = settings.model || "";
$("#saveSettings").addEventListener("click", () => {
  store.set("settings", { key: $("#sKey").value.trim(), model: $("#sModel").value.trim() || "gemini-2.5-flash" });
  toast("설정을 저장했어요");
});
$("#exportData").addEventListener("click", () => {
  // 가족 명단도 같이 담아요 (예전 파일처럼 보험만 있는 배열도 불러올 수 있어요)
  const data = { app: "내 보험 한눈에", version: 2, family: members(), avatars, policies, claims };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "내보험-백업.json";
  a.click();
});
$("#importData").addEventListener("change", async (e) => {
  try {
    const data = JSON.parse(await e.target.files[0].text());
    const list = Array.isArray(data) ? data : data && Array.isArray(data.policies) ? data.policies : null;
    if (!list) throw new Error();
    if (data.family && Array.isArray(data.family)) {
      for (const m of data.family) if (m && !members().includes(m)) family.push(m);
      saveFamily();
    }
    if (data.avatars && typeof data.avatars === "object") {
      for (const [k, v] of Object.entries(data.avatars)) if (!avatars[k] && avatarId(v)) avatars[k] = avatarId(v);
      saveAvatars();
    }
    if (Array.isArray(data.claims)) {
      for (const c of data.claims) if (c && c.id && Array.isArray(c.companies) && !claims.some((x) => x.id === c.id)) claims.push(c);
      saveClaims();
    }
    let added = 0, updated = 0;
    for (const p of list) {
      const i = policies.findIndex((x) => x.id === p.id);
      if (i >= 0) {
        // 누나가 앱에서 체크한 "이미 받았어요"는 다시 불러와도 지키기
        const paid = new Set((policies[i].coverages || []).filter((c) => c.paidBefore).map((c) => c.name));
        (p.coverages || []).forEach((c) => { if (paid.has(c.name)) c.paidBefore = true; });
        policies[i] = p; updated++;
      } else { policies.push(p); added++; }
    }
    // 증권·약관 원본 파일이 들어 있으면 이 기기 파일 창고에 넣어요
    let fileCount = 0;
    for (const [key, f] of Object.entries((data && data.files) || {})) {
      const [pid, kind] = key.split(":");
      const pol = policies.find((x) => x.id === pid);
      if (!pol || !DOC_KINDS[kind] || !f || !f.data) continue;
      const bin = atob(f.data);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const okType = /^(application\/pdf|image\/(png|jpeg|webp|gif))$/.test(f.type || "") ? f.type : "application/octet-stream";
      await fileDB.put(key, new File([bytes], String(f.name || kind), { type: okType }));
      pol.docs = { ...(pol.docs || {}), [kind]: f.name };
      fileCount++;
    }
    save(); toast(`새로 ${added}개, 바뀐 것 ${updated}개를 합쳤어요` + (fileCount ? ` · 원본 파일 ${fileCount}개 저장` : "")); showTab("home");
  } catch { toast("백업 파일이 아닌 것 같아요"); }
  e.target.value = "";
});
$("#clearData").addEventListener("click", () => {
  if (confirm("등록한 보험을 전부 지울까요? (되돌릴 수 없어요)")) { policies = []; family = []; claims = []; save(); saveFamily(); saveClaims(); currentMember = "전체"; renderHome(); toast("전부 지웠어요"); }
});

// ---------- 잠금 (숫자 4자리) ----------
async function hashPin(pin) {
  const data = new TextEncoder().encode("insurance-app:" + pin);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const pinOk = (v) => /^\d{4}$/.test(v);
function showPinState() { $("#pinState").textContent = store.get("pin", null) ? "✅ 지금 잠금이 켜져 있어요" : "지금은 잠금이 꺼져 있어요"; }
$("#setPin").addEventListener("click", async () => {
  const v = $("#sPin").value.trim();
  if (!pinOk(v)) return toast("숫자 4자리를 넣어주세요");
  store.set("pin", await hashPin(v));
  $("#sPin").value = ""; showPinState(); toast("잠금을 켰어요. 다음에 열 때 물어봐요");
});
$("#removePin").addEventListener("click", () => {
  if (!store.get("pin", null)) return toast("잠금이 이미 꺼져 있어요");
  if (confirm("잠금을 끌까요?")) { localStorage.removeItem("pin"); showPinState(); toast("잠금을 껐어요"); }
});
async function tryUnlock() {
  const v = $("#lockPin").value.trim();
  if (pinOk(v) && (await hashPin(v)) === store.get("pin", null)) { $("#lock").classList.add("hidden"); $("#lockPin").value = ""; }
  else { $("#lockMsg").textContent = "비밀번호가 달라요"; $("#lockPin").value = ""; }
}
$("#lockOpen").addEventListener("click", tryUnlock);
$("#lockPin").addEventListener("input", () => { if ($("#lockPin").value.length === 4) tryUnlock(); });
$("#lockForgot").addEventListener("click", async () => {
  if (!confirm("비밀번호는 되찾을 수 없어요. 이 기기에 저장된 보험과 파일을 전부 지우고 처음부터 시작할까요?")) return;
  localStorage.clear();
  try { indexedDB.deleteDatabase("insurance-files"); } catch {}
  location.reload();
});
if (store.get("pin", null)) { $("#lock").classList.remove("hidden"); setTimeout(() => $("#lockPin").focus(), 50); }
showPinState();

fillForm();
renderHome();

// 인터넷이 없어도 열리게 (웹 주소로 열었을 때만)
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

// 🌙 밤 모드 (설정에서 켜고 끄기)
$("#darkMode").checked = document.documentElement.dataset.theme === "dark";
$("#darkMode").addEventListener("change", (e) => {
  try { localStorage.setItem("theme", e.target.checked ? "dark" : "light"); } catch {}
  applyTheme(e.target.checked);
});
