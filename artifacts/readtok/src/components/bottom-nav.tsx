import { Link, useLocation } from "wouter";
import { BookOpen, Bookmark, User } from "lucide-react";

export default function BottomNav() {
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: BookOpen, label: "Feed" },
    { href: "/saved", icon: Bookmark, label: "Saved" },
    { href: "/profile", icon: User, label: "Profile" }
  ];

  return (
    <nav 
      className={`fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around h-[72px] pb-safe px-2
        bg-black border-t border-white/10 text-white/70`}
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
              ${isActive ? "text-primary" : "hover:text-white"}`}
            data-testid={`nav-link-${item.label.toLowerCase()}`}
          >
            <div className={`p-1.5 rounded-full transition-all ${isActive ? "bg-primary/10" : ""}`}>
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
