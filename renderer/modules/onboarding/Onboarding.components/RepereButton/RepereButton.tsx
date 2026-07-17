import { type ComponentPropsWithoutRef, forwardRef } from "react";

interface RepereButtonProps
  extends Omit<
    ComponentPropsWithoutRef<"button">,
    "popoverTarget" | "popoverTargetAction"
  > {
  popovertarget?: string;
  popovertargetaction?: "hide" | "show" | "toggle";
}

const RepereButton = forwardRef<HTMLButtonElement, RepereButtonProps>(
  function RepereButton({ popovertarget, popovertargetaction, ...props }, ref) {
    return (
      <button
        {...props}
        ref={ref}
        popoverTarget={popovertarget}
        popoverTargetAction={popovertargetaction}
      />
    );
  },
);

export { RepereButton };
