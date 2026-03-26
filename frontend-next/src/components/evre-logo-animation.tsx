'use client';

import { motion, type Variants } from 'motion/react';

const EASE = [0.21, 0.47, 0.32, 0.98] as const;

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

const iconVariants: Variants = {
  hidden: { opacity: 0, scale: 0.75 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.45, ease: EASE },
  },
};

const letterVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: EASE },
  },
};

const slashVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.25, ease: 'easeOut' as const },
  },
};

interface EvreLogoAnimationProps {
  className?: string;
}

export function EvreLogoAnimation({ className }: EvreLogoAnimationProps) {
  return (
    <motion.svg
      version="1.2"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 703 148"
      className={className ?? 'h-8 w-auto'}
      aria-label="EVRE"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* > icon box — anima primeiro */}
      <motion.g
        variants={iconVariants}
        style={{ transformOrigin: '67px 74px' }}
      >
        <path
          fillRule="evenodd"
          fill="#1f1f1f"
          d="m3 7.9h125.3c1.66 0 3 1.34 3 3v125.3c0 1.66-1.34 3-3 3h-125.3c-1.66 0-3-1.34-3-3v-125.3c0-1.66 1.34-3 3-3z"
        />
        <path
          fill="#b9b9b9"
          d="m29.63 101.55l55.99-28.07-55.99-28.07v-17.94l72.05 36.81v18.4l-72.05 36.96z"
        />
      </motion.g>

      {/* E */}
      <motion.path
        fill="#1f1f1f"
        d="m166.38 8.24h101.88v21.83h-75.76v31.54h66.06v21.09h-66.06v34.15h75.76v22.02h-101.88z"
        variants={letterVariants}
      />

      {/* V */}
      <motion.path
        fill="#1f1f1f"
        d="m358.38 138.86h-28.74l-49.81-130.62h28.92l36.39 102.26h0.37l36.95-102.26h26.68z"
        variants={letterVariants}
      />

      {/* / */}
      <motion.path
        fill="#b9b9b9"
        d="m441.19 0h11.38l-45.72 147.04h-11.38z"
        variants={slashVariants}
      />

      {/* R */}
      <motion.path
        fill="#1f1f1f"
        d="m474.4 8.24h55.05c22.02 0 56.91 7.84 56.91 46.28 0 21.27-11.2 33.78-25.19 40.49l26.68 43.85h-29.67l-21.83-37.51c-1.68 0.19-3.36 0.19-5.04 0.19h-30.79v37.32h-26.12zm53.18 72.03c17.73 0 31.53-8.02 31.53-25.56 0-17.54-13.43-24.82-31.53-24.82h-27.06v50.38z"
        variants={letterVariants}
      />

      {/* E */}
      <motion.path
        fill="#1f1f1f"
        d="m601.09 8.24h101.88v21.83h-75.76v31.54h66.06v21.09h-66.06v34.15h75.76v22.02h-101.88z"
        variants={letterVariants}
      />
    </motion.svg>
  );
}
