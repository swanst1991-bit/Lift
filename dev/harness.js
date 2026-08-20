/* Lift — test harness.
   There is no `node` on this machine, so tests run under macOS `jsc`
   (/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc).

   The app is one <script> inside index.html that expects a DOM and calls
   go("home") on load. This file provides just enough of a DOM for that call to
   complete without throwing, evaluates the app source, and hands back the app's
   internal functions so tests can exercise them directly.

   Why the appended export line: the app declares everything with const/let, and
   const bindings inside an eval() do not leak to the caller. Appending an
   assignment to globalThis *inside* the evaluated source captures them from
   within that scope, which is the only way to reach them. */

/* ---------------- timers (jsc has none) ---------------- */
const __timers = [];
globalThis.setTimeout  = (fn, ms) => { __timers.push({fn, ms}); return __timers.length; };
globalThis.clearTimeout = () => {};
globalThis.setInterval = (fn, ms) => { __timers.push({fn, ms}); return __timers.length; };
globalThis.clearInterval = () => {};
globalThis.requestAnimationFrame = fn => { __timers.push({fn, ms: 16}); return __timers.length; };
/** Run every timer callback queued so far — lets tests flush deferred work. */
globalThis.__flushTimers = () => { const q = __timers.splice(0); q.forEach(t => { try { t.fn(); } catch(e){} }); };

/* ---------------- DOM ---------------- */
function makeEl(tag){
  const el = {
    tagName: (tag || "div").toUpperCase(),
    dataset: {}, style: {}, children: [], attrs: {},
    _html: "", textContent: "", value: "",
    scrollTop: 0, offsetWidth: 402, offsetHeight: 172,
    clientWidth: 402, clientHeight: 172,
    classList: {
      _s: new Set(),
      add(...c){ c.forEach(x => this._s.add(x)); },
      remove(...c){ c.forEach(x => this._s.delete(x)); },
      contains(c){ return this._s.has(c); },
      toggle(c, on){ on === undefined ? (this._s.has(c) ? this._s.delete(c) : this._s.add(c)) : (on ? this._s.add(c) : this._s.delete(c)); },
    },
    addEventListener(){}, removeEventListener(){},
    appendChild(c){ this.children.push(c); return c; },
    removeChild(c){ this.children = this.children.filter(x => x !== c); return c; },
    setAttribute(k, v){ this.attrs[k] = v; },
    getAttribute(k){ return this.attrs[k]; },
    removeAttribute(k){ delete this.attrs[k]; },
    getBoundingClientRect(){ return {left:0, top:0, width:402, height:172, right:402, bottom:172}; },
    closest(){ return null; },
    querySelector(){ return makeEl("div"); },
    querySelectorAll(){ return []; },
    focus(){}, blur(){}, click(){}, remove(){},
    insertAdjacentHTML(){},
  };
  // innerHTML is captured, not parsed — tests assert on the markup string.
  Object.defineProperty(el, "innerHTML", {
    get(){ return this._html; },
    set(v){ this._html = String(v); },
  });
  return el;
}

/** Elements are cached per selector so `$("#x")` twice returns the same node. */
const __els = new Map();
function elFor(sel){
  if (!__els.has(sel)) __els.set(sel, makeEl(String(sel).startsWith("#") ? "div" : "div"));
  return __els.get(sel);
}
/** Reach a stub element to set an input value — lets tests drive form reads. */
globalThis.__el = elFor;
globalThis.__setInput = (sel, v) => { elFor(sel).value = String(v); };
globalThis.__clearInputs = () => { __els.forEach(el => { el.value = ""; }); };

/* A controllable clock. Only Date.now() is overridden: the app reads wall-clock
   through it for interval timing, while `new Date()` still gives the real date
   so the day-based tests stay honest. */
const __realNow = Date.now;
globalThis.__setNow = ms => { Date.now = () => ms; };
globalThis.__realNow = () => { Date.now = __realNow; };

globalThis.document = {
  documentElement: makeEl("html"),
  body: makeEl("body"),
  head: makeEl("head"),
  createElement: makeEl,
  createElementNS: (ns, tag) => makeEl(tag),
  createTextNode: t => ({textContent: t}),
  querySelector: sel => elFor(sel),
  // Views and nav buttons are the only lists the app iterates; empty is safe
  // because every branch guards on length or uses forEach.
  querySelectorAll: () => [],
  addEventListener(){}, removeEventListener(){},
  getElementById: id => elFor("#" + id),
};

globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.matchMedia = () => ({matches: false, addEventListener(){}, addListener(){}});
globalThis.location = {protocol: "file:", href: "file:///index.html", origin: "null"};
globalThis.navigator = {standalone: false, userAgent: "jsc-test"};
globalThis.confirm = () => globalThis.__confirmAnswer;
globalThis.__confirmAnswer = true;
globalThis.alert = () => {};
globalThis.prompt = () => null;
globalThis.devicePixelRatio = 3;
/* Settings sizes the saved blob to show a KB figure. */
globalThis.Blob = class Blob {
  constructor(parts){ this.size = (parts || []).reduce((a, p) => a + String(p).length, 0); }
};
globalThis.URL = {createObjectURL: () => "blob:stub", revokeObjectURL(){}};

/* ---------------- localStorage ---------------- */
globalThis.__store = new Map();
globalThis.localStorage = {
  getItem: k => (globalThis.__store.has(k) ? globalThis.__store.get(k) : null),
  setItem: (k, v) => globalThis.__store.set(k, String(v)),
  removeItem: k => globalThis.__store.delete(k),
  clear: () => globalThis.__store.clear(),
};

/* ---------------- load the app ---------------- */
/** Everything the tests need to reach inside the app's const scope. */
const EXPORTS = [
  "KEY", "uid", "esc",
  "iso", "dObj", "addDays", "mondayOf", "fmtDate", "relDate", "relPhrase",
  "num", "kg", "e1rm", "mmss",
  "seed", "migrate",
  "exById", "exName", "rtById",
  "doneSessions", "lastPerformance", "bestE1RM", "e1rmSeries",
  "tonnage", "weekStats", "weightPts", "weightDelta",
  "nextRoutine",
  // challenge engine (v2) — entries that don't exist yet are simply skipped
  "CHALLENGES", "BASELINES", "BIG",
  "pct", "roundTo", "repMax", "brzycki",
  "exByName", "e1rmOf", "incOf", "pickBig",
  "tmMax", "tmInc", "clampSpeed", "clampIncline",
  "paceOf", "speedFromPace", "paceFromSpeed",
  "recentPace", "bestPace", "easyPace", "hardPace",
  "baselineFor", "setBaseline",
  "challengeById", "doneChallenges", "lastDoneAt", "challengePB",
  "eligible", "drawChallenge", "setRnd",
  "startChallenge", "finishChallenge", "commitChallenge", "abandonChallenge",
  "drawInto", "stepLeft", "nowMs", "readSetInputs", "readMmss",
  "renderPlay", "challengeCard",
];

/**
 * Evaluate index.html's script with the stubbed DOM in place.
 * @param {string} htmlPath path to index.html
 * @returns {object} the app's internal functions and a live handle on state
 */
globalThis.loadApp = function loadApp(htmlPath){
  const html = readFile(htmlPath);
  const m = html.match(/<script>\n?([\s\S]*?)<\/script>/);
  if (!m) throw new Error("no <script> block found in " + htmlPath);

  // Grab whichever exports actually exist, so the same harness works before and
  // after the challenge engine lands.
  const picks = EXPORTS.map(n =>
    `  try { __x.${n} = ${n}; } catch(e){}`).join("\n");

  const src = m[1] + `
;(function(){
  const __x = {};
${picks}
  __x.__state = () => S;
  __x.__setState = v => { S = v; };
  __x.__save = () => save();
  __x.__go = v => go(v);
  __x.__render = () => render();
  globalThis.__app = __x;
})();
`;
  // Indirect eval keeps the app at global scope, matching a real page load.
  (0, eval)(src);
  return globalThis.__app;
};

/* ---------------- assertions ---------------- */
let pass = 0, fail = 0, group = "";
const fails = [];

globalThis.describe = name => { group = name; print("\n  " + name); };

globalThis.ok = function ok(cond, msg){
  if (cond){ pass++; }
  else { fail++; fails.push(group + " — " + msg); print("    FAIL  " + msg); }
};

globalThis.eq = function eq(actual, expected, msg){
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a === b){ pass++; }
  else {
    fail++;
    fails.push(group + " — " + msg);
    print("    FAIL  " + msg + "\n          expected " + b + "\n          got      " + a);
  }
};

globalThis.near = function near(actual, expected, tol, msg){
  if (Math.abs(actual - expected) <= tol){ pass++; }
  else {
    fail++;
    fails.push(group + " — " + msg);
    print("    FAIL  " + msg + " — expected ~" + expected + " (±" + tol + "), got " + actual);
  }
};

globalThis.throws = function throws(fn, msg){
  try { fn(); fail++; fails.push(group + " — " + msg); print("    FAIL  " + msg + " — expected a throw"); }
  catch(e){ pass++; }
};

globalThis.summary = function summary(){
  print("\n" + "─".repeat(52));
  if (fail === 0){ print("  " + pass + " assertions passed."); return 0; }
  print("  " + pass + " passed, " + fail + " FAILED");
  fails.forEach(f => print("    · " + f));
  return 1;
};
