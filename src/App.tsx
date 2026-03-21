/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, RotateCcw, Trophy, AlertTriangle, Info } from 'lucide-react';

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

// Relative positions (percentage of screen height)
const FUNNEL_Y_RATIO = 0.18;
const SORTER_Y_RATIO = 0.42;
const TUBE_Y_RATIO = 0.72;
const TUBE_HEIGHT_RATIO = 0.22;

// --- Types ---
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  type: 'RED' | 'BLUE' | 'GREEN';
  active: boolean;
  hasHitSorter?: boolean;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [gameState, setGameState] = useState<'home' | 'playing' | 'gameover' | 'win'>('home');
  const [level, setLevel] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [spillage, setSpillage] = useState(0);
  const [sorterAngles, setSorterAngles] = useState([25, 25]); // Array for multiple sorters
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
    upcomingColors: [] as ('RED' | 'BLUE' | 'GREEN')[],
    initialCounts: { RED: 0, BLUE: 0, GREEN: 0 },
    gameTime: 0,
    beads: [] as { ry: number; rx: number; offset: number }[],
    tubes: [
      { red: 0, blue: 0, green: 0 },
      { red: 0, blue: 0, green: 0 },
      { red: 0, blue: 0, green: 0 },
    ],
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
    gameData.current.tubes = [
      { red: 0, blue: 0, green: 0 },
      { red: 0, blue: 0, green: 0 },
      { red: 0, blue: 0, green: 0 },
    ];
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
    const upcoming: ('RED' | 'BLUE' | 'GREEN')[] = [];
    const maxSand = targetLevel === 1 ? 400 : 600;
    gameData.current.maxSand = maxSand;
    
    if (targetLevel === 1) {
      const half = Math.floor(maxSand / 2);
      for (let i = 0; i < maxSand; i++) {
        upcoming.push(i < half ? 'RED' : 'BLUE');
      }
    } else {
      const third = Math.floor(maxSand / 3);
      for (let i = 0; i < maxSand; i++) {
        if (i < third) upcoming.push('RED');
        else if (i < third * 2) upcoming.push('BLUE');
        else upcoming.push('GREEN');
      }
    }
    gameData.current.upcomingColors = upcoming;
    gameData.current.initialCounts = {
      RED: upcoming.filter(c => c === 'RED').length,
      BLUE: upcoming.filter(c => c === 'BLUE').length,
      GREEN: upcoming.filter(c => c === 'GREEN').length,
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
    setSorterAngles(targetLevel === 1 ? [25] : [25, 25]);
  };

  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameState !== 'playing' || isPaused) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;

    const sorterY = gameData.current.height * SORTER_Y_RATIO;
    const sorterConfigs = level === 1 
      ? [{ x: gameData.current.width / 2, y: sorterY }]
      : [
          { x: gameData.current.width / 2, y: sorterY - 80 }, // Top Sorter
          { x: gameData.current.width / 2 + 81, y: sorterY + 100 } // Bottom Right Sorter
        ];

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
      if (gameData.current.totalSpawned < maxSand) {
        // Slow down spawn rate to give time to sort
        gameData.current.spawnTimer += dt;
        if (gameData.current.spawnTimer > 80) { // Spawn every 80ms
          gameData.current.spawnTimer = 0;
          const type = upcomingColors.shift() || 'RED';
          let particleColor = COLORS.RED;
          if (type === 'BLUE') particleColor = COLORS.BLUE;
          if (type === 'GREEN') particleColor = COLORS.GREEN;
          
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
      const sorterConfigs = level === 1 
        ? [{ x: width / 2, y: sorterY, angle: sorterAngles[0], length: SORTER_LENGTH }]
        : [
            { x: width / 2, y: sorterY - 80, angle: sorterAngles[0], length: SORTER_LENGTH }, // Top Sorter
            { x: width / 2 + 81, y: sorterY + 100, angle: sorterAngles[1], length: SORTER_LENGTH / 2 } // Bottom Right Sorter (Half size)
          ];

      // Bottom Guides (ensure sand falls in tubes)
      const tubePositions = level === 1
        ? [width / 2 - 81, width / 2 + 81]
        : [width / 2 - 81, width / 2 + 40, width / 2 + 122];
      
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.vx = 0; // Reset horizontal velocity each frame for straight fall
        p.vy += GRAVITY;
        
        // Collision with Sorters
        let onSorter = false;
        sorterConfigs.forEach(config => {
          const sLen = config.length || SORTER_LENGTH;
          const rad = (config.angle * Math.PI) / 180;
          const sX1 = config.x - Math.cos(rad) * (sLen / 2);
          const sY1 = config.y - Math.sin(rad) * (sLen / 2);
          const sX2 = config.x + Math.cos(rad) * (sLen / 2);
          const sY2 = config.y + Math.sin(rad) * (sLen / 2);

          if (p.y > config.y - 60 && p.y < config.y + 60) {
            const dx = sX2 - sX1;
            const dy = sY2 - sY1;
            const lenSq = dx * dx + dy * dy;
            const t = Math.max(0, Math.min(1, ((p.x - sX1) * dx + (p.y - sY1) * dy) / lenSq));
            const projX = sX1 + t * dx;
            const projY = sY1 + t * dy;
            const dist = Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);

            if (dist < (PARTICLE_SIZE / 2) + 2) {
              p.y = projY - 2;
              const slideForce = Math.cos(rad) * 1.5 * (config.angle > 0 ? 1 : -1);
              p.vx = slideForce;
              p.vy = Math.abs(Math.sin(rad)) * 3; 
              onSorter = true;
            }
          }
        });

        p.x += p.vx;
        p.y += p.vy;

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
            const total = tubeData.red + tubeData.blue + tubeData.green;
            const fillHeight = Math.min(tubeHeight - 10, total * 0.5);
            const surfaceY = tubeY + tubeHeight - 5 - fillHeight;

            // If particle hits the surface or the bottom of the tube
            if (p.y >= surfaceY) {
              if (p.type === 'RED') tubeData.red++;
              else if (p.type === 'BLUE') tubeData.blue++;
              else tubeData.green++;
              
              const correctTypes: ('RED' | 'BLUE' | 'GREEN')[] = level === 1 ? ['RED', 'BLUE'] : ['RED', 'BLUE', 'GREEN'];
              const isCorrect = p.type === correctTypes[tubeIndex];
              
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
        const chamberCount = level === 1 ? 2 : 3;
        const chamberWidth = 65;
        const chamberHeight = 100;
        const spacing = 85;
        const totalWidth = (chamberCount - 1) * spacing + chamberWidth + 40;
        
        const colors = [COLORS.RED, COLORS.BLUE, COLORS.GREEN];
        const colorDarks = [COLORS.RED_DARK, COLORS.BLUE_DARK, COLORS.GREEN_DARK];
        const colorLights = [COLORS.RED_LIGHT, COLORS.BLUE_LIGHT, COLORS.GREEN_LIGHT];
        const labels = ['RED', 'BLUE', 'GREEN'];

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
          const colorType = labels[i] as 'RED' | 'BLUE' | 'GREEN';
          
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
            sandGrad.addColorStop(0, colorDarks[i]);
            sandGrad.addColorStop(0.5, colorLights[i]);
            sandGrad.addColorStop(1, colorDarks[i]);
            
            ctx.fillStyle = sandGrad;
            ctx.beginPath();
            ctx.fillRect(cx - chamberWidth/2 + 2, cy + chamberHeight - fillHeight, chamberWidth - 4, fillHeight);
            ctx.fill();
            
            // Mounded Top
            ctx.fillStyle = colorLights[i];
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
          ctx.shadowColor = colors[i];
          ctx.fillStyle = colors[i];
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

      // --- Draw Sorters (Mechanical 3D Asset Style) ---
      const sorterConfigs = level === 1 
        ? [{ x: width / 2, y: sorterY, angle: sorterAngles[0], length: SORTER_LENGTH }]
        : [
            { x: width / 2, y: sorterY - 80, angle: sorterAngles[0], length: SORTER_LENGTH }, // Top Sorter
            { x: width / 2 + 81, y: sorterY + 100, angle: sorterAngles[1], length: SORTER_LENGTH / 2 } // Bottom Right Sorter (Half size)
          ];

      sorterConfigs.forEach(config => {
        const sLen = config.length || SORTER_LENGTH;
        const rad = (config.angle * Math.PI) / 180;
        
        // 1. Draw the Arm
        ctx.save();
        ctx.translate(config.x, config.y);
        ctx.rotate(rad);
        
        // Brushed Green Metal Arm (Ergonomic Tapered Shape)
        const armGrad = ctx.createLinearGradient(0, -18, 0, 18);
        armGrad.addColorStop(0, COLORS.GREEN_DARK);
        armGrad.addColorStop(0.2, COLORS.SORTER_GREEN);
        armGrad.addColorStop(0.4, COLORS.GREEN_LIGHT);
        armGrad.addColorStop(0.5, COLORS.SORTER_GREEN);
        armGrad.addColorStop(0.8, COLORS.GREEN_DARK);
        armGrad.addColorStop(1, '#0a1a0a');
        
        ctx.fillStyle = armGrad;
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        
        ctx.beginPath();
        ctx.moveTo(-sLen / 2, -8);
        ctx.quadraticCurveTo(0, -18, sLen / 2, -8);
        ctx.lineTo(sLen / 2, 8);
        ctx.quadraticCurveTo(0, 18, -sLen / 2, 8);
        ctx.closePath();
        ctx.fill();

        // Glowing Edges
        ctx.save();
        ctx.strokeStyle = COLORS.GREEN_LIGHT;
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 12;
        ctx.shadowColor = COLORS.GREEN;
        ctx.globalAlpha = 0.6;
        ctx.stroke();
        ctx.restore();

        // Brushed Texture Overlay
        ctx.save();
        ctx.globalAlpha = 0.1;
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 0.5;
        for (let i = -sLen/2 + 10; i < sLen/2 - 10; i += 4) {
          ctx.beginPath();
          ctx.moveTo(i, -12);
          ctx.lineTo(i, 12);
          ctx.stroke();
        }
        ctx.restore();
        ctx.restore(); // End Arm

        // 2. Draw the Pivot Joint (Polished Gold)
        ctx.save();
        ctx.translate(config.x, config.y);
        
        const goldGrad = ctx.createRadialGradient(-8, -8, 0, 0, 0, 28);
        goldGrad.addColorStop(0, COLORS.GOLD_LIGHT);
        goldGrad.addColorStop(0.4, COLORS.GOLD);
        goldGrad.addColorStop(0.7, COLORS.GOLD_DARK);
        goldGrad.addColorStop(1, '#4a3200');
        
        ctx.fillStyle = goldGrad;
        ctx.shadowBlur = 25;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner Polished Detail
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.arc(-6, -6, 12, 0, Math.PI * 2);
        ctx.fill();
        
        // Mechanical Bolt Head
        ctx.strokeStyle = COLORS.GOLD_DARK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.stroke();
        
        // Hex bolt shape
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          const x = Math.cos(angle) * 10;
          const y = Math.sin(angle) * 10;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        
        ctx.restore(); // End Pivot
      });

      // --- Draw Bottom Platform (Large Metallic Base) ---
      const drawPlatform = () => {
        const platformX = width / 2;
        const platformY = tubeY + tubeHeight + 15;
        const platformW = level === 1 ? 400 : 560;
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
      const tubePositions = level === 1
        ? [width / 2 - 81, width / 2 + 81]
        : [width / 2 - 81, width / 2 + 40, width / 2 + 122];
      
      const tubeColors = level === 1 ? [COLORS.RED, COLORS.BLUE] : [COLORS.RED, COLORS.BLUE, COLORS.GREEN];
      const tubeLabels = level === 1 ? ['RED', 'BLUE'] : ['RED', 'BLUE', 'GREEN'];

      const drawTube = (x: number, data: { red: number, blue: number, green: number }, tubeColor: string, label: string) => {
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
        const total = data.red + data.blue + data.green;
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
          
          drawLayer(fillHeight * redRatio, COLORS.RED, COLORS.RED_DARK, COLORS.RED_LIGHT);
          drawLayer(fillHeight * blueRatio, COLORS.BLUE, COLORS.BLUE_DARK, COLORS.BLUE_LIGHT);
          drawLayer(fillHeight * greenRatio, COLORS.GREEN, COLORS.GREEN_DARK, COLORS.GREEN_LIGHT);
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

      // --- Draw Bottom Collector Funnel ---
      const drawCollector = () => {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        
        // Draw sloped lines leading to tubes
        tubePositions.forEach(tx => {
          ctx.beginPath();
          ctx.moveTo(tx - TUBE_WIDTH, tubeY - 60);
          ctx.lineTo(tx - TUBE_WIDTH/2, tubeY);
          ctx.stroke();
          
          ctx.beginPath();
          ctx.moveTo(tx + TUBE_WIDTH, tubeY - 60);
          ctx.lineTo(tx + TUBE_WIDTH/2, tubeY);
          ctx.stroke();
        });
        ctx.restore();
      };
      drawCollector();

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
      gameData.current.splashes.forEach(s => {
        ctx.globalAlpha = s.life;
        ctx.fillStyle = s.color;
        for (let i = 0; i < 4; i++) {
          const angle = Math.random() * Math.PI * 2;
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
      onMouseDown={handleInteraction}
      onTouchStart={handleInteraction}
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

            <div className="grid grid-cols-2 gap-6">
              {[1, 2].map((lvl) => (
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
          {/* Top Panel (Compact Single Line - Top Right) */}
          <div className="absolute top-4 right-4 flex items-center gap-3 px-4 py-2 bg-stone-900/60 border border-white/10 rounded-2xl backdrop-blur-2xl shadow-2xl pointer-events-auto z-50">
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-[8px] uppercase tracking-[0.2em] text-white/40 font-bold leading-none mb-1">Score</span>
                <span className="text-xl font-black text-white leading-none tabular-nums">{score}</span>
              </div>
              
              <div className="h-6 w-px bg-white/10" />
              
              <div className="flex flex-col items-end">
                <span className="text-[8px] uppercase tracking-[0.2em] text-white/40 font-bold leading-none mb-1">Level</span>
                <span className="text-sm font-bold text-emerald-500 leading-none">{level}</span>
              </div>
            </div>

            <div className="h-6 w-px bg-white/10" />

            <button 
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
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
                {level < 2 ? (
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
