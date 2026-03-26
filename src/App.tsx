import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Settings2, RotateCw } from 'lucide-react';
import backgroundImage from './assets/background.png';

type Color = 'red' | 'blue' | 'yellow';

const Jar = ({ color, label, fillLevel }: { color: Color, label: string, fillLevel: number }) => {
  const labelColors = {
    red: 'bg-red-600 border-red-400 shadow-red-900/50',
    blue: 'bg-blue-600 border-blue-400 shadow-blue-900/50',
    yellow: 'bg-yellow-500 border-yellow-300 shadow-yellow-900/50'
  };

  const sandColors = {
    red: 'bg-gradient-to-t from-red-700 via-red-500 to-red-400 shadow-[0_0_20px_rgba(239,68,68,0.5)]',
    blue: 'bg-gradient-to-t from-blue-700 via-blue-500 to-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.5)]',
    yellow: 'bg-gradient-to-t from-yellow-600 via-yellow-400 to-yellow-300 shadow-[0_0_20px_rgba(234,179,8,0.5)]'
  };

  return (
    <div className="relative flex flex-col items-center">
      {/* 3D Glass Jar */}
      <div className="relative w-28 h-36 bg-white/10 backdrop-blur-lg border-[3px] border-white/30 rounded-b-[40px] rounded-t-[10px] shadow-[0_10px_30px_rgba(0,0,0,0.5),inset_0_0_20px_rgba(255,255,255,0.2)] overflow-hidden">
        {/* Glass Highlights */}
        <div className="absolute top-0 left-4 w-2 h-full bg-gradient-to-r from-white/30 to-transparent opacity-40 z-20" />
        <div className="absolute top-0 right-4 w-1 h-full bg-gradient-to-l from-white/20 to-transparent opacity-30 z-20" />
        
        {/* Sand Content */}
        <motion.div 
          className={`absolute bottom-0 w-full ${sandColors[color]} z-10`}
          initial={{ height: 0 }}
          animate={{ height: `${fillLevel}%` }}
          transition={{ type: 'spring', stiffness: 30, damping: 15 }}
        >
          {/* Sand Surface Curve */}
          <div className="absolute -top-2 w-full h-4 bg-inherit rounded-[100%] opacity-90 border-t border-white/20" />
        </motion.div>

        {/* Rim Detail */}
        <div className="absolute top-0 w-full h-4 bg-white/20 border-b-2 border-white/30 rounded-t-[10px] z-20" />
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
  const [tankSand, setTankSand] = useState({ red: 100, blue: 100, yellow: 100 });
  const [jarSand, setJarSand] = useState({ red: 0, blue: 0, yellow: 0 });
  const [isFlowing, setIsFlowing] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTapOpen) {
      interval = setInterval(() => {
        setTankSand(prev => {
          const currentSand = prev[sorterDirection];
          if (currentSand <= 0) {
            setIsFlowing(false);
            return prev;
          }
          setIsFlowing(true);
          return { ...prev, [sorterDirection]: Math.max(0, currentSand - 0.4) };
        });

        setJarSand(prev => {
          const currentJar = prev[sorterDirection];
          if (currentJar >= 100) return prev;
          return { ...prev, [sorterDirection]: Math.min(100, currentJar + 0.4) };
        });
      }, 50);
    } else {
      setIsFlowing(false);
    }
    return () => clearInterval(interval);
  }, [isTapOpen, sorterDirection]);

  const toggleSorter = () => {
    const directions: Color[] = ['red', 'blue', 'yellow'];
    const currentIndex = directions.indexOf(sorterDirection);
    setSorterDirection(directions[(currentIndex + 1) % 3]);
  };

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
      {/* Top Section: Tank & Funnel */}
      <div className="flex flex-col items-center scale-90 md:scale-100">
        {/* 3D Tank */}
        <div className="w-44 h-52 bg-white/10 backdrop-blur-xl border-[4px] border-white/30 rounded-2xl overflow-hidden relative shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_0_30px_rgba(255,255,255,0.1)]">
          <div className="flex flex-col-reverse h-full w-full">
            <motion.div className="bg-gradient-to-t from-yellow-600 to-yellow-400 w-full" animate={{ height: `${tankSand.yellow / 3}%` }} />
            <motion.div className="bg-gradient-to-t from-blue-700 to-blue-500 w-full" animate={{ height: `${tankSand.blue / 3}%` }} />
            <motion.div className="bg-gradient-to-t from-red-700 to-red-500 w-full" animate={{ height: `${tankSand.red / 3}%` }} />
          </div>
          {/* Glass Shine */}
          <div className="absolute top-0 left-4 w-3 h-full bg-white/20 rounded-full z-10" />
        </div>

        {/* 3D Conical Funnel */}
        <div 
          className="w-36 h-20 bg-white/15 backdrop-blur-xl border-x-[4px] border-b-[4px] border-white/30 relative mt-[-4px] shadow-lg"
          style={{ clipPath: 'polygon(0% 0%, 100% 0%, 65% 100%, 35% 100%)' }}
        >
          {isFlowing && (
            <div className={`absolute inset-x-0 bottom-0 w-full h-full opacity-60 ${
              sorterDirection === 'red' ? 'bg-red-500' : sorterDirection === 'blue' ? 'bg-blue-500' : 'bg-yellow-400'
            }`} />
          )}
        </div>

        {/* Valve Mechanism */}
        <Valve isOpen={isTapOpen} onToggle={() => setIsTapOpen(!isTapOpen)} />
      </div>

      {/* Middle Section: Pipes & Sorter */}
      <div className="flex-1 flex flex-col items-center w-full max-w-3xl relative">
        {/* Main Vertical Pipe (3D Cylinder) */}
        <div className="w-6 h-full min-h-[50px] bg-gradient-to-r from-white/5 via-white/20 to-white/5 border-x-2 border-white/30 relative overflow-hidden shadow-inner">
          {isFlowing && (
            <motion.div 
              className={`absolute inset-x-0 top-0 w-full h-full opacity-80 ${
                sorterDirection === 'red' ? 'bg-red-500' : sorterDirection === 'blue' ? 'bg-blue-500' : 'bg-yellow-400'
              }`}
              animate={{ y: [0, 10] }}
              transition={{ repeat: Infinity, duration: 0.1, ease: 'linear' }}
            />
          )}
        </div>

        {/* Sorter Junction (3D Gear) */}
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
            Sorter: {sorterDirection}
          </div>
        </div>

        {/* Branching Pipes (3D Cylindrical) */}
        <div className="w-full h-28 relative flex justify-center">
          {/* Horizontal Connector */}
          <div className="absolute top-0 left-[12%] right-[12%] h-6 bg-gradient-to-b from-white/5 via-white/20 to-white/5 border-y-2 border-white/30 shadow-inner" />
          
          {/* Branch Vertical Pipes */}
          {[
            { pos: 'left-[12%]', color: 'red' },
            { pos: 'left-1/2 -translate-x-1/2', color: 'blue' },
            { pos: 'right-[12%]', color: 'yellow' }
          ].map((pipe, i) => (
            <div key={i} className={`absolute top-0 ${pipe.pos} w-6 h-full bg-gradient-to-r from-white/5 via-white/20 to-white/5 border-x-2 border-white/30 overflow-hidden shadow-inner`}>
              {isFlowing && sorterDirection === pipe.color && (
                <motion.div 
                  className={`absolute inset-x-0 top-0 w-full h-full opacity-80 ${
                    pipe.color === 'red' ? 'bg-red-500' : pipe.color === 'blue' ? 'bg-blue-500' : 'bg-yellow-400'
                  }`}
                  animate={{ y: [0, 10] }}
                  transition={{ repeat: Infinity, duration: 0.1, ease: 'linear' }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Section: Jars */}
      <div className="flex gap-8 md:gap-20 items-end pb-6 scale-90 md:scale-100">
        <Jar color="red" label="Essence A" fillLevel={jarSand.red} />
        <Jar color="blue" label="Essence B" fillLevel={jarSand.blue} />
        <Jar color="yellow" label="Essence C" fillLevel={jarSand.yellow} />
      </div>

      {/* Floor Reflection */}
      <div className="absolute bottom-0 w-full h-24 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
    </div>
  );
}
