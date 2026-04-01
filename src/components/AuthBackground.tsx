/**
 * AuthBackground — Animated particle background for login/register screens.
 * Uses tsParticles for premium floating particle effects on a deep blue gradient.
 */
import { useCallback, useEffect, useState } from 'react';
import Particles, { initParticlesEngine } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import type { ISourceOptions } from '@tsparticles/engine';

const particleOptions: ISourceOptions = {
  fullScreen: false,
  fpsLimit: 60,
  particles: {
    number: {
      value: 60,
      density: { enable: true, width: 800, height: 800 },
    },
    color: { value: ['#ffffff', '#93c5fd', '#60a5fa', '#a5b4fc'] },
    shape: { type: 'circle' },
    opacity: {
      value: { min: 0.1, max: 0.5 },
      animation: { enable: true, speed: 0.8, startValue: 'random', sync: false },
    },
    size: {
      value: { min: 1, max: 4 },
      animation: { enable: true, speed: 2, startValue: 'random', sync: false },
    },
    move: {
      enable: true,
      speed: { min: 0.3, max: 1.2 },
      direction: 'none',
      random: true,
      straight: false,
      outModes: { default: 'out' },
    },
    links: {
      enable: true,
      distance: 140,
      color: '#93c5fd',
      opacity: 0.15,
      width: 1,
    },
    wobble: {
      enable: true,
      distance: 10,
      speed: { min: -2, max: 2 },
    },
  },
  interactivity: {
    events: {
      onHover: { enable: true, mode: 'grab' },
    },
    modes: {
      grab: { distance: 160, links: { opacity: 0.3 } },
    },
  },
  detectRetina: true,
};

interface AuthBackgroundProps {
  children: React.ReactNode;
}

export default function AuthBackground({ children }: AuthBackgroundProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => setReady(true));
  }, []);

  return (
    <div className="auth-bg">
      {/* Gradient layer */}
      <div className="auth-bg__gradient" />

      {/* Animated glow orbs */}
      <div className="auth-bg__orbs" aria-hidden="true">
        <span className="auth-orb auth-orb--1" />
        <span className="auth-orb auth-orb--2" />
        <span className="auth-orb auth-orb--3" />
      </div>

      {/* Particles */}
      {ready && (
        <Particles
          id="auth-particles"
          options={particleOptions}
          className="auth-bg__particles"
        />
      )}

      {/* Content */}
      <div className="auth-bg__content">
        {children}
      </div>
    </div>
  );
}
