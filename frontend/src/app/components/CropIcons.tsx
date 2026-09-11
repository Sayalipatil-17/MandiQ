/**
 * Realistic crop illustrations — flat 2D shapes ki jagah gradient, specular
 * highlight aur contact shadow wale SVG, taaki asli sabzi jaisa feel aaye.
 *
 * Photo (assets/*.jpg) jaan bujh ke use nahi kiye: har ek 500-700 KB ka hai,
 * unka apna background hota hai, aur chhote size pe dhundhle dikhte hain.
 * Vector har size pe crisp rehta hai aur kuch KB ka hai.
 *
 * Har icon 24x24 viewBox me hai, size className se aata hai (w-8 h-8 etc).
 * Gradient id har icon ka alag hai — ek hi page pe kai icons hon to SVG ids
 * takra jate hain aur galat gradient lag jata hai.
 */

function TomatoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Roshni upar-baayein se — wahin sabse halka rang */}
        <radialGradient id="tomBody" cx="35%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#FF8A6B" />
          <stop offset="38%" stopColor="#F5462F" />
          <stop offset="78%" stopColor="#D01B12" />
          <stop offset="100%" stopColor="#980E0A" />
        </radialGradient>
        <radialGradient id="tomGloss" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="tomLeaf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6FC44A" />
          <stop offset="100%" stopColor="#2E7D2B" />
        </linearGradient>
      </defs>

      {/* Zameen pe padti chhaya — isi se icon "rakha hua" lagta hai */}
      <ellipse cx="12" cy="21.4" rx="6.6" ry="1.15" fill="#000000" opacity="0.16" />

      {/* Body — neeche thoda chaura, asli tamatar jaisa */}
      <path
        d="M12 4.9c4.9 0 8.3 3.5 8.3 8.1 0 4.6-3.6 8-8.3 8s-8.3-3.4-8.3-8c0-4.6 3.4-8.1 8.3-8.1Z"
        fill="url(#tomBody)"
      />
      {/* Lobe ki halki daraarein */}
      <path d="M8.6 6.6c-1.5 2.2-2 4.8-1.4 7.4" stroke="#B01410" strokeWidth="0.55" opacity="0.3" strokeLinecap="round" />
      <path d="M15.4 6.6c1.5 2.2 2 4.8 1.4 7.4" stroke="#B01410" strokeWidth="0.55" opacity="0.3" strokeLinecap="round" />
      {/* Neeche halki bounce light */}
      <path d="M6.3 16.6c1.5 1.9 3.5 2.9 5.7 2.9s4.2-1 5.7-2.9" stroke="#FF6B4D" strokeWidth="0.7" opacity="0.28" strokeLinecap="round" />

      {/* Chamak */}
      <ellipse cx="9.1" cy="9.2" rx="2.5" ry="1.9" transform="rotate(-32 9.1 9.2)" fill="url(#tomGloss)" />
      <ellipse cx="15.2" cy="16.4" rx="1.5" ry="0.8" transform="rotate(-25 15.2 16.4)" fill="#FFFFFF" opacity="0.2" />

      {/* Calyx — 5 patti */}
      <path
        d="M12 6.4 9.3 3.9c-.35-.33-.1-.9.37-.85l2.1.22-.9-2.1c-.18-.43.3-.83.68-.56l1.9 1.36.55-1.5c.16-.44.79-.42.91.03l.5 1.85 1.8-.9c.43-.2.87.28.63.68l-1.1 1.9 2-.1c.47-.03.68.57.31.85L12 6.4Z"
        fill="url(#tomLeaf)"
        transform="translate(0 1.6) scale(1 0.95)"
      />
      <circle cx="12" cy="5.6" r="1.05" fill="#3E8F2E" />
      <path d="M12 5.4V3.1" stroke="#4C7A22" strokeWidth="1.15" strokeLinecap="round" />
    </svg>
  );
}

function PotatoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="potBody" cx="34%" cy="26%" r="80%">
          <stop offset="0%" stopColor="#E8C48E" />
          <stop offset="45%" stopColor="#CE9C5C" />
          <stop offset="82%" stopColor="#A5713C" />
          <stop offset="100%" stopColor="#7A4F26" />
        </radialGradient>
        <radialGradient id="potGloss" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFF4DF" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#FFF4DF" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="12" cy="20.6" rx="7" ry="1.2" fill="#000000" opacity="0.16" />

      {/* Behatareen aloo bhi tedha-medha hota hai — perfect ellipse nakli lagti */}
      <path
        d="M4.6 12.9c-.7-3.4 1.5-6.6 4.7-7.9 1.9-.8 3-2 5-2.1 3.3-.2 6.9 1.9 7.4 5.4.35 2.4-.55 3.5-.15 5.7.45 2.5-.5 5-3 6.2-2.6 1.25-5.9 1.3-8.6.25C7 19.4 5.2 16.7 4.6 12.9Z"
        fill="url(#potBody)"
      />

      {/* Chamak */}
      <ellipse cx="9.5" cy="8.4" rx="3.2" ry="2" transform="rotate(-28 9.5 8.4)" fill="url(#potGloss)" />

      {/* Aankhein — har ek me upar chhota highlight aur neeche gehra gaddha */}
      <g opacity="0.9">
        <ellipse cx="9.1" cy="13.1" rx="1.15" ry="0.8" transform="rotate(-20 9.1 13.1)" fill="#6E441F" opacity="0.8" />
        <ellipse cx="9.0" cy="12.8" rx="0.9" ry="0.5" transform="rotate(-20 9 12.8)" fill="#D9AE76" opacity="0.55" />
        <ellipse cx="15.1" cy="10.2" rx="1" ry="0.68" transform="rotate(15 15.1 10.2)" fill="#6E441F" opacity="0.75" />
        <ellipse cx="15.0" cy="9.95" rx="0.75" ry="0.42" transform="rotate(15 15 9.95)" fill="#D9AE76" opacity="0.5" />
        <ellipse cx="13.4" cy="16.2" rx="0.95" ry="0.62" transform="rotate(-8 13.4 16.2)" fill="#6E441F" opacity="0.75" />
        <ellipse cx="13.3" cy="15.98" rx="0.7" ry="0.38" fill="#D9AE76" opacity="0.5" />
        <ellipse cx="17.2" cy="14.4" rx="0.7" ry="0.48" transform="rotate(30 17.2 14.4)" fill="#6E441F" opacity="0.6" />
      </g>

      {/* Chhilke ki halki rekhaayein */}
      <path d="M7.2 10.2c1.6-1.6 3.4-2.5 5.4-2.7" stroke="#EBCFA3" strokeWidth="0.5" opacity="0.45" strokeLinecap="round" />
      <path d="M18.8 12.6c.3 1.9-.1 3.6-1.2 4.9" stroke="#7A4F26" strokeWidth="0.5" opacity="0.35" strokeLinecap="round" />
    </svg>
  );
}

function OnionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="onBody" cx="36%" cy="30%" r="76%">
          <stop offset="0%" stopColor="#E9A7D2" />
          <stop offset="40%" stopColor="#C5559E" />
          <stop offset="80%" stopColor="#8E2E72" />
          <stop offset="100%" stopColor="#5E1A4C" />
        </radialGradient>
        <radialGradient id="onGloss" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="onShoot" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#3E8F2E" />
          <stop offset="100%" stopColor="#8CCB5E" />
        </linearGradient>
      </defs>

      <ellipse cx="12" cy="21.3" rx="6" ry="1.1" fill="#000000" opacity="0.16" />

      {/* Bulb — asli pyaz gol-mataal hota hai, upar sirf chhoti si gardan */}
      <path
        d="M12 5.3c.9 1.3 7 2.9 7 8.1 0 4.1-3.1 6.9-7 6.9s-7-2.8-7-6.9c0-5.2 6.1-6.8 7-8.1Z"
        fill="url(#onBody)"
      />

      {/* Papery chhilke ki dhaariyaan — inhi se pyaz pehchana jata hai */}
      <g opacity="0.5" strokeLinecap="round" fill="none">
        <path d="M11 6.4C9.1 8.9 7.7 11.3 7.8 14.3c.1 2.1.9 3.8 2 5" stroke="#F3C7E4" strokeWidth="0.55" />
        <path d="M13 6.4c1.9 2.5 3.3 4.9 3.2 7.9-.1 2.1-.9 3.8-2 5" stroke="#F3C7E4" strokeWidth="0.55" />
        <path d="M12 5.9v14.3" stroke="#F8DDF0" strokeWidth="0.5" opacity="0.7" />
        <path d="M8.7 8.5c-1.5 2.1-2.2 4.1-2.1 6.3" stroke="#5E1A4C" strokeWidth="0.5" opacity="0.55" />
        <path d="M15.3 8.5c1.5 2.1 2.2 4.1 2.1 6.3" stroke="#5E1A4C" strokeWidth="0.5" opacity="0.55" />
      </g>

      {/* Chamak */}
      <ellipse cx="9.1" cy="11.2" rx="2.1" ry="2.7" transform="rotate(-20 9.1 11.2)" fill="url(#onGloss)" />

      {/* Sookhi jadein */}
      <g stroke="#C9A48E" strokeWidth="0.45" strokeLinecap="round" opacity="0.75">
        <path d="M12 20.2v1.3" />
        <path d="M11 20.1l-.7 1.2" />
        <path d="M13 20.1l.7 1.2" />
      </g>

      {/* Hara ankur */}
      <path d="M12 5.6c-.9-1.1-1-2.3-.5-3.4.9.5 1.4 1.3 1.5 2.2.6-.8 1.4-1.2 2.3-1.2-.2 1.3-1.2 2.2-2.6 2.6" fill="url(#onShoot)" />
    </svg>
  );
}

function SpinachIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="spLeafBack" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#4FA83C" />
          <stop offset="100%" stopColor="#1E5F23" />
        </linearGradient>
        <linearGradient id="spLeafMain" x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#7CCB4F" />
          <stop offset="55%" stopColor="#3E9433" />
          <stop offset="100%" stopColor="#23662A" />
        </linearGradient>
      </defs>

      <ellipse cx="12" cy="21.3" rx="5.6" ry="1.05" fill="#000000" opacity="0.15" />

      {/* Peechhe ki do patti — depth ke liye gehri */}
      <path d="M11.4 19.6C7.2 18.4 4.4 14.9 4.7 10.2c4.1.5 6.9 3.1 7.6 6.6Z" fill="url(#spLeafBack)" />
      <path d="M12.6 19.6c4.2-1.2 7-4.7 6.7-9.4-4.1.5-6.9 3.1-7.6 6.6Z" fill="url(#spLeafBack)" />

      {/* Saamne ki mukhya patti */}
      <path d="M12 20.4c-3.5-4.3-3.4-9.9 0-14.4 3.4 4.5 3.5 10.1 0 14.4Z" fill="url(#spLeafMain)" />

      {/* Nasein */}
      <path d="M12 6.6v13.2" stroke="#1B5220" strokeWidth="0.6" strokeLinecap="round" opacity="0.7" />
      <g stroke="#1B5220" strokeWidth="0.42" strokeLinecap="round" opacity="0.45">
        <path d="M12 9.6 10.1 8.4M12 9.6l1.9-1.2" />
        <path d="M12 12.8l-2.4-1.5M12 12.8l2.4-1.5" />
        <path d="M12 16l-2.2-1.4M12 16l2.2-1.4" />
      </g>
      {/* Patti pe halki chamak */}
      <path d="M11.3 8.6c-.9 2.3-1 4.7-.3 7.1" stroke="#A9E07C" strokeWidth="0.5" strokeLinecap="round" opacity="0.5" fill="none" />

      {/* Danthal */}
      <path d="M12 20.2v1.2" stroke="#2E7D2B" strokeWidth="1.1" strokeLinecap="round" />
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
    // Jis crop ka illustration nahi bana — generic patta.
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="genLeaf" x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor="#7CCB4F" />
            <stop offset="100%" stopColor="#23662A" />
          </linearGradient>
        </defs>
        <path d="M5 19c-1-6 2-12 14-14 1 10-4 15-14 14Z" fill="url(#genLeaf)" />
        <path d="M5.6 18.4C8.5 13.9 12.4 10 17.3 7.3" stroke="#1B5220" strokeWidth="0.55" strokeLinecap="round" opacity="0.45" />
      </svg>
    );
  }
  return <Icon className={className} />;
}

/** Mandi/market stall icon — har mandi ke liye alag accent color. */
export function MandiIcon({ mandi, className = "w-6 h-6" }: { mandi: string; className?: string }) {
  const lower = mandi.toLowerCase();
  const roof = lower.includes("azadpur") ? "#1F8A4C"
    : lower.includes("keshopur") ? "#FF7A29"
    : lower.includes("prayagraj") ? "#7B3FC4"
    : "#2d6a3e";
  const roofLight = lower.includes("azadpur") ? "#4CC46A"
    : lower.includes("keshopur") ? "#FFA85C"
    : lower.includes("prayagraj") ? "#B07DE0"
    : "#4CC46A";
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
