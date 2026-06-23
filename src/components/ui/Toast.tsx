import { useEffect, useState, useCallback, createContext, useContext } from 'react';

interface ToastMessage {
  id: number;
  text: string;
  tone: 'success' | 'error' | 'info';
}

interface ToastContextType {
  toast: (text: string, tone?: ToastMessage['tone']) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const toast = useCallback((text: string, tone: ToastMessage['tone'] = 'success') => {
    const id = nextId++;
    setMessages((prev) => [...prev, { id, text, tone }]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-container">
        {messages.map((msg) => (
          <ToastItem key={msg.id} message={msg} onDone={() => setMessages((p) => p.filter((m) => m.id !== msg.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ message, onDone }: { message: ToastMessage; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return <div className={`toast toast-${message.tone}`}>{message.text}</div>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
