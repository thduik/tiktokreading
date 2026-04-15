import { useRef, useState } from "react";
import { getRandomReadingCards } from "@/lib/data";
import ReadingCardComponent from "@/components/reading-card";

const INITIAL_FEED_SIZE = 8;
const APPEND_FEED_SIZE = 5;

export default function Home() {
  const [cards, setCards] = useState(() => getRandomReadingCards(INITIAL_FEED_SIZE));
  const containerRef = useRef<HTMLDivElement>(null);
  const lastAppendTimeRef = useRef(0);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isNearBottom = target.scrollHeight - target.scrollTop <= target.clientHeight * 1.75;

    if (!isNearBottom) {
      return;
    }

    const now = Date.now();
    if (now - lastAppendTimeRef.current < 600) {
      return;
    }

    lastAppendTimeRef.current = now;
    setCards((prev) => [...prev, ...getRandomReadingCards(APPEND_FEED_SIZE)]);
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
