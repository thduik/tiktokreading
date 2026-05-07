import { Link, useLocation } from "wouter";
import { BookOpen, Bookmark, Search, User } from "lucide-react";

export default function BottomNav() {
  const [location] = useLocation();
  const isFeedRoute = location === "/" || location.startsWith("/passages/");

  const navItems = [
    { href: "/", icon: BookOpen, label: "Feed" },
    { href: "/list", icon: Search, label: "List" },
    { href: "/saved", icon: Bookmark, label: "Saved" },
    { href: "/profile", icon: User, label: "Profile" }
  ];

  return (
    <nav 
      className={`fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around h-[60px] pb-safe px-1.5
        bg-black border-t border-white/10 text-white/70`}
      data-testid="bottom-nav"
    >
      {navItems.map((item) => {
        const isActive =
          item.href === "/" ? isFeedRoute : location === item.href;
        const Icon = item.icon;
        
        return (
          <Link 
            key={item.href} 
            href={item.href}
            className={`flex flex-col items-center justify-center w-full h-full space-y-0.5 transition-colors active:scale-95
              ${isActive ? "text-primary" : "hover:text-white"}`}
            data-testid={`nav-link-${item.label.toLowerCase()}`}
          >
            <div className={`p-1 rounded-full transition-all ${isActive ? "bg-primary/10" : ""}`}>
              <Icon 
                className={`w-5 h-5 transition-all ${isActive ? "scale-105" : "scale-100"}`} 
                strokeWidth={isActive ? 2.5 : 2} 
              />
            </div>
            <span className={`text-[9px] font-medium ${isActive ? "opacity-100" : "opacity-70"}`}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
