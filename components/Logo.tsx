import React from 'react';

// Símbolo: balão de pensamento + "play". Mantenha em sincronia com scripts/make-brand-assets.cjs.
export const LogoMark: React.FC<{ size?: number; className?: string }> = ({ size = 32, className }) => (
  <svg width={size} height={size} viewBox="0 0 512 512" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="tp-bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#9672ff" />
        <stop offset=".55" stopColor="#6a35f5" />
        <stop offset="1" stopColor="#3a1f85" />
      </linearGradient>
      <linearGradient id="tp-play" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#6a35f5" />
        <stop offset="1" stopColor="#3a1f85" />
      </linearGradient>
    </defs>
    <rect width="512" height="512" rx="112" fill="url(#tp-bg)" />
    <circle cx="262" cy="232" r="158" fill="#fff" />
    <path d="M226 160v144l124-72z" fill="url(#tp-play)" stroke="url(#tp-play)" strokeWidth="26" strokeLinejoin="round" />
    <circle cx="146" cy="404" r="30" fill="#2ee6a6" />
    <circle cx="98" cy="452" r="16" fill="#2ee6a6" />
  </svg>
);

interface LogoProps {
  size?: number;
  /** "dark": para fundos escuros (texto branco). "light": para fundos claros. */
  tone?: 'dark' | 'light';
  className?: string;
  /** Em telas bem estreitas (< 420 px) mostra só o símbolo, para não apertar o menu. */
  symbolOnlyOnTiny?: boolean;
}

const Logo: React.FC<LogoProps> = ({ size = 32, tone = 'dark', className = '', symbolOnlyOnTiny = false }) => (
  <span className={`inline-flex items-center gap-2.5 ${className}`}>
    <LogoMark size={size} />
    <span
      className={`font-display font-extrabold tracking-tight leading-none ${symbolOnlyOnTiny ? 'max-[420px]:hidden' : ''} ${tone === 'dark' ? 'text-white' : 'text-ink-900'}`}
      style={{ fontSize: size * 0.72 }}
    >
      Thinkr<span className={tone === 'dark' ? 'text-mint-400' : 'text-brand-600'}>play</span>
    </span>
  </span>
);

export default Logo;
