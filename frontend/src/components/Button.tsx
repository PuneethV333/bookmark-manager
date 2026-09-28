import type { ButtonHTMLAttributes, ReactNode } from "react";
import { buttonStyles, type ButtonSize, type ButtonVariant } from "../utils/buttonStyles";
import Spinner from "./Spinner";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

const Button = ({
  variant,
  size,
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) => (
  <button
    type={type}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    className={buttonStyles({ variant, size, className })}
    {...rest}
  >
    {loading ? <Spinner /> : icon}
    {children}
  </button>
);

export default Button;
