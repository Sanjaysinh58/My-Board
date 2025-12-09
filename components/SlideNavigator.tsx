import React from 'react';
import { Slide } from '../types';
import { X, LayoutGrid, Trash2, Plus } from 'lucide-react';

interface SlideNavigatorProps {
  isOpen: boolean;
  onClose: () => void;
  slides: Slide[];
  currentIndex: number;
  onSelectSlide: (index: number) => void;
  onAddSlide: () => void;
  onDeleteSlide: (id: string) => void;
}

export const SlideNavigator: React.FC<SlideNavigatorProps> = ({
  isOpen,
  onClose,
  slides,
  currentIndex,
  onSelectSlide,
  onAddSlide,
  onDeleteSlide,
}) => {
  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[59] transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div 
        className={`fixed top-0 left-0 h-full w-80 bg-[#121212]/95 backdrop-blur-2xl border-r border-white/10 shadow-2xl z-[60] transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 flex flex-col h-full min-h-0">
          <div className="flex justify-between items-center mb-6 shrink-0">
            <div className="flex items-center gap-3 text-indigo-400">
              <LayoutGrid size={24} />
              <h2 className="text-lg font-bold text-white uppercase tracking-wider">Slide Deck</h2>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* List of Slides */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar pb-20">
            {slides.map((slide, index) => (
              <div 
                key={slide.id}
                onClick={() => {
                  onSelectSlide(index);
                  onClose();
                }}
                className={`group cursor-pointer p-3 rounded-2xl border transition-all flex flex-col gap-3 relative ${
                  index === currentIndex 
                    ? 'border-indigo-500/50 bg-indigo-500/10' 
                    : 'border-transparent hover:bg-white/5 hover:border-white/10'
                }`}
              >
                {/* Delete Button (Visible on hover) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSlide(slide.id);
                  }}
                  className="absolute top-4 right-4 z-10 p-2 bg-red-500/90 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600 hover:scale-105"
                  title="Delete Slide"
                >
                  <Trash2 size={16} />
                </button>

                <div className="w-full aspect-video bg-black rounded-xl overflow-hidden relative border border-white/10 shrink-0 shadow-lg group-hover:shadow-indigo-500/10 transition-shadow">
                  <img 
                    src={slide.thumbnailUrl || slide.imageUrl} 
                    alt={`Slide ${index + 1}`}
                    className="w-full h-full object-contain bg-[#1a1a1a]"
                  />
                  <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md text-xs font-mono text-white shadow-sm border border-white/10">
                    {index + 1}
                  </div>
                </div>
                <p className={`text-sm font-medium truncate px-1 transition-colors ${index === currentIndex ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
                  {slide.title || `Slide ${index + 1}`}
                </p>
              </div>
            ))}
          </div>

          {/* Add Slide Button Area */}
          <div className="absolute bottom-0 left-0 w-full p-5 bg-[#121212] border-t border-white/10">
            <button
              onClick={onAddSlide}
              className="w-full py-3 px-4 bg-white/5 hover:bg-white/10 border-2 border-dashed border-white/20 hover:border-indigo-500/50 rounded-xl flex items-center justify-center gap-2 text-gray-400 hover:text-white transition-all group"
            >
              <div className="p-1 rounded-full bg-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                <Plus size={18} />
              </div>
              <span className="font-medium">Add New Slide</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};