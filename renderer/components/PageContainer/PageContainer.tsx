import clsx from "clsx";
import { AnimatePresence, motion, type Variants } from "motion/react";
import type { PropsWithChildren } from "react";

import { useSettingsSelector } from "~/renderer/store";

interface PageContainerProps extends PropsWithChildren {
  className?: string;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.2,
    },
  },
};

function PageContainer({ children, className = "" }: PageContainerProps) {
  const activeGame = useSettingsSelector(
    (settings) => settings.value?.activeGame ?? "poe1",
  );

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`page-${activeGame}`}
        className={clsx(
          "flex h-[calc(100%_-_calc(var(--spacing)_*_10))] min-h-0 flex-col gap-6 bg-base-100 p-6",
          className,
        )}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export { PageContainer };
