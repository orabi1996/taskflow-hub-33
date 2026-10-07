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
      { title: "CRM-X | People · Pipelines · Possibilities" },
      { name: "description", content: "CRM-X — المنظومة المتكاملة لإدارة علاقات العملاء والعمليات وفرق العمل" },
      { name: "author", content: "CRM-X" },
      { property: "og:title", content: "CRM-X | People · Pipelines · Possibilities" },
      { property: "og:description", content: "CRM-X — المنظومة المتكاملة لإدارة علاقات العملاء والعمليات وفرق العمل" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "CRM-X | People · Pipelines · Possibilities" },
      { name: "twitter:description", content: "CRM-X — المنظومة المتكاملة لإدارة علاقات العملاء والعمليات وفرق العمل" },
      { name: "theme-color", content: "#0d9488" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "CRM-X" },
      { name: "application-name", content: "CRM-X Enterprise" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg?v=crmx-2" },
      { rel: "alternate icon", type: "image/png", href: "/favicon.png?v=crmx-2" },
      { rel: "apple-touch-icon", href: "/favicon.png?v=crmx-2" },
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
      {
        children: `(function(){if(typeof window!=='undefined'&&'serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}})();`,
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
import { InstallAppPrompt } from "@/components/pwa/InstallAppPrompt";

if (typeof window !== "undefined") {
  installServerFnAuth();
}

function RootComponent() {
  return (
    <PreferencesProvider>
      <AuthProvider>
        <Outlet />
        <InstallAppPrompt />
        <Toaster richColors position="top-center" />
      </AuthProvider>
    </PreferencesProvider>
  );
}
