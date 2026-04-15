import { Link, useLocation } from "wouter";
import { BookOpen, Bookmark, User } from "lucide-react";

export default function BottomNav() {
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: BookOpen, label: "Feed" },
    { href: "/saved", icon: Bookmark, label: "Saved" },
    { href: "/profile", icon: User, label: "Profile" }
  ];

  const isFeed = location === "/";

  return (
    <nav 
      className={`fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around h-[72px] pb-safe px-2
        ${isFeed 
          ? "bg-gradient-to-t from-black/90 to-transparent border-t-0 text-white/70" 
          : "bg-background/95 backdrop-blur-md border-t border-border text-muted-foreground"
        }`}
      data-testid="bottom-nav"
    >
      {navItems.map((item) => {
        const isActive = location === item.href;
        const Icon = item.icon;
        
        return (
          <Link 
            key={item.href} 
            href={item.href}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors active:scale-95
              ${isActive ? (isFeed ? "text-white" : "text-primary") : "hover:text-foreground"}`}
            data-testid={`nav-link-${item.label.toLowerCase()}`}
          >
            <div className={`p-1.5 rounded-full transition-all ${isActive && !isFeed ? "bg-primary/10" : ""}`}>
              <Icon 
                className={`w-6 h-6 transition-all ${isActive ? "scale-110" : "scale-100"}`} 
                strokeWidth={isActive ? 2.5 : 2} 
              />
            </div>
            <span className={`text-[10px] font-medium ${isActive ? "opacity-100" : "opacity-70"}`}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
