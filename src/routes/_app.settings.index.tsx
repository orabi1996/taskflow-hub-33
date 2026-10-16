import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/common/PageHeader";
import { StaggerGroup } from "@/motion";
import {
  Search,
  Settings as SettingsIcon,
  ArrowLeft,
  Lock,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  X,
  SlidersHorizontal,
} from "lucide-react";
import { SETTINGS_CATEGORIES, SettingCategory, SettingItem } from "@/lib/settings-config";

export const Route = createFileRoute("/_app/settings/")({
  component: SettingsIndex,
});

function SettingsIndex() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Filter categories and items based on search and roles
  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();

    return SETTINGS_CATEGORIES.map((cat) => {
      // Filter items within category
      const matchingItems = cat.items.filter((it) => {
        if (it.adminOnly && !isAdmin) return false;
        if (!q) return true;

        const matchTitle = it.label.toLowerCase().includes(q);
        const matchDesc = it.desc.toLowerCase().includes(q);
        const matchTags = it.tags.some((t) => t.toLowerCase().includes(q));

        return matchTitle || matchDesc || matchTags;
      });

      return {
        ...cat,
        items: matchingItems,
      };
    }).filter((cat) => {
      if (selectedCategory !== "all" && cat.id !== selectedCategory) return false;
      return cat.items.length > 0;
    });
  }, [search, selectedCategory, isAdmin]);

  const totalVisibleItems = useMemo(() => {
    return filteredCategories.reduce((acc, cat) => acc + cat.items.length, 0);
  }, [filteredCategories]);

  return (
    <div className="space-y-8 pb-12">
      {/* Executive Header */}
      <div className="relative rounded-2xl bg-gradient-to-l from-primary/10 via-background to-background border p-6 sm:p-8 overflow-hidden shadow-sm">
        <div className="relative z-10 space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold font-ui border border-primary/20">
            <Sparkles className="h-3.5 w-3.5" />
            <span>لوحة التحكم المؤسسية المتكاملة</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-foreground">
            مركز الإعدادات والتحكم الموحد
          </h1>

          <p className="text-sm text-muted-foreground font-ui leading-relaxed">
            إدارة شاملة لهوية المنشأة الرسمية، أنظمة الـ ERP والـ LMS، هيكل وصلاحيات فريق العمل،
            قنوات الأتمتة والـ Webhooks، ومعايير الأمان والامتثال المؤسسي في مكان واحد منظم.
          </p>

          {/* Quick Stats / Highlights Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs font-ui">
            <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm p-2.5 rounded-xl border">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <div>
                <span className="font-bold block text-foreground">المنشأة والأنظمة</span>
                <span className="text-[11px] text-muted-foreground">ERP & LMS نشطة</span>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm p-2.5 rounded-xl border">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
              <div>
                <span className="font-bold block text-foreground">الصلاحيات والأدوار</span>
                <span className="text-[11px] text-muted-foreground">مصفوفة RBAC آمنة</span>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm p-2.5 rounded-xl border">
              <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0" />
              <div>
                <span className="font-bold block text-foreground">محرك الأتمتة</span>
                <span className="text-[11px] text-muted-foreground">تنبيهات الـ SLA</span>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm p-2.5 rounded-xl border">
              <ShieldCheck className="h-4 w-4 text-purple-500 shrink-0" />
              <div>
                <span className="font-bold block text-foreground">الأمان والتدقيق</span>
                <span className="text-[11px] text-muted-foreground">سجلات Audit مشفرة</span>
              </div>
            </div>
          </div>
        </div>

        {/* Ambient watermark icon */}
        <SettingsIcon className="absolute -bottom-8 -left-8 h-64 w-64 text-primary/5 pointer-events-none rotate-12" />
      </div>

      {/* Search & Category Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث في كافة الإعدادات (مثال: بريد، صلاحيات، شعار، أتمتة، موظفين)..."
            className="pr-9 pl-8 text-xs font-ui bg-background"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Category Pills Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          <Button
            variant={selectedCategory === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory("all")}
            className="text-xs font-ui shrink-0 h-8"
          >
            الكل ({totalVisibleItems})
          </Button>

          {SETTINGS_CATEGORIES.map((cat) => {
            const isCatSelected = selectedCategory === cat.id;
            return (
              <Button
                key={cat.id}
                variant={isCatSelected ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat.id)}
                className="text-xs font-ui shrink-0 gap-1.5 h-8"
              >
                <cat.icon className="h-3.5 w-3.5" />
                <span>{cat.title}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Categories & Cards Section */}
      {filteredCategories.length === 0 ? (
        <Card className="p-12 text-center max-w-md mx-auto space-y-3">
          <SlidersHorizontal className="h-10 w-10 text-muted-foreground mx-auto" />
          <h3 className="font-bold text-foreground font-display">لم يتم العثور على نتائج</h3>
          <p className="text-xs text-muted-foreground font-ui">
            لا توجد إعدادات تطابق كلمة البحث "{search}". حاول استخدام كلمات بحث عامة.
          </p>
          <Button variant="outline" size="sm" onClick={() => { setSearch(""); setSelectedCategory("all"); }}>
            إعادة تعيين الفلاتر
          </Button>
        </Card>
      ) : (
        <div className="space-y-8">
          {filteredCategories.map((cat) => (
            <div key={cat.id} className="space-y-3">
              {/* Group Header */}
              <div className="flex items-center justify-between pb-2 border-b">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl bg-gradient-to-br ${cat.accentColor}`}>
                    <cat.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold font-display text-foreground flex items-center gap-2">
                      <span>{cat.title}</span>
                      <Badge variant="outline" className={`text-[10px] py-0 ${cat.badgeBg}`}>
                        {cat.items.length} خيارات
                      </Badge>
                    </h2>
                    <p className="text-xs text-muted-foreground font-ui">{cat.desc}</p>
                  </div>
                </div>
              </div>

              {/* Cards Grid */}
              <StaggerGroup className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cat.items.map((it) => (
                  <Link key={it.to} to={it.to} className="group block focus:outline-none">
                    <Card className="p-4 h-full border border-border/60 bg-card/60 backdrop-blur-sm transition-all duration-200 hover:shadow-md hover:border-primary/50 hover:bg-card flex flex-col justify-between">
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-200 shrink-0">
                            <it.icon className="h-4 w-4" />
                          </div>

                          <div className="flex items-center gap-1.5">
                            {it.badge && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-primary/30 text-primary">
                                {it.badge}
                              </Badge>
                            )}
                            <div className="h-6 w-6 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground group-hover:bg-primary/15 group-hover:text-primary transition-colors">
                              <ArrowLeft className="h-3 w-3" />
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="font-semibold text-sm font-display text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                            {it.label}
                          </h3>
                          <p className="text-xs text-muted-foreground font-ui line-clamp-2 mt-1 leading-relaxed">
                            {it.desc}
                          </p>
                        </div>
                      </div>

                      {/* Tags Footer */}
                      <div className="pt-3 mt-3 border-t border-border/40 flex flex-wrap gap-1">
                        {it.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground font-ui"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </Card>
                  </Link>
                ))}
              </StaggerGroup>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
