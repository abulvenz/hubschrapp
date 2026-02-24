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

  constructor() {
    super();
    heli = this;
    console.log(this.pos);
  }

  move(keys) {
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
    //    m.redraw(); // wichtig: Mithril sagen, dass sich was geändert hat
  }

  view() {
    //    console.log(this.pos, this.dir);
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
        //point,
        g({ transform: "translate(-140 -60)" }, [
          //   rect( {
          //     x: "0",
          //     y: "0",
          //     width: "300",
          //     height: "200",
          //     fill: "#e0f4ff",
          //   }),
          //
          m(
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
          ),
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
              //            fill: "#2b7bbb",
              transform: `rotate(${t} 0 0)translate(-2 -20)`,
            }),
            rect({
              x: "0",
              y: "0",
              width: "40",
              height: "4",
              //fill: "#2b7bbb",
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
          //   rect({
          //     x: "60",
          //     y: "58",
          //     width: `${sin((t / 180) * PI) * 160}`,
          //     height: "4",
          //     fill: "#2b7bbb",
          //     transform: `rotate(${t} 140 60)`,
          //   }),
          //   rect({
          //     x: "138",
          //     y: "-20",
          //     width: "4",
          //     height: "160",
          //     fill: "#2b7bbb",
          //     transform: `rotate(${t} 140 60)`,
          //   }),
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
      )
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
    if (!heli) return;

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
  t = (t + 40) % 360;
  objs.forEach((o) => o.move(pressedKeys));
  //console.log(pressedKeys);

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
    ),
    audio({ src: rotorSound, autoplay: true, loop: true }),
    audio({ src: music, autoplay: true, loop: true }),
  ],
});

m.redraw();
