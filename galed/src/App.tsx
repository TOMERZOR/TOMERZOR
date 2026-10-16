import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { IconChat, IconCompass, IconPack, IconPlus, IconTrail } from "./components/icons";
import { SvgDefs } from "./components/marks";
import { NavProvider, useNav, type Screen, type Tab } from "./nav";
import { Chat } from "./screens/Chat";
import { Compose } from "./screens/Compose";
import { Feed } from "./screens/Feed";
import { Inbox } from "./screens/Inbox";
import { Onboarding } from "./screens/Onboarding";
import { PostDetail } from "./screens/PostDetail";
import { Person, Profile } from "./screens/Profile";
import { Search } from "./screens/Search";
import { StoreProvider, useStore } from "./store";

const tabs: { k: Tab; label: string; Icon: typeof IconTrail }[] = [
  { k: "feed", label: "שבילים", Icon: IconTrail },
  { k: "search", label: "חיפוש", Icon: IconCompass },
  { k: "inbox", label: "הודעות", Icon: IconChat },
  { k: "me", label: "אני", Icon: IconPack },
];

function TabBar() {
  const { tab, setTab, push } = useNav();
  const { state } = useStore();
  const unread = state.threads.reduce((s, t) => s + t.unread, 0);
  const items = [...tabs.slice(0, 2), null, ...tabs.slice(2)];
  return (
    <nav className="tabbar" aria-label="ניווט ראשי">
      {items.map((t) =>
        t === null ? (
          <motion.button
            key="new"
            className="tab-new"
            onClick={() => push({ k: "compose" })}
            whileTap={{ scale: 0.9, rotate: 90 }}
            aria-label="יציאה חדשה"
          >
            <IconPlus size={26} />
          </motion.button>
        ) : (
          <button key={t.k} className={`tab ${tab === t.k ? "on" : ""}`} onClick={() => setTab(t.k)} aria-current={tab === t.k ? "page" : undefined}>
            {tab === t.k && <motion.span layoutId="tab-blaze" className="tab-blaze" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
            <t.Icon />
            <span>{t.label}</span>
            {t.k === "inbox" && unread > 0 && <span className="tab-badge mono">{unread}</span>}
          </button>
        ),
      )}
    </nav>
  );
}

function StackScreen({ s }: { s: Screen }) {
  if (s.k === "post") return <PostDetail id={s.id} />;
  if (s.k === "chat") return <Chat id={s.id} />;
  if (s.k === "person") return <Person id={s.id} />;
  return <Compose />;
}

function Shell() {
  const { state } = useStore();
  const { tab, stack, toastText } = useNav();
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [tab]);

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme === "night" ? "dark" : "light";
  }, [state.theme]);

  return (
    <div className="device">
      <SvgDefs />
      <AnimatePresence>
        {!state.onboarded && (
          <motion.div key="onb" className="layer onb-layer" exit={{ opacity: 0, scale: 1.04 }} transition={{ duration: 0.5 }}>
            <Onboarding />
          </motion.div>
        )}
      </AnimatePresence>

      {state.onboarded && (
        <>
          <motion.div
            className="layer base"
            animate={{ x: stack.length ? "18%" : 0, filter: stack.length ? "brightness(.82)" : "brightness(1)" }}
            transition={{ type: "spring", stiffness: 300, damping: 34 }}
          >
            <div className="scroller" ref={scroller}>
              <AnimatePresence mode="wait">
                <motion.main
                  key={tab}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                >
                  {tab === "feed" && <Feed />}
                  {tab === "search" && <Search />}
                  {tab === "inbox" && <Inbox />}
                  {tab === "me" && <Profile />}
                </motion.main>
              </AnimatePresence>
            </div>
            <TabBar />
          </motion.div>

          <AnimatePresence>
            {stack.map((s, i) => (
              <motion.div
                key={`${s.k}-${"id" in s ? s.id : ""}-${i}`}
                className="layer stack"
                style={{ zIndex: 10 + i }}
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 300, damping: 34 }}
              >
                <StackScreen s={s} />
              </motion.div>
            ))}
          </AnimatePresence>
        </>
      )}

      <AnimatePresence>
        {toastText && (
          <motion.div
            className="toast"
            role="status"
            initial={{ y: -80, opacity: 0, rotate: -2 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
          >
            {toastText}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="grain" aria-hidden />
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <StoreProvider>
        <NavProvider>
          <Shell />
        </NavProvider>
      </StoreProvider>
    </MotionConfig>
  );
}
