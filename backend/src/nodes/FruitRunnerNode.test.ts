import { describe, it, expect, vi, beforeAll } from 'vitest';
import {
  fruitRunnerNodeHandler,
  evaluateLanes,
  selectBestLane,
  getObstacleHalfWidth,
  planGlobalTrajectory,
  analyzeFrame,
  calibrateFromFrame,
  VisionCalibration,
  DetectedObject,
  INSTALL_PHASER_AUTOPILOT_SCRIPT,
} from './FruitRunnerNode';
import { NodeHandlerParams } from './types';
import { encodePng } from '../utils/pngParser';

describe('FruitRunnerNode v2', () => {
  let validPngBuffer: Buffer;

  beforeAll(async () => {
    // Створюємо валідний PNG — суцільний «дорожній» колір із достатньою роздільністю
    const W = 200, H = 200;
    const pixels = Buffer.alloc(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      pixels[i * 4] = 194;     // R — пісочний
      pixels[i * 4 + 1] = 163; // G
      pixels[i * 4 + 2] = 117; // B
      pixels[i * 4 + 3] = 255; // A
    }
    validPngBuffer = await encodePng({ width: W, height: H, pixels });
  });

  it('should be defined as a function', () => {
    expect(typeof fruitRunnerNodeHandler).toBe('function');
  });

  it('should return failed handle if no activePage is provided', async () => {
    const logToClient = vi.fn();
    const params: Partial<NodeHandlerParams> = {
      currentNode: { id: 'node-1', type: 'fruitRunnerNode', data: { targetScore: 2500 } } as any,
      activePage: null as any,
      logToClient,
      context: { foo: 'bar' },
      takeDebugSnapshot: vi.fn(),
    };

    const result = await fruitRunnerNodeHandler(params as NodeHandlerParams);
    expect(result.nextHandle).toBe('failed');
    expect(logToClient).toHaveBeenCalledWith(expect.stringContaining('Немає активної сторінки'), 'error');
  });

  it('should complete successfully when targetScore is reached', async () => {
    const logToClient = vi.fn();
    const mockPage = {
      isClosed: () => false,
      screenshot: vi.fn().mockResolvedValue(validPngBuffer),
      evaluate: vi.fn().mockResolvedValue({
        score: 2550,
        gameOver: false,
        gameWon: false,
      }),
      keyboard: {
        up: vi.fn().mockResolvedValue(undefined),
        down: vi.fn().mockResolvedValue(undefined),
      },
    };

    const params: Partial<NodeHandlerParams> = {
      currentNode: {
        id: 'node-1',
        type: 'fruitRunnerNode',
        data: { targetScore: 2500, maxDuration: 5000 },
      } as any,
      activePage: mockPage as any,
      logToClient,
      context: { initial: true },
      takeDebugSnapshot: vi.fn(),
      smartSleep: vi.fn().mockResolvedValue(undefined),
      checkRunning: vi.fn().mockReturnValue(true),
    };

    const result = await fruitRunnerNodeHandler(params as NodeHandlerParams);
    expect(result.nextHandle).toBe('success');
    expect(result.data?.score).toBe(2550);
    expect(result.data?.success).toBe(true);
  });

  it('should return failed handle when gameOver is true', async () => {
    const logToClient = vi.fn();
    const mockPage = {
      isClosed: () => false,
      screenshot: vi.fn().mockResolvedValue(validPngBuffer),
      evaluate: vi.fn().mockResolvedValue({
        score: 120,
        gameOver: true,
        gameWon: false,
      }),
      keyboard: {
        up: vi.fn().mockResolvedValue(undefined),
        down: vi.fn().mockResolvedValue(undefined),
      },
    };

    const params: Partial<NodeHandlerParams> = {
      currentNode: {
        id: 'node-1',
        type: 'fruitRunnerNode',
        data: { targetScore: 2500, maxDuration: 5000 },
      } as any,
      activePage: mockPage as any,
      logToClient,
      context: {},
      takeDebugSnapshot: vi.fn(),
      smartSleep: vi.fn().mockResolvedValue(undefined),
      checkRunning: vi.fn().mockReturnValue(true),
    };

    const result = await fruitRunnerNodeHandler(params as NodeHandlerParams);
    expect(result.nextHandle).toBe('failed');
    expect(result.data?.score).toBe(120);
    expect(result.data?.success).toBe(false);
  });

  it('should stop when checkRunning returns false', async () => {
    const logToClient = vi.fn();
    let callCount = 0;
    const mockPage = {
      isClosed: () => false,
      screenshot: vi.fn().mockResolvedValue(validPngBuffer),
      evaluate: vi.fn().mockResolvedValue({ score: 0, gameOver: false, gameWon: false }),
      keyboard: {
        up: vi.fn().mockResolvedValue(undefined),
        down: vi.fn().mockResolvedValue(undefined),
      },
    };

    const params: Partial<NodeHandlerParams> = {
      currentNode: {
        id: 'node-1',
        type: 'fruitRunnerNode',
        data: { targetScore: 2500, maxDuration: 60000 },
      } as any,
      activePage: mockPage as any,
      logToClient,
      context: {},
      takeDebugSnapshot: vi.fn(),
      smartSleep: vi.fn().mockResolvedValue(undefined),
      checkRunning: vi.fn().mockImplementation(() => {
        callCount++;
        // Зупиняємо після кількох ітерацій
        return callCount <= 3;
      }),
    };

    const result = await fruitRunnerNodeHandler(params as NodeHandlerParams);
    // Після зупинки checkRunning, мав би вийти з циклу та повернути timeout
    expect(result.nextHandle).toBe('timeout');
    expect(logToClient).toHaveBeenCalledWith(expect.stringContaining('Зупинено користувачем'), 'info');
  });

  it('should handle screenshot errors gracefully with retry', async () => {
    const logToClient = vi.fn();
    let screenshotCallCount = 0;
    const mockPage = {
      isClosed: () => false,
      screenshot: vi.fn().mockImplementation(async () => {
        screenshotCallCount++;
        if (screenshotCallCount <= 2) throw new Error('screenshot failed');
        return validPngBuffer;
      }),
      evaluate: vi.fn().mockResolvedValue({ score: 3000, gameOver: false, gameWon: true }),
      keyboard: {
        up: vi.fn().mockResolvedValue(undefined),
        down: vi.fn().mockResolvedValue(undefined),
      },
    };

    const params: Partial<NodeHandlerParams> = {
      currentNode: {
        id: 'node-1',
        type: 'fruitRunnerNode',
        data: { targetScore: 2500, maxDuration: 5000 },
      } as any,
      activePage: mockPage as any,
      logToClient,
      context: {},
      takeDebugSnapshot: vi.fn(),
      smartSleep: vi.fn().mockResolvedValue(undefined),
      checkRunning: vi.fn().mockReturnValue(true),
    };

    // Перші 2 скріншоти провалюються, 3-й успішний → мав би знайти рахунок та перемогти
    const result = await fruitRunnerNodeHandler(params as NodeHandlerParams);
    expect(result.nextHandle).toBe('success');
  });

  describe('Decision Engine & Swept Corridor', () => {
    it('getObstacleHalfWidth should return correct dimensions for known sprites', () => {
      expect(getObstacleHalfWidth({ subtype: 'hole' } as any)).toBe(48); // 96px hole
      expect(getObstacleHalfWidth({ subtype: 'rock' } as any)).toBe(27); // 54px rock
      expect(getObstacleHalfWidth({ subtype: 'grave' } as any)).toBe(21); // 42px grave
      expect(getObstacleHalfWidth({ subtype: 'unknown', w: 60 } as any)).toBe(30);
    });

    it('should forbid crossing through a lane blocked by an imminent obstacle (Swept Corridor)', () => {
      const roadLeft = 100;
      const roadRight = 500;
      const playerX = 140; // Смуга 1
      const playerY = 400;
      const numLanes = 5;
      const lookahead = 300;
      const safetyMargin = 20;

      // Перешкода на проміжній смузі (близько по Y, між гравцем і цільовою смугою)
      const obstacles: DetectedObject[] = [
        { x: 220, y: 340, w: 54, h: 33, category: 'obstacle', subtype: 'rock' },
      ];
      // Фрукт на дальній смузі (Смуга 4/5, ~380px)
      const collectibles: DetectedObject[] = [
        { x: 380, y: 300, w: 30, h: 30, category: 'collectible', subtype: 'cherry' },
      ];

      const lanes = evaluateLanes(
        playerX,
        playerY,
        roadLeft,
        roadRight,
        obstacles,
        collectibles,
        numLanes,
        lookahead,
        safetyMargin,
        false,
        1.0
      );

      // Смуги далі ніж x=220 повинні бути позначені як isFatal або мати величезний штраф через перерізання перешкоди
      const farLane = lanes.find(l => l.centerX > 260);
      expect(farLane).toBeDefined();
      expect(farLane!.isFatal).toBe(true);
      expect(farLane!.score).toBeLessThan(-500000);
    });

    it('should enter emergency evasion when obstacle is directly incoming on player', () => {
      const roadLeft = 100;
      const roadRight = 500;
      const playerX = 300; // Центр дороги
      const playerY = 400;
      const numLanes = 5;
      const lookahead = 300;
      const safetyMargin = 20;

      // Велика яма прямо перед гравцем (y = 350, тобто всього 50px попереду)
      const obstacles: DetectedObject[] = [
        { x: 300, y: 350, w: 96, h: 69, category: 'obstacle', subtype: 'hole' },
      ];
      // Фрукт на іншому кінці
      const collectibles: DetectedObject[] = [
        { x: 140, y: 250, w: 30, h: 30, category: 'collectible', subtype: 'banana' },
      ];

      const lanes = evaluateLanes(
        playerX,
        playerY,
        roadLeft,
        roadRight,
        obstacles,
        collectibles,
        numLanes,
        lookahead,
        safetyMargin,
        false,
        1.0
      );

      const targetX = selectBestLane(lanes, playerX);

      // Гравець повинен ухилитися від x=300 (прямої смерті)
      expect(Math.abs(targetX - 300)).toBeGreaterThan(30);

      // Смуга x=300 повинна бути фатальною
      const currentLane = lanes.find(l => Math.abs(l.centerX - 300) < 30);
      expect(currentLane?.isFatal).toBe(true);
    });

    it('selectBestLane should apply hysteresis bonus to prevent jitter', () => {
      const lanes = [
        { centerX: 100, score: 50 },
        { centerX: 200, score: 55 }, // лише на 5 очок більше
      ];

      // Якщо минулою ціллю був x=100, бонус гістерезису (+12) повинен утримати його
      const chosen = selectBestLane(lanes, 100);
      expect(chosen).toBe(100);

      // Якщо минулої цілі не було, обирається 200
      const chosenFresh = selectBestLane(lanes);
      expect(chosenFresh).toBe(200);
    });

    describe('planGlobalTrajectory (Global Pathfinding)', () => {
      it('should generate a safe direct trajectory on an empty road', () => {
        const roadLeft = 100;
        const roadRight = 500;
        const playerX = 300;
        const playerY = 600;
        const scanTop = 100;

        const path = planGlobalTrajectory(
          playerX, playerY,
          roadLeft, roadRight,
          [], [],
          scanTop
        );

        expect(path.length).toBeGreaterThan(5);
        expect(path[0].y).toBe(playerY);
        expect(path[path.length - 1].y).toBe(scanTop);

        // На порожній дорозі лінія повинна бути практично прямою
        for (const pt of path) {
          expect(Math.abs(pt.x - playerX)).toBeLessThan(15);
        }
      });

      it('should plan a trajectory that evades an obstacle directly ahead', () => {
        const roadLeft = 100;
        const roadRight = 500;
        const playerX = 300;
        const playerY = 600;
        const scanTop = 100;

        // Камінь прямо на лінії руху (x=300, y=450)
        const obstacles: DetectedObject[] = [
          { x: 300, y: 450, w: 54, h: 33, category: 'obstacle', subtype: 'rock' },
        ];

        const path = planGlobalTrajectory(
          playerX, playerY,
          roadLeft, roadRight,
          obstacles, [],
          scanTop
        );

        // Перевіряємо точку траєкторії на висоті перешкоди (y ≈ 450)
        const pointAtObs = path.find(p => Math.abs(p.y - 450) < 20);
        expect(pointAtObs).toBeDefined();

        // Траєкторія повинна безпечно відхилитися від каменю
        const dist = Math.abs(pointAtObs!.x - 300);
        const safeMargin = getObstacleHalfWidth('rock') + 18;
        expect(dist).toBeGreaterThanOrEqual(safeMargin);
      });

      it('should navigate a multi-obstacle slalom smoothly', () => {
        const roadLeft = 100;
        const roadRight = 500;
        const playerX = 300;
        const playerY = 700;
        const scanTop = 100;

        // Серія перешкод у шаховому порядку:
        // 1. Камінь у центрі (300, 550)
        // 2. Могила ліворуч (200, 350)
        // 3. Камінь праворуч (400, 200)
        const obstacles: DetectedObject[] = [
          { x: 300, y: 550, w: 54, h: 33, category: 'obstacle', subtype: 'rock' },
          { x: 200, y: 350, w: 42, h: 36, category: 'obstacle', subtype: 'grave' },
          { x: 400, y: 200, w: 54, h: 33, category: 'obstacle', subtype: 'rock' },
        ];

        const path = planGlobalTrajectory(
          playerX, playerY,
          roadLeft, roadRight,
          obstacles, [],
          scanTop
        );

        expect(path.length).toBeGreaterThan(10);

        // Жодна точка траєкторії не повинна стикатися з перешкодами
        for (const pt of path) {
          for (const obs of obstacles) {
            if (Math.abs(pt.y - obs.y) < 15) {
              const halfW = getObstacleHalfWidth(obs);
              const clearance = Math.abs(pt.x - obs.x) - (halfW + 16);
              expect(clearance).toBeGreaterThanOrEqual(0);
            }
          }
        }
      });

      it('should aggressively evade obstacles dangerously close to the player without collapsing to a straight line', () => {
        const roadLeft = 100;
        const roadRight = 500;
        const playerX = 300;
        const playerY = 600;
        const scanTop = 100;

        // Перешкода всього 25px попереду гравця прямо по центру
        const obstacles: DetectedObject[] = [
          { x: 300, y: 575, w: 54, h: 33, category: 'obstacle', subtype: 'rock' },
        ];

        const path = planGlobalTrajectory(
          playerX, playerY,
          roadLeft, roadRight,
          obstacles, [],
          scanTop
        );

        expect(path.length).toBeGreaterThan(5);
        // Перший же крок траєкторії (y = 575) повинен зміщуватися вбік від x=300
        const nearPoint = path.find(p => p.y === 575);
        expect(nearPoint).toBeDefined();
        expect(Math.abs(nearPoint!.x - 300)).toBeGreaterThan(20);
      });
    });

    describe('Vision Engine (Deadzone Elimination)', () => {
      it('should detect an obstacle located close in front of player (35-65px above head)', () => {
        const W = 300, H = 500;
        const pixels = Buffer.alloc(W * H * 4);

        // Заповнюємо дорогу (RGB: 194, 163, 117)
        for (let i = 0; i < W * H; i++) {
          pixels[i * 4] = 194;
          pixels[i * 4 + 1] = 163;
          pixels[i * 4 + 2] = 117;
          pixels[i * 4 + 3] = 255;
        }

        const playerX = 150;
        const playerY = 400;

        // Малюємо гравця (Y: 372..428, X: 129..171)
        for (let y = playerY - 28; y <= playerY + 28; y++) {
          for (let x = playerX - 21; x <= playerX + 21; x++) {
            const idx = (y * W + x) * 4;
            // Шкіра / одяг
            pixels[idx] = 220;
            pixels[idx + 1] = 160;
            pixels[idx + 2] = 120;
          }
        }

        // Малюємо перешкоду (могилу/камінь) на Y=340 (всього 60px вище центру гравця, тобто 32px вище голови)
        // Раніше зона 0..95px над гравцем повністю ігнорувалася!
        const obsX = 150, obsY = 340;
        for (let dy = -12; dy <= 12; dy++) {
          for (let dx = -12; dx <= 12; dx++) {
            const idx = ((obsY + dy) * W + (obsX + dx)) * 4;
            // Темно-сірий камінь (RGB: 80, 85, 100)
            pixels[idx] = 80;
            pixels[idx + 1] = 85;
            pixels[idx + 2] = 100;
          }
        }

        const cal: VisionCalibration = {
          roadR: 194, roadG: 163, roadB: 117,
          roadLeft: 50, roadRight: 250, playerBaseY: 400,
          dpr: 1, clipW: W, clipH: H,
        };

        const analysis = analyzeFrame({ width: W, height: H, pixels }, cal, 300, playerX);

        expect(analysis.obstacles.length).toBeGreaterThanOrEqual(1);
        const detectedNearObs = analysis.obstacles.find(o => Math.abs(o.x - obsX) < 25 && Math.abs(o.y - obsY) < 25);
        expect(detectedNearObs).toBeDefined();
        expect(detectedNearObs!.category).toBe('obstacle');
      });

      it('should accurately lock onto farmer with orange shirt and never confuse with a dark hole', () => {
        const W = 300, H = 500;
        const pixels = Buffer.alloc(W * H * 4);

        // Заповнюємо дорогу (RGB: 194, 163, 117)
        for (let i = 0; i < W * H; i++) {
          pixels[i * 4] = 194;
          pixels[i * 4 + 1] = 163;
          pixels[i * 4 + 2] = 117;
          pixels[i * 4 + 3] = 255;
        }

        const cal: VisionCalibration = {
          roadR: 194, roadG: 163, roadB: 117,
          roadLeft: 50, roadRight: 250, playerBaseY: 400,
          dpr: 1, clipW: W, clipH: H,
        };

        // 1. Справжній фермер ліворуч (X=90, Y=400): помаранчева сорочка + шкіра
        const farmerX = 90, farmerY = 400;
        for (let dy = -15; dy <= 15; dy++) {
          for (let dx = -10; dx <= 10; dx++) {
            const idx = ((farmerY + dy) * W + (farmerX + dx)) * 4;
            if (dy >= -5 && dy <= 5) {
              // Помаранчева футболка (R>170, G>60, B<65, R>G+25, G>B+20)
              pixels[idx] = 210; pixels[idx + 1] = 100; pixels[idx + 2] = 30;
            } else if (dy < -5) {
              // Обличчя
              pixels[idx] = 220; pixels[idx + 1] = 160; pixels[idx + 2] = 120;
            } else {
              // Сині штани
              pixels[idx] = 40; pixels[idx + 1] = 70; pixels[idx + 2] = 140;
            }
          }
        }

        // 2. Велика чорна яма праворуч (X=210, Y=400): темні пікселі
        const holeX = 210, holeY = 400;
        for (let dy = -18; dy <= 18; dy++) {
          for (let dx = -18; dx <= 18; dx++) {
            const idx = ((holeY + dy) * W + (holeX + dx)) * 4;
            // Глибока темна вирва (R<65, G<65, B<90)
            pixels[idx] = 25; pixels[idx + 1] = 28; pixels[idx + 2] = 45;
          }
        }

        // Запускаємо аналіз кадру (попередня позиція в центрі: 150)
        const analysis = analyzeFrame({ width: W, height: H, pixels }, cal, 300, 150);

        // Гравець повинен бути знайдений строго біля farmerX (90), а НЕ біля ями (210)!
        expect(Math.abs(analysis.playerX - farmerX)).toBeLessThanOrEqual(15);
        expect(Math.abs(analysis.playerX - holeX)).toBeGreaterThan(80);
      });

      it('calibrateFromFrame should detect road boundaries when surrounded by green borders', () => {
        const W = 400, H = 500;
        const pixels = Buffer.alloc(W * H * 4);

        // Ліворуч трава (X: 0..100)
        // Посередині піщана дорога (X: 101..299)
        // Праворуч трава (X: 300..399)
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const idx = (y * W + x) * 4;
            pixels[idx + 3] = 255;
            if (x <= 100 || x >= 300) {
              // Зелена трава: G > R + 20
              pixels[idx] = 70; pixels[idx + 1] = 145; pixels[idx + 2] = 60;
            } else {
              // Пісок: R=220, G=165, B=115
              pixels[idx] = 220; pixels[idx + 1] = 165; pixels[idx + 2] = 115;
            }
          }
        }

        const cal = calibrateFromFrame({ width: W, height: H, pixels });
        expect(cal).not.toBeNull();
        expect(cal!.roadLeft).toBeGreaterThanOrEqual(95);
        expect(cal!.roadLeft).toBeLessThanOrEqual(105);
        expect(cal!.roadRight).toBeGreaterThanOrEqual(295);
        expect(cal!.roadRight).toBeLessThanOrEqual(305);
        expect(cal!.roadR).toBeCloseTo(220, -1);
      });
    });

    describe('Phaser 60 FPS Engine Autopilot Mode', () => {
      it('should run via Phaser engine when active and succeed when targetScore reached', async () => {
        const logToClient = vi.fn();
        let evalCount = 0;
        const singleFrame = {
          evaluate: vi.fn().mockImplementation(async () => {
            evalCount++;
            if (evalCount === 1) return true;
            if (evalCount === 2) return { success: true };
            return {
              running: true,
              score: 2600,
              gameOver: false,
              gameWon: true,
              playerX: 200,
              playerY: 800,
              targetX: 200,
              roadLeft: 120,
              roadRight: 380,
              obstacles: [],
              collectibles: [],
              keyHeld: null,
            };
          }),
        };

        const mockPage = {
          isClosed: () => false,
          frames: () => [singleFrame],
          evaluate: vi.fn().mockResolvedValue(true),
          screenshot: vi.fn().mockResolvedValue(validPngBuffer),
          keyboard: {
            up: vi.fn().mockResolvedValue(undefined),
            down: vi.fn().mockResolvedValue(undefined),
          },
        };

        const params: Partial<NodeHandlerParams> = {
          currentNode: {
            id: 'node-phaser',
            type: 'fruitRunnerNode',
            data: { targetScore: 2500, maxDuration: 5000, engineMode: 'phaser' },
          } as any,
          activePage: mockPage as any,
          logToClient,
          context: {},
          takeDebugSnapshot: vi.fn(),
          smartSleep: vi.fn().mockResolvedValue(undefined),
          checkRunning: vi.fn().mockReturnValue(true),
        };

        const result = await fruitRunnerNodeHandler(params as NodeHandlerParams);
        expect(result.nextHandle).toBe('success');
        expect(result.data?.score).toBe(2600);
        expect(logToClient).toHaveBeenCalledWith(expect.stringContaining('Phaser Engine'), 'success');
      });

      it('should return failed handle if engineMode is phaser but Phaser is not found', async () => {
        const logToClient = vi.fn();
        const mockPage = {
          isClosed: () => false,
          frames: () => [{
            evaluate: vi.fn().mockResolvedValue(false), // No phaser
          }],
          evaluate: vi.fn().mockResolvedValue(false),
          screenshot: vi.fn().mockResolvedValue(validPngBuffer),
          keyboard: {
            up: vi.fn().mockResolvedValue(undefined),
            down: vi.fn().mockResolvedValue(undefined),
          },
        };

        const params: Partial<NodeHandlerParams> = {
          currentNode: {
            id: 'node-phaser-fail',
            type: 'fruitRunnerNode',
            data: { targetScore: 2500, maxDuration: 5000, engineMode: 'phaser' },
          } as any,
          activePage: mockPage as any,
          logToClient,
          context: {},
          takeDebugSnapshot: vi.fn(),
          smartSleep: vi.fn().mockResolvedValue(undefined),
          checkRunning: vi.fn().mockReturnValue(true),
        };

        const result = await fruitRunnerNodeHandler(params as NodeHandlerParams);
        expect(result.nextHandle).toBe('failed');
        expect(logToClient).toHaveBeenCalledWith(expect.stringContaining('Не вдалося знайти екземпляр Phaser'), 'error');
      });

      it('should verify INSTALL_PHASER_AUTOPILOT_SCRIPT has extraTop and segment collision checks', () => {
        expect(INSTALL_PHASER_AUTOPILOT_SCRIPT).toContain('extraTop = 5');
        expect(INSTALL_PHASER_AUTOPILOT_SCRIPT).toContain('isSegmentBlocked');
        expect(INSTALL_PHASER_AUTOPILOT_SCRIPT).toContain('isFruitSafe');
      });
    });
  });
});

