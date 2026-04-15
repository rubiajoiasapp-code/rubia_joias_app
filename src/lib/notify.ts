import { toast } from 'sonner';

interface ToastOptions {
    description?: string;
    duration?: number;
}

export type ConfirmTone = 'default' | 'danger';

export interface ConfirmOptions {
    title: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    tone?: ConfirmTone;
}

export interface DialogState extends ConfirmOptions {}

let dialogResolver: ((value: boolean) => void) | null = null;
const listeners = new Set<(state: DialogState | null) => void>();

function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
    return new Promise(resolve => {
        if (dialogResolver) {
            dialogResolver(false);
        }
        dialogResolver = resolve;
        listeners.forEach(l => l(opts));
    });
}

export function subscribeDialog(fn: (state: DialogState | null) => void): () => void {
    listeners.add(fn);
    return () => {
        listeners.delete(fn);
    };
}

export function resolveDialog(result: boolean): void {
    const resolver = dialogResolver;
    dialogResolver = null;
    listeners.forEach(l => l(null));
    resolver?.(result);
}

export const notify = {
    success(message: string, options?: ToastOptions) {
        toast.success(message, options);
    },
    error(message: string, options?: ToastOptions) {
        toast.error(message, { duration: 6000, ...options });
    },
    warning(message: string, options?: ToastOptions) {
        toast.warning(message, options);
    },
    info(message: string, options?: ToastOptions) {
        toast.info(message, options);
    },
    message(message: string, options?: ToastOptions) {
        toast(message, options);
    },
    confirm: confirmDialog,
};
