import { useCallback, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { buildUrl, navigate } from "@/app/router";

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to: string;
  children: ReactNode;
  /** No restablece el scroll (transiciones de héroe). */
  keepScroll?: boolean;
}

/** Enlace interno con History API: cero recargas de página. */
export function Link({ to, children, keepScroll, onClick, ...rest }: LinkProps) {
  const handle = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      navigate(to, { keepScroll });
    },
    [to, keepScroll, onClick],
  );

  return (
    <a href={buildUrl(to)} onClick={handle} {...rest}>
      {children}
    </a>
  );
}

export interface ExternalLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: ReactNode;
}

export function ExternalLink({ href, children, ...rest }: ExternalLinkProps) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" {...rest}>
      {children}
    </a>
  );
}
