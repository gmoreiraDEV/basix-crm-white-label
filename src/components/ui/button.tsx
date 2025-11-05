import { ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className, ...rest } = props;
  return <button className={clsx("btn", className)} {...rest} />;
}
