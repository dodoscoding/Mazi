import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon } from "./icons";
import type { IconName } from "./icons";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`button button--${variant} ${className}`.trim()}
      {...props}
    />
  );
}

export function IconButton({
  icon,
  label,
  className = "",
  type = "button",
  children,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  icon: IconName;
  label: string;
  children?: ReactNode;
}) {
  return (
    <button
      type={type}
      aria-label={label}
      className={`icon-button ${className}`.trim()}
      {...props}
    >
      <Icon name={icon} size={16} />
      {children}
    </button>
  );
}
