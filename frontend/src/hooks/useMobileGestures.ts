import { useEffect, useRef, useState } from 'react';

type PullState = 'idle' | 'pulling' | 'ready' | 'loading' | 'done' | 'error' | 'offline';
type GestureKind = 'open-menu' | 'close-menu' | 'refresh';

interface Gesture {
  kind: GestureKind;
  identifier: number;
  startX: number;
  startY: number;
}

interface MobileGesturesOptions {
  menuOpen: boolean;
  refreshEnabled: boolean;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onRefresh: () => Promise<void>;
}

const EDGE_WIDTH = 32;
const MENU_DISTANCE = 64;
const REFRESH_DISTANCE = 72;

export function gestureCompleted(kind: GestureKind, dx: number, dy: number): boolean {
  if (kind === 'open-menu') return dx >= MENU_DISTANCE && dx > Math.abs(dy) * 1.3;
  if (kind === 'close-menu') return dx <= -MENU_DISTANCE && -dx > Math.abs(dy) * 1.3;
  return dy >= REFRESH_DISTANCE && dy > Math.abs(dx) * 1.3;
}

function isInteractive(target: Element): boolean {
  return Boolean(target.closest('button, a, input, textarea, select, [contenteditable="true"]'));
}

function hasNestedScroll(target: Element): boolean {
  for (
    let element: Element | null = target;
    element && element !== document.body;
    element = element.parentElement
  ) {
    const style = window.getComputedStyle(element);
    if (/(auto|scroll)/.test(style.overflowX) && element.scrollWidth > element.clientWidth)
      return true;
    if (/(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight)
      return true;
  }
  return false;
}

/** Gestos do shell mobile; nunca intercepta formulários, diálogos ou áreas que já rolam. */
export function useMobileGestures({
  menuOpen,
  refreshEnabled,
  onOpenMenu,
  onCloseMenu,
  onRefresh,
}: MobileGesturesOptions): PullState {
  const [pullState, setPullState] = useState<PullState>('idle');
  const gestureRef = useRef<Gesture | null>(null);
  const refreshingRef = useRef(false);
  const feedbackTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 899px)');

    function clearGesture() {
      gestureRef.current = null;
      setPullState((current) => (current === 'pulling' || current === 'ready' ? 'idle' : current));
    }

    function showFeedback(state: PullState) {
      setPullState(state);
      if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = window.setTimeout(() => setPullState('idle'), 1500);
    }

    async function refresh() {
      if (!navigator.onLine) {
        showFeedback('offline');
        return;
      }
      refreshingRef.current = true;
      setPullState('loading');
      try {
        await onRefresh();
        showFeedback('done');
      } catch {
        showFeedback('error');
      } finally {
        refreshingRef.current = false;
      }
    }

    function onTouchStart(event: TouchEvent) {
      gestureRef.current = null;
      if (!mobile.matches || event.touches.length !== 1 || refreshingRef.current) return;
      const target = event.target;
      if (!(target instanceof Element) || isInteractive(target)) return;
      const touch = event.touches[0]!;

      if (menuOpen) {
        if (target.closest('[role="dialog"][aria-label="Menu"]')) {
          gestureRef.current = {
            kind: 'close-menu',
            identifier: touch.identifier,
            startX: touch.clientX,
            startY: touch.clientY,
          };
        }
        return;
      }
      if (document.querySelector('[role="dialog"]')) return;
      if (hasNestedScroll(target)) return;

      if (touch.clientX <= EDGE_WIDTH) {
        gestureRef.current = {
          kind: 'open-menu',
          identifier: touch.identifier,
          startX: touch.clientX,
          startY: touch.clientY,
        };
      } else if (
        refreshEnabled &&
        window.scrollY <= 0 &&
        (document.scrollingElement?.scrollTop ?? 0) <= 0 &&
        !document.querySelector('[data-pull-refresh-blocked="true"]')
      ) {
        gestureRef.current = {
          kind: 'refresh',
          identifier: touch.identifier,
          startX: touch.clientX,
          startY: touch.clientY,
        };
      }
    }

    function onTouchMove(event: TouchEvent) {
      const gesture = gestureRef.current;
      if (!gesture || gesture.kind !== 'refresh') return;
      if (event.touches.length !== 1) {
        clearGesture();
        return;
      }
      const touch = event.touches[0]!;
      if (touch.identifier !== gesture.identifier) return;
      const dx = touch.clientX - gesture.startX;
      const dy = touch.clientY - gesture.startY;
      if (
        dy < 0 ||
        Math.abs(dx) > dy ||
        window.scrollY > 0 ||
        (document.scrollingElement?.scrollTop ?? 0) > 0
      ) {
        clearGesture();
        return;
      }
      if (dy > 8) {
        event.preventDefault();
        setPullState(dy >= REFRESH_DISTANCE ? 'ready' : 'pulling');
      }
    }

    function onTouchEnd(event: TouchEvent) {
      const gesture = gestureRef.current;
      if (!gesture) return;
      const touch = Array.from(event.changedTouches).find(
        (item) => item.identifier === gesture.identifier,
      );
      clearGesture();
      if (!touch) return;
      const dx = touch.clientX - gesture.startX;
      const dy = touch.clientY - gesture.startY;
      if (gesture.kind === 'open-menu' && gestureCompleted(gesture.kind, dx, dy)) onOpenMenu();
      if (gesture.kind === 'close-menu' && gestureCompleted(gesture.kind, dx, dy)) onCloseMenu();
      if (
        gesture.kind === 'refresh' &&
        gestureCompleted(gesture.kind, dx, dy) &&
        refreshEnabled &&
        !document.querySelector('[data-pull-refresh-blocked="true"]')
      )
        void refresh();
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', clearGesture);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', clearGesture);
    };
  }, [menuOpen, refreshEnabled, onOpenMenu, onCloseMenu, onRefresh]);

  return pullState;
}
