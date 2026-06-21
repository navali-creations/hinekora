import clsx from "clsx";
import { motion, type Variants } from "motion/react";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  titleClassName?: string;
  actions?: ReactNode;
  subtitle?: ReactNode;
}

const headerTitleVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -20,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

const headerActionsVariants: Variants = {
  hidden: {
    opacity: 0,
    y: -10,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

function PageHeader({
  title,
  titleClassName,
  subtitle,
  actions,
}: PageHeaderProps) {
  return (
    <header className="flex items-baseline justify-between gap-6">
      <motion.div
        className="flex min-w-0 flex-col"
        variants={headerTitleVariants}
      >
        <h1
          className={clsx(
            "m-0 font-bold text-3xl text-base-content leading-tight",
            titleClassName,
          )}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="m-0 text-base text-base-content/70 leading-normal">
            {subtitle}
          </p>
        )}
      </motion.div>
      {actions && (
        <motion.div
          className="flex shrink-0 items-center justify-end gap-2"
          variants={headerActionsVariants}
        >
          {actions}
        </motion.div>
      )}
    </header>
  );
}

export { PageHeader };
