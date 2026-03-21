/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, RotateCcw, Trophy, AlertTriangle, Info, Home } from 'lucide-react';

// --- Constants ---
const COLORS = {
  RED: '#FF3B30',
  RED_DARK: '#8B0000',
  RED_LIGHT: '#FF6B6B',
  BLUE: '#007AFF',
  BLUE_DARK: '#003366',
  BLUE_LIGHT: '#5AC8FA',
  GREEN: '#4CD964',
  GREEN_DARK: '#1E5631',
  GREEN_LIGHT: '#A9DFBF',
  YELLOW: '#FFCC00',
  YELLOW_DARK: '#B8860B',
  YELLOW_LIGHT: '#FFFACD',
  BG: '#0A0E14',
  GRID: 'rgba(255, 255, 255, 0.03)',
  METAL: '#4A4A4A',
  METAL_DARK: '#2A2A2A',
  METAL_LIGHT: '#8E8E93',
  GOLD: '#D4AF37',
  GOLD_DARK: '#996515',
  GOLD_LIGHT: '#F9E79F',
  SORTER_GREEN: '#2D5A27',
};

const PARTICLE_SIZE = 5;
const GRAVITY = 0.28;
const FRICTION = 0.985;
const TUBE_WIDTH = 80;
const SORTER_LENGTH = 180;

type ColorType = 'RED' | 'BLUE' | 'GREEN' | 'YELLOW';

const LEVEL_CONFIGS: Record<number, { maxSand: number, colors: ColorType[], sorters: number, tubes: number, spawnInterval: number }> = {
  1: { maxSand: 400, colors: ['RED', 'BLUE'], sorters: 1, tubes: 2, spawnInterval: 100 },
  2: { maxSand: 500, colors: ['RED', 'GREEN'], sorters: 1, tubes: 2, spawnInterval: 95 },
  3: { maxSand: 600, colors: ['RED', 'BLUE', 'GREEN'], sorters: 3, tubes: 3, spawnInterval: 90 },
  4: { maxSand: 800, colors: ['BLUE', 'YELLOW'], sorters: 1, tubes: 2, spawnInterval: 85 },
  5: { maxSand: 1000, colors: ['RED', 'BLUE', 'YELLOW'], sorters: 3, tubes: 3, spawnInterval: 80 },
  6: { maxSand: 1200, colors: ['RED', 'BLUE', 'GREEN', 'YELLOW'], sorters: 6, tubes: 4, spawnInterval: 75 },
  7: { maxSand: 1400, colors: ['RED', 'GREEN', 'YELLOW'], sorters: 3, tubes: 3, spawnInterval: 70 },
  8: { maxSand: 1600, colors: ['BLUE', 'GREEN', 'YELLOW'], sorters: 3, tubes: 3, spawnInterval: 65 },
  9: { maxSand: 1800, colors: ['RED', 'BLUE', 'GREEN', 'YELLOW'], sorters: 6, tubes: 4, spawnInterval: 60 },
  10: { maxSand: 2200, colors: ['RED', 'BLUE', 'GREEN', 'YELLOW'], sorters: 6, tubes: 4, spawnInterval: 50 },
};

// Relative positions (percentage of screen height)
const FUNNEL_Y_RATIO = 0.22;
const SORTER_Y_RATIO = 0.55;
const TUBE_Y_RATIO = 0.82;
const TUBE_HEIGHT_RATIO = 0.15;

// --- Types ---
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  type: ColorType;
  active: boolean;
  onSorterId?: number;
  lastSorterId?: number;
  sorterCooldown?: number;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [gameState, setGameState] = useState<'home' | 'playing' | 'gameover' | 'win'>('home');
  const [level, setLevel] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [spillage, setSpillage] = useState(0);
  const [sorterAngles, setSorterAngles] = useState([25, 25, 25]); // Array for multiple sorters
  const [sandRemaining, setSandRemaining] = useState(500);
  const [score, setScore] = useState(0);
  const isGameOverTriggered = useRef(false);

  const gameData = useRef({
    particles: [] as Particle[],
    lastTime: 0,
    width: 0,
    height: 0,
    spawnTimer: 0,
    totalSpawned: 0,
    maxSand: 800,
    spilledCount: 0,
    layerSize: 40, // Number of particles per color layer
    upcomingColors: [] as ColorType[],
    initialCounts: { RED: 0, BLUE: 0, GREEN: 0, YELLOW: 0 },
    gameTime: 0,
    beads: [] as { ry: number; rx: number; offset: number }[],
    tubes: [] as { red: number; blue: number; green: number; yellow: number }[],
    splashes: [] as { x: number, y: number, color: string, life: number }[],
    dust: [] as { x: number, y: number, vx: number, vy: number, size: number, opacity: number }[],
  });

  const initGame = (targetLevel: number) => {
    setLevel(targetLevel);
    
    const width = containerRef.current?.clientWidth || window.innerWidth;
    const height = containerRef.current?.clientHeight || window.innerHeight;
    gameData.current.width = width;
    gameData.current.height = height;
    gameData.current.particles = [];
    gameData.current.totalSpawned = 0;
    gameData.current.spilledCount = 0;
    gameData.current.spawnTimer = 0;
    
    const config = LEVEL_CONFIGS[targetLevel] || LEVEL_CONFIGS[1];
    setSorterAngles(Array(config.sorters).fill(25));
    gameData.current.tubes = Array(config.tubes).fill(null).map(() => ({ red: 0, blue: 0, green: 0, yellow: 0 }));
    
    gameData.current.splashes = [];
    gameData.current.dust = [];
    
    // Initialize dust
    for (let i = 0; i < 40; i++) {
      gameData.current.dust.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 3 + 1,
        opacity: Math.random() * 0.4 + 0.1
      });
    }
    
    // Pre-fill upcoming colors
    const upcoming: ColorType[] = [];
    const maxSand = config.maxSand;
    gameData.current.maxSand = maxSand;
    
    const colorCount = config.colors.length;
    const perColor = Math.floor(maxSand / colorCount);
    
    for (let i = 0; i < maxSand; i++) {
      const colorIdx = Math.min(colorCount - 1, Math.floor(i / perColor));
      upcoming.push(config.colors[colorIdx]);
    }
    
    gameData.current.upcomingColors = upcoming;
    gameData.current.initialCounts = {
      RED: upcoming.filter(c => c === 'RED').length,
      BLUE: upcoming.filter(c => c === 'BLUE').length,
      GREEN: upcoming.filter(c => c === 'GREEN').length,
      YELLOW: upcoming.filter(c => c === 'YELLOW').length,
    };
    gameData.current.gameTime = 0;
    gameData.current.beads = [];
    for (let i = 0; i < 20; i++) {
      gameData.current.beads.push({
        ry: Math.random(),
        rx: Math.random(),
        offset: Math.random() * Math.PI * 2
      });
    }
    
    setSpillage(0);
    setScore(0);
    setSandRemaining(maxSand);
    setGameState('playing');
    setIsPaused(false);
    isGameOverTriggered.current = false;
    setSorterAngles(Array(config.sorters).fill(25));
  };

  const handleInteraction = (e: React.PointerEvent) => {
    if (gameState !== 'playing' || isPaused) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const sorterY = gameData.current.height * SORTER_Y_RATIO;
    const config = LEVEL_CONFIGS[level] || LEVEL_CONFIGS[1];
    const TIP_OFFSET = (SORTER_LENGTH / 2) * Math.cos(25 * Math.PI / 180);
    const sorterConfigs = [];
    if (config.sorters === 1) {
      sorterConfigs.push({ x: gameData.current.width / 2, y: sorterY });
    } else if (config.sorters === 3) {
      sorterConfigs.push({ x: gameData.current.width / 2, y: sorterY - 100 });
      sorterConfigs.push({ x: gameData.current.width / 2 - TIP_OFFSET, y: sorterY + 60 });
      sorterConfigs.push({ x: gameData.current.width / 2 + TIP_OFFSET, y: sorterY + 60 });
    } else if (config.sorters === 6) {
      // 4 tubes layout: 1 top, 2 middle, 3 bottom
      sorterConfigs.push({ x: gameData.current.width / 2, y: sorterY - 150 }); // Top
      sorterConfigs.push({ x: gameData.current.width / 2 - TIP_OFFSET, y: sorterY - 30 }); // Middle L
      sorterConfigs.push({ x: gameData.current.width / 2 + TIP_OFFSET, y: sorterY - 30 }); // Middle R
      sorterConfigs.push({ x: gameData.current.width / 2 - TIP_OFFSET * 2, y: sorterY + 90 }); // Bottom L
      sorterConfigs.push({ x: gameData.current.width / 2, y: sorterY + 90 }); // Bottom M
      sorterConfigs.push({ x: gameData.current.width / 2 + TIP_OFFSET * 2, y: sorterY + 90 }); // Bottom R
    }

    let closestIdx = -1;
    let minDist = 120; // Click radius for sorter

    sorterConfigs.forEach((config, idx) => {
      const dist = Math.sqrt((x - config.x) ** 2 + (y - config.y) ** 2);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = idx;
      }
    });

    if (closestIdx !== -1) {
      setSorterAngles(prev => {
        const next = [...prev];
        next[closestIdx] = next[closestIdx] > 0 ? -25 : 25;
        return next;
      });
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const update = (time: number) => {
      if (gameState !== 'playing' || isPaused) {
        gameData.current.lastTime = time;
        draw();
        animationFrameId = requestAnimationFrame(update);
        return;
      }

      const dt = time - gameData.current.lastTime;
      gameData.current.lastTime = time;
      gameData.current.gameTime += dt;

      const { width, height, particles, upcomingColors, maxSand } = gameData.current;

      const funnelY = height * FUNNEL_Y_RATIO;
      const sorterY = height * SORTER_Y_RATIO;
      const tubeY = height * TUBE_Y_RATIO;
      const tubeHeight = height * TUBE_HEIGHT_RATIO;

      // 1. Spawn Particles from Queue
      const config = LEVEL_CONFIGS[level] || LEVEL_CONFIGS[1];
      if (gameData.current.totalSpawned < maxSand) {
        // Slow down spawn rate to give time to sort
        gameData.current.spawnTimer += dt;
        if (gameData.current.spawnTimer > config.spawnInterval) { 
          gameData.current.spawnTimer = 0;
          const type = upcomingColors.shift() || 'RED';
          let particleColor = COLORS.RED;
          if (type === 'BLUE') particleColor = COLORS.BLUE;
          if (type === 'GREEN') particleColor = COLORS.GREEN;
          if (type === 'YELLOW') particleColor = COLORS.YELLOW;
          
          particles.push({
            x: width / 2,
            y: funnelY + 80, // Exit point of the new 3D funnel
            vx: 0,
            vy: 3 + Math.random() * 2,
            color: particleColor,
            type: type,
            active: true,
          });
          gameData.current.totalSpawned++;
        }
        setSandRemaining(maxSand - gameData.current.totalSpawned);
      } else if (particles.length === 0) {
        setGameState('win');
      }

      // 2. Update Particles
      const sorterConfigs = [];
      const TIP_OFFSET = (SORTER_LENGTH / 2) * Math.cos(25 * Math.PI / 180);
      
      if (config.sorters === 1) {
        sorterConfigs.push({ x: width / 2, y: sorterY, angle: sorterAngles[0], length: SORTER_LENGTH, id: 0 });
      } else if (config.sorters === 3) {
        sorterConfigs.push({ x: width / 2, y: sorterY - 100, angle: sorterAngles[0], length: SORTER_LENGTH, id: 0 });
        sorterConfigs.push({ x: width / 2 - TIP_OFFSET, y: sorterY + 60, angle: sorterAngles[1], length: SORTER_LENGTH, id: 1 });
        sorterConfigs.push({ x: width / 2 + TIP_OFFSET, y: sorterY + 60, angle: sorterAngles[2], length: SORTER_LENGTH, id: 2 });
      } else if (config.sorters === 6) {
        sorterConfigs.push({ x: width / 2, y: sorterY - 150, angle: sorterAngles[0], length: SORTER_LENGTH, id: 0 });
        sorterConfigs.push({ x: width / 2 - TIP_OFFSET, y: sorterY - 30, angle: sorterAngles[1], length: SORTER_LENGTH, id: 1 });
        sorterConfigs.push({ x: width / 2 + TIP_OFFSET, y: sorterY - 30, angle: sorterAngles[2], length: SORTER_LENGTH, id: 2 });
        sorterConfigs.push({ x: width / 2 - TIP_OFFSET * 2, y: sorterY + 90, angle: sorterAngles[3], length: SORTER_LENGTH, id: 3 });
        sorterConfigs.push({ x: width / 2, y: sorterY + 90, angle: sorterAngles[4], length: SORTER_LENGTH, id: 4 });
        sorterConfigs.push({ x: width / 2 + TIP_OFFSET * 2, y: sorterY + 90, angle: sorterAngles[5], length: SORTER_LENGTH, id: 5 });
      }

      let tubePositions = [];
      if (config.tubes === 2) {
        tubePositions = [width / 2 - TIP_OFFSET, width / 2 + TIP_OFFSET];
      } else if (config.tubes === 3) {
        tubePositions = [width / 2 - TIP_OFFSET * 2, width / 2, width / 2 + TIP_OFFSET * 2];
      } else if (config.tubes === 4) {
        tubePositions = [width / 2 - TIP_OFFSET * 3, width / 2 - TIP_OFFSET, width / 2 + TIP_OFFSET, width / 2 + TIP_OFFSET * 3];
      }
      
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        
        if (p.onSorterId !== undefined) {
          const sConf = sorterConfigs.find(s => s.id === p.onSorterId);
          if (!sConf) {
            p.onSorterId = undefined;
          } else {
            const sLen = sConf.length || SORTER_LENGTH;
            const rad = (sConf.angle * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            
            // Current relative position along sorter
            const dx = p.x - sConf.x;
            const dy = p.y - sConf.y;
            const distAlong = dx * cos + dy * sin;
            
            // Slide along
            const slideSpeed = 4.5;
            const nextDistAlong = distAlong + (sConf.angle > 0 ? slideSpeed : -slideSpeed);
            
            if (Math.abs(nextDistAlong) > sLen / 2) {
              // Fell off the end
              p.onSorterId = undefined;
              // Snap to tip for straight fall
              const tipX = sConf.x + (nextDistAlong > 0 ? sLen / 2 : -sLen / 2) * cos + sin * 9;
              const tipY = sConf.y + (nextDistAlong > 0 ? sLen / 2 : -sLen / 2) * sin - cos * 9;
              p.x = tipX;
              p.y = tipY + 10; // Move well below the tip to avoid immediate re-collision
              p.vx = 0;
              p.vy = 2; // Initial downward nudge
              p.lastSorterId = sConf.id;
              p.sorterCooldown = 5; // 5 frames of no collision with this sorter
            } else {
              // Stay on sorter
              p.x = sConf.x + nextDistAlong * cos + sin * 9;
              p.y = sConf.y + nextDistAlong * sin - cos * 9; // Slide on top surface (sHeight=18)
              p.vx = 0;
              p.vy = 0;
              continue; // Skip normal gravity/movement
            }
          }
        }

        p.vx *= 0.95; 
        p.vy += GRAVITY;
        if (p.sorterCooldown && p.sorterCooldown > 0) p.sorterCooldown--;
        
        const prevX = p.x;
        const prevY = p.y;
        const nextX = p.x + p.vx;
        const nextY = p.y + p.vy;

        // Collision with Sorters
        for (const sConf of sorterConfigs) {
          const sLen = sConf.length || SORTER_LENGTH;
          const rad = (sConf.angle * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          
          // Offset to top surface (sHeight=18)
          const sX1 = sConf.x - cos * (sLen / 2) + sin * 9;
          const sY1 = sConf.y - sin * (sLen / 2) - cos * 9;
          const sX2 = sConf.x + cos * (sLen / 2) + sin * 9;
          const sY2 = sConf.y + sin * (sLen / 2) - cos * 9;

          const intersect = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) => {
            const det = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
            if (det === 0) return null;
            const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / det;
            const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / det;
            if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
              return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
            }
            return null;
          };

          const hit = intersect(prevX, prevY, nextX, nextY + 2, sX1, sY1, sX2, sY2);
          if (hit) {
            // Check cooldown
            if (p.lastSorterId === sConf.id && p.sorterCooldown && p.sorterCooldown > 0) {
              continue;
            }
            p.onSorterId = sConf.id;
            p.x = hit.x;
            p.y = hit.y - 2;
            p.vx = 0;
            p.vy = 0;
            break;
          }
        }

        if (p.onSorterId === undefined) {
          p.x += p.vx;
          p.y += p.vy;
        }

        // Collision with Tubes and Accumulation
        const checkTube = (tubeX: number, tubeIndex: number) => {
          // Check if particle is horizontally within the tube
          if (p.x > tubeX - TUBE_WIDTH/2 && p.x < tubeX + TUBE_WIDTH/2) {
            
            // If particle is above the tube opening, it's just falling
            if (p.y < tubeY) return false;

            // If particle is inside the tube, constrain its X so it doesn't "leak" out the sides
            // This makes it fall "smoothly" inside the tube
            p.x = Math.max(tubeX - TUBE_WIDTH/2 + 2, Math.min(tubeX + TUBE_WIDTH/2 - 2, p.x));
            p.vx *= 0.5; // Dampen horizontal velocity inside tube

            const tubeData = gameData.current.tubes[tubeIndex];
            if (!tubeData) return false;
            
            const total = tubeData.red + tubeData.blue + tubeData.green + tubeData.yellow;
            const fillHeight = Math.min(tubeHeight - 10, total * 0.5);
            const surfaceY = tubeY + tubeHeight - 5 - fillHeight;

            // If particle hits the surface or the bottom of the tube
            if (p.y >= surfaceY) {
              if (p.type === 'RED') tubeData.red++;
              else if (p.type === 'BLUE') tubeData.blue++;
              else if (p.type === 'GREEN') tubeData.green++;
              else if (p.type === 'YELLOW') tubeData.yellow++;
              
              const correctColor = config.colors[tubeIndex];
              const isCorrect = p.type === correctColor;
              
              if (isCorrect) {
                setScore(s => s + 10);
                gameData.current.splashes.push({
                  x: p.x,
                  y: surfaceY,
                  color: p.color,
                  life: 1.0
                });
              } else {
                gameData.current.spilledCount++;
              }
              
              particles.splice(i, 1);
              return true;
            }
          }
          return false;
        };

        let hitTube = false;
        for (let tIdx = 0; tIdx < tubePositions.length; tIdx++) {
          if (checkTube(tubePositions[tIdx], tIdx)) {
            hitTube = true;
            break;
          }
        }
        if (hitTube) continue;

        // Floor collision (Spill)
        if (p.y > height) {
          gameData.current.spilledCount++;
          particles.splice(i, 1);
        }
      }

      // Calculate Spillage (Actual percentage of total sand)
      const actualSpillPercent = (gameData.current.spilledCount / maxSand) * 100;
      setSpillage(prev => {
        if (Math.abs(prev - actualSpillPercent) < 0.001) return prev;
        return actualSpillPercent;
      });

      if (actualSpillPercent >= 10 && gameState === 'playing' && !isGameOverTriggered.current) {
        isGameOverTriggered.current = true;
        setIsPaused(true);
        setTimeout(() => {
          setGameState('gameover');
        }, 1000);
      }

      // Update Splashes
      for (let i = gameData.current.splashes.length - 1; i >= 0; i--) {
        gameData.current.splashes[i].life -= 0.05;
        if (gameData.current.splashes[i].life <= 0) {
          gameData.current.splashes.splice(i, 1);
        }
      }

      // Update Dust
      gameData.current.dust.forEach(d => {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 0) d.x = width;
        if (d.x > width) d.x = 0;
        if (d.y < 0) d.y = height;
        if (d.y > height) d.y = 0;
      });

      draw();
      animationFrameId = requestAnimationFrame(update);
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const { width, height, particles, upcomingColors, tubes } = gameData.current;

      const funnelY = height * FUNNEL_Y_RATIO;
      const sorterY = height * SORTER_Y_RATIO;
      const tubeY = height * TUBE_Y_RATIO;
      const tubeHeight = height * TUBE_HEIGHT_RATIO;
      const config = LEVEL_CONFIGS[level] || LEVEL_CONFIGS[1];

      // --- Draw Laboratory Background ---
      ctx.fillStyle = COLORS.BG;
      ctx.fillRect(0, 0, width, height);

      // Grid Pattern
      ctx.strokeStyle = COLORS.GRID;
      ctx.lineWidth = 1;
      const gridSize = 60;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }

      // --- Draw Dust/Stars ---
      gameData.current.dust.forEach(d => {
        ctx.globalAlpha = d.opacity;
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // --- Draw Source Tank (High-Quality 3D Design) ---
      const drawSourceTank = () => {
        const tx = width / 2;
        const ty = funnelY - 160;
        const chamberCount = config.colors.length;
        const chamberWidth = 65;
        const chamberHeight = 100;
        const spacing = 85;
        const totalWidth = (chamberCount - 1) * spacing + chamberWidth + 40;
        
        // 1. Brushed Metal Frame (Back & Structure)
        ctx.save();
        const frameGrad = ctx.createLinearGradient(tx - totalWidth/2, 0, tx + totalWidth/2, 0);
        frameGrad.addColorStop(0, '#2a2a2a');
        frameGrad.addColorStop(0.3, '#555');
        frameGrad.addColorStop(0.5, '#666');
        frameGrad.addColorStop(0.7, '#555');
        frameGrad.addColorStop(1, '#2a2a2a');
        
        ctx.fillStyle = frameGrad;
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        
        // Top Bar
        ctx.beginPath();
        ctx.roundRect(tx - totalWidth/2, ty - 15, totalWidth, 30, 8);
        ctx.fill();
        
        // Bottom Bar
        ctx.beginPath();
        ctx.roundRect(tx - totalWidth/2, ty + chamberHeight - 15, totalWidth, 30, 8);
        ctx.fill();
        
        // Side Pillars
        for (let i = 0; i <= chamberCount; i++) {
          const px = tx - ((chamberCount - 1) * spacing) / 2 - spacing/2 + i * spacing;
          if (i > 0 && i < chamberCount) {
             // Intermediate pillars
             ctx.fillStyle = '#333';
             ctx.fillRect(px - 4, ty + 15, 8, chamberHeight - 30);
          }
        }
        ctx.restore();

        // 2. Glass Chambers
        for (let i = 0; i < chamberCount; i++) {
          const cx = tx - ((chamberCount - 1) * spacing) / 2 + i * spacing;
          const cy = ty;
          const colorType = config.colors[i];
          
          // Metallic Top Cap
          ctx.save();
          const capGrad = ctx.createLinearGradient(cx - chamberWidth/2, 0, cx + chamberWidth/2, 0);
          capGrad.addColorStop(0, '#333');
          capGrad.addColorStop(0.5, '#666');
          capGrad.addColorStop(1, '#333');
          ctx.fillStyle = capGrad;
          ctx.beginPath();
          ctx.ellipse(cx, cy - 10, chamberWidth/2 + 2, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Glass Body (Cylindrical)
          ctx.save();
          const glassGrad = ctx.createLinearGradient(cx - chamberWidth/2, 0, cx + chamberWidth/2, 0);
          glassGrad.addColorStop(0, 'rgba(255,255,255,0.05)');
          glassGrad.addColorStop(0.2, 'rgba(255,255,255,0.2)');
          glassGrad.addColorStop(0.5, 'rgba(255,255,255,0.05)');
          glassGrad.addColorStop(0.8, 'rgba(255,255,255,0.2)');
          glassGrad.addColorStop(1, 'rgba(255,255,255,0.05)');
          
          ctx.fillStyle = glassGrad;
          ctx.strokeStyle = 'rgba(255,255,255,0.2)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(cx - chamberWidth/2, cy, chamberWidth, chamberHeight, 5);
          ctx.fill();
          ctx.stroke();
          
          // Sand inside (Mounded)
          const currentCount = upcomingColors.filter(c => c === colorType).length;
          const initialCount = gameData.current.initialCounts[colorType];
          const fillRatio = initialCount > 0 ? currentCount / initialCount : 0;
          const fillHeight = (chamberHeight - 10) * fillRatio;
          
          if (fillHeight > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(cx - chamberWidth/2 + 2, cy + chamberHeight - fillHeight, chamberWidth - 4, fillHeight);
            ctx.clip();
            
            const sandGrad = ctx.createLinearGradient(cx - chamberWidth/2, 0, cx + chamberWidth/2, 0);
            const colorDark = COLORS[`${colorType}_DARK` as keyof typeof COLORS];
            const colorLight = COLORS[`${colorType}_LIGHT` as keyof typeof COLORS];

            sandGrad.addColorStop(0, colorDark);
            sandGrad.addColorStop(0.5, colorLight);
            sandGrad.addColorStop(1, colorDark);
            
            ctx.fillStyle = sandGrad;
            ctx.beginPath();
            ctx.fillRect(cx - chamberWidth/2 + 2, cy + chamberHeight - fillHeight, chamberWidth - 4, fillHeight);
            ctx.fill();
            
            // Mounded Top
            ctx.fillStyle = colorLight;
            ctx.beginPath();
            ctx.ellipse(cx, cy + chamberHeight - fillHeight, chamberWidth/2 - 2, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          
          // "SOURCE %" Label
          ctx.save();
          const labelY = cy + chamberHeight/2;
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.beginPath();
          ctx.roundRect(cx - 22, labelY - 15, 44, 30, 4);
          ctx.fill();
          
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.font = 'bold 8px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('SOURCE', cx, labelY - 3);
          ctx.fillStyle = 'white';
          ctx.font = 'bold 11px sans-serif';
          ctx.fillText(`${Math.round(fillRatio * 100)}%`, cx, labelY + 10);
          ctx.restore();

          // Glowing LED Ring at Bottom
          ctx.save();
          const ringY = cy + chamberHeight + 5;
          ctx.shadowBlur = 15;
          const color = COLORS[colorType as keyof typeof COLORS];
          ctx.shadowColor = color;
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.8;
          ctx.beginPath();
          ctx.ellipse(cx, ringY, chamberWidth/2 - 2, 4, 0, 0, Math.PI * 2);
          ctx.fill();
          
          // LED segments
          ctx.globalAlpha = 1.0;
          ctx.fillStyle = 'white';
          for (let j = 0; j < 8; j++) {
            const angle = (j * Math.PI) / 4 + (gameData.current.gameTime * 0.001);
            const lx = cx + Math.cos(angle) * (chamberWidth/2 - 4);
            const ly = ringY + Math.sin(angle) * 2;
            ctx.beginPath();
            ctx.arc(lx, ly, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
          
          ctx.restore();
        }

        // 3. Shiny Curved Pipes (Chambers to Funnel)
        for (let i = 0; i < chamberCount; i++) {
          const cx = tx - ((chamberCount - 1) * spacing) / 2 + i * spacing;
          const startY = ty + chamberHeight + 10;
          const endX = tx;
          const endY = ty + chamberHeight + 40; // Funnel top

          ctx.save();
          // Pipe Shadow
          ctx.shadowBlur = 10;
          ctx.shadowColor = 'rgba(0,0,0,0.4)';
          
          const pipeGrad = ctx.createLinearGradient(cx - 7, 0, cx + 7, 0);
          pipeGrad.addColorStop(0, '#333');
          pipeGrad.addColorStop(0.3, '#888');
          pipeGrad.addColorStop(0.5, '#fff');
          pipeGrad.addColorStop(0.7, '#888');
          pipeGrad.addColorStop(1, '#333');
          
          ctx.strokeStyle = pipeGrad;
          ctx.lineWidth = 12;
          ctx.lineCap = 'round';
          
          ctx.beginPath();
          ctx.moveTo(cx, startY);
          // Elegant curve to the central funnel
          ctx.bezierCurveTo(cx, startY + 25, endX, endY - 25, endX, endY);
          ctx.stroke();
          
          // Shiny Highlight
          ctx.strokeStyle = 'rgba(255,255,255,0.4)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx - 3, startY);
          ctx.bezierCurveTo(cx - 3, startY + 25, endX - 3, endY - 25, endX - 3, endY);
          ctx.stroke();
          
          // Joint at the tank
          ctx.fillStyle = '#222';
          ctx.beginPath();
          ctx.roundRect(cx - 8, startY - 2, 16, 6, 2);
          ctx.fill();
          
          ctx.restore();
        }

        // 4. 3D Glass Funnel (Mixing Nozzle)
        const nozzleY = ty + chamberHeight + 40;
        const funnelTopWidth = 70;
        const funnelBottomWidth = 12;
        const funnelHeight = 60;
        
        ctx.save();
        ctx.translate(tx, nozzleY);
        
        // Funnel Glass Body
        const funnelGrad = ctx.createLinearGradient(-funnelTopWidth/2, 0, funnelTopWidth/2, 0);
        funnelGrad.addColorStop(0, 'rgba(255,255,255,0.1)');
        funnelGrad.addColorStop(0.5, 'rgba(255,255,255,0.3)');
        funnelGrad.addColorStop(1, 'rgba(255,255,255,0.1)');
        
        ctx.fillStyle = funnelGrad;
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1.5;
        
        ctx.beginPath();
        ctx.moveTo(-funnelTopWidth/2, 0);
        ctx.lineTo(funnelTopWidth/2, 0);
        ctx.lineTo(funnelBottomWidth/2, funnelHeight);
        ctx.lineTo(-funnelBottomWidth/2, funnelHeight);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Funnel Rim (Top)
        ctx.beginPath();
        ctx.ellipse(0, 0, funnelTopWidth/2, 8, 0, 0, Math.PI * 2);
        ctx.stroke();
        
        // Sand accumulating in Funnel
        if (upcomingColors.length > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(-funnelTopWidth/2 + 5, 5);
          ctx.lineTo(funnelTopWidth/2 - 5, 5);
          ctx.lineTo(funnelBottomWidth/2 - 1, funnelHeight - 2);
          ctx.lineTo(-funnelBottomWidth/2 + 1, funnelHeight - 2);
          ctx.clip();
          
          for (let i = 0; i < gameData.current.beads.length; i++) {
            const bead = gameData.current.beads[i];
            const ry = (bead.ry + gameData.current.gameTime * 0.0005) % 1;
            const rw = funnelTopWidth - (funnelTopWidth - funnelBottomWidth) * ry - 10;
            const bx = -rw/2 + bead.rx * rw;
            const by = ry * funnelHeight;
            const color = upcomingColors[i % upcomingColors.length];
            ctx.fillStyle = color === 'RED' ? COLORS.RED : color === 'BLUE' ? COLORS.BLUE : COLORS.GREEN;
            ctx.beginPath();
            ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
        
        // Funnel Stem
        const stemGrad = ctx.createLinearGradient(-funnelBottomWidth/2, 0, funnelBottomWidth/2, 0);
        stemGrad.addColorStop(0, 'rgba(255,255,255,0.1)');
        stemGrad.addColorStop(0.5, 'rgba(255,255,255,0.3)');
        stemGrad.addColorStop(1, 'rgba(255,255,255,0.1)');
        ctx.fillStyle = stemGrad;
        ctx.beginPath();
        ctx.fillRect(-funnelBottomWidth/2, funnelHeight, funnelBottomWidth, 20);
        ctx.strokeRect(-funnelBottomWidth/2, funnelHeight, funnelBottomWidth, 20);
        
        // Exit nozzle detail
        ctx.fillStyle = '#444';
        ctx.fillRect(-funnelBottomWidth/2 - 2, funnelHeight + 18, funnelBottomWidth + 4, 4);
        
        ctx.restore();
      };
      drawSourceTank();

      // --- Draw Sorters (Redesigned based on reference image) ---
      const TIP_OFFSET = (SORTER_LENGTH / 2) * Math.cos(25 * Math.PI / 180);
      let tubePositions = [];
      if (config.tubes === 2) {
        tubePositions = [width / 2 - TIP_OFFSET, width / 2 + TIP_OFFSET];
      } else if (config.tubes === 3) {
        tubePositions = [width / 2 - TIP_OFFSET * 2, width / 2, width / 2 + TIP_OFFSET * 2];
      } else if (config.tubes === 4) {
        tubePositions = [width / 2 - TIP_OFFSET * 3, width / 2 - TIP_OFFSET, width / 2 + TIP_OFFSET, width / 2 + TIP_OFFSET * 3];
      }

      const sorterConfigs = [];
      if (config.sorters === 1) {
        sorterConfigs.push({ x: width / 2, y: sorterY, angle: sorterAngles[0], length: SORTER_LENGTH });
      } else if (config.sorters === 3) {
        sorterConfigs.push({ x: width / 2, y: sorterY - 100, angle: sorterAngles[0], length: SORTER_LENGTH });
        sorterConfigs.push({ x: width / 2 - TIP_OFFSET, y: sorterY + 60, angle: sorterAngles[1], length: SORTER_LENGTH });
        sorterConfigs.push({ x: width / 2 + TIP_OFFSET, y: sorterY + 60, angle: sorterAngles[2], length: SORTER_LENGTH });
      } else if (config.sorters === 6) {
        sorterConfigs.push({ x: width / 2, y: sorterY - 150, angle: sorterAngles[0], length: SORTER_LENGTH });
        sorterConfigs.push({ x: width / 2 - TIP_OFFSET, y: sorterY - 30, angle: sorterAngles[1], length: SORTER_LENGTH });
        sorterConfigs.push({ x: width / 2 + TIP_OFFSET, y: sorterY - 30, angle: sorterAngles[2], length: SORTER_LENGTH });
        sorterConfigs.push({ x: width / 2 - TIP_OFFSET * 2, y: sorterY + 90, angle: sorterAngles[3], length: SORTER_LENGTH });
        sorterConfigs.push({ x: width / 2, y: sorterY + 90, angle: sorterAngles[4], length: SORTER_LENGTH });
        sorterConfigs.push({ x: width / 2 + TIP_OFFSET * 2, y: sorterY + 90, angle: sorterAngles[5], length: SORTER_LENGTH });
      }

      sorterConfigs.forEach((sConf, idx) => {
        const sLen = sConf.length || SORTER_LENGTH;
        const rad = (sConf.angle * Math.PI) / 180;
        const sHeight = 18;
        
        ctx.save();
        ctx.translate(sConf.x, sConf.y);
        ctx.rotate(rad);
        
        // 1. Main Glass Tube Body
        const tubeGrad = ctx.createLinearGradient(0, -sHeight/2, 0, sHeight/2);
        tubeGrad.addColorStop(0, 'rgba(40, 10, 10, 0.9)');
        tubeGrad.addColorStop(0.3, 'rgba(120, 20, 20, 0.8)');
        tubeGrad.addColorStop(0.5, 'rgba(255, 50, 50, 0.7)');
        tubeGrad.addColorStop(0.7, 'rgba(120, 20, 20, 0.8)');
        tubeGrad.addColorStop(1, 'rgba(40, 10, 10, 0.9)');
        
        ctx.fillStyle = tubeGrad;
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(255, 0, 0, 0.5)';
        
        ctx.beginPath();
        ctx.roundRect(-sLen/2, -sHeight/2, sLen, sHeight, 16);
        ctx.fill();

        // 2. Swirly Patterns (Filigree)
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        
        const drawSwirl = (startX: number, direction: number) => {
          ctx.beginPath();
          ctx.moveTo(startX, 0);
          ctx.bezierCurveTo(
            startX + 20 * direction, -15,
            startX + 40 * direction, 15,
            startX + 60 * direction, 0
          );
          ctx.stroke();
          
          ctx.beginPath();
          ctx.moveTo(startX + 10 * direction, -5);
          ctx.bezierCurveTo(
            startX + 30 * direction, -20,
            startX + 50 * direction, 10,
            startX + 70 * direction, -5
          );
          ctx.stroke();
        };

        drawSwirl(-sLen/2 + 10, 1);
        drawSwirl(-sLen/2 + 30, 1);
        drawSwirl(sLen/2 - 10, -1);
        drawSwirl(sLen/2 - 30, -1);
        ctx.restore();

        // 3. Metallic End Caps
        const capWidth = 12;
        const drawCap = (x: number) => {
          const capGrad = ctx.createLinearGradient(x - capWidth/2, 0, x + capWidth/2, 0);
          capGrad.addColorStop(0, '#444');
          capGrad.addColorStop(0.5, '#AAA');
          capGrad.addColorStop(1, '#444');
          ctx.fillStyle = capGrad;
          ctx.beginPath();
          ctx.roundRect(x - capWidth/2, -sHeight/2 - 2, capWidth, sHeight + 4, 4);
          ctx.fill();
        };
        drawCap(-sLen/2);
        drawCap(sLen/2);

        // 4. Central Pivot Joint
        ctx.save();
        ctx.rotate(-rad); // Keep pivot upright
        
        // Outer Ring
        const ringGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 16);
        ringGrad.addColorStop(0, '#888');
        ringGrad.addColorStop(0.5, '#EEE');
        ringGrad.addColorStop(1, '#888');
        ctx.fillStyle = ringGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner Circle
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        
        // Center Bolt
        const boltGrad = ctx.createRadialGradient(-2, -2, 0, 0, 0, 6);
        boltGrad.addColorStop(0, '#AAA');
        boltGrad.addColorStop(1, '#444');
        ctx.fillStyle = boltGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Rotation Arrow Indicator
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 30, -Math.PI * 0.7, -Math.PI * 0.3);
        ctx.stroke();
        
        // Arrowheads
        const drawArrowhead = (angle: number) => {
          ctx.save();
          ctx.rotate(angle);
          ctx.translate(30, 0);
          ctx.beginPath();
          ctx.moveTo(-4, -4);
          ctx.lineTo(0, 0);
          ctx.lineTo(-4, 4);
          ctx.stroke();
          ctx.restore();
        };
        drawArrowhead(-Math.PI * 0.7);
        drawArrowhead(-Math.PI * 0.3);
        
        ctx.restore();
        ctx.restore();
      });

      // --- Draw Bottom Platform (Large Metallic Base) ---
      const drawPlatform = () => {
        const platformX = width / 2;
        const platformY = tubeY + tubeHeight + 15;
        const platformW = config.tubes === 2 ? 400 : 560;
        const platformH = 60;

        ctx.save();
        // Main Platform Body
        const platGrad = ctx.createLinearGradient(platformX - platformW/2, 0, platformX + platformW/2, 0);
        platGrad.addColorStop(0, '#1a1a1a');
        platGrad.addColorStop(0.2, '#333');
        platGrad.addColorStop(0.5, '#444');
        platGrad.addColorStop(0.8, '#333');
        platGrad.addColorStop(1, '#1a1a1a');
        
        ctx.fillStyle = platGrad;
        ctx.shadowBlur = 30;
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.beginPath();
        ctx.roundRect(platformX - platformW/2, platformY, platformW, platformH, 20);
        ctx.fill();

        // Top Surface Highlight
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(platformX - platformW/2 + 2, platformY + 2, platformW - 4, platformH - 4, 18);
        ctx.stroke();

        // Techy Details (Lines/Circuitry)
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(platformX - platformW/2 + 40, platformY + 20 + i * 10);
          ctx.lineTo(platformX - platformW/2 + 100, platformY + 20 + i * 10);
          ctx.stroke();
          
          ctx.beginPath();
          ctx.moveTo(platformX + platformW/2 - 40, platformY + 20 + i * 10);
          ctx.lineTo(platformX + platformW/2 - 100, platformY + 20 + i * 10);
          ctx.stroke();
        }

        // Central Light Strip
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(255,255,255,0.3)';
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.roundRect(platformX - 40, platformY + platformH - 15, 80, 4, 2);
        ctx.fill();

        ctx.restore();
      };
      drawPlatform();

      // --- Draw Tubes and Accumulated Sand ---
      const tubeColors = config.colors.map(c => COLORS[c as keyof typeof COLORS]);
      const tubeLabels = config.colors;

      const drawTube = (x: number, data: { red: number, blue: number, green: number, yellow: number }, tubeColor: string, label: string) => {
        if (!data) return;
        const baseY = tubeY + tubeHeight - 10;
        const baseWidth = TUBE_WIDTH + 20;
        const baseHeight = 45;
        const curveH = 8; // Height of the elliptical curvature

        // 1. Metallic Base (Multi-layered Cylinder)
        ctx.save();
        // Base Shadow
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        
        // Main Base Cylinder
        const baseGrad = ctx.createLinearGradient(x - baseWidth/2, 0, x + baseWidth/2, 0);
        baseGrad.addColorStop(0, '#222');
        baseGrad.addColorStop(0.3, '#444');
        baseGrad.addColorStop(0.5, '#555');
        baseGrad.addColorStop(0.7, '#444');
        baseGrad.addColorStop(1, '#222');
        
        ctx.fillStyle = baseGrad;
        ctx.beginPath();
        ctx.roundRect(x - baseWidth/2, baseY, baseWidth, baseHeight, 10);
        ctx.fill();

        // Glowing Ring (Middle of base)
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = tubeColor;
        ctx.fillStyle = tubeColor;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.rect(x - baseWidth/2, baseY + 18, baseWidth, 8);
        ctx.fill();
        
        // Ring Detail (Dots/Segments)
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        for (let i = 0; i < 8; i++) {
          ctx.beginPath();
          ctx.arc(x - baseWidth/2 + 5 + i * (baseWidth/7.5), baseY + 22, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        // Top Cap of Base
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.ellipse(x, baseY, baseWidth/2, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 2. Glass Body (3D Cylinder)
        ctx.save();
        const glassGrad = ctx.createLinearGradient(x - TUBE_WIDTH / 2, 0, x + TUBE_WIDTH / 2, 0);
        glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
        glassGrad.addColorStop(0.2, 'rgba(255, 255, 255, 0.25)');
        glassGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
        glassGrad.addColorStop(0.8, 'rgba(255, 255, 255, 0.25)');
        glassGrad.addColorStop(1, 'rgba(255, 255, 255, 0.1)');
        
        ctx.fillStyle = glassGrad;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        
        // Draw the main tube body with curved bottom
        ctx.beginPath();
        ctx.moveTo(x - TUBE_WIDTH / 2, tubeY);
        ctx.lineTo(x - TUBE_WIDTH / 2, tubeY + tubeHeight - curveH);
        ctx.ellipse(x, tubeY + tubeHeight - curveH, TUBE_WIDTH / 2, curveH, 0, Math.PI, 0, true);
        ctx.lineTo(x + TUBE_WIDTH / 2, tubeY);
        ctx.stroke();
        ctx.fill();

        // Top Rim (3D Ring)
        const rimGrad = ctx.createLinearGradient(x - TUBE_WIDTH/2 - 4, 0, x + TUBE_WIDTH/2 + 4, 0);
        rimGrad.addColorStop(0, '#333');
        rimGrad.addColorStop(0.5, '#666');
        rimGrad.addColorStop(1, '#333');
        ctx.fillStyle = rimGrad;
        ctx.beginPath();
        ctx.ellipse(x, tubeY, TUBE_WIDTH / 2 + 4, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Glass Highlights (Specular)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - TUBE_WIDTH / 2 + 8, tubeY + 15);
        ctx.lineTo(x - TUBE_WIDTH / 2 + 8, tubeY + tubeHeight - 20);
        ctx.stroke();

        // 3. Sand Grains (3D Layers)
        const total = data.red + data.blue + data.green + data.yellow;
        if (total > 0) {
          const fillHeight = Math.min(tubeHeight - 20, total * 0.5); 
          let currentH = tubeY + tubeHeight - curveH;

          const drawLayer = (h: number, color: string, colorDark: string, colorLight: string) => {
            if (h <= 1) return;
            
            const sandGrad = ctx.createLinearGradient(x - TUBE_WIDTH / 2 + 4, 0, x + TUBE_WIDTH / 2 - 4, 0);
            sandGrad.addColorStop(0, colorDark);
            sandGrad.addColorStop(0.5, colorLight);
            sandGrad.addColorStop(1, colorDark);
            
            ctx.fillStyle = sandGrad;
            
            // Draw layer with curved bottom and top
            ctx.beginPath();
            // Bottom curve
            ctx.ellipse(x, currentH, TUBE_WIDTH / 2 - 4, curveH - 2, 0, 0, Math.PI, false);
            // Side up
            ctx.lineTo(x - TUBE_WIDTH / 2 + 4, currentH - h);
            // Top curve
            ctx.ellipse(x, currentH - h, TUBE_WIDTH / 2 - 4, curveH - 2, 0, Math.PI, 0, false);
            // Side down
            ctx.lineTo(x + TUBE_WIDTH / 2 - 4, currentH);
            ctx.fill();
            
            // Top Surface Highlight (Mound)
            ctx.fillStyle = colorLight;
            ctx.beginPath();
            ctx.ellipse(x, currentH - h, TUBE_WIDTH / 2 - 4, curveH - 2, 0, 0, Math.PI * 2);
            ctx.fill();
            
            currentH -= h;
          };

          const redRatio = data.red / total;
          const blueRatio = data.blue / total;
          const greenRatio = data.green / total;
          const yellowRatio = data.yellow / total;
          
          drawLayer(fillHeight * redRatio, COLORS.RED, COLORS.RED_DARK, COLORS.RED_LIGHT);
          drawLayer(fillHeight * blueRatio, COLORS.BLUE, COLORS.BLUE_DARK, COLORS.BLUE_LIGHT);
          drawLayer(fillHeight * greenRatio, COLORS.GREEN, COLORS.GREEN_DARK, COLORS.GREEN_LIGHT);
          drawLayer(fillHeight * yellowRatio, COLORS.YELLOW, COLORS.YELLOW_DARK, COLORS.YELLOW_LIGHT);
        }

        // 4. Percentage Label (Floating box)
        const percent = Math.min(100, Math.round((total * 0.5 / (tubeHeight - 20)) * 100));
        const labelX = x - TUBE_WIDTH/2 - 45;
        const labelY = tubeY + tubeHeight - 60;
        
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath();
        ctx.roundRect(labelX, labelY, 40, 30, 5);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, labelX + 20, labelY + 12);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(`${percent}%`, labelX + 20, labelY + 24);
        ctx.restore();

        ctx.restore();
      };

      for (let i = 0; i < tubePositions.length; i++) {
        drawTube(tubePositions[i], tubes[i], tubeColors[i], tubeLabels[i]);
      }

      // --- Draw Spillage Meter (3D Acrylic Cylinder) ---
      const drawSpillageMeter = () => {
        const mx = width - 60;
        const my = height / 2;
        const mw = 35;
        const mh = 320;
        
        // 1. Dark Metal Casing (Back)
        ctx.save();
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.roundRect(mx - mw/2 - 4, my - mh/2 - 10, mw + 8, mh + 20, 10);
        ctx.fill();
        
        // 2. Clear Acrylic Cylinder
        const glassGrad = ctx.createLinearGradient(mx - mw/2, 0, mx + mw/2, 0);
        glassGrad.addColorStop(0, 'rgba(255,255,255,0.05)');
        glassGrad.addColorStop(0.5, 'rgba(255,255,255,0.15)');
        glassGrad.addColorStop(1, 'rgba(255,255,255,0.05)');
        
        ctx.fillStyle = glassGrad;
        ctx.beginPath();
        ctx.roundRect(mx - mw/2, my - mh/2, mw, mh, 15);
        ctx.fill();
        
        // 3. Glowing Fluid (Green -> Yellow -> Red)
        const maxVisiblePercent = 10; // Bar represents 0% to 10%
        const fillRatio = Math.min(1, spillage / maxVisiblePercent);
        const fillHeight = fillRatio * mh;
        
        if (fillHeight > 0) {
          ctx.save();
          // Clip to cylinder
          ctx.beginPath();
          ctx.roundRect(mx - mw/2, my - mh/2, mw, mh, 15);
          ctx.clip();
          
          const fluidGrad = ctx.createLinearGradient(0, my + mh/2, 0, my - mh/2);
          fluidGrad.addColorStop(0, '#00ff00'); // Green at bottom (0%)
          fluidGrad.addColorStop(0.5, '#ffff00'); // Yellow (5%)
          fluidGrad.addColorStop(1, '#ff0000'); // Red at top (10%)
          
          ctx.fillStyle = fluidGrad;
          ctx.shadowBlur = 20;
          ctx.shadowColor = spillage > 8 ? '#ff0000' : spillage > 4 ? '#ffff00' : '#00ff00';
          ctx.beginPath();
          ctx.fillRect(mx - mw/2, my + mh/2 - fillHeight, mw, fillHeight);
          ctx.fill();
          ctx.restore();
        }
        
        // 4. Etched Markings
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.textAlign = 'right';
        ctx.font = '8px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        
        for (let i = 0; i <= 10; i++) {
          const y = my + mh/2 - (i / 10) * mh;
          ctx.beginPath();
          ctx.moveTo(mx + mw/2 - 8, y);
          ctx.lineTo(mx + mw/2, y);
          ctx.stroke();
          if (i % 2 === 0) {
            ctx.fillText(`${i}%`, mx - mw/2 - 5, y + 3);
          }
        }
        
        // 5. Silver Sliding Indicator
        const indicatorY = my + mh/2 - fillHeight;
        ctx.save();
        const silverGrad = ctx.createLinearGradient(mx - mw/2 - 8, 0, mx + mw/2 + 8, 0);
        silverGrad.addColorStop(0, '#999');
        silverGrad.addColorStop(0.5, '#eee');
        silverGrad.addColorStop(1, '#999');
        
        ctx.fillStyle = silverGrad;
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'black';
        ctx.beginPath();
        ctx.roundRect(mx - mw/2 - 8, indicatorY - 4, mw + 16, 8, 2);
        ctx.fill();
        ctx.restore();
        
        // 6. Metal Casing (Front Brackets)
        ctx.fillStyle = '#333';
        ctx.fillRect(mx - mw/2 - 4, my - mh/2 - 10, mw + 8, 15);
        ctx.fillRect(mx - mw/2 - 4, my + mh/2 - 5, mw + 8, 15);
        
        ctx.restore();
      };
      drawSpillageMeter();

      // --- Draw Particles ---
      particles.forEach(p => {
        ctx.save();
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, PARTICLE_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // --- Draw Splashes ---
      gameData.current.splashes.forEach((s, idx) => {
        ctx.globalAlpha = s.life;
        ctx.fillStyle = s.color;
        // Use a deterministic "random" based on index and life to avoid pause flickering
        for (let i = 0; i < 4; i++) {
          const seed = (idx + i) * 123.45;
          const angle = (seed % (Math.PI * 2));
          const dist = (1 - s.life) * 20;
          ctx.beginPath();
          ctx.arc(s.x + Math.cos(angle) * dist, s.y + Math.sin(angle) * dist, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1.0;
      });
    };

    const handleResize = () => {
      if (containerRef.current) {
        canvas.width = containerRef.current.clientWidth;
        canvas.height = containerRef.current.clientHeight;
        gameData.current.width = canvas.width;
        gameData.current.height = canvas.height;
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    animationFrameId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [gameState, level, sorterAngles, isPaused]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-screen bg-stone-950 overflow-hidden font-sans select-none touch-none"
      onPointerDown={handleInteraction}
    >
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
      />

      {/* Homepage */}
      {gameState === 'home' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 z-50 flex items-center justify-center bg-stone-950/90 backdrop-blur-xl"
        >
          <div className="max-w-md w-full p-10 text-center">
            <motion.div
              initial={{ y: -20 }}
              animate={{ y: 0 }}
              className="mb-12"
            >
              <h1 className="text-6xl font-black text-white mb-4 tracking-tighter">
                SAND<br/><span className="text-emerald-500">SORTER</span>
              </h1>
              <p className="text-stone-400 font-medium uppercase tracking-[0.3em] text-xs">Sorter Challenge</p>
            </motion.div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 max-w-4xl w-full">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((lvl) => (
                <motion.button
                  key={lvl}
                  whileHover={{ scale: 1.05, y: -5 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    initGame(lvl);
                  }}
                  className="group relative aspect-square bg-stone-900 border border-white/10 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 transition-all hover:border-emerald-500/50 hover:bg-stone-800 shadow-2xl"
                >
                  <div className="text-stone-500 group-hover:text-emerald-500 transition-colors">
                    {lvl === 1 ? <RotateCcw size={40} /> : <Play size={40} fill="currentColor" />}
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Level</div>
                    <div className="text-3xl font-black text-white">{lvl.toString().padStart(2, '0')}</div>
                  </div>
                  
                  {/* Decorative corner */}
                  <div className="absolute top-6 right-6 w-2 h-2 rounded-full bg-stone-700 group-hover:bg-emerald-500 transition-colors" />
                </motion.button>
              ))}
            </div>

            <p className="mt-12 text-stone-500 text-sm font-medium">
              Click on a Sorter to flip its direction.<br/>
              Sort the sand into the matching tubes!
            </p>
          </div>
        </motion.div>
      )}

      {/* UI Overlay */}
      {gameState === 'playing' && (
        <>
          {/* Top Left Panel (Score) */}
          <div className="absolute top-4 left-4 flex items-center gap-3 px-4 py-2 bg-stone-900/60 border border-white/10 rounded-2xl backdrop-blur-2xl shadow-2xl pointer-events-auto z-50">
            <div className="flex flex-col items-start">
              <span className="text-[8px] uppercase tracking-[0.2em] text-white/40 font-bold leading-none mb-1">Score</span>
              <span className="text-xl font-black text-white leading-none tabular-nums">{score}</span>
            </div>
          </div>

          {/* Top Right Panel (Level & Pause) */}
          <div className="absolute top-4 right-4 flex items-center gap-4 px-4 py-2 bg-stone-900/60 border border-white/10 rounded-2xl backdrop-blur-2xl shadow-2xl pointer-events-auto z-50">
            <div className="flex flex-col items-end">
              <span className="text-[8px] uppercase tracking-[0.2em] text-white/40 font-bold leading-none mb-1">Level</span>
              <span className="text-sm font-bold text-emerald-500 leading-none">{level}</span>
            </div>

            <button 
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setGameState('home'); }}
              className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-white"
              title="Home"
            >
              <Home size={14} />
            </button>

            <div className="h-6 w-px bg-white/10" />

            <button 
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setIsPaused(!isPaused); }}
              className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-white"
            >
              {isPaused ? <Play size={14} fill="currentColor" /> : <div className="flex gap-1"><div className="w-0.5 h-3 bg-white rounded-full"/><div className="w-0.5 h-3 bg-white rounded-full"/></div>}
            </button>
          </div>

          {/* Spillage Label */}
          <div className="absolute right-16 top-1/2 -translate-y-[180px] pointer-events-none">
             <span className="[writing-mode:vertical-rl] text-[10px] uppercase tracking-[0.4em] text-white/40 font-bold">Spillage (10% Limit)</span>
          </div>

          {/* Interaction Hint */}
          <AnimatePresence>
            {score === 0 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute bottom-12 left-1/2 -translate-x-1/2 text-center pointer-events-none"
              >
                <p className="text-white/20 text-[10px] uppercase tracking-[0.5em] font-bold">swipe to start</p>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Screens */}
      <AnimatePresence>
        {gameState === 'gameover' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-stone-950/80 backdrop-blur-md flex items-center justify-center p-6 z-50"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-stone-900 p-10 rounded-[3rem] shadow-2xl text-center max-w-sm w-full border border-white/10"
            >
              <div className="w-20 h-20 bg-red-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-red-500/20 -rotate-12">
                <AlertTriangle size={40} className="text-white" />
              </div>
              <h2 className="text-4xl font-black text-white mb-2 tracking-tight">Game Over</h2>
              <p className="text-stone-400 mb-10 font-medium">Too much sand spilled!</p>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => initGame(level)}
                  className="w-full py-5 bg-white text-stone-900 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-stone-100 transition-all active:scale-95 shadow-xl"
                >
                  <RotateCcw size={22} />
                  Try Again
                </button>
                <button 
                  onClick={() => setGameState('home')}
                  className="w-full py-5 bg-stone-800 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-stone-700 transition-all active:scale-95"
                >
                  Home Menu
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {gameState === 'win' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-stone-950/80 backdrop-blur-md flex items-center justify-center p-6 z-50"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-stone-900 p-10 rounded-[3rem] shadow-2xl text-center max-w-sm w-full border border-white/10"
            >
              <div className="w-20 h-20 bg-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-emerald-500/20 rotate-12">
                <Trophy size={40} className="text-white" />
              </div>
              <h2 className="text-4xl font-black text-white mb-2 tracking-tight">Level {level} Clear!</h2>
              <p className="text-stone-400 mb-4 font-medium">Excellent sorting skills.</p>
              <div className="text-5xl font-black text-emerald-500 mb-10 tracking-tighter">{score}</div>
              
              <div className="flex flex-col gap-3">
                {level < 10 ? (
                  <button 
                    onClick={() => initGame(level + 1)}
                    className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-emerald-600 transition-all active:scale-95 shadow-xl shadow-emerald-500/20"
                  >
                    <Play size={22} fill="currentColor" />
                    Next Level
                  </button>
                ) : (
                  <p className="text-emerald-500 font-bold mb-4">You've mastered all levels!</p>
                )}
                <button 
                  onClick={() => setGameState('home')}
                  className="w-full py-5 bg-stone-800 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-stone-700 transition-all active:scale-95"
                >
                  Home Menu
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .vertical-text {
          writing-mode: vertical-rl;
          text-orientation: mixed;
        }
      `}</style>
    </div>
  );
}
