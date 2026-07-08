import { useState, forwardRef, InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Input de senha com botão de "olhinho" para alternar visibilidade.
 * Recebe as mesmas props de um <input>, exceto `type` (sempre controlado aqui).
 */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(
  ({ className = '', ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <input
          {...props}
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={`${className} pr-10`}
        />
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          tabIndex={-1}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';
