import { useAppState } from "@/hooks/use-app-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookmarkX, Play, SquareTerminal } from "lucide-react";
import { useState, useCallback } from "react";

export default function Saved() {
  const { savedCards, toggleSaveCard } = useAppState();
  const [playingId, setPlayingId] = useState<string | null>(null);

  const toggleSpeech = useCallback((id: string, text: string) => {
    if (playingId === id) {
      window.speechSynthesis.cancel();
      setPlayingId(null);
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => setPlayingId(null);
      window.speechSynthesis.speak(utterance);
      setPlayingId(id);
    }
  }, [playingId]);

  return (
    <div className="h-full w-full overflow-y-auto p-4 space-y-4 pt-10" data-testid="page-saved">
      <h1 className="text-2xl font-bold mb-6 text-foreground tracking-tight" data-testid="text-saved-title">Saved Passages</h1>
      
      {savedCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground text-center" data-testid="empty-saved">
          <BookmarkX className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">No saved passages yet</p>
          <p className="text-sm">Tap the heart icon on any card to save it here for later review.</p>
        </div>
      ) : (
        <div className="space-y-4 pb-20">
          {savedCards.map(card => (
            <Card key={card.id} className="border-border bg-card overflow-hidden" data-testid={`card-saved-${card.id}`}>
              <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-start justify-between space-y-0">
                <div>
                  <Badge variant="outline" className="mb-2 bg-secondary text-secondary-foreground border-transparent">
                    {card.difficulty}
                  </Badge>
                  <CardTitle className="text-lg leading-tight">{card.title}</CardTitle>
                </div>
                <button 
                  onClick={() => toggleSaveCard(card.id)}
                  className="text-destructive p-2 rounded-full bg-secondary/50 active:scale-95 transition-transform"
                  data-testid={`button-unsave-${card.id}`}
                >
                  <BookmarkX className="w-5 h-5" />
                </button>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="relative">
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                    {card.passage}
                  </p>
                  <button 
                    onClick={() => toggleSpeech(card.id, card.passage)}
                    className="absolute bottom-0 right-0 bg-card/90 backdrop-blur-sm p-1 rounded-md text-primary flex items-center gap-1 text-xs font-semibold"
                    data-testid={`button-tts-${card.id}`}
                  >
                    {playingId === card.id ? <SquareTerminal className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    {playingId === card.id ? "Stop" : "Listen"}
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
