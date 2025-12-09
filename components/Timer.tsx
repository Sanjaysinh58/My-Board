import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RefreshCw, X, GripHorizontal } from 'lucide-react';

interface TimerProps {
  onClose: () => void;
}

export const Timer: React.FC<TimerProps> = ({ onClose }) => {
  const [mode, setMode] = useState<'stopwatch' | 'timer'>('stopwatch');
  const [time, setTime] = useState(0); // in seconds
  const [isActive, setIsActive] = useState(false);
  const [initialTime, setInitialTime] = useState(300); // Default 5 min for timer
  const [position, setPosition] = useState({ x: 20, y: 80 });
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    let interval: number | undefined;

    if (isActive) {
      interval = window.setInterval(() => {
        if (mode === 'stopwatch') {
          setTime((t) => t + 1);
        } else {
          setTime((t) => {
            if (t <= 0) {
              setIsActive(false);
              return 0;
            }
            return t - 1;
          });
        }
      }, 1000);
    } else if (!isActive && time !== 0) {
      clearInterval(interval);
    }

    return () => clearInterval(interval);
  }, [isActive, time, mode]);

  const toggleTimer = () => setIsActive(!isActive);

  const resetTimer = () => {
    setIsActive(false);
    setTime(mode === 'stopwatch' ? 0 : initialTime);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        setPosition({
          x: e.clientX - dragOffset.current.x,
          y: e.clientY - dragOffset.current.y
        });
      }
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div 
      className="fixed z-50 bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-2xl shadow-2xl overflow-hidden w-64 animate-in zoom-in-95 duration-200"
      style={{ left: position.x, top: position.y }}
    >
      {/* Header / Drag Handle */}
      <div 
        className="bg-gray-800 p-2 flex justify-between items-center cursor-move"
        onMouseDown={handleMouseDown}
      >
        <div className="flex gap-2">
           <button 
             onClick={() => { setMode('stopwatch'); setTime(0); setIsActive(false); }}
             className={`text-xs px-2 py-1 rounded ${mode === 'stopwatch' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
           >
             Stopwatch
           </button>
           <button 
             onClick={() => { setMode('timer'); setTime(initialTime); setIsActive(false); }}
             className={`text-xs px-2 py-1 rounded ${mode === 'timer' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
           >
             Timer
           </button>
        </div>
        <div className="flex items-center gap-2">
           <GripHorizontal size={16} className="text-gray-600" />
           <button onClick={onClose} className="text-gray-400 hover:text-red-400">
             <X size={16} />
           </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col items-center">
        <div className="text-5xl font-mono font-bold text-white mb-4 tabular-nums tracking-wider">
          {formatTime(time)}
        </div>
        
        {mode === 'timer' && !isActive && time === initialTime && (
          <div className="flex gap-2 mb-4 w-full justify-center">
             {[1, 5, 10, 15].map(min => (
               <button 
                 key={min}
                 onClick={() => { setInitialTime(min * 60); setTime(min * 60); }}
                 className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded border border-gray-700"
               >
                 {min}m
               </button>
             ))}
          </div>
        )}

        <div className="flex items-center gap-4">
          <button 
            onClick={toggleTimer}
            className={`p-3 rounded-full transition-all ${isActive ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-green-600 hover:bg-green-500'} text-white shadow-lg`}
          >
            {isActive ? <Pause size={24} /> : <Play size={24} fill="currentColor" />}
          </button>
          
          <button 
            onClick={resetTimer}
            className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
          >
            <RefreshCw size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};