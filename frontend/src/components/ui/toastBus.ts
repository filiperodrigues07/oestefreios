type ToastTone = 'info' | 'success' | 'warning' | 'danger';
type ToastFn = (message: string, tone?: ToastTone) => void;

let currentShowToast: ToastFn | null = null;

/** `ToastProvider` se registra aqui ao montar — permite disparar toast de fora da árvore React (ex.: `queryClient`). */
export function registerToast(fn: ToastFn | null) {
  currentShowToast = fn;
}

export function notifyToast(message: string, tone: ToastTone = 'danger') {
  currentShowToast?.(message, tone);
}
