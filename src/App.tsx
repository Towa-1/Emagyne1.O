/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { KaTeXRenderer } from './components/KaTeXRenderer';
import { parseQuestions } from './services/geminiService';
import { Question, ExamState } from './types';
import { Modal } from './components/Modal';
import { cn } from './lib/utils';
import { 
  Play, 
  Settings, 
  FileText, 
  CheckCircle2, 
  Clock, 
  Pause, 
  RotateCcw, 
  ArrowRight, 
  ArrowLeft, 
  Flag, 
  LogOut,
  AlertCircle,
  Trophy,
  Timer
} from 'lucide-react';

const STORAGE_KEY = 'emagyne_exam_state';

const INITIAL_STATE: ExamState = {
  questions: [],
  duration: 60,
  startTime: null,
  endTime: null,
  userAnswers: {},
  markedForReview: new Set(),
  checkedAnswers: new Set(),
  isPaused: false,
  timeRemaining: 0,
  phase: 'INPUT',
};

export default function App() {
  const [state, setState] = useState<ExamState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          markedForReview: new Set(parsed.markedForReview),
          checkedAnswers: new Set(parsed.checkedAnswers),
        };
      } catch (e) {
        return INITIAL_STATE;
      }
    }
    return INITIAL_STATE;
  });

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [rawInput, setRawInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Scroll to top on question change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentQuestionIndex]);

  // Persistence
  useEffect(() => {
    const stateToSave = {
      ...state,
      markedForReview: Array.from(state.markedForReview),
      checkedAnswers: Array.from(state.checkedAnswers),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  }, [state]);

  // Timer logic
  useEffect(() => {
    if (state.phase === 'QUIZ' && !state.isPaused && state.timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setState(prev => {
          if (prev.timeRemaining <= 1) {
            clearInterval(timerRef.current!);
            return { ...prev, timeRemaining: 0, phase: 'RESULTS', endTime: Date.now() };
          }
          return { ...prev, timeRemaining: prev.timeRemaining - 1 };
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.phase, state.isPaused, state.timeRemaining]);

  const handleParse = async () => {
    if (!rawInput.trim()) return;
    setIsParsing(true);
    try {
      const questions = await parseQuestions(rawInput);
      if (questions.length > 0) {
        setState(prev => ({ ...prev, questions, phase: 'SETUP' }));
      } else {
        alert("No questions could be parsed. Please check your input format.");
      }
    } catch (e) {
      console.error(e);
      alert("An error occurred while parsing questions.");
    } finally {
      setIsParsing(false);
    }
  };

  const startExam = () => {
    setState(prev => ({
      ...prev,
      phase: 'QUIZ',
      startTime: Date.now(),
      timeRemaining: prev.duration * 60,
      isPaused: false,
      userAnswers: {},
      markedForReview: new Set(),
      checkedAnswers: new Set(),
    }));
    setCurrentQuestionIndex(0);
  };

  const finishExam = () => {
    setState(prev => ({
      ...prev,
      phase: 'RESULTS',
      endTime: Date.now(),
    }));
  };

  const resetExam = () => {
    setState(INITIAL_STATE);
    setCurrentQuestionIndex(0);
    setRawInput('');
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentQuestion = state.questions[currentQuestionIndex];

  return (
    <ErrorBoundary>
      <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
        <header className="w-full max-w-6xl flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-500 rounded-xl flex items-center justify-center shadow-lg shadow-yellow-500/20">
              <Trophy className="text-slate-950" size={28} />
            </div>
            <h1 className="text-4xl gold-gradient-text uppercase">Emagyne</h1>
          </div>
          
          {state.phase === 'QUIZ' && (
            <div className="flex items-center gap-6 glass-panel px-6 py-3 rounded-2xl">
              <div className="flex items-center gap-2 text-yellow-500 font-mono text-xl font-bold">
                <Clock size={20} />
                {formatTime(state.timeRemaining)}
              </div>
              <div className="h-6 w-px bg-yellow-500/20" />
              <button 
                onClick={() => setState(prev => ({ ...prev, isPaused: !prev.isPaused }))}
                className="text-yellow-500 hover:text-yellow-400 transition-colors"
              >
                {state.isPaused ? <Play size={24} fill="currentColor" /> : <Pause size={24} fill="currentColor" />}
              </button>
            </div>
          )}
        </header>

        <main className="w-full max-w-6xl flex-1 flex flex-col">
          <AnimatePresence mode="wait">
            {state.phase === 'INPUT' && (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="glass-panel p-8 rounded-3xl flex flex-col h-full min-h-[600px]"
              >
                <div className="flex items-center gap-3 mb-6">
                  <FileText className="text-yellow-500" />
                  <h2 className="text-2xl font-bold">Initialize Dataset</h2>
                </div>
                <p className="text-slate-400 mb-6">
                  Paste your questions below. You can use the 6-column pipe format: 
                  <code className="bg-slate-800 px-2 py-1 rounded text-yellow-500 mx-1">Type | Question | Options/Unit | Answer | Explanation | ImageUrl</code>
                  or just paste raw text and our AI will handle the rest.
                </p>
                <textarea
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                  placeholder="Example: MCQ | What is 2+2? | 2,3,4,5 | 4 | Basic math | https://example.com/math.png"
                  className="flex-1 bg-slate-950/50 border border-yellow-500/10 rounded-2xl p-6 font-mono text-sm focus:outline-none focus:border-yellow-500/40 transition-colors resize-none"
                />
                <div className="flex gap-4 mt-8">
                  <button
                    onClick={handleParse}
                    disabled={isParsing || !rawInput.trim()}
                    className="flex-[2] py-4 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-lg rounded-2xl transition-all flex items-center justify-center gap-2"
                  >
                    {isParsing ? (
                      <>
                        <RotateCcw className="animate-spin" />
                        AI PARSING IN PROGRESS...
                      </>
                    ) : (
                      <>
                        <Play fill="currentColor" />
                        GENERATE SIMULATOR
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setRawInput("MCQ | What is the derivative of $x^2$? | $2x$, $x^2$, $2$, $x$ | $2x$ | The power rule states that $\\frac{d}{dx}x^n = nx^{n-1}$. \nNUM | Calculate the area of a circle with radius $r=5$ cm. Use $\\pi \\approx 3.14$. | cm$^2$ | 78.5 | Area $A = \\pi r^2 = 3.14 \\times 5^2 = 3.14 \\times 25 = 78.5$.")}
                    className="flex-1 py-4 border border-yellow-500/20 text-yellow-500 font-bold rounded-2xl hover:bg-yellow-500/10 transition-all"
                  >
                    LOAD DEMO
                  </button>
                </div>
              </motion.div>
            )}

            {state.phase === 'SETUP' && (
              <motion.div
                key="setup"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass-panel p-12 rounded-3xl max-w-2xl mx-auto w-full text-center"
              >
                <Settings className="text-yellow-500 mx-auto mb-6" size={48} />
                <h2 className="text-3xl font-black mb-2 uppercase tracking-tight">Exam Configuration</h2>
                <p className="text-slate-400 mb-12">Set your parameters before beginning the proctored session.</p>
                
                <div className="mb-12">
                  <label className="block text-sm font-bold text-yellow-500/60 uppercase tracking-widest mb-4">Duration (Minutes)</label>
                  <div className="flex items-center justify-center gap-8">
                    <button 
                      onClick={() => setState(prev => ({ ...prev, duration: Math.max(1, prev.duration - 5) }))}
                      className="w-12 h-12 rounded-full border border-yellow-500/20 flex items-center justify-center text-yellow-500 hover:bg-yellow-500/10 transition-colors"
                    >
                      <ArrowLeft size={24} />
                    </button>
                    <input
                      type="number"
                      value={state.duration}
                      onChange={(e) => setState(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
                      className="bg-transparent text-6xl font-black text-yellow-500 w-32 text-center focus:outline-none"
                    />
                    <button 
                      onClick={() => setState(prev => ({ ...prev, duration: prev.duration + 5 }))}
                      className="w-12 h-12 rounded-full border border-yellow-500/20 flex items-center justify-center text-yellow-500 hover:bg-yellow-500/10 transition-colors"
                    >
                      <ArrowRight size={24} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-12">
                  <div className="bg-slate-950/50 p-4 rounded-2xl border border-yellow-500/5">
                    <div className="text-slate-500 text-xs uppercase font-bold mb-1">Questions</div>
                    <div className="text-2xl font-black text-yellow-500">{state.questions.length}</div>
                  </div>
                  <div className="bg-slate-950/50 p-4 rounded-2xl border border-yellow-500/5">
                    <div className="text-slate-500 text-xs uppercase font-bold mb-1">Mode</div>
                    <div className="text-2xl font-black text-yellow-500">Proctored</div>
                  </div>
                </div>

                <button
                  onClick={startExam}
                  className="w-full py-5 bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-black text-xl rounded-2xl transition-all shadow-xl shadow-yellow-500/20"
                >
                  START SIMULATION
                </button>
                <button
                  onClick={() => setState(prev => ({ ...prev, phase: 'INPUT' }))}
                  className="mt-4 text-slate-500 hover:text-yellow-500 transition-colors font-bold"
                >
                  Back to Input
                </button>
              </motion.div>
            )}

            {state.phase === 'QUIZ' && (
              <motion.div
                key="quiz"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col md:flex-row gap-8 h-full"
              >
                {/* Navigator Sidebar */}
                <aside className="w-full md:w-80 glass-panel p-6 rounded-3xl h-fit sticky top-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-black uppercase tracking-wider text-sm text-yellow-500">Navigator</h3>
                    <span className="text-xs text-slate-500 font-bold">{currentQuestionIndex + 1} / {state.questions.length}</span>
                  </div>

                  <div className="relative mb-6">
                    <input
                      type="text"
                      placeholder="Find question..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-950/50 border border-yellow-500/10 rounded-xl py-2 px-4 text-sm focus:outline-none focus:border-yellow-500/40 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-5 gap-2 mb-8 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {state.questions.map((q, idx) => {
                      const isAnswered = state.userAnswers[q.id] !== undefined;
                      const isMarked = state.markedForReview.has(q.id);
                      const isCurrent = idx === currentQuestionIndex;
                      const isChecked = state.checkedAnswers.has(q.id);
                      const isCorrect = isChecked && state.userAnswers[q.id] === q.answer;
                      
                      // Filter by search query
                      if (searchQuery && !q.question.toLowerCase().includes(searchQuery.toLowerCase())) {
                        return null;
                      }

                      return (
                        <button
                          key={idx}
                          onClick={() => setCurrentQuestionIndex(idx)}
                          className={cn(
                            "aspect-square rounded-lg flex items-center justify-center text-sm font-bold transition-all",
                            isCurrent ? "ring-2 ring-yellow-500 scale-110 z-10" : "",
                            isChecked 
                              ? (isCorrect ? "bg-green-500 text-white" : "bg-red-500 text-white")
                              : (isAnswered ? "bg-yellow-500 text-slate-950" : "bg-slate-800 text-slate-400"),
                            isMarked && !isChecked ? "border-2 border-blue-400" : ""
                          )}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>
                  
                  <div className="space-y-3 pt-6 border-t border-yellow-500/10">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                      <div className="w-3 h-3 bg-yellow-500 rounded-sm" /> Answered
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                      <div className="w-3 h-3 bg-slate-800 rounded-sm" /> Unanswered
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                      <div className="w-3 h-3 border-2 border-blue-400 rounded-sm" /> Marked for Review
                    </div>
                  </div>

                  <button
                    onClick={() => setIsExitModalOpen(true)}
                    className="w-full mt-8 py-3 rounded-xl border border-red-500/20 text-red-500 font-bold hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2"
                  >
                    <LogOut size={18} />
                    EXIT EXAM
                  </button>
                </aside>

                {/* Question Area */}
                <div className="flex-1 flex flex-col gap-6">
                  <div className="glass-panel p-8 rounded-3xl flex-1 relative overflow-hidden">
                    {state.isPaused && (
                      <div className="absolute inset-0 z-20 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center">
                        <Pause size={64} className="text-yellow-500 mb-4" />
                        <h2 className="text-3xl font-black text-yellow-500 uppercase">Simulation Paused</h2>
                        <button 
                          onClick={() => setState(prev => ({ ...prev, isPaused: false }))}
                          className="mt-6 px-8 py-3 bg-yellow-500 text-slate-950 font-black rounded-xl hover:bg-yellow-600 transition-colors"
                        >
                          RESUME SESSION
                        </button>
                      </div>
                    )}

                    <div className="flex justify-between items-start mb-8">
                      <span className="px-3 py-1 bg-yellow-500/10 text-yellow-500 text-xs font-black rounded-full uppercase tracking-widest">
                        {currentQuestion.type}
                      </span>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input 
                          type="checkbox"
                          checked={state.markedForReview.has(currentQuestion.id)}
                          onChange={(e) => {
                            const newMarked = new Set(state.markedForReview);
                            if (e.target.checked) newMarked.add(currentQuestion.id);
                            else newMarked.delete(currentQuestion.id);
                            setState(prev => ({ ...prev, markedForReview: newMarked }));
                          }}
                          className="hidden"
                        />
                        <div className={cn(
                          "w-5 h-5 rounded border-2 transition-all flex items-center justify-center",
                          state.markedForReview.has(currentQuestion.id) ? "bg-blue-500 border-blue-500" : "border-slate-700 group-hover:border-yellow-500"
                        )}>
                          {state.markedForReview.has(currentQuestion.id) && <Flag size={12} fill="white" />}
                        </div>
                        <span className="text-xs font-bold text-slate-500 group-hover:text-slate-300">Mark for Review</span>
                      </label>
                    </div>

                    <div className="prose prose-invert max-w-none mb-8">
                      <div className="text-xl font-medium leading-relaxed text-slate-200">
                        <KaTeXRenderer content={currentQuestion.question} />
                      </div>
                    </div>

                    <div className="space-y-4">
                      {currentQuestion.type === 'MCQ' ? (
                        currentQuestion.options?.map((option, idx) => {
                          const isSelected = state.userAnswers[currentQuestion.id] === option;
                          const isChecked = state.checkedAnswers.has(currentQuestion.id);
                          const isCorrect = option === currentQuestion.answer;
                          
                          return (
                            <button
                              key={idx}
                              disabled={isChecked}
                              onClick={() => setState(prev => ({
                                ...prev,
                                userAnswers: { ...prev.userAnswers, [currentQuestion.id]: option }
                              }))}
                              className={cn(
                                "w-full p-5 rounded-2xl border text-left transition-all flex items-center gap-4 group",
                                isSelected ? "border-yellow-500 bg-yellow-500/10" : "border-yellow-500/10 bg-slate-950/30 hover:border-yellow-500/30",
                                isChecked && isCorrect ? "border-green-500 bg-green-500/10" : "",
                                isChecked && isSelected && !isCorrect ? "border-red-500 bg-red-500/10" : ""
                              )}
                            >
                              <div className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black transition-colors",
                                isSelected ? "bg-yellow-500 text-slate-950" : "bg-slate-800 text-slate-400 group-hover:bg-slate-700",
                                isChecked && isCorrect ? "bg-green-500 text-white" : "",
                                isChecked && isSelected && !isCorrect ? "bg-red-500 text-white" : ""
                              )}>
                                {String.fromCharCode(65 + idx)}
                              </div>
                              <div className="flex-1">
                                <KaTeXRenderer content={option} />
                              </div>
                              {isChecked && isCorrect && <CheckCircle2 className="text-green-500" size={20} />}
                              {isChecked && isSelected && !isCorrect && <AlertCircle className="text-red-500" size={20} />}
                            </button>
                          );
                        })
                      ) : (
                        <div className="flex items-center gap-4">
                          <input
                            type="text"
                            disabled={state.checkedAnswers.has(currentQuestion.id)}
                            value={state.userAnswers[currentQuestion.id] || ''}
                            onChange={(e) => setState(prev => ({
                              ...prev,
                              userAnswers: { ...prev.userAnswers, [currentQuestion.id]: e.target.value }
                            }))}
                            placeholder="Enter numeric value..."
                            className="flex-1 bg-slate-950/50 border border-yellow-500/20 rounded-2xl p-5 text-2xl font-black text-yellow-500 focus:outline-none focus:border-yellow-500 transition-colors"
                          />
                          {currentQuestion.unit && (
                            <span className="text-2xl font-black text-slate-500">{currentQuestion.unit}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {state.checkedAnswers.has(currentQuestion.id) && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "mt-8 p-6 rounded-2xl border",
                          state.userAnswers[currentQuestion.id] === currentQuestion.answer 
                            ? "bg-green-500/5 border-green-500/20" 
                            : "bg-red-500/5 border-red-500/20"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-3">
                          {state.userAnswers[currentQuestion.id] === currentQuestion.answer ? (
                            <span className="text-green-500 font-black uppercase tracking-widest text-sm">Correct</span>
                          ) : (
                            <span className="text-red-500 font-black uppercase tracking-widest text-sm">Incorrect</span>
                          )}
                        </div>
                        <div className="text-slate-300 text-sm leading-relaxed">
                          <KaTeXRenderer content={currentQuestion.explanation} />
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Controls */}
                  <div className="flex justify-between items-center gap-4">
                    <button
                      onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                      disabled={currentQuestionIndex === 0}
                      className="px-6 py-4 rounded-2xl border border-yellow-500/20 text-yellow-500 font-bold hover:bg-yellow-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                      <ArrowLeft size={20} />
                      PREVIOUS
                    </button>

                    <div className="flex gap-4">
                      {!state.checkedAnswers.has(currentQuestion.id) && (
                        <button
                          onClick={() => setState(prev => ({ ...prev, checkedAnswers: new Set(prev.checkedAnswers).add(currentQuestion.id) }))}
                          disabled={!state.userAnswers[currentQuestion.id]}
                          className="px-8 py-4 rounded-2xl bg-slate-800 text-yellow-500 font-black hover:bg-slate-700 disabled:opacity-50 transition-all"
                        >
                          CHECK ANSWER
                        </button>
                      )}
                      
                      {currentQuestionIndex === state.questions.length - 1 ? (
                        <button
                          onClick={finishExam}
                          className="px-8 py-4 rounded-2xl bg-yellow-500 text-slate-950 font-black hover:bg-yellow-600 transition-all flex items-center gap-2"
                        >
                          FINISH EXAM
                          <CheckCircle2 size={20} />
                        </button>
                      ) : (
                        <button
                          onClick={() => setCurrentQuestionIndex(prev => Math.min(state.questions.length - 1, prev + 1))}
                          className="px-8 py-4 rounded-2xl bg-yellow-500 text-slate-950 font-black hover:bg-yellow-600 transition-all flex items-center gap-2"
                        >
                          NEXT
                          <ArrowRight size={20} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {state.phase === 'RESULTS' && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-4xl mx-auto"
              >
                <div className="glass-panel p-12 rounded-3xl text-center mb-8">
                  <Trophy className="text-yellow-500 mx-auto mb-6" size={64} />
                  <h2 className="text-4xl font-black mb-2 uppercase tracking-tight">Performance Analytics</h2>
                  <p className="text-slate-400 mb-12">Detailed breakdown of your simulation results.</p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <div className="bg-slate-950/50 p-6 rounded-3xl border border-yellow-500/10">
                      <div className="text-slate-500 text-xs uppercase font-bold mb-2">Final Score</div>
                      <div className="text-4xl font-black text-yellow-500">
                        {Object.entries(state.userAnswers).filter(([id, ans]) => ans === state.questions.find(q => q.id === id)?.answer).length} / {state.questions.length}
                      </div>
                    </div>
                    <div className="bg-slate-950/50 p-6 rounded-3xl border border-yellow-500/10">
                      <div className="text-slate-500 text-xs uppercase font-bold mb-2">Percentage</div>
                      <div className="text-4xl font-black text-yellow-500">
                        {Math.round((Object.entries(state.userAnswers).filter(([id, ans]) => ans === state.questions.find(q => q.id === id)?.answer).length / state.questions.length) * 100)}%
                      </div>
                    </div>
                    <div className="bg-slate-950/50 p-6 rounded-3xl border border-yellow-500/10">
                      <div className="text-slate-500 text-xs uppercase font-bold mb-2">Time Taken</div>
                      <div className="text-4xl font-black text-yellow-500">
                        {formatTime(state.duration * 60 - state.timeRemaining)}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={startExam}
                      className="flex-1 py-5 bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-black text-xl rounded-2xl transition-all"
                    >
                      RETAKE SAME EXAM
                    </button>
                    <button
                      onClick={resetExam}
                      className="flex-1 py-5 border border-yellow-500/20 text-yellow-500 font-black text-xl rounded-2xl hover:bg-yellow-500/10 transition-all"
                    >
                      START NEW EXAM
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-2xl font-black uppercase tracking-tight text-yellow-500/60 ml-4">Detailed Review</h3>
                  {state.questions.map((q, idx) => {
                    const userAns = state.userAnswers[q.id];
                    const isCorrect = userAns === q.answer;
                    return (
                      <div key={q.id} className={cn(
                        "glass-panel p-8 rounded-3xl border-l-8",
                        isCorrect ? "border-l-green-500" : "border-l-red-500"
                      )}>
                        <div className="flex justify-between items-start mb-6">
                          <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Question {idx + 1}</span>
                          {isCorrect ? (
                            <span className="text-green-500 font-black text-xs uppercase tracking-widest">Correct</span>
                          ) : (
                            <span className="text-red-500 font-black text-xs uppercase tracking-widest">Incorrect</span>
                          )}
                        </div>
                        <div className="text-lg font-medium mb-6">
                          <KaTeXRenderer content={q.question} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                          <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
                            <div className="text-xs font-bold text-slate-500 uppercase mb-1">Your Answer</div>
                            <div className={cn("font-bold", isCorrect ? "text-green-500" : "text-red-500")}>
                              {userAns ? <KaTeXRenderer content={userAns} /> : 'No Answer'}
                            </div>
                          </div>
                          <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
                            <div className="text-xs font-bold text-slate-500 uppercase mb-1">Correct Answer</div>
                            <div className="text-green-500 font-bold">
                              <KaTeXRenderer content={q.answer} />
                            </div>
                          </div>
                        </div>
                        <div className="bg-slate-950/30 p-6 rounded-2xl border border-yellow-500/5">
                          <div className="text-xs font-bold text-yellow-500/60 uppercase mb-2">Explanation</div>
                          <div className="text-slate-400 text-sm leading-relaxed">
                            <KaTeXRenderer content={q.explanation} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <Modal
          isOpen={isExitModalOpen}
          onClose={() => setIsExitModalOpen(false)}
          onConfirm={resetExam}
          title="Exit Simulation?"
          message="Are you sure you want to exit? Your current progress in this session will be lost."
        />

        <footer className="w-full max-w-6xl mt-12 py-8 border-t border-yellow-500/10 text-center">
          <p className="text-slate-600 text-xs font-bold uppercase tracking-[0.2em]">
            &copy; 2026 EMAGYNE SIMULATOR &bull; PROFESSIONAL ACADEMIC INTERFACE
          </p>
        </footer>
      </div>
    </ErrorBoundary>
  );
}
