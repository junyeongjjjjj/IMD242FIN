const aspectW = 4;
const aspectH = 3;
const container = document.body.querySelector('.container-canvas');

function setup() {
  const { width: containerW, height: containerH } =
    container.getBoundingClientRect();
  if (aspectW === 0 || aspectH === 0) {
    createCanvas(containerW, containerH).parent(container);
  } else if (containerW / containerH > aspectW / aspectH) {
    createCanvas((containerH * aspectW) / aspectH, containerH).parent(
      container
    );
  } else {
    createCanvas(containerW, (containerW * aspectH) / aspectW).parent(
      container
    );
  }
}

function reset() {}

function drawing() {
  background('white');
  circle(mouseX, mouseY, 50);
}

function draw() {
  drawing();
}

function windowResized() {
  const { width: containerW, height: containerH } =
    container.getBoundingClientRect();
  if (aspectW === 0 || aspectH === 0) {
    resizeCanvas(containerW, containerH);
  } else if (containerW / containerH > aspectW / aspectH) {
    resizeCanvas((containerH * aspectW) / aspectH, containerH);
  } else {
    resizeCanvas(containerW, (containerW * aspectH) / aspectW);
  }
  // reset();
  drawing();
}
