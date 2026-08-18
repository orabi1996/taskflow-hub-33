import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, MessageSquare, Flag, UserPlus, History, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getProjectActivity } from "@/lib/projects-extended.functions";

interface Event {
  id: string;
  kind: string;
  at: string;
  actor_id: string | null;
  title: string;
  detail: string;
  actor: { full_name: string } | null;
}

const ICONS: Record<string, any> = {
  comment: MessageSquare,
  milestone: Flag,
  milestone_change: Flag,
  member: UserPlus,
  history: History,
};

const PAGE_SIZE = 30;

export function ProjectActivityFeed({ projectId }: { projectId: string }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const mergeUnique = (existing: Event[], incoming: Event[]) => {
    const seen = new Set(existing.map((e) => e.id));
    const merged = [...existing];
    for (const e of incoming) if (!seen.has(e.id)) merged.push(e);
    merged.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return merged;
  };

  const loadFirst = async () => {
    setLoading(true);
    try {
      const r = await getProjectActivity({ data: { projectId, limit: PAGE_SIZE } });
      const list = r.events as Event[];
      list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      setEvents(list);
      setHasMore(r.hasMore);
      setNextBefore(r.nextBefore);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!hasMore || !nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await getProjectActivity({ data: { projectId, limit: PAGE_SIZE, before: nextBefore } });
      setEvents((prev) => mergeUnique(prev, r.events as Event[]));
      setHasMore(r.hasMore);
      setNextBefore(r.nextBefore);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoadingMore(false);
    }
  };

  // refresh first page (preserves loaded older pages by merging)
  const refreshLatest = async () => {
    try {
      const r = await getProjectActivity({ data: { projectId, limit: PAGE_SIZE } });
      setEvents((prev) => mergeUnique(r.events as Event[], prev));
    } catch {
      /* silent */
    }
  };

  const scheduleRefresh = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(refreshLatest, 700);
  };

  useEffect(() => {
    loadFirst();
  }, [projectId]);

  useEffect(() => {
    const ch = supabase
      .channel(`project_activity_${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_comments", filter: `project_id=eq.${projectId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_milestones", filter: `project_id=eq.${projectId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_milestone_history", filter: `project_id=eq.${projectId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_members", filter: `project_id=eq.${projectId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_history", filter: `project_id=eq.${projectId}` }, scheduleRefresh)
      .subscribe();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(ch);
    };
  }, [projectId]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const el = sentinelRef.current;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, nextBefore, loadingMore]);

  if (loading) return <div className="text-center text-muted-foreground py-8">جارٍ التحميل...</div>;
  if (events.length === 0)
    return (
      <Card className="p-8 text-center">
        <Activity className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-muted-foreground text-sm">لا يوجد نشاط بعد</p>
      </Card>
    );

  return (
    <div className="space-y-2">
      <h3 className="font-semibold mb-3">سجل النشاط</h3>
      {events.map((ev) => {
        const Icon = ICONS[ev.kind] || Activity;
        return (
          <Card key={ev.id} className="p-3 flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[10px]">
                      {(ev.actor?.full_name || "؟").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{ev.actor?.full_name || "النظام"}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {ev.kind}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(ev.at).toLocaleString("ar")}</span>
              </div>
              <div className="text-sm mt-1">{ev.title}</div>
              {ev.detail && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ev.detail}</div>}
            </div>
          </Card>
        );
      })}
      {hasMore && (
        <div ref={sentinelRef} className="py-4 text-center">
          {loadingMore ? (
            <Loader2 className="h-4 w-4 animate-spin inline" />
          ) : (
            <Button variant="ghost" size="sm" onClick={loadMore}>
              تحميل المزيد
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
