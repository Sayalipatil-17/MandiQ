import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Mic, MicOff, Send, Volume2, VolumeX, Mail } from 'lucide-react';
import { useT, type Lang } from '../../i18n';

interface Suggestion {
  label: string;
  qaIndex: number;
}

interface Message {
  from: 'user' | 'bot';
  text: string;
  showEmail?: boolean;
  suggestions?: Suggestion[];
}

type ML = Record<Lang, string>;

interface QAEntry {
  keywords: string[];
  question: ML;
  answer: ML;
}

const QA: QAEntry[] = [
  {
    keywords: ['free', 'muft', 'payment', 'charge', 'cost', 'fees', 'paisa', 'paise', 'मुफ्त', 'ਮੁਫ਼ਤ', 'मोफत'],
    question: { en: 'Is the app free?', hi: 'क्या ऐप मुफ़्त है?', pa: 'ਕੀ ਐਪ ਮੁਫ਼ਤ ਹੈ?', mr: 'ॲप मोफत आहे का?' },
    answer: {
      en: 'MandiQ is completely free! No charges for any feature — price check, prediction, alerts, all free.',
      hi: 'मंडीक्यू बिल्कुल मुफ़्त है! किसी भी फीचर का कोई शुल्क नहीं — कीमत देखना, पूर्वानुमान, अलर्ट, सब मुफ़्त।',
      pa: 'ਮੰਡੀਕਿਊ ਬਿਲਕੁਲ ਮੁਫ਼ਤ ਹੈ! ਕਿਸੇ ਵੀ ਫੀਚਰ ਲਈ ਕੋਈ ਖਰਚਾ ਨਹੀਂ — ਭਾਅ ਜਾਂਚ, ਭਵਿੱਖਬਾਣੀ, ਅਲਰਟ, ਸਭ ਮੁਫ਼ਤ।',
      mr: 'मंडीक्यू पूर्णपणे मोफत आहे! कोणत्याही वैशिष्ट्यासाठी शुल्क नाही — किंमत तपासणी, अंदाज, सूचना, सर्व मोफत.',
    },
  },
  {
    keywords: ['mandiq', 'kya hai', 'what is', 'क्या है', 'ਕੀ ਹੈ', 'ke baare', 'about', 'काय आहे'],
    question: { en: 'What is MandiQ?', hi: 'मंडीक्यू क्या है?', pa: 'ਮੰਡੀਕਿਊ ਕੀ ਹੈ?', mr: 'मंडीक्यू काय आहे?' },
    answer: {
      en: 'MandiQ is an AI-powered mandi price app that helps farmers know the right price and best mandi to sell crops. It includes price prediction, mandi comparison and alerts.',
      hi: 'मंडीक्यू एक एआई-संचालित मंडी मूल्य ऐप है जो किसानों को सही कीमत और फसल बेचने की सबसे अच्छी मंडी बताता है। इसमें मूल्य पूर्वानुमान, मंडी तुलना और अलर्ट मिलते हैं।',
      pa: 'ਮੰਡੀਕਿਊ ਇੱਕ ਏਆਈ-ਆਧਾਰਿਤ ਮੰਡੀ ਭਾਅ ਐਪ ਹੈ ਜੋ ਕਿਸਾਨਾਂ ਨੂੰ ਸਹੀ ਭਾਅ ਅਤੇ ਫਸਲ ਵੇਚਣ ਦੀ ਸਭ ਤੋਂ ਵਧੀਆ ਮੰਡੀ ਦੱਸਦਾ ਹੈ।',
      mr: 'मंडीक्यू हे एक AI-आधारित मंडी किंमत ॲप आहे जे शेतकऱ्यांना योग्य किंमत आणि पीक विकण्यासाठी सर्वोत्तम मंडी सांगते.',
    },
  },
  {
    keywords: ['price', 'kimat', 'bhav', 'दाम', 'किमत', 'kaise dekhe', 'check', 'किंमत', 'ਭਾਅ'],
    question: { en: 'How to check price?', hi: 'कीमत कैसे देखें?', pa: 'ਭਾਅ ਕਿਵੇਂ ਦੇਖੀਏ?', mr: 'किंमत कशी पाहावी?' },
    answer: {
      en: "To check price: On the Home screen, select a Mandi, then select a Crop, and tap \"Check Price\". Today's live price and 7-day forecast will appear.",
      hi: 'कीमत देखने के लिए: होम स्क्रीन पर मंडी चुनें, फसल चुनें, और "कीमत देखें" दबाएं। आज की लाइव कीमत और 7 दिन का पूर्वानुमान दिखेगा।',
      pa: 'ਭਾਅ ਦੇਖਣ ਲਈ: ਹੋਮ ਸਕਰੀਨ ਤੇ ਮੰਡੀ ਚੁਣੋ, ਫਸਲ ਚੁਣੋ, ਅਤੇ "ਭਾਅ ਦੇਖੋ" ਦਬਾਓ।',
      mr: 'किंमत पाहण्यासाठी: होम स्क्रीनवर मंडी निवडा, पीक निवडा, आणि "किंमत पाहा" दाबा.',
    },
  },
  {
    keywords: ['mandi', 'market', 'मंडी', 'ਮੰਡੀ', 'select', 'chunein', 'choose', 'मंडी निवडा'],
    question: { en: 'Which mandis are available?', hi: 'कौन सी मंडियाँ हैं?', pa: 'ਕਿਹੜੀਆਂ ਮੰਡੀਆਂ ਹਨ?', mr: 'कोणत्या मंड्या आहेत?' },
    answer: {
      en: 'Currently MandiQ has 3 mandis: Azadpur APMC, Keshopur APMC and Shahdara APMC. Select from the dropdown on the Home screen.',
      hi: 'अभी मंडीक्यू में दिल्ली की 3 मंडियाँ हैं: अजादपुर APMC, केशोपुर APMC और शाहदरा APMC। होम स्क्रीन पर "मंडी चुनें" से चुनें।',
      pa: 'ਹੁਣ ਮੰਡੀਕਿਊ ਵਿੱਚ ਦਿੱਲੀ ਦੀਆਂ 3 ਮੰਡੀਆਂ ਹਨ: ਅਜ਼ਾਦਪੁਰ APMC, ਕੇਸ਼ੋਪੁਰ APMC ਅਤੇ ਸ਼ਾਹਦਰਾ APMC।',
      mr: 'सध्या मंडीक्यू मध्ये दिल्लीच्या 3 मंड्या आहेत: अझादपूर APMC, केशोपूर APMC आणि शाहदरा APMC.',
    },
  },
  {
    keywords: ['fasal', 'crop', 'फसल', 'ਫਸਲ', 'sabzi', 'vegetable', 'पीक'],
    question: { en: 'Which crops are supported?', hi: 'कौन सी फसलें हैं?', pa: 'ਕਿਹੜੀਆਂ ਫਸਲਾਂ ਹਨ?', mr: 'कोणती पिके आहेत?' },
    answer: {
      en: 'MandiQ has 4 crops: Tomato 🍅, Potato 🥔, Onion 🧅, and Spinach 🌿. Tap the crop icon on the Home screen to select.',
      hi: 'मंडीक्यू में 4 फसलें हैं: टमाटर 🍅, आलू 🥔, प्याज 🧅, और पालक 🌿। होम स्क्रीन पर फसल के आइकन पर टैप करें।',
      pa: 'ਮੰਡੀਕਿਊ ਵਿੱਚ 4 ਫਸਲਾਂ ਹਨ: ਟਮਾਟਰ 🍅, ਆਲੂ 🥔, ਪਿਆਜ਼ 🧅, ਅਤੇ ਪਾਲਕ 🌿।',
      mr: 'मंडीक्यू मध्ये 4 पिके आहेत: टोमॅटो 🍅, बटाटा 🥔, कांदा 🧅, आणि पालक 🌿.',
    },
  },
  {
    keywords: ['prediction', 'forecast', 'भविष्य', 'ਭਵਿੱਖ', 'future', 'aage', 'agle', 'पूर्वानुमान', 'अंदाज'],
    question: { en: 'How does Prediction work?', hi: 'पूर्वानुमान कैसे काम करता है?', pa: 'ਭਵਿੱਖਬਾਣੀ ਕਿਵੇਂ ਕੰਮ ਕਰਦੀ ਹੈ?', mr: 'अंदाज कसा काम करतो?' },
    answer: {
      en: "MandiQ's AI model predicts prices for the next 7 days. Labels showing \"~est.\" indicate estimated values. See full details on the Prediction screen.",
      hi: 'मंडीक्यू का एआई मॉडल अगले 7 दिनों की कीमत का अनुमान लगाता है। "~अनु." लेबल अनुमानित कीमत दर्शाता है। पूर्वानुमान स्क्रीन पर पूरी जानकारी देखें।',
      pa: 'ਮੰਡੀਕਿਊ ਦਾ ਏਆਈ ਮਾਡਲ ਅਗਲੇ 7 ਦਿਨਾਂ ਦੇ ਭਾਅ ਦਾ ਅਨੁਮਾਨ ਲਗਾਉਂਦਾ ਹੈ।',
      mr: 'मंडीक्यू चे एआय मॉडेल पुढील 7 दिवसांच्या किंमतीचा अंदाज लावते.',
    },
  },
  {
    keywords: ['alert', 'notification', 'अलर्ट', 'ਅਲਰਟ', 'suchna', 'price set', 'सूचना'],
    question: { en: 'How to set a price alert?', hi: 'अलर्ट कैसे सेट करें?', pa: 'ਅਲਰਟ ਕਿਵੇਂ ਸੈੱਟ ਕਰੀਏ?', mr: 'सूचना कशी सेट करावी?' },
    answer: {
      en: 'Go to the Alerts screen (bottom nav). Set your target price — when the market price reaches that level you will get a notification.',
      hi: 'अलर्ट स्क्रीन पर जाएं (नीचे दिए गए नेविगेशन बार से)। अपनी लक्ष्य कीमत सेट करें — जब कीमत उस स्तर पर पहुँचे तब आपको सूचना मिलेगी।',
      pa: 'ਅਲਰਟ ਸਕਰੀਨ ਤੇ ਜਾਓ। ਆਪਣਾ ਟੀਚਾ ਭਾਅ ਸੈੱਟ ਕਰੋ — ਜਦੋਂ ਮੰਡੀ ਭਾਅ ਉਸ ਪੱਧਰ ਤੇ ਪਹੁੰਚੇ ਤਾਂ ਸੂਚਨਾ ਮਿਲੇਗੀ।',
      mr: 'सूचना स्क्रीनवर जा. तुमची लक्ष्य किंमत सेट करा — किंमत त्या पातळीवर पोहोचल्यावर सूचना मिळेल.',
    },
  },
  {
    keywords: ['compare', 'tujna', 'तुलना', 'ਤੁਲਨਾ', 'best mandi', 'sabse acchi', 'comparison'],
    question: { en: 'How to compare mandis?', hi: 'मंडी तुलना कैसे करें?', pa: 'ਮੰਡੀ ਤੁਲਨਾ ਕਿਵੇਂ ਕਰੀਏ?', mr: 'मंडी तुलना कशी करावी?' },
    answer: {
      en: 'The Mandi Comparison on Home screen compares all mandis — after deducting transport cost it shows which mandi gives the best price.',
      hi: 'होम स्क्रीन पर मंडी तुलना सभी मंडियों की तुलना करती है — ट्रांसपोर्ट खर्च हटाकर बताती है कि कौन सी मंडी सबसे अच्छी है।',
      pa: 'ਹੋਮ ਸਕਰੀਨ ਤੇ ਮੰਡੀ ਤੁਲਨਾ ਸਾਰੀਆਂ ਮੰਡੀਆਂ ਦੀ ਤੁਲਨਾ ਕਰਦੀ ਹੈ — ਟ੍ਰਾਂਸਪੋਰਟ ਖਰਚ ਹਟਾ ਕੇ ਸਭ ਤੋਂ ਵਧੀਆ ਮੰਡੀ ਦੱਸਦੀ ਹੈ।',
      mr: 'होम स्क्रीनवरील मंडी तुलना सर्व मंड्यांची तुलना करते — वाहतूक खर्च वजा करून सर्वोत्तम मंडी सांगते.',
    },
  },
  {
    keywords: ['language', 'bhasha', 'भाषा', 'ਭਾਸ਼ਾ', 'hindi', 'punjabi', 'marathi', 'english', 'भाषा बदल'],
    question: { en: 'How to change language?', hi: 'भाषा कैसे बदलें?', pa: 'ਭਾਸ਼ਾ ਕਿਵੇਂ ਬਦਲੀਏ?', mr: 'भाषा कशी बदलावी?' },
    answer: {
      en: 'MandiQ is available in 4 languages: English, Hindi, Punjabi and Marathi. Change your language from the Profile screen.',
      hi: 'MandiQ 4 भाषाओं में उपलब्ध है: अंग्रेज़ी, हिंदी, पंजाबी और मराठी। प्रोफाइल स्क्रीन से अपनी भाषा बदलें।',
      pa: 'MandiQ 4 ਭਾਸ਼ਾਵਾਂ ਵਿੱਚ ਉਪਲਬਧ ਹੈ: ਅੰਗਰੇਜ਼ੀ, ਹਿੰਦੀ, ਪੰਜਾਬੀ ਅਤੇ ਮਰਾਠੀ।',
      mr: 'MandiQ 4 भाषांमध्ये उपलब्ध आहे: इंग्रजी, हिंदी, पंजाबी आणि मराठी.',
    },
  },
  {
    keywords: ['help', 'madad', 'मदद', 'ਮਦਦ', 'problem', 'issue', 'error', 'kaam nahi', 'मदत'],
    question: { en: 'App not working?', hi: 'ऐप काम नहीं कर रहा?', pa: 'ਐਪ ਕੰਮ ਨਹੀਂ ਕਰ ਰਿਹਾ?', mr: 'ॲप काम करत नाही?' },
    answer: {
      en: "If something isn't working, close and reopen the app. Check your internet connection. If the problem persists, contact us at the email below.",
      hi: 'कोई चीज़ काम न करे तो ऐप बंद करके दोबारा खोलें। इंटरनेट कनेक्शन चेक करें। समस्या बनी रहे तो नीचे दी ई-मेल पर संपर्क करें।',
      pa: 'ਕੋਈ ਚੀਜ਼ ਕੰਮ ਨਾ ਕਰੇ ਤਾਂ ਐਪ ਬੰਦ ਕਰਕੇ ਦੁਬਾਰਾ ਖੋਲੋ। ਇੰਟਰਨੈੱਟ ਕਨੈਕਸ਼ਨ ਜਾਂਚੋ।',
      mr: 'काही काम करत नसेल तर ॲप बंद करून पुन्हा उघडा. इंटरनेट तपासा.',
    },
  },
  {
    keywords: ['accuracy', 'sahi', 'kitna', 'percent', 'सटीक', 'accurate', 'ਸਟੀਕ', 'अचूक'],
    question: { en: 'How accurate is the prediction?', hi: 'पूर्वानुमान कितना सटीक है?', pa: 'ਭਵਿੱਖਬਾਣੀ ਕਿੰਨੀ ਸਟੀਕ ਹੈ?', mr: 'अंदाज किती अचूक आहे?' },
    answer: {
      en: "MandiQ's prediction accuracy is 70–90% depending on the crop and season. Weather, supply disruptions, and festivals can cause unexpected changes.",
      hi: 'MandiQ की पूर्वानुमान सटीकता फसल और मौसम के अनुसार 70–90% होती है। मौसम, आपूर्ति में रुकावट और त्योहार अप्रत्याशित बदलाव ला सकते हैं।',
      pa: 'MandiQ ਦੀ ਭਵਿੱਖਬਾਣੀ ਸਟੀਕਤਾ ਫਸਲ ਅਤੇ ਮੌਸਮ ਅਨੁਸਾਰ 70–90% ਹੈ।',
      mr: 'MandiQ च्या अंदाजाची अचूकता पीक आणि हंगामानुसार 70–90% आहे.',
    },
  },
  {
    keywords: ['best day', 'kab beche', 'sell', 'कब बेचें', 'ਕਦੋਂ ਵੇਚੀਏ', 'केव्हा विकावे'],
    question: { en: 'When is the best day to sell?', hi: 'बेचने का सबसे अच्छा दिन कब है?', pa: 'ਵੇਚਣ ਦਾ ਸਭ ਤੋਂ ਵਧੀਆ ਦਿਨ ਕਦੋਂ ਹੈ?', mr: 'विकण्याचा सर्वोत्तम दिवस कधी?' },
    answer: {
      en: "The Prediction screen highlights the best selling day in the 7-day forecast. Enable the Best Day Alert in the Alerts screen to get a notification automatically.",
      hi: 'पूर्वानुमान स्क्रीन 7 दिनों के अनुमान में सबसे अच्छे बिक्री दिन को हाइलाइट करती है। अलर्ट स्क्रीन में Best Day Alert चालू करें तो अपने आप सूचना मिलेगी।',
      pa: 'ਭਵਿੱਖਬਾਣੀ ਸਕਰੀਨ 7 ਦਿਨਾਂ ਵਿੱਚ ਸਭ ਤੋਂ ਵਧੀਆ ਵਿਕਰੀ ਦਿਨ ਨੂੰ ਹਾਈਲਾਈਟ ਕਰਦੀ ਹੈ।',
      mr: 'अंदाज स्क्रीन 7 दिवसांत सर्वोत्तम विक्री दिवस हायलाइट करते.',
    },
  },
  {
    keywords: ['data', 'agmarknet', 'source', 'kahan se', 'कहाँ से', 'ਕਿੱਥੋਂ', 'कुठून'],
    question: { en: 'Where does the price data come from?', hi: 'कीमत का डेटा कहाँ से आता है?', pa: 'ਭਾਅ ਡੇਟਾ ਕਿੱਥੋਂ ਆਉਂਦਾ ਹੈ?', mr: 'किंमत डेटा कुठून येतो?' },
    answer: {
      en: 'MandiQ uses live data from AGMARKNET — the official government mandi price portal. Prices are updated daily.',
      hi: 'MandiQ AGMARKNET — सरकारी मंडी प्राइस पोर्टल — का लाइव डेटा इस्तेमाल करता है। कीमतें रोज़ अपडेट होती हैं।',
      pa: 'MandiQ AGMARKNET — ਸਰਕਾਰੀ ਮੰਡੀ ਭਾਅ ਪੋਰਟਲ — ਦਾ ਲਾਈਵ ਡੇਟਾ ਵਰਤਦਾ ਹੈ।',
      mr: 'MandiQ AGMARKNET — सरकारी मंडी किंमत पोर्टल — चा थेट डेटा वापरतो.',
    },
  },
];

const SUPPORT_EMAIL = 'alphacoders111@gmail.com';

function findAnswer(query: string, lang: Lang): { answer: string; found: boolean; matchedIndex: number } {
  const q = query.toLowerCase();
  for (let i = 0; i < QA.length; i++) {
    if (QA[i].keywords.some(k => q.includes(k.toLowerCase()))) {
      return { answer: QA[i].answer[lang] || QA[i].answer.en, found: true, matchedIndex: i };
    }
  }
  return { answer: '', found: false, matchedIndex: -1 };
}

function getRelatedSuggestions(matchedIndex: number, lang: Lang): Suggestion[] {
  const others = QA
    .map((qa, i) => ({ label: qa.question[lang] || qa.question.en, qaIndex: i }))
    .filter(({ qaIndex }) => qaIndex !== matchedIndex);
  const shuffled = [...others].sort((a, b) =>
    ((a.qaIndex * 7 + matchedIndex * 3) % QA.length) - ((b.qaIndex * 7 + matchedIndex * 3) % QA.length)
  );
  return shuffled.slice(0, 5);
}

function getDefaultSuggestions(seed: number, lang: Lang): Suggestion[] {
  const all = QA.map((qa, i) => ({ label: qa.question[lang] || qa.question.en, qaIndex: i }));
  const shuffled = [...all].sort((a, b) => ((a.qaIndex * 11 + seed * 5) % QA.length) - ((b.qaIndex * 11 + seed * 5) % QA.length));
  return shuffled.slice(0, 5);
}

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

const SPEAK_LANG: Record<Lang, string> = { en: 'en-IN', hi: 'hi-IN', pa: 'pa-IN', mr: 'mr-IN' };

export function SupportChat() {
  const { t, lang } = useT();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const bottomRef    = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const noAnswerSeedRef = useRef(0);
  const speakLangRef = useRef(lang);

  // reset entire chat on language change
  useEffect(() => {
    stopSpeech();
    const initSuggestions: Suggestion[] = QA.slice(0, 5).map((qa, i) => ({
      label: qa.question[lang] || qa.question.en,
      qaIndex: i,
    }));
    setMessages([{ from: 'bot', text: t('support.greeting'), suggestions: initSuggestions }]);
  }, [lang]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function sendByIndex(label: string, qaIndex: number) {
    const userMsg: Message = { from: 'user', text: label };
    const answer = QA[qaIndex].answer[lang] || QA[qaIndex].answer.en;
    const botMsg: Message = {
      from: 'bot',
      text: answer,
      suggestions: getRelatedSuggestions(qaIndex, lang),
    };
    setMessages(prev => [...prev, userMsg, botMsg]);
    setInput('');
    if (voiceEnabled) speak(answer);
  }

  function send(text: string) {
    if (!text.trim()) return;
    const userMsg: Message = { from: 'user', text: text.trim() };
    const { answer, found, matchedIndex } = findAnswer(text, lang);

    let botMsg: Message;
    if (found) {
      botMsg = {
        from: 'bot',
        text: answer,
        suggestions: getRelatedSuggestions(matchedIndex, lang),
      };
      if (voiceEnabled) speak(answer);
    } else {
      noAnswerSeedRef.current += 1;
      botMsg = {
        from: 'bot',
        text: t('support.noAnswer'),
        showEmail: true,
        suggestions: getDefaultSuggestions(noAnswerSeedRef.current, lang),
      };
    }

    setMessages(prev => [...prev, userMsg, botMsg]);
    setInput('');
  }

  useEffect(() => { speakLangRef.current = lang; }, [lang]);

  const sttLang: Record<Lang, string> = { en: 'en-IN', hi: 'hi-IN', pa: 'hi-IN', mr: 'hi-IN' };

  function stopSpeech() {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }

  function speak(text: string) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang  = SPEAK_LANG[speakLangRef.current];
    u.rate  = 0.9;
    u.pitch = 1;
    u.onstart = () => setSpeaking(true);
    u.onend   = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }

  function toggleVoice() {
    if (speaking) stopSpeech();
    setVoiceEnabled(v => !v);
  }

  function startListening() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setMessages(prev => [...prev, { from: 'bot', text: '❌ आपका browser voice को support नहीं करता। Chrome use करें।' }]);
      return;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    const rec = new SR();
    rec.lang = sttLang[lang];
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => setListening(true);
    rec.onresult = (e: any) => {
      const tr = e.results[0][0].transcript;
      setListening(false);
      send(tr);
    };
    rec.onerror = (e: any) => {
      setListening(false);
      if (e.error === 'not-allowed') {
        setMessages(prev => [...prev, { from: 'bot', text: '❌ Mic की permission दें। Browser settings → Site Settings → Microphone Allow करें।' }]);
      } else if (e.error === 'no-speech') {
        setMessages(prev => [...prev, { from: 'bot', text: '🎤 कुछ सुनाई नहीं दिया। दोबारा बोलें।' }]);
      } else {
        setMessages(prev => [...prev, { from: 'bot', text: `❌ Error: ${e.error}. दोबारा कोशिश करें।` }]);
      }
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    try { rec.start(); } catch { setListening(false); }
  }

  function stopListening() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-24 right-4 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95"
        style={{ background: open ? '#1b4228' : 'linear-gradient(135deg, #2d6a3e, #3d8a52)' }}
        aria-label="Support Chat"
      >
        {open ? <X className="w-6 h-6 text-white" /> : <MessageCircle className="w-6 h-6 text-white" />}
        {!open && <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#f97316] rounded-full animate-pulse" />}
      </button>

      {open && (
        <div className="fixed bottom-40 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col"
          style={{ height: '460px', background: '#fff' }}>

          {/* Header */}
          <div className="px-4 py-3 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #2d6a3e, #3d8a52)' }}>
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg">🌾</div>
            <div className="flex-1">
              <p className="text-white font-semibold text-sm">{t('support.header')}</p>
              <p className="text-white/70 text-xs">{t('support.subtitle')}</p>
            </div>
            <button onClick={toggleVoice} className="p-1.5 rounded-xl bg-white/20 text-white" title={voiceEnabled ? t('support.voiceOff') : t('support.voiceOn')}>
              {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ background: '#f4f6f4' }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.from === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[82%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${msg.from === 'user' ? 'text-white rounded-br-sm' : 'text-gray-800 rounded-bl-sm border border-gray-200'}`}
                  style={msg.from === 'user' ? { background: '#2d6a3e' } : { background: '#fff' }}
                >
                  <div className="flex items-start gap-1.5">
                    <span className="flex-1">{msg.text}</span>
                    {msg.from === 'bot' && (
                      <button
                        onClick={() => speak(msg.text)}
                        className="flex-shrink-0 mt-0.5 p-1 rounded-lg opacity-50 hover:opacity-100 transition-opacity"
                        style={{ color: '#2d6a3e' }}
                        title="सुनें / Listen"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {msg.showEmail && (
                    <a href={`mailto:${SUPPORT_EMAIL}`}
                      className="mt-2 flex items-center gap-1.5 text-xs font-semibold rounded-xl px-2 py-1.5"
                      style={{ background: '#e8f5e9', color: '#2d6a3e' }}>
                      <Mail className="w-3.5 h-3.5" />
                      {SUPPORT_EMAIL}
                    </a>
                  )}
                </div>

                {/* Dynamic suggestions after bot reply */}
                {msg.from === 'bot' && msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 max-w-[90%]">
                    {msg.suggestions.map(s => (
                      <button key={s.label} onClick={() => sendByIndex(s.label, s.qaIndex)}
                        className="text-xs px-2.5 py-1 rounded-full border font-medium"
                        style={{ borderColor: '#2d6a3e22', color: '#2d6a3e', background: '#f0f7f1' }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Listening overlay */}
          {listening && (
            <div className="px-4 py-3 flex flex-col items-center gap-2 border-t border-gray-100 bg-white">
              <div className="flex items-center gap-1.5">
                {[0,1,2,3,4].map(i => (
                  <div key={i} className="w-1 rounded-full bg-[#1C4230]"
                    style={{
                      height: `${12 + Math.sin(i * 1.2) * 10}px`,
                      animation: `barPulse 0.8s ease-in-out ${i * 0.12}s infinite alternate`,
                    }} />
                ))}
              </div>
              <p className="text-xs text-gray-500 font-medium">बोलें… सुन रहा हूँ</p>
              <button onClick={stopListening}
                className="text-xs text-red-500 font-semibold px-3 py-1 rounded-full bg-red-50">
                रोकें
              </button>
            </div>
          )}

          {/* Input */}
          {!listening && (
            <div className="px-3 py-2 flex gap-2 items-center border-t border-gray-100 bg-white">
              <input
                type="text" value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send(input)}
                placeholder={t('support.placeholder')}
                className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 outline-none focus:border-green-400"
                style={{ background: '#f9fafb' }}
              />
              <button onClick={startListening}
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm active:scale-95 transition-all"
                style={{ background: 'linear-gradient(135deg,#1C4230,#2D6644)' }}
                title={t('support.mic')}>
                <Mic className="w-5 h-5 text-white" />
              </button>
              <button onClick={() => send(input)} disabled={!input.trim()}
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: input.trim() ? '#1C4230' : '#e5e7eb' }}>
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
