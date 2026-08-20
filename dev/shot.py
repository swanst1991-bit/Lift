#!/usr/bin/env python3
"""Screenshot Lift at iPhone size.

Renders index.html in headless Chrome at 402x874 (iPhone 17 logical viewport)
at device pixel ratio 3, so the shots match what the installed PWA looks like.

The app reads localStorage once at load and boots to Home, so a shot of any
other view needs two injections: state before the app script runs, and a go()
call after it. Both go into a throwaway copy — index.html is never touched.

    dev/shot.py                 # every view, with demo data
    dev/shot.py play settings   # just those
    dev/shot.py --empty home    # as a fresh install sees it
    dev/shot.py --list          # the view names
"""
import os
import shutil
import subprocess
import sys
import tempfile

DEV = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(DEV, os.pardir, "index.html")
OUT = os.path.join(DEV, "shots")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

WIDTH, HEIGHT, DPR = 402, 874, 3
KEY = "lift.v1"

# view name -> JS run after the app has booted
VIEWS = {
    "home": 'go("home")',
    "lift": 'go("lift")',
    "cardio": 'go("cardio")',
    "play": 'go("play")',
    "play-drawn": 'go("play"); S.ui.pk=""; drawInto();',
    "run-sets": 'startChallenge("5x5"); go("play");',
    "run-sets-part": (
        'startChallenge("5x5");'
        'S.cdraft.prog.sets=[{w:S.cdraft.target.w,r:5},{w:S.cdraft.target.w,r:5}];'
        'go("play");'
    ),
    "run-timer": (
        'startChallenge("4x4");'
        'S.cdraft.prog.i=1; S.cdraft.prog.paused=false;'
        'S.cdraft.prog.t0=Date.now()-71000; go("play");'
    ),
    "run-single": 'startChallenge("1k-tt"); go("play");',
    "card-incline": 'go("play"); S.ui.draw={cid:"incline-grind",target:challengeById("incline-grind").prescribe()}; renderPlay();',
    "card-5x5": 'go("play"); S.ui.draw={cid:"5x5",target:challengeById("5x5").prescribe()}; renderPlay();',
    "progress": 'go("progress")',
    "settings": 'go("settings")',
}


def demo_state():
    """A plausible few weeks of history, so the charts and lists have shape.

    Assigned straight into S rather than through localStorage: the app is
    rendered inside an iframe (see build_wrapper) and file:// frames do not
    reliably get storage.
    """
    return """
        function demoState(){
          var S = seed();
          var byName = function(n){ return S.ex.find(function(e){ return e.name === n; }); };
          var squat = byName("Back Squat").id, bench = byName("Barbell Bench Press").id,
              dl = byName("Deadlift").id, ohp = byName("Overhead Press").id;
          var today = new Date();
          var d = function(n){
            var x = new Date(today.getFullYear(), today.getMonth(), today.getDate() + n);
            return x.toLocaleDateString("en-CA");
          };
          var mk = function(id, name, day, ex, sets){
            return {id:id, rid:null, name:name, date:d(day), entries:[{ex:ex, sets:sets}]};
          };
          S.sessions = [
            mk("a","Lower A",-26, squat, [{w:92.5,r:5},{w:92.5,r:5},{w:92.5,r:4}]),
            mk("b","Upper A",-24, bench, [{w:72.5,r:6},{w:72.5,r:5}]),
            mk("c","Lower B",-19, dl,    [{w:120,r:5},{w:120,r:5}]),
            mk("d","Lower A",-12, squat, [{w:95,r:5},{w:95,r:5},{w:95,r:5}]),
            mk("e","Upper B",-10, ohp,   [{w:47.5,r:6},{w:47.5,r:5}]),
            mk("f","Lower A",-5,  squat, [{w:97.5,r:5},{w:97.5,r:5},{w:100,r:3}]),
            mk("g","Upper A",-3,  bench, [{w:75,r:6},{w:75,r:6},{w:77.5,r:4}]),
          ];
          S.runs = [
            {id:"r1",date:d(-25),km:5,sec:1560,hr:151},
            {id:"r2",date:d(-18),km:8,sec:2640,hr:147},
            {id:"r3",date:d(-11),km:5,sec:1495,hr:155},
            {id:"r4",date:d(-6), km:10,sec:3360,hr:149},
            {id:"r5",date:d(-2), km:5, sec:1465,hr:158}
          ];
          S.weights = [
            {date:d(-26),kg:83.4},{date:d(-21),kg:83.0},{date:d(-16),kg:82.6},
            {date:d(-11),kg:82.4},{date:d(-6), kg:81.9},{date:d(-1), kg:81.6}
          ];
          S.bench = {pushup:{v:32,date:d(-14)}, plank:{v:105,date:d(-14)}};
          S.challenges = [
            {id:"c1",cid:"1k-tt",date:d(-9),name:"1 km time trial",kind:"run",
             exName:null,score:252,detail:"1 km in 4:12",target:"1 km"},
            {id:"c2",cid:"deadhang",date:d(-7),name:"Dead hang",kind:"body",
             exName:null,score:58,detail:"0:58",target:"Beat 0:45"},
            {id:"c3",cid:"5x5",date:d(-4),name:"5 × 5",kind:"lift",
             exName:"Back Squat",score:2312,detail:"5 sets · 25 reps",target:"5 × 5 · 92.5 kg"}
          ];
          S.ui = {hideInstall:true};
          return S;
        }
        """


def build_app(view, empty):
    """A throwaway copy of index.html with the state and view forced."""
    with open(APP, encoding="utf-8") as f:
        html = f.read()

    tail = "<script>\n"
    if not empty:
        tail += demo_state() + "\nS = migrate(demoState());\n"
    tail += "try{ %s }catch(e){ document.title = 'ERROR: ' + e.message; }\n" % VIEWS[view]
    tail += "</script>"

    out = html.replace("</body>", tail + "\n</body>")
    fd, path = tempfile.mkstemp(suffix=".html", dir=os.path.dirname(os.path.abspath(APP)))
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(out)
    return path


def build_wrapper(app_path):
    """A page holding the app in a phone-sized iframe.

    macOS refuses to give Chrome a window narrower than 500px, so asking for
    --window-size=402 renders at 500 and the capture silently crops the right
    edge — which looks exactly like a layout bug in the app. An iframe pinned
    to the top left gets a true 402px viewport inside an over-wide window, and
    the capture then lines up with the frame.
    """
    body = (
        "<style>html,body{margin:0;padding:0;background:#f5f5f4;overflow:hidden}"
        "iframe{position:absolute;left:0;top:0;width:%dpx;height:%dpx;border:0}</style>"
        "<iframe src=\"%s\"></iframe>"
    ) % (WIDTH, HEIGHT, os.path.basename(app_path))
    fd, path = tempfile.mkstemp(suffix=".html", dir=os.path.dirname(os.path.abspath(APP)))
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(body)
    return path


def shoot(view, empty):
    if not os.path.exists(CHROME):
        sys.exit("Chrome not found at %s" % CHROME)
    os.makedirs(OUT, exist_ok=True)
    app = build_app(view, empty)
    wrap = build_wrapper(app)
    png = os.path.join(OUT, "%s%s.png" % (view, "-empty" if empty else ""))
    try:
        subprocess.run([
            CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
            "--no-first-run", "--no-default-browser-check",
            "--allow-file-access-from-files",
            "--force-device-scale-factor=%d" % DPR,
            "--window-size=%d,%d" % (WIDTH, HEIGHT),
            "--screenshot=%s" % png,
            "--virtual-time-budget=2000",
            "file://" + wrap,
        ], check=True, capture_output=True, timeout=90)
    except subprocess.CalledProcessError as e:
        sys.exit("Chrome failed for %s:\n%s" % (view, e.stderr.decode()[-2000:]))
    finally:
        os.unlink(app)
        os.unlink(wrap)
    print("%-14s %s" % (view, png))
    return png


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    flags = [a for a in sys.argv[1:] if a.startswith("-")]
    if "--list" in flags:
        print("\n".join(VIEWS))
        sys.exit(0)
    empty = "--empty" in flags
    wanted = args or list(VIEWS)
    bad = [v for v in wanted if v not in VIEWS]
    if bad:
        sys.exit("unknown view(s): %s\nknown: %s" % (", ".join(bad), ", ".join(VIEWS)))
    if "--clean" in flags and os.path.isdir(OUT):
        shutil.rmtree(OUT)
    for v in wanted:
        shoot(v, empty)
