import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Mic, Send, Volume2, VolumeX, Mail, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useT, type Lang } from '../../i18n';
import { speakText, stopSpeech as stopSpeaker } from '../../speaker';
import { mandiApi } from '../../mandiq-api';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Suggestion { label: string; action: 'qa' | 'price'; qaIndex?: number; priceQuery?: string }
interface PriceCard { crop: string; mandi: string; price: number; change: number; predicted?: number | null }
interface Message {
  from: 'user' | 'bot';
  text: string;
  showEmail?: boolean;
  suggestions?: Suggestion[];
  priceCard?: PriceCard;
}
type ML = Record<Lang, string>;
interface QAEntry { keywords: string[]; question: ML; answer: ML }

// ─── Crop / Mandi aliases (Hindi + English + local names) ──────────────────────

const CROP_ALIASES: Record<string, string> = {
  tomato: 'Tomato', tamatar: 'Tomato', टमाटर: 'Tomato',
  potato: 'Potato', aloo: 'Potato', alu: 'Potato', आलू: 'Potato',
  onion: 'Onion', pyaz: 'Onion', pyaaz: 'Onion', प्याज: 'Onion',
  spinach: 'Spinach', palak: 'Spinach', पालक: 'Spinach',
};

const MANDI_ALIASES: Record<string, string> = {
  azadpur: 'Azadpur APMC', अजादपुर: 'Azadpur APMC', अज़ादपुर: 'Azadpur APMC',
  keshopur: 'Keshopur APMC', केशोपुर: 'Keshopur APMC',
  prayagraj: 'Prayagraj APMC', allahabad: 'Prayagraj APMC', प्रयागराज: 'Prayagraj APMC',
};

// Fallback benchmark prices (Rs./Quintal) — sirf tab dikhते hain jab API se live
// bhaav na mile. Ye ASLI live prices nahi hain, mote-mote andaaze hain.
const PRICE_MAP: Record<string, Record<string, { price: number; change: number }>> = {
  Tomato:  { 'Azadpur APMC': { price: 1850, change: 50 }, 'Keshopur APMC': { price: 1780, change: -30 }, 'Prayagraj APMC': { price: 2100, change: 30 } },
  Potato:  { 'Azadpur APMC': { price: 1250, change: 20 }, 'Keshopur APMC': { price: 1210, change: 0  }, 'Prayagraj APMC': { price: 700,  change: 0  } },
  Onion:   { 'Azadpur APMC': { price: 2150, change: 80 }, 'Keshopur APMC': { price: 2080, change: 40 }, 'Prayagraj APMC': { price: 1550, change: 20 } },
  Spinach: { 'Azadpur APMC': { price: 980,  change: -20 }, 'Keshopur APMC': { price: 940, change: 10 } },
};

const CROP_DISPLAY: Record<string, ML> = {
  Tomato:     { en: 'Tomato', hi: 'टमाटर', pa: 'ਟਮਾਟਰ', mr: 'टोमॅटो' },
  Potato:     { en: 'Potato', hi: 'आलू', pa: 'ਆਲੂ', mr: 'बटाटा' },
  Onion:      { en: 'Onion', hi: 'प्याज', pa: 'ਪਿਆਜ਼', mr: 'कांदा' },
  Spinach:    { en: 'Spinach', hi: 'पालक', pa: 'ਪਾਲਕ', mr: 'पालक' },
};

// ─── QA database ───────────────────────────────────────────────────────────────

const QA: QAEntry[] = [
  {
    keywords: ['free', 'muft', 'payment', 'charge', 'cost', 'fees', 'paisa', 'paise', 'मुफ्त', 'ਮੁਫ਼ਤ', 'मोफत'],
    question: { en: 'Is the app free?', hi: 'क्या ऐप मुफ़्त है?', pa: 'ਕੀ ਐਪ ਮੁਫ਼ਤ ਹੈ?', mr: 'ॲप मोफत आहे का?' },
    answer: { en: 'MandiQ is completely free! No charges for any feature — price check, prediction, alerts, all free.', hi: 'मंडीक्यू बिल्कुल मुफ़्त है! किसी भी फीचर का कोई शुल्क नहीं — कीमत देखना, पूर्वानुमान, अलर्ट, सब मुफ़्त।', pa: 'ਮੰਡੀਕਿਊ ਬਿਲਕੁਲ ਮੁਫ਼ਤ ਹੈ! ਕਿਸੇ ਵੀ ਫੀਚਰ ਲਈ ਕੋਈ ਖਰਚਾ ਨਹੀਂ।', mr: 'मंडीक्यू पूर्णपणे मोफत आहे! कोणत्याही वैशिष्ट्यासाठी शुल्क नाही.' },
  },
  {
    keywords: ['mandiq', 'kya hai', 'what is', 'क्या है', 'ਕੀ ਹੈ', 'ke baare', 'about', 'काय आहे'],
    question: { en: 'What is MandiQ?', hi: 'मंडीक्यू क्या है?', pa: 'ਮੰਡੀਕਿਊ ਕੀ ਹੈ?', mr: 'मंडीक्यू काय आहे?' },
    answer: { en: 'MandiQ is an AI-powered mandi price app for farmers. It shows live prices, 7-day predictions, mandi comparison and price alerts — in Hindi, Punjabi, Marathi and English.', hi: 'मंडीक्यू किसानों के लिए एक AI-संचालित मंडी मूल्य ऐप है। यह लाइव कीमत, 7 दिन का पूर्वानुमान, मंडी तुलना और अलर्ट देता है — हिंदी, पंजाबी, मराठी और अंग्रेज़ी में।', pa: 'ਮੰਡੀਕਿਊ ਕਿਸਾਨਾਂ ਲਈ ਇੱਕ AI ਮੰਡੀ ਭਾਅ ਐਪ ਹੈ। ਲਾਈਵ ਭਾਅ, 7-ਦਿਨ ਭਵਿੱਖਬਾਣੀ, ਮੰਡੀ ਤੁਲਨਾ ਅਤੇ ਅਲਰਟ।', mr: 'मंडीक्यू हे शेतकऱ्यांसाठी AI-आधारित मंडी किंमत ॲप आहे. थेट किंमत, 7 दिवसांचा अंदाज, मंडी तुलना आणि सूचना.' },
  },
  {
    keywords: ['price', 'kimat', 'bhav', 'दाम', 'kitna', 'kaise dekhe', 'check', 'किंमत', 'ਭਾਅ', 'rate'],
    question: { en: 'How to check price?', hi: 'कीमत कैसे देखें?', pa: 'ਭਾਅ ਕਿਵੇਂ ਦੇਖੀਏ?', mr: 'किंमत कशी पाहावी?' },
    answer: { en: 'On the Home screen: select your State (Delhi/UP) → select a Mandi → select a Crop → tap "Check Price". Today\'s live price and 7-day forecast will appear instantly.', hi: 'होम स्क्रीन पर: राज्य चुनें (Delhi/UP) → मंडी चुनें → फसल चुनें → "कीमत देखें" दबाएं। आज की लाइव कीमत और 7 दिन का पूर्वानुमान दिखेगा।', pa: 'ਹੋਮ ਸਕਰੀਨ ਤੇ: ਰਾਜ ਚੁਣੋ (Delhi/UP) → ਮੰਡੀ ਚੁਣੋ → ਫਸਲ ਚੁਣੋ → "ਭਾਅ ਦੇਖੋ" ਦਬਾਓ।', mr: 'होम स्क्रीनवर: राज्य निवडा (Delhi/UP) → मंडी निवडा → पीक निवडा → "किंमत पाहा" दाबा.' },
  },
  {
    keywords: ['mandi', 'market', 'मंडी', 'ਮੰਡੀ', 'select', 'chunein', 'choose', 'kaun si', 'कौन सी', 'available'],
    question: { en: 'Which mandis are available?', hi: 'कौन सी मंडियाँ हैं?', pa: 'ਕਿਹੜੀਆਂ ਮੰਡੀਆਂ ਹਨ?', mr: 'कोणत्या मंड्या आहेत?' },
    answer: { en: 'MandiQ has 3 mandis across 2 states:\n• Delhi: Azadpur APMC, Keshopur APMC\n• UP: Prayagraj APMC\nSelect your state first on the Home screen, then choose a mandi.', hi: 'मंडीक्यू में 2 राज्यों की 3 मंडियाँ हैं:\n• दिल्ली: अजादपुर APMC, केशोपुर APMC\n• उ.प्र.: प्रयागराज APMC\nहोम स्क्रीन पर पहले राज्य चुनें, फिर मंडी।', pa: 'ਮੰਡੀਕਿਊ ਵਿੱਚ 2 ਰਾਜਾਂ ਦੀਆਂ 3 ਮੰਡੀਆਂ ਹਨ:\n• ਦਿੱਲੀ: ਅਜ਼ਾਦਪੁਰ APMC, ਕੇਸ਼ੋਪੁਰ APMC\n• ਯੂਪੀ: ਪ੍ਰਯਾਗਰਾਜ APMC', mr: 'मंडीक्यू मध्ये 2 राज्यांच्या 3 मंड्या आहेत:\n• दिल्ली: अझादपूर APMC, केशोपूर APMC\n• यूपी: प्रयागराज APMC' },
  },
  {
    keywords: ['fasal', 'crop', 'फसल', 'ਫਸਲ', 'sabzi', 'vegetable', 'पीक', 'kaun se', 'कौन से'],
    question: { en: 'Which crops are supported?', hi: 'कौन सी फसलें हैं?', pa: 'ਕਿਹੜੀਆਂ ਫਸਲਾਂ ਹਨ?', mr: 'कोणती पिके आहेत?' },
    answer: { en: 'Delhi mandis: Tomato, Potato, Onion, Spinach\nUP (Prayagraj APMC): Tomato, Potato, Onion\nSelect your state first to see the crops for your region.', hi: 'दिल्ली मंडी: टमाटर, आलू, प्याज, पालक\nUP (प्रयागराज APMC): टमाटर, आलू, प्याज\nपहले राज्य चुनें — आपके क्षेत्र की फसलें दिखेंगी।', pa: 'ਦਿੱਲੀ ਮੰਡੀ: ਟਮਾਟਰ, ਆਲੂ, ਪਿਆਜ਼, ਪਾਲਕ\nਯੂਪੀ (ਪ੍ਰਯਾਗਰਾਜ): ਟਮਾਟਰ, ਆਲੂ, ਪਿਆਜ਼', mr: 'दिल्ली: टोमॅटो, बटाटा, कांदा, पालक\nयूपी (प्रयागराज): टोमॅटो, बटाटा, कांदा' },
  },
  {
    keywords: ['up', 'uttar pradesh', 'उत्तर प्रदेश', 'prayagraj', 'allahabad', 'प्रयागराज'],
    question: { en: 'UP mandis kaise use karein?', hi: 'UP मंडी कैसे चुनें?', pa: 'ਯੂਪੀ ਮੰਡੀ ਕਿਵੇਂ ਚੁਣੀਏ?', mr: 'यूपी मंडी कशी निवडावी?' },
    answer: { en: 'To use UP mandis: On the Home screen tap "Uttar Pradesh" → choose Prayagraj APMC → then select a crop (Tomato, Potato or Onion).', hi: 'UP मंडी के लिए: होम स्क्रीन पर "उत्तर प्रदेश" टैप करें → Prayagraj APMC चुनें → फसल चुनें (टमाटर, आलू या प्याज)।', pa: 'ਯੂਪੀ ਮੰਡੀ ਲਈ: ਹੋਮ ਸਕਰੀਨ ਤੇ "ਉੱਤਰ ਪ੍ਰਦੇਸ਼" ਟੈਪ ਕਰੋ → ਪ੍ਰਯਾਗਰਾਜ APMC ਚੁਣੋ → ਫਸਲ ਚੁਣੋ।', mr: 'यूपी मंडीसाठी: होम स्क्रीनवर "उत्तर प्रदेश" टॅप करा → प्रयागराज APMC निवडा → पीक निवडा.' },
  },
  {
    keywords: ['prediction', 'forecast', 'भविष्य', 'ਭਵਿੱਖ', 'future', 'aage', 'agle', 'pूर्वानुमान', 'अंदाज'],
    question: { en: 'How does Prediction work?', hi: 'पूर्वानुमान कैसे काम करता है?', pa: 'ਭਵਿੱਖਬਾਣੀ ਕਿਵੇਂ ਕੰਮ ਕਰਦੀ ਹੈ?', mr: 'अंदाज कसा काम करतो?' },
    answer: { en: 'MandiQ\'s AI model analyzes past price patterns to predict the next 7 days. It uses AGMARKNET data updated daily. Prices marked with "~est." are estimated values.', hi: 'MandiQ का AI मॉडल पिछले कीमत पैटर्न से अगले 7 दिनों की भविष्यवाणी करता है। AGMARKNET का रोज़ अपडेट होने वाला डेटा इस्तेमाल होता है।', pa: 'MandiQ ਦਾ AI ਮਾਡਲ ਪਿਛਲੇ ਭਾਅ ਪੈਟਰਨ ਤੋਂ ਅਗਲੇ 7 ਦਿਨਾਂ ਦੀ ਭਵਿੱਖਬਾਣੀ ਕਰਦਾ ਹੈ।', mr: 'MandiQ चे AI मॉडेल मागील किंमत पॅटर्नवरून पुढील 7 दिवसांचा अंदाज लावते.' },
  },
  {
    keywords: ['alert', 'notification', 'अलर्ट', 'ਅਲਰਟ', 'suchna', 'price set', 'सूचना', 'inform'],
    question: { en: 'How to set a price alert?', hi: 'अलर्ट कैसे सेट करें?', pa: 'ਅਲਰਟ ਕਿਵੇਂ ਸੈੱਟ ਕਰੀਏ?', mr: 'सूचना कशी सेट करावी?' },
    answer: { en: 'Go to the Alerts screen (bottom nav). Enter your target price and tap Save. When the market price reaches that level, you will automatically get a notification.', hi: 'अलर्ट स्क्रीन पर जाएं (नीचे नेविगेशन)। अपनी लक्ष्य कीमत डालें और सेव करें। जब कीमत उस स्तर पर पहुँचे तो सूचना मिलेगी।', pa: 'ਅਲਰਟ ਸਕਰੀਨ ਤੇ ਜਾਓ। ਟੀਚਾ ਭਾਅ ਦਾਖਲ ਕਰੋ ਅਤੇ ਸੇਵ ਕਰੋ।', mr: 'सूचना स्क्रीनवर जा. लक्ष्य किंमत टाका आणि सेव्ह करा.' },
  },
  {
    keywords: ['compare', 'tujna', 'तुलना', 'ਤੁਲਨਾ', 'best mandi', 'sabse acchi', 'comparison', 'konsi mandi'],
    question: { en: 'How to compare mandis?', hi: 'मंडी तुलना कैसे करें?', pa: 'ਮੰਡੀ ਤੁਲਨਾ ਕਿਵੇਂ ਕਰੀਏ?', mr: 'मंडी तुलना कशी करावी?' },
    answer: { en: 'After checking a price on the Home screen, scroll down to see the Mandi Comparison chart. It deducts transport cost and shows which mandi gives you the best net price.', hi: 'होम स्क्रीन पर कीमत देखने के बाद नीचे स्क्रॉल करें — मंडी तुलना चार्ट दिखेगा। यह ट्रांसपोर्ट खर्च हटाकर सबसे अच्छी मंडी बताता है।', pa: 'ਹੋਮ ਸਕਰੀਨ ਤੇ ਭਾਅ ਦੇਖਣ ਤੋਂ ਬਾਅਦ ਹੇਠਾਂ ਸਕ੍ਰੋਲ ਕਰੋ — ਮੰਡੀ ਤੁਲਨਾ ਚਾਰਟ ਦਿਖੇਗਾ।', mr: 'होम स्क्रीनवर किंमत पाहिल्यानंतर खाली स्क्रोल करा — मंडी तुलना चार्ट दिसेल.' },
  },
  {
    keywords: ['language', 'bhasha', 'भाषा', 'ਭਾਸ਼ਾ', 'hindi', 'punjabi', 'marathi', 'english', 'change lang'],
    question: { en: 'How to change language?', hi: 'भाषा कैसे बदलें?', pa: 'ਭਾਸ਼ਾ ਕਿਵੇਂ ਬਦਲੀਏ?', mr: 'भाषा कशी बदलावी?' },
    answer: { en: 'MandiQ supports 4 languages: English, Hindi, Punjabi and Marathi. Go to the Profile screen and tap the language button to switch.', hi: 'MandiQ 4 भाषाओं में है: अंग्रेज़ी, हिंदी, पंजाबी, मराठी। प्रोफाइल स्क्रीन पर जाकर भाषा बदलें।', pa: 'MandiQ 4 ਭਾਸ਼ਾਵਾਂ ਵਿੱਚ ਹੈ। ਪ੍ਰੋਫਾਈਲ ਸਕਰੀਨ ਤੇ ਭਾਸ਼ਾ ਬਦਲੋ।', mr: 'MandiQ 4 भाषांमध्ये आहे. प्रोफाइल स्क्रीनवर भाषा बदला.' },
  },
  {
    keywords: ['help', 'madad', 'मदद', 'ਮਦਦ', 'problem', 'issue', 'error', 'kaam nahi', 'मदत', 'not working'],
    question: { en: 'App not working?', hi: 'ऐप काम नहीं कर रहा?', pa: 'ਐਪ ਕੰਮ ਨਹੀਂ ਕਰ ਰਿਹਾ?', mr: 'ॲप काम करत नाही?' },
    answer: { en: 'Try closing and reopening the app. Check your internet connection. If the problem persists, contact us at the email below — we respond within 24 hours.', hi: 'ऐप बंद करके दोबारा खोलें। इंटरनेट कनेक्शन चेक करें। समस्या बनी रहे तो नीचे दी ई-मेल पर संपर्क करें — 24 घंटे में जवाब मिलेगा।', pa: 'ਐਪ ਬੰਦ ਕਰਕੇ ਦੁਬਾਰਾ ਖੋਲੋ। ਇੰਟਰਨੈੱਟ ਜਾਂਚੋ।', mr: 'ॲप बंद करून पुन्हा उघडा. इंटरनेट तपासा.' },
  },
  {
    keywords: ['accuracy', 'sahi', 'kitna', 'percent', 'सटीक', 'accurate', 'ਸਟੀਕ', 'अचूक', 'kitna sahi'],
    question: { en: 'How accurate is the prediction?', hi: 'पूर्वानुमान कितना सटीक है?', pa: 'ਭਵਿੱਖਬਾਣੀ ਕਿੰਨੀ ਸਟੀਕ ਹੈ?', mr: 'अंदाज किती अचूक आहे?' },
    answer: { en: 'MandiQ\'s prediction accuracy is 70–90% depending on the crop and season. Weather events, supply shocks, and festival demand can cause unexpected swings — always treat predictions as a guide, not a guarantee.', hi: 'MandiQ की सटीकता फसल और मौसम के अनुसार 70–90% है। मौसमी घटनाएं और त्योहार कीमतें बदल सकते हैं — पूर्वानुमान को मार्गदर्शन मानें।', pa: 'MandiQ ਦੀ ਸਟੀਕਤਾ 70–90% ਹੈ। ਭਵਿੱਖਬਾਣੀ ਨੂੰ ਮਾਰਗਦਰਸ਼ਨ ਮੰਨੋ, ਗਾਰੰਟੀ ਨਹੀਂ।', mr: 'अचूकता 70–90% आहे. अंदाज मार्गदर्शन म्हणून घ्या.' },
  },
  {
    keywords: ['best day', 'kab beche', 'sell', 'कब बेचें', 'ਕਦੋਂ ਵੇਚੀਏ', 'when sell', 'कधी विकावे'],
    question: { en: 'When is the best day to sell?', hi: 'बेचने का सबसे अच्छा दिन?', pa: 'ਵੇਚਣ ਦਾ ਸਭ ਤੋਂ ਵਧੀਆ ਦਿਨ?', mr: 'विकण्याचा सर्वोत्तम दिवस?' },
    answer: { en: 'The 7-day prediction highlights the best selling day in green. Go to Alerts screen → enable "Best Day Alert" to get an automatic notification on that day.', hi: '7 दिन के पूर्वानुमान में सबसे अच्छा दिन हरे रंग में हाइलाइट होता है। अलर्ट स्क्रीन पर "Best Day Alert" चालू करें।', pa: '7 ਦਿਨਾਂ ਵਿੱਚ ਸਭ ਤੋਂ ਵਧੀਆ ਦਿਨ ਹਰੇ ਵਿੱਚ ਹਾਈਲਾਈਟ ਹੈ। ਅਲਰਟ ਸਕਰੀਨ ਤੇ Best Day Alert ਚਾਲੂ ਕਰੋ।', mr: '7 दिवसांत सर्वोत्तम दिवस हिरव्या रंगात आहे. सूचना स्क्रीनवर Best Day Alert चालू करा.' },
  },
  {
    keywords: ['data', 'agmarknet', 'source', 'kahan se', 'कहाँ से', 'ਕਿੱਥੋਂ', 'कुठून', 'government', 'sarkari'],
    question: { en: 'Where does the price data come from?', hi: 'कीमत का डेटा कहाँ से आता है?', pa: 'ਭਾਅ ਡੇਟਾ ਕਿੱਥੋਂ ਆਉਂਦਾ ਹੈ?', mr: 'किंमत डेटा कुठून येतो?' },
    answer: { en: 'MandiQ uses live data from AGMARKNET — the official Government of India mandi price portal. Data is scraped and updated daily, so prices are always current.', hi: 'MandiQ AGMARKNET (भारत सरकार का आधिकारिक मंडी पोर्टल) का लाइव डेटा इस्तेमाल करता है। डेटा रोज़ अपडेट होता है।', pa: 'MandiQ AGMARKNET (ਭਾਰਤ ਸਰਕਾਰ ਦਾ ਮੰਡੀ ਪੋਰਟਲ) ਦਾ ਲਾਈਵ ਡੇਟਾ ਵਰਤਦਾ ਹੈ।', mr: 'MandiQ AGMARKNET (भारत सरकारचे मंडी पोर्टल) चा थेट डेटा वापरतो.' },
  },
];

const SUPPORT_EMAIL = 'alphacoders111@gmail.com';

// ─── Price query detection ──────────────────────────────────────────────────────

function detectPriceQuery(text: string): { crop: string; mandi: string | null } | null {
  const q = text.toLowerCase().replace(/[?।!]/g, '');

  const hasPriceWord = /bhav|kimat|rate|price|कीमत|दाम|ਭਾਅ|kitna|kya|बताओ|देखना|pata|batao/.test(q);

  let detectedCrop: string | null = null;
  for (const [alias, crop] of Object.entries(CROP_ALIASES)) {
    if (q.includes(alias.toLowerCase())) { detectedCrop = crop; break; }
  }
  if (!detectedCrop) return null;
  if (!hasPriceWord && !/aaj|today|abhi|now|mandi/.test(q)) return null;

  let detectedMandi: string | null = null;
  for (const [alias, mandi] of Object.entries(MANDI_ALIASES)) {
    if (q.includes(alias.toLowerCase())) { detectedMandi = mandi; break; }
  }

  return { crop: detectedCrop, mandi: detectedMandi };
}

async function buildPriceResponse(
  crop: string, mandi: string | null, lang: Lang
): Promise<{ text: string; priceCard?: PriceCard }> {
  const cropName = CROP_DISPLAY[crop]?.[lang] || crop;
  const benchmark = PRICE_MAP[crop];

  const fetchLatest = async (m: string): Promise<{ price: number; change: number; predicted: number | null; live: boolean }> => {
    const [histRes, predRes] = await Promise.allSettled([
      mandiApi.getHistory(crop, m),
      mandiApi.predict(crop, 7, m),
    ]);

    let price = 0, change = 0, predicted: number | null = null, live = false;

    if (histRes.status === 'fulfilled' && histRes.value.length > 0) {
      const records = histRes.value;
      price = Math.round(records[records.length - 1].modal_price);
      const week = records[Math.max(0, records.length - 7)].modal_price;
      change = Math.round(price - week);
      live = true;
    }

    if (predRes.status === 'fulfilled' && predRes.value.length > 0) {
      // Tomorrow's predicted price (first prediction)
      predicted = Math.round(predRes.value[0].predicted_price);
    }

    if (price === 0) {
      const bm = benchmark?.[m];
      if (bm) { price = bm.price; change = bm.change; }
    }

    return { price, change, predicted, live };
  };

  if (mandi) {
    const { price, change, predicted, live } = await fetchLatest(mandi);
    if (price === 0) {
      const msg: ML = { en: `No data found for ${cropName} at ${mandi}.`, hi: `${mandi} में ${cropName} का डेटा नहीं मिला।`, pa: `${mandi} ਵਿੱਚ ${cropName} ਦਾ ਡੇਟਾ ਨਹੀਂ ਮਿਲਿਆ।`, mr: `${mandi} मध्ये ${cropName} चा डेटा मिळाला नाही.` };
      return { text: msg[lang] || msg.en };
    }
    const src = live ? '📡 Live (AGMARKNET)' : '~अनुमानित';
    const dir = change > 0 ? '↑' : change < 0 ? '↓' : '→';
    const predLine = predicted ? {
      en: `\nAI Forecast (tomorrow): ₹${predicted.toLocaleString()}`,
      hi: `\nAI अनुमान (कल): ₹${predicted.toLocaleString()}`,
      pa: `\nAI ਅੰਦਾਜ਼ (ਕੱਲ੍ਹ): ₹${predicted.toLocaleString()}`,
      mr: `\nAI अंदाज (उद्या): ₹${predicted.toLocaleString()}`,
    } : { en: '', hi: '', pa: '', mr: '' };
    const msgs: ML = {
      en: `${cropName} at ${mandi.replace(' APMC', '')}:\n₹${price.toLocaleString()}/Quintal  ${dir} ₹${Math.abs(change)} vs last week${predLine.en}\n${src}`,
      hi: `${mandi.replace(' APMC', '')} में ${cropName}:\n₹${price.toLocaleString()}/क्विंटल  ${dir} ₹${Math.abs(change)} पिछले हफ्ते से${predLine.hi}\n${src}`,
      pa: `${mandi.replace(' APMC', '')} ਵਿੱਚ ${cropName}:\n₹${price.toLocaleString()}/ਕੁਇੰਟਲ  ${dir} ₹${Math.abs(change)}${predLine.pa}\n${src}`,
      mr: `${mandi.replace(' APMC', '')} मध्ये ${cropName}:\n₹${price.toLocaleString()}/क्विंटल  ${dir} ₹${Math.abs(change)}${predLine.mr}\n${src}`,
    };
    return { text: msgs[lang] || msgs.en, priceCard: { crop, mandi, price, change, predicted } };
  }

  // No specific mandi — fetch all available mandis in parallel
  const allMandis = Object.keys(benchmark || {});
  if (!allMandis.length) {
    const msg: ML = { en: `No mandi data for ${cropName}.`, hi: `${cropName} का डेटा नहीं है।`, pa: `${cropName} ਦਾ ਡੇਟਾ ਨਹੀਂ।`, mr: `${cropName} चा डेटा नाही.` };
    return { text: msg[lang] || msg.en };
  }

  const results = await Promise.allSettled(allMandis.map(m => fetchLatest(m).then(r => ({ mandi: m, ...r }))));
  const valid = results
    .filter((r): r is PromiseFulfilledResult<{ mandi: string; price: number; change: number; predicted: number | null; live: boolean }> => r.status === 'fulfilled' && r.value.price > 0)
    .map(r => r.value);

  if (!valid.length) {
    const msg: ML = { en: `Could not fetch prices for ${cropName} right now.`, hi: `अभी ${cropName} की कीमत नहीं मिली।`, pa: `ਹੁਣੇ ${cropName} ਦਾ ਭਾਅ ਨਹੀਂ ਮਿਲਿਆ।`, mr: `आत्ता ${cropName} ची किंमत मिळाली नाही.` };
    return { text: msg[lang] || msg.en };
  }

  const hasLive = valid.some(v => v.live);
  const lines = valid.map(({ mandi: m, price, change }) => {
    const dir = change > 0 ? '↑' : change < 0 ? '↓' : '→';
    return `• ${m.replace(' APMC', '')}: ₹${price.toLocaleString()} ${dir}`;
  }).join('\n');
  const best = valid.reduce((a, b) => b.price > a.price ? b : a);
  const src = hasLive ? '📡 Live (AGMARKNET)' : '~अनुमानित';
  const bestMsgs: ML = {
    en: `${cropName} prices:\n${lines}\n\nBest: ${best.mandi.replace(' APMC','')} ₹${best.price.toLocaleString()}\n${src}`,
    hi: `${cropName} — मंडी भाव:\n${lines}\n\nसबसे अच्छा: ${best.mandi.replace(' APMC','')} ₹${best.price.toLocaleString()}\n${src}`,
    pa: `${cropName} — ਮੰਡੀ ਭਾਅ:\n${lines}\n\nਸਭ ਤੋਂ ਵਧੀਆ: ${best.mandi.replace(' APMC','')} ₹${best.price.toLocaleString()}\n${src}`,
    mr: `${cropName} — मंडी भाव:\n${lines}\n\nसर्वोत्तम: ${best.mandi.replace(' APMC','')} ₹${best.price.toLocaleString()}\n${src}`,
  };
  return { text: bestMsgs[lang] || bestMsgs.en, priceCard: { crop, mandi: best.mandi, price: best.price, change: best.change, predicted: best.predicted } };
}

// ─── TTS text cleaner ──────────────────────────────────────────────────────────

const RUPEE_WORD: Record<Lang, string> = { en: 'rupees', hi: 'रुपये', pa: 'ਰੁਪਏ', mr: 'रुपये' };
const UP_WORD: Record<Lang, string>    = { en: 'up', hi: 'बढ़ा', pa: 'ਵਧਿਆ', mr: 'वाढले' };
const DOWN_WORD: Record<Lang, string>  = { en: 'down', hi: 'घटा', pa: 'ਘਟਿਆ', mr: 'कमी झाले' };
const SAME_WORD: Record<Lang, string>  = { en: 'same', hi: 'बराबर', pa: 'ਬਰਾਬਰ', mr: 'समान' };

function toTTSText(text: string, lang: Lang): string {
  return text
    .replace(/₹([\d,]+)/g, (_, n) => `${n.replace(/,/g, '')} ${RUPEE_WORD[lang]}`)
    .replace(/↑/g, UP_WORD[lang])
    .replace(/↓/g, DOWN_WORD[lang])
    .replace(/→/g, SAME_WORD[lang])
    .replace(/📡|~/g, '')
    .replace(/Live \(AGMARKNET\)/gi, '')
    .replace(/अनुमानित/g, lang === 'hi' ? 'अनुमानित' : '')
    .replace(/\n+/g, ', ')
    .replace(/•/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ─── NLP matching ───────────────────────────────────────────────────────────────

function findAnswer(query: string, lang: Lang): { answer: string; found: boolean; matchedIndex: number } {
  const q = query.toLowerCase();
  let bestMatch = -1;
  let bestScore = 0;
  for (let i = 0; i < QA.length; i++) {
    const score = QA[i].keywords.reduce((s, k) => s + (q.includes(k.toLowerCase()) ? k.length : 0), 0);
    if (score > bestScore) { bestScore = score; bestMatch = i; }
  }
  if (bestScore > 0 && bestMatch >= 0) {
    return { answer: QA[bestMatch].answer[lang] || QA[bestMatch].answer.en, found: true, matchedIndex: bestMatch };
  }
  return { answer: '', found: false, matchedIndex: -1 };
}

function getRelatedSuggestions(matchedIndex: number, lang: Lang): Suggestion[] {
  return QA
    .map((qa, i) => ({ label: qa.question[lang] || qa.question.en, qaIndex: i }))
    .filter(({ qaIndex }) => qaIndex !== matchedIndex)
    .sort((a, b) => ((a.qaIndex * 7 + matchedIndex * 3) % QA.length) - ((b.qaIndex * 7 + matchedIndex * 3) % QA.length))
    .slice(0, 4)
    .map(s => ({ ...s, action: 'qa' as const }));
}

function getPriceSuggestions(crop: string, lang: Lang): Suggestion[] {
  const mandis = Object.keys(PRICE_MAP[crop] || {});
  const cropName = CROP_DISPLAY[crop]?.[lang] || crop;
  return mandis.slice(0, 3).map(m => {
    const shortM = m.replace(' APMC', '');
    return { label: `${cropName} @ ${shortM}`, action: 'price' as const, priceQuery: `${crop} price in ${m}` };
  });
}

function getDefaultSuggestions(seed: number, lang: Lang): Suggestion[] {
  return QA
    .map((qa, i) => ({ label: qa.question[lang] || qa.question.en, qaIndex: i }))
    .sort((a, b) => ((a.qaIndex * 11 + seed * 5) % QA.length) - ((b.qaIndex * 11 + seed * 5) % QA.length))
    .slice(0, 5)
    .map(s => ({ ...s, action: 'qa' as const }));
}

const PRICE_QUICK_CHIPS: Array<{ label: ML; query: string }> = [
  { label: { en: 'Tomato price', hi: 'टमाटर भाव', pa: 'ਟਮਾਟਰ ਭਾਅ', mr: 'टोमॅटो भाव' }, query: 'tomato price today' },
  { label: { en: 'Potato price', hi: 'आलू भाव', pa: 'ਆਲੂ ਭਾਅ', mr: 'बटाटा भाव' }, query: 'aloo price today' },
  { label: { en: 'Spinach price', hi: 'पालक भाव', pa: 'ਪਾਲਕ ਭਾਅ', mr: 'पालक भाव' }, query: 'spinach price' },
  { label: { en: 'Onion price', hi: 'प्याज भाव', pa: 'ਪਿਆਜ਼ ਭਾਅ', mr: 'कांदा भाव' }, query: 'pyaz price today' },
];

// App feature chips — QA actions for non-price features
const FEATURE_QUICK_CHIPS: Array<{ label: ML; qaIndex: number }> = [
  { label: { en: '7-Day Forecast', hi: '7 दिन अनुमान', pa: '7 ਦਿਨ ਭਵਿੱਖਬਾਣੀ', mr: '7 दिवस अंदाज' }, qaIndex: 6 },   // prediction
  { label: { en: 'Best Day to Sell', hi: 'कब बेचें?', pa: 'ਕਦੋਂ ਵੇਚੀਏ?', mr: 'कधी विकावे?' }, qaIndex: 12 },          // best day
  { label: { en: 'Set Price Alert', hi: 'अलर्ट लगाएं', pa: 'ਅਲਰਟ ਲਗਾਓ', mr: 'सूचना सेट करा' }, qaIndex: 7 },          // alert
  { label: { en: 'Compare Mandis', hi: 'मंडी तुलना', pa: 'ਮੰਡੀ ਤੁਲਨਾ', mr: 'मंडी तुलना' }, qaIndex: 8 },               // compare
  { label: { en: 'Which Mandis?', hi: 'कौन सी मंडी?', pa: 'ਕਿਹੜੀ ਮੰਡੀ?', mr: 'कोणती मंडी?' }, qaIndex: 3 },            // mandis
  { label: { en: 'Which Crops?', hi: 'कौन सी फसल?', pa: 'ਕਿਹੜੀ ਫਸਲ?', mr: 'कोणते पीक?' }, qaIndex: 4 },               // crops
  { label: { en: 'How Accurate?', hi: 'कितना सटीक?', pa: 'ਕਿੰਨਾ ਸਟੀਕ?', mr: 'किती अचूक?' }, qaIndex: 11 },             // accuracy
  { label: { en: 'Data Source', hi: 'डेटा कहाँ से?', pa: 'ਡੇਟਾ ਕਿੱਥੋਂ?', mr: 'डेटा कुठून?' }, qaIndex: 13 },           // source
  { label: { en: 'Change Language', hi: 'भाषा बदलें', pa: 'ਭਾਸ਼ਾ ਬਦਲੋ', mr: 'भाषा बदला' }, qaIndex: 9 },               // language
  { label: { en: 'App not working?', hi: 'ऐप काम नहीं?', pa: 'ਐਪ ਕੰਮ ਨਹੀਂ?', mr: 'ॲप काम नाही?' }, qaIndex: 10 },     // help
];

declare global { interface Window { SpeechRecognition: typeof SpeechRecognition; webkitSpeechRecognition: typeof SpeechRecognition; } }
const SPEAK_LANG: Record<Lang, string> = { en: 'en-IN', hi: 'hi-IN', pa: 'pa-IN', mr: 'mr-IN' };

// ─── Component ─────────────────────────────────────────────────────────────────

export function SupportChat() {
  const { t, lang } = useT();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const noAnswerSeedRef = useRef(0);
  const speakLangRef = useRef(lang);

  useEffect(() => {
    stopSpeech();
    const initSuggs: Suggestion[] = [
      ...PRICE_QUICK_CHIPS.map(c => ({ label: c.label[lang] || c.label.en, action: 'price' as const, priceQuery: c.query })),
      ...FEATURE_QUICK_CHIPS.slice(0, 4).map(c => ({ label: c.label[lang] || c.label.en, action: 'qa' as const, qaIndex: c.qaIndex })),
    ];
    setMessages([{ from: 'bot', text: t('support.greeting'), suggestions: initSuggs }]);
  }, [lang]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typing]);
  useEffect(() => { speakLangRef.current = lang; }, [lang]);

  function stopSpeech() { stopSpeaker(); setSpeaking(false); }
  function speak(text: string) {
    speakText(text, SPEAK_LANG[speakLangRef.current], {
      onStart: () => setSpeaking(true), onEnd: () => setSpeaking(false), onError: () => setSpeaking(false),
    });
  }
  function toggleVoice() { if (speaking) stopSpeech(); setVoiceEnabled(v => !v); }

  function deliverBotMessage(botMsg: Message, voiceText: string) {
    setTyping(false);
    setMessages(prev => [...prev, botMsg]);
    if (voiceEnabled) speak(voiceText);
  }

  function sendByIndex(label: string, qaIndex: number) {
    const userMsg: Message = { from: 'user', text: label };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTyping(true);
    setTimeout(() => {
      const answer = QA[qaIndex].answer[lang] || QA[qaIndex].answer.en;
      deliverBotMessage({
        from: 'bot', text: answer,
        suggestions: getRelatedSuggestions(qaIndex, lang),
      }, answer);
    }, 450);
  }

  async function sendPriceQuery(query: string, label: string) {
    const userMsg: Message = { from: 'user', text: label };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTyping(true);
    await new Promise(r => setTimeout(r, 500));
    const detected = detectPriceQuery(query);
    if (detected) {
      const { text, priceCard } = await buildPriceResponse(detected.crop, detected.mandi, lang);
      const suggs = getPriceSuggestions(detected.crop, lang);
      deliverBotMessage({ from: 'bot', text, priceCard, suggestions: suggs }, toTTSText(text, lang));
    } else {
      noAnswerSeedRef.current += 1;
      deliverBotMessage({
        from: 'bot', text: t('support.noAnswer'), showEmail: true,
        suggestions: getDefaultSuggestions(noAnswerSeedRef.current, lang),
      }, t('support.noAnswer'));
    }
  }

  async function send(text: string) {
    if (!text.trim()) return;
    const trimmed = text.trim();
    const userMsg: Message = { from: 'user', text: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTyping(true);
    await new Promise(r => setTimeout(r, 500));

    // 1. Try price query detection first
    const priceDetect = detectPriceQuery(trimmed);
    if (priceDetect) {
      const { text: resp, priceCard } = await buildPriceResponse(priceDetect.crop, priceDetect.mandi, lang);
      const suggs = getPriceSuggestions(priceDetect.crop, lang);
      deliverBotMessage({ from: 'bot', text: resp, priceCard, suggestions: suggs }, toTTSText(resp, lang));
      return;
    }
    // 2. QA keyword match
    const { answer, found, matchedIndex } = findAnswer(trimmed, lang);
    if (found) {
      deliverBotMessage({ from: 'bot', text: answer, suggestions: getRelatedSuggestions(matchedIndex, lang) }, answer);
      return;
    }
    // 3. No match
    noAnswerSeedRef.current += 1;
    deliverBotMessage({
      from: 'bot', text: t('support.noAnswer'), showEmail: true,
      suggestions: getDefaultSuggestions(noAnswerSeedRef.current, lang),
    }, t('support.noAnswer'));
  }

  const sttLang: Record<Lang, string> = { en: 'en-IN', hi: 'hi-IN', pa: 'hi-IN', mr: 'hi-IN' };

  function startListening() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setMessages(prev => [...prev, { from: 'bot', text: 'Voice support nahi hai — Chrome use karein.' }]); return; }
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    const rec = new SR();
    rec.lang = sttLang[lang]; rec.continuous = false; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onstart = () => setListening(true);
    rec.onresult = (e: any) => { setListening(false); send(e.results[0][0].transcript); };
    rec.onerror = (e: any) => {
      setListening(false);
      if (e.error === 'not-allowed') setMessages(prev => [...prev, { from: 'bot', text: 'Mic ki permission den. Browser → Site Settings → Microphone Allow karo.' }]);
      else if (e.error === 'no-speech') setMessages(prev => [...prev, { from: 'bot', text: 'Kuch sunai nahi diya. Dobara bolen.' }]);
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    try { rec.start(); } catch { setListening(false); }
  }

  function stopListening() { recognitionRef.current?.stop(); recognitionRef.current = null; setListening(false); }

  return (
    <>
      {/* FAB */}
      <button onClick={() => setOpen(o => !o)}
        className="fixed bottom-24 right-4 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95"
        style={{ background: open ? '#1b4228' : 'linear-gradient(135deg,#2d6a3e,#3d8a52)' }}
        aria-label="Support Chat">
        {open ? <X className="w-6 h-6 text-white" /> : <MessageCircle className="w-6 h-6 text-white" />}
        {!open && <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#f97316] rounded-full animate-pulse" />}
      </button>

      {open && (
        <div className="fixed bottom-40 right-4 z-50 w-[340px] max-w-[calc(100vw-2rem)] rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col"
          style={{ height: '510px', background: '#fff' }}>

          {/* Header */}
          <div className="px-4 py-3 flex items-center gap-3" style={{ background: 'linear-gradient(135deg,#1C4230,#2d6a3e)' }}>
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg">🌾</div>
            <div className="flex-1">
              <p className="text-white font-semibold text-sm">{t('support.header')}</p>
              <p className="text-white/70 text-xs">{t('support.subtitle')}</p>
            </div>
            <button onClick={toggleVoice} className="p-1.5 rounded-xl bg-white/20 text-white">
              {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>

          {/* Quick chips — price + features */}
          <div className="px-3 pt-2 pb-1 flex gap-1.5 overflow-x-auto scrollbar-none" style={{ background: '#f0f7f1' }}>
            {PRICE_QUICK_CHIPS.map(c => (
              <button key={c.query}
                onClick={() => sendPriceQuery(c.query, c.label[lang] || c.label.en)}
                className="flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-semibold"
                style={{ background: '#1C4230', color: '#fff' }}>
                {c.label[lang] || c.label.en}
              </button>
            ))}
            <span className="flex-shrink-0 w-px self-stretch bg-gray-300 mx-0.5" />
            {FEATURE_QUICK_CHIPS.map(c => (
              <button key={c.qaIndex}
                onClick={() => sendByIndex(c.label[lang] || c.label.en, c.qaIndex)}
                className="flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-semibold border"
                style={{ background: '#fff', color: '#1C4230', borderColor: '#1C423033' }}>
                {c.label[lang] || c.label.en}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3" style={{ background: '#f4f6f4' }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.from === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-line
                  ${msg.from === 'user' ? 'text-white rounded-br-sm' : 'text-gray-800 rounded-bl-sm border border-gray-200'}`}
                  style={msg.from === 'user' ? { background: '#1C4230' } : { background: '#fff' }}>
                  <div className="flex items-start gap-1.5">
                    <span className="flex-1">{msg.text}</span>
                    {msg.from === 'bot' && (
                      <button onClick={() => speak(toTTSText(msg.text, lang))}
                        className="flex-shrink-0 mt-0.5 p-1 rounded-lg opacity-40 hover:opacity-90 transition-opacity"
                        style={{ color: '#2d6a3e' }}>
                        <Volume2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Inline price card */}
                  {msg.priceCard && (
                    <div className="mt-2 rounded-xl p-2.5" style={{ background: '#f0f7f1', border: '1px solid #d0e8d8' }}>
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-xs font-bold text-gray-600">{msg.priceCard.mandi.replace(' APMC', '')}</p>
                        <span className="flex items-center gap-0.5 text-xs font-semibold"
                          style={{ color: msg.priceCard.change > 0 ? '#16a34a' : msg.priceCard.change < 0 ? '#dc2626' : '#6b7280' }}>
                          {msg.priceCard.change > 0 ? <TrendingUp className="w-3 h-3" /> : msg.priceCard.change < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                          {msg.priceCard.change > 0 ? '+' : ''}{msg.priceCard.change}
                        </span>
                      </div>
                      <p className="text-xl font-bold leading-tight" style={{ color: '#1C4230' }}>
                        ₹{msg.priceCard.price.toLocaleString()}<span className="text-xs font-normal text-gray-400">/Qtl</span>
                      </p>
                      {msg.priceCard.predicted != null && (
                        <div className="mt-1.5 flex items-center gap-1.5 pt-1.5" style={{ borderTop: '1px dashed #c8e6d0' }}>
                          <span className="text-[10px] text-gray-500 font-medium">AI कल अनुमान</span>
                          <span className="text-sm font-bold" style={{ color: msg.priceCard.predicted > msg.priceCard.price ? '#16a34a' : '#dc2626' }}>
                            ₹{msg.priceCard.predicted.toLocaleString()}
                          </span>
                          {msg.priceCard.predicted > msg.priceCard.price
                            ? <TrendingUp className="w-3 h-3 text-green-600" />
                            : <TrendingDown className="w-3 h-3 text-red-500" />}
                        </div>
                      )}
                    </div>
                  )}

                  {msg.showEmail && (
                    <a href={`mailto:${SUPPORT_EMAIL}`}
                      className="mt-2 flex items-center gap-1.5 text-xs font-semibold rounded-xl px-2 py-1.5"
                      style={{ background: '#e8f5e9', color: '#1C4230' }}>
                      <Mail className="w-3.5 h-3.5" /> {SUPPORT_EMAIL}
                    </a>
                  )}
                </div>

                {/* Suggestion chips */}
                {msg.from === 'bot' && msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5 max-w-[92%]">
                    {msg.suggestions.map((s, si) => (
                      <button key={si}
                        onClick={() => s.action === 'qa' && s.qaIndex !== undefined
                          ? sendByIndex(s.label, s.qaIndex)
                          : sendPriceQuery(s.priceQuery ?? s.label, s.label)}
                        className="text-xs px-2.5 py-1 rounded-full border font-medium"
                        style={{ borderColor: '#1C423022', color: '#1C4230', background: '#f0f7f1' }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {typing && (
              <div className="flex items-start">
                <div className="px-3 py-2.5 rounded-2xl rounded-bl-sm border border-gray-200 bg-white flex gap-1 items-center">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400"
                      style={{ animation: `typingDot 1.2s ${i * 0.2}s infinite ease-in-out` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Listening overlay */}
          {listening && (
            <div className="px-4 py-3 flex flex-col items-center gap-2 border-t border-gray-100 bg-white">
              <div className="flex items-center gap-1.5">
                {[0,1,2,3,4].map(i => (
                  <div key={i} className="w-1 rounded-full bg-[#1C4230]"
                    style={{ height: `${12 + Math.sin(i * 1.2) * 10}px`, animation: `barPulse 0.8s ease-in-out ${i * 0.12}s infinite alternate` }} />
                ))}
              </div>
              <p className="text-xs text-gray-500 font-medium">बोलें… सुन रहा हूँ</p>
              <button onClick={stopListening} className="text-xs text-red-500 font-semibold px-3 py-1 rounded-full bg-red-50">रोकें</button>
            </div>
          )}

          {/* Input bar */}
          {!listening && (
            <div className="px-3 py-2 flex gap-2 items-center border-t border-gray-100 bg-white">
              <input type="text" value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send(input)}
                placeholder={t('support.placeholder')}
                className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 outline-none focus:border-green-400"
                style={{ background: '#f9fafb' }} />
              <button onClick={startListening}
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm active:scale-95"
                style={{ background: 'linear-gradient(135deg,#1C4230,#2D6644)' }}>
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

      <style>{`
        @keyframes typingDot { 0%,60%,100%{transform:translateY(0);opacity:.4} 30%{transform:translateY(-5px);opacity:1} }
        @keyframes barPulse { from{transform:scaleY(0.5)} to{transform:scaleY(1)} }
        .scrollbar-none::-webkit-scrollbar { display:none }
      `}</style>
    </>
  );
}
