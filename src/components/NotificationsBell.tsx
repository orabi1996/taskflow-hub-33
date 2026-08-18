import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications } from "@/hooks/use-notifications";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export function NotificationsBell() {
  const { items, unreadCount, markRead, markAllRead } = useNotifications();
  const top = items.slice(0, 6);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" title="التنبيهات">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -end-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="font-semibold text-sm">التنبيهات</span>
          {unreadCount > 0 && (
            <Button size="sm" variant="ghost" onClick={markAllRead} className="h-7 text-xs">
              تعليم كمقروءة
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {top.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">لا توجد تنبيهات</div>
          ) : (
            top.map((n) => (
              <button
                key={n.id}
                onClick={() => markRead(n.id)}
                className={`w-full text-start px-3 py-2.5 border-b hover:bg-accent/50 transition-colors ${
                  !n.is_read ? "bg-primary/5" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium line-clamp-1">{n.title}</span>
                  {!n.is_read && <Badge variant="secondary" className="text-[9px] h-4 px-1">جديد</Badge>}
                </div>
                {n.body && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.body}</p>}
                <div className="text-[10px] text-muted-foreground mt-1">
                  {format(new Date(n.created_at), "d MMM HH:mm", { locale: ar })}
                </div>
              </button>
            ))
          )}
        </div>
        <div className="border-t p-2">
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link to="/alerts">عرض كل التنبيهات</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
