import m from "mithril";
import tagl, { view } from "tagl-mithril";
import rotorSound from "url:./rotor2.mp3";
import music from "url:./music.mp3";
const {
  svg,
  g,
  path,
  circle,
  rect,
  ellipse,
  polygon,
  line,
  audio,
  animate,
  text,
} = tagl(m);
const { sin, cos, PI, min, max, random } = Math;
let t = 0;
let heli = null;
let rescued = 0;

const lightnings = [];
let screenFlash = 0;
let victory = false;
let victoryTicks = 0;
let rotorSpeed = 40;
let rotorAudioEl = null;
let musicAudioEl = null;

function playFanfare() {
  const ctx = new AudioContext();
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.5;
  masterGain.connect(ctx.destination);
  const melody = [
    { freq: 392.00, start: 0, dur: 0.25 },
    { freq: 493.88, start: 0.2, dur: 0.25 },
    { freq: 587.33, start: 0.4, dur: 0.25 },
    { freq: 783.99, start: 0.7, dur: 0.4 },
    { freq: 587.33, start: 1.1, dur: 0.2 },
    { freq: 783.99, start: 1.35, dur: 1.2 },
  ];
  melody.forEach(n => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = n.freq;
    gain.gain.setValueAtTime(0.35, ctx.currentTime + n.start);
    gain.gain.setValueAtTime(0.35, ctx.currentTime + n.start + n.dur * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.start + n.dur);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(ctx.currentTime + n.start);
    osc.stop(ctx.currentTime + n.start + n.dur + 0.05);
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.value = n.freq * 2;
    gain2.gain.setValueAtTime(0.12, ctx.currentTime + n.start);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.start + n.dur);
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.start(ctx.currentTime + n.start);
    osc2.stop(ctx.currentTime + n.start + n.dur + 0.05);
  });
}

const PERSON_POSITIONS = [800, 1400, 2200, 3000, 4000];
const PERSON_COLORS = ["#ff6633", "#ff3366", "#ffcc00", "#33ccff", "#cc66ff"];

const p = (x, y) => ({ x, y });
const add = (p1, p2) => p(p1.x + p2.x, p1.y + p2.y);
const sub = (p1, p2) => p(p1.x - p2.x, p1.y - p2.y);
const scal = (p1, p2) => p1.x * p2.x + p1.y * p2.y;
const scale = (p1, f) => p(p1.x * f, p1.y * f);
const sat = (p_, mini, maxi) =>
  p(min(maxi.x, max(mini.x, p_.x)), min(maxi.y, max(mini.y, p_.y)));
const satv = (v, mini, maxi) => max(mini, min(maxi, v));

const range = (N) => {
  const r = [];
  for (let i = 0; i < N; i++) r.push(i);
  return r;
};

const pressedKeys = new Set();

const pointerStart = new Map();
const DEAD = 10;

function handlePointerDown(e) {
  pointerStart.set(e.pointerId, { x: e.clientX, y: e.clientY });
}

function handlePointerMove(e) {
  const start = pointerStart.get(e.pointerId);
  if (!start) return;

  const dx = e.clientX - start.x;
  const dy = e.clientY - start.y;

  const ids = [...pointerStart.keys()];
  const first = ids[0];
  const second = ids[1];

  // Reset all virtual keys
  for (const k of [
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "PageUp",
    "PageDown",
  ])
    pressedKeys.delete(k);

  if (e.pointerId === first) {
    // Finger 1 = Arrow
    if (Math.abs(dx) > DEAD)
      pressedKeys.add(dx < 0 ? "ArrowLeft" : "ArrowRight");
    if (Math.abs(dy) > DEAD) pressedKeys.add(dy < 0 ? "ArrowUp" : "ArrowDown");
  }

  if (e.pointerId === second) {
    // Finger 2 = PageUp/Down
    if (Math.abs(dy) > DEAD) pressedKeys.add(dy < 0 ? "PageUp" : "PageDown");
  }
}

function handlePointerUp(e) {
  const start = pointerStart.get(e.pointerId);
  pointerStart.delete(e.pointerId);
  for (const k of [
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "PageUp",
    "PageDown",
  ])
    pressedKeys.delete(k);
  // Tap zum Neustarten bei Crash (Mobile)
  if (heli && heli.crashed && start) {
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (dx * dx + dy * dy < DEAD * DEAD) {
      resetGame();
    }
  }
}

function resetGame() {
  if (!heli) return;
  heli.crashed = false;
  heli.crashTicks = 0;
  heli.crashParts = [];
  heli.smokeParts = [];
  heli.cracks = [];
  heli.crashPos = null;
  heli.pos = p(180, innerHeight - 150);
  heli.speed = p(0, 0);
  heli.acc = p(0, 0);
  heli.dir = -1;
  heli.length = 50;

  // Personen zurücksetzen die am Seil hingen oder untergegangen sind
  for (const obj of objs) {
    if (obj.attached !== undefined && obj.attached) {
      obj.attached = false;
      obj.worldY = obj.waterY;
    }
    if (obj.sunk !== undefined && obj.sunk) {
      obj.sunk = false;
      obj.sinkProgress = 0;
      obj.worldY = obj.waterY;
    }
  }
  lightnings.length = 0;
  screenFlash = 0;
  victory = false;
  victoryTicks = 0;
  rotorSpeed = 40;
  if (rotorAudioEl) { rotorAudioEl.volume = 1; rotorAudioEl.play(); }
  if (musicAudioEl) { musicAudioEl.play(); }
}

function handleKeydown(e) {
  if (
    [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "PageUp",
      "PageDown",
    ].includes(e.key)
  ) {
    e.preventDefault();
  }
  if ((e.key === "r" || e.key === "R") && heli && heli.crashed) {
    resetGame();
    return;
  }
  pressedKeys.add(e.key);
}

function handleKeyup(e) {
  pressedKeys.delete(e.key);
}

window.addEventListener("pointerdown", handlePointerDown);
window.addEventListener("pointermove", handlePointerMove);
window.addEventListener("pointerup", handlePointerUp);

window.addEventListener("keydown", handleKeydown);
window.addEventListener("keyup", handleKeyup);

const objs = [];

class Stuff {
  constructor() {}
  move(keys) {}
  oncreate() {
    objs.push(this);
  }
  onremove() {
    objs.splice(objs.indexOf(this));
  }
}

class BBK extends Stuff {
  view() {
    return g([
      circle({ cx: "100", cy: "110", r: "90", fill: "#f28c28" }),
      polygon({
        points: "100,48.04 160,151.96 40,151.96",
        fill: "#1f4fa3",
      }),
    ]);
  }
}

class Tent extends Stuff {
  view() {
    return g({ transform: `translate(${320} ${innerHeight - 200})` }, [
      ellipse({
        cx: "100",
        cy: "150",
        rx: "70",
        ry: "10",
        fill: "#000",
        opacity: "0.08",
      }),
      path({ d: "M40 140 L65 80 L100 70 L100 140 Z", fill: "#d8c8c0" }),
      path({
        d: "M100 70 L135 80 L160 140 L100 140 Z",
        fill: "#cbbab0",
      }),
      path({
        d: "M82 140 L82 100 Q91 88 100 100 L100 140 Z",
        fill: "#b09fa0",
      }),
      path({
        d: "M65 80 L100 70 L135 80",
        fill: "none",
        stroke: "#b9aaa2",
        "stroke-width": "3",
        "stroke-linecap": "round",
      }),
      rect({
        x: "110",
        y: "100",
        width: "32",
        height: "24",
        rx: "3",
        ry: "3",
        fill: "#ffffff",
      }),
      rect({
        x: "124",
        y: "104",
        width: "4",
        height: "16",
        fill: "#ff5b64",
      }),
      rect({
        x: "118",
        y: "110",
        width: "16",
        height: "4",
        fill: "#ff5b64",
      }),

      // Fahne
      rect({
        x: "94",
        y: "40",
        width: "4",
        height: "30",
        fill: "#f48a8f",
      }),
      path({ d: "M98 42 H126 V56 L112 52 L98 56 Z", fill: "#ff5b64" }),
    ]);
  }
}

class Helicopter extends Stuff {
  pos = p(180, innerHeight - 150);
  speed = p(0, 0);
  acc = p(0, 0);
  dir = -1;
  length = 50;
  vscale = 90;
  crashed = false;
  crashTicks = 0;
  crashParts = [];
  smokeParts = [];
  cracks = [];
  crashPos = null;

  constructor() {
    super();
    heli = this;
    console.log(this.pos);
  }

  crash() {
    this.crashed = true;
    this.crashTicks = 0;
    this.crashPos = p(this.pos.x, this.pos.y);
    this.speed = p(0, 0);

    // Hubschrauber-Teile mit Geschwindigkeiten
    const spread = 8;
    this.crashParts = [
      // Rumpf
      { el: "body", x: 0, y: 0, vx: (random() - 0.5) * spread, vy: -random() * 3, r: 0, vr: (random() - 0.5) * 8 },
      // Cockpit-Fenster
      { el: "cockpit", x: -30, y: -12, vx: -3 - random() * spread, vy: -4 - random() * 3, r: 0, vr: (random() - 0.5) * 12 },
      // Heckausleger
      { el: "tail", x: 50, y: -4, vx: 4 + random() * spread, vy: -random() * 2, r: 0, vr: (random() - 0.5) * 6 },
      // Heckleitwerk
      { el: "fin", x: 120, y: -10, vx: 6 + random() * spread, vy: -3 - random() * 4, r: 0, vr: (random() - 0.5) * 15 },
      // Heckrotor
      { el: "tailrotor", x: 140, y: 0, vx: 8 + random() * 4, vy: -5 - random() * 3, r: 0, vr: 20 + random() * 20 },
      // Rotormast + Nabe
      { el: "mast", x: 0, y: -20, vx: (random() - 0.5) * 4, vy: -8 - random() * 6, r: 0, vr: (random() - 0.5) * 5 },
      // Rotorblatt 1
      { el: "blade", x: -60, y: -20, vx: -8 - random() * spread, vy: -10 - random() * 5, r: 0, vr: 15 + random() * 20 },
      // Rotorblatt 2
      { el: "blade", x: 60, y: -20, vx: 8 + random() * spread, vy: -10 - random() * 5, r: 0, vr: -15 - random() * 20 },
      // Kufe links
      { el: "skidL", x: -30, y: 10, vx: -3 - random() * 3, vy: 2 + random() * 2, r: 0, vr: (random() - 0.5) * 10 },
      // Kufe rechts
      { el: "skidR", x: 30, y: 10, vx: 3 + random() * 3, vy: 2 + random() * 2, r: 0, vr: (random() - 0.5) * 10 },
    ];

    // Rauch-Partikel
    this.smokeParts = range(20).map(() => ({
      x: (random() - 0.5) * 40,
      y: 0,
      vx: (random() - 0.5) * 2,
      vy: -1 - random() * 3,
      size: 5 + random() * 10,
      maxSize: 20 + random() * 30,
      opacity: 0.8 + random() * 0.2,
      delay: random() * 30, // verzögerter Start
      color: random() < 0.3 ? "#ff6633" : (random() < 0.5 ? "#555" : "#333"),
    }));

    // Risse auf dem Bildschirm — vom Zentrum nach außen
    const cx = innerWidth * 0.5;
    const cy = this.pos.y;
    this.cracks = range(6).map(() => {
      const angle = random() * PI * 2;
      const len = 200 + random() * 400;
      const segments = 4 + Math.floor(random() * 4);
      let pts = [{ x: cx, y: cy }];
      for (let i = 1; i <= segments; i++) {
        const frac = i / segments;
        const jitter = (random() - 0.5) * 60;
        pts.push({
          x: cx + cos(angle + jitter * 0.01) * len * frac + jitter,
          y: cy + sin(angle + jitter * 0.01) * len * frac + (random() - 0.5) * 40,
        });
      }
      // Sub-branches
      const branches = [];
      for (let i = 1; i < pts.length - 1; i++) {
        if (random() > 0.5) {
          const bAngle = angle + (random() - 0.5) * 1.5;
          const bLen = 40 + random() * 80;
          branches.push({
            from: pts[i],
            to: { x: pts[i].x + cos(bAngle) * bLen, y: pts[i].y + sin(bAngle) * bLen },
          });
        }
      }
      return { pts, branches, progress: 0 };
    });
  }

  move(keys) {
    if (this.crashed) {
      this.crashTicks++;
      // Teile-Physik
      for (const part of this.crashParts) {
        part.x += part.vx;
        part.y += part.vy;
        part.vy += 0.5; // Schwerkraft
        part.r += part.vr;
      }
      // Rauch-Physik
      for (const s of this.smokeParts) {
        if (this.crashTicks < s.delay) continue;
        s.x += s.vx;
        s.y += s.vy;
        s.vx += (random() - 0.5) * 0.3;
        s.size = min(s.size + 0.5, s.maxSize);
        s.opacity = max(0, s.opacity - 0.008);
      }
      // Risse breiten sich aus
      for (const c of this.cracks) {
        if (c.progress < 1) c.progress = min(1, c.progress + 0.04);
      }
      return;
    }

    if (victory) {
      this.speed = scale(add(this.speed, p(0, 0.2)), 0.98);
      this.pos = sat(add(this.pos, this.speed), p(-2000, 0), p(innerWidth + 6000, innerHeight - 150));
      if (this.pos.y >= innerHeight - 151) {
        this.pos.y = innerHeight - 150;
        this.speed = p(0, 0);
      }
      return;
    }

    if (keys.size > 0) {
      console.log("acc", this.acc);
      console.log("speed", this.speed);
      console.log("pos", this.pos);
    }
    this.acc = p(0, 0);
    keys.forEach((key) => {
      switch (key) {
        case "ArrowUp":
          this.acc.y -= 1;
          break;
        case "ArrowDown":
          this.acc.y += 1;
          break;
        case "ArrowLeft":
          this.dir = 1;
          this.acc.x -= 1;
          break;
        case "ArrowRight":
          this.dir = -1;
          this.acc.x += 1;
          break;
        case "PageDown":
          this.length = min(this.length + 5, 2000);
          break;
        case "PageUp":
          this.length = max(this.length - 5, 50);
          break;
      }
    });
    // Seilwinde automatisch einfahren wenn Person am Haken
    if (objs.some(o => o.attached !== undefined && o.attached)) {
      this.length = max(this.length - 5, 50);
    }
    this.speed = scale(
      sat(
        add(this.speed, this.acc),
        p(-10 * this.vscale, -5 * this.vscale),
        p(10 * this.vscale, 2 * this.vscale)
      ),
      0.99
    );
    this.pos = sat(
      add(this.pos, this.speed),
      p(-2000, 0),
      p(innerWidth + 6000, innerHeight - 150)
    );

    // Crash-Detection
    if (!victory && this.pos.y >= innerHeight - 151) {
      const onHelipad = this.pos.x >= 30 && this.pos.x <= 250;
      const tiltAngle = Math.abs(this.speed.x * this.dir);
      if (!onHelipad || tiltAngle > 3) {
        this.crash();
      }
    }
  }

  renderPart(part) {
    const els = {
      body: () => rect({ x: -60, y: -25, width: 120, height: 50, rx: 25, ry: 25, fill: "#2b7bbb" }),
      cockpit: () => g(
        ellipse({ cx: 0, cy: 0, rx: 25, ry: 18, fill: "#ffffff", opacity: 0.8 }),
        path({ d: "M-20 4 Q0 -10 20 -2", fill: "none", stroke: "#2b7bbb", "stroke-width": "2" }),
      ),
      tail: () => rect({ x: -35, y: -5, width: 70, height: 10, fill: "#2b7bbb" }),
      fin: () => polygon({ points: "0,-10 20,-20 20,20 0,10", fill: "#2b7bbb" }),
      tailrotor: () => g(
        circle({ cx: 0, cy: 0, r: 6, fill: "#fff", stroke: "#2b7bbb", "stroke-width": 2 }),
        rect({ x: -2, y: -20, width: 4, height: 40, fill: "#333" }),
      ),
      mast: () => g(
        rect({ x: -5, y: -20, width: 10, height: 20, fill: "#2b7bbb" }),
        circle({ cx: 0, cy: -20, r: 6, fill: "#fff", stroke: "#2b7bbb", "stroke-width": 2 }),
      ),
      blade: () => line({ x1: 0, y1: 0, x2: 100, y2: 0, stroke: "#333", "stroke-width": 4, "stroke-linecap": "round" }),
      skidL: () => g(
        line({ x1: 0, y1: 0, x2: 10, y2: 20, stroke: "#333", "stroke-width": 4, "stroke-linecap": "round" }),
        line({ x1: -30, y1: 20, x2: 30, y2: 20, stroke: "#333", "stroke-width": 5, "stroke-linecap": "round" }),
      ),
      skidR: () => g(
        line({ x1: 0, y1: 0, x2: -10, y2: 20, stroke: "#333", "stroke-width": 4, "stroke-linecap": "round" }),
        line({ x1: -30, y1: 20, x2: 30, y2: 20, stroke: "#333", "stroke-width": 5, "stroke-linecap": "round" }),
      ),
    };
    const renderFn = els[part.el];
    if (!renderFn) return g();
    return g(
      { transform: `translate(${part.x} ${part.y}) rotate(${part.r})` },
      renderFn()
    );
  }

  crashView() {
    const cx = innerWidth * 0.5;
    const cy = this.crashPos.y;
    return g(
      // Auseinanderfliegende Teile
      g({ transform: `translate(${cx} ${cy})` },
        this.crashParts.map((part, i) => this.renderPart(part))
      ),
      // Rauch-Partikel
      g({ transform: `translate(${cx} ${cy})` },
        this.smokeParts.filter(s => this.crashTicks >= s.delay).map((s, i) =>
          circle({
            cx: s.x,
            cy: s.y,
            r: s.size,
            fill: s.color,
            opacity: s.opacity,
          })
        )
      ),
    );
  }

  view() {
    if (this.crashed) return this.crashView();

    return g(
      {
        transform: `translate(${this.pos.x * 0 + innerWidth * 0.5} ${
          this.pos.y
        }) scale(${this.dir},1)`,
      },
      line({
        x1: "0",
        y1: "0",
        y2: `${this.length}`,
        x2: "0",
        stroke: "#333",
        "stroke-width": "6",
        "stroke-linecap": "round",
      }),
      // Rettungshaken
      g({ transform: `translate(0 ${this.length})` },
        circle({ cx: 0, cy: 0, r: 6, fill: "#ff6633", stroke: "#333", "stroke-width": 2 }),
        path({ d: "M-5,4 Q-8,14 0,12 Q8,14 5,4", fill: "none", stroke: "#333", "stroke-width": 2.5, "stroke-linecap": "round" }),
      ),
      g(
        { transform: `rotate(${satv(this.speed.x * this.dir, -30, 30)})` },
        g({ transform: "translate(-140 -60)" }, [
          rotorSpeed > 0 ? m(
            "ellipse",
            {
              cx: "140",
              cy: "60",
              rx: "100",
              ry: "5",
              fill: "rgba(0,0,0,0.15)",
            },
            animate({
              attributename: "ry",
              values: "5;8;5",
              dur: "0.1s",
              repeatcount: "indefinite",
            })
          ) : ellipse({
            cx: "140",
            cy: "60",
            rx: "100",
            ry: "5",
            fill: "rgba(0,0,0,0.15)",
          }),
          rect({
            x: "80",
            y: "80",
            width: "120",
            height: "50",
            rx: "25",
            ry: "25",
            fill: "#2b7bbb",
          }),
          ellipse({
            cx: "110",
            cy: "92",
            rx: "25",
            ry: "18",
            fill: "#ffffff",
            opacity: "0.8",
          }),
          path({
            d: "M90 96 Q110 82 130 90",
            fill: "none",
            stroke: "#2b7bbb",
            "stroke-width": "2",
          }),
          rect({
            x: "190",
            y: "96",
            width: "70",
            height: "10",
            fill: "#2b7bbb",
          }),
          g({ transform: "translate(160 90)scale(0.15)" }, m(BBK)),
          polygon({
            points: "260,90 280,80 280,120 260,110",
            fill: "#2b7bbb",
          }),
          circle({
            cx: "280",
            cy: "100",
            r: "6",
            fill: "#ffffff",
            stroke: "#2b7bbb",
            "stroke-width": "2",
          }),
          g(
            { transform: "translate(280 100)" },
            rect({
              x: "0",
              y: "0",
              width: "4",
              height: "40",
              transform: `rotate(${t} 0 0)translate(-2 -20)`,
            }),
            rect({
              x: "0",
              y: "0",
              width: "40",
              height: "4",
              transform: `rotate(${t} 0 0)translate(-20 -2 )`,
            })
          ),
          rect({
            x: "135",
            y: "60",
            width: "10",
            height: "20",
            fill: "#2b7bbb",
          }),
          circle({
            cx: "140",
            cy: "60",
            r: "6",
            fill: "#ffffff",
            stroke: "#2b7bbb",
            "stroke-width": "2",
          }),
          line({
            x1: "140",
            y1: "60",
            x2: `${140 + cos((t / 180) * PI) * 100}`,
            y2: `60`,
            stroke: "#333",
            "stroke-width": "4",
            "stroke-linecap": "round",
          }),
          line({
            x1: "140",
            y1: "60",
            x2: `${140 + cos((t / 180) * PI + PI) * 100}`,
            y2: `60`,
            stroke: "#333",
            "stroke-width": "4",
            "stroke-linecap": "round",
          }),
          line({
            x1: "100",
            y1: "130",
            x2: "110",
            y2: "150",
            stroke: "#333",
            "stroke-width": "4",
            "stroke-linecap": "round",
          }),
          line({
            x1: "180",
            y1: "130",
            x2: "170",
            y2: "150",
            stroke: "#333",
            "stroke-width": "4",
            "stroke-linecap": "round",
          }),
          line({
            x1: "70",
            y1: "150",
            x2: "130",
            y2: "150",
            stroke: "#333",
            "stroke-width": "5",
            "stroke-linecap": "round",
          }),
          line({
            x1: "150",
            y1: "150",
            x2: "210",
            y2: "150",
            stroke: "#333",
            "stroke-width": "5",
            "stroke-linecap": "round",
          }),
        ])
      )
    );
  }
}

class Helipad extends Stuff {
  view() {
    return g({ transform: `translate(${140} ${innerHeight - 60})` }, [
      ellipse({
        cx: "0",
        cy: "0",
        rx: "110",
        ry: "28",
        fill: "#f6f7ff",
        stroke: "#000",
        "stroke-width": "4",
      }),
      ellipse({
        cx: "0",
        cy: "0",
        rx: "100",
        ry: "24",
        fill: "none",
        stroke: "#000",
        "stroke-width": "1.5",
        opacity: "0.18",
      }),
      g({ transform: "translate(0,0) scale(1,.35) skewX(8)" }, [
        rect({
          x: "-32",
          y: "-45",
          width: "14",
          height: "90",
          fill: "#000",
          rx: "2",
        }),
        rect({
          x: "18",
          y: "-45",
          width: "14",
          height: "90",
          fill: "#000",
          rx: "2",
        }),
        rect({
          x: "-18",
          y: "-6",
          width: "44",
          height: "12",
          fill: "#000",
          rx: "2",
        }),
      ]),
    ]);
  }
}

class Moon {
  view() {
    return g(
      {
        transform: `translate(${innerWidth * 0.5} ${
          innerHeight * 0.2
        }) scale(1.2)`,
      },
      path({
        d: "M100,40\n       A60,60 0 1,1 100,160\n       A45,60 0 1,0 100,40\n       Z",
        fill: "#f0e9d8",
      })
    );
  }
}

class House {
  height = 12;
  width = 6;
  view({ attrs: { x, y } }) {
    return g(
      { transform: `translate(${-100} ${innerHeight - 150})rotate(180)` },
      rect({
        x: 0,
        y: 0,
        width: this.width * 20,
        height: this.height * 20,
        fill: "#d8c8c0",
        stroke: "#000",
      }),
      range(this.height).map((j) =>
        range(this.width).map((i) =>
          rect({
            x: i * 20 + 5,
            y: j * 20 + 7.5,
            width: 10,
            height: 10,
            fill: "#000",
            stroke: "#000",
          })
        )
      ),
      // Blitzableiter
      line({ x1: 60, y1: 240, x2: 60, y2: 280, stroke: "#777", "stroke-width": 2.5, "stroke-linecap": "round" }),
      line({ x1: 52, y1: 260, x2: 68, y2: 260, stroke: "#777", "stroke-width": 2 }),
      circle({ cx: 60, cy: 280, r: 3, fill: "#ddd", stroke: "#999", "stroke-width": 1 }),
    );
  }
}

class Controls extends Stuff {
  start = p(0, 0);
  dir = p(0, 0);
  move(keys) {
    this.start = pointerStart.get(pointerStart.keys().next().value) || p(0, 0);
    // pointerStart.get(1) || p(0, 0);
    this.dir = p(this.start.x, this.start.y);
    keys.forEach((key) => {
      switch (key) {
        case "ArrowUp":
          this.dir.y -= 30;
          break;
        case "ArrowDown":
          this.dir.y += 30;
          break;
        case "ArrowLeft":
          this.dir.x -= 30;
          break;
        case "ArrowRight":
          this.dir.x += 30;
          break;
      }
    });
  }
  view() {
    return g(
      {
        transform: `translate(0 ${-150})`,
      },
      circle({
        cx: this.start.x,
        cy: this.start.y,
        r: 18,
        fill: "#000",
        opacity: "0.3",
      }),
      line({
        x1: this.start.x,
        y1: this.start.y,
        x2: this.dir.x,
        y2: this.dir.y,
        stroke: "#000",
        "stroke-width": "6",
        "stroke-linecap": "round",
        opacity: "0.5",
      }),
      circle({
        cx: this.dir.x,
        cy: this.dir.y,
        r: 18,
        fill: "#000",
        opacity: "0.8",
      })
      // text(
      //   { x: 20, y: 40, fill: "#000", "font-size": "24" },
      //   "Steuerung: " + JSON.stringify(this.dir)
      // )
    );
  }
}

class Background {
  points = range(130).map((i) => random() * innerHeight * 0.3);
  offset = 1000;
  shiftX = 1130;
  view({ attrs: { color } }) {
    return g(
      { transform: `translate(-${this.shiftX} ${innerHeight - 200})` },
      polygon({}),
      polygon({
        points:
          `0,${this.offset} ` +
          this.points.map((p, i) => `${i * 100},${-p}`).join(" ") +
          ` ${(this.points.length - 1) * 100},${this.offset}`,
        fill: color,
      })
    );
  }
}

class Lake extends Background {
  points = range(130).map((i) => random() * 100);
  offset = 0;
  shiftX = 13500;
}

class Person extends Stuff {
  phase = random() * PI * 2;
  rescued = false;
  attached = false;
  rescueX = 0;
  walkProgress = 0;
  sunk = false;
  sinkProgress = 0;

  oninit(vnode) {
    this.worldX = vnode.attrs.wx;
    this.color = vnode.attrs.color || "#ff6633";
    this.waterY = innerHeight - 60;
    this.worldY = this.waterY;
  }

  move() {
    if (this.rescued) {
      if (this.walkProgress < 1) this.walkProgress += 0.015;
      return;
    }
    if (this.sunk) {
      this.sinkProgress = min(this.sinkProgress + 0.02, 1);
      return;
    }
    if (!heli) return;

    // Bei Crash: Person fällt vom Seil zurück ins Wasser
    if (heli.crashed) {
      if (this.attached) {
        this.attached = false;
        this.worldY = this.waterY;
      }
      return;
    }

    if (this.attached) {
      this.worldX = heli.pos.x;
      this.worldY = heli.pos.y + heli.length + 30;

      // Gerettet wenn nahe am Helipad/Zelt abgesetzt
      if (this.worldX > -50 && this.worldX < 500 && this.worldY > innerHeight - 100) {
        this.rescued = true;
        this.attached = false;
        this.rescueX = 220 + rescued * 28;
        rescued++;
      }
      return;
    }

    // Seilende nah genug? Dann festhalten!
    const ropeTipX = heli.pos.x;
    const ropeTipY = heli.pos.y + heli.length;
    const dx = ropeTipX - this.worldX;
    const dy = ropeTipY - this.worldY;
    if (dx * dx + dy * dy < 50 * 50) {
      this.attached = true;
    }
  }

  view() {
    if (this.rescued) {
      const wp = min(this.walkProgress, 1);
      // Zielposition: Zelteingang (320+91=411, innerHeight-60)
      const targetX = 411;
      const targetY = innerHeight - 63;
      const startY = innerHeight - 75;
      const cx = this.rescueX + (targetX - this.rescueX) * wp;
      const cy = startY + (targetY - startY) * wp;

      // Im Zelt angekommen → verschwinden
      if (wp >= 1) return g();

      // Lauf-Animation: Beine schwingen
      const legSwing = sin(t / 6) * 5;
      return g(
        { transform: `translate(${cx} ${cy})` },
        circle({ cx: 0, cy: -28, r: 7, fill: "#ffcc88" }),
        rect({ x: -4, y: -21, width: 8, height: 18, rx: 2, fill: this.color }),
        line({ x1: -3, y1: -1, x2: -6 + legSwing, y2: 12, stroke: "#555", "stroke-width": 2.5 }),
        line({ x1: 3, y1: -1, x2: 6 - legSwing, y2: 12, stroke: "#555", "stroke-width": 2.5 }),
      );
    }

    if (this.sunk) {
      if (this.sinkProgress >= 1) return g();
      const sinkY = this.sinkProgress * 50;
      const opacity = 1 - this.sinkProgress;
      return g(
        { transform: `translate(${this.worldX} ${this.worldY + sinkY})`, opacity },
        circle({ cx: -5, cy: -30 - sin(t / 10) * 8, r: 2, fill: "rgba(255,255,255,0.6)" }),
        circle({ cx: 3, cy: -35 - sin(t / 10 + 1) * 8, r: 3, fill: "rgba(255,255,255,0.4)" }),
        circle({ cx: 7, cy: -28 - sin(t / 10 + 2) * 8, r: 2, fill: "rgba(255,255,255,0.5)" }),
        circle({ cx: 0, cy: -20, r: 8, fill: "#ffcc88" }),
        rect({ x: -5, y: -12, width: 10, height: 20, rx: 3, fill: this.color }),
      );
    }

    const bob = this.attached ? 0 : sin(t / 50 + this.phase) * 1.5;
    const waveL = sin(t / 12 + this.phase) * 10;
    const waveR = sin(t / 12 + this.phase + 2) * 10;

    return g(
      { transform: `translate(${this.worldX} ${this.worldY + bob})` },
      // Wasser-Spritzer
      !this.attached &&
        ellipse({ cx: 0, cy: 8, rx: 18, ry: 5, fill: "rgba(255,255,255,0.3)" }),
      // Kopf
      circle({ cx: 0, cy: -20, r: 8, fill: "#ffcc88" }),
      // Haare
      path({ d: "M-6,-26 Q0,-32 6,-26 Q4,-22 -4,-22 Z", fill: "#553311" }),
      // Körper
      rect({ x: -5, y: -12, width: 10, height: 20, rx: 3, fill: this.color }),
      // Arme winken!
      line({
        x1: -5, y1: -8, x2: -18, y2: -22 + waveL,
        stroke: "#ffcc88", "stroke-width": 3, "stroke-linecap": "round",
      }),
      line({
        x1: 5, y1: -8, x2: 18, y2: -22 + waveR,
        stroke: "#ffcc88", "stroke-width": 3, "stroke-linecap": "round",
      }),
    );
  }
}

setInterval(() => {
  t = (t + rotorSpeed) % 360;
  objs.forEach((o) => o.move(pressedKeys));
  //console.log(pressedKeys);

  // Ertrunkene Personen im Wasserbereich respawnen
  for (const obj of objs) {
    if (obj.sunk !== undefined && obj.sunk && obj.sinkProgress >= 1) {
      const viewX = heli ? heli.pos.x : 0;
      const dir = random() > 0.5 ? 1 : -1;
      obj.worldX = satv(viewX + dir * (innerWidth + 500 + random() * 1500), 600, 5000);
      obj.worldY = obj.waterY;
      obj.sunk = false;
      obj.sinkProgress = 0;
    }
  }

  // Sieg-Check: Alle gerettet UND Heli auf dem Helipad gelandet
  if (!victory && rescued >= PERSON_POSITIONS.length
      && heli && !heli.crashed
      && heli.pos.y >= innerHeight - 151
      && heli.pos.x >= 30 && heli.pos.x <= 250) {
    victory = true;
    victoryTicks = 0;
    if (musicAudioEl) musicAudioEl.pause();
    playFanfare();
  }
  if (victory) {
    victoryTicks++;
    rotorSpeed = max(0, rotorSpeed - 0.5);
    if (rotorAudioEl) {
      rotorAudioEl.volume = max(0, rotorSpeed / 40);
      if (rotorSpeed <= 0) rotorAudioEl.pause();
    }
  }

  // Blitz-System
  if (screenFlash > 0) screenFlash = max(0, screenFlash - 0.15);

  if (!victory && random() < 0.025) {
    const viewX = heli ? heli.pos.x : innerWidth / 2;
    let strikeX = viewX + (random() - 0.5) * innerWidth * 1.5;
    let strikeY = innerHeight - 50 - random() * 100;

    // Blitzableiter auf dem Hochhaus zieht Blitze in Basisnähe an
    if (strikeX < 400) {
      strikeX = -160;
      strikeY = innerHeight - 430;
    }

    // Zackiger Blitz von oben nach unten
    const numSegs = 6 + Math.floor(random() * 6);
    const topX = strikeX + (random() - 0.5) * 200;
    const segments = [{ x: topX, y: -50 }];
    for (let i = 1; i <= numSegs; i++) {
      const frac = i / numSegs;
      segments.push({
        x: topX + (strikeX - topX) * frac + (random() - 0.5) * 80 * (1 - frac),
        y: -50 + (strikeY + 50) * frac,
      });
    }

    // Verzweigungen
    const branches = [];
    for (let i = 1; i < segments.length - 1; i++) {
      if (random() > 0.5) {
        const angle = (random() - 0.5) * PI * 0.8;
        const len = 30 + random() * 60;
        branches.push({
          from: segments[i],
          to: { x: segments[i].x + cos(angle) * len, y: segments[i].y + sin(angle) * len * 0.5 + len * 0.3 },
        });
      }
    }

    const bolt = { segments, branches, strikeX, strikeY, life: 6 };
    lightnings.push(bolt);
    screenFlash = 1;

    // Trifft Hubschrauber?
    if (heli && !heli.crashed) {
      const dx = strikeX - heli.pos.x;
      const dy = strikeY - heli.pos.y;
      if (dx * dx + dy * dy < 120 * 120) {
        heli.crash();
      }
    }

    // Trifft Person?
    for (const obj of objs) {
      if (obj.sunk !== undefined && !obj.rescued && !obj.attached && !obj.sunk) {
        const dx = strikeX - obj.worldX;
        const dy = strikeY - obj.worldY;
        if (dx * dx + dy * dy < 100 * 100) {
          obj.sunk = true;
          obj.sinkProgress = 0;
        }
      }
    }
  }

  // Blitze aktualisieren
  for (let i = lightnings.length - 1; i >= 0; i--) {
    lightnings[i].life--;
    if (lightnings[i].life <= 0) lightnings.splice(i, 1);
  }

  m.redraw();
}, 50);

m.mount(document.body, {
  view: () => [
    svg(
      { width: innerWidth, height: innerHeight },
      m(Moon),
      g(
        {
          transform: `translate(${
            (heli ? -heli.pos.x : 0) + innerWidth * 0.5
          } 0)`,
        },
        g(
          {
            transform: `translate(${
              (heli ? 0.75 * heli.pos.x : 0) + innerWidth * 0.5
            } -400)`,
          },
          m(Background, { color: "rgba(43, 44, 45, 1)" })
        ),
        m(Background, { color: "rgba(25, 107, 51, 1)" }),
        g(
          { transform: `rotate(180)translate( 0 ${-innerHeight * 1.7})` },
          m(Lake, { color: "rgba(10, 80, 120, 0.8)" })
        ),
        m(Tent),
        m(House),
        m(Helipad),
        PERSON_POSITIONS.map((wx, i) =>
          m(Person, { key: wx, wx, color: PERSON_COLORS[i] })
        ),
        // Blitze
        lightnings.map((bolt) => {
          const opacity = bolt.life / 6;
          const d = "M" + bolt.segments.map(s => `${s.x},${s.y}`).join(" L");
          return g(
            path({ d, fill: "none", stroke: `rgba(180,180,255,${0.3 * opacity})`, "stroke-width": "12", "stroke-linecap": "round" }),
            path({ d, fill: "none", stroke: `rgba(220,220,255,${0.9 * opacity})`, "stroke-width": "3", "stroke-linecap": "round" }),
            path({ d, fill: "none", stroke: `rgba(255,255,255,${opacity})`, "stroke-width": "1.5", "stroke-linecap": "round" }),
            bolt.branches.map(b =>
              g(
                line({ x1: b.from.x, y1: b.from.y, x2: b.to.x, y2: b.to.y,
                  stroke: `rgba(200,200,255,${0.6 * opacity})`, "stroke-width": "2", "stroke-linecap": "round" }),
                line({ x1: b.from.x, y1: b.from.y, x2: b.to.x, y2: b.to.y,
                  stroke: `rgba(180,180,255,${0.2 * opacity})`, "stroke-width": "6", "stroke-linecap": "round" }),
              )
            ),
            circle({ cx: bolt.strikeX, cy: bolt.strikeY, r: 20 * opacity, fill: `rgba(255,220,150,${0.5 * opacity})` }),
          );
        }),
      ),
      m(Helicopter),
      m(Controls),
      // Rettungs-Anzeige
      g({ transform: `translate(${innerWidth - 220} 45)` },
        rect({ x: -10, y: -28, width: 220, height: 40, rx: 8, fill: "rgba(0,0,0,0.5)" }),
        text({ x: 0, y: 0, fill: "#fff", "font-size": "22", "font-family": "sans-serif", "font-weight": "bold" },
          `Gerettet: ${rescued} / ${PERSON_POSITIONS.length}`
        ),
      ),
      // Blitz-Flash
      screenFlash > 0 ? rect({ x: 0, y: 0, width: innerWidth, height: innerHeight, fill: "#fff", opacity: screenFlash * 0.15 }) : g(),
      // Crash-Overlay: Risse + Text
      heli && heli.crashed ? g(
        // Risse
        heli.cracks.map((crack) => {
          const n = Math.floor(crack.pts.length * crack.progress);
          if (n < 2) return g();
          const pts = crack.pts.slice(0, n);
          const d = "M" + pts.map(p => `${p.x},${p.y}`).join(" L");
          return g(
            path({ d, fill: "none", stroke: "rgba(255,255,255,0.7)", "stroke-width": "2.5", "stroke-linecap": "round" }),
            path({ d, fill: "none", stroke: "rgba(255,255,255,0.3)", "stroke-width": "5", "stroke-linecap": "round" }),
            crack.branches.filter((_, i) => i < n - 1).map(b =>
              line({ x1: b.from.x, y1: b.from.y, x2: b.to.x, y2: b.to.y,
                stroke: "rgba(255,255,255,0.5)", "stroke-width": "1.5", "stroke-linecap": "round" })
            ),
          );
        }),
        // CRASH-Text (nach 60 Ticks ≈ 3 Sekunden)
        heli.crashTicks > 60 ? g(
          { transform: `translate(${innerWidth * 0.5} ${innerHeight * 0.4})` },
          text({ x: 0, y: 0, fill: "#ff2222", "font-size": "90", "font-family": "sans-serif",
            "font-weight": "bold", "text-anchor": "middle", stroke: "#000", "stroke-width": "3",
            opacity: min(1, (heli.crashTicks - 60) / 15) },
            "CRASH!"
          ),
          text({ x: 0, y: 50, fill: "#fff", "font-size": "24", "font-family": "sans-serif",
            "text-anchor": "middle",
            opacity: min(1, max(0, (heli.crashTicks - 75) / 15)) },
            "Drücke R zum Neustarten"
          ),
        ) : g(),
      ) : g(),
      // Sieg-Overlay
      victory ? g(
        { transform: `translate(${innerWidth * 0.5} ${innerHeight * 0.4})` },
        text({ x: 0, y: 0, fill: "#33ff66", "font-size": "80", "font-family": "sans-serif",
          "font-weight": "bold", "text-anchor": "middle", stroke: "#006622", "stroke-width": "3",
          opacity: min(1, victoryTicks / 30) },
          "Krise bewältigt!"
        ),
        text({ x: 0, y: 55, fill: "#fff", "font-size": "28", "font-family": "sans-serif",
          "text-anchor": "middle",
          opacity: min(1, max(0, (victoryTicks - 40) / 20)) },
          `Alle ${PERSON_POSITIONS.length} Personen gerettet!`
        ),
      ) : g(),
    ),
    audio({ src: rotorSound, autoplay: true, loop: true, oncreate: (vnode) => { rotorAudioEl = vnode.dom; } }),
    audio({ src: music, autoplay: true, loop: true, oncreate: (vnode) => { musicAudioEl = vnode.dom; } }),
  ],
});

m.redraw();
