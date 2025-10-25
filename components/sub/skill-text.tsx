"use client";

import { SparklesIcon } from "@heroicons/react/24/solid";
import { motion } from "framer-motion";

import {
  slideInFromLeft,
  slideInFromRight,
  slideInFromTop,
} from "@/lib/motion";

export const SkillText = () => {
  return (
    <div className="w-full h-auto flex flex-col items-center justify-center">
      <motion.div
        variants={slideInFromLeft(0.5)}
        className="text-[40px] text-transparent font-medium mt-[50px] text-center mb-[-15px] bg-clip-text bg-gradient-to-r from-purple-500 to-cyan-500"
      >
        Making apps with modern technologies.
      </motion.div>
    </div>
  );
};
