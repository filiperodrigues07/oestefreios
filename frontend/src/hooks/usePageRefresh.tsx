import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';

type RefreshHandler = () => Promise<unknown>;
type RegisterRefresh = (handler: RefreshHandler | null) => void;

const PageRefreshContext = createContext<RegisterRefresh | null>(null);

export function PageRefreshProvider({
  register,
  children,
}: {
  register: RegisterRefresh;
  children: ReactNode;
}) {
  return <PageRefreshContext.Provider value={register}>{children}</PageRefreshContext.Provider>;
}

/** Páginas com dados fora do cache de queries podem definir o que puxar para atualizar faz. */
export function usePageRefresh(handler: RefreshHandler) {
  const register = useContext(PageRefreshContext);
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!register) return;
    register(() => handlerRef.current());
    return () => register(null);
  }, [register]);
}
