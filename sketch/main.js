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

  // 비디오 엘리먼트 생성
  videoElement = createCapture(VIDEO);
  videoElement.size(64, 48); // 더 낮은 해상도로 비디오 설정
  videoElement.hide();

  // MediaPipe Hands 초기화
  hands = new Hands({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  hands.onResults((results) => {
    handLandmarks = results.multiHandLandmarks || [];
  });

  // MediaPipe Face Mesh 초기화
  faceMesh = new FaceMesh({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  });

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  faceMesh.onResults((results) => {
    faceLandmarks = results.multiFaceLandmarks || [];
  });

  // MediaPipe Camera 초기화
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
  background(200); // 밝은 중간 회색 배경

  if (asciiFrameSkip % asciiUpdateRate === 0) {
    drawAsciiCamera();
  }
  asciiFrameSkip++;

  drawFingerTips(); // 손가락 끝만 표시
  checkHandCollision(); // 두 손 영역이 겹치는지 확인

  if (showFullCamera) {
    image(videoElement, 0, 0, width, height);
    return;
  }

  switch (currentMode) {
    case 0: // 아스키 모드
      drawAsciiCamera(true); // 아스키 모드에서는 빨간색
      break;
    case 1: // 파티클 모드
      drawAsciiCamera(false); // 파티클 모드에서는 원래 색상
      particles.forEach((particle) => {
        particle.update();
        particle.draw();
      });
      break;
    case 2: // 그림 모드
      drawAsciiCamera(false); // 그림 모드에서는 원래 색상
      drawDrawingMode();
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

  // 아스키 모드일 때는 빨간색, 그렇지 않으면 회색
  fill(isAsciiMode ? [255, 0, 0] : [50, 50, 50]);

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

      // 입 벌림 효과 (아스키 모드에서만)
      if (
        isAsciiMode && // 아스키 모드일 때만
        isMouthOpen() &&
        x > videoElement.width / 3 &&
        x < (2 * videoElement.width) / 3 &&
        y > videoElement.height / 3 &&
        y < (2 * videoElement.height) / 3
      ) {
        const offsetX = random(-5, 5); // 흔들림 효과
        const offsetY = random(-5, 5);
        textSize(videoScale * 2); // 확대 효과
        text(
          asciiChar,
          (x / videoElement.width) * width + offsetX,
          (y / videoElement.height) * height + offsetY
        );
        textSize(videoScale); // 원래 크기로 복원
      } else {
        text(
          asciiChar,
          (x / videoElement.width) * width,
          (y / videoElement.height) * height
        );
      }
    }
  }
}

function drawFingerTips() {
  fill(255, 0, 0); // 빨간색 원
  noStroke();

  handLandmarks.forEach((hand) => {
    FINGER_TIP_INDICES.forEach((index) => {
      const point = hand[index];
      const x = point.x * width;
      const y = point.y * height;
      ellipse(x, y, 10); // 손가락 끝에만 원 표시
    });
  });
}

function isMouthOpen() {
  if (faceLandmarks.length === 0) return false;

  const face = faceLandmarks[0];
  const upperLip = face[13]; // 윗입술
  const lowerLip = face[14]; // 아랫입술

  const lipDistance = dist(
    upperLip.x * width,
    upperLip.y * height,
    lowerLip.x * width,
    lowerLip.y * height
  );

  return lipDistance > 30; // 입이 일정 이상 벌어졌는지 확인
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
      currentMode = (currentMode + 1) % 3; // 0, 1, 2 모드 순환
      console.log(`Mode changed to ${currentMode}`);
    }
  });
}

function isFingerOpen(hand, fingerIndex) {
  const mcpIndex = fingerIndex * 4 + 1;
  const pipIndex = fingerIndex * 4 + 2;
  const tipIndex = fingerIndex * 4 + 3;

  if (!hand[mcpIndex] || !hand[pipIndex] || !hand[tipIndex]) {
    return false; // 데이터가 없으면 닫힌 것으로 처리
  }

  const mcp = hand[mcpIndex];
  const pip = hand[pipIndex];
  const tip = hand[tipIndex];

  return tip.y < pip.y && pip.y < mcp.y;
}

function checkHandCollision() {
  if (handLandmarks.length < 2) {
    showFullCamera = false; // 두 손이 없으면 전체 카메라 비활성화
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

  // 충돌 여부 계산
  const isOverlapping =
    box1.minX < box2.maxX &&
    box1.maxX > box2.minX &&
    box1.minY < box2.maxY &&
    box1.maxY > box2.minY;

  showFullCamera = isOverlapping; // 충돌 시 전체 카메라 활성화
}

function drawDrawingMode() {
  noFill();
  stroke(0, 0, 255); // 파란색 선

  if (handLandmarks.length > 0) {
    const hand = handLandmarks[0]; // 첫 번째 손 데이터
    const indexTip = hand[8]; // 검지 끝 좌표

    // 데이터 검증
    if (!indexTip || !hand) return;

    const x = indexTip.x * width; // X 좌표
    const y = indexTip.y * height; // Y 좌표

    // 모든 손가락이 닫힌 상태 확인 (주먹 상태)
    const isErasing = [0, 1, 2, 3, 4].every(
      (fingerIndex) => !isFingerOpen(hand, fingerIndex)
    );

    if (isErasing) {
      // 지우개 기능: 그림 데이터 삭제
      drawing = [];
    } else {
      // 그림 그리기
      drawing.push({ x, y });
    }

    // 저장된 좌표로 그림 그리기
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
