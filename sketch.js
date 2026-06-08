/**
 * 水果忍者 (Hand Tracking Version)
 * 使用 MediaPipe 追蹤食指指尖作為刀刃
 */

let hands;
let camera;
let video;
let canvasElement;
let canvasCtx;

let score = 0;
let lives = 3;
let isGameOver = false;

let fruits = [];
const gravity = 0.15;
let lastSpawnTime = 0;
const spawnInterval = 1500;

let bladeTrail = [];
const maxTrailLen = 10;
let currentFingerPos = null;

const statusEl = document.getElementById('status');
const endScreen = document.getElementById('endScreen');
const endTitle = document.getElementById('endTitle');
const winsCountEl = document.getElementById('winsCount');
const playAgainBtn = document.getElementById('playAgainBtn');

function setup() {
  noCanvas();
  initializeMediaPipe();
  gameLoop();
}

async function initializeMediaPipe() {
  video = document.getElementById('video');
  canvasElement = document.getElementById('canvas');
  canvasCtx = canvasElement.getContext('2d');

  const resizeCanvas = () => {
    if (video.videoWidth && video.videoHeight) {
      canvasElement.width = video.videoWidth;
      canvasElement.height = video.videoHeight;
    }
  };

  video.playsInline = true;
  video.muted = true;
  video.addEventListener('loadedmetadata', resizeCanvas);

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    resizeCanvas();
    updateStatus('相機已啟動，請移動手部');
  } catch (err) {
    alert('相機啟動失敗: ' + err.message);
    updateStatus('相機初始化失敗');
    return;
  }

  hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7,
  });

  hands.onResults(onHandsResults);

  camera = new Camera(video, {
    onFrame: async () => {
      await hands.send({ image: video });
    },
    width: 640,
    height: 480,
  });

  camera.start().catch((err) => {
    alert('相機啟動失敗: ' + err.message);
    updateStatus('相機啟動失敗');
  });

  video.onloadedmetadata = resizeCanvas;
  window.addEventListener('resize', resizeCanvas);
  updateStatus('準備就緒，請開始切水果！');
}

function onHandsResults(results) {
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];
    const tip = landmarks[8];
    const tx = (1 - tip.x) * canvasElement.width;
    const ty = tip.y * canvasElement.height;

    currentFingerPos = { x: tx, y: ty };
    bladeTrail.push({ x: tx, y: ty });
    if (bladeTrail.length > maxTrailLen) {
      bladeTrail.shift();
    }

    updateStatus('偵測到手部，請移動食指切水果');

    if (!isGameOver) {
      checkCollisions(tx, ty);
    }
  } else {
    currentFingerPos = null;
    bladeTrail = [];
    updateStatus('未偵測到手部');
  }
}

function spawnFruit() {
  if (!canvasElement.width || !canvasElement.height) {
    return;
  }

  const x = Math.random() * (canvasElement.width - 80) + 40;
  const y = canvasElement.height + 30;
  const vx = (Math.random() - 0.5) * 4;
  const vy = -(Math.random() * 6 + 10);
  const radius = Math.random() * 10 + 30;
  const colors = ['#FF4D4D', '#FFD700', '#ADFF2F', '#FFA500', '#FF69B4', '#8A2BE2'];

  fruits.push({
    x,
    y,
    vx,
    vy,
    radius,
    color: colors[Math.floor(Math.random() * colors.length)],
    isSliced: false,
  });
}

function checkCollisions(tx, ty) {
  for (let fruit of fruits) {
    if (!fruit.isSliced) {
      const dist = Math.hypot(fruit.x - tx, fruit.y - ty);
      if (dist < fruit.radius) {
        fruit.isSliced = true;
        score += 10;
        updateStatus(`切中了！目前分數：${score}`);
      }
    }
  }
}

function gameLoop() {
  if (!isGameOver) {
    updatePhysics();
  }
  drawScene();
  requestAnimationFrame(gameLoop);
}

function updatePhysics() {
  const now = Date.now();
  if (now - lastSpawnTime > spawnInterval) {
    spawnFruit();
    lastSpawnTime = now;
  }

  for (let i = fruits.length - 1; i >= 0; i--) {
    const fruit = fruits[i];
    fruit.x += fruit.vx;
    fruit.y += fruit.vy;
    fruit.vy += gravity;

    if (fruit.y > canvasElement.height + fruit.radius) {
      if (!fruit.isSliced) {
        lives -= 1;
        if (lives <= 0) {
          triggerGameOver();
        }
      }
      fruits.splice(i, 1);
    }
  }
}

function drawScene() {
  if (!canvasCtx) return;

  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  fruits.forEach((fruit) => {
    if (!fruit.isSliced) {
      canvasCtx.fillStyle = fruit.color;
      canvasCtx.beginPath();
      canvasCtx.arc(fruit.x, fruit.y, fruit.radius, 0, Math.PI * 2);
      canvasCtx.fill();
    } else {
      canvasCtx.fillStyle = fruit.color;
      canvasCtx.beginPath();
      canvasCtx.arc(fruit.x - fruit.radius * 0.4, fruit.y, fruit.radius * 0.8, Math.PI * 0.5, Math.PI * 1.5);
      canvasCtx.fill();
      canvasCtx.beginPath();
      canvasCtx.arc(fruit.x + fruit.radius * 0.4, fruit.y, fruit.radius * 0.8, Math.PI * 1.5, Math.PI * 0.5);
      canvasCtx.fill();
      canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      canvasCtx.beginPath();
      canvasCtx.arc(fruit.x - fruit.radius * 0.4, fruit.y - fruit.radius * 0.2, fruit.radius * 0.2, 0, Math.PI * 2);
      canvasCtx.fill();
      canvasCtx.beginPath();
      canvasCtx.arc(fruit.x + fruit.radius * 0.4, fruit.y - fruit.radius * 0.2, fruit.radius * 0.2, 0, Math.PI * 2);
      canvasCtx.fill();
    }
  });

  if (bladeTrail.length > 1) {
    canvasCtx.save();
    canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    canvasCtx.lineWidth = 6;
    canvasCtx.lineCap = 'round';
    canvasCtx.shadowBlur = 20;
    canvasCtx.shadowColor = '#00FFFF';
    canvasCtx.beginPath();
    canvasCtx.moveTo(bladeTrail[0].x, bladeTrail[0].y);
    for (let i = 1; i < bladeTrail.length; i++) {
      canvasCtx.lineTo(bladeTrail[i].x, bladeTrail[i].y);
    }
    canvasCtx.stroke();
    canvasCtx.restore();
  }

  if (currentFingerPos) {
    canvasCtx.save();
    canvasCtx.fillStyle = 'rgba(0, 255, 255, 0.9)';
    canvasCtx.beginPath();
    canvasCtx.arc(currentFingerPos.x, currentFingerPos.y, 8, 0, Math.PI * 2);
    canvasCtx.fill();
    canvasCtx.restore();
  }

  drawUI();
}

function drawUI() {
  canvasCtx.fillStyle = '#FFFFFF';
  canvasCtx.font = 'bold 24px Arial';
  canvasCtx.textAlign = 'left';
  canvasCtx.fillText(`得分: ${score}`, 20, 40);

  canvasCtx.textAlign = 'right';
  let hearts = '';
  for (let i = 0; i < 3; i++) {
    hearts += i < Math.max(0, lives) ? '❤️ ' : '🖤 ';
  }
  canvasCtx.fillText(hearts, canvasElement.width - 20, 40);
}

function updateStatus(message) {
  if (statusEl) {
    statusEl.textContent = message;
  }
}

function triggerGameOver() {
  if (isGameOver) return;
  isGameOver = true;
  showEndScreen(score);
}

function showEndScreen(finalScore) {
  endTitle.textContent = '遊戲結束！';
  winsCountEl.textContent = finalScore;

  document.querySelectorAll('#endScreen .score-card').forEach((card, index) => {
    card.style.display = index === 0 ? 'flex' : 'none';
  });

  endScreen.classList.remove('hidden');
}

function resetGame() {
  score = 0;
  lives = 3;
  fruits = [];
  bladeTrail = [];
  isGameOver = false;
  endScreen.classList.add('hidden');
  updateStatus('準備就緒，請開始切水果！');
}

if (playAgainBtn) {
  playAgainBtn.addEventListener('click', resetGame);
}
