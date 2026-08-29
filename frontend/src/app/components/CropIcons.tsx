/**
 * Custom flat 2D illustrations — crop/mandi emoji (🍅🥔🧅🌿🏪🏬) ki jagah
 * consistent, brand-colored SVG icons. Har icon ek 24x24 viewBox me hai
 * taaki text-xl/text-2xl/text-5xl jaisi purani emoji sizing ki jagah
 * className se width/height set kiya ja sake.
 */

function TomatoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="14" r="8.5" fill="#FF4136" />
      <path d="M12 14a8.5 8.5 0 0 1 6.9-8.36A8.5 8.5 0 0 0 12 5.5a8.5 8.5 0 0 0-6.9.14A8.5 8.5 0 0 1 12 14Z" fill="#FF7A6E" opacity="0.65" />
      <ellipse cx="9" cy="10.5" rx="1.6" ry="1" fill="#FFB3AA" opacity="0.8" />
      <path d="M12 6.5c-1.3-1.7-3.2-2.6-4.6-1.9.6 1.4 2.1 2.5 3.8 2.8M12 6.5c1.3-1.7 3.2-2.6 4.6-1.9-.6 1.4-2.1 2.5-3.8 2.8" stroke="#2FA84F" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 4.8V7" stroke="#2FA84F" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function PotatoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4.5 13.5c-.5-3 1.4-6.2 4.4-7.4 1.7-.7 2.6-2.1 4.4-2.2 2.9-.2 6.2 1.6 6.9 4.9.4 2.2-.4 3.3 0 5.3.4 2.2-.2 4.6-2.4 5.8-2.2 1.2-5.1 1.3-7.5.4-2.6-.9-5.3-3.4-5.8-6.8Z" fill="#E3A65C" />
      <path d="M8 8.5c1.5-1.8 3.4-2.8 5.5-2.9" stroke="#F0C185" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
      <ellipse cx="9" cy="12.8" rx="1.15" ry="0.8" fill="#9C6B3E" opacity="0.75" />
      <ellipse cx="15" cy="10.3" rx="1" ry="0.7" fill="#9C6B3E" opacity="0.75" />
      <ellipse cx="13.3" cy="16" rx="1" ry="0.7" fill="#9C6B3E" opacity="0.75" />
    </svg>
  );
}

function OnionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 4.5c3.9 0 6.5 3.9 6.5 8.8 0 3.9-2.9 6.7-6.5 6.7s-6.5-2.8-6.5-6.7c0-4.9 2.6-8.8 6.5-8.8Z" fill="#D6559A" />
      <path d="M12 4.5c2.6 0 4.6 2.4 5.3 5.5-1.7.6-3.6.9-5.3.9s-3.6-.3-5.3-.9C7.4 6.9 9.4 4.5 12 4.5Z" fill="#F0A3CC" opacity="0.8" />
      <ellipse cx="9.7" cy="8.3" rx="1.3" ry="0.8" fill="#FBD1E8" opacity="0.7" />
      <path d="M12 2c-1 .55-1.5 1.3-1.5 2.15S11 5.5 12 5.5s1-1.8 1.5-2.35S13 2 12 2Z" fill="#2FA84F" />
    </svg>
  );
}

function SpinachIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 21.5c-3.2-4.3-3-9.5 0-13.8 3 4.3 3.2 9.5 0 13.8Z" fill="#2FA84F" />
      <path d="M12 19.3c-4.3-1.6-6.8-5.3-6.4-9.9 4 .6 6.8 3.2 7.4 6.7" fill="#4CC46A" />
      <path d="M12 19.3c4.3-1.6 6.8-5.3 6.4-9.9-4 .6-6.8 3.2-7.4 6.7" fill="#3DB85C" />
      <path d="M12 7.5v14" stroke="#1F7A38" strokeWidth="1" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

const CROP_ICON_MAP: Record<string, (props: { className?: string }) => JSX.Element> = {
  Tomato: TomatoIcon,
  Potato: PotatoIcon,
  Onion: OnionIcon,
  Spinach: SpinachIcon,
};

export function CropIcon({ crop, className = "w-6 h-6" }: { crop: string; className?: string }) {
  const Icon = CROP_ICON_MAP[crop];
  if (!Icon) {
    // Crop jiska custom illustration nahi bana (abhi sirf 4 supported crops hain) — generic leaf.
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 19c-1-6 2-12 14-14 1 10-4 15-14 14Z" fill="#4CC46A" />
      </svg>
    );
  }
  return <Icon className={className} />;
}

/** Mandi/market stall icon — Azadpur aur Keshopur ko alag accent color se distinguish karta hai. */
export function MandiIcon({ mandi, className = "w-6 h-6" }: { mandi: string; className?: string }) {
  const isAzadpur = mandi.toLowerCase().includes("azadpur");
  const roof = isAzadpur ? "#1F8A4C" : "#FF7A29";
  const roofLight = isAzadpur ? "#4CC46A" : "#FFA85C";
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 9.5 12 4l9 5.5v1.2H3V9.5Z" fill={roof} />
      <rect x="4" y="10.7" width="16" height="8.3" rx="1" fill="#FFF7EC" />
      <rect x="6" y="12.2" width="3.4" height="3.4" fill={roofLight} />
      <rect x="14.6" y="12.2" width="3.4" height="3.4" fill={roofLight} />
      <rect x="10.4" y="14" width="3.2" height="5" fill={roof} />
    </svg>
  );
}
