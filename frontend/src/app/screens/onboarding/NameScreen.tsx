import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';

export function NameScreen() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  return (
    <div className="min-h-screen bg-white max-w-md mx-auto px-6 pt-16">
      <button onClick={() => navigate(-1)} className="mb-6"><ArrowLeft className="w-6 h-6 text-[#2d6a3e]" /></button>
      <p className="text-xs text-gray-400 mb-6">Step 2/4</p>
      <h2 className="text-2xl font-bold text-[#1b4228] mb-2">आपका नाम क्या है?</h2>
      <p className="text-gray-500 mb-8">अपना नाम लिखें</p>
      <input type="text" placeholder="जैसे: रमेश कुमार" value={name}
        onChange={e => setName(e.target.value)}
        className="w-full px-4 h-14 rounded-2xl bg-gray-50 border-2 border-gray-100 focus:border-[#2d6a3e] outline-none text-lg mb-6" />
      <button onClick={() => { localStorage.setItem('ob_name', name); navigate('/onboarding/location'); }}
        disabled={name.trim().length < 2}
        className={`w-full h-14 rounded-2xl font-semibold text-white ${name.trim().length>=2?'bg-[#2d6a3e]':'bg-gray-200 cursor-not-allowed'}`}>
        आगे बढ़ें →
      </button>
    </div>
  );
}