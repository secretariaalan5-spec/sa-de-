/**
 * AuthBackground — Premium background for login/register screens.
 * Uses CSS gradients and floating glow orbs for a modern look.
 */
import { ReactNode } from 'react';

interface AuthBackgroundProps {
  children: ReactNode;
}

export default function AuthBackground({ children }: AuthBackgroundProps) {
  return (
    <div className="auth-bg">
      {/* Gradient layer */}
      <div className="auth-bg__gradient" />

      {/* Content */}
      <div className="auth-bg__content">
        {children}
      </div>
    </div>
  );
}
