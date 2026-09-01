import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "نظام إدارة المهام | CRM" },
      { name: "description", content: "نظام متكامل لإدارة المهام اليومية والمشاريع للموظفين والمديرين" },
      { name: "author", content: "CRM" },
      { property: "og:title", content: "نظام إدارة المهام | CRM" },
      { property: "og:description", content: "نظام متكامل لإدارة المهام اليومية والمشاريع للموظفين والمديرين" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "نظام إدارة المهام | CRM" },
      { name: "twitter:description", content: "نظام متكامل لإدارة المهام اليومية والمشاريع للموظفين والمديرين" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/0404b579-4250-4149-9e10-7e09f8569809/id-preview-3a700f42--c1e1209f-c9fc-4783-a823-5d67443a711d.lovable.app-1777641246669.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/0404b579-4250-4149-9e10-7e09f8569809/id-preview-3a700f42--c1e1209f-c9fc-4783-a823-5d67443a711d.lovable.app-1777641246669.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "preload",
        as: "style",
        href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap",
      },
    ],
    scripts: [
      {
        children: `(function(){try{var p=JSON.parse(localStorage.getItem('ui-prefs-v1')||'{}');var t=['aurora','mint','slate'].includes(p.theme)?p.theme:'aurora';var a=p.animations===false?'off':'on';document.documentElement.setAttribute('data-theme',t);document.documentElement.setAttribute('data-anim',a);var c=navigator.connection;var low=c&&(c.saveData||['slow-2g','2g','3g'].includes(c.effectiveType));document.documentElement.setAttribute('data-perf',low?'low':'auto');}catch(e){}})();`,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" data-theme="aurora" data-anim="on" data-perf="auto" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";
import { installServerFnAuth } from "@/lib/server-fn-auth";
import { PreferencesProvider } from "@/lib/preferences";

if (typeof window !== "undefined") {
  installServerFnAuth();
}

function RootComponent() {
  return (
    <PreferencesProvider>
      <AuthProvider>
        <Outlet />
        <Toaster richColors position="top-center" />
      </AuthProvider>
    </PreferencesProvider>
  );
}
