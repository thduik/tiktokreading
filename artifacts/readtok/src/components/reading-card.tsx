import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { ReadingCard } from "@/lib/data";
import { Heart, Volume2, SquareTerminal, CheckCircle2, XCircle } from "lucide-react";
import { useAppState } from "@/hooks/use-app-state";
import { motion, AnimatePresence } from "framer-motion";

interface ReadingCardProps {
  card: ReadingCard;
  isActive: boolean;
}

function normalizeAnswer(answer: string) {
  return answer.trim().replace(/\s+/g, " ").toLowerCase();
}

function isAnswerCorrect(
  answer: string | undefined,
  correctAnswer: string,
  acceptedAnswers: string[] = [],
) {
  if (!answer) return false;
  return [correctAnswer, ...acceptedAnswers].some(
    (acceptedAnswer) => normalizeAnswer(answer) === normalizeAnswer(acceptedAnswer),
  );
}

export default function ReadingCardComponent({ card, isActive }: ReadingCardProps) {
  const { savedCardIds, toggleSaveCard, updateStats } = useAppState();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [inputAnswers, setInputAnswers] = useState<Record<string, string>>({});
  const [scoreCalculated, setScoreCalculated] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  
  const isSaved = savedCardIds.includes(card.id);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const confettiTimeoutRef = useRef<number | null>(null);

  const renderPassageWithEvidence = () => {
    const activeEvidence = card.questions
      .filter((question) => answers[question.id])
      .flatMap((question) =>
        question.evidence.map((text) => ({
          text,
          isCorrect: isAnswerCorrect(
            answers[question.id],
            question.correctAnswer,
            question.acceptedAnswers,
          ),
          questionId: question.id,
        })),
      );

    if (activeEvidence.length === 0) {
      return card.passage;
    }

    const matches = activeEvidence
      .map((evidence) => ({
        ...evidence,
        start: card.passage.indexOf(evidence.text),
      }))
      .filter((match) => match.start >= 0)
      .map((match) => ({
        ...match,
        end: match.start + match.text.length,
      }))
      .sort((a, b) => a.start - b.start);

    if (matches.length === 0) {
      return card.passage;
    }

    const nodes: ReactNode[] = [];
    let cursor = 0;

    matches.forEach((match, index) => {
      if (match.start < cursor) return;
      if (match.start > cursor) {
        nodes.push(card.passage.slice(cursor, match.start));
      }
      nodes.push(
        <mark
          key={`${match.questionId}-${index}`}
          className={`rounded-md px-1 py-0.5 text-white transition-colors ${
            match.isCorrect
              ? "bg-emerald-500/35 ring-1 ring-emerald-300/40"
              : "bg-red-500/35 ring-1 ring-red-300/40"
          }`}
          data-testid={`highlight-evidence-${match.questionId}`}
        >
          {match.text}
        </mark>,
      );
      cursor = match.end;
    });

    if (cursor < card.passage.length) {
      nodes.push(card.passage.slice(cursor));
    }

    return nodes;
  };

  // Auto-progress bar while viewing card
  useEffect(() => {
    if (!isActive) {
      setProgress(0);
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      }
      return;
    }

    setProgress(0);
    
    const duration = 30000; // 30 seconds to fill
    const interval = 100;
    const step = (100 / duration) * interval;
    
    const timer = setInterval(() => {
      setProgress(p => Math.min(p + step, 100));
    }, interval);
    
    return () => clearInterval(timer);
  }, [card.id, isActive, isSpeaking]);

  useEffect(() => {
    return () => {
      if (confettiTimeoutRef.current !== null) {
        window.clearTimeout(confettiTimeoutRef.current);
      }

      if (synthRef.current) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleSpeech = useCallback(() => {
    if (!("speechSynthesis" in window)) {
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      window.speechSynthesis.cancel(); // clear queue
      const utterance = new SpeechSynthesisUtterance(card.passage);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      synthRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  }, [card.passage, isSpeaking]);

  const handleAnswer = (questionId: string, answer: string) => {
    if (answers[questionId]) return; // already answered
    
    const newAnswers = { ...answers, [questionId]: answer };
    setAnswers(newAnswers);
    
    if (Object.keys(newAnswers).length === card.questions.length) {
      let correct = 0;
      card.questions.forEach(q => {
        if (isAnswerCorrect(newAnswers[q.id], q.correctAnswer, q.acceptedAnswers)) correct++;
      });
      
      setScoreCalculated(true);
      updateStats(correct, card.questions.length);
      
      if (correct === card.questions.length) {
        setShowConfetti(true);
        if (confettiTimeoutRef.current !== null) {
          window.clearTimeout(confettiTimeoutRef.current);
        }
        confettiTimeoutRef.current = window.setTimeout(() => {
          setShowConfetti(false);
          confettiTimeoutRef.current = null;
        }, 3000);
      }
    }
  };

  const handleSentenceSubmit = (questionId: string) => {
    const answer = inputAnswers[questionId]?.trim();
    if (!answer) return;
    handleAnswer(questionId, answer);
  };

  const correctAnswersCount = card.questions.reduce((acc, q) => {
    return acc + (isAnswerCorrect(answers[q.id], q.correctAnswer, q.acceptedAnswers) ? 1 : 0);
  }, 0);

  return (
    <div className="relative h-[100dvh] w-full flex flex-col bg-black text-white" data-testid={`reading-card-${card.id}`}>
      {/* Top Progress Bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 z-50">
        <motion.div 
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.1 }}
        />
      </div>

      {/* Confetti Overlay */}
      <AnimatePresence>
        {showConfetti && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center overflow-hidden"
          >
            {/* Simple CSS confetti simulation via Framer Motion for no external dep */}
            {Array.from({ length: 30 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ 
                  x: 0, 
                  y: "50vh",
                  scale: 0,
                  opacity: 1
                }}
                animate={{ 
                  x: (Math.random() - 0.5) * window.innerWidth,
                  y: "-20vh",
                  scale: Math.random() * 1.5 + 0.5,
                  opacity: 0,
                  rotate: Math.random() * 360
                }}
                transition={{ 
                  duration: 2 + Math.random(), 
                  ease: "easeOut" 
                }}
                className={`absolute w-3 h-3 ${["bg-primary", "bg-white", "bg-accent", "bg-emerald-400"][i % 4]}`}
                style={{ borderRadius: i % 2 === 0 ? '50%' : '2px' }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOP SECTION: Passage */}
      <div className="flex-[0.55] relative overflow-y-auto px-5 pt-12 pb-6 flex flex-col justify-start mask-image-bottom">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary/80 bg-primary/10 px-2 py-1 rounded">
              IELTS Reading
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/60 border border-white/20 px-2 py-1 rounded">
              {card.difficulty}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/60 border border-white/20 px-2 py-1 rounded">
              Band {card.band}
            </span>
          </div>
          <button 
            onClick={toggleSpeech}
            className="p-2 rounded-full bg-white/10 text-white active:scale-90 transition-transform"
            data-testid={`btn-tts-${card.id}`}
          >
            {isSpeaking ? <SquareTerminal className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
        
        <h2 className="text-2xl font-bold mb-4 leading-tight shadow-sm">{card.title}</h2>
        
        <p className="text-base text-white/90 leading-[1.65] font-serif font-medium tracking-wide pb-4" data-testid={`passage-${card.id}`}>
          {renderPassageWithEvidence()}
        </p>
      </div>

      {/* BOTTOM SECTION: Questions */}
      <div className="flex-[0.45] bg-gradient-to-b from-black/0 via-black to-black border-t border-white/10 px-4 pt-4 pb-24 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">Questions</h3>
          {scoreCalculated && (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-sm font-bold bg-white/10 px-3 py-1 rounded-full flex items-center gap-2"
            >
              <span className={correctAnswersCount === card.questions.length ? "text-primary" : "text-white"}>
                {correctAnswersCount}/{card.questions.length} Correct
              </span>
            </motion.div>
          )}
        </div>

        <div className="space-y-6">
          {card.questions.map((q, i) => (
            <div key={q.id} className="space-y-3" data-testid={`question-${q.id}`}>
              <p className="text-sm font-medium text-white/90">
                <span className="text-primary/80 font-bold mr-2">Q{i+1}.</span>
                {q.text}
              </p>
              
              <div className="grid grid-cols-1 gap-2">
                {q.type === "sentence_completion" || q.type === "short_answer" ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        value={inputAnswers[q.id] ?? ""}
                        disabled={!!answers[q.id]}
                        onChange={(event) =>
                          setInputAnswers((prev) => ({
                            ...prev,
                            [q.id]: event.target.value,
                          }))
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            handleSentenceSubmit(q.id);
                          }
                        }}
                        placeholder="Type the missing words"
                        className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-primary"
                        data-testid={`input-answer-${q.id}`}
                      />
                      <button
                        disabled={!!answers[q.id] || !inputAnswers[q.id]?.trim()}
                        onClick={() => handleSentenceSubmit(q.id)}
                        className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
                        data-testid={`btn-submit-${q.id}`}
                      >
                        Check
                      </button>
                    </div>
                    {answers[q.id] && (
                      <div
                        className={`rounded-xl border px-3 py-2 text-sm ${
                          isAnswerCorrect(answers[q.id], q.correctAnswer, q.acceptedAnswers)
                            ? "border-success/50 bg-success/15 text-white"
                            : "border-destructive/50 bg-destructive/15 text-white"
                        }`}
                      >
                        <span className="font-semibold">
                          {isAnswerCorrect(answers[q.id], q.correctAnswer, q.acceptedAnswers)
                            ? "Correct:"
                            : "Correct answer:"}
                        </span>{" "}
                        {q.correctAnswer}
                      </div>
                    )}
                  </div>
                ) : q.options?.map((opt) => {
                  const isAnswered = !!answers[q.id];
                  const isSelected = answers[q.id] === opt;
                  const isCorrect = isAnswerCorrect(opt, q.correctAnswer, q.acceptedAnswers);
                  
                  let btnClass = "bg-white/10 text-white hover:bg-white/20 border-transparent";
                  if (isAnswered) {
                    if (isSelected && isCorrect) {
                      btnClass = "bg-success/20 border-success text-success-foreground";
                    } else if (isSelected && !isCorrect) {
                      btnClass = "bg-destructive/20 border-destructive text-destructive-foreground";
                    } else if (!isSelected && isCorrect) {
                      btnClass = "bg-success/10 border-success/50 text-white/80"; // reveal correct
                    } else {
                      btnClass = "bg-white/5 text-white/40 border-transparent"; // dimmed
                    }
                  }

                  return (
                    <button
                      key={opt}
                      disabled={isAnswered}
                      onClick={() => handleAnswer(q.id, opt)}
                      className={`text-left p-3 rounded-xl border transition-all text-sm flex items-center justify-between ${btnClass}`}
                      data-testid={`btn-opt-${q.id}-${opt.substring(0,2)}`}
                    >
                      <span className="flex-1">{opt}</span>
                      {isAnswered && isSelected && isCorrect && <CheckCircle2 className="w-4 h-4 text-success ml-2 flex-shrink-0" />}
                      {isAnswered && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-destructive ml-2 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <AnimatePresence>
                {answers[q.id] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="overflow-hidden"
                  >
                    <div className="text-xs bg-white/5 border border-white/10 p-3 rounded-lg mt-2 text-white/80 border-l-2 border-l-primary">
                      <span className="font-bold block mb-1">Correct answer:</span>
                      <span className="block mb-2 text-white">{q.correctAnswer}</span>
                      <span className="font-bold block mb-1">Explanation:</span>
                      <span>{q.explanation}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      {/* Floating Action Buttons on Right Side */}
      <div className="absolute right-4 bottom-16 flex flex-col gap-4 z-40">
        <button 
          onClick={() => toggleSaveCard(card.id)}
          className="flex flex-col items-center justify-center group"
          data-testid={`btn-save-${card.id}`}
        >
          <div className={`p-3 rounded-full bg-black/40 backdrop-blur-md border transition-all active:scale-90
            ${isSaved ? 'border-primary bg-primary/20' : 'border-white/20'}`}>
            <Heart 
              className={`w-6 h-6 transition-colors ${isSaved ? 'fill-primary text-primary' : 'text-white'}`} 
            />
          </div>
          <span className="text-[10px] font-medium mt-1 text-white shadow-black drop-shadow-md">
            {isSaved ? "Saved" : "Save"}
          </span>
        </button>

      </div>

    </div>
  );
}
