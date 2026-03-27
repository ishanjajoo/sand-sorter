import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Settings2, RotateCw, AlertTriangle } from 'lucide-react';
import backgroundImage from './assets/background_new.png';

type Color = 'red' | 'blue' | 'yellow';
type Segment = { color: Color; volume: number };

const FUNNEL_CAPACITY = 30;
const MAIN_PIPE_CAPACITY = 20;
const BRANCH_PIPE_CAPACITY = 15;
const FLOW_RATE = 0.8;

const addToQueue = (queue: Segment[], color: Color, amount: number): Segment[] => {
  if (amount <= 0) return queue;
  const newQueue = [...queue];
  if (newQueue.length > 0 && newQueue[newQueue.length - 1].color === color) {
    newQueue[newQueue.length - 1] = { ...newQueue[newQueue.length - 1], volume: newQueue[newQueue.length - 1].volume + amount };
  } else {
    newQueue.push({ color, volume: amount });
  }
  return newQueue;
};

const removeFromQueue = (queue: Segment[], amount: number): { newQueue: Segment[]; removed: Segment[] } => {
  const newQueue = [...queue];
  let remainingToRemove = amount;
  let removed: Segment[] = [];

  while (remainingToRemove > 0 && newQueue.length > 0) {
    const first = newQueue[0];
    if (first.volume <= remainingToRemove) {
      removed.push({ ...first });
      remainingToRemove -= first.volume;
      newQueue.shift();
    } else {
      removed.push({ color: first.color, volume: remainingToRemove });
      newQueue[0] = { ...first, volume: first.volume - remainingToRemove };
      remainingToRemove = 0;
    }
  }
  return { newQueue, removed };
};

const getTotalVolume = (queue: Segment[]) => queue.reduce((sum, s) => sum + s.volume, 0);

const QueueVisualizer: React.FC<{ 
  queue: Segment[], 
  capacity: number, 
  className?: string, 
  isVertical?: boolean,
  isFlowing?: boolean
}> = ({ 
  queue, 
  capacity, 
  className, 
  isVertical = true,
  isFlowing = false
}) => {
  const sandColors = {
    red: 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.6)]',
    blue: 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)]',
    yellow: 'bg-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.6)]'
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Sand Segments Container */}
      <div className={`absolute inset-0 flex ${isVertical ? 'flex-col-reverse' : 'flex-row'} z-10`}>
        {queue.map((seg, i) => (
          <div 
            key={i} 
            className={`${sandColors[seg.color]} opacity-100 relative border-white/10`} 
            style={{ 
              [isVertical ? 'height' : 'width']: `${(seg.volume / capacity) * 100}%`,
              borderWidth: seg.volume > 0 ? '1px' : '0'
            }} 
          >
            {/* Animated Sand Texture */}
            <motion.div 
              className="absolute inset-0 opacity-60"
              style={{
                backgroundImage: 'radial-gradient(circle, #fff 1.5px, transparent 1.5px)',
                backgroundSize: '4px 4px',
                backgroundRepeat: 'repeat'
              }}
              animate={isFlowing ? {
                y: isVertical ? [0, 20] : 0,
                x: !isVertical ? [0, 20] : 0
              } : {}}
              transition={{ repeat: Infinity, duration: 0.3, ease: 'linear' }}
            />
            {/* Inner Glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/30 via-transparent to-black/30 pointer-events-none" />
          </div>
        ))}
      </div>
      {/* Glass Shine Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-white/20 pointer-events-none z-20" />
      {isFlowing && (
        <motion.div 
          className="absolute inset-0 bg-white/20 pointer-events-none z-30"
          animate={{ opacity: [0.1, 0.4, 0.1] }}
          transition={{ repeat: Infinity, duration: 0.4 }}
        />
      )}
    </div>
  );
};

const Jar = ({ color, label, contents }: { color: Color, label: string, contents: Segment[] }) => {
  const labelColors = {
    red: 'bg-red-600 border-red-400 shadow-red-900/50',
    blue: 'bg-blue-600 border-blue-400 shadow-blue-900/50',
    yellow: 'bg-yellow-500 border-yellow-300 shadow-yellow-900/50'
  };

  const sandColors = {
    red: 'from-red-700 via-red-500 to-red-400',
    blue: 'from-blue-700 via-blue-500 to-blue-400',
    yellow: 'from-yellow-600 via-yellow-400 to-yellow-300'
  };

  return (
    <div className="relative flex flex-col items-center">
      {/* 3D Glass Jar */}
      <div className="relative w-28 h-36 bg-slate-900/40 backdrop-blur-lg border-[3px] border-white/40 rounded-b-[40px] rounded-t-[10px] shadow-[0_10px_30px_rgba(0,0,0,0.6),inset_0_0_20px_rgba(255,255,255,0.1)] overflow-hidden">
        {/* Glass Highlights */}
        <div className="absolute top-0 left-4 w-2 h-full bg-gradient-to-r from-white/40 to-transparent opacity-50 z-20" />
        <div className="absolute top-0 right-4 w-1 h-full bg-gradient-to-l from-white/30 to-transparent opacity-40 z-20" />
        
        {/* Sand Content - Stacked Layers */}
        <div className="absolute bottom-0 left-0 right-0 h-full flex flex-col-reverse z-10">
          {contents.map((seg, i) => (
            <motion.div 
              key={i} 
              className={`bg-gradient-to-t ${sandColors[seg.color]} w-full relative border-t border-white/20`} 
              initial={{ height: 0 }}
              animate={{ height: `${seg.volume}%` }}
              transition={{ type: 'spring', stiffness: 60, damping: 20 }}
            >
              {/* Surface Shine */}
              <div className="absolute top-0 w-full h-2 bg-white/30 blur-[1px]" />
              {/* Grain Texture */}
              <div 
                className="absolute inset-0 opacity-40"
                style={{
                  backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
                  backgroundSize: '5px 5px',
                  backgroundRepeat: 'repeat'
                }}
              />
            </motion.div>
          ))}
        </div>

        {/* Rim Detail */}
        <div className="absolute top-0 w-full h-4 bg-white/30 border-b-2 border-white/40 rounded-t-[10px] z-20" />
      </div>
      
      {/* 3D Label */}
      <div className={`mt-4 px-6 py-2 ${labelColors[color]} border-2 shadow-[0_4px_0_rgba(0,0,0,0.3)] rounded-xl text-white text-[11px] font-black tracking-widest uppercase min-w-[110px] text-center transform hover:scale-105 transition-transform`}>
        {label}
      </div>
    </div>
  );
};

const Valve = ({ isOpen, onToggle }: { isOpen: boolean, onToggle: () => void }) => (
  <div className="relative flex flex-col items-center z-50">
    {/* Valve Stem */}
    <div className="w-6 h-10 bg-gradient-to-r from-slate-600 via-slate-400 to-slate-600 border-x-2 border-slate-700" />
    {/* Valve Wheel */}
    <motion.button
      onClick={onToggle}
      animate={{ rotate: isOpen ? 180 : 0 }}
      transition={{ type: 'spring', stiffness: 100, damping: 10 }}
      className="absolute top-1 w-14 h-14 bg-gradient-to-br from-red-500 to-red-800 border-4 border-red-900 rounded-full shadow-[0_6px_0_rgba(0,0,0,0.4),0_10px_20px_rgba(0,0,0,0.3)] flex items-center justify-center group active:translate-y-1 active:shadow-none transition-all"
    >
      <div className="w-full h-full rounded-full border-2 border-white/20 flex items-center justify-center">
        <div className="w-10 h-2 bg-black/20 rounded-full absolute rotate-45" />
        <div className="w-10 h-2 bg-black/20 rounded-full absolute -rotate-45" />
        <div className="w-4 h-4 bg-slate-300 rounded-full border-2 border-slate-500 shadow-inner z-10" />
      </div>
    </motion.button>
  </div>
);

export default function App() {
  const [isTapOpen, setIsTapOpen] = useState(false);
  const [sorterDirection, setSorterDirection] = useState<Color>('red');
  const [flowState, setFlowState] = useState({
    tank: { red: 100, blue: 100, yellow: 100 },
    funnel: [] as Segment[],
    mainPipe: [] as Segment[],
    branches: { red: [], blue: [], yellow: [] } as Record<Color, Segment[]>,
    jars: { red: [], blue: [], yellow: [] } as Record<Color, Segment[]>,
    totalDrained: 0,
    totalSpillage: 0
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setFlowState(prev => {
        let tank = { ...prev.tank };
        let funnel = [...prev.funnel];
        let mainPipe = [...prev.mainPipe];
        let branches = { red: [...prev.branches.red], blue: [...prev.branches.blue], yellow: [...prev.branches.yellow] };
        let jars = { red: [...prev.jars.red], blue: [...prev.jars.blue], yellow: [...prev.jars.yellow] };
        let totalDrained = prev.totalDrained;
        let totalSpillage = prev.totalSpillage;

        // 1. Tank -> Funnel (Always tries to fill funnel if space)
        const funnelVol = getTotalVolume(funnel);
        if (funnelVol < FUNNEL_CAPACITY) {
          let flowingColor: Color | null = null;
          // Red is bottom layer (flows first), then Blue, then Yellow
          if (tank.red > 0) flowingColor = 'red';
          else if (tank.blue > 0) flowingColor = 'blue';
          else if (tank.yellow > 0) flowingColor = 'yellow';

          if (flowingColor) {
            const amount = Math.min(FLOW_RATE, tank[flowingColor], FUNNEL_CAPACITY - funnelVol);
            tank[flowingColor] -= amount;
            funnel = addToQueue(funnel, flowingColor, amount);
          }
        }

        // 2. Funnel -> Main Pipe (Controlled by Valve)
        if (isTapOpen && funnel.length > 0) {
          const { newQueue, removed } = removeFromQueue(funnel, FLOW_RATE);
          funnel = newQueue;
          removed.forEach(seg => {
            mainPipe = addToQueue(mainPipe, seg.color, seg.volume);
          });
        }

        // 3. Main Pipe -> Branch Pipe (Always flowing if content)
        if (mainPipe.length > 0) {
          const { newQueue, removed } = removeFromQueue(mainPipe, FLOW_RATE);
          mainPipe = newQueue;
          removed.forEach(seg => {
            branches[sorterDirection] = addToQueue(branches[sorterDirection], seg.color, seg.volume);
          });
        }

        // 4. Branch Pipes -> Jars (Always draining)
        (['red', 'blue', 'yellow'] as Color[]).forEach(branch => {
          if (branches[branch].length > 0) {
            const { newQueue, removed } = removeFromQueue(branches[branch], FLOW_RATE);
            branches[branch] = newQueue;
            removed.forEach(seg => {
              jars[branch] = addToQueue(jars[branch], seg.color, seg.volume);
              totalDrained += seg.volume;
              if (seg.color !== branch) {
                totalSpillage += seg.volume;
              }
            });
          }
        });

        return { tank, funnel, mainPipe, branches, jars, totalDrained, totalSpillage };
      });
    }, 50);
    return () => clearInterval(interval);
  }, [isTapOpen, sorterDirection]);

  const toggleSorter = () => {
    const directions: Color[] = ['red', 'blue', 'yellow'];
    const currentIndex = directions.indexOf(sorterDirection);
    setSorterDirection(directions[(currentIndex + 1) % 3]);
  };

  const spillagePercent = flowState.totalDrained > 0 ? (flowState.totalSpillage / flowState.totalDrained) * 100 : 0;

  return (
    <div 
      className="h-screen w-full bg-slate-950 overflow-hidden relative flex flex-col items-center justify-between py-4"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Spillage Bar - Right Side */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 z-50">
        <div className="flex flex-col items-center">
          <AlertTriangle className={`w-6 h-6 mb-2 ${spillagePercent > 30 ? 'text-red-500 animate-pulse' : 'text-yellow-500'}`} />
          <span className="text-[10px] font-black text-white/60 tracking-widest uppercase">Spillage</span>
        </div>
        <div className="w-8 h-64 bg-slate-900/80 border-2 border-white/10 rounded-full p-1 relative overflow-hidden shadow-2xl">
          <motion.div 
            className="absolute bottom-1 left-1 right-1 bg-gradient-to-t from-red-600 to-orange-400 rounded-full"
            animate={{ height: `${Math.min(100, spillagePercent)}%` }}
            transition={{ type: 'spring', stiffness: 50 }}
          />
        </div>
        <span className="text-xs font-bold text-white font-mono">{Math.round(spillagePercent)}%</span>
      </div>

      {/* Top Section: Tank & Funnel */}
      <div className="flex flex-col items-center scale-90 md:scale-100">
        {/* 3D Tank */}
        <div className="w-44 h-52 bg-slate-900/40 backdrop-blur-xl border-[4px] border-white/40 rounded-2xl overflow-hidden relative shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_0_30px_rgba(255,255,255,0.1)]">
          <div className="flex flex-col-reverse h-full w-full">
            <motion.div className="bg-gradient-to-t from-red-700 to-red-500 w-full" animate={{ height: `${flowState.tank.red / 3}%` }} />
            <motion.div className="bg-gradient-to-t from-blue-700 to-blue-500 w-full" animate={{ height: `${flowState.tank.blue / 3}%` }} />
            <motion.div className="bg-gradient-to-t from-yellow-600 to-yellow-400 w-full" animate={{ height: `${flowState.tank.yellow / 3}%` }} />
          </div>
          <div className="absolute top-0 left-4 w-3 h-full bg-white/20 rounded-full z-10" />
        </div>

        {/* 3D Conical Funnel */}
        <div 
          className="w-36 h-20 bg-white/15 backdrop-blur-xl border-x-[4px] border-b-[4px] border-white/30 relative mt-[-4px] shadow-lg overflow-hidden"
          style={{ clipPath: 'polygon(0% 0%, 100% 0%, 65% 100%, 35% 100%)' }}
        >
          <QueueVisualizer 
            queue={flowState.funnel} 
            capacity={FUNNEL_CAPACITY} 
            className="w-full h-full" 
            isFlowing={isTapOpen}
          />
        </div>

        {/* Valve Mechanism */}
        <Valve isOpen={isTapOpen} onToggle={() => setIsTapOpen(!isTapOpen)} />
      </div>

      {/* Middle Section: Pipes & Sorter */}
      <div className="flex-1 flex flex-col items-center w-full max-w-3xl relative">
        {/* Main Vertical Pipe (Round Cylinder) */}
        <QueueVisualizer 
          queue={flowState.mainPipe} 
          capacity={MAIN_PIPE_CAPACITY} 
          className="w-10 h-full min-h-[60px] bg-slate-900/40 border-x-2 border-white/40 shadow-inner rounded-full"
          isFlowing={flowState.mainPipe.length > 0}
        />

        {/* Sorter Junction */}
        <div className="relative z-40">
          <button 
            onClick={toggleSorter}
            className="w-16 h-16 bg-gradient-to-br from-slate-700 to-slate-900 border-4 border-slate-600 rounded-full flex items-center justify-center shadow-[0_8px_0_rgba(0,0,0,0.5),0_15px_30px_rgba(0,0,0,0.4)] hover:brightness-110 transition-all active:translate-y-1 active:shadow-none"
          >
            <motion.div animate={{ rotate: sorterDirection === 'red' ? -45 : sorterDirection === 'blue' ? 0 : 45 }}>
              <Settings2 className="w-8 h-8 text-white" />
            </motion.div>
          </button>
          <div className={`absolute -top-8 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full border border-white/20 text-[9px] font-black tracking-widest uppercase whitespace-nowrap ${
            sorterDirection === 'red' ? 'text-red-400' : sorterDirection === 'blue' ? 'text-blue-400' : 'text-yellow-400'
          }`}>
            Target: {sorterDirection}
          </div>
        </div>

        {/* Branching Pipes (Round Cylindrical) */}
        <div className="w-full h-28 relative flex justify-center">
          {/* Horizontal Connector - Rounded */}
          <div className="absolute top-0 left-[12%] right-[12%] h-8 bg-gradient-to-b from-white/5 via-white/25 to-white/5 border-y-2 border-white/30 shadow-inner rounded-full" />
          
          {/* Branch Vertical Pipes */}
          {[
            { pos: 'left-[12%]', color: 'red' as Color },
            { pos: 'left-1/2 -translate-x-1/2', color: 'blue' as Color },
            { pos: 'right-[12%]', color: 'yellow' as Color }
          ].map((pipe, i) => (
            <QueueVisualizer 
              key={i}
              queue={flowState.branches[pipe.color]} 
              capacity={BRANCH_PIPE_CAPACITY} 
              className={`absolute top-0 ${pipe.pos} w-10 h-full bg-slate-900/40 border-x-2 border-white/40 shadow-inner rounded-b-full`}
              isFlowing={flowState.branches[pipe.color].length > 0}
            />
          ))}
        </div>
      </div>

      {/* Bottom Section: Jars */}
      <div className="flex gap-8 md:gap-20 items-end pb-6 scale-90 md:scale-100">
        <Jar color="red" label="Essence A" contents={flowState.jars.red} />
        <Jar color="blue" label="Essence B" contents={flowState.jars.blue} />
        <Jar color="yellow" label="Essence C" contents={flowState.jars.yellow} />
      </div>

      {/* Floor Reflection */}
      <div className="absolute bottom-0 w-full h-24 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
    </div>
  );
}
