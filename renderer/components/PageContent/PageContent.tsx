import clsx from "clsx";
import { motion, type Variants } from "motion/react";
import type { PropsWithChildren } from "react";

interface PageContentProps extends PropsWithChildren {
  className?: string;
}

const contentVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 0.2, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

function PageContent({ children, className = "" }: PageContentProps) {
  return (
    <motion.div
      className={clsx(
        "min-h-0 flex-1 overflow-y-auto overflow-x-hidden",
        className,
      )}
      variants={contentVariants}
    >
      {children}
    </motion.div>
  );
}

export { PageContent };
