/* Lift — test suite. Run via dev/run-tests.sh (macOS jsc, no node on this box).
   Tests exercise the app's real functions, pulled out of index.html by harness.js. */

const APP_PATH = globalThis.__APP_PATH || "index.html";
const A = loadApp(APP_PATH);

/* A deterministic state fixture. Dates are relative to today so the
   week-window tests hold whenever they are run. */
const TODAY = A.iso();
const MON   = A.mondayOf(TODAY);

function fixture(){
  const s = A.seed();
  const squat = s.ex.find(e => e.name === "Back Squat").id;
  const bench = s.ex.find(e => e.name === "Barbell Bench Press").id;
  s.sessions = [
    {id: "s1", rid: s.routines[0].id, name: "Lower A", date: A.addDays(MON, 0),
     entries: [{ex: squat, sets: [{w: 100, r: 5}, {w: 100, r: 5}, {w: 105, r: 3}]}]},
    {id: "s2", rid: s.routines[1].id, name: "Upper A", date: A.addDays(MON, 2),
     entries: [{ex: bench, sets: [{w: 80, r: 8}, {w: 80, r: 6}]}]},
    {id: "s0", rid: s.routines[0].id, name: "Lower A", date: A.addDays(MON, -9),
     entries: [{ex: squat, sets: [{w: 90, r: 5}]}]},
  ];
  s.runs = [
    {id: "r1", date: A.addDays(MON, 1), km: 5,   sec: 1500, hr: 150},
    {id: "r2", date: A.addDays(MON, 3), km: 2.5, sec: 600,  hr: 160},
    {id: "r0", date: A.addDays(MON, -4), km: 10, sec: 3300, hr: 0},
  ];
  s.weights = [
    {date: A.addDays(MON, -6), kg: 82},
    {date: A.addDays(MON, -3), kg: 81.6},
    {date: A.addDays(MON, 1),  kg: 81},
    {date: A.addDays(MON, 4),  kg: 80.8},
  ];
  return {s, squat, bench};
}

const F = fixture();
A.__setState(F.s);

/* ============================================================
   Dates — all local-time; the app must never UTC-shift a day
   ============================================================ */
describe("dates");

eq(A.iso(new Date(2026, 0, 5)), "2026-01-05", "iso pads month and day");
eq(A.iso(new Date(2026, 11, 31)), "2026-12-31", "iso at year end");
eq(A.addDays("2026-01-31", 1), "2026-02-01", "addDays crosses a month");
eq(A.addDays("2026-12-31", 1), "2027-01-01", "addDays crosses a year");
eq(A.addDays("2026-03-01", -1), "2026-02-28", "addDays back over Feb (non-leap)");
eq(A.addDays("2024-03-01", -1), "2024-02-29", "addDays back over Feb (leap)");
// BST 2026 starts Sun 29 March, ends Sun 25 October. Millisecond arithmetic
// slips a day at both; calendar-field arithmetic must not.
eq(A.addDays("2026-03-28", 2), "2026-03-30", "addDays spans the BST spring change");
eq(A.addDays("2026-10-24", 2), "2026-10-26", "addDays spans the BST autumn change");
eq(A.addDays("2026-03-29", -1), "2026-03-28", "addDays back over the spring change");
eq(A.addDays("2026-08-20", 0), "2026-08-20", "addDays zero is identity");

eq(A.mondayOf("2026-08-20"), "2026-08-17", "mondayOf a Thursday");
eq(A.mondayOf("2026-08-17"), "2026-08-17", "mondayOf a Monday is itself");
eq(A.mondayOf("2026-08-23"), "2026-08-17", "mondayOf a Sunday looks back, not forward");
eq(A.mondayOf("2026-03-30"), "2026-03-30", "mondayOf the Monday after the clock change");

eq(A.relDate(TODAY), "Today", "relDate today");
eq(A.relDate(A.addDays(TODAY, -1)), "Yesterday", "relDate yesterday");
eq(A.relDate(A.addDays(TODAY, -3)), "3 days ago", "relDate within the week");
ok(!/ago|Today|Yesterday/.test(A.relDate(A.addDays(TODAY, -30))), "relDate falls back to a date");

// relPhrase reads inside a sentence, so only the relative wordings lowercase.
eq(A.relPhrase(TODAY), "today", "relPhrase lowercases today");
eq(A.relPhrase(A.addDays(TODAY, -1)), "yesterday", "relPhrase lowercases yesterday");
eq(A.relPhrase(A.addDays(TODAY, -4)), "4 days ago", "relPhrase keeps the days-ago form");
eq(A.relPhrase("2026-08-13"), A.fmtDate("2026-08-13"), "relPhrase leaves a real date capitalised");
ok(/[A-Z]/.test(A.relPhrase(A.addDays(TODAY, -40))), "an older date keeps its capitals");

/* ============================================================
   Numbers and formatting
   ============================================================ */
describe("numbers");

eq(A.num(2.5), "2.5", "num keeps one decimal");
eq(A.num(2.499), "2.5", "num rounds to 2dp");
eq(A.num(100), "100", "num drops a trailing .0");
eq(A.num(0), "0", "num of zero");
eq(A.kg(97.5), "97.5 kg", "kg suffixes");

eq(A.mmss(90), "1:30", "mmss under an hour");
eq(A.mmss(59), "0:59", "mmss pads the minute");
eq(A.mmss(600), "10:00", "mmss round minutes");
eq(A.mmss(3661), "1:01:01", "mmss adds hours and pads");
eq(A.mmss(3600), "1:00:00", "mmss exactly an hour");
eq(A.mmss(0), "0:00", "mmss zero");
eq(A.mmss(299.6), "5:00", "mmss rounds to the nearest second");

/* ============================================================
   Estimated 1RM — Epley
   ============================================================ */
describe("e1rm");

eq(A.e1rm(100, 1), 100, "a single is its own 1RM, no inflation");
near(A.e1rm(100, 5), 116.67, 0.01, "Epley at 5 reps");
near(A.e1rm(100, 10), 133.33, 0.01, "Epley at 10 reps");
eq(A.e1rm(100, 0), 0, "zero reps is not a max");
eq(A.e1rm(100, -3), 0, "negative reps guarded");
eq(A.e1rm(0, 5), 0, "no weight, no max");
ok(A.e1rm(100, 3) < A.e1rm(100, 5), "more reps at the same weight estimates higher");
ok(A.e1rm(105, 3) > A.e1rm(100, 3), "more weight at the same reps estimates higher");

/* ============================================================
   Seed integrity — the shipped programme
   ============================================================ */
describe("seed");

const sd = A.seed();
eq(sd.routines.length, 4, "four routines: Upper/Lower A and B");
eq(sd.ex.length, 22, "22 seeded exercises");
eq(sd.order.length, 4, "rotation order covers every routine");
ok(sd.order.every(id => sd.routines.some(r => r.id === id)), "rotation order points at real routines");
ok(sd.routines.every(r => r.items.length > 0), "no empty routine");
ok(sd.routines.every(r => r.items.every(it => sd.ex.some(e => e.id === it.ex))),
   "every routine item points at a real exercise");
ok(sd.ex.every(e => e.inc > 0), "every exercise has a usable weight increment");
ok(sd.ex.every(e => e.group === "upper" || e.group === "lower"), "groups are upper or lower");
eq(new Set(sd.ex.map(e => e.id)).size, 22, "exercise ids are unique");
eq(sd.sessions.length, 0, "a fresh install has no history");
eq(sd.runs.length, 0, "a fresh install has no runs");
eq(sd.draft, null, "a fresh install has no session in progress");

/* ============================================================
   Derived stats
   ============================================================ */
describe("derived stats");

eq(A.tonnage(F.s.sessions[0]), 100*5 + 100*5 + 105*3, "tonnage sums weight times reps");
eq(A.tonnage({entries: []}), 0, "tonnage of nothing is zero");
eq(A.tonnage({entries: [{sets: []}]}), 0, "an exercise with no sets adds nothing");

const wk = A.weekStats(MON);
eq(wk.sessions, 2, "week stats count only this week's sessions");
eq(wk.runs, 2, "week stats count only this week's runs");
eq(wk.km, 7.5, "week distance sums this week only");
eq(wk.sec, 2100, "week time sums this week only");
// 150bpm over 1500s and 160bpm over 600s → time-weighted, not a flat mean (155)
near(wk.hr, (150*1500 + 160*600) / 2100, 0.001, "average HR is time-weighted");
ok(Math.abs(wk.hr - 155) > 0.5, "average HR is not the naive mean of the two runs");

const emptyWk = A.weekStats(A.addDays(MON, 70));
eq(emptyWk.sessions, 0, "a week with nothing in it reports zero sessions");
eq(emptyWk.hr, 0, "no runs means no HR, not a divide by zero");

eq(A.doneSessions().map(s => s.id), ["s2", "s1", "s0"], "sessions come back newest first");

// 100×5 estimates 116.7 while the heavier 105×3 estimates 115.5, so this
// catches any implementation that just sorts on weight.
near(A.bestE1RM(F.squat), A.e1rm(100, 5), 0.001, "best e1RM picks the strongest set, not the heaviest");
ok(A.bestE1RM(F.squat) > A.e1rm(105, 3), "the heaviest set is not automatically the best e1RM");
eq(A.bestE1RM("nope"), 0, "unknown exercise has no e1RM");
near(A.bestE1RM(F.squat, "s1"), A.e1rm(90, 5), 0.001, "skipping a session excludes its sets");

const lp = A.lastPerformance(F.squat);
eq(lp.date, A.addDays(MON, 0), "last performance is the most recent session with sets");
eq(lp.sets.length, 3, "last performance returns that session's sets");
eq(A.lastPerformance(F.squat, "s1").date, A.addDays(MON, -9), "last performance can skip a session");
eq(A.lastPerformance("nope"), null, "no history means no last performance");

const ser = A.e1rmSeries(F.squat);
eq(ser.length, 2, "one e1RM point per session, not per set");
ok(ser[0].t < ser[1].t, "e1RM series runs oldest to newest");
near(ser[1].y, A.e1rm(100, 5), 0.001, "each point is that session's best set by estimate");

const wp = A.weightPts();
eq(wp.length, 4, "every weigh-in becomes a point");
ok(wp[0].t < wp[3].t, "bodyweight points run oldest to newest");
ok(A.weightDelta(MON) < 0, "bodyweight is trending down in the fixture");
A.__setState(Object.assign({}, F.s, {weights: [{date: TODAY, kg: 80}]}));
eq(A.weightDelta(MON), null, "a single weigh-in gives no weekly change");
A.__setState(F.s);

/* ============================================================
   Routine rotation
   ============================================================ */
describe("rotation");

// Newest completed session is s2 (Upper A, index 1) → next is index 2.
eq(A.nextRoutine().id, F.s.order[2], "rotation advances from the last completed session");
A.__setState(Object.assign({}, F.s, {sessions: []}));
eq(A.nextRoutine().id, F.s.order[0], "with no history, rotation starts at the top");
A.__setState(F.s);

/* ============================================================
   Persistence and migration
   ============================================================ */
describe("persistence");

eq(A.KEY, "lift.v1", "the storage key is stable — changing it orphans real history");

ok(typeof A.esc === "function", "there is an HTML escaper");
eq(A.esc('<b>"x"&</b>'), "&lt;b&gt;&quot;x&quot;&amp;&lt;/b&gt;", "escaper covers < > \" &");
eq(A.esc("Conor's row"), "Conor's row", "apostrophes survive — attributes use double quotes");

const ids = new Set(Array.from({length: 500}, () => A.uid()));
eq(ids.size, 500, "500 ids in a row, no collision");

/* ---- migration: real history must survive a schema bump ---- */
if (A.migrate){
  describe("migration");

  const legacy = A.seed();
  legacy.sessions = [{id: "keep", rid: null, name: "Old", date: "2026-08-01",
                      entries: [{ex: legacy.ex[0].id, sets: [{w: 60, r: 10}]}]}];
  legacy.runs = [{id: "kr", date: "2026-08-02", km: 5, sec: 1500, hr: 0}];
  legacy.weights = [{date: "2026-08-01", kg: 84}];
  delete legacy.challenges;      // as a v1 blob would be
  delete legacy.bench;

  const up = A.migrate(JSON.parse(JSON.stringify(legacy)));
  eq(up.sessions.length, 1, "migration keeps sessions");
  eq(up.sessions[0].id, "keep", "migration keeps the same session, not a reseed");
  eq(up.runs.length, 1, "migration keeps runs");
  eq(up.weights[0].kg, 84, "migration keeps weigh-ins");
  eq(up.ex.length, legacy.ex.length, "migration does not duplicate exercises");
  ok(Array.isArray(up.challenges), "migration adds the challenge log");
  ok(up.bench && typeof up.bench === "object", "migration adds the baseline store");
  ok(up.v >= 2, "migration stamps the new schema version");

  // Idempotence: running it twice must not double anything up.
  const twice = A.migrate(A.migrate(JSON.parse(JSON.stringify(legacy))));
  eq(twice.sessions.length, 1, "migration is idempotent for sessions");
  eq(twice.ex.length, legacy.ex.length, "migration is idempotent for exercises");

  // Garbage in must not wipe someone's history silently.
  ok(A.migrate(null) && A.migrate(null).ex.length > 0, "migrating null yields a usable seed");
  ok(A.migrate({}).ex.length > 0, "migrating an empty object yields a usable seed");
  const partial = A.migrate({v: 1, ex: legacy.ex, sessions: legacy.sessions});
  eq(partial.sessions.length, 1, "a partial blob keeps what it had");
  ok(Array.isArray(partial.runs), "a partial blob gains the missing arrays");
  ok(Array.isArray(partial.routines), "a partial blob gains routines");
}

/* ============================================================
   Challenge engine
   ============================================================ */
if (A.CHALLENGES){

describe("challenge maths");

eq(A.roundTo(100.9, 2.5), 100, "rounds down to the nearest plate step");
eq(A.roundTo(101.9, 2.5), 102.5, "rounds up to the nearest plate step");
eq(A.roundTo(101.3, 2.5), 102.5, "rounds to nearest, not toward zero");
eq(A.roundTo(103, 5), 105, "rounds to a 5 kg step");
eq(A.roundTo(102, 0), 102, "a zero step falls back to whole numbers");
eq(A.pct(200, 0.8), 160, "percentage of a max");

near(A.repMax(120, 5), 120 / (1 + 5/30), 0.001, "inverse Epley gives a 5RM");
eq(A.repMax(120, 1), 120, "the 1RM of a 1RM is itself");
eq(A.repMax(0, 5), 0, "no max, no prescription");
eq(A.repMax(120, 0), 0, "zero reps has no weight");
ok(A.repMax(120, 5) > A.repMax(120, 10), "a 5RM is heavier than a 10RM");
// repMax must invert e1rm exactly, or every prescribed weight is off.
near(A.e1rm(A.repMax(150, 8), 8), 150, 0.001, "repMax is the exact inverse of e1rm");
[1,2,3,5,8,10,12,15].forEach(r =>
  near(A.e1rm(A.repMax(150, r), r), 150, 0.001, "repMax inverts e1rm at " + r + " reps"));

near(A.brzycki(100, 5), 100 * 36 / 32, 0.001, "Brzycki at 5 reps");
eq(A.brzycki(100, 0), 0, "Brzycki guards zero reps");
eq(A.brzycki(100, 37), 0, "Brzycki guards its divide-by-zero at 37 reps");
eq(A.brzycki(100, 40), 0, "Brzycki refuses to go negative past 37 reps");
ok(A.brzycki(100, 5) < A.e1rm(100, 5), "Brzycki reads lower than Epley at 5 reps");

describe("pace and speed");

eq(A.paceOf(5, 1500), 300, "pace is seconds per km");
eq(A.paceOf(0, 1500), 0, "no distance, no pace");
eq(A.speedFromPace(300), 12, "5:00 /km is 12 km/h");
eq(A.speedFromPace(360), 10, "6:00 /km is 10 km/h");
eq(A.speedFromPace(0), 0, "no pace, no speed");
near(A.paceFromSpeed(12), 300, 0.001, "12 km/h is 5:00 /km");
near(A.paceFromSpeed(A.speedFromPace(330)), 330, 0.6, "pace and speed round-trip");

// The fixture has 7.5 km in 2100 s this week plus 10 km in 3300 s last week.
near(A.recentPace(), (1500 + 600 + 3300) / 17.5, 0.001, "recent pace is distance-weighted");
ok(A.recentPace() !== (300 + 240 + 330) / 3, "recent pace is not a flat mean of paces");
eq(A.bestPace(), 240, "best pace is the fastest run over 1 km");
ok(A.hardPace() < A.easyPace(), "hard pace is quicker than easy pace");

A.__setState(Object.assign({}, F.s, {runs: []}));
ok(A.recentPace() === null, "no runs means no measured pace");
eq(A.easyPace(), 390, "easy pace falls back to 6:30 /km before any run is logged");
ok(A.hardPace() < A.easyPace(), "the fallback hard pace is still quicker than easy");
A.__setState(F.s);

describe("treadmill limits");

eq(A.tmMax(), 16, "default treadmill top speed");
eq(A.tmInc(), 10, "default max incline is the NordicTrack T 6.5 S ceiling");
eq(A.clampSpeed(30), 16, "a speed above the machine's limit is clamped");
eq(A.clampSpeed(0.2), 1, "a speed below walking is clamped up");
eq(A.clampSpeed(12.34), 12.3, "speed is rounded to one decimal, as the console shows it");
eq(A.clampIncline(30), 10, "incline is clamped to the machine's limit");
eq(A.clampIncline(12), 10, "a 12% prescription is clamped — this machine stops at 10");
eq(A.clampIncline(-3), 0, "incline never goes negative");

// A treadmill with a lower ceiling must change what gets prescribed.
A.__setState(Object.assign({}, F.s, {ui: {tmMax: 12, tmInc: 8}}));
eq(A.tmMax(), 12, "a configured top speed is honoured");
eq(A.clampSpeed(15), 12, "prescriptions respect a slower machine");
eq(A.clampIncline(12), 8, "prescriptions respect a lower incline range");
A.__setState(F.s);

describe("challenge library");

const CH = A.CHALLENGES;
ok(CH.length >= 12, "at least twelve challenges shipped");
eq(new Set(CH.map(c => c.cid)).size, CH.length, "challenge ids are unique — results are keyed on them");
ok(CH.every(c => c.name && c.blurb), "every challenge has a name and a blurb");
ok(CH.every(c => c.mins > 0), "every challenge declares a time cost");
ok(CH.every(c => ["lift","run","body","fun"].includes(c.kind)), "every kind is known");
ok(CH.every(c => typeof c.prescribe === "function"), "every challenge can prescribe");
ok(CH.every(c => typeof c.score === "function"), "every challenge can score a result");
ok(CH.every(c => typeof c.fmt === "function"), "every challenge has a one-line format");
ok(CH.every(c => [null, undefined, "session", "run"].includes(c.logAs)), "logAs targets a real log");
ok(CH.filter(c => c.kind === "lift").length >= 4, "at least four lifting challenges");
ok(CH.filter(c => c.kind === "run").length >= 4, "at least four treadmill challenges");
ok(CH.filter(c => c.kind === "body").length >= 4, "at least four bodyweight challenges");

describe("prescriptions");

A.setRnd(() => 0.5);   // deterministic draws for the rest of the suite
A.setBaseline("pushup", 30);
A.setBaseline("plank", 90);

const squatMax = A.e1rmOf("Back Squat");
ok(squatMax > 0, "the fixture gives Back Squat an estimated max");
eq(A.e1rmOf("Nonexistent Lift"), 0, "an unknown lift has no max");
eq(A.e1rmOf("back squat"), squatMax, "lift lookup is case-insensitive");
eq(A.incOf("Back Squat"), 2.5, "plate step comes from the exercise");
eq(A.incOf("Nonexistent Lift"), 2.5, "unknown lifts assume 2.5 kg");

// Every challenge must prescribe something usable from the fixture's history.
CH.forEach(c => {
  const t = c.prescribe();
  ok(t && ["sets","timer","single"].includes(t.mode), c.cid + " prescribes a known runner mode");
  ok(typeof c.fmt(t) === "string" && c.fmt(t).length > 0, c.cid + " formats its prescription");
  ok(!t.note || typeof t.note === "string", c.cid + " note is text");
  if (t.mode === "sets"){
    ok(t.sets > 0, c.cid + " asks for at least one set");
    ok(t.w > 0, c.cid + " prescribes a real weight");
    ok(t.exName && A.exByName(t.exName), c.cid + " names a lift that exists");
  }
  if (t.mode === "timer"){
    ok(Array.isArray(t.steps) && t.steps.length > 0, c.cid + " has timer steps");
    ok(t.steps.every(s => s.sec > 0), c.cid + " every step has a duration");
    ok(t.steps.every(s => s.label), c.cid + " every step is labelled");
    if (c.kind === "run"){
      ok(t.steps.every(s => s.speed > 0 && s.speed <= A.tmMax()), c.cid + " speeds are within the machine");
      ok(t.steps.every(s => s.incline >= 0 && s.incline <= A.tmInc()), c.cid + " inclines are within the machine");
    }
  }
  if (t.mode === "single"){
    ok(t.field && t.field.key, c.cid + " single-result challenge names its field");
  }
});

// The specific calibrations, which are the bit most likely to be wrong.
const t5 = A.challengeById("5x5").prescribe();
const max5 = A.e1rmOf(t5.exName);
ok(t5.w < A.repMax(max5, 5), "5×5 is lighter than a true 5RM — it is five sets, not one");
ok(t5.w / max5 > 0.70 && t5.w / max5 < 0.85, "5×5 lands between 70% and 85% of max");
eq(t5.w % A.incOf(t5.exName), 0, "5×5 weight is loadable on the bar");

const tAm = A.challengeById("amrap-75").prescribe();
near(tAm.w / A.e1rmOf(tAm.exName), 0.75, 0.03, "the all-out set is at about 75%");
ok(tAm.reps >= 8 && tAm.reps <= 13, "75% should be worth roughly ten reps");

const tGvt = A.challengeById("gvt-10x10").prescribe();
ok(tGvt.w / A.e1rmOf(tGvt.exName) < 0.62, "ten by ten is genuinely light");
eq(tGvt.sets * tGvt.reps, 100, "ten by ten is a hundred reps");

const tLad = A.challengeById("ladder-12345").prescribe();
eq(tLad.ladder, [1,2,3,4,5], "the ladder climbs one to five");
ok(tLad.w > t5.w, "the ladder is heavier than the 5×5 weight");

const tEmom = A.challengeById("pushup-emom").prescribe();
eq(tEmom.steps.length, 10, "ten minutes, ten steps");
ok(tEmom.reps < 30, "per-minute reps are well short of a max set");
ok(tEmom.reps >= 3, "per-minute reps never round down to nothing");

const tPlank = A.challengeById("plank-total").prescribe();
eq(tPlank.guess, 270, "plank target is three times the 90 s baseline");

// A weak baseline must not produce a zero-rep prescription.
A.setBaseline("pushup", 4);
ok(A.challengeById("pushup-emom").prescribe().reps >= 3, "a low baseline still gives a usable target");
A.setBaseline("pushup", 30);

describe("baselines");

eq(A.baselineFor("pushup"), 30, "a stored baseline reads back");
eq(A.baselineFor("nothing"), 0, "an unset baseline is zero, not undefined");
eq(A.setBaseline("pushup", 0), null, "a zero baseline is rejected");
eq(A.baselineFor("pushup"), 30, "a rejected baseline leaves the old one alone");
ok(A.BASELINES.pushup && A.BASELINES.plank, "push-up and plank baseline tests exist");
ok(Object.keys(A.BASELINES).every(k => A.BASELINES[k].field && A.BASELINES[k].ask),
   "every baseline test has a prompt and a field");
// Challenges that name a baseline must name one that exists.
ok(CH.filter(c => c.baseline).every(c => A.BASELINES[c.baseline]),
   "every referenced baseline is defined");
ok(CH.filter(c => c.needsBaseline).every(c => A.BASELINES[c.needsBaseline]),
   "every required baseline is defined");
// A challenge that requires a benchmark must still be reachable, or there is
// no route to ever take the test.
ok(CH.filter(c => c.needsBaseline).every(c => !c.needs || c.needs()),
   "a challenge requiring a benchmark is still offered — the prompt is the way in");

describe("the draw");

ok(A.eligible({}).length >= 12, "with a full fixture, everything is eligible");
eq(A.eligible({kind: "run"}).every(c => c.kind === "run"), true, "the draw can be filtered to running");
ok(A.eligible({maxMins: 15}).every(c => c.mins <= 15, "a time budget is respected"));
ok(A.eligible({maxMins: 15}).length > 0, "there is something to do in fifteen minutes");
ok(A.eligible({maxMins: 15}).length < CH.length, "a time budget actually excludes things");

// needs() must gate honestly: with no lifting history, no lifting challenge.
A.__setState(Object.assign({}, F.s, {sessions: [], challenges: [], bench: {}}));
eq(A.eligible({kind: "lift"}).length, 0, "no lifting history means no lifting challenge");
ok(A.eligible({kind: "run"}).length > 0, "running challenges need no history");
ok(A.drawChallenge({}) !== null, "a brand-new install can still draw something");
ok(A.drawChallenge({}).kind !== "lift", "a brand-new install is not offered a barbell challenge");
A.__setState(F.s);

// 200 draws must cover the pool and never return something ineligible.
const seen = new Set();
let i = 0;
A.setRnd(() => { i = (i * 9301 + 49297) % 233280; return i / 233280; });
for (let n = 0; n < 200; n++){ const c = A.drawChallenge({}); if (c) seen.add(c.cid); }
ok(seen.size >= 10, "200 draws reach most of the library (" + seen.size + " distinct)");
A.setRnd(() => 0.5);

eq(A.drawChallenge({kind: "body"}).kind, "body", "a filtered draw stays in its kind");
ok(A.drawChallenge({maxMins: 12}).mins <= 12, "a filtered draw respects the time budget");
eq(A.drawChallenge({kind: "nonsense"}), null, "an impossible filter draws nothing rather than throwing");

// Re-roll must not hand back the same card when there is an alternative.
const first = A.drawChallenge({kind: "run"});
const second = A.drawChallenge({kind: "run", avoid: first.cid});
ok(second && second.cid !== first.cid, "a re-roll avoids the card just shown");

// Something done today should be skipped while there are alternatives.
A.__setState(Object.assign({}, F.s, {
  challenges: [{id: "c1", cid: "1k-tt", date: TODAY, score: 260}]
}));
const fresh = Array.from({length: 40}, () => A.drawChallenge({kind: "run"}).cid);
ok(!fresh.includes("1k-tt"), "a challenge done today drops out of the draw");
// …unless it is the only thing left, in which case the rule relaxes.
ok(A.drawChallenge({kind: "run", maxMins: 15}) !== null,
   "the 48-hour rule relaxes rather than leaving nothing to do");
A.__setState(F.s);

describe("challenge records");

A.__setState(Object.assign({}, F.s, {challenges: [
  {id: "a", cid: "1k-tt",      date: A.addDays(TODAY, -20), score: 265},
  {id: "b", cid: "1k-tt",      date: A.addDays(TODAY, -6),  score: 258},
  {id: "c", cid: "1k-tt",      date: A.addDays(TODAY, -2),  score: 272},
  {id: "d", cid: "deadhang",   date: A.addDays(TODAY, -8),  score: 52},
  {id: "e", cid: "deadhang",   date: A.addDays(TODAY, -1),  score: 61},
]}));
eq(A.challengePB("1k-tt").id, "b", "for a timed challenge the best score is the lowest");
eq(A.challengePB("deadhang").id, "e", "for a held challenge the best score is the highest");
eq(A.challengePB("5x5"), null, "an untried challenge has no record");
eq(A.lastDoneAt("1k-tt"), A.addDays(TODAY, -2), "last done is the most recent, not the best");
eq(A.lastDoneAt("5x5"), null, "an untried challenge was never done");
eq(A.doneChallenges()[0].id, "e", "challenge history comes back newest first");
// The dead-hang prescription reads its own record, so it must move with it.
ok(A.challengeById("deadhang").prescribe().guess > 61, "dead hang asks for more than the record");
A.__setState(F.s);

describe("starting a challenge");

// A fresh state per test, so one commit can't leak into the next assertion.
function play(){
  const st = fixture().s;
  st.challenges = []; st.bench = {}; st.cdraft = null; st.ui = {};
  A.__setState(st);
  return st;
}

let st = play();
A.setBaseline("pushup", 30);
A.startChallenge("5x5");
ok(st.cdraft, "starting a challenge creates a draft");
eq(st.cdraft.cid, "5x5", "the draft knows which challenge it is");
eq(st.cdraft.prog.sets, [], "a sets challenge starts with nothing logged");
ok(st.cdraft.target.w > 0, "the draft carries its prescription, not just the id");

// The prescription must be frozen at start: a random re-prescribe would change
// the weight underneath someone mid-session.
const frozen = st.cdraft.target.w;
A.setRnd(Math.random);
for (let n = 0; n < 20; n++) eq(st.cdraft.target.w, frozen, "the prescribed weight never moves once started");
A.setRnd(() => 0.5);

A.abandonChallenge();
eq(st.cdraft, null, "abandoning clears the draft");
eq(st.challenges.length, 0, "abandoning logs nothing");

// A challenge that needs a baseline must not start without one.
st = play();
A.startChallenge("pushup-emom");
eq(st.cdraft, null, "a challenge needing a baseline does not start without it");
A.setBaseline("pushup", 25);
A.startChallenge("pushup-emom");
ok(st.cdraft, "once the baseline exists the challenge starts");
eq(st.cdraft.target.steps.length, 10, "the started draft carries its ten steps");
eq(st.cdraft.prog.paused, true, "a timed challenge waits for you to press Start");

describe("the interval clock");

st = play();
__setNow(1000000);
A.startChallenge("4x4");
const steps = st.cdraft.target.steps;
eq(st.cdraft.prog.i, 0, "a timed challenge starts on the first step");
eq(A.stepLeft(), steps[0].sec, "paused before the start, the full step remains");

// Resume: back-dating t0 must preserve the remaining time exactly.
st.cdraft.prog.paused = false;
st.cdraft.prog.t0 = 1000000;
__setNow(1000000 + 60000);                       // 60 s later
near(A.stepLeft(), steps[0].sec - 60, 0.001, "the clock is wall-clock, not tick-counted");
__setNow(1000000 + 60000 + 600000);              // ten more minutes, as if the phone slept
ok(A.stepLeft() < 0, "a step that expired while the screen was off reads as expired");

// Pause then resume across a long gap: remaining time must not drift.
st.cdraft.prog.left = 100;
st.cdraft.prog.paused = true;
eq(A.stepLeft(), 100, "paused, the stored remainder is what is left");
__setNow(2000000);
st.cdraft.prog.t0 = A.nowMs() - (steps[0].sec - 100) * 1000;
st.cdraft.prog.paused = false;
near(A.stepLeft(), 100, 0.001, "resuming after a long pause resumes where it stopped");
__realNow();

describe("logging a lifting challenge");

st = play();
A.startChallenge("5x5");
const t5r = st.cdraft.target;
const beforePB = A.bestE1RM(A.exByName(t5r.exName).id);
const sessionsBefore = st.sessions.length;

st.cdraft.prog.sets = Array.from({length: 5}, () => ({w: t5r.w, r: 5}));
A.finishChallenge();

eq(st.cdraft, null, "committing clears the draft");
eq(st.sessions.length, sessionsBefore + 1, "a lifting challenge writes a real session");
const sess = st.sessions[st.sessions.length - 1];
eq(sess.chal, "5x5", "the session is marked as coming from a challenge");
eq(sess.date, TODAY, "the session is dated today");
eq(sess.entries.length, 1, "the session holds the one lift");
eq(sess.entries[0].ex, A.exByName(t5r.exName).id, "the session points at the real exercise");
eq(sess.entries[0].sets.length, 5, "all five sets are in the session");
eq(A.tonnage(sess), t5r.w * 25, "tonnage of the challenge session is right");
eq(st.challenges.length, 1, "the challenge result is logged too");
eq(st.challenges[0].cid, "5x5", "the result knows its challenge");
eq(st.challenges[0].score, t5r.w * 25, "the score is total load moved");
ok(st.challenges[0].detail.includes("5 sets"), "the result carries a readable detail line");
// The whole point of merging: the strength charts must see this work.
ok(A.bestE1RM(A.exByName(t5r.exName).id) >= beforePB, "the challenge set feeds the e1RM history");
ok(A.weekStats(MON).tonnage > 0, "the challenge session counts toward weekly tonnage");
ok(A.doneSessions()[0].chal === "5x5", "the challenge session is the newest in history");

// Refusing to log an empty challenge.
st = play();
A.startChallenge("5x5");
A.finishChallenge();
ok(st.cdraft, "finishing with no sets logged does not commit");
eq(st.challenges.length, 0, "nothing is written for an empty challenge");

describe("logging a treadmill challenge");

st = play();
A.startChallenge("1k-tt");
__setInput("#sMin", "4");
__setInput("#sSec", "18");
const runsBefore = st.runs.length;
const kmBefore = A.weekStats(MON).km;
A.finishChallenge();

eq(st.runs.length, runsBefore + 1, "a time trial writes a real run");
const run = st.runs[st.runs.length - 1];
eq(run.km, 1, "the time trial is logged as one kilometre");
eq(run.sec, 258, "the time is read from the minutes and seconds fields");
eq(run.chal, "1k-tt", "the run is marked as coming from a challenge");
near(A.weekStats(MON).km, kmBefore + 1, 0.001, "weekly distance includes the challenge");
eq(st.challenges[0].score, 258, "the score is the time");
eq(A.challengeById("1k-tt").scoreFmt(st.challenges[0].score), "4:18", "the score reads back as a time");

// A missing time must not log a zero-second run.
st = play();
A.startChallenge("1k-tt");
__setInput("#sMin", ""); __setInput("#sSec", "");
A.finishChallenge();
ok(st.cdraft, "a time trial with no time entered does not commit");
eq(st.runs.length, 3, "no phantom run is written");

describe("logging a bodyweight challenge");

st = play();
A.startChallenge("plank-total");
__setInput("#sMin", "5"); __setInput("#sSec", "30");
const sBefore = st.sessions.length, rBefore = st.runs.length;
A.finishChallenge();
eq(st.challenges.length, 1, "the bodyweight result is logged");
eq(st.challenges[0].score, 330, "the plank total is the score");
eq(st.sessions.length, sBefore, "a bodyweight challenge writes no lifting session");
eq(st.runs.length, rBefore, "a bodyweight challenge writes no run");
eq(st.challenges[0].detail, "5:30", "the detail line reads as a time");

describe("records and personal bests");

st = play();
// Timed challenge: a slower second attempt must not become the record.
A.commitChallenge(A.challengeById("deadhang"), {mode:"single", field:{key:"sec",unit:"time"}}, {sec: 50});
eq(A.challengePB("deadhang").score, 50, "the first attempt is the record");
A.commitChallenge(A.challengeById("deadhang"), {mode:"single", field:{key:"sec",unit:"time"}}, {sec: 44});
eq(A.challengePB("deadhang").score, 50, "a shorter hang does not beat a longer one");
A.commitChallenge(A.challengeById("deadhang"), {mode:"single", field:{key:"sec",unit:"time"}}, {sec: 63});
eq(A.challengePB("deadhang").score, 63, "a longer hang takes the record");
eq(st.challenges.length, 3, "every attempt is kept, not just the best");

st = play();
const ttT = {mode:"single", km:1, field:{key:"sec",unit:"time"}};
A.commitChallenge(A.challengeById("1k-tt"), ttT, {sec: 270, km: 1});
A.commitChallenge(A.challengeById("1k-tt"), ttT, {sec: 285, km: 1});
eq(A.challengePB("1k-tt").score, 270, "for a time trial the quicker time is the record");
A.commitChallenge(A.challengeById("1k-tt"), ttT, {sec: 262, km: 1});
eq(A.challengePB("1k-tt").score, 262, "a quicker time takes the record");
eq(st.runs.length, 6, "each time trial also logged a run");

describe("score formatting");

CH.forEach(c => {
  const v = c.lower ? 300 : 1000;
  ok(typeof c.scoreFmt(v) === "string" && c.scoreFmt(v).length > 0, c.cid + " formats a score");
});
eq(A.challengeById("1k-tt").scoreFmt(272), "4:32", "a time score reads as a time");
eq(A.challengeById("pushup-emom").scoreFmt(10), "10/10 rounds", "rounds read as rounds");
ok(A.CHALLENGES.filter(c => c.lower).length > 0, "some challenges are timed, where less is better");

describe("rendering");

/* Templates are strings, so a bad reference only shows up when it is drawn.
   These walk every view and every runner mode with real state behind them. */
st = play();
A.setBaseline("pushup", 28);
A.setBaseline("plank", 75);

["home", "lift", "cardio", "play", "progress", "settings"].forEach(v => {
  let threw = null;
  try { A.__go(v); } catch(e){ threw = e; }
  ok(!threw, "the " + v + " view renders without throwing" + (threw ? " — " + threw : ""));
});

A.__go("play");
const playHtml = __el("#playBody").innerHTML;
ok(playHtml.includes("Surprise me"), "the play view offers a random draw");
ok(playHtml.includes("Everything"), "the play view lists the whole library");
ok(playHtml.includes("Recent results"), "the play view shows recent results");
ok(!playHtml.includes("undefined"), "the play view has no undefined in its markup");
ok(!playHtml.includes("NaN"), "the play view has no NaN in its markup");

const setHtml = __el("#setBody").innerHTML;
ok(setHtml.includes("Treadmill"), "settings exposes the treadmill limits");
ok(setHtml.includes("Benchmarks"), "settings exposes the benchmarks");
ok(!setHtml.includes("undefined"), "settings has no undefined in its markup");

// The drawn card.
A.drawInto();
ok(st.ui.draw, "drawing stores the offered challenge");
const cardHtml = __el("#playBody").innerHTML;
ok(cardHtml.includes("Start"), "the drawn card offers a start button");
ok(cardHtml.includes("Re-roll"), "the drawn card offers a re-roll");
ok(!cardHtml.includes("undefined"), "the drawn card has no undefined in its markup");

// Every challenge's card must draw cleanly, whatever its shape.
CHECK: {
  A.CHALLENGES.forEach(c => {
    let html = "", threw = null;
    try { html = A.challengeCard(c, c.prescribe(), true); } catch(e){ threw = e; }
    ok(!threw, c.cid + " card renders" + (threw ? " — " + threw : ""));
    ok(html.indexOf("undefined") === -1, c.cid + " card has no undefined in it");
    ok(html.indexOf("NaN") === -1, c.cid + " card has no NaN in it");
  });
}

// Every runner mode, in both its running and finished states.
A.CHALLENGES.forEach(c => {
  st = play();
  A.setBaseline("pushup", 28); A.setBaseline("plank", 75);
  A.startChallenge(c.cid);
  if (!st.cdraft){ ok(false, c.cid + " could not be started for the render check"); return; }

  let threw = null;
  try { A.renderPlay(); } catch(e){ threw = e; }
  ok(!threw, c.cid + " runner renders" + (threw ? " — " + threw : ""));
  let html = __el("#playBody").innerHTML;
  ok(html.indexOf("undefined") === -1, c.cid + " runner has no undefined in it");
  ok(html.indexOf("NaN") === -1, c.cid + " runner has no NaN in it");

  // Now drive it to its finished state and draw that too.
  if (st.cdraft.target.mode === "timer"){
    st.cdraft.prog.i = st.cdraft.target.steps.length - 1;
    st.cdraft.prog.paused = true; st.cdraft.prog.left = 0;
  } else if (st.cdraft.target.mode === "sets"){
    st.cdraft.prog.sets = Array.from({length: st.cdraft.target.sets},
      (_, j) => ({w: st.cdraft.target.w, r: st.cdraft.target.ladder ? st.cdraft.target.ladder[j] : st.cdraft.target.reps}));
  }
  threw = null;
  try { A.renderPlay(); } catch(e){ threw = e; }
  ok(!threw, c.cid + " runner renders when finished" + (threw ? " — " + threw : ""));
  html = __el("#playBody").innerHTML;
  ok(html.indexOf("undefined") === -1, c.cid + " finished runner has no undefined in it");
});

// A result in the log must render on Play and on Home's recent feed.
st = play();
A.commitChallenge(A.challengeById("deadhang"), {mode:"single", field:{key:"sec",unit:"time"}}, {sec: 55});
A.__go("play");
ok(__el("#playBody").innerHTML.includes("Dead hang"), "a logged challenge appears in recent results");
let threw = null;
try { A.__go("home"); } catch(e){ threw = e; }
ok(!threw, "home still renders with challenge results in the log");

// A challenge session must not break the views that read sessions.
st = play();
A.startChallenge("5x5");
st.cdraft.prog.sets = [{w: st.cdraft.target.w, r: 5}];
A.finishChallenge();
["home", "lift", "progress", "play"].forEach(v => {
  let t2 = null;
  try { A.__go(v); } catch(e){ t2 = e; }
  ok(!t2, v + " renders with a challenge-sourced session in history" + (t2 ? " — " + t2 : ""));
});
ok(__el("#liftBody").innerHTML.includes("5 × 5"), "the challenge session shows in lifting history");

}

quit(summary());
