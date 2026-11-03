"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";

type Variant = "violet" | "acid" | "pink" | "danger" | "ghost";

const variants: Record<Variant, string> = {
  violet: "bg-violet-500 text-white glow-violet hover:bg-violet-400",
  acid: "bg-lime-400 text-slate-950 glow-acid hover:bg-lime-300",
  pink: "bg-pink-neon text-white glow-pink hover:brightness-110",
  danger: "bg-rose-500 text-white glow-red hover:bg-rose-400",
  ghost: "bg-white/5 text-slate-200 border border-white/10 hover:bg-white/10",
};

export interface PressProps extends HTMLMotionProps<"button"> {
  variant?: Variant;
  size?: "md" | "lg";
}

export const Press = forwardRef<HTMLButtonElement, PressProps>(function Press(
  { variant = "violet", size = "md", className = "", ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.94 }}
      transition={{ type: "spring", stiffness: 500, damping: 26 }}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl font-black tracking-wide transition-colors
        ${size === "lg" ? "px-8 py-4 text-xl" : "px-5 py-3 text-base"} ${variants[variant]} ${className}`}
      {...rest}
    />
  );
});
