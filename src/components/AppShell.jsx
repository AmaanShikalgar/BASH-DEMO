"use client";

import Link from "next/link";
import NavLink from "@/components/NavLink";
import { useNav } from "@/lib/useNav";
import { useAuth } from "@/context/AuthContext";
import { Bell, Search, Home, Ticket, User, LogOut } from "lucide-react";

export default function AppShell({ children, hideBottomNav = false }) {
    const { user, logout } = useAuth();
    const nav = useNav();

    return (
        <div className="min-h-screen w-full flex flex-col">
            {/* Top bar — only on >= md */}
            <header className="hidden md:flex items-center justify-between px-10 py-5 border-b border-white/5 sticky top-0 z-40 backdrop-blur-xl bg-[#0b0f19]/70">
                <Link
                    href="/"
                    className="flex items-center gap-2"
                    data-testid="brand-link"
                >
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-display text-white font-bold">
                        B
                    </div>
                    <span className="font-display text-xl tracking-tight">
                        Bash
                    </span>
                </Link>
                <nav className="flex items-center gap-8 font-body text-sm text-white/70">
                    <NavLink
                        href="/"
                        end
                        className={({ isActive }) =>
                            isActive
                                ? "text-white"
                                : "hover:text-white transition"
                        }
                        data-testid="nav-home"
                    >
                        Live Now
                    </NavLink>
                    <NavLink
                        href="/tickets"
                        className={({ isActive }) =>
                            isActive
                                ? "text-white"
                                : "hover:text-white transition"
                        }
                        data-testid="nav-tickets"
                    >
                        My Tickets
                    </NavLink>
                </nav>
                <div className="flex items-center gap-3">
                    {user ? (
                        <>
                            <span
                                className="text-sm text-white/70 font-body"
                                data-testid="user-name"
                            >
                                Hi, {user.name?.split(" ")[0]}
                            </span>
                            <button
                                onClick={() => {
                                    logout();
                                    nav("/");
                                }}
                                data-testid="logout-btn"
                                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </>
                    ) : (
                        <Link
                            href="/login"
                            data-testid="header-login-btn"
                            className="px-5 py-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-sm font-semibold hover:scale-[1.02] transition"
                        >
                            Sign in
                        </Link>
                    )}
                </div>
            </header>

            <main className="flex-1">{children}</main>

            {/* Mobile bottom nav */}
            {!hideBottomNav && (
                <nav className="md:hidden sticky bottom-0 z-40 bg-[#0b0f19]/90 backdrop-blur-xl border-t border-white/10 px-6 py-3 flex items-center justify-around">
                    <NavLink
                        href="/"
                        end
                        data-testid="mob-nav-home"
                        className={({ isActive }) =>
                            `flex flex-col items-center gap-1 text-xs ${isActive ? "text-white" : "text-white/50"}`
                        }
                    >
                        <Home className="w-5 h-5" />
                        Home
                    </NavLink>
                    <NavLink
                        href="/tickets"
                        data-testid="mob-nav-tickets"
                        className={({ isActive }) =>
                            `flex flex-col items-center gap-1 text-xs ${isActive ? "text-white" : "text-white/50"}`
                        }
                    >
                        <Ticket className="w-5 h-5" />
                        Tickets
                    </NavLink>
                    <NavLink
                        href={user ? "/tickets" : "/login"}
                        data-testid="mob-nav-account"
                        className={({ isActive }) =>
                            `flex flex-col items-center gap-1 text-xs ${isActive ? "text-white" : "text-white/50"}`
                        }
                    >
                        <User className="w-5 h-5" />
                        {user ? "Me" : "Sign in"}
                    </NavLink>
                </nav>
            )}
        </div>
    );
}
