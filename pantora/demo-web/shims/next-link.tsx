import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { router } from "../router-core";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string | { pathname?: string };
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
  children?: ReactNode;
};

/** next/link replacement: navigates inside the hosted demo without reloading the page. */
export default function Link({ href, prefetch: _prefetch, replace, scroll: _scroll, onClick, children, ...rest }: Props) {
  void _prefetch;
  void _scroll;
  const url = typeof href === "string" ? href : href.pathname ?? "/";
  const external = /^[a-z]+:/i.test(url);
  return (
    <a
      href={url}
      {...rest}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented || external) return;
        e.preventDefault();
        if (replace) router.replace(url);
        else router.push(url);
      }}
    >
      {children}
    </a>
  );
}
