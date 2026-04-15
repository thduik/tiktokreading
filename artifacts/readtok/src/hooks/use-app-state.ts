import { useState, useEffect, useCallback } from "react";
import { readingCards } from "../lib/data";

export interface UserStats {
  totalPracticed: number;
  accuracy: number;
  streak: number;
  lastPracticed: string | null;
  correctAnswersTotal: number;
  totalQuestionsAnswered: number;
}

const defaultStats: UserStats = {
  totalPracticed: 0,
  accuracy: 0,
  streak: 0,
  lastPracticed: null,
  correctAnswersTotal: 0,
  totalQuestionsAnswered: 0,
};

export function useAppState() {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(true);
  const [savedCardIds, setSavedCardIds] = useState<string[]>([]);
  const [stats, setStats] = useState<UserStats>(defaultStats);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const storedOnboarding = localStorage.getItem("readtok_onboarding");
      const storedSaved = localStorage.getItem("readtok_saved");
      const storedStats = localStorage.getItem("readtok_stats");

      if (storedOnboarding === null) {
        setHasCompletedOnboarding(false);
      }
      
      if (storedSaved) {
        setSavedCardIds(JSON.parse(storedSaved));
      }

      if (storedStats) {
        const parsedStats = JSON.parse(storedStats);
        // update streak logic
        const today = new Date().toDateString();
        if (parsedStats.lastPracticed !== today) {
          const lastDate = new Date(parsedStats.lastPracticed || 0);
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          
          if (lastDate.toDateString() === yesterday.toDateString()) {
             // Streak continues, do not increment until they practice today
          } else if (parsedStats.lastPracticed) {
             // Break streak
             parsedStats.streak = 0;
          }
        }
        setStats(parsedStats);
      }
    } catch (e) {
      console.error("Failed to load state", e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const completeOnboarding = useCallback(() => {
    localStorage.setItem("readtok_onboarding", "true");
    setHasCompletedOnboarding(true);
  }, []);

  const toggleSaveCard = useCallback((cardId: string) => {
    setSavedCardIds(prev => {
      const newSaved = prev.includes(cardId) 
        ? prev.filter(id => id !== cardId)
        : [...prev, cardId];
      localStorage.setItem("readtok_saved", JSON.stringify(newSaved));
      return newSaved;
    });
  }, []);

  const updateStats = useCallback((correctAnswers: number, totalQuestions: number) => {
    setStats(prev => {
      const today = new Date().toDateString();
      let newStreak = prev.streak;
      
      if (prev.lastPracticed !== today) {
        const lastDate = new Date(prev.lastPracticed || 0);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (lastDate.toDateString() === yesterday.toDateString() || !prev.lastPracticed) {
           newStreak += 1;
        } else {
           newStreak = 1;
        }
      }

      const correctAnswersTotal = prev.correctAnswersTotal + correctAnswers;
      const totalQuestionsAnswered = prev.totalQuestionsAnswered + totalQuestions;
      const accuracy = totalQuestionsAnswered > 0 
        ? Math.round((correctAnswersTotal / totalQuestionsAnswered) * 100) 
        : 0;

      const newStats = {
        totalPracticed: prev.totalPracticed + 1,
        accuracy,
        streak: newStreak,
        lastPracticed: today,
        correctAnswersTotal,
        totalQuestionsAnswered
      };
      
      localStorage.setItem("readtok_stats", JSON.stringify(newStats));
      return newStats;
    });
  }, []);

  return {
    isLoaded,
    hasCompletedOnboarding,
    completeOnboarding,
    savedCardIds,
    toggleSaveCard,
    stats,
    updateStats,
    savedCards: readingCards.filter(c => savedCardIds.includes(c.id))
  };
}
