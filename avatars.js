// 가족 캐릭터 그림 (디디가 직접 그린 그림, 바깥 파일 없이 이 안에서 그려요)
(function () {
  const SKIN = "#ffd9b8", INK = "#3a2e2a", CHEEK = "#ff8fa3";
  const eyes = (y = 31, gap = 5) =>
    `<ellipse cx="${32 - gap}" cy="${y}" rx="1.9" ry="2.4" fill="${INK}"/><ellipse cx="${32 + gap}" cy="${y}" rx="1.9" ry="2.4" fill="${INK}"/>` +
    `<circle cx="${32 - gap + 0.7}" cy="${y - 0.9}" r=".7" fill="#fff"/><circle cx="${32 + gap + 0.7}" cy="${y - 0.9}" r=".7" fill="#fff"/>`;
  const cheeks = (y = 35.5) => `<circle cx="23.5" cy="${y}" r="2.6" fill="${CHEEK}" opacity=".55"/><circle cx="40.5" cy="${y}" r="2.6" fill="${CHEEK}" opacity=".55"/>`;
  const smile = (y = 36.5) => `<path d="M28.6 ${y} Q32 ${y + 3.6} 35.4 ${y}" stroke="${INK}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  const glasses = `<g fill="none" stroke="${INK}" stroke-width="1.3"><circle cx="27" cy="31" r="4.2"/><circle cx="37" cy="31" r="4.2"/><path d="M31.2 31h1.6"/></g>`;
  const body = (shirt, extra = "") => `<path d="M12 64c0-11 9-17 20-17s20 6 20 17z" fill="${shirt}"/>${extra}`;
  const head = (skin = SKIN) => `<circle cx="18.5" cy="32" r="3.2" fill="${skin}"/><circle cx="45.5" cy="32" r="3.2" fill="${skin}"/><circle cx="32" cy="30" r="14" fill="${skin}"/>`;
  const wrap = (bg, inner) => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="32" cy="32" r="32" fill="${bg}"/><g>${inner}</g></svg>`;
  const person = ({ bg, shirt, back = "", front = "", acc = "", bodyExtra = "", face }) =>
    wrap(bg, back + body(shirt, bodyExtra) + head() + front + (face || eyes() + cheeks() + smile()) + acc);

  const A = {
    mom: { label: "엄마", svg: person({
      bg: "#ffe3ec", shirt: "#ff7aa2",
      back: `<path d="M15 31c0-19 34-19 34 0v15c0 3-3 4-5 3H20c-2 1-5 0-5-3z" fill="#6b3f2a"/>`,
      front: `<path d="M18 29c1-13 27-14 28-1-6-6-17-7-28 1z" fill="#6b3f2a"/>`,
      bodyExtra: `<circle cx="32" cy="52" r="1.6" fill="#fff"/>` }) },
    dad: { label: "아빠", svg: person({
      bg: "#dcecff", shirt: "#4a7dff",
      front: `<path d="M18 28c-1-13 28-15 28-1-2-5-8-7-14-7-7 0-11 3-14 8z" fill="#2f2622"/>`,
      bodyExtra: `<path d="M32 47l-3 4 3 9 3-9z" fill="#1f3b8f"/>` }) },
    grandma: { label: "할머니", svg: person({
      bg: "#efe6ff", shirt: "#9b7bff",
      back: `<circle cx="32" cy="13" r="6.5" fill="#c9c9d1"/>`,
      front: `<path d="M17 30c0-15 30-15 30 0-5-7-25-7-30 0z" fill="#d8d8e0"/>`,
      acc: glasses + `<path d="M24 52h16" stroke="#fff" stroke-width="2" stroke-dasharray="2 2"/>` }) },
    grandpa: { label: "할아버지", svg: person({
      bg: "#e3f5ea", shirt: "#3fae74",
      front: `<path d="M17.5 33c-1-7 1-11 4-12l1 11zM46.5 33c1-7-1-11-4-12l-1 11z" fill="#d8d8e0"/>`,
      face: eyes() + cheeks() + `<path d="M27 36.5c2-2 8-2 10 0-3 1.5-7 1.5-10 0z" fill="#d8d8e0"/>` + `<path d="M29.5 39.5q2.5 1.6 5 0" stroke="${INK}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
      acc: glasses }) },
    girl: { label: "딸", svg: person({
      bg: "#fff1d6", shirt: "#ffb03a",
      back: `<circle cx="14.5" cy="27" r="6" fill="#7a4a2b"/><circle cx="49.5" cy="27" r="6" fill="#7a4a2b"/>`,
      front: `<path d="M18 29c0-14 28-14 28 0-4-4-8-5-10-8-3 4-12 5-18 8z" fill="#7a4a2b"/>`,
      acc: `<path d="M40 17l6-4v8zM40 17l-5-4v8z" fill="#ff5c8a"/><circle cx="40" cy="17" r="1.8" fill="#ff5c8a"/>` }) },
    boy: { label: "아들", svg: person({
      bg: "#dff6f6", shirt: "#20b2aa",
      front: `<path d="M18 28l1-9 5 3 4-7 4 5 5-6 2 7 5-1v8c-6-5-19-6-26 0z" fill="#3b2a20"/>`,
      bodyExtra: `<path d="M20 55h24" stroke="#fff" stroke-width="2.4"/>` }) },
    baby: { label: "아기", svg: wrap("#fff6c7",
      body("#ffd84d", `<path d="M24 47q8 8 16 0" fill="#fff"/>`) + head() +
      `<path d="M32 16c-4-5 3-8 4-3" stroke="#7a4a2b" stroke-width="1.8" fill="none" stroke-linecap="round"/>` +
      eyes(32, 5) + cheeks(36.5) + `<circle cx="32" cy="38.5" r="2.2" fill="#ff8fa3"/>`) },
    me: { label: "나", svg: person({
      bg: "#e6ecff", shirt: "#6c63ff",
      back: `<path d="M16 32c0-20 32-20 32 0v6c0 2-2 3-4 2H20c-2 1-4 0-4-2z" fill="#4a3428"/>`,
      front: `<path d="M18 29c2-12 26-13 28 0-9-3-11-6-12-9-2 4-8 7-16 9z" fill="#4a3428"/>` }) },
    dog: { label: "강아지", svg: wrap("#fbead7",
      `<path d="M14 22c-3 8-1 18 5 18l2-17z" fill="#8a5a3b"/><path d="M50 22c3 8 1 18-5 18l-2-17z" fill="#8a5a3b"/>` +
      `<ellipse cx="32" cy="34" rx="15" ry="14" fill="#e0b48a"/><ellipse cx="32" cy="40" rx="8" ry="6" fill="#fff1e2"/>` +
      eyes(31, 6) + `<ellipse cx="32" cy="37" rx="2.8" ry="2" fill="${INK}"/><path d="M29.5 41q2.5 2 5 0" stroke="${INK}" stroke-width="1.4" fill="none"/>` +
      `<path d="M31 43q1 3 2 0z" fill="#ff7a8a"/>`) },
    cat: { label: "고양이", svg: wrap("#ffe9d2",
      `<path d="M18 26l-2-14 11 7zM46 26l2-14-11 7z" fill="#ff9f43"/><path d="M19.5 22l-1-7 5 4zM44.5 22l1-7-5 4z" fill="#ffd0d6"/>` +
      `<ellipse cx="32" cy="34" rx="15" ry="13.5" fill="#ffb366"/>` + eyes(32, 6) + cheeks(37) +
      `<path d="M30.5 36h3l-1.5 1.6z" fill="#ff6f91"/><path d="M32 37.6q-1.8 2.4-3.6 1M32 37.6q1.8 2.4 3.6 1" stroke="${INK}" stroke-width="1.2" fill="none"/>` +
      `<path d="M14 34h8M14 38l8-1.5M50 34h-8M50 38l-8-1.5" stroke="${INK}" stroke-width=".9"/>`) },
    rabbit: { label: "토끼", svg: wrap("#f2ecff",
      `<ellipse cx="25" cy="14" rx="4.5" ry="12" fill="#fff"/><ellipse cx="39" cy="14" rx="4.5" ry="12" fill="#fff"/><ellipse cx="25" cy="15" rx="2" ry="8" fill="#ffc6d3"/><ellipse cx="39" cy="15" rx="2" ry="8" fill="#ffc6d3"/>` +
      `<ellipse cx="32" cy="37" rx="15" ry="13" fill="#fff"/>` + eyes(35, 6) + cheeks(40) +
      `<path d="M30.6 39h2.8l-1.4 1.4z" fill="#ff6f91"/><path d="M32 40.4q-1.6 2-3 .8M32 40.4q1.6 2 3 .8" stroke="${INK}" stroke-width="1.1" fill="none"/>`) },
    bear: { label: "곰", svg: wrap("#f3e6da",
      `<circle cx="19" cy="21" r="6" fill="#9b6a43"/><circle cx="45" cy="21" r="6" fill="#9b6a43"/><circle cx="19" cy="21" r="3" fill="#e0b48a"/><circle cx="45" cy="21" r="3" fill="#e0b48a"/>` +
      `<circle cx="32" cy="34" r="15" fill="#9b6a43"/><ellipse cx="32" cy="39" rx="7" ry="5.5" fill="#e0b48a"/>` + eyes(31, 6) +
      `<ellipse cx="32" cy="37" rx="2.6" ry="1.8" fill="${INK}"/><path d="M29.8 40.6q2.2 1.8 4.4 0" stroke="${INK}" stroke-width="1.3" fill="none"/>`) },
    house: { label: "우리집", svg: wrap("#e4f4ff",
      `<path d="M44 14h5v12h-5z" fill="#c0563f"/>` +
      `<path d="M11 32L32 13l21 19z" fill="#ff6b57" stroke="#e04c3a" stroke-width="2" stroke-linejoin="round"/>` +
      `<rect x="16" y="30" width="32" height="24" rx="3" fill="#fff4dd"/>` +
      `<rect x="28" y="40" width="9" height="14" rx="4.5" fill="#b8794a"/><circle cx="34.6" cy="47.5" r=".9" fill="#ffd166"/>` +
      `<rect x="19.5" y="38" width="6" height="6" rx="1.5" fill="#7cc6ff"/><rect x="39.5" y="38" width="6" height="6" rx="1.5" fill="#7cc6ff"/>` +
      `<ellipse cx="28" cy="34.5" rx="1.3" ry="1.6" fill="${INK}"/><ellipse cx="37" cy="34.5" rx="1.3" ry="1.6" fill="${INK}"/>` +
      `<path d="M30.4 36.4q2.1 1.6 4.2 0" stroke="${INK}" stroke-width="1.2" fill="none" stroke-linecap="round"/>` +
      `<path d="M8 54h48" stroke="#7fd18b" stroke-width="3" stroke-linecap="round"/>`) },
    car: { label: "자동차", svg: wrap("#fff0e0",
      `<path d="M10 42c0-5 3-8 7-8l5-9c1-2 3-3 5-3h12c2 0 4 1 5 3l5 9c4 0 6 3 6 8v4c0 1.5-1 2.5-2.5 2.5h-40C11 48.5 10 47.5 10 46z" fill="#ff5d5d"/>` +
      `<path d="M24 26.5h7v8h-11zM34 26.5h6.5l4 8H34z" fill="#bfe6ff"/>` +
      `<circle cx="20" cy="49" r="5.5" fill="#33302e"/><circle cx="20" cy="49" r="2.2" fill="#ddd"/><circle cx="44" cy="49" r="5.5" fill="#33302e"/><circle cx="44" cy="49" r="2.2" fill="#ddd"/>` +
      `<circle cx="13.5" cy="40" r="2.2" fill="#ffe08a"/><circle cx="50.5" cy="40" r="2.2" fill="#ffe08a"/>` +
      `<ellipse cx="27" cy="40" rx="1.6" ry="2" fill="${INK}"/><ellipse cx="37" cy="40" rx="1.6" ry="2" fill="${INK}"/>` +
      `<path d="M29.6 42.6q2.4 2 4.8 0" stroke="${INK}" stroke-width="1.3" fill="none" stroke-linecap="round"/>` +
      `<circle cx="23.5" cy="42.5" r="1.8" fill="#ffb3b3"/><circle cx="40.5" cy="42.5" r="1.8" fill="#ffb3b3"/>`) },
  };
  // 예전에 고른 이모지 캐릭터는 같은 뜻의 그림으로 바꿔요
  const OLD = { "👩": "mom", "👨": "dad", "👵": "grandma", "👴": "grandpa", "👧": "girl", "👦": "boy", "👶": "baby",
    "🧑": "me", "🙂": "me", "😎": "me", "🐶": "dog", "🐾": "dog", "🐱": "cat", "🐰": "rabbit", "🐻": "bear",
    "🏠": "house", "🏡": "house", "🚗": "car", "🚙": "car", "🛵": "car" };
  window.AVATARS = A;
  window.avatarId = (v) => (A[v] ? v : OLD[v] || null);
})();
