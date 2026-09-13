"use client";
import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Squares2X2Icon,
  ChartBarIcon,
  TruckIcon,
  CalendarDaysIcon,
  BanknotesIcon,
  ReceiptPercentIcon,
  ClipboardDocumentListIcon,
  UsersIcon,
  IdentificationIcon,
  BuildingStorefrontIcon,
  Cog6ToothIcon,
  KeyIcon,
  ScissorsIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  Bars3Icon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useTheme, type ThemeChoice } from "@/context/ThemeContext";
import clsx from "clsx";
import type { UserRole, User } from "@/types/user";
import { hasFeature, type FeatureKey } from "@/lib/features";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

interface NavItem {
  href: string;
  label: string;
  icon: Icon;
  roles: UserRole[];
  // When set, the item only shows if this feature flag is on for the user's
  // branch (super_admin always sees it) — see src/lib/features.ts.
  feature?: FeatureKey;
}

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: Squares2X2Icon,
    roles: ["super_admin", "admin", "checker"],
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: ChartBarIcon,
    roles: ["super_admin", "admin"],
    feature: "analytics",
  },
  {
    href: "/upcoming-delivery",
    label: "Upcoming Delivery",
    icon: TruckIcon,
    roles: ["super_admin", "admin", "checker"],
    feature: "upcomingDelivery",
  },
  {
    href: "/appointments",
    label: "Appointments",
    icon: CalendarDaysIcon,
    roles: ["super_admin", "admin"],
    feature: "appointments",
  },
  {
    href: "/collections",
    label: "Collections",
    icon: BanknotesIcon,
    roles: ["super_admin", "admin"],
    feature: "collections",
  },
  {
    href: "/daily-summary",
    label: "Daily Summary",
    icon: ReceiptPercentIcon,
    roles: ["super_admin", "admin"],
    feature: "dailySummary",
  },
  {
    href: "/orders",
    label: "Orders",
    icon: ClipboardDocumentListIcon,
    roles: [
      "super_admin",
      "admin",
      "checker",
      "cutting_master",
      "stitcher",
      "presser",
      "stock_manager",
      "delivery_staff",
    ],
  },
  {
    href: "/customers",
    label: "Customers",
    icon: UsersIcon,
    roles: ["super_admin", "admin"],
  },
  {
    href: "/staff",
    label: "Staff",
    icon: IdentificationIcon,
    roles: ["super_admin", "admin"],
  },
  { href: "/branches", label: "Branches", icon: BuildingStorefrontIcon, roles: ["super_admin"] },
  {
    href: "/settings",
    label: "Settings",
    icon: Cog6ToothIcon,
    roles: ["super_admin", "admin"],
  },
  {
    href: "/change-password",
    label: "Change Password",
    icon: KeyIcon,
    roles: ["super_admin", "admin", "checker"],
    feature: "changePassword",
  },
];

interface Badges {
  drafts: number;
  review: number;
  ready: number;
  total: number;
}

interface NavContentProps {
  allowed: NavItem[];
  pathname: string;
  user: User | null;
  badges: Badges | null;
  onNavigate?: () => void;
  handleLogout: () => void;
}

const THEME_OPTIONS: { value: ThemeChoice; label: string; icon: Icon }[] = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: ComputerDesktopIcon },
];

// Three-way segmented control — light / dark / system. Kept small enough to
// sit above Sign Out without pushing content around on narrow screens.
function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className="segmented mb-3">
      {THEME_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={theme === opt.value}
          onClick={() => setTheme(opt.value)}
          title={opt.label}
          className={clsx(
            "segmented-btn",
            theme === opt.value && "segmented-btn-active",
          )}
        >
          <opt.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

// Shared nav content used by both the desktop sidebar and the mobile drawer.
function NavContent({ allowed, pathname, user, badges, onNavigate, handleLogout }: NavContentProps) {
  return (
    <>
      <div className="flex items-center gap-2 p-6 border-b border-border">
        <ScissorsIcon className="h-5 w-5 text-accent shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <h1 className="text-lg font-extrabold text-ink leading-tight">Taylor App</h1>
          <p className="text-xs text-faint truncate">
            {(user?.branch && typeof user.branch === "object" && user.branch.name) || "All Branches"}
          </p>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {allowed.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors",
                active
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:bg-surface-hover hover:text-ink",
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {item.label}
              {item.href === "/orders" && badges && badges.total > 0 && (
                <span
                  title={`${badges.drafts} drafts · ${badges.review} in review · ${badges.ready} ready for pickup`}
                  className="ml-auto bg-accent text-white text-xs font-semibold rounded-full px-2 py-0.5"
                >
                  {badges.total}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <ThemeSwitcher />
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-sm font-bold shrink-0">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink truncate">{user?.name}</p>
            <p className="text-xs text-faint capitalize">{user?.role?.replace(/_/g, " ")}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="btn-secondary w-full text-sm">
          Sign Out
        </button>
      </div>
    </>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  // Live nav counts (navBadges feature) — refreshed on navigation and every
  // minute; failures are silent (badges are a convenience, not data).
  const [badges, setBadges] = useState<Badges | null>(null);
  const showBadges =
    !!user &&
    ["super_admin", "admin"].includes(user.role) &&
    hasFeature(user, "navBadges");
  useEffect(() => {
    if (!showBadges) {
      setBadges(null);
      return;
    }
    let alive = true;
    const load = () =>
      api
        .get("/dashboard/badges")
        .then(({ data }) => {
          if (alive) setBadges(data.data);
        })
        .catch(() => {});
    load();
    const timer = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [showBadges, pathname]);

  const allowed = navItems.filter(
    (item) =>
      user &&
      item.roles.includes(user.role) &&
      (!item.feature || hasFeature(user, item.feature)),
  );

  return (
    <>
      {/* Mobile top bar — hamburger + brand, shown below md breakpoint only */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between bg-surface border-b border-border px-4 py-3">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="p-2 -ml-2 text-muted hover:text-ink"
        >
          <Bars3Icon className="h-6 w-6" />
        </button>
        <h1 className="flex items-center gap-1.5 text-base font-extrabold text-ink">
          <ScissorsIcon className="h-4 w-4 text-accent" aria-hidden="true" />
          Taylor App
        </h1>
        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-sm font-bold">
          {user?.name?.[0]?.toUpperCase()}
        </div>
      </header>

      {/* Desktop sidebar — always visible at md and up */}
      <aside className="hidden md:flex w-[270px] bg-surface border-r border-border flex-col h-screen sticky top-0 shrink-0">
        <NavContent
          allowed={allowed}
          pathname={pathname}
          user={user}
          badges={badges}
          handleLogout={handleLogout}
        />
      </aside>

      {/* Mobile drawer — slides in from the left, only rendered when open */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer panel */}
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-surface flex flex-col shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute top-3 right-3 p-2 text-faint hover:text-ink"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
            <NavContent
              allowed={allowed}
              pathname={pathname}
              user={user}
              badges={badges}
              handleLogout={handleLogout}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}
    </>
  );
}
