"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

// Replaces window.confirm/window.prompt with a themed, in-app modal.
// Native browser dialogs are unstyled, ignore dark mode, and (window.prompt
// especially) are poor on mobile — this drops in with the same call-site
// shape (await confirm(...) / await prompt(...)) but resolves a Promise
// instead of blocking the JS thread synchronously.

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  // Red confirm button — for destructive actions (delete, etc).
  danger?: boolean;
}

export interface PromptOptions {
  title?: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  type?: "text" | "number";
  min?: number;
  max?: number;
}

type Request =
  | ({ kind: "confirm"; resolve: (v: boolean) => void } & ConfirmOptions)
  | ({ kind: "prompt"; resolve: (v: string | null) => void } & PromptOptions);

interface DialogContextValue {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  prompt: (options: PromptOptions | string) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within DialogProvider");
  return ctx;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);
  const [inputValue, setInputValue] = useState("");

  const confirm = (options: ConfirmOptions | string): Promise<boolean> => {
    const opts = typeof options === "string" ? { message: options } : options;
    return new Promise((resolve) => {
      setRequest({ kind: "confirm", resolve, ...opts });
    });
  };

  const prompt = (options: PromptOptions | string): Promise<string | null> => {
    const opts = typeof options === "string" ? { message: options } : options;
    setInputValue(opts.defaultValue || "");
    return new Promise((resolve) => {
      setRequest({ kind: "prompt", resolve, ...opts });
    });
  };

  // Not wrapped in useCallback/useMemo — deliberately recreated each render
  // so they always close over the current `request`, avoiding a stale
  // closure inside the Escape-key effect below.
  const settle = (result: boolean | string | null) => {
    if (!request) return;
    if (request.kind === "confirm") request.resolve(result as boolean);
    else request.resolve(result as string | null);
    setRequest(null);
  };
  const handleCancel = () => settle(request?.kind === "prompt" ? null : false);
  const handleConfirm = () =>
    settle(request?.kind === "prompt" ? inputValue : true);

  useEffect(() => {
    if (!request) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") handleCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}
      {request && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
          onClick={handleCancel}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={request.title || request.message}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-transparent dark:border-gray-800 p-6 w-full max-w-sm space-y-4"
          >
            {request.title && (
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {request.title}
              </h2>
            )}
            {request.message && (
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">
                {request.message}
              </p>
            )}
            {request.kind === "prompt" && (
              <input
                autoFocus
                type={request.type === "number" ? "number" : "text"}
                min={request.min}
                max={request.max}
                className="input"
                placeholder={request.placeholder}
                aria-label={request.title || request.message}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === "Enter") handleConfirm();
                }}
              />
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={handleCancel} className="btn-secondary text-sm">
                {request.cancelText || "Cancel"}
              </button>
              <button
                onClick={handleConfirm}
                autoFocus={request.kind === "confirm"}
                className={
                  request.kind === "confirm" && request.danger
                    ? "bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
                    : "btn-primary text-sm"
                }
              >
                {request.confirmText ||
                  (request.kind === "confirm" && request.danger ? "Delete" : "OK")}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}
