import React from 'react';
import { X, MessageSquare, BookOpen, Sparkles } from 'lucide-react';
import { AIResponse } from '../types';

interface AIPanelProps {
  isOpen: boolean;
  onClose: () => void;
  data: AIResponse | null;
  isLoading: boolean;
}

export const AIPanel: React.FC<AIPanelProps> = ({ isOpen, onClose, data, isLoading }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed top-0 right-0 h-full w-96 bg-gray-900/95 backdrop-blur-xl border-l border-gray-700 shadow-2xl z-40 transform transition-transform duration-300 overflow-y-auto">
      <div className="p-6">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-2 text-purple-400">
            <Sparkles size={24} />
            <h2 className="text-xl font-bold text-white">Teacher's Assistant</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-4 bg-gray-800 rounded w-3/4"></div>
            <div className="h-4 bg-gray-800 rounded w-full"></div>
            <div className="h-4 bg-gray-800 rounded w-5/6"></div>
            <div className="h-32 bg-gray-800 rounded mt-8"></div>
          </div>
        ) : data ? (
          <div className="space-y-8 animate-fade-in">
            <section>
              <div className="flex items-center gap-2 mb-3 text-blue-400">
                <BookOpen size={18} />
                <h3 className="font-semibold uppercase tracking-wider text-sm">Slide Summary</h3>
              </div>
              <p className="text-gray-300 leading-relaxed text-sm bg-gray-800/50 p-4 rounded-xl border border-gray-700/50">
                {data.summary}
              </p>
            </section>

            <section>
              <div className="flex items-center gap-2 mb-3 text-green-400">
                <MessageSquare size={18} />
                <h3 className="font-semibold uppercase tracking-wider text-sm">Discussion Questions</h3>
              </div>
              <ul className="space-y-3">
                {data.questions.map((q, i) => (
                  <li key={i} className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50 hover:border-green-500/30 transition-colors">
                    <span className="text-green-500 font-bold mr-2">Q{i + 1}.</span>
                    <span className="text-gray-300 text-sm">{q}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : (
          <div className="text-center text-gray-500 mt-20">
            <Sparkles size={48} className="mx-auto mb-4 opacity-20" />
            <p>Click "AI Assist" in the toolbar to analyze the current slide.</p>
          </div>
        )}
      </div>
    </div>
  );
};
