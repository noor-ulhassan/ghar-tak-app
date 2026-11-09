import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, useClerk, useSession } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { DataProvider } from "@/context/DataContext";
import { CartProvider } from "@/context/CartContext";
import CartDrawer from "@/components/shared/CartDrawer";
import { Toaster } from "@/components/ui/toaster";
import AppLayout from "@/components/layout/AppLayout";

// Import all pages
import HomePage from "@/pages/home";
import ServicesPage from "@/pages/services";
import ServiceCategoryPage from "@/pages/services/[category]";
import ServiceProviderDetailPage from "@/pages/services/[id]";
import StoresPage from "@/pages/stores";
import StoreDetailPage from "@/pages/stores/[id]";
import SearchPage from "@/pages/search";
import CheckoutPage from "@/pages/checkout";
import OrderTrackingPage from "@/pages/orders/[id]";
import FavoritesPage from "@/pages/favorites";
import ProfilePage from "@/pages/profile";
import MessagesPage from "@/pages/messages";
import DashboardPage from "@/pages/dashboard";
import AboutPage from "@/pages/about";
import ContactPage from "@/pages/contact";
import SupportPage from "@/pages/support";
import BecomeProviderPage from "@/pages/become-provider";
import ImageAnalyzerPage from "@/pages/image-analyzer";
import QrScannerPage from "@/pages/qr-scanner";
import PricingPage from "@/pages/pricing";
import NotFound from "@/pages/not-found";

// REQUIRED — copy verbatim
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');
}

// A 4xx answer (not found, not allowed) won't change on a retry, so show it straight away
// instead of retrying three times. Network and server errors keep the usual retries.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = (error as { status?: number } | null)?.status;
        if (typeof status === 'number' && status >= 400 && status < 500) return false;
        return failureCount < 3;
      },
    },
  },
});

// Branded Clerk appearance matching the app's purple/green palette
const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: "top" as const,
    socialButtonsVariant: "blockButton" as const,
  },
  variables: {
    colorPrimary: "#7C3AED",
    colorForeground: "#111827",
    colorMutedForeground: "#6B7280",
    colorDanger: "#EF4444",
    colorBackground: "#FFFFFF",
    colorInput: "#F9FAFB",
    colorInputForeground: "#111827",
    colorNeutral: "#E5E7EB",
    fontFamily: "system-ui, -apple-system, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white dark:bg-gray-900 rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-800",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-gray-900 dark:text-white font-bold text-2xl",
    headerSubtitle: "text-gray-500 dark:text-gray-400 text-sm",
    socialButtonsBlockButtonText: "text-gray-700 dark:text-gray-300 font-medium",
    formFieldLabel: "text-gray-700 dark:text-gray-300 text-sm font-medium",
    footerActionLink: "text-purple-600 hover:text-purple-700 font-medium",
    footerActionText: "text-gray-500 dark:text-gray-400",
    dividerText: "text-gray-400 dark:text-gray-500 text-xs uppercase",
    identityPreviewEditButton: "text-purple-600",
    formFieldSuccessText: "text-green-600",
    alertText: "text-red-600 dark:text-red-400",
    logoBox: "flex justify-center mb-2",
    logoImage: "h-10 w-auto",
    socialButtonsBlockButton: "border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors",
    formButtonPrimary: "bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-colors",
    formFieldInput: "border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent",
    footerAction: "border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50",
    dividerLine: "bg-gray-200 dark:bg-gray-700",
    alert: "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg",
    otpCodeFieldInput: "border-gray-200 dark:border-gray-700",
    formFieldRow: "",
    main: "",
  },
};

// Signing in or up brings the customer back to the page they were on, not Home.
const RETURN_PATH_KEY = 'ghar_tak_return_path';

function ReturnPathRecorder() {
  const [location] = useLocation();
  useEffect(() => {
    if (location.startsWith('/sign-in') || location.startsWith('/sign-up')) return;
    try {
      sessionStorage.setItem(RETURN_PATH_KEY, location + window.location.search);
    } catch { /* storage unavailable: fall back to Home */ }
  }, [location]);
  return null;
}

function returnUrl(): string {
  let path = '/';
  try {
    path = sessionStorage.getItem(RETURN_PATH_KEY) || '/';
  } catch { /* use Home */ }
  return `${basePath}${path}`;
}

function SignInPageComponent() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-purple-50 via-white to-green-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 px-4 py-12">
      <div className="w-full max-w-[440px]">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-purple-700 dark:text-purple-400 mb-1">Ghar Tak</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Your neighborhood marketplace</p>
        </div>
        <SignIn
          routing="path"
          path={`${basePath}/sign-in`}
          signUpUrl={`${basePath}/sign-up`}
          fallbackRedirectUrl={returnUrl()}
          signUpFallbackRedirectUrl={returnUrl()}
        />
      </div>
    </div>
  );
}

function SignUpPageComponent() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-purple-50 via-white to-green-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 px-4 py-12">
      <div className="w-full max-w-[440px]">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-purple-700 dark:text-purple-400 mb-1">Join Ghar Tak</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Discover your neighborhood</p>
        </div>
        <SignUp
          routing="path"
          path={`${basePath}/sign-up`}
          signInUrl={`${basePath}/sign-in`}
          fallbackRedirectUrl={returnUrl()}
          signInFallbackRedirectUrl={returnUrl()}
        />
      </div>
    </div>
  );
}

function ClerkQueryCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    return addListener(({ user }) => {
      const id = user?.id ?? null;
      if (prevId.current !== undefined && prevId.current !== id) qc.clear();
      prevId.current = id;
    });
  }, [addListener, qc]);
  return null;
}

/**
 * Wires Clerk's short-lived session JWT into the shared API client so that
 * every `customFetch` request carries an `Authorization: Bearer <token>` header.
 * Clerk's newer SDK stores the JWT in memory (not a cookie), so the backend
 * `clerkMiddleware` needs it explicitly on each request.
 */
function ApiClientAuthSync() {
  const { session } = useSession();
  useEffect(() => {
    if (session) {
      setAuthTokenGetter(() => session.getToken());
    } else {
      setAuthTokenGetter(null);
    }
  }, [session]);
  return null;
}

const AUTH_PAGES = ["/sign-in", "/sign-up"];

function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const isAuthPage = AUTH_PAGES.some(p => location.startsWith(p));
  if (isAuthPage) return <>{children}</>;
  return <AppLayout>{children}</AppLayout>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/sign-in/*?" component={SignInPageComponent} />
      <Route path="/sign-up/*?" component={SignUpPageComponent} />
      {/* Legacy redirect */}
      <Route path="/signin">{() => <Redirect to="/sign-in" />}</Route>
      <Route path="/signup">{() => <Redirect to="/sign-up" />}</Route>
      <Route path="/services" component={ServicesPage} />
      <Route path="/services/:category/:id" component={ServiceProviderDetailPage} />
      <Route path="/services/:category" component={ServiceCategoryPage} />
      <Route path="/stores" component={StoresPage} />
      <Route path="/stores/:id" component={StoreDetailPage} />
      <Route path="/search" component={SearchPage} />
      <Route path="/checkout" component={CheckoutPage} />
      <Route path="/orders/:id" component={OrderTrackingPage} />
      <Route path="/favorites" component={FavoritesPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/messages" component={MessagesPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/about" component={AboutPage} />
      <Route path="/contact" component={ContactPage} />
      <Route path="/support" component={SupportPage} />
      <Route path="/become-provider" component={BecomeProviderPage} />
      <Route path="/image-analyzer" component={ImageAnalyzerPage} />
      <Route path="/qr-scanner" component={QrScannerPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: "Welcome back", subtitle: "Sign in to your Ghar Tak account" } },
        signUp: { start: { title: "Create your account", subtitle: "Join thousands of local shoppers" } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryCacheInvalidator />
        <ApiClientAuthSync />
        <ReturnPathRecorder />
        <DataProvider>
          <CartProvider>
            <Layout>
              <Router />
            </Layout>
            <CartDrawer />
            <Toaster />
          </CartProvider>
        </DataProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
    </ThemeProvider>
  );
}

export default App;