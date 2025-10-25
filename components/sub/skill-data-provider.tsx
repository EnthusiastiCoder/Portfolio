"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useInView } from "react-intersection-observer";

type SkillDataProviderProps = {
  src: string;
  name: string;
  width: number;
  height: number;
  index: number;
};

export const SkillDataProvider = ({
  src,
  name,
  width,
  height,
  index,
}: SkillDataProviderProps) => {
  const { ref, inView } = useInView({
    triggerOnce: true,
  });

  const imageVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const animationDelay = 0.1;

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      variants={imageVariants}
      animate={inView ? "visible" : "hidden"}
      custom={index}
      transition={{ delay: index * animationDelay }}
    >
      <div className="flex flex-col items-center gap-2">
        <div className="w-[72px] h-[72px] md:w-[88px] md:h-[88px] flex items-center justify-center bg-white/5 rounded-lg p-2 hover:scale-105 transition-transform duration-200">
          <Image
            src={`/skills/${src}`}
            width={width}
            height={height}
            alt={name}
            className="object-contain"
          />
        </div>
        <div className="text-xs text-gray-200/80 text-center w-[88px] truncate">{name}</div>
      </div>
    </motion.div>
  );
};
