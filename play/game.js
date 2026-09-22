const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const W = canvas.width;
const H = canvas.height;

const GRAVITY = 1400;
const MOVE_ACCEL = 1800;
const MAX_SPEED = 380;
const FRICTION = 550;
const JUMP_SPEED = 660;

const keys = {};
window.addEventListener('keydown', e => { keys[e.code] = true; });
window.addEventListener('keyup', e => { keys[e.code] = false; });

function bindTouchButton(id, keyName) {
  const el = document.getElementById(id);
  if (!el) return;
  const press = e => { e.preventDefault(); keys[keyName] = true; el.classList.add('active'); };
  const release = e => { e.preventDefault(); keys[keyName] = false; el.classList.remove('active'); };
  el.addEventListener('pointerdown', press);
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  el.addEventListener('pointerleave', release);
}
bindTouchButton('btn-left', 'ArrowLeft');
bindTouchButton('btn-right', 'ArrowRight');
bindTouchButton('btn-jump', 'Space');

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function hash1(n) {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

function drawGrassBlade(x, y, h, lean, width, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - width / 2, y);
  ctx.quadraticCurveTo(x + lean * 0.55, y - h * 0.6, x + lean, y - h);
  ctx.quadraticCurveTo(x + lean * 0.55, y - h * 0.6, x + width / 2, y);
  ctx.closePath();
  ctx.fill();
}

// A bold, chunky 3-blade tuft that stays legible at actual gameplay scale
// (thin hair-thin blades turn into illegible fuzz once zoomed out to 960x540).
function drawGrassTuft(x, y, hue) {
  drawGrassBlade(x, y, 10, -6, 3.4, `hsl(${hue - 6},55%,30%)`);
  drawGrassBlade(x, y, 14, 0, 3.8, `hsl(${hue},60%,40%)`);
  drawGrassBlade(x, y, 10, 6, 3.4, `hsl(${hue + 6},55%,30%)`);
}

function drawGroundBlock(x, y, w, h, dirtColor, grassColor, seed) {
  const dirtGrad = ctx.createLinearGradient(x, y, x, y + h);
  dirtGrad.addColorStop(0, dirtColor);
  dirtGrad.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = dirtColor;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = dirtGrad;
  ctx.fillRect(x, y, w, h);

  // pebbles with a light/dark pair for a bit of relief - seeded by the
  // platform's own stable identity, never by its on-screen position, so
  // the pattern doesn't reshuffle every frame as the camera scrolls
  for (let sx = 6; sx < w - 4; sx += 17) {
    const sy = 14 + ((sx * 7) % Math.max(6, h - 18));
    const r = 1.6 + hash1(seed + sx) * 1.2;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.arc(x + sx, y + sy + 0.8, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath();
    ctx.arc(x + sx - 0.6, y + sy - 0.6, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // bold, chunky scalloped grass cap - a few big rounded bumps read far
  // better at real gameplay zoom than a dense field of hair-thin blades
  const bumps = Math.max(2, Math.round(w / 34));
  const bw = w / bumps;
  const baseY = y + 14;
  const bumpPts = [];
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.lineTo(x, y + 9);
  for (let i = 0; i < bumps; i++) {
    const bx0 = x + i * bw;
    const bx1 = bx0 + bw;
    const bxm = (bx0 + bx1) / 2;
    const peakY = y + 2 + hash1(seed + i) * 3;
    const nextY = i === bumps - 1 ? y + 9 : y + 7 + hash1(seed + i + 40) * 3;
    ctx.quadraticCurveTo(bxm, peakY, bx1, nextY);
    bumpPts.push([bxm, peakY]);
  }
  ctx.lineTo(x + w, baseY);
  ctx.closePath();

  const grassGrad = ctx.createLinearGradient(x, y, x, baseY);
  grassGrad.addColorStop(0, '#9beb6f');
  grassGrad.addColorStop(0.6, '#4fc350');
  grassGrad.addColorStop(1, grassColor);
  ctx.fillStyle = grassGrad;
  ctx.fill();

  // bold cartoon outline along the scalloped ridge for readability
  ctx.strokeStyle = 'rgba(35,90,35,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + 9);
  for (let i = 0; i < bumps; i++) {
    const bx0 = x + i * bw;
    const bx1 = bx0 + bw;
    const bxm = (bx0 + bx1) / 2;
    const [, peakY] = bumpPts[i];
    const nextY = i === bumps - 1 ? y + 9 : y + 7 + hash1(seed + i + 40) * 3;
    ctx.quadraticCurveTo(bxm, peakY, bx1, nextY);
  }
  ctx.stroke();

  // one bold tuft per bump peak, evenly spaced and easy to read at a glance
  for (let i = 0; i < bumpPts.length; i++) {
    const [bxm, peakY] = bumpPts[i];
    const hue = 96 + hash1(seed + i * 2.1 + 60) * 26;
    drawGrassTuft(bxm, peakY, hue);
  }

  // rare wildflower for extra life, anchored to a tuft so it never floats
  for (let i = 0; i < bumpPts.length; i++) {
    if (hash1(seed + i * 5.1 + 400) <= 0.85) continue;
    const [bxm, peakY] = bumpPts[i];
    ctx.fillStyle = hash1(seed + i * 5.1 + 410) > 0.5 ? '#fff7cc' : '#ffe27a';
    ctx.beginPath();
    ctx.arc(bxm, peakY - 13, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Platform {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.seed = x * 3.17 + y * 7.91; // fixed for life, never derived from on-screen position
  }
  draw(camX) {
    drawGroundBlock(this.x - camX, this.y, this.w, this.h, '#6b4226', '#4fc76a', this.seed);
  }
}

class MovingPlatform extends Platform {
  constructor(x, y, w, h, axis, range, speed) {
    super(x, y, w, h);
    this.startX = x; this.startY = y;
    this.axis = axis; // 'x' or 'y'
    this.range = range;
    this.speed = speed;
    this.dir = 1;
    this.dx = 0; this.dy = 0;
  }
  update(dt) {
    const prevX = this.x, prevY = this.y;
    if (this.axis === 'x') {
      this.x += this.dir * this.speed * dt;
      if (this.x > this.startX + this.range) this.dir = -1;
      if (this.x < this.startX - this.range) this.dir = 1;
    } else {
      this.y += this.dir * this.speed * dt;
      if (this.y > this.startY + this.range) this.dir = -1;
      if (this.y < this.startY - this.range) this.dir = 1;
    }
    this.dx = this.x - prevX;
    this.dy = this.y - prevY;
  }
  draw(camX) {
    drawGroundBlock(this.x - camX, this.y, this.w, this.h, '#334469', '#6fa8ff', this.seed);
  }
}

class Spike {
  constructor(x, y, w) {
    this.x = x; this.y = y; this.w = w; this.h = 26;
  }
  bounds() {
    return { x: this.x + 4, y: this.y + 8, w: this.w - 8, h: this.h - 8 };
  }
  draw(camX) {
    const sx = this.x - camX;
    const teeth = Math.max(1, Math.round(this.w / 18));
    const tw = this.w / teeth;
    const baseH = 7;
    const baseY = this.y + this.h - baseH;

    // dark metal base plate with a yellow/black hazard stripe
    ctx.fillStyle = '#26262b';
    ctx.fillRect(sx, baseY, this.w, baseH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(sx, baseY + 1, this.w, 3);
    ctx.clip();
    ctx.fillStyle = '#2a2a2e';
    ctx.fillRect(sx, baseY + 1, this.w, 3);
    ctx.fillStyle = '#f4c430';
    for (let sxp = -6; sxp < this.w + 6; sxp += 10) {
      ctx.beginPath();
      ctx.moveTo(sx + sxp, baseY + 5);
      ctx.lineTo(sx + sxp + 4, baseY);
      ctx.lineTo(sx + sxp + 7, baseY);
      ctx.lineTo(sx + sxp + 3, baseY + 5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    for (let i = 0; i < teeth; i++) {
      const bx = sx + i * tw;
      const tipX = bx + tw / 2;
      const tipY = this.y;

      // faceted steel tooth: lit left face, shaded right face, bold outline
      ctx.fillStyle = '#d7dee6';
      ctx.beginPath();
      ctx.moveTo(bx + 1, baseY);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(tipX, baseY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#8b93a1';
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(bx + tw - 1, baseY);
      ctx.lineTo(tipX, baseY);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#2a2a2e';
      ctx.lineWidth = 1.4;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(bx + 1, baseY);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(bx + tw - 1, baseY);
      ctx.stroke();

      // tiny glint near the tip
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(tipX - 1, tipY + 5, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

class Star {
  constructor(x, y) {
    this.x = x; this.y = y; this.r = 12; this.collected = false;
    this.baseY = y; this.t = Math.random() * Math.PI * 2;
  }
  update(dt) {
    this.t += dt * 3;
    this.y = this.baseY + Math.sin(this.t) * 6;
  }
  draw(camX) {
    if (this.collected) return;
    ctx.save();
    ctx.translate(this.x - camX, this.y);
    ctx.rotate(Math.sin(this.t * 0.6) * 0.25);
    ctx.shadowColor = 'rgba(255,215,0,0.85)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const ang = (i * 2 * Math.PI / 5) - Math.PI / 2;
      const angIn = ang + Math.PI / 5;
      ctx.lineTo(Math.cos(ang) * this.r, Math.sin(ang) * this.r);
      ctx.lineTo(Math.cos(angIn) * this.r * 0.45, Math.sin(angIn) * this.r * 0.45);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  bounds() {
    return { x: this.x - this.r, y: this.y - this.r, w: this.r * 2, h: this.r * 2 };
  }
}

class Enemy {
  constructor(x, y, size, range) {
    this.x = x; this.y = y; this.size = size;
    this.startX = x; this.range = range;
    this.dir = 1; this.speed = 90;
    this.alive = true;
    this.bounds_ = null; // resolved lazily against the platform it stands on
    this.walkPhase = Math.random() * Math.PI * 2;
    this.deathTimer = 0;
  }
  resolveBounds(platforms) {
    const half = this.size / 2;
    const ground = platforms.find(p =>
      this.startX >= p.x && this.startX <= p.x + p.w && Math.abs(this.y - p.y) < 4
    );
    const platMin = ground ? ground.x + half : -Infinity;
    const platMax = ground ? ground.x + ground.w - half : Infinity;
    this.bounds_ = {
      min: Math.max(platMin, this.startX - this.range),
      max: Math.min(platMax, this.startX + this.range),
    };
  }
  update(dt, platforms) {
    if (!this.alive) {
      if (this.deathTimer > 0) this.deathTimer -= dt;
      return;
    }
    if (!this.bounds_) this.resolveBounds(platforms);
    this.x += this.dir * this.speed * dt;
    if (this.x > this.bounds_.max) { this.x = this.bounds_.max; this.dir = -1; }
    if (this.x < this.bounds_.min) { this.x = this.bounds_.min; this.dir = 1; }
    this.walkPhase += dt * 9;
  }
  kill() {
    this.alive = false;
    this.deathTimer = 0.28;
  }
  draw(camX) {
    if (!this.alive && this.deathTimer <= 0) return;
    const ex = this.x - camX;
    const s = this.size;

    if (!this.alive) {
      // quick squash-and-fade death animation
      const t = 1 - Math.max(0, this.deathTimer) / 0.28;
      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.translate(ex + s / 2, this.y - s * (1 - t) * 0.5);
      ctx.scale(1 + t * 0.6, 1 - t * 0.85);
      this.drawBody(-s / 2, -s, s, 0);
      ctx.restore();
      return;
    }

    const legLift = Math.sin(this.walkPhase) * 3;
    const legLift2 = Math.sin(this.walkPhase + Math.PI) * 3;
    ctx.fillStyle = '#161616';
    ctx.fillRect(ex + s * 0.15, this.y + Math.max(0, legLift), s * 0.2, 5 - Math.max(0, legLift));
    ctx.fillRect(ex + s * 0.65, this.y + Math.max(0, legLift2), s * 0.2, 5 - Math.max(0, legLift2));

    const bob = Math.sin(this.walkPhase * 2) * 1.5;
    this.drawBody(ex, this.y - s + bob, s, bob);
  }
  drawBody(ex, topY, s, bob) {
    const grad = ctx.createLinearGradient(ex, topY, ex, topY + s);
    grad.addColorStop(0, '#3a3a42');
    grad.addColorStop(1, '#111114');
    ctx.fillStyle = grad;
    const r = s * 0.18;
    ctx.beginPath();
    ctx.moveTo(ex + r, topY);
    ctx.arcTo(ex + s, topY, ex + s, topY + s, r);
    ctx.arcTo(ex + s, topY + s, ex, topY + s, r);
    ctx.arcTo(ex, topY + s, ex, topY, r);
    ctx.arcTo(ex, topY, ex + s, topY, r);
    ctx.closePath();
    ctx.fill();

    // angry eyebrows
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex + s * 0.16, topY + s * 0.32);
    ctx.lineTo(ex + s * 0.4, topY + s * 0.42);
    ctx.moveTo(ex + s * 0.84, topY + s * 0.32);
    ctx.lineTo(ex + s * 0.6, topY + s * 0.42);
    ctx.stroke();

    // glowing red eyes
    ctx.shadowColor = 'rgba(255,30,30,0.9)';
    ctx.shadowBlur = 7;
    ctx.fillStyle = '#ff3b3b';
    ctx.fillRect(ex + s * 0.2, topY + s * 0.45, s * 0.16, s * 0.16);
    ctx.fillRect(ex + s * 0.64, topY + s * 0.45, s * 0.16, s * 0.16);
    ctx.shadowBlur = 0;
  }
  bounds() {
    return { x: this.x, y: this.y - this.size, w: this.size, h: this.size };
  }
}

class Bat {
  constructor(cx, cy, ampX, ampY, speed) {
    this.cx = cx; this.cy = cy;
    this.ampX = ampX; this.ampY = ampY;
    this.speed = speed;
    this.t = Math.random() * Math.PI * 2;
    this.size = 26;
    this.x = cx; this.y = cy;
    this.alive = true;
    this.wing = 0;
  }
  kill() {
    this.alive = false;
  }
  update(dt) {
    if (!this.alive) return;
    this.t += dt * this.speed;
    this.wing += dt * 14;
    this.x = this.cx + Math.sin(this.t) * this.ampX;
    this.y = this.cy + Math.sin(this.t * 1.7) * this.ampY;
  }
  draw(camX) {
    if (!this.alive) return;
    const bx = this.x - camX;
    const flap = Math.sin(this.wing) * 10;
    ctx.fillStyle = '#4a2e6b';
    ctx.beginPath();
    ctx.ellipse(bx, this.y, this.size * 0.5, this.size * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bx - this.size * 0.4, this.y);
    ctx.lineTo(bx - this.size * 1.1, this.y - flap);
    ctx.lineTo(bx - this.size * 0.4, this.y + this.size * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bx + this.size * 0.4, this.y);
    ctx.lineTo(bx + this.size * 1.1, this.y - flap);
    ctx.lineTo(bx + this.size * 0.4, this.y + this.size * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff3b3b';
    ctx.fillRect(bx - 6, this.y - 4, 4, 4);
    ctx.fillRect(bx + 2, this.y - 4, 4, 4);
  }
  bounds() {
    return { x: this.x - this.size * 0.5, y: this.y - this.size * 0.4, w: this.size, h: this.size * 0.8 };
  }
}

class Flag {
  constructor(x, y) {
    this.x = x; this.y = y; this.w = 14; this.h = 90;
  }
  draw(camX) {
    const fx = this.x - camX;
    ctx.fillStyle = '#888';
    ctx.fillRect(fx, this.y, 6, this.h);
    ctx.shadowColor = 'rgba(255,204,0,0.8)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.moveTo(fx + 6, this.y);
    ctx.lineTo(fx + 46, this.y + 16);
    ctx.lineTo(fx + 6, this.y + 32);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  bounds() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
}

class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.r = 20;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.angle = 0;
    this.standingPlatform = null;
    this.squash = 0;
    this.lookX = 0;
    this.blinkIn = 2 + Math.random() * 2;
    this.blinking = 0;
  }
  bounds() {
    return { x: this.x - this.r, y: this.y - this.r, w: this.r * 2, h: this.r * 2 };
  }
  update(dt, platforms) {
    const left = keys['ArrowLeft'] || keys['KeyA'];
    const right = keys['ArrowRight'] || keys['KeyD'];
    const jump = keys['Space'] || keys['ArrowUp'] || keys['KeyW'];

    if (left && !right) {
      this.vx -= MOVE_ACCEL * dt;
    } else if (right && !left) {
      this.vx += MOVE_ACCEL * dt;
    } else {
      const decel = FRICTION * dt;
      if (this.vx > 0) this.vx = Math.max(0, this.vx - decel);
      else if (this.vx < 0) this.vx = Math.min(0, this.vx + decel);
    }
    this.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, this.vx));

    if (jump && this.onGround) {
      this.vy = -JUMP_SPEED;
      this.onGround = false;
      this.standingPlatform = null;
    }

    this.vy += GRAVITY * dt;

    if (this.onGround && this.standingPlatform instanceof MovingPlatform) {
      this.x += this.standingPlatform.dx;
      this.y += this.standingPlatform.dy;
    }

    this.x += this.vx * dt;
    this.resolveCollisions(platforms, 'x');
    this.y += this.vy * dt;
    const wasOnGround = this.onGround;
    this.onGround = false;
    if (wasOnGround) this.standingPlatform = null;
    this.resolveCollisions(platforms, 'y');

    this.angle += (this.vx / this.r) * dt;
    this.squash = Math.max(0, this.squash - dt * 5);

    const targetLook = Math.max(-1, Math.min(1, this.vx / 180));
    this.lookX += (targetLook - this.lookX) * Math.min(1, dt * 8);

    if (this.blinking > 0) {
      this.blinking -= dt;
    } else {
      this.blinkIn -= dt;
      if (this.blinkIn <= 0) {
        this.blinking = 0.12;
        this.blinkIn = 2.5 + Math.random() * 2.5;
      }
    }
  }
  resolveCollisions(platforms, axis) {
    const b = this.bounds();
    for (const p of platforms) {
      if (!rectsOverlap(b, p)) continue;
      if (axis === 'x') {
        if (this.vx > 0) this.x = p.x - this.r;
        else if (this.vx < 0) this.x = p.x + p.w + this.r;
        this.vx = 0;
      } else {
        if (this.vy > 0) {
          this.squash = Math.min(1, this.vy / 900);
          this.y = p.y - this.r;
          this.vy = 0;
          this.onGround = true;
          this.standingPlatform = p;
        } else if (this.vy < 0) {
          this.y = p.y + p.h + this.r;
          this.vy = 0;
        }
      }
      b.x = this.x - this.r; b.y = this.y - this.r;
    }
  }
  draw(camX) {
    const px = this.x - camX;
    ctx.save();
    ctx.translate(px, this.y);
    const sx = 1 + this.squash * 0.22;
    const sy = 1 - this.squash * 0.3;
    ctx.scale(sx, sy);
    ctx.rotate(this.angle);

    ctx.shadowColor = 'rgba(255,60,60,0.55)';
    ctx.shadowBlur = 16;
    const grad = ctx.createRadialGradient(-7, -8, 3, 1, 2, this.r * 1.15);
    grad.addColorStop(0, '#ffb3b3');
    grad.addColorStop(0.55, '#f13a3a');
    grad.addColorStop(1, '#a81616');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(138,0,0,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-this.r, 0); ctx.lineTo(this.r, 0);
    ctx.stroke();
    // specular highlight
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(-7, -8, 5, 3, -0.5, 0, Math.PI * 2);
    ctx.fill();

    // face rotates together with the ball, like a decal on its surface
    const lookX = this.lookX * 1.4;
    const lookY = Math.max(-1, Math.min(1, this.vy / 700)) * 1.2;

    if (this.blinking > 0) {
      ctx.strokeStyle = '#2a0808';
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-9, -4); ctx.lineTo(-3, -4);
      ctx.moveTo(3, -4); ctx.lineTo(9, -4);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#2a0808';
      ctx.beginPath();
      ctx.ellipse(-6, -4, 3, 3.8, 0, 0, Math.PI * 2);
      ctx.ellipse(6, -4, 3, 3.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-6 + lookX, -4.5 + lookY, 1.1, 0, Math.PI * 2);
      ctx.arc(6 + lookX, -4.5 + lookY, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = '#2a0808';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 1, 7, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    ctx.restore();
  }
}

// ---- Level definitions ----
// Each builder returns: platforms (static+moving, for collision+draw),
// movingPlatforms (subset needing update), spikes, stars, enemies, bats, flag, levelWidth, start {x,y}

function level1() {
  const platforms = [
    new Platform(0, 460, 300, 80),
    new Platform(360, 460, 140, 80),
    new Platform(560, 400, 120, 40),
    new Platform(740, 460, 200, 80),
    new Platform(1000, 380, 120, 40),
    new Platform(1180, 460, 260, 80),
    new Platform(1500, 320, 100, 40),
    new Platform(1660, 460, 400, 80),
    new Platform(2120, 400, 140, 40),
    new Platform(2320, 460, 500, 80),
  ];
  const stars = [
    new Star(420, 400), new Star(600, 350), new Star(800, 400),
    new Star(1030, 330), new Star(1250, 400), new Star(1520, 270),
    new Star(1750, 400), new Star(2150, 350), new Star(2450, 400),
  ];
  const enemies = [
    new Enemy(780, 460, 34, 70),
    new Enemy(1220, 460, 34, 90),
    new Enemy(1700, 460, 34, 100),
    new Enemy(2360, 460, 34, 100),
  ];
  return {
    platforms, movingPlatforms: [], spikes: [], stars, enemies, bats: [],
    flag: new Flag(2700, 370), levelWidth: 2820, start: { x: 60, y: 400 },
  };
}

function level2() {
  const mp1 = new MovingPlatform(520, 420, 120, 30, 'x', 160, 100);
  const mp2 = new MovingPlatform(1400, 340, 110, 30, 'y', 120, 90);
  const platforms = [
    new Platform(0, 460, 260, 80),
    new Platform(880, 460, 260, 80),
    new Platform(1200, 460, 160, 80),
    new Platform(1660, 460, 150, 80),
    new Platform(1900, 380, 130, 40),
    new Platform(2140, 460, 500, 80),
    mp1, mp2,
  ];
  const spikes = [
    new Spike(880, 434, 90),
    new Spike(1660, 434, 80),
  ];
  const stars = [
    new Star(560, 340), new Star(950, 400), new Star(1280, 400),
    new Star(1450, 260), new Star(1960, 330), new Star(2300, 400), new Star(2500, 400),
  ];
  const enemies = [
    new Enemy(960, 460, 34, 80),
    new Enemy(2250, 460, 34, 120),
  ];
  return {
    platforms, movingPlatforms: [mp1, mp2], spikes, stars, enemies, bats: [],
    flag: new Flag(2560, 370), levelWidth: 2680, start: { x: 60, y: 400 },
  };
}

function level3() {
  const mp1 = new MovingPlatform(700, 420, 110, 30, 'x', 180, 120);
  const platforms = [
    new Platform(0, 460, 260, 80),
    new Platform(1000, 460, 220, 80),
    new Platform(1340, 400, 130, 40),
    new Platform(1600, 460, 200, 80),
    new Platform(1920, 340, 120, 40),
    new Platform(2160, 460, 500, 80),
    mp1,
  ];
  const spikes = [new Spike(1000, 434, 100), new Spike(1600, 434, 90)];
  const stars = [
    new Star(760, 340), new Star(1080, 400), new Star(1400, 340),
    new Star(1680, 400), new Star(1970, 280), new Star(2350, 400), new Star(2550, 400),
  ];
  const bats = [
    new Bat(500, 260, 120, 60, 1.2),
    new Bat(1450, 220, 100, 50, 1.4),
    new Bat(2300, 250, 140, 70, 1.1),
  ];
  const enemies = [new Enemy(1050, 460, 34, 90)];
  return {
    platforms, movingPlatforms: [mp1], spikes, stars, enemies, bats,
    flag: new Flag(2600, 370), levelWidth: 2720, start: { x: 60, y: 400 },
  };
}

function level4() {
  const mp1 = new MovingPlatform(480, 400, 110, 30, 'y', 130, 100);
  const mp2 = new MovingPlatform(1150, 460, 130, 30, 'x', 150, 110);
  const mp3 = new MovingPlatform(2000, 380, 110, 30, 'y', 110, 95);
  const platforms = [
    new Platform(0, 460, 260, 80),
    new Platform(820, 460, 150, 80),
    new Platform(1560, 460, 200, 80),
    new Platform(1860, 400, 100, 40),
    new Platform(2280, 460, 500, 80),
    mp1, mp2, mp3,
  ];
  const spikes = [
    new Spike(820, 434, 80), new Spike(1560, 434, 100), new Spike(2280, 434, 110),
  ];
  const stars = [
    new Star(520, 300), new Star(870, 400), new Star(1210, 340),
    new Star(1610, 400), new Star(1900, 330), new Star(2050, 260), new Star(2450, 400), new Star(2650, 400),
  ];
  const bats = [new Bat(1350, 220, 130, 60, 1.3), new Bat(2500, 240, 120, 60, 1.2)];
  const enemies = [new Enemy(870, 460, 34, 60), new Enemy(2350, 460, 34, 130)];
  return {
    platforms, movingPlatforms: [mp1, mp2, mp3], spikes, stars, enemies, bats,
    flag: new Flag(2720, 370), levelWidth: 2840, start: { x: 60, y: 400 },
  };
}

function level5() {
  const mp1 = new MovingPlatform(560, 380, 100, 30, 'x', 170, 130);
  const mp2 = new MovingPlatform(1250, 320, 100, 30, 'y', 150, 110);
  const mp3 = new MovingPlatform(1850, 420, 130, 30, 'x', 160, 120);
  const platforms = [
    new Platform(0, 460, 240, 80),
    new Platform(900, 460, 140, 80),
    new Platform(1500, 460, 150, 80),
    new Platform(2150, 460, 160, 80),
    new Platform(2450, 460, 500, 80),
    mp1, mp2, mp3,
  ];
  const spikes = [
    new Spike(900, 434, 90), new Spike(1500, 434, 90),
    new Spike(2150, 434, 100), new Spike(2450, 434, 120),
  ];
  const stars = [
    new Star(600, 280), new Star(950, 400), new Star(1300, 220),
    new Star(1550, 400), new Star(1900, 320), new Star(2200, 400), new Star(2620, 400), new Star(2800, 400),
  ];
  const bats = [
    new Bat(750, 250, 140, 70, 1.3), new Bat(1700, 200, 130, 60, 1.5), new Bat(2350, 260, 150, 80, 1.2),
  ];
  const enemies = [new Enemy(950, 460, 34, 40), new Enemy(1550, 460, 34, 50), new Enemy(2600, 460, 34, 140)];
  return {
    platforms, movingPlatforms: [mp1, mp2, mp3], spikes, stars, enemies, bats,
    flag: new Flag(2900, 370), levelWidth: 3020, start: { x: 60, y: 400 },
  };
}

function level6() {
  const mp1 = new MovingPlatform(500, 400, 100, 30, 'y', 140, 130);
  const mp2 = new MovingPlatform(1000, 340, 110, 30, 'x', 160, 140);
  const mp3 = new MovingPlatform(1650, 420, 100, 30, 'y', 130, 120);
  const mp4 = new MovingPlatform(2250, 360, 120, 30, 'x', 170, 130);
  const platforms = [
    new Platform(0, 460, 220, 80),
    new Platform(780, 460, 140, 80),
    new Platform(1350, 460, 150, 80),
    new Platform(1950, 460, 140, 80),
    new Platform(2550, 460, 160, 80),
    new Platform(2850, 460, 550, 80),
    mp1, mp2, mp3, mp4,
  ];
  const spikes = [
    new Spike(780, 434, 90), new Spike(1350, 434, 100),
    new Spike(1950, 434, 90), new Spike(2550, 434, 110), new Spike(2850, 434, 130),
  ];
  const stars = [
    new Star(560, 320), new Star(830, 400), new Star(1060, 260),
    new Star(1400, 400), new Star(1700, 340), new Star(2000, 400),
    new Star(2300, 280), new Star(2620, 400), new Star(3050, 400), new Star(3250, 400),
  ];
  const bats = [
    new Bat(650, 230, 130, 60, 1.4), new Bat(1500, 200, 140, 70, 1.5),
    new Bat(2100, 240, 130, 60, 1.3), new Bat(2750, 220, 150, 80, 1.6),
  ];
  const enemies = [
    new Enemy(830, 460, 34, 50), new Enemy(1400, 460, 34, 60),
    new Enemy(2000, 460, 34, 50), new Enemy(2900, 460, 34, 150),
  ];
  return {
    platforms, movingPlatforms: [mp1, mp2, mp3, mp4], spikes, stars, enemies, bats,
    flag: new Flag(3320, 370), levelWidth: 3440, start: { x: 60, y: 400 },
  };
}

const LEVEL_BUILDERS = [level1, level2, level3, level4, level5, level6];

let level = LEVEL_BUILDERS[0]();
let player = new Player(level.start.x, level.start.y);
let camX = 0;
let score = 0;
let lives = 3;
let levelIndex = 0;
let state = 'start'; // start | playing | transition | win | lose
let transitionTimer = 0;

const overlay = document.getElementById('overlay');
const winScreen = document.getElementById('win-screen');
const loseScreen = document.getElementById('lose-screen');
const scoreVal = document.getElementById('score-val');
const heartIcons = Array.from(document.querySelectorAll('.heart-icon'));
const levelVal = document.getElementById('level-val');

document.getElementById('start-btn').onclick = () => startGame();
document.getElementById('restart-btn').onclick = () => startGame();
document.getElementById('retry-btn').onclick = () => startGame();

const pauseScreen = document.getElementById('pause-screen');
document.getElementById('pause-btn').onclick = () => {
  if (state === 'playing') {
    state = 'paused';
    pauseScreen.classList.remove('hidden');
  }
};
document.getElementById('resume-btn').onclick = () => {
  if (state === 'paused') {
    state = 'playing';
    pauseScreen.classList.add('hidden');
  }
};

function loadLevel(idx) {
  levelIndex = idx;
  level = LEVEL_BUILDERS[levelIndex]();
  player = new Player(level.start.x, level.start.y);
  camX = 0;
  updateHud();
}

function startGame() {
  score = 0;
  lives = 3;
  state = 'playing';
  loadLevel(0);
  overlay.classList.add('hidden');
  winScreen.classList.add('hidden');
  loseScreen.classList.add('hidden');
  pauseScreen.classList.add('hidden');
}

function updateHud() {
  scoreVal.textContent = score;
  heartIcons.forEach((el, i) => el.classList.toggle('lost', i >= lives));
  levelVal.textContent = `${levelIndex + 1}/${LEVEL_BUILDERS.length}`;
}

function respawn() {
  lives -= 1;
  updateHud();
  if (lives <= 0) {
    state = 'lose';
    document.getElementById('lose-score').textContent = `Уровень ${levelIndex + 1}, звёзд собрано: ${score}`;
    loseScreen.classList.remove('hidden');
    return;
  }
  player.x = level.start.x; player.y = level.start.y;
  player.vx = 0; player.vy = 0;
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#6ec6ff');
  grad.addColorStop(0.6, '#9fdcff');
  grad.addColorStop(1, '#e3f7ff');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const sunGlow = ctx.createRadialGradient(800, 120, 10, 800, 120, 100);
  sunGlow.addColorStop(0, 'rgba(255,250,220,0.9)');
  sunGlow.addColorStop(1, 'rgba(255,250,220,0)');
  ctx.fillStyle = sunGlow;
  ctx.beginPath(); ctx.arc(800, 120, 100, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff8d6';
  ctx.beginPath(); ctx.arc(800, 120, 40, 0, Math.PI * 2); ctx.fill();

  for (let i = 0; i < 5; i++) {
    const cx = ((i * 400 - camX * 0.25) % (W + 400) + (W + 400)) % (W + 400) - 100;
    cloud(cx, 60 + (i % 3) * 40);
  }

  drawHillLayer(0.12, 480, 44, '#d4f3ae', '#a3d888');
  drawHut();
  drawHillLayer(0.22, 486, 34, '#9be07f', '#5fae54');
  drawTreeLayer();
  drawBushLayer();
}

function cloud(x, y) {
  ctx.fillStyle = 'rgba(190,215,235,0.55)';
  ctx.beginPath();
  ctx.arc(x, y + 4, 19, 0, Math.PI * 2);
  ctx.arc(x + 22, y - 4, 23, 0, Math.PI * 2);
  ctx.arc(x + 46, y + 4, 19, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.arc(x, y, 20, 0, Math.PI * 2);
  ctx.arc(x + 22, y - 8, 24, 0, Math.PI * 2);
  ctx.arc(x + 46, y, 20, 0, Math.PI * 2);
  ctx.fill();
}

function drawHillLayer(parallax, baseY, amp, colorTop, colorBottom) {
  const shift = camX * parallax;
  const step = 24;
  const pts = [];
  for (let x = 0; x <= W; x += step) {
    pts.push([x, baseY - amp * (0.5 + 0.5 * Math.sin((x + shift) * 0.005))]);
  }

  const grad = ctx.createLinearGradient(0, baseY - amp, 0, H);
  grad.addColorStop(0, colorTop);
  grad.addColorStop(1, colorBottom);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();

  // sunlit ridge line along the crest
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.stroke();
}

function drawTreeLayer() {
  const spacing = 220;
  for (let i = 0; i < 7; i++) {
    const tx = ((i * spacing - camX * 0.35) % (W + spacing) + (W + spacing)) % (W + spacing) - 60;
    tree(tx, 478 + (i % 2) * 8, i);
  }
}

function tree(x, groundY, seed) {
  ctx.fillStyle = '#4a3020';
  ctx.fillRect(x - 3, groundY - 12, 6, 12);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(x, groundY - 12, 3, 12);

  const hueShift = hash1(seed * 7 + 1) * 14 - 7;
  for (let i = 0; i < 3; i++) {
    const w = 32 - i * 7;
    const y = groundY - 12 - i * 13;
    const grad = ctx.createLinearGradient(x - w / 2, y - 20, x + w / 2, y);
    grad.addColorStop(0, `hsl(${128 + hueShift}, 45%, ${26 + i * 3}%)`);
    grad.addColorStop(1, `hsl(${128 + hueShift}, 40%, ${38 + i * 3}%)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y);
    ctx.lineTo(x + w / 2, y);
    ctx.lineTo(x, y - 20);
    ctx.closePath();
    ctx.fill();
  }
}

function drawBushLayer() {
  const spacing = 300;
  for (let i = 0; i < 5; i++) {
    const bx = ((i * spacing - camX * 0.3) % (W + spacing) + (W + spacing)) % (W + spacing) - 80;
    bush(bx, 480 + (i % 2) * 6);
  }
}

function bush(x, groundY) {
  const grad = ctx.createRadialGradient(x - 4, groundY - 18, 2, x, groundY - 10, 20);
  grad.addColorStop(0, '#5fc477');
  grad.addColorStop(1, '#2f7a42');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x - 14, groundY - 8, 12, 0, Math.PI * 2);
  ctx.arc(x, groundY - 14, 15, 0, Math.PI * 2);
  ctx.arc(x + 14, groundY - 8, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  ctx.arc(x + 8, groundY - 4, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.arc(x - 4, groundY - 18, 6, 0, Math.PI * 2);
  ctx.fill();
}

function drawHut() {
  const hx = 1550 - camX * 0.12;
  if (hx < -120 || hx > W + 120) return;
  const gy = 462;
  ctx.fillStyle = '#c9a267';
  ctx.fillRect(hx - 22, gy - 34, 44, 34);
  ctx.fillStyle = '#8a5a3b';
  ctx.beginPath();
  ctx.moveTo(hx - 28, gy - 34);
  ctx.lineTo(hx + 28, gy - 34);
  ctx.lineTo(hx, gy - 58);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#6b3f24';
  ctx.fillRect(hx - 7, gy - 20, 14, 20);
}

let lastTime = performance.now();

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 1 / 30);
  lastTime = now;

  if (state === 'playing') update(dt);
  else if (state === 'transition') updateTransition(dt);
  render();

  requestAnimationFrame(loop);
}

function updateTransition(dt) {
  transitionTimer -= dt;
  for (const mp of level.movingPlatforms) mp.update(dt);
  for (const s of level.stars) s.update(dt);
  if (transitionTimer <= 0) {
    if (levelIndex + 1 < LEVEL_BUILDERS.length) {
      loadLevel(levelIndex + 1);
      state = 'playing';
    } else {
      state = 'win';
      document.getElementById('win-score').textContent = `Все уровни пройдены! Звёзд собрано: ${score}`;
      winScreen.classList.remove('hidden');
    }
  }
}

function update(dt) {
  for (const mp of level.movingPlatforms) mp.update(dt);

  player.update(dt, level.platforms);

  if (player.y - player.r > H + 100) {
    respawn();
    return;
  }

  for (const spike of level.spikes) {
    if (rectsOverlap(player.bounds(), spike.bounds())) {
      respawn();
      return;
    }
  }

  for (const s of level.stars) {
    s.update(dt);
    if (!s.collected && rectsOverlap(player.bounds(), s.bounds())) {
      s.collected = true;
      score += 1;
      updateHud();
    }
  }

  const hazards = [...level.enemies, ...level.bats];
  for (const e of hazards) {
    e.update(dt, level.platforms);
    if (!e.alive) continue;
    const eb = e.bounds();
    if (rectsOverlap(player.bounds(), eb)) {
      const fallingOnTop = player.vy > 0 && (player.y - player.r) < eb.y + eb.h * 0.5;
      if (fallingOnTop) {
        e.kill();
        player.vy = -JUMP_SPEED * 0.6;
        score += 2;
        updateHud();
      } else {
        respawn();
        return;
      }
    }
  }

  if (rectsOverlap(player.bounds(), level.flag.bounds())) {
    state = 'transition';
    transitionTimer = 0.01;
  }

  camX = Math.max(0, Math.min(player.x - W / 2, level.levelWidth - W));
}

function render() {
  drawBackground();

  for (const p of level.platforms) p.draw(camX);
  for (const sp of level.spikes) sp.draw(camX);
  for (const s of level.stars) s.draw(camX);
  for (const e of level.enemies) e.draw(camX);
  for (const b of level.bats) b.draw(camX);
  level.flag.draw(camX);
  player.draw(camX);

  drawVignette();
}

function drawVignette() {
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(10,10,25,0.28)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

requestAnimationFrame(loop);
