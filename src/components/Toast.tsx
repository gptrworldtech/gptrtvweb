interface ToastProps {
  message: string;
  show: boolean;
}

export function Toast({ message, show }: ToastProps) {
  return (
    <div
      className={`fixed bottom-[30px] left-1/2 -translate-x-1/2 bg-[#141414e6] text-white px-6 py-3 rounded-[50px] text-sm font-semibold shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-white/10 z-[1000] pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] ${
        show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-[20px]"
      }`}
    >
      {message}
    </div>
  );
}
