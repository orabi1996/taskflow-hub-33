import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Sparkles, Send, ListChecks, Sun, Mail, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Msg { role: "user" | "assistant"; content: string }

export function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (mode: string, prompt: string) => {
    if (!prompt.trim() && mode === "chat") return;
    setLoading(true);
    if (prompt) setMessages((m) => [...m, { role: "user", content: prompt }]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("سجّل الدخول أولاً"); return; }
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ mode, prompt }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "فشل");
      setMessages((m) => [...m, { role: "assistant", content: json.reply || "(لا توجد إجابة)" }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "خطأ";
      toast.error(msg);
      setMessages((m) => [...m, { role: "assistant", content: `❌ ${msg}` }]);
    } finally {
      setLoading(false);
      setInput("");
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" title="المساعد الذكي" className="relative">
          <Sparkles className="h-5 w-5 text-primary" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-5 py-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> المساعد الذكي
          </SheetTitle>
        </SheetHeader>

        <div className="px-4 py-3 border-b flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={loading} onClick={() => send("summarize_day", "ملخص اليوم")} className="gap-1.5 text-xs">
            <Sun className="h-3.5 w-3.5" /> ملخص اليوم
          </Button>
          <Button size="sm" variant="outline" disabled={loading} onClick={() => send("suggest_priority", "ترتيب الأولويات")} className="gap-1.5 text-xs">
            <ListChecks className="h-3.5 w-3.5" /> أولويات
          </Button>
          <Button size="sm" variant="outline" disabled={loading} onClick={() => send("draft_email", "اكتب إيميل تذكير لعميل بانتهاء عقده قريباً")} className="gap-1.5 text-xs">
            <Mail className="h-3.5 w-3.5" /> صياغة إيميل
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <Card className="p-4 text-sm text-muted-foreground">
              مرحباً! اسألني عن مهامك، أو استخدم الأزرار أعلاه لملخص يومي، أو ترتيب الأولويات، أو صياغة إيميل.
            </Card>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
              <Card className={`p-3 text-sm max-w-[85%] whitespace-pre-wrap ${m.role === "user" ? "bg-primary/10" : "bg-card"}`}>
                {m.content}
              </Card>
            </div>
          ))}
          {loading && (
            <div className="flex justify-end">
              <Card className="p-3 text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> جارٍ التفكير...</Card>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t p-3 flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send("chat", input); } }}
            placeholder="اسأل المساعد..."
            rows={2}
            className="resize-none"
          />
          <Button onClick={() => send("chat", input)} disabled={loading || !input.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
