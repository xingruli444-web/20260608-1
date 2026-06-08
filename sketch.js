/**
 * 水果忍者 (Hand Tracking Version)
 * 使用 MediaPipe 追蹤食指尖作為刀刃
 */

let hands;
let camera;
let video;
let canvasElement;
let canvasCtx;

// 遊戲狀態
let score = 0;
let lives = 3;
let isGameOver = false;

// 水果與物理
let fruits = [];
const gravity = 0.15; // 重力加速度
let lastSpawnTime = 0;
const spawnInterval = 1500; // 每 1.5 秒生成一個水果

// 刀芒特效 (追蹤食指尖)
let bladeTrail = [];
const maxTrailLen = 10;
let currentFingerPos = null;

// UI 元素 (沿用原有的部分 ID，或對應新功能)
const statusEl = document.getElementById('status');
const resultModal = document.getElementById('resultModal');
const resultTitle = document.getElementById('resultTitle');
const resultMessage = document.getElementById('resultMessage');
const restartBtn = document.getElementById('restartBtn');
const endScreen = document.getElementById('endScreen');
const endTitle = document.getElementById('endTitle');
const winsCountEl = document.getElementById('winsCount'); // 這裡我們拿來顯示最後得分

function setup() {
  noCanvas(); // 禁用 p5 預設畫布
  initializeMediaPipe();
  gameLoop(); // 啟動遊戲邏輯迴圈
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

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
  } catch (err) {
    alert('相機啟動失敗: ' + err.message);
    return;
  }

  hands = new Hands({
    locateFile: (file) => `<https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}>`,
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

  camera.start();
  video.onloadedmetadata = resizeCanvas;
  window.addEventListener('resize', resizeCanvas);
}

/**
 * MediaPipe 結果處理：更新刀刃位置與碰撞偵測
 */
function onHandsResults(results) {
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];
    
    // 追蹤食指指尖 (Landmark 8)
    const tip = landmarks[8];
    // 考慮到自拍鏡頭，左右 X 軸需翻轉 (1 - tip.x)
    const tx = (1 - tip.x) * canvasElement.width;
    const ty = tip.y * canvasElement.height;
    
    currentFingerPos = { x: tx, y: ty };

    // 更新刀芒軌跡
    bladeTrail.push({ x: tx, y: ty });
    if (bladeTrail.length > maxTrailLen) {
      bladeTrail.shift();
    }

    // 碰撞偵測：檢查是否切到水果
    if (!isGameOver) {
      checkCollisions(tx, ty);
    }
  } else {
    currentFingerPos = null;
    bladeTrail = [];
  }
}

/**
 * 生成水果
 */
function spawnFruit() {
  const x = Math.random() * (canvasElement.width - 100) + 50;
  const y = canvasElement.height;
  const vx = (Math.random() - 0.5) * 4; // 隨機水平速度
  const vy = -(Math.random() * 5 + 10); // 隨機向上初速度
  const colors = ['#FF4D4D', '#FFD700', '#ADFF2F', '#FFA500', '#FF69B4'];
  
  fruits.push({
    x: x,
    y: y,
    vx: vx,
    vy: vy,
    radius: 35,
    color: colors[Math.floor(Math.random() * colors.length)],
    isSliced: false
  });
}

/**
 * 碰撞偵測邏輯
 */
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

/**
 * 遊戲主迴圈 (處理物理、繪圖與 UI)
 */
function gameLoop() {
  if (!isGameOver) {
    updatePhysics();
  }
  drawScene();
  requestAnimationFrame(gameLoop);
}

/**
 * 更新物理位置
 */
function updatePhysics() {
  const now = Date.now();
  if (now - lastSpawnTime > spawnInterval) {
    spawnFruit();
    lastSpawnTime = now;
  }

  for (let i = fruits.length - 1; i >= 0; i--) {
    let f = fruits[i];
    f.x += f.vx;
    f.y += f.vy;
    f.vy += gravity; // 模擬重力

    // 檢查是否掉出畫面
    if (f.y > canvasElement.height + 50) {
      if (!f.isSliced) {
        lives--;
        if (lives <= 0) {
          triggerGameOver();
        }
      }
      fruits.splice(i, 1);
    }
  }
}

/**
 * 繪製畫面
 */
function drawScene() {
  if (!canvasCtx) return;

  // 1. 清除畫布 (保留 video 內容，只重繪特效)
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  // 2. 繪製水果
  fruits.forEach(f => {
    canvasCtx.fillStyle = f.color;
    canvasCtx.beginPath();
    if (!f.isSliced) {
      canvasCtx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
      canvasCtx.fill();
    } else {
      // 已切開的水果：畫成兩個半圓
      canvasCtx.arc(f.x - 5, f.y, f.radius, Math.PI * 0.5, Math.PI * 1.5);
      canvasCtx.fill();
      canvasCtx.beginPath();
      canvasCtx.arc(f.x + 5, f.y, f.radius, Math.PI * 1.5, Math.PI * 0.5);
      canvasCtx.fill();
    }
  });

  // 3. 繪製刀芒特效 (發光線段)
  if (bladeTrail.length > 1) {
    canvasCtx.beginPath();
    canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    canvasCtx.lineWidth = 5;
    canvasCtx.lineCap = 'round';
    canvasCtx.shadowBlur = 15;
    canvasCtx.shadowColor = '#00FFFF';
    
    canvasCtx.moveTo(bladeTrail[0].x, bladeTrail[0].y);
    for (let i = 1; i < bladeTrail.length; i++) {
      canvasCtx.lineTo(bladeTrail[i].x, bladeTrail[i].y);
    }
    canvasCtx.stroke();
    canvasCtx.shadowBlur = 0; // 重置陰影避免影響其他繪圖
  }

  // 4. 繪製上方 UI
  drawUI();
}

/**
 * 在畫布上顯示分數與生命值
 */
function drawUI() {
  canvasCtx.fillStyle = '#FFFFFF';
  canvasCtx.font = 'bold 24px Arial';
  canvasCtx.textAlign = 'left';
  canvasCtx.fillText(`分數: ${score}`, 20, 40);

  canvasCtx.textAlign = 'right';
  let hearts = '';
  for (let i = 0; i < 3; i++) {
    hearts += i < Math.max(0, lives) ? '❤️ ' : '🖤 ';
  }
  canvasCtx.fillText(hearts, canvasElement.width - 20, 40);
}

function updateStatus(msg) {
  statusEl.textContent = msg;
}

function triggerGameOver() {
  isGameOver = true;
  showEndScreen(score);
}

function showEndScreen(finalScore) {
  endTitle.textContent = '遊戲結束！';
  const scoreLabel = document.querySelector('#winsCount')?.previousElementSibling;
  if (scoreLabel) {
    scoreLabel.textContent = '最終得分';
  }
  winsCountEl.textContent = finalScore; // 顯示最終得分

  document.querySelectorAll('#endScreen .score-card').forEach((card, index) => {
    if (index > 0) {
      card.style.display = 'none';
    }
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

// 監聽重新開始按鈕
const playAgainBtn_custom = document.getElementById('playAgainBtn');
if (playAgainBtn_custom) {
  playAgainBtn_custom.addEventListener('click', resetGame);
}

// 原始代碼中可能有的其他 UI 事件監聽
if (restartBtn) restartBtn.addEventListener('click', resetGame);
