import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { subscribeDialog, resolveDialog, type DialogState } from '../lib/notify';

const ConfirmDialog: React.FC = () => {
    const [state, setState] = useState<DialogState | null>(null);
    const confirmButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => subscribeDialog(setState), []);

    useEffect(() => {
        if (!state) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') resolveDialog(false);
            if (e.key === 'Enter') resolveDialog(true);
        };
        window.addEventListener('keydown', onKey);
        setTimeout(() => confirmButtonRef.current?.focus(), 50);
        return () => window.removeEventListener('keydown', onKey);
    }, [state]);

    if (!state) return null;

    const tone = state.tone || 'default';
    const confirmClasses =
        tone === 'danger'
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-pink-600 hover:bg-pink-700 text-white';
    const iconBg = tone === 'danger' ? 'bg-red-100 text-red-600' : 'bg-pink-100 text-pink-600';

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => resolveDialog(false)}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={`rounded-full p-3 ${iconBg} shrink-0`}>
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-bold text-gray-900 pr-8">{state.title}</h3>
                            {state.description && (
                                <p className="mt-2 text-sm text-gray-600 whitespace-pre-line">
                                    {state.description}
                                </p>
                            )}
                        </div>
                        <button
                            onClick={() => resolveDialog(false)}
                            className="text-gray-400 hover:text-gray-600 -mr-2 -mt-1 p-1 rounded-full hover:bg-gray-100 transition-colors"
                            aria-label="Fechar"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                <div className="bg-gray-50 px-6 py-4 flex gap-3 justify-end">
                    <button
                        onClick={() => resolveDialog(false)}
                        className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition-colors"
                    >
                        {state.cancelText || 'Cancelar'}
                    </button>
                    <button
                        ref={confirmButtonRef}
                        onClick={() => resolveDialog(true)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${confirmClasses}`}
                    >
                        {state.confirmText || 'Confirmar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
