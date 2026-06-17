"use client";

import * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant: _variant = "default", size: _size = "default", ...props }, ref) => {
    return <button className={className} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button };
