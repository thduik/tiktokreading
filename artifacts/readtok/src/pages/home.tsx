import { useState, useEffect, useRef, useMemo } from "react";
import { readingCards } from "@/lib/data";
import ReadingCardComponent from "@/components/reading-card";
import { useAppState } from "@/hooks/use-app-state";

function shuffleArray<T>(array: T[]): T[] {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

export default function Home() {
  const [cards, setCards] = useState(() => shuffleArray(readingCards));
  const containerRef = useRef<HTMLDivElement>(null);
  
  // For infinite scroll, if we reach the end we just append more shuffled cards
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight * 1.5) {
      setCards(prev => [...prev, ...shuffleArray(readingCards)]);
    }
  };

  return (
    <div 
      className="snap-container bg-black w-full"
      ref={containerRef}
      onScroll={handleScroll}
      data-testid="feed-container"
    >
      {cards.map((card, index) => (
        <div key={`${card.id}-${index}`} className="snap-section">
          <ReadingCardComponent card={card} isActive={true} />
        </div>
      ))}
    </div>
  );
}
