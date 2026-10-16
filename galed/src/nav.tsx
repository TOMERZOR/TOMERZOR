import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

export type Tab = "feed" | "search" | "inbox" | "me";
export type Screen =
  | { k: "post"; id: string }
  | { k: "chat"; id: string }
  | { k: "person"; id: string }
  | { k: "compose" };

interface Nav {
  tab: Tab;
  stack: Screen[];
  setTab: (t: Tab) => void;
  push: (s: Screen) => void;
  pop: () => void;
  toast: (text: string) => void;
  toastText: string | null;
}

const Ctx = createContext<Nav | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const [tab, setTabState] = useState<Tab>("feed");
  const [stack, setStack] = useState<Screen[]>([]);
  const [toastText, setToast] = useState<string | null>(null);
  const timer = useRef<number>();

  const setTab = useCallback((t: Tab) => {
    setStack([]);
    setTabState(t);
  }, []);
  const push = useCallback((s: Screen) => setStack((st) => [...st, s]), []);
  const pop = useCallback(() => setStack((st) => st.slice(0, -1)), []);
  const toast = useCallback((text: string) => {
    window.clearTimeout(timer.current);
    setToast(text);
    timer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  return <Ctx.Provider value={{ tab, stack, setTab, push, pop, toast, toastText }}>{children}</Ctx.Provider>;
}

export const useNav = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useNav outside provider");
  return c;
};
