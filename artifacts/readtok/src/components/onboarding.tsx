import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { BookOpen, Zap, Target } from "lucide-react";

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6 text-center" data-testid="onboarding">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-sm w-full space-y-8"
      >
        <div className="w-24 h-24 bg-primary/20 rounded-full mx-auto flex items-center justify-center mb-8 border-2 border-primary">
          <BookOpen className="w-12 h-12 text-primary" />
        </div>
        
        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Welcome to ReadTok</h1>
          <p className="text-muted-foreground text-lg">
            Master IELTS Reading by scrolling.
          </p>
        </div>

        <div className="space-y-6 text-left bg-card border border-border p-6 rounded-2xl">
          <div className="flex items-start gap-4">
            <div className="bg-primary/20 p-2 rounded-lg mt-1">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Swipe to read</h3>
              <p className="text-sm text-muted-foreground">Bite-sized passages formatted like a social feed.</p>
            </div>
          </div>
          
          <div className="flex items-start gap-4">
            <div className="bg-success/20 p-2 rounded-lg mt-1">
              <Target className="w-5 h-5 text-success" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Answer instantly</h3>
              <p className="text-sm text-muted-foreground">Get immediate feedback and explanations for every question.</p>
            </div>
          </div>
        </div>

        <Button 
          onClick={onComplete} 
          size="lg" 
          className="w-full h-14 text-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-transform"
          data-testid="btn-start-learning"
        >
          Start Scrolling
        </Button>
      </motion.div>
    </div>
  );
}
