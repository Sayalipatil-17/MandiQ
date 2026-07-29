import { useNavigate } from 'react-router';

export function UserTypeScreen() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-white max-w-md mx-auto px-6 pt-16">
      <p className="text-xs text-gray-400 mb-6">Step 1/4</p>
      <h2 className="text-2xl font-bold text-[#1b4228] mb-2">आप कौन हैं?</h2>
      <p className="text-gray-500 mb-8">अपनी भूमिका चुनें</p>
      <div className="space-y-4">
        {[{id:'farmer',label:'किसान',emoji:'🌾',desc:'मैं फसल उगाता हूँ'},
          {id:'trader',label:'व्यापारी',emoji:'🏪',desc:'मैं फसल खरीदता/बेचता हूँ'}].map(r => (
          <button key={r.id} onClick={() => { localStorage.setItem('ob_user_type', r.id); navigate('/onboarding/name'); }}
            className="w-full p-5 rounded-2xl border-2 border-gray-100 hover:border-[#2d6a3e] bg-white flex items-center gap-4 transition-all">
            <div className="w-14 h-14 bg-[#e8f5e9] rounded-2xl flex items-center justify-center text-3xl">{r.emoji}</div>
            <div className="text-left">
              <p className="font-bold text-lg text-gray-800">{r.label}</p>
              <p className="text-sm text-gray-400">{r.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}