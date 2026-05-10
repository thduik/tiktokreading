import { House } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export function AppPageHeader({
  title,
}: {
  title: string;
}) {
  return (
    <header className="mb-5 flex items-start gap-3">
      <Button
        asChild
        variant="outline"
        size="icon"
        className="mt-0.5 h-10 w-10 shrink-0 rounded-lg bg-card"
      >
        <Link href="/" aria-label="Go to feed">
          <House className="h-4 w-4" />
        </Link>
      </Button>
      <div className="min-w-0 pt-0.5">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
      </div>
    </header>
  );
}
