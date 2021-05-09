"use strict";

async function main(tank) {
  // CONSTANTES
  const MIN_ANGLE = 0;
  const MAX_ANGLE = 360;
  const MAX_VELOCITY = 75;
  const MIN_VELOCITY = 0;
  const MAX_RANGE_SCAN = 10;
  const MIN_RANGE_SCAN = 1;
  const PLUS_DISTANCE_SHOOT = 150;
  const DISTANCE_TO_CORNER = {
    large: 250,
    medium: 150,
    short: 100,
  };
  const CANVAS = {
    width: 1340,
    height: 1000,
  };
  const DISTANCE_TO_SHOOT = {
    large: 700,
    medium: 500,
    short: 300,
  };
  const QUARTERS = {
    first: {
      min: 180,
      max: 270,
      name: "first",
    },
    second: {
      min: 270,
      max: 360,
      name: "second",
    },
    third: {
      min: 0,
      max: 90,
      name: "third",
    },
    fourth: {
      min: 90,
      max: 180,
      name: "fourth",
    },
  };
  const CORNERS = {
    first: {
      x: CANVAS.width,
      y: CANVAS.height,
    },
    second: {
      x: 0,
      y: CANVAS.height,
    },
    third: {
      x: 0,
      y: 0,
    },
    fourth: {
      x: CANVAS.width,
      y: 0,
    },
  };
  const NEXT_CORNER = {
    first: "second",
    second: "first",
    third: "fourth",
    fourth: "third",
  };

  let quarter = await getQuarter();

  // VARIABLES
  let velocity = MAX_VELOCITY;
  let scanRange = MAX_RANGE_SCAN;
  let angle = MIN_ANGLE;
  let scanningDirection = QUARTERS[quarter].min;
  let toPlus = true;
  let tankFound = false;
  let damage = 0;

  const handleNextPosition = setTimeout(async () => {
    quarter = NEXT_CORNER[quarter];
    velocity = MAX_VELOCITY;
  }, 30000);

  while (true) {
    await goingToCorner();
    let found = await seeking();
    if (found > 0) await shooting({ angle: scanningDirection, distance: found, range: scanRange});
    
    await handleDamage();
    await resetingAngles();
  }

  async function goingToCorner() {
    let distanceToCorner = await getDistanceToCorner();
    angle = await getAngleToCorner(quarter);
    velocity = await handleVelocity({ velocity, distanceToCorner, quarter });
    await tank.drive(angle, velocity);
  }

  async function shooting({ angle, distance, range }) {
    if (distance > DISTANCE_TO_SHOOT.large) range = range * 1.5;
    if (distance < DISTANCE_TO_SHOOT.medium) range = range / 2;
    if (distance < DISTANCE_TO_SHOOT.short) range = range / 3;
    distance += PLUS_DISTANCE_SHOOT;
    await tank.shoot(angle - range, distance);
    await tank.shoot(angle + range, distance);
  }

  async function seeking() {
    let found = await tank.scan(scanningDirection, scanRange);
    if (found > 0) {
      tankFound = scanningDirection;
      scanRange =
        scanRange == MAX_RANGE_SCAN ? MAX_RANGE_SCAN / 2 : MIN_RANGE_SCAN;
    }
    if (found == 0 && tankFound) {
      toPlus = !toPlus;
      scanningDirection = tankFound;
      tankFound = false;
      scanRange = MAX_RANGE_SCAN;
    }
    if (found == 0 && !tankFound) {
      toPlus
        ? (scanningDirection += MAX_RANGE_SCAN * 2)
        : (scanningDirection -= MAX_RANGE_SCAN * 2);
    }
    return found;
  }

  async function handleDamage() {
    let receivedDamage = await tank.getDamage();
    if (receivedDamage !== damage) {
      damage = receivedDamage;
      velocity = MAX_VELOCITY;
    }
    if (damage >= 50 && quarter !== await getQuarter()) {
      clearTimeout(handleNextPosition)
      quarter = NEXT_CORNER[quarter];
    }
  }

  async function resetingAngles() {
    // Handle reset angles
    if (scanningDirection > QUARTERS[quarter].max)
      scanningDirection = QUARTERS[quarter].max;
    if (scanningDirection < QUARTERS[quarter].min)
      scanningDirection = QUARTERS[quarter].min;
    if (
      scanningDirection >= QUARTERS[quarter].max ||
      scanningDirection <= QUARTERS[quarter].min
    )
      toPlus = !toPlus;
    if (angle >= MAX_ANGLE) angle = MIN_ANGLE;
  }

  // Helpers Functions
  async function getPosition() {
    return {
      x: await tank.getX(),
      y: await tank.getY(),
    };
  }

  async function getCornerClosests() {
    return {
      cornerX: CANVAS.width / 2 <= (await tank.getX()) ? CANVAS.width : 0,
      cornerY: CANVAS.height / 2 <= (await tank.getY()) ? CANVAS.height : 0,
    };
  }

  async function getQuarter() {
    const { cornerX, cornerY } = await getCornerClosests();
    return Object.keys(CORNERS).reduce((acc, el) =>
      CORNERS[el].x == cornerX && CORNERS[el].y == cornerY ? (acc = el) : acc
    );
  }

  async function getDistances() {
    const position = await getPosition();
    return {
      distanceX: Math.abs(CORNERS[quarter].x - position.x),
      distanceY: Math.abs(CORNERS[quarter].y - position.y),
    };
  }

  async function getAngleToCorner(quarter) {
    const { distanceX, distanceY } = await getDistances();
    const angle = (Math.atan(distanceX / distanceY) * 180) / Math.PI;
    let parseAngleQuarter =
      quarter == QUARTERS.first.name || quarter == QUARTERS.second.name
        ? 90
        : 270;

    return quarter == QUARTERS.first.name || quarter == QUARTERS.third.name
      ? parseAngleQuarter - angle
      : parseAngleQuarter + angle - 5; // Error de desviación (1 grado) en cuadrante 2
  }

  async function getDistanceToCorner() {
    const { distanceX, distanceY } = await getDistances();
    return Math.hypot(distanceX, distanceY);
  }

  async function handleVelocity({ velocity, distanceToCorner }) {
    if (
      velocity == MAX_VELOCITY &&
      distanceToCorner <= DISTANCE_TO_CORNER.large
    )
      velocity = velocity / 2;
    if (
      velocity == MAX_VELOCITY / 2 &&
      distanceToCorner <= DISTANCE_TO_CORNER.medium
    )
      velocity = (MIN_VELOCITY / 2) * 10;
    if (
      velocity == (MIN_VELOCITY / 2) * 10 &&
      distanceToCorner <= DISTANCE_TO_CORNER.short
    )
      velocity = MIN_VELOCITY;
    return velocity;
  }
}
