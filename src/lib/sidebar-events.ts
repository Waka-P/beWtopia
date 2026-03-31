// Simple event bridge to mirror proto's onSidebarStateChange behavior
// Usage:
// onSidebarStateChange((expanded, isInit) => { ... });
// emitSidebarStateChange(true|false, isInit?) from your sidebar implementation

export type SidebarStateCallback = (expanded: boolean, isInit: boolean) => void;

const EVENT_NAME = "bewtopia:sidebar-state-change";

export function onSidebarStateChange(cb: SidebarStateCallback) {
  if (typeof window === "undefined") return () => {};

  const handler = (e: Event) => {
    const detail = (e as CustomEvent<{ expanded: boolean; isInit?: boolean }>)
      .detail || { expanded: true, isInit: false };
    cb(detail.expanded, !!detail.isInit);
  };

  window.addEventListener(EVENT_NAME, handler as EventListener);

  return () => window.removeEventListener(EVENT_NAME, handler as EventListener);
}

export function emitSidebarStateChange(expanded: boolean, isInit = false) {
  if (typeof window === "undefined") return;
  const event = new CustomEvent(EVENT_NAME, {
    detail: { expanded, isInit },
  });
  window.dispatchEvent(event);
}
