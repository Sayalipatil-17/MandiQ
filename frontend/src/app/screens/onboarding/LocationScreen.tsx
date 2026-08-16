import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';

const STATES = ['Uttar Pradesh','Rajasthan','Madhya Pradesh','Maharashtra','Punjab','Haryana','Delhi','Bihar','Gujarat','Karnataka'];

export function LocationScreen() {
  const navigate = useNavigate();
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto px-6 pt-16">
      <button onClick={() => navigate(-1)} className="mb-6"><ArrowLeft className="w-6 h-6 text-[#2d6a3e]" /></button>
      <p className="text-xs text-gray-400 mb-6">Step 3/4</p>
      <h2 className="text-2xl font-bold text-[#1b4228] mb-2">आप कहाँ से हैं?</h2>
      <p className="text-gray-500 mb-8">अपना राज्य और जिला चुनें</p>

      <div className="space-y-4 mb-6">
        <select value={state} onChange={e => setState(e.target.value)}
          className="w-full px-4 h-14 rounded-2xl bg-gray-50 border-2 border-gray-100 focus:border-[#2d6a3e] outline-none text-base">
          <option value="">राज्य चुनें</option>
          {STATES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="text" placeholder="जिला लिखें" value={district}
          onChange={e => setDistrict(e.target.value)}
          className="w-full px-4 h-14 rounded-2xl bg-gray-50 border-2 border-gray-100 focus:border-[#2d6a3e] outline-none text-base" />
      </div>

      <button onClick={() => { localStorage.setItem('ob_state', state); localStorage.setItem('ob_district', district); navigate('/onboarding/crops'); }}
        disabled={!state || !district}
        className={`w-full h-14 rounded-2xl font-semibold text-white ${state&&district?'bg-[#2d6a3e]':'bg-gray-200 cursor-not-allowed'}`}>
        आगे बढ़ें →
      </button>
    </div>
  );
}