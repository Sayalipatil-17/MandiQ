import { useEffect, useState } from 'react';

interface Spark {
  id: number;
  side: 'left' | 'right';
  x: number;       // % from that side
  y: number;       // % from top
  angle: number;   // degrees — direction the spark flies
  dist: number;    // how far it travels (px)
  color: string;
  size: number;
  dur: number;     // animation duration ms
  delay: number;
}

const COLORS = [
  '#f97316', '#facc15', '#4ade80', '#38bdf8',
  '#f472b6', '#a78bfa', '#fb923c', '#fde68a',
  '#86efac', '#67e8f9',
];

function makeSparks(count: number): Spark[] {
  return Array.from({ length: count }, (_, i) => {
    const side = i % 2 === 0 ? 'left' : 'right';
    return {
      id: i,
      side,
      x: Math.random() * 18,          // 0-18% from edge
      y: 15 + Math.random() * 55,     // 15-70% from top
      angle: side === 'left'
        ? -60 + Math.random() * 120   // left side: fans rightward  (−60° to +60°)
        : 120 + Math.random() * 120,  // right side: fans leftward  (120° to 240°)
      dist: 80 + Math.random() * 140,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 4 + Math.random() * 5,
      dur: 600 + Math.random() * 500,
      delay: Math.random() * 300,
    };
  });
}

export function Fireworks({ show }: { show: boolean }) {
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!show) return;

    // First burst
    setSparks(makeSparks(40));
    setVisible(true);

    // Second burst after 400 ms for layered cracker feel
    const t2 = setTimeout(() => setSparks(makeSparks(32)), 400);

    // Hide after all animations done
    const t3 = setTimeout(() => {
      setVisible(false);
      setSparks([]);
    }, 1600);

    return () => { clearTimeout(t2); clearTimeout(t3); };
  }, [show]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
      aria-hidden
    >
      {sparks.map(s => {
        const rad = (s.angle * Math.PI) / 180;
        const tx = Math.cos(rad) * s.dist;
        const ty = Math.sin(rad) * s.dist;

        return (
          <span
            key={s.id}
            style={{
              position: 'absolute',
              [s.side]: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size,
              height: s.size,
              borderRadius: '50%',
              background: s.color,
              boxShadow: `0 0 ${s.size * 1.5}px ${s.color}`,
              animation: `spark-fly ${s.dur}ms ease-out ${s.delay}ms both`,
              // CSS custom props for keyframe target
              ['--tx' as any]: `${tx}px`,
              ['--ty' as any]: `${ty}px`,
            }}
          />
        );
      })}

      {/* Keyframes injected inline so no extra CSS file needed */}
      <style>{`
        @keyframes spark-fly {
          0%   { transform: translate(0,0) scale(1); opacity: 1; }
          60%  { opacity: 0.85; }
          100% { transform: translate(var(--tx), var(--ty)) scale(0.2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
