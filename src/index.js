let baseSize = 1

class Process2D {
  constructor(id, allProcesses, x, y) {
    this.id = id;
    this.clock = 0;
    this.requesting = false;
    this.requestTime = null; // <<< timestamp do pedido
    this.waitingTime = 0
    this.queue = [];
    this.replies = new Set();
    this.allProcesses = allProcesses;
    this.x = x
    this.y = y
    this.critic = null
    this.animations = []
  }

  log(msg) {
    console.log(`[P${this.id}] ${msg}`);
  }

  requestCS() {
    this.clock++;
    this.requestTime = this.clock;
    this.waitingTime = millis()
    this.requesting = true;
    this.replies.clear();

    this.log(`quer entrar na SC (clock=${this.clock})`);
    this.broadcast({ type: "REQUEST", clock: this.requestTime, from: this.id });
  }

  receive(msg) {
    this.clock = Math.max(this.clock, msg.clock) + 1;

    switch (msg.type) {
      case "REQUEST":
        this.handleRequest(msg);
        break;
      case "REPLY":
        this.handleReply(msg);
        break;
    }
  }

  handleRequest(msg) {
    if (!this.requesting) {
      // não quero SC → libero
      this.send(msg.from, { type: "REPLY", clock: this.clock, from: this.id });
    } else {
      // ambos querem → decide pelo requestTime
      const myPriority = [this.requestTime, this.id];
      const otherPriority = [msg.clock, msg.from];

      if (
        otherPriority[0] < myPriority[0] ||
        (otherPriority[0] === myPriority[0] && otherPriority[1] < myPriority[1])
      ) {
        // outro tem prioridade
        this.send(msg.from, { type: "REPLY", clock: this.clock, from: this.id });
      } else {
        // eu tenho prioridade → atraso resposta
        this.queue.push(msg.from);
      }
    }
  }

  handleReply(msg) {
    this.replies.add(msg.from);
    if (this.replies.size === this.allProcesses.length - 1) {
      this.enterCS();
    }
  }

  enterCS() {
    this.log("ENTROU na seção crítica!");
    this.critic = {
      start: millis(),
      duration: Math.random() * 2000 + 1000
    }
  }

  exitCS() {
    this.log("saiu da seção crítica.");
    this.requesting = false;
    this.requestTime = null;

    data.waitingTime += millis() - this.waitingTime

    // respondo atrasados
    while (this.queue.length > 0) {
      const pid = this.queue.shift();
      this.send(pid, { type: "REPLY", clock: this.clock, from: this.id });
    }
  }

  send(to, msg) {
    const deltaT = Math.random() * 1000 + 1000
    const startTime = millis()
    data.latency += deltaT
    data.totalMenssages++

    this.animations.push({
      start: startTime,
      duration: deltaT,
      msg: msg,
      to: to,
      startPos: {
        x: this.x,
        y: this.y
      },
      endPos: {
        x: this.allProcesses[to].x,
        y: this.allProcesses[to].y
      }
    })
  }

  broadcast(msg) {
    this.allProcesses.forEach((p, i) => {
      if (i !== this.id) this.send(i, msg);
    });
  }

  draw() {
    noStroke()
    if (this.requesting)
      fill(255, 0, 255)
    else
      fill(255)
    rect(this.x, this.y, 100 * baseSize, 100 * baseSize)
    fill(0)
    textSize(30 * baseSize)
    text(`P${this.id}`, this.x, this.y)
    textSize(20 * baseSize)
    text(`Clock ${this.clock}`, this.x, this.y + 30 * baseSize)
    textSize(30 * baseSize)
  }
}

// ===============================
// Simulação
// ===============================

let data;

const processes = [];
let center;

const totalProcess = 12
const deltaA = Math.PI * 2 / totalProcess

let radius = 400

function setup() {
  const container = document.getElementById("animation-container");
  const canvas = createCanvas(container.offsetWidth, container.offsetHeight);
  canvas.parent('animation-container');
  const m = min(width, height)
  const dif =  (m / max(width, height)) ** 2
  console.log(dif)
  baseSize = (m / 1080) - dif * 0.15
  textAlign(CENTER, CENTER)
  textSize(30 * baseSize)
  rectMode(CENTER, CENTER)
  strokeWeight(8 * baseSize)

  radius *= baseSize

  center = {
    x: width / 2,
    y: height / 2
  }

  data = {
    requests: 0,
    curRequests: 0,
    time: millis(),
    latency: 0,
    waitingTime: 0,
    lastProcess: [],
    totalMenssages: 0
  }

  for (let i = 0; i < totalProcess; i++) {
    const theta = i * deltaA
    const x = Math.cos(theta) * radius
    const y = -Math.sin(theta) * radius

    processes.push(new Process2D(i, processes, center.x + x, center.y + y));
  }
}

function draw() {
  background(0)

  const time = millis()

  for (const p of processes) {
    if (Math.random() < 0.0005 && !p.requesting) {
      data.requests++
      data.curRequests++
      p.requestCS()
    }
    if (p.critic) {
      const t = (time - p.critic.start) / p.critic.duration
      if (t <= 1) {
        stroke(255, 255, 0)
        line(p.x, p.y, center.x, center.y)
      } else {
        p.critic = null
        data.curRequests--
        data.lastProcess.unshift(`P${p.id}`)
        if (data.length > 5) data.pop()
        p.exitCS()
      }
    }
    for (let i = 0; i < p.animations.length; i++) {
      const a = p.animations[i]
      if (a) {
        const t = (time - a.start) / a.duration
        if (t > 1) {
          processes[a.to].receive(a.msg)
          p.animations.splice(i--, 1);
          continue
        }
        const dx = a.endPos.x - a.startPos.x
        const dy = a.endPos.y - a.startPos.y

        const x = a.startPos.x + dx * t
        const y = a.startPos.y + dy * t

        if (a.msg.type == "REQUEST") {
          fill(255, 0, 0)
        } else {
          fill(0, 255, 0)
        }

        stroke(100)
        rect(x, y, 20 * baseSize, 20 * baseSize)
        noStroke()
      }
    }
    p.draw()
  }

  fill(255, 255, 0)
  circle(center.x, center.y, 200 * baseSize)
  fill(0)
  text("Seção\nCrítica", center.x, center.y)

  const sec = Math.floor((millis() - data.time) / 1000)

  fill(255);
  textAlign(LEFT, TOP);
  textSize(25 * baseSize);

  const stats = [
    `⏱ Tempo: ${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`,
    `📌 Total de Requisições: ${data.requests}`,
    `📌 Requisições Atuais: ${data.curRequests}`,
    `📊 Latência Média: ${(data.latency / (data.requests * 1000 * totalProcess)).toFixed(2)} s`,
    `📊 Tempo de Espera Médio: ${(data.waitingTime / (data.requests * 1000)).toFixed(2)} s`,
    `✉️ Total Mensagens: ${data.totalMenssages}`,
    `Últimos: ${data.lastProcess.slice(0, 5).join(", ")}`
  ];

  stats.forEach((line, i) => {
    text(line, 20, 20 + i * 40 * baseSize);
  });

  textAlign(CENTER, CENTER);
}