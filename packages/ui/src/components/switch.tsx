import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

type SwitchProps = React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>;

const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  SwitchProps
>(({ className = "", ...props }, ref) => {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent bg-stone-300 transition data-[state=checked]:bg-stone-900 data-[state=unchecked]:bg-stone-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-5" />
    </SwitchPrimitive.Root>
  );
});

Switch.displayName = "Switch";

export { Switch };
