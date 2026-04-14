const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const statusText = document.getElementById("statusText");
const resetButton = document.getElementById("resetButton");

const scoreNodes = [
  document.querySelector('[data-score="0"]'),
  document.querySelector('[data-score="1"]'),
];

const playerCards = [
  document.querySelector('[data-player-card="0"]'),
  document.querySelector('[data-player-card="1"]'),
];

const table = {
  x: 90,
  y: 70,
  width: 920,
  height: 500,
  rail: 28,
  pocketRadius: 28,
};

const innerBounds = {
  left: table.x + table.rail,
  right: table.x + table.width - table.rail,
  top: table.y + table.rail,
  bottom: table.y + table.height - table.rail,
};

const friction = 0.99;
const stopThreshold = 0.04;
const maxShotPower = 25;
const winScore = 4;
const cueBallStart = {
  x: table.x + table.width * 0.24,
  y: table.y + table.height / 2,
};

const pockets = [
  { x: table.x + 6, y: table.y + 6 },
  { x: table.x + table.width / 2, y: table.y + 2 },
  { x: table.x + table.width - 6, y: table.y + 6 },
  { x: table.x + 6, y: table.y + table.height - 6 },
  { x: table.x + table.width / 2, y: table.y + table.height - 2 },
  { x: table.x + table.width - 6, y: table.y + table.height - 6 },
];

const objectBallColors = [
  "#f4d35e",
  "#ee964b",
  "#f95738",
  "#6ca6c1",
  "#7c5cff",
  "#ff7fb0",
];

let balls = [];
let cueBall = null;
let currentPlayer = 0;
let scores = [0, 0];
let aiming = false;
let aimPointer = null;
let shotInProgress = false;
let pocketedThisTurn = false;
let cueFoul = false;
let gameOver = false;
let cueFlash = 0;
let cueDirection = { x: 1, y: 0 };
let lastShotPower = 0;
let pocketEffects = [];

function createBall(x, y, radius, color, label, isCue = false) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    radius,
    color,
    label,
    isCue,
    active: true,
  };
}

function setStatus(message) {
  statusText.textContent = message;
}

function updateScoreboard() {
  scoreNodes.forEach((node, index) => {
    node.textContent = String(scores[index]);
  });

  playerCards.forEach((card, index) => {
    card.classList.toggle("active", !gameOver && index === currentPlayer);
  });
}

function rackBalls() {
  const radius = 13;
  balls = [];
  cueBall = createBall(cueBallStart.x, cueBallStart.y, radius, "#ffffff", "", true);
  balls.push(cueBall);

  const rackX = table.x + table.width * 0.72;
  const rackY = table.y + table.height / 2;
  let ballNumber = 1;

  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col <= row; col += 1) {
      const x = rackX + row * 23;
      const y = rackY + (col - row / 2) * 30;
      const color = objectBallColors[(ballNumber - 1) % objectBallColors.length];
      balls.push(createBall(x, y, radius, color, String(ballNumber)));
      ballNumber += 1;
    }
  }
}

function resetGame() {
  currentPlayer = 0;
  scores = [0, 0];
  aiming = false;
  aimPointer = null;
  shotInProgress = false;
  pocketedThisTurn = false;
  cueFoul = false;
  gameOver = false;
  cueFlash = 0;
  cueDirection = { x: 1, y: 0 };
  lastShotPower = 0;
  pocketEffects = [];
  rackBalls();
  updateScoreboard();
  setStatus("玩家 1 回合：按住白球后方拖动，松开即可出杆。");
}

function anyBallsMoving() {
  return balls.some(
    (ball) => ball.active && (Math.abs(ball.vx) > stopThreshold || Math.abs(ball.vy) > stopThreshold),
  );
}

function allObjectBallsPocketed() {
  return balls.every((ball) => ball.isCue || !ball.active);
}

function respawnCueBall() {
  cueBall.active = true;
  cueBall.x = cueBallStart.x;
  cueBall.y = cueBallStart.y;
  cueBall.vx = 0;
  cueBall.vy = 0;
}

function switchTurn(reason) {
  currentPlayer = currentPlayer === 0 ? 1 : 0;
  updateScoreboard();
  setStatus(`玩家 ${currentPlayer + 1} 回合：${reason}`);
}

function endMatch() {
  gameOver = true;
  updateScoreboard();

  if (scores[0] === scores[1]) {
    setStatus("比赛结束：平局。点击“重新开始”再来一局。");
    return;
  }

  const winner = scores[0] > scores[1] ? 0 : 1;
  playerCards[winner].classList.add("active");
  setStatus(`比赛结束：玩家 ${winner + 1} 获胜，最终比分 ${scores[0]} : ${scores[1]}。`);
}

function finishTurn() {
  shotInProgress = false;

  if (gameOver) {
    return;
  }

  if (allObjectBallsPocketed() || scores[currentPlayer] >= winScore) {
    endMatch();
    return;
  }

  if (cueFoul) {
    cueFoul = false;
    respawnCueBall();
    switchTurn("白球已重置，对手上场。");
    return;
  }

  if (pocketedThisTurn) {
    pocketedThisTurn = false;
    updateScoreboard();
    setStatus(`玩家 ${currentPlayer + 1} 继续出杆：这一杆有进球。`);
    return;
  }

  switchTurn("这一杆没有进球，轮到你了。");
}

function clampShot(dx, dy) {
  const dragLength = Math.hypot(dx, dy);
  if (dragLength === 0) {
    return { x: 0, y: 0, power: 0 };
  }

  const power = Math.min(dragLength / 6, maxShotPower);
  return {
    x: (dx / dragLength) * power,
    y: (dy / dragLength) * power,
    power,
  };
}

function spawnPocketEffect(ball, pocket, isCueBall) {
  pocketEffects.push({
    x: pocket.x,
    y: pocket.y,
    color: isCueBall ? "255,255,255" : hexToRgb(ball.color),
    life: 1,
    ring: ball.radius + 6,
    sparkleCount: isCueBall ? 8 : 14,
  });
}

function shoot() {
  if (!aiming || !aimPointer || gameOver) {
    return;
  }

  const dx = cueBall.x - aimPointer.x;
  const dy = cueBall.y - aimPointer.y;
  const impulse = clampShot(dx, dy);

  if (impulse.power < 0.5) {
    aiming = false;
    aimPointer = null;
    setStatus(`玩家 ${currentPlayer + 1} 取消了这次出杆。`);
    return;
  }

  cueBall.vx = impulse.x;
  cueBall.vy = impulse.y;
  cueDirection = normalizeVector(impulse.x, impulse.y);
  cueFlash = 1;
  lastShotPower = impulse.power;
  aiming = false;
  aimPointer = null;
  shotInProgress = true;
  pocketedThisTurn = false;
  cueFoul = false;
  setStatus(`玩家 ${currentPlayer + 1} 出杆中...`);
}

function findPocket(ball) {
  return pockets.find((pocket) => Math.hypot(ball.x - pocket.x, ball.y - pocket.y) <= table.pocketRadius - 2);
}

function applyPocket(ball, pocket) {
  ball.vx = 0;
  ball.vy = 0;
  ball.active = false;
  spawnPocketEffect(ball, pocket, ball.isCue);

  if (ball.isCue) {
    cueFoul = true;
    setStatus(`玩家 ${currentPlayer + 1} 白球落袋，回合失误。`);
    return;
  }

  scores[currentPlayer] += 1;
  pocketedThisTurn = true;
  cueFlash = 1;
  updateScoreboard();
  setStatus(`玩家 ${currentPlayer + 1} 进球得分，球杆闪光。`);
}

function isNearTopOpening(ball) {
  const centerGap = Math.abs(ball.x - (table.x + table.width / 2)) < 46;
  const leftGap = ball.x < table.x + 42;
  const rightGap = ball.x > table.x + table.width - 42;
  return centerGap || leftGap || rightGap;
}

function isNearLeftOrRightCorner(ball) {
  return ball.y < table.y + 42 || ball.y > table.y + table.height - 42;
}

function updateBall(ball) {
  if (!ball.active) {
    return;
  }

  ball.x += ball.vx;
  ball.y += ball.vy;
  ball.vx *= friction;
  ball.vy *= friction;

  if (Math.abs(ball.vx) < stopThreshold) {
    ball.vx = 0;
  }

  if (Math.abs(ball.vy) < stopThreshold) {
    ball.vy = 0;
  }

  const pocket = findPocket(ball);
  if (pocket) {
    applyPocket(ball, pocket);
    return;
  }

  const leftLimit = innerBounds.left + ball.radius;
  const rightLimit = innerBounds.right - ball.radius;
  const topLimit = innerBounds.top + ball.radius;
  const bottomLimit = innerBounds.bottom - ball.radius;

  if (ball.x < leftLimit && !isNearLeftOrRightCorner(ball)) {
    ball.x = leftLimit;
    ball.vx *= -0.95;
  } else if (ball.x > rightLimit && !isNearLeftOrRightCorner(ball)) {
    ball.x = rightLimit;
    ball.vx *= -0.95;
  }

  if (ball.y < topLimit && !isNearTopOpening(ball)) {
    ball.y = topLimit;
    ball.vy *= -0.95;
  } else if (ball.y > bottomLimit && !isNearTopOpening(ball)) {
    ball.y = bottomLimit;
    ball.vy *= -0.95;
  }
}

function resolveCollision(a, b) {
  if (!a.active || !b.active) {
    return;
  }

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy);
  const minDistance = a.radius + b.radius;

  if (distance === 0 || distance >= minDistance) {
    return;
  }

  const nx = dx / distance;
  const ny = dy / distance;
  const overlap = minDistance - distance;

  a.x -= nx * overlap * 0.5;
  a.y -= ny * overlap * 0.5;
  b.x += nx * overlap * 0.5;
  b.y += ny * overlap * 0.5;

  const relVelX = b.vx - a.vx;
  const relVelY = b.vy - a.vy;
  const speedAlongNormal = relVelX * nx + relVelY * ny;

  if (speedAlongNormal > 0) {
    return;
  }

  const impulse = -speedAlongNormal;
  a.vx -= impulse * nx;
  a.vy -= impulse * ny;
  b.vx += impulse * nx;
  b.vy += impulse * ny;
}

function updateEffects() {
  cueFlash = Math.max(0, cueFlash - 0.05);
  pocketEffects = pocketEffects
    .map((effect) => ({
      ...effect,
      life: effect.life - 0.03,
      ring: effect.ring + 2.6,
    }))
    .filter((effect) => effect.life > 0);
}

function updatePhysics() {
  updateEffects();

  for (const ball of balls) {
    updateBall(ball);
  }

  for (let i = 0; i < balls.length; i += 1) {
    for (let j = i + 1; j < balls.length; j += 1) {
      resolveCollision(balls[i], balls[j]);
    }
  }

  if (shotInProgress && !anyBallsMoving()) {
    finishTurn();
  }
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function drawTable() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#4f3118";
  roundRect(ctx, table.x - 18, table.y - 18, table.width + 36, table.height + 36, 34);
  ctx.fill();

  ctx.fillStyle = "#82502a";
  roundRect(ctx, table.x - 6, table.y - 6, table.width + 12, table.height + 12, 28);
  ctx.fill();

  ctx.fillStyle = "#19724d";
  roundRect(ctx, table.x, table.y, table.width, table.height, 20);
  ctx.fill();

  const shine = ctx.createLinearGradient(table.x, table.y, table.x + table.width, table.y + table.height);
  shine.addColorStop(0, "rgba(255,255,255,0.08)");
  shine.addColorStop(0.4, "rgba(255,255,255,0)");
  shine.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.fillStyle = shine;
  roundRect(ctx, table.x, table.y, table.width, table.height, 20);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(table.x + table.width * 0.25, table.y + table.height / 2, 70, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(table.x + table.width * 0.25, table.y + 36);
  ctx.lineTo(table.x + table.width * 0.25, table.y + table.height - 36);
  ctx.stroke();

  for (const pocket of pockets) {
    const glow = ctx.createRadialGradient(pocket.x, pocket.y, 2, pocket.x, pocket.y, table.pocketRadius + 14);
    glow.addColorStop(0, "rgba(255,230,150,0.25)");
    glow.addColorStop(1, "rgba(8,18,15,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(pocket.x, pocket.y, table.pocketRadius + 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#08120f";
    ctx.beginPath();
    ctx.arc(pocket.x, pocket.y, table.pocketRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPocketEffects() {
  for (const effect of pocketEffects) {
    ctx.save();
    ctx.strokeStyle = `rgba(${effect.color}, ${effect.life * 0.9})`;
    ctx.lineWidth = 3 + effect.life * 4;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, effect.ring, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < effect.sparkleCount; i += 1) {
      const angle = (Math.PI * 2 * i) / effect.sparkleCount;
      const length = 16 + (1 - effect.life) * 32;
      const inner = effect.ring * 0.45;
      const outer = inner + length * effect.life;
      ctx.strokeStyle = `rgba(${effect.color}, ${effect.life})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(effect.x + Math.cos(angle) * inner, effect.y + Math.sin(angle) * inner);
      ctx.lineTo(effect.x + Math.cos(angle) * outer, effect.y + Math.sin(angle) * outer);
      ctx.stroke();
    }

    ctx.restore();
  }
}

function drawBall(ball) {
  if (!ball.active) {
    return;
  }

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.28)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 6;

  ctx.fillStyle = ball.color;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.stroke();

  if (!ball.isCue) {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius * 0.44, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1b1b1b";
    ctx.font = "bold 11px Segoe UI";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ball.label, ball.x, ball.y + 0.5);
  }
}

function drawCueAndGuide() {
  const hasCue = (aiming && aimPointer && cueBall.active) || (cueFlash > 0.02 && cueBall.active);
  if (!hasCue) {
    return;
  }

  let nx = cueDirection.x;
  let ny = cueDirection.y;
  let power = Math.max(8, lastShotPower);

  if (aiming && aimPointer) {
    const dragX = cueBall.x - aimPointer.x;
    const dragY = cueBall.y - aimPointer.y;
    const dragLength = Math.hypot(dragX, dragY);

    if (dragLength < 1) {
      return;
    }

    nx = dragX / dragLength;
    ny = dragY / dragLength;
    power = Math.min(dragLength / 6, maxShotPower);
  }

  const aimLineLength = 170 + power * 5;
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = `rgba(255,255,255,${aiming ? 0.5 : cueFlash * 0.55})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cueBall.x, cueBall.y);
  ctx.lineTo(cueBall.x + nx * aimLineLength, cueBall.y + ny * aimLineLength);
  ctx.stroke();
  ctx.restore();

  const flashPush = cueFlash * 28;
  const cueOffset = 30 + power * 1.7 + flashPush;
  const cueStartX = cueBall.x - nx * cueOffset;
  const cueStartY = cueBall.y - ny * cueOffset;
  const cueEndX = cueStartX - nx * 220;
  const cueEndY = cueStartY - ny * 220;

  ctx.save();
  const glowAlpha = aiming ? 0.22 : cueFlash * 0.9;
  ctx.shadowColor = `rgba(255, 223, 130, ${glowAlpha})`;
  ctx.shadowBlur = 12 + cueFlash * 28;
  ctx.lineCap = "round";

  const cueGradient = ctx.createLinearGradient(cueStartX, cueStartY, cueEndX, cueEndY);
  cueGradient.addColorStop(0, "#f8e5b4");
  cueGradient.addColorStop(0.3, "#ddb574");
  cueGradient.addColorStop(1, "#7a522d");

  ctx.strokeStyle = cueGradient;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(cueStartX, cueStartY);
  ctx.lineTo(cueEndX, cueEndY);
  ctx.stroke();

  ctx.strokeStyle = "#f4f0d5";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cueStartX + nx * 8, cueStartY + ny * 8);
  ctx.lineTo(cueStartX - nx * 16, cueStartY - ny * 16);
  ctx.stroke();

  ctx.strokeStyle = `rgba(255, 238, 180, ${cueFlash * 0.95})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cueStartX, cueStartY);
  ctx.lineTo(cueEndX, cueEndY);
  ctx.stroke();
  ctx.restore();

  const meterX = table.x + 28;
  const meterY = table.y + table.height + 26;
  const meterGradient = ctx.createLinearGradient(meterX, meterY, meterX + maxShotPower * 10, meterY);
  meterGradient.addColorStop(0, "#ffe28a");
  meterGradient.addColorStop(1, "#ff9466");
  ctx.fillStyle = meterGradient;
  ctx.fillRect(meterX, meterY, power * 10, 12);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.strokeRect(meterX, meterY, maxShotPower * 10, 12);
}

function render() {
  updatePhysics();
  drawTable();
  drawPocketEffects();
  drawCueAndGuide();
  balls.forEach(drawBall);
  requestAnimationFrame(render);
}

function normalizeVector(x, y) {
  const length = Math.hypot(x, y);
  if (length === 0) {
    return { x: 1, y: 0 };
  }

  return { x: x / length, y: y / length };
}

function hexToRgb(hexColor) {
  const sanitized = hexColor.replace("#", "");
  const full = sanitized.length === 3
    ? sanitized.split("").map((char) => char + char).join("")
    : sanitized;
  const value = Number.parseInt(full, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `${r},${g},${b}`;
}

function getPointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

canvas.addEventListener("pointerdown", (event) => {
  if (gameOver || anyBallsMoving() || !cueBall.active) {
    return;
  }

  const position = getPointerPosition(event);
  const distance = Math.hypot(position.x - cueBall.x, position.y - cueBall.y);

  if (distance <= 110) {
    aiming = true;
    aimPointer = position;
    setStatus(`玩家 ${currentPlayer + 1} 瞄准中：往后拉球杆，松开出杆。`);
  }
});

canvas.addEventListener("pointermove", (event) => {
  if (!aiming) {
    return;
  }

  aimPointer = getPointerPosition(event);
});

function cancelAim() {
  aiming = false;
  aimPointer = null;
}

canvas.addEventListener("pointerup", () => {
  if (aiming) {
    shoot();
  }
});

canvas.addEventListener("pointerleave", () => {
  if (aiming) {
    cancelAim();
    setStatus(`玩家 ${currentPlayer + 1} 已取消瞄准。`);
  }
});

resetButton.addEventListener("click", resetGame);

resetGame();
render();
