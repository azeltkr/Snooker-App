//  Physics engine using Matter.js
let engine;

// Fixed table dimensions
const TABLE_WIDTH = 1200;
const TABLE_HEIGHT = 600;

// Variables for canvas and table layout
let canvasWidth, canvasHeight;
let tableX, tableY;
let pocketRadius, ballRadius, tableFrameThickness;
let baulkLineX, dZoneCenter, dZoneRadius;
let varianceX, varianceY;

// Message area for feedback
let currentMessage = ""; // Displays dynamic messages

// Boundaries for table cushions
let boundaries = [];

// Keep track of the last ball type potted
let lastPottedBallType = null;

// Checkbox for "Red Light, Green Light" mode
let redLightGreenLightCheckbox;

// State for "Red Light, Green Light" feature
let isRedLightGreenLightEnabled = false; // Is the feature active?
let gameState = "greenLight"; // Initial light state
let lightToggleTimer; // Timer to manage light changes
let lightDuration = 3000; // How long each light state lasts (in ms)
let greenLightAudio, redLightAudio;

//  Cue Ball and container settings
let cueBall;
let cueBallContainerX,
  cueBallContainerY,
  cueBallContainerWidth,
  cueBallContainerHeight;
let isCueBallPlaced = false; // Check if the cue ball is in play
let cue;
let selectedBall = null; // Track which ball is selected

// Other balls
let redBalls = [];
let colorBalls = [];
let designatedSpots;

// Cue stick settings
let cueStickHolderX, cueStickHolderY, cueStickHolderWidth, cueStickHolderHeight;
let cueStick = {
  length: 250,
  width: 7,
  x: 0, // Initial position in the holder
  y: 0,
  angle: 0,
  active: false,
  dragged: false,
  lastHitBall: null, // Track the last ball hit
};
let isRotatingLeft = false;
let isRotatingRight = false;

// Power level settings for shots
let powerLevel = 50; // Initial power level (50%)
const maxPowerLevel = 100; // Maximum power level
const minPowerLevel = 0; // Minimum power level

//Mouse control for dragging objects
let mouseConstraint;

// Debugging mode
let showBoundaries = false; // Toggle to show/hide boundaries

// Boundary class for cushions
class RoundedBoundary {
  constructor(x, y, w, h, cornerRadius) {
    this.x = x;
    this.y = y;
    this.w = w; // Width of the cushion
    this.h = h; // Height of the cushion
    this.cornerRadius = cornerRadius; // Rounding corners

    // Create the rectangular part of cushion
    let rectPart = Matter.Bodies.rectangle(
      x + w / 2, // Center X
      y + h / 2, // Center Y
      w,
      h,
      { isStatic: true, restitution: 1.2 }
      // Strong bounce for realism
    );

    // Added rounded corners to the cushions
    let leftCircle = Matter.Bodies.circle(x, y + h / 2, cornerRadius, {
      isStatic: true,
    });
    let rightCircle = Matter.Bodies.circle(x + w, y + h / 2, cornerRadius, {
      isStatic: true,
    });

    // Combine parts into one boundary
    this.body = Matter.Body.create({
      parts: [rectPart, leftCircle, rightCircle],
      isStatic: true,
    });

    // Add to the physics world
    Matter.World.add(engine.world, this.body);
  }

  // Draw boundaries for debugging
  display() {
    if (!showBoundaries) return; // Skip if debugging is off

    fill(255, 0, 0, 80); // Light red for debug view
    noStroke();

    // Draw the rectangle part
    rectMode(CORNER);
    rect(this.x, this.y, this.w, this.h, this.cornerRadius);
  }
}

// Ball Class for all types of balls :D
class Ball {
  constructor(x, y, name, color) {
    // Initialize ball properties
    this.name = name; // Ball identifier (e.g., "cue", "red1")
    this.color = color; // Ball color

    // Create the ball using Matter.js
    this.body = Matter.Bodies.circle(x, y, ballRadius, {
      restitution: 0.9, // Elasticity (bounciness)
      friction: 0.4, // Friction when rolling
      frictionStatic: 0.5, // Increase static friction for better stopping behavior
      density: 0.01, // Density affects ball inertia
      frictionAir: 0.01, // Rolling friction (air resistance)
      inertia: Infinity, // Prevent spinning
    });

    // Add the ball to the physics world
    Matter.World.add(engine.world, this.body);
  }

  // Get x-coordinate
  x() {
    return this.body.position.x; // Get the x-coordinate
  }

  // Get y-coordinate
  y() {
    return this.body.position.y; // Get the y-coordinate
  }

  display() {
    // Display the ball as a circle
    push();
    translate(this.x(), this.y()); // Move to the ball's position
    fill(this.color); // Fill with the ball's color
    stroke(0); // Outline the ball in black
    strokeWeight(2);
    ellipse(0, 0, ballRadius * 2); // Draw the circle
    pop();
  }
}

function preload() {
  // Load the audio files
  greenLightAudio = loadSound("assets/green-light.mp3");
  redLightAudio = loadSound("assets/red-light.mp3");
}

function setup() {
  // Define canvas size with extra space for messages
  canvasWidth = TABLE_WIDTH + 200; // Add extra space for messages
  canvasHeight = TABLE_HEIGHT + 250; // Add more space below for messages

  tableX = 0;
  tableY = 0;

  varianceX = (canvasWidth - TABLE_WIDTH) / 2; // Horizontal offset
  varianceY = (canvasHeight - TABLE_HEIGHT - 150) / 2; // Vertical offset

  // Attach the canvas to the container
  let canvas = createCanvas(canvasWidth, canvasHeight);
  canvas.parent("canvas-container");

  // Initialize the light state timer
  lightToggleTimer = millis(); // Start the timer

  // Initialize the Matter.js engine
  engine = Matter.Engine.create();
  engine.world.gravity.y = 0; // Ensure gravity is set to 0 for a flat table

  // Adjust Matter.js Settings for Realistic Physics
  Matter.Engine.update(engine, {
    timing: {
      timeScale: 1, // Adjust for realistic speed of physics
    },
  });

  // Add a Matter.js mouse constraint for interaction
  const mouse = Matter.Mouse.create(canvas.elt);
  mouse.pixelRatio = pixelDensity();
  mouseConstraint = Matter.MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
      stiffness: 0.2,
      render: { visible: false }, // Hide the constraint line
    },
  });

  // Table elements
  pocketRadius = TABLE_WIDTH / 24;
  ballRadius = pocketRadius / 3; // To make the ball's diameter 1.5 times smaller than pocket
  tableFrameThickness = TABLE_WIDTH / 40;
  baulkLineX = tableX + varianceX + TABLE_WIDTH / 4; // Position of baulk line
  dZoneCenter = { x: baulkLineX, y: tableY + varianceY + TABLE_HEIGHT / 2 }; // Center of "D"
  dZoneRadius = TABLE_WIDTH / 8; // Radius of "D"

  // Now initialize designated spots
  // Now initialize designated spots
  designatedSpots = {
    blue: { x: varianceX + TABLE_WIDTH / 2, y: varianceY + TABLE_HEIGHT / 2 },
    pink: { x: varianceX + TABLE_WIDTH - 335, y: varianceY + TABLE_HEIGHT / 2 },
    black: {
      x: varianceX + TABLE_WIDTH - 100,
      y: varianceY + TABLE_HEIGHT / 2,
    },
    yellow: { x: baulkLineX, y: varianceY + TABLE_HEIGHT / 2 - dZoneRadius },
    green: { x: baulkLineX, y: varianceY + TABLE_HEIGHT / 2 + dZoneRadius },
    brown: { x: baulkLineX, y: varianceY + TABLE_HEIGHT / 2 },
  };
  // Define the cue ball container dimensions
  cueBallContainerWidth = 60;
  cueBallContainerHeight = 60;
  cueBallContainerX = 5; // Position near the left edge
  cueBallContainerY = canvasHeight - 200; // Just above the message area

  // Place the cue ball in the container initially
  cueBall = new Ball(
    cueBallContainerX + cueBallContainerWidth / 2,
    cueBallContainerY + cueBallContainerHeight / 2 - 4,
    "cue",
    [255, 255, 255]
  );

  // Vertical cue stick holder dimensions
  cueStickHolderWidth = 40; // Narrow width
  cueStickHolderHeight = 300; // Tall height
  cueStickHolderX = 10; // Position near the left edge
  cueStickHolderY = 100; // Positioned above the cue ball container

  // Initialize cue stick in the holder (vertical orientation)
  cueStick.x = cueStickHolderX + cueStickHolderWidth / 2;
  cueStick.y = cueStickHolderY + cueStickHolderHeight / 2;
  cueStick.angle = 0; // Stick is vertical inside the holder

  // Setup the balls on the table
  rackBalls();

  // Set up event listener for the checkbox
  const redLightGreenLightCheckbox = document.getElementById(
    "red-light-green-light"
  );
  if (redLightGreenLightCheckbox) {
    redLightGreenLightCheckbox.addEventListener(
      "change",
      toggleRedLightGreenLight
    );
  }

  // Create rounded cushion boundaries
  boundaries = [
    new RoundedBoundary(
      tableX + varianceX + pocketRadius - 23,
      tableY + varianceY - tableFrameThickness / 2 - 5,
      TABLE_WIDTH / 2 - pocketRadius - 4,
      tableFrameThickness,
      30
    ),
    new RoundedBoundary(
      tableX + varianceX + TABLE_WIDTH / 2 + 27,
      tableY + varianceY - tableFrameThickness / 2 - 5,
      TABLE_WIDTH / 2 - pocketRadius - 4,
      tableFrameThickness,
      30
    ),
    new RoundedBoundary(
      tableX + varianceX + pocketRadius - 23,
      TABLE_HEIGHT + 40,
      TABLE_WIDTH / 2 - pocketRadius - 4,
      tableFrameThickness,
      30
    ),
    new RoundedBoundary(
      tableX + varianceX + TABLE_WIDTH / 2 + 27,
      TABLE_HEIGHT + 40,
      TABLE_WIDTH / 2 - pocketRadius - 4,
      tableFrameThickness,
      30
    ),
    new RoundedBoundary(
      tableX + varianceX - pocketRadius / 3 - 3,
      tableY + varianceY + pocketRadius / 2 + 2,
      tableFrameThickness,
      TABLE_WIDTH / 2 - pocketRadius - 4,
      30
    ),
    new RoundedBoundary(
      tableX +
        varianceX +
        TABLE_WIDTH -
        tableFrameThickness +
        pocketRadius / 3 +
        3,
      tableY + varianceY + pocketRadius / 2 + 2,
      tableFrameThickness,
      TABLE_WIDTH / 2 - pocketRadius - 4,
      30
    ),
  ];

  Matter.Runner.run(engine);
}

function draw() {
  background(50);
  drawTable();

  // Draw the cue ball container
  drawCueBallContainer();

  // Draw cue stick holder
  drawCueStickHolder();

  // If the cue stick is being dragged, make it follow the cursor
  if (cueStick.dragged) {
    cueStick.x = mouseX;
    cueStick.y = mouseY;
  }

  // Rotate cue stick if keys are held down
  if (cueStick.dragged) {
    if (isRotatingLeft) {
      cueStick.angle -= radians(2); // Rotate left
    }
    if (isRotatingRight) {
      cueStick.angle += radians(2); // Rotate right
    }
  }

  // Display the balls
  cueBall.display();
  redBalls.forEach((ball) => ball.display());
  colorBalls.forEach((ball) => ball.display());

  // Display boundaries only if toggled on
  if (showBoundaries) {
    boundaries.forEach((boundary) => boundary.display());
  }

  // Always draw the cue stick at its current position
  drawCueStick(cueStick.x, cueStick.y, cueStick.angle);

  // Check for cue ball collisions with colored balls
  checkCueBallCollisions();

  // Check for pocket collisions
  checkPocketCollisions();

  // Draw Power Bar
  drawPowerBar();

  // Draw message area (should always show)
  drawMessageArea();

  // Handle light state transitions
  if (isRedLightGreenLightEnabled) {
    if (millis() - lightToggleTimer >= lightDuration) {
      toggleLightState(); // Trigger the light change and play audio
      lightToggleTimer = Infinity; // Prevent retriggering while audio is playing
    }
    drawLightIndicator(); // Visual indicator for the light
  }
}

function drawTable() {
  // Draw brown background
  fill(139, 69, 19); // Brown for the wooden frame
  rect(
    tableX + varianceX - tableFrameThickness,
    tableY + varianceY - tableFrameThickness,
    TABLE_WIDTH + tableFrameThickness * 2,
    TABLE_HEIGHT + tableFrameThickness * 2
  );

  // Draw play area
  fill(9, 110, 34, 255); // Green for the table surface
  rect(tableX + varianceX, tableY + varianceY, TABLE_WIDTH, TABLE_HEIGHT);

  // Draw baulk line and "D" zone
  drawBaulkAndDZone();

  //Draw cushions
  drawCushions();

  // Draw Table Frames
  drawTableFrame();

  // Draw pockets
  drawPockets();
}

function drawCueBallContainer() {
  fill(200, 200, 200); // Light gray background
  stroke(0); // Black border
  strokeWeight(2);
  rect(
    cueBallContainerX,
    cueBallContainerY,
    cueBallContainerWidth,
    cueBallContainerHeight,
    10
  ); // Rounded corners
  fill(0);
  textSize(12);
  textAlign(CENTER, CENTER);
  text(
    "Place Cue Ball",
    cueBallContainerX + cueBallContainerWidth / 2,
    cueBallContainerY + cueBallContainerHeight + 10
  );
}

// Draw the vertical cue stick holder
function drawCueStickHolder() {
  // Draw the holder
  fill(180, 140, 90); // Light brown color
  stroke(0); // Black border
  strokeWeight(2);
  rect(
    cueStickHolderX,
    cueStickHolderY,
    cueStickHolderWidth,
    cueStickHolderHeight,
    10
  ); // Rounded corners

  // Draw the cue stick if not dragged
  if (!cueStick.dragged) {
    drawCueStick(
      cueStick.x,
      cueStick.y,
      cueStick.angle // Draw vertically inside the holder
    );
  }
}

function drawBaulkAndDZone() {
  // White lines
  stroke(255);
  strokeWeight(2);

  // Baulk line
  line(
    baulkLineX,
    tableY + varianceY,
    baulkLineX,
    tableY + varianceY + TABLE_HEIGHT
  );

  // D Zone (facing right)
  noFill();
  arc(
    dZoneCenter.x,
    dZoneCenter.y,
    dZoneRadius * 2,
    dZoneRadius * 2,
    HALF_PI,
    -HALF_PI
  );
  stroke(0);
  strokeWeight(1);
}

function drawCushions() {
  // Cushions protruding into the play area
  fill(21, 156, 48, 255); // Dark green for cushions

  // Top left cushion
  rect(
    tableX + varianceX + pocketRadius - 23,
    tableY + varianceY - tableFrameThickness / 2 - 5,
    TABLE_WIDTH / 2 - pocketRadius - 4,
    tableFrameThickness,
    30
  );

  // Top right cushion
  rect(
    tableX + varianceX + TABLE_WIDTH / 2 + 27,
    tableY + varianceY - tableFrameThickness / 2 - 5,
    TABLE_WIDTH / 2 - pocketRadius - 4,
    tableFrameThickness,
    30
  );

  // Bottom left cushion
  rect(
    tableX + varianceX + pocketRadius - 23,
    TABLE_HEIGHT + 40, // Protruding upward slightly
    TABLE_WIDTH / 2 - pocketRadius - 4,
    tableFrameThickness,
    30
  );

  // Bottom right cushion
  rect(
    tableX + varianceX + TABLE_WIDTH / 2 + 27,
    TABLE_HEIGHT + 40, // Protruding upward slightly
    TABLE_WIDTH / 2 - pocketRadius - 4,
    tableFrameThickness,
    30
  );

  // Left cushion
  rect(
    tableX + varianceX - pocketRadius / 3 - 3,
    tableY + varianceY + pocketRadius / 2 + 2,
    tableFrameThickness,
    TABLE_WIDTH / 2 - pocketRadius - 4,
    30
  );

  // Right cushion
  rect(
    tableX +
      varianceX +
      TABLE_WIDTH -
      tableFrameThickness +
      pocketRadius / 3 +
      3,
    tableY + varianceY + pocketRadius / 2 + 2,
    tableFrameThickness,
    TABLE_WIDTH / 2 - pocketRadius - 4,
    30
  );
}

function drawTableFrame() {
  fill(149, 82, 40, 255); // Dark green for cushions
  rect(
    tableX + varianceX,
    tableY + varianceY - tableFrameThickness,
    TABLE_WIDTH,
    tableFrameThickness
  ); // Top cushion
  rect(
    tableX + varianceX,
    tableY + varianceY + TABLE_HEIGHT,
    TABLE_WIDTH,
    tableFrameThickness
  ); // Bottom cushion
  rect(
    tableX + varianceX - tableFrameThickness,
    tableY + varianceY,
    tableFrameThickness,
    TABLE_HEIGHT
  ); // Left cushion
  rect(
    tableX + varianceX + TABLE_WIDTH,
    tableY + varianceY,
    tableFrameThickness,
    TABLE_HEIGHT
  ); // Right cushion
}

function drawPockets() {
  // Set pocket color to black
  fill(0);
  let pocketPositions = [
    [tableX + varianceX, tableY + varianceY], // Top-left
    [tableX + varianceX + TABLE_WIDTH, tableY + varianceY], // Top-right
    [tableX + varianceX, tableY + varianceY + TABLE_HEIGHT], // Bottom-left
    [tableX + varianceX + TABLE_WIDTH, tableY + varianceY + TABLE_HEIGHT], // Bottom-right
    [tableX + varianceX + TABLE_WIDTH / 2, tableY + varianceY], // Top-center
    [tableX + varianceX + TABLE_WIDTH / 2, tableY + varianceY + TABLE_HEIGHT], // Bottom-center
  ];
  for (let [x, y] of pocketPositions) {
    ellipse(x, y, pocketRadius);
  }
}

// Draw the cue stick
function drawCueStick(x, y, angle) {
  push();
  translate(x, y);
  rotate(angle);

  // Draw the main cue stick
  stroke(139, 69, 19); // Brown color for the cue stick
  strokeWeight(cueStick.width);
  line(0, -cueStick.length / 2, 0, cueStick.length / 2); // Draw the stick vertically

  // Add a white tip at the bottom end of the stick
  stroke(255); // White color for the tip
  strokeWeight(cueStick.width);
  line(0, -cueStick.length / 2, 0, -cueStick.length / 2 + 10); // Adjust length of the tip

  pop();
}

function drawLightIndicator() {
  // Position above the checkbox
  const lightX = canvasWidth - 130; // Horizontally align with the checkbox
  const lightY = canvasHeight - 115; // Above the checkbox
  const lightSize = 50; // Size of the light indicator

  // Set the color based on the game state
  fill(gameState === "greenLight" ? "green" : "red");
  noStroke();
  ellipse(lightX, lightY, lightSize); // Draw the light

  // Display the state label
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(14);
  text(
    gameState === "greenLight" ? "GO" : "STOP",
    lightX,
    lightY + lightSize / 2 + 15
  );
}

function toggleLightState() {
  if (gameState === "greenLight") {
    // Play the red light audio
    redLightAudio.play();

    // Switch to red light after the audio ends
    setTimeout(() => {
      gameState = "redLight";
      lightToggleTimer = millis(); // Reset the timer
    }, redLightAudio.duration() * 1000); // Convert audio duration to milliseconds
  } else {
    // Play the green light audio
    greenLightAudio.play();

    // Switch to green light after the audio ends
    setTimeout(() => {
      gameState = "greenLight";
      lightToggleTimer = millis(); // Reset the timer
    }, greenLightAudio.duration() * 1000); // Convert audio duration to milliseconds
  }

  // Randomize the duration for the next light
  lightDuration = random(3000, 5000); // 3 to 5 seconds
}

function rackBalls() {
  //Clear existing balls
  redBalls = [];
  colorBalls = [];

  // Define triangle arrangement for red balls
  const rows = 5; // Number of rows in the triangle
  const spacing = ballRadius * 2 + 5; // Distance between balls
  const xOffset = Math.sqrt(3) * ballRadius; // Horizontal offset per row

  const startX = varianceX + TABLE_WIDTH * 0.75; // Start near the right end of the table
  const startY = varianceY + TABLE_HEIGHT / 2; // Center the triangle vertically

  // Place red balls in a triangle formation, flipped horizontally
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col <= row; col++) {
      const x = startX + row * xOffset; // Move right for each row
      const y = startY - (row / 2) * spacing + col * spacing; // Center the row vertically
      redBalls.push(new Ball(x, y, `red${redBalls.length + 1}`, [255, 0, 0])); // Add a red ball
    }
  }

  // Place the colored balls in their respective positions

  // Blue ball
  colorBalls.push(
    new Ball(
      varianceX + TABLE_WIDTH / 2,
      varianceY + TABLE_HEIGHT / 2,
      "blue",
      [0, 0, 255]
    )
  );

  // Pink ball
  colorBalls.push(
    new Ball(
      varianceX + TABLE_WIDTH - 335,
      varianceY + TABLE_HEIGHT / 2,
      "pink",
      [255, 192, 203]
    )
  );

  // Black ball
  colorBalls.push(
    new Ball(
      varianceX + TABLE_WIDTH - 100,
      varianceY + TABLE_HEIGHT / 2,
      "black",
      [0, 0, 0]
    )
  );

  // Yellow ball
  colorBalls.push(
    new Ball(
      baulkLineX,
      varianceY + TABLE_HEIGHT / 2 - dZoneRadius,
      "yellow",
      [255, 255, 0]
    )
  );

  // Green ball
  colorBalls.push(
    new Ball(
      baulkLineX,
      varianceY + TABLE_HEIGHT / 2 + dZoneRadius,
      "green",
      [0, 128, 0]
    )
  );

  // Brown ball
  colorBalls.push(
    new Ball(baulkLineX, varianceY + TABLE_HEIGHT / 2, "brown", [139, 69, 19])
  );
}

function resetCueBall() {
  // Reset the cue ball to the container
  Matter.Body.setPosition(cueBall.body, {
    x: cueBallContainerX + cueBallContainerWidth / 2,
    y: cueBallContainerY + cueBallContainerHeight / 2 - 4,
  });

  // Reset velocity and angular velocity to ensure the ball stops moving
  Matter.Body.setVelocity(cueBall.body, { x: 0, y: 0 }); // Stop linear movement
  Matter.Body.setAngularVelocity(cueBall.body, 0); // Stop rotation

  cueBall.body.collisionFilter.mask = 0xffffffff; // Restore collisions
  isCueBallPlaced = false; // Ensure the cue ball must be placed again in the "D" zone

  // Ensure the cue ball remains in the physics world
  if (!engine.world.bodies.includes(cueBall.body)) {
    Matter.World.add(engine.world, cueBall.body);
  }

  // Update the current message
  currentMessage = "Cue Ball potted! Place it back in the 'D' zone.";
}

function drawPowerBar() {
  // Map power level to color (green to red)
  const r = map(powerLevel, minPowerLevel, maxPowerLevel, 0, 255); // Red increases with power
  const g = map(powerLevel, minPowerLevel, maxPowerLevel, 255, 0); // Green decreases with power
  const b = 0; // No blue component

  // Position and size of the power bar
  const barX = tableX + varianceX + TABLE_WIDTH + 50; // Right side of the table
  const barY = varianceY; // Align with the top of the table
  const barWidth = 30; // Width of the bar
  const barHeight = TABLE_HEIGHT; // Height matches the table

  // Draw the power bar background
  fill(50);
  rect(barX, barY, barWidth, barHeight, 10);

  // Draw the dynamic power level
  fill(r, g, b);
  const filledHeight = map(
    powerLevel,
    minPowerLevel,
    maxPowerLevel,
    0,
    barHeight
  );
  rect(barX, barY + barHeight - filledHeight, barWidth, filledHeight, 10);

  // Add labels and power level text
  fill(255);
  noStroke();
  textSize(12);
  textAlign(CENTER, BOTTOM);
  text("Power", barX + barWidth / 2, barY - 5); // Label above the bar
  textAlign(CENTER, CENTER);
  text(Math.floor(powerLevel), barX + barWidth / 2, barY + barHeight + 15); // Power value below the bar
}

function resetBalls() {
  // Clear the Matter.js world to remove all existing bodies
  Matter.Composite.clear(engine.world, false);

  // Re-add boundaries
  boundaries.forEach((boundary) => {
    Matter.World.add(engine.world, boundary.body);
  });

  // Rack new balls
  rackBalls();
}

function setRedBallsRandom() {
  // Clear existing red balls
  redBalls.forEach((ball) => Matter.World.remove(engine.world, ball.body));
  redBalls = [];

  // Re-add boundaries
  boundaries.forEach((boundary) => {
    Matter.World.add(engine.world, boundary.body);
  });

  const minX = varianceX + TABLE_WIDTH / 2; // Ensure balls are in the right half of the table
  const maxX = varianceX + TABLE_WIDTH - pocketRadius;
  const minY = varianceY + pocketRadius;
  const maxY = varianceY + TABLE_HEIGHT - pocketRadius;

  for (let i = 0; i < 15; i++) {
    const x = random(minX, maxX);
    const y = random(minY, maxY);
    redBalls.push(new Ball(x, y, `Red${i + 1}`, [255, 0, 0]));
  }
}

function setAllBallsRandom() {
  // Remove existing red and colored balls from the Matter.js world
  [...redBalls, ...colorBalls].forEach((ball) =>
    Matter.World.remove(engine.world, ball.body)
  );

  redBalls = [];
  colorBalls = [];

  // Re-add boundaries
  boundaries.forEach((boundary) => {
    Matter.World.add(engine.world, boundary.body);
  });

  const minX = varianceX + pocketRadius; // Ensure balls stay within table bounds
  const maxX = varianceX + TABLE_WIDTH - pocketRadius;
  const minY = varianceY + pocketRadius;
  const maxY = varianceY + TABLE_HEIGHT - pocketRadius;

  // Randomize red balls
  for (let i = 0; i < 15; i++) {
    const x = random(minX, maxX);
    const y = random(minY, maxY);
    redBalls.push(new Ball(x, y, `Red${i + 1}`, [255, 0, 0]));
  }

  // Randomize colored balls
  const colors = [
    { name: "Blue", color: [0, 0, 255] },
    { name: "Pink", color: [255, 192, 203] },
    { name: "Black", color: [0, 0, 0] },
    { name: "Yellow", color: [255, 255, 0] },
    { name: "Green", color: [0, 128, 0] },
    { name: "Brown", color: [139, 69, 19] },
  ];

  colors.forEach(({ name, color }) => {
    const x = random(minX, maxX);
    const y = random(minY, maxY);
    colorBalls.push(new Ball(x, y, name, color));
  });
}

function checkCueBallCollisions() {
  colorBalls.forEach((ball) => {
    const distanceToBall = dist(cueBall.x(), cueBall.y(), ball.x(), ball.y());
    if (distanceToBall <= ballRadius * 2) {
      // Print a message when cue ball hits a colored ball
      console.log(`Cue ball hit ${capitalizeFirstLetter(ball.name)} Ball`);
      printMessage(`Cue ball hit ${capitalizeFirstLetter(ball.name)} Ball`);
    }
  });
}

function checkPocketCollisions() {
  const pocketPositions = [
    [tableX + varianceX, tableY + varianceY], // Top-left
    [tableX + varianceX + TABLE_WIDTH, tableY + varianceY], // Top-right
    [tableX + varianceX, tableY + varianceY + TABLE_HEIGHT], // Bottom-left
    [tableX + varianceX + TABLE_WIDTH, tableY + varianceY + TABLE_HEIGHT], // Bottom-right
    [tableX + varianceX + TABLE_WIDTH / 2, tableY + varianceY], // Top-center
    [tableX + varianceX + TABLE_WIDTH / 2, tableY + varianceY + TABLE_HEIGHT], // Bottom-center
  ];

  [...redBalls, cueBall, ...colorBalls].forEach((ball) => {
    pocketPositions.forEach(([px, py]) => {
      const distanceToPocket = dist(ball.x(), ball.y(), px, py);

      if (distanceToPocket <= pocketRadius * 1.05) {
        if (ball === cueBall) {
          console.log("Cue ball potted. Resetting to container.");
          resetCueBall(); // Reset the cue ball to the container
        } else if (redBalls.includes(ball)) {
          // Remove the red ball
          console.log(`${capitalizeFirstLetter(ball.name)} potted.`);
          const redBallIndex = redBalls.findIndex(
            (redBall) => redBall === ball
          );
          if (redBallIndex !== -1) {
            redBalls.splice(redBallIndex, 1);
          }
          Matter.World.remove(engine.world, ball.body); // Remove from Matter.js world
          currentMessage = `${capitalizeFirstLetter(ball.name)} potted!`;
          lastPottedBallType = "Red"; // Update the last potted ball type
        } else if (colorBalls.includes(ball)) {
          // Handle colored ball potting
          const { x, y } = designatedSpots[ball.name];
          Matter.Body.setPosition(ball.body, { x, y }); // Re-spot the ball
          console.log(
            `${capitalizeFirstLetter(ball.name)} potted and re-spotted.`
          );
          Matter.Body.setVelocity(ball.body, { x: 0, y: 0 }); // Reset velocity
          Matter.Body.setAngularVelocity(ball.body, 0); // Reset angular velocity

          if (lastPottedBallType === "Colored") {
            console.log("Error: Two consecutive colored balls potted.");
            currentMessage = `Mistake! Two consecutive colored balls were potted (${capitalizeFirstLetter(
              ball.name
            )}).`;
          } else {
            currentMessage = `${capitalizeFirstLetter(ball.name)} re-spotted!`;
          }

          lastPottedBallType = "Colored"; // Update the last potted ball type
        }
      }
    });
  });
}

function toggleRedLightGreenLight() {
  // Access the checkbox directly from the DOM
  const checkbox = document.getElementById("red-light-green-light");

  // Check if the checkbox is enabled or disabled
  isRedLightGreenLightEnabled = checkbox.checked;

  if (isRedLightGreenLightEnabled) {
    console.log("Red Light, Green Light enabled.");
  } else {
    console.log("Red Light, Green Light disabled.");
  }

  // Update the message
  currentMessage = isRedLightGreenLightEnabled
    ? "Red Light, Green Light enabled!"
    : "Red Light, Green Light disabled!";
}

function drawMessageArea() {
  fill(50); // Dark gray for message area
  rect(0, canvasHeight - 150, canvasWidth, 150); // Message area rectangle

  fill(255); // White text
  textSize(16);

  // Controls Section
  const controlsX = 70;
  textAlign(LEFT, TOP);
  text("Controls:", controlsX, canvasHeight - 140);
  textSize(13);
  text(
    "1: Reset balls\n" +
      "2: Randomly reposition Red Balls\n" +
      "3: Randomly reposition Red and Colored Balls\n" +
      "I: Toggle boundaries\n" +
      "A/D: Rotate cue stick left/right (hold for faster rotation)\n" +
      "W/S: Increase/Decrease the power of shots\n" +
      "Drag: Move balls or cue stick",
    controlsX,
    canvasHeight - 120
  );

  // Dynamic Message Section
  textAlign(CENTER, CENTER);
  textSize(15);
  text(currentMessage, canvasWidth / 2, canvasHeight - 90); // Display the dynamic message
}

function printMessage(message) {
  currentMessage = message; // Set the current message
  setTimeout(() => {
    currentMessage = ""; // Clear the message after 3 seconds
  }, 3000); // Adjust the timeout duration as needed
}

function keyPressed() {
  // Toggle boundary display
  if (key === "i" || key === "I") {
    showBoundaries = !showBoundaries;
    currentMessage = `Boundary display ${
      showBoundaries ? "enabled" : "disabled"
    }`;
  }

  // Rotate the cue stick when dragging
  if (cueStick.dragged) {
    if (key === "a" || key === "A") {
      isRotatingLeft = true; // Start rotating left
      currentMessage = "Cue stick rotating left.";
    } else if (key === "d" || key === "D") {
      isRotatingRight = true; // Start rotating right
      currentMessage = "Cue stick rotating right.";
    }
  }

  // Reset balls to starting position
  if (key === "1") {
    console.log("Resetting all balls to their starting positions.");
    resetBalls(); // Call the reset function
    currentMessage = "Balls have been reset to the starting position"; // Update the dynamic message
  } else if (key === "2") {
    console.log("Randomizing red ball positions.");
    setRedBallsRandom();
    currentMessage = "Red balls have been randomly repositioned";
  } else if (key === "3") {
    console.log("Randomizing positions of all balls.");
    setAllBallsRandom();
    currentMessage = "Red and colored balls have been randomly repositioned";
  }

  // Adjust power level using UP and DOWN keys
  if (key === "w" || key === "W") {
    powerLevel = constrain(powerLevel + 5, minPowerLevel, maxPowerLevel); // Increase power
    currentMessage = `Power Level: ${powerLevel}`;
  }
  if (key === "s" || key === "S") {
    powerLevel = constrain(powerLevel - 5, minPowerLevel, maxPowerLevel); // Decrease power
    currentMessage = `Power Level: ${powerLevel}`;
  }
}

function keyReleased() {
  if (key === "a" || key === "A") {
    isRotatingLeft = false; // Stop rotating left
    currentMessage = "";
  } else if (key === "d" || key === "D") {
    isRotatingRight = false; // Stop rotating right
    currentMessage = "";
  }
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function mousePressed() {
  // Ensure audio context is enabled on any user interaction
  getAudioContext().resume();

  // Check if the mouse is clicking on any ball
  [...redBalls, cueBall, ...colorBalls].forEach((ball) => {
    const distance = dist(mouseX, mouseY, ball.x(), ball.y());
    if (distance < ballRadius) {
      selectedBall = ball;
      console.log(`Picked up ${capitalizeFirstLetter(ball.name)} Ball`);
      currentMessage = `Picked up ${capitalizeFirstLetter(ball.name)} Ball`; // Update the message
    }
  });

  // Check if the mouse is clicking on the cue stick
  const distanceToCueStick = dist(mouseX, mouseY, cueStick.x, cueStick.y);

  if (
    cueStick.dragged || // If already dragging, allow dropping
    distanceToCueStick < cueStick.length / 2 // Check if clicked near the cue stick
  ) {
    // Toggle the dragged state
    cueStick.dragged = !cueStick.dragged;

    if (cueStick.dragged) {
      console.log("Picked up the cue stick.");
      currentMessage = "Picked up the cue stick.";
    } else {
      // If dropped, validate placement in `mouseReleased`
      console.log("Dropped the cue stick.");
      currentMessage = "Dropped the cue stick.";
    }
  }
}

function mouseDragged() {
  if (selectedBall) {
    if (selectedBall === cueBall && !isCueBallPlaced) {
      // Ignore boundaries during cue ball placement
      cueBall.body.collisionFilter.mask = 0; // Disable collisions
      Matter.Body.setPosition(cueBall.body, { x: mouseX, y: mouseY });
    } else {
      // Normal dragging
      Matter.Body.setPosition(selectedBall.body, { x: mouseX, y: mouseY });
    }
  }

  if (cueStick.dragged) {
    if (isRedLightGreenLightEnabled && gameState === "redLight") {
      // Penalize player for moving the cue stick during red light
      currentMessage = "Foul! Cue stick moved during Red Light!";
      cueStick.x = cueStickHolderX + cueStickHolderWidth / 2; // Reset cue stick to holder
      cueStick.y = cueStickHolderY + cueStickHolderHeight / 2;
      cueStick.angle = 0; // Reset angle
      cueStick.dragged = false; // Stop dragging
      return;
    }
    cueStick.x = mouseX;
    cueStick.y = mouseY;

    // Calculate the tip position
    const tipX =
      cueStick.x + Math.cos(cueStick.angle - HALF_PI) * (cueStick.length / 2);
    const tipY =
      cueStick.y + Math.sin(cueStick.angle - HALF_PI) * (cueStick.length / 2);

    // Visual debugging: Draw the cue tip
    fill(255, 0, 0, 0);
    noStroke();
    rect(tipX - 4, tipY - 4, 8, 10, 2);

    // Check collision with balls
    redBalls.concat(colorBalls).forEach((ball) => {
      const distanceToBall = dist(tipX, tipY, ball.x(), ball.y());
      if (distanceToBall <= ballRadius) {
        // Apply force based on power level
        const forceX = Math.cos(cueStick.angle - HALF_PI);
        const forceY = Math.sin(cueStick.angle - HALF_PI);
        const forceMagnitude = map(powerLevel, 0, maxPowerLevel, 0.05, 0.9);

        Matter.Body.applyForce(
          ball.body,
          { x: ball.x(), y: ball.y() },
          { x: forceX * forceMagnitude, y: forceY * forceMagnitude }
        );

        // Print foul message
        printMessage(
          `Foul! Cue stick hit ${capitalizeFirstLetter(ball.name)} Ball.`
        );

        // Temporarily disable interaction to prevent multiple hits
        cueStick.dragged = false;

        // Reset friction for the ball after applying the force
        setTimeout(() => {
          ball.body.frictionStatic = 0.7; // Default static friction
          ball.body.friction = 0.3; // Default dynamic friction
        }, 200);
      }
    });

    // Check collision with the cue ball
    const distanceToCueBall = dist(tipX, tipY, cueBall.x(), cueBall.y());
    if (distanceToCueBall <= ballRadius) {
      const forceX = Math.cos(cueStick.angle - HALF_PI);
      const forceY = Math.sin(cueStick.angle - HALF_PI);
      const forceMagnitude = map(powerLevel, 0, maxPowerLevel, 0.05, 0.5);

      Matter.Body.applyForce(
        cueBall.body,
        { x: cueBall.x(), y: cueBall.y() },
        { x: forceX * forceMagnitude, y: forceY * forceMagnitude }
      );

      // Message indicating successful hit
      printMessage("Cue stick hit the cue ball.");
      cueStick.dragged = false;
    }
  }
}

function mouseReleased() {
  if (selectedBall) {
    const ballX = selectedBall.x();
    const ballY = selectedBall.y();

    if (
      selectedBall === cueBall &&
      dist(ballX, ballY, dZoneCenter.x, dZoneCenter.y) <= dZoneRadius
    ) {
      // Place the cue ball and enable its interactions with boundaries
      isCueBallPlaced = true;
      cueBall.body.collisionFilter.mask = 0xffffffff; // Restore collisions
      currentMessage = "Cue Ball placed in the D zone.";
    } else if (selectedBall === cueBall) {
      // Reset cue ball to container if not placed in the "D" zone
      Matter.Body.setPosition(cueBall.body, {
        x: cueBallContainerX + cueBallContainerWidth / 2,
        y: cueBallContainerY + cueBallContainerHeight / 2 - 4,
      });
      cueBall.body.collisionFilter.mask = 0xffffffff; // Ensure collisions are restored
      currentMessage = "Place the Cue Ball inside the D zone!";
    } else {
      // For other balls
      currentMessage = `${capitalizeFirstLetter(
        selectedBall.name
      )} Ball dropped`;
    }

    selectedBall = null;
  }
  if (cueStick.dragged) {
    // Define the boundaries of the table
    const tableLeft = tableX + varianceX - tableFrameThickness;
    const tableRight = tableX + varianceX + TABLE_WIDTH + tableFrameThickness;
    const tableTop = tableY + varianceY - tableFrameThickness;
    const tableBottom = tableY + varianceY + TABLE_HEIGHT + tableFrameThickness;

    // Check if the cue stick is outside the table and the holder
    const outsideTable =
      cueStick.x < tableLeft ||
      cueStick.x > tableRight ||
      cueStick.y < tableTop ||
      cueStick.y > tableBottom;

    const outsideHolder =
      cueStick.x < cueStickHolderX ||
      cueStick.x > cueStickHolderX + cueStickHolderWidth ||
      cueStick.y < cueStickHolderY ||
      cueStick.y > cueStickHolderY + cueStickHolderHeight;

    if (outsideTable && outsideHolder) {
      // Reset to the holder
      cueStick.x = cueStickHolderX + cueStickHolderWidth / 2;
      cueStick.y = cueStickHolderY + cueStickHolderHeight / 2;
      cueStick.angle = 0; // Ensure it stays vertical
      currentMessage = "Cue stick reset to the holder.";
    } else {
      currentMessage = "Dropped the cue stick.";
    }

    cueStick.dragged = false;
  }
}

/*

Commentary

This pool game app was designed to be easy to use and accessible for everyone. 
The reason I went with mouse-based and keyboard controls for the cue stick is that it feels natural and simple for users to interact with. 
A lot of players are familiar with dragging and clicking with a mouse, so it seemed like the best way to give them full control over aiming. 
The way it works is pretty straightforward—players click and drag the cue stick to position it, and they can rotate it with the keys "A" or "D" to aim. 
The power level for the shot is tied to the dynamic power bar, which the player can adjust using "W" and "S", so it’s all very intuitive. 
This setup makes the game engaging while avoiding the need for complex instructions.

One of the main features I added was the "Red Light, Green Light" extension, inspired by the Squid Game TV Show. 
This feature is what makes the app unique because it introduces a completely different gameplay mechanic to a traditional pool game. 
When "Red Light, Green Light" is enabled, the player has to stop moving the cue stick when the light turns red. 
If they don’t, it’s considered a foul, which adds an extra layer of challenge and strategy. 
This idea came to me while I was watching the trailer for the new season of "Squid Game". 
I thought of implementing it because it’s something you don’t normally see in pool games, and it keeps players on their toes.

I also included features like resetting the balls, randomizing their positions, and a detailed message area for feedback. 
These are there to enhance the user experience and make the game feel more interactive. 
For example, the randomization option adds replay value, as no two games will feel exactly the same. 
The message area gives players real-time updates about their actions, like when they pot a ball or commit a foul, so they’re always informed about what’s going on.

The design of the table and the physics engine was another important part of the project. 
I used Matter.js to handle the physics and it makes the game feel realistic. 
The balls bounce and roll in a way that mimics real-life pool, and the collisions feel natural. This adds to the overall immersion of the game.

As for the assets, I used audio clips from the "Red Light, Green Light" Game.
green-light.mp3 - "https://tuna.voicemod.net/sound/e3277f92-1b20-43ed-9e0a-791de3c8e061"
red-light.mp3 - "https://tuna.voicemod.net/sound/ffc6fc99-c3c9-41af-b217-9c3328ff7808"
I’ve credited the sources of any assets I didn’t create myself to ensure proper acknowledgment.

Overall, I wanted this app to feel familiar but also bring something fresh to the table. 
The traditional mechanics are there for players who love pool, but the added features like "Red Light, Green Light" make it unique and fun. 
I learned a lot during this project, from working with physics engines to adding creative features, and I’m really proud of how it turned out.

*/
