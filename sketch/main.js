const PARTICLE_SIZE = 10; // Particle size
const RESOLUTION = 10; // Resolution of the grid
const MAX_FORCE = 100; // Maximum force applied
const MIN_FORCE = 0; // Minimum force applied

const FINGER_TIP_INDICES = [4, 8, 12, 16, 20]; // 손가락 끝 관절 인덱스 (엄지, 검지, 중지, 약지, 새끼)

let hands; // MediaPipe Hands 객체
let faceMesh; // MediaPipe Face Mesh 객체
let camera; // MediaPipe Camera 객체
let videoElement; // 비디오 엘리먼트
let particles = []; // Particle 객체 배열
let handLandmarks = []; // 추적된 모든 손의 관절 데이터
let faceLandmarks = []; // 얼굴 관절 데이터

let asciiFrameSkip = 0; // 아스키 변환을 주기적으로 실행하기 위한 변수
const asciiUpdateRate = 3; // 아스키 변환을 몇 프레임마다 실행할지 설정

let lastGestureTime = 0; // 마지막 제스처 시간
let currentMode = 0; // 0: 아스키 모드, 1: 파티클 모드, 2: 그림 모드
let showFullCamera = false; // 전체 카메라 표시 여부

let drawing = []; // 그림 데이터를 저장할 배열

function preload() {
  console.log('프리로드 완료');
}

function setup() {
  const container = document.body.querySelector('.container-canvas');
  const { width: containerW, height: containerH } =
    container.getBoundingClientRect();

  createCanvas(containerW, containerH).parent(container);

  videoElement = createCapture(VIDEO);
  videoElement.size(64, 48); // 더 낮은 해상도로 비디오 설정
  videoElement.hide();

  hands = new Hands({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });

  hands.setOptions({
    maxNumHands: 4,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  hands.onResults((results) => {
    handLandmarks = results.multiHandLandmarks || [];
  });

  faceMesh = new FaceMesh({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  });

  faceMesh.setOptions({
    maxNumFaces: 2,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  faceMesh.onResults((results) => {
    faceLandmarks = results.multiFaceLandmarks || [];
  });

  camera = new Camera(videoElement.elt, {
    onFrame: async () => {
      await hands.send({ image: videoElement.elt });
      await faceMesh.send({ image: videoElement.elt });
    },
    width: 640,
    height: 480,
  });

  camera.start();

  initParticles(); // Particle 초기화
}

function draw() {
  background(255); // 밝은 중간 회색 배경

  if (asciiFrameSkip % asciiUpdateRate === 0) {
    drawAsciiCamera();
  }
  asciiFrameSkip++;

  drawFingerTips(); // 손가락 끝만 표시

  if (showFullCamera) {
    image(videoElement, 0, 0, width, height);
    return;
  }

  fill(0); // 검은색 텍스트 색상
  textSize(100); // 텍스트 크기
  textAlign(CENTER, CENTER); // 텍스트 정렬

  switch (currentMode) {
    case 0: // 아스키 모드
      drawAsciiCamera(true); // 아스키 모드에서는 빨간색
      // 검은색 텍스트 색상
      fill(255, 0, 0, 255);
      textSize(50); // 텍스트 크기
      textStyle(BOLD);
      text('Open your mouth', width / 2, height / 14);
      textSize(30);
      textStyle(0);
      text('V pose, you can do the next mode.', width / 2, height - 30); // 하단에 텍스트 표시
      break;
    case 1: // 파티클 모드
      drawAsciiCamera(false); // 파티클 모드에서는 원래 색상
      particles.forEach((particle) => {
        particle.update();
        particle.draw();
      });
      fill(0, 0, 0, 255);
      textSize(50); // 텍스트 크기
      textStyle(BOLD);
      text('Move your hands', width / 2, height / 14);
      textSize(30);
      textStyle(0);
      text('V pose, you can do the next mode.', width / 2, height - 30);
      break;
    case 2: // 그림 모드
      drawAsciiCamera(false, [0, 0, 255]); // 그림 모드에서는 원래 색상
      drawDrawingMode();
      fill(0, 0, 255, 255);
      noStroke();
      textSize(50); // 텍스트 크기
      textStyle(BOLD);
      text('Draw freely, erased make a fist', width / 2, height / 14);
      textSize(30);
      textStyle(0);
      text('V pose, you can do the next mode.', width / 2, height - 30);
      break;
  }

  detectVGesture();
}

function initParticles() {
  particles = [];
  for (let i = 0; i < width; i += RESOLUTION) {
    for (let j = 0; j < height; j += RESOLUTION) {
      let x = i + PARTICLE_SIZE / 2;
      let y = j + PARTICLE_SIZE / 2;
      particles.push(new Particle(x, y, [50, 50, 50, 255]));
    }
  }
}

function drawAsciiCamera(isAsciiMode = false) {
  const asciiChars = ['@', '#', '$', '%', '&', '*', '+', '=', '-', '.', ' '];
  const videoScale = 20;

  videoElement.loadPixels();

  textSize(videoScale);
  textAlign(CENTER, CENTER);

  fill(isAsciiMode ? [255, 0, 0] : [50, 50, 50]);

  let mouthCenter = null;
  let mouthRadius = 0;

  if (isAsciiMode && isMouthOpen()) {
    const face = faceLandmarks[0];
    const upperLip = face[13];
    const lowerLip = face[14];

    const upperLipX = upperLip.x * width;
    const upperLipY = upperLip.y * height;
    const lowerLipX = lowerLip.x * width;
    const lowerLipY = lowerLip.y * height;

    mouthCenter = {
      x: (upperLipX + lowerLipX) / 2,
      y: (upperLipY + lowerLipY) / 2,
    };
    mouthRadius = dist(upperLipX, upperLipY, lowerLipX, lowerLipY) * 3;
  }

  for (let y = 0; y < videoElement.height; y += 1) {
    for (let x = 0; x < videoElement.width; x += 1) {
      const index = (x + y * videoElement.width) * 4;
      const r = videoElement.pixels[index];
      const g = videoElement.pixels[index + 1];
      const b = videoElement.pixels[index + 2];

      let brightness = (r + g + b) / 3;
      brightness = map(brightness, 0, 255, 50, 255);

      const charIndex = floor(
        map(brightness, 0, 255, 0, asciiChars.length - 1)
      );
      const asciiChar = asciiChars[charIndex];

      const screenX = (x / videoElement.width) * width;
      const screenY = (y / videoElement.height) * height;

      if (
        isAsciiMode &&
        mouthCenter &&
        dist(screenX, screenY, mouthCenter.x, mouthCenter.y) < mouthRadius
      ) {
        const offsetX = random(-5, 5);
        const offsetY = random(-5, 5);
        textSize(videoScale * 2);
        text(asciiChar, screenX + offsetX, screenY + offsetY);
        textSize(videoScale);
      } else {
        text(asciiChar, screenX, screenY);
      }
    }
  }
}

function drawFingerTips() {
  fill(255, 0, 0);
  noStroke();

  handLandmarks.forEach((hand) => {
    FINGER_TIP_INDICES.forEach((index) => {
      const point = hand[index];
      const x = point.x * width;
      const y = point.y * height;
      ellipse(x, y, 10);
    });
  });
}

function isMouthOpen() {
  if (faceLandmarks.length === 0) return false;

  const face = faceLandmarks[0];
  const upperLip = face[13];
  const lowerLip = face[14];

  const lipDistance = dist(
    upperLip.x * width,
    upperLip.y * height,
    lowerLip.x * width,
    lowerLip.y * height
  );

  return lipDistance > 30;
}

function detectVGesture() {
  if (handLandmarks.length === 0) {
    return;
  }

  const currentTime = millis();

  handLandmarks.forEach((hand) => {
    const isThumbOpen = isFingerOpen(hand, 0);
    const isIndexOpen = isFingerOpen(hand, 1);
    const isMiddleOpen = isFingerOpen(hand, 2);
    const isRingOpen = isFingerOpen(hand, 3);
    const isPinkyOpen = isFingerOpen(hand, 4);

    if (
      isIndexOpen &&
      isMiddleOpen &&
      !isRingOpen &&
      !isPinkyOpen &&
      currentTime - lastGestureTime > 1000
    ) {
      lastGestureTime = currentTime;
      currentMode = (currentMode + 1) % 3;
      console.log(`Mode changed to ${currentMode}`);
    }
  });
}

function isFingerOpen(hand, fingerIndex) {
  const mcpIndex = fingerIndex * 4 + 1;
  const pipIndex = fingerIndex * 4 + 2;
  const tipIndex = fingerIndex * 4 + 3;

  if (!hand[mcpIndex] || !hand[pipIndex] || !hand[tipIndex]) {
    return false;
  }

  const mcp = hand[mcpIndex];
  const pip = hand[pipIndex];
  const tip = hand[tipIndex];

  return tip.y < pip.y && pip.y < mcp.y;
}

function checkHandCollision() {
  if (handLandmarks.length < 2) {
    showFullCamera = false;
    return;
  }

  const handsBoundingBoxes = handLandmarks.map((hand) => {
    let minX = width,
      maxX = 0,
      minY = height,
      maxY = 0;

    hand.forEach((point) => {
      let x = point.x * width;
      let y = point.y * height;

      minX = min(minX, x);
      maxX = max(maxX, x);
      minY = min(minY, y);
      maxY = max(maxY, y);
    });

    return { minX, maxX, minY, maxY };
  });

  const [box1, box2] = handsBoundingBoxes;

  const isOverlapping =
    box1.minX < box2.maxX &&
    box1.maxX > box2.minX &&
    box1.minY < box2.maxY &&
    box1.maxY > box2.minY;

  showFullCamera = isOverlapping;
}

function drawDrawingMode() {
  noFill();
  strokeWeight(5);
  stroke(0, 0, 255);

  if (handLandmarks.length > 0) {
    const hand = handLandmarks[0];
    const indexTip = hand[8];

    if (!indexTip || !hand) return;

    const x = indexTip.x * width;
    const y = indexTip.y * height;

    const isErasing = [0, 1, 2, 3, 4].every(
      (fingerIndex) => !isFingerOpen(hand, fingerIndex)
    );

    if (isErasing) {
      drawing = [];
    } else {
      drawing.push({ x, y });
    }

    for (let i = 1; i < drawing.length; i++) {
      const prev = drawing[i - 1];
      const curr = drawing[i];
      line(prev.x, prev.y, curr.x, curr.y);
    }
  }
}

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.targetX = x;
    this.targetY = y;
    this.asciiChar = random(['@', '#', '$', '%', '&', '*', '+', '.', '-', '=']);
  }

  update() {
    let currentVector = createVector(this.x, this.y);
    let targetVector = createVector(this.targetX, this.targetY);

    let totalForce = createVector(0, 0);

    handLandmarks.forEach((hand) => {
      FINGER_TIP_INDICES.forEach((index) => {
        let { x, y } = hand[index];

        x *= width;
        y *= height;

        let handVector = createVector(x, y);
        let fromHandToParticle = p5.Vector.sub(currentVector, handVector);
        let distanceToHand = fromHandToParticle.mag();

        if (distanceToHand < 100) {
          let repulsionForce = map(
            distanceToHand,
            0,
            100,
            MAX_FORCE,
            MIN_FORCE
          );
          fromHandToParticle.setMag(repulsionForce);
          totalForce.add(fromHandToParticle);
        }
      });
    });

    if (isMouthOpen() && faceLandmarks.length > 0) {
      const face = faceLandmarks[0];
      const upperLip = face[13];
      const lowerLip = face[14];

      const upperLipX = upperLip.x * width;
      const upperLipY = upperLip.y * height;
      const lowerLipX = lowerLip.x * width;
      const lowerLipY = lowerLip.y * height;

      const mouthCenter = {
        x: (upperLipX + lowerLipX) / 2,
        y: (upperLipY + lowerLipY) / 2,
      };

      const mouthRadius = dist(upperLipX, upperLipY, lowerLipX, lowerLipY) * 3;

      const mouthVector = createVector(mouthCenter.x, mouthCenter.y);
      const fromMouthToParticle = p5.Vector.sub(currentVector, mouthVector);
      const distanceToMouth = fromMouthToParticle.mag();

      if (distanceToMouth < mouthRadius) {
        let repulsionForce = map(
          distanceToMouth,
          0,
          mouthRadius,
          MAX_FORCE,
          MIN_FORCE
        );
        fromMouthToParticle.setMag(repulsionForce);
        totalForce.add(fromMouthToParticle);
      }
    }

    let fromParticleToTarget = p5.Vector.sub(targetVector, currentVector);
    let distanceToTarget = fromParticleToTarget.mag();
    if (distanceToTarget > 0) {
      let attractionForce = map(distanceToTarget, 0, 500, MIN_FORCE, MAX_FORCE);
      fromParticleToTarget.setMag(attractionForce);
      totalForce.add(fromParticleToTarget);
    }

    this.x += totalForce.x;
    this.y += totalForce.y;
  }

  draw() {
    fill(50);
    noStroke();
    textSize(PARTICLE_SIZE / 1.5);
    textAlign(CENTER, CENTER);
    text(this.asciiChar, this.x, this.y);
  }
}
