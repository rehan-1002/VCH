"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, ShieldCheck, Zap, Monitor, LayoutDashboard, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CrowdCanvas } from "@/components/ui/skiper-ui/skiper39";

// Register GSAP Plugin
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/* =========================================================================
   SCROLL-TRIGGERED NARRATIVE LANDING PAGE WITH SKIPER39 CROWD CANVAS
   ========================================================================= */

export default function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const text1Ref = useRef<HTMLDivElement>(null);
  const text2Ref = useRef<HTMLDivElement>(null);
  const text3Ref = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: "+=350%",
          pin: true,
          scrub: 1,
        },
      });

      // Initial States
      gsap.set([text1Ref.current, text2Ref.current, text3Ref.current, heroRef.current], {
        opacity: 0,
        y: 40,
        filter: "blur(8px)",
      });

      // Stage 1: "TOO MUCH CROWD?" (0% - 25%)
      tl.to(text1Ref.current, { opacity: 1, y: 0, filter: "blur(0px)", duration: 1 })
        .to(text1Ref.current, { opacity: 0, y: -40, filter: "blur(8px)", duration: 1 }, "+=0.8");

      // Stage 2: "CHAOTIC MANAGEMENT?" (25% - 50%)
      tl.to(text2Ref.current, { opacity: 1, y: 0, filter: "blur(0px)", duration: 1 })
        .to(text2Ref.current, { opacity: 0, y: -40, filter: "blur(8px)", duration: 1 }, "+=0.8");

      // Stage 3: "DON'T WORRY. WE GOT YOU." (50% - 75%)
      tl.to(text3Ref.current, { opacity: 1, y: 0, filter: "blur(0px)", duration: 1 })
        .to(text3Ref.current, { opacity: 0, y: -40, filter: "blur(8px)", duration: 1 }, "+=0.8");

      // Stage 4: LiveQueue Final Hero (75% - 100%)
      tl.to(heroRef.current, { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.2 });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <main className="bg-zinc-950 text-zinc-100 min-h-screen selection:bg-zinc-800 selection:text-white">
      {/* Pinned Scroll Wrapper */}
      <div ref={containerRef} className="relative h-screen w-full overflow-hidden flex items-center justify-center">
        
        {/* Exact Skiper39 Crowd Canvas Background */}
        <div className="absolute inset-0 pointer-events-none opacity-50 z-0">
          <CrowdCanvas src="/images/peeps/all-peeps.png" rows={15} cols={7} />
          {/* Subtle vignette gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />
        </div>

        {/* Floating Top Navigation Brand Indicator */}
        <header className="absolute top-6 left-6 right-6 flex justify-between items-center z-30 font-mono text-xs uppercase tracking-widest text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-zinc-100 font-bold tracking-tight">LiveQueue // Engine</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/join">
              <Button variant="outline" size="sm" className="h-8 border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 font-mono text-[11px]">
                <UserCheck className="w-3.5 h-3.5 mr-1.5" /> Check-In
              </Button>
            </Link>
            <Link href="/admin">
              <Button variant="outline" size="sm" className="h-8 border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 font-mono text-[11px]">
                <LayoutDashboard className="w-3.5 h-3.5 mr-1.5" /> Staff Console
              </Button>
            </Link>
          </div>
        </header>

        {/* Narrative Stage 1: TOO MUCH CROWD? */}
        <div ref={text1Ref} className="absolute z-10 flex flex-col items-center text-center px-4 max-w-4xl">
          <Badge variant="outline" className="font-mono text-xs uppercase border-zinc-800 text-zinc-400 mb-4 px-3 py-1 bg-zinc-900/80">
            Stage 01 • Footfall Influx
          </Badge>
          <h1 className="text-6xl md:text-8xl font-black font-mono tracking-tighter uppercase text-white">
            Too Much Crowd?
          </h1>
          <p className="mt-4 text-zinc-400 font-mono text-sm md:text-base max-w-lg">
            Waiting lobbies overflowing, corridors clogged, and zero visibility into physical visitor bottlenecks.
          </p>
        </div>

        {/* Narrative Stage 2: HARD MANAGEMENT? */}
        <div ref={text2Ref} className="absolute z-10 flex flex-col items-center text-center px-4 max-w-4xl">
          <Badge variant="outline" className="font-mono text-xs uppercase border-red-900/50 text-red-400 mb-4 px-3 py-1 bg-red-950/20">
            Stage 02 • Operational Friction
          </Badge>
          <h1 className="text-6xl md:text-8xl font-black font-mono tracking-tighter uppercase text-red-500">
            Chaotic Lines?
          </h1>
          <p className="mt-4 text-zinc-400 font-mono text-sm md:text-base max-w-lg">
            Manual paper tokens, frustrated visitors, counter imbalances, and unpredictable service delays.
          </p>
        </div>

        {/* Narrative Stage 3: DON'T WORRY. WE GOT YOU. */}
        <div ref={text3Ref} className="absolute z-10 flex flex-col items-center text-center px-4 max-w-4xl">
          <Badge variant="outline" className="font-mono text-xs uppercase border-emerald-800/50 text-emerald-400 mb-4 px-3 py-1 bg-emerald-950/20">
            Stage 03 • Zero-Hardware Orchestration
          </Badge>
          <h1 className="text-5xl md:text-7xl font-black font-mono tracking-tighter uppercase text-emerald-400">
            Don&apos;t Worry.<br />We Got You.
          </h1>
          <p className="mt-4 text-zinc-300 font-mono text-sm md:text-base max-w-lg">
            Dynamic AI wait predictions, real-time WebSocket re-indexing, and instant zero-install virtual passes.
          </p>
        </div>

        {/* Narrative Stage 4: LiveQueue HERO COCKPIT */}
        <div ref={heroRef} className="absolute z-20 flex flex-col items-center text-center px-4 max-w-4xl">
          <Badge variant="outline" className="font-mono text-xs uppercase border-zinc-700 text-zinc-300 mb-4 px-3 py-1 bg-zinc-900/90 shadow-xl">
            <Zap className="w-3.5 h-3.5 text-emerald-400 mr-1.5" /> Next-Gen AI Queue Management
          </Badge>
          
          <h1 className="text-6xl md:text-8xl font-black font-mono tracking-tight uppercase text-white">
            Live<span className="text-emerald-400">Queue</span>
          </h1>

          <p className="mt-3 text-zinc-400 font-mono text-xs md:text-sm tracking-widest uppercase">
            Automated Real-Time Crowd & Queue Orchestration
          </p>

          <p className="mt-4 text-zinc-400 text-sm md:text-base max-w-xl font-sans">
            Sub-second token re-indexing, emergency triage priority overrides, and seamless multi-department routing for hospitals, banks, colleges, and service hubs.
          </p>

          {/* Action Hub */}
          <div className="mt-8 flex flex-wrap gap-3 justify-center items-center">
            <Link href="/join">
              <Button className="h-12 px-6 bg-white hover:bg-zinc-200 text-zinc-950 font-mono text-xs font-bold uppercase tracking-wider transition-all">
                Join Virtual Queue <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>

            <Link href="/admin">
              <Button variant="outline" className="h-12 px-6 border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-100 font-mono text-xs uppercase tracking-wider">
                <LayoutDashboard className="w-4 h-4 mr-2 text-zinc-400" /> Admin Console
              </Button>
            </Link>

            <Link href="/display">
              <Button variant="outline" className="h-12 px-6 border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 font-mono text-xs uppercase tracking-wider">
                <Monitor className="w-4 h-4 mr-2" /> Signage Board
              </Button>
            </Link>
          </div>

          {/* Micro Footer Spec */}
          <div className="mt-12 flex items-center gap-6 text-[11px] font-mono text-zinc-500 uppercase tracking-widest">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" /> OWASP Protected
            </span>
            <span>•</span>
            <span>WebSocket Sync</span>
            <span>•</span>
            <span>Zero App Install</span>
          </div>
        </div>

        {/* Bottom Scroll Indicator Helper */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-zinc-600 font-mono text-[10px] uppercase tracking-widest pointer-events-none z-10">
          <span>Scroll to explore</span>
          <div className="w-4 h-7 border border-zinc-700 rounded-full flex justify-center p-1">
            <div className="w-1 h-2 bg-zinc-500 rounded-full animate-bounce" />
          </div>
        </div>
      </div>
    </main>
  );
}
