import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import packageJson from "../package.json";
import { cn } from "@/lib/utils";

import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Ad Automation Studio",
    description: "Batch generate video ads with AI",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={cn(inter.className, "min-h-screen bg-background font-sans antialiased")}>
                <div className="relative flex min-h-screen flex-col">
                    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                        <div className="container flex h-14 max-w-screen-2xl items-center">
                            <div className="mr-4 hidden md:flex">
                                <a className="mr-6 flex items-center space-x-2" href="/">
                                    <span className="hidden font-bold sm:inline-block">AdStudio</span>
                                </a>
                            </div>
                            <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
                                <div className="w-full flex-1 md:w-auto md:flex-none">
                                    <span className="text-xs text-muted-foreground">v{packageJson.version}</span>
                                </div>
                            </div>
                        </div>
                    </header>
                    <main className="flex-1">
                        {children}
                    </main>
                    <Toaster richColors position="top-right" />
                </div>
            </body>
        </html>
    );
}
