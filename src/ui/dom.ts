// Ayudante mínimo para crear nodos del DOM sin framework.
type Child = Node | string | null | undefined | false;
type Props = Record<string, unknown>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  children: Child[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "className") el.className = String(value);
    else if (key === "style" && typeof value === "string")
      el.setAttribute("style", value);
    else if (key.startsWith("on") && typeof value === "function")
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    else if (key in el && !key.includes("-"))
      (el as unknown as Record<string, unknown>)[key] = value;
    else el.setAttribute(key, String(value));
  }
  for (const child of children)
    if (child) el.append(typeof child === "string" ? child : child);
  return el;
}

// Botón con estado activado (aria-pressed).
export function toggleButton(
  label: string,
  pressed: boolean,
  onToggle: (pressed: boolean) => void,
  className = "ng-btn",
): HTMLButtonElement {
  const btn = h("button", { type: "button", className }, [label]);
  const set = (v: boolean) => btn.setAttribute("aria-pressed", String(v));
  set(pressed);
  btn.addEventListener("click", () => {
    const next = btn.getAttribute("aria-pressed") !== "true";
    set(next);
    onToggle(next);
  });
  return btn;
}

export const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
