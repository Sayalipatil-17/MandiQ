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

// ─── QA database — phrase-aware NLP ────────────────────────────────────────────
// Each entry has `phrases` (multi-word, score ×2) + `keywords` (single tokens, score ×1)
// This lets "kab bechna chahiye" beat plain keyword "sell" matches.

interface QAEntry { keywords: string[]; phrases: string[]; question: ML; answer: ML }

const QA: QAEntry[] = [
  {
    phrases: ['mandiq kya hai', 'ye app kya hai', 'is app ke baare', 'mandiq ke baare mein', 'mandiq kya hota hai', 'mandiq describe karo', 'app ke baare mein batao', 'kya ye app hai', 'yeh kya hai', 'mandiq क्या है', 'यह ऐप क्या है'],
    keywords: ['mandiq', 'mandik', 'app', 'introduce', 'about', 'describe', 'batao', 'बताओ', 'क्या है', 'ਕੀ ਹੈ', 'काय आहे', 'explain'],
    question: { en: 'What is MandiQ?', hi: 'मंडीक्यू क्या है?', pa: 'ਮੰਡੀਕਿਊ ਕੀ ਹੈ?', mr: 'मंडीक्यू काय आहे?' },
    answer: { en: 'MandiQ is a free AI-powered mandi price app for farmers. It shows live prices from AGMARKNET, 7-day AI predictions, mandi comparison, and price alerts — in Hindi, Punjabi, Marathi and English.', hi: 'MandiQ किसानों के लिए एक मुफ़्त AI मंडी ऐप है। इसमें AGMARKNET से लाइव कीमत, 7 दिन का AI पूर्वानुमान, मंडी तुलना और अलर्ट — हिंदी, पंजाबी, मराठी और अंग्रेज़ी में मिलता है।', pa: 'MandiQ ਕਿਸਾਨਾਂ ਲਈ ਮੁਫ਼ਤ AI ਮੰਡੀ ਭਾਅ ਐਪ ਹੈ। AGMARKNET ਤੋਂ ਲਾਈਵ ਭਾਅ, 7-ਦਿਨ AI ਭਵਿੱਖਬਾਣੀ, ਮੰਡੀ ਤੁਲਨਾ ਅਤੇ ਅਲਰਟ।', mr: 'MandiQ हे शेतकऱ्यांसाठी मोफत AI मंडी किंमत ॲप आहे. AGMARKNET कडून थेट किंमत, 7 दिवसांचा अंदाज, मंडी तुलना आणि सूचना मिळते.' },
  },
  {
    phrases: ['free hai kya', 'paisa lagta hai kya', 'koi charge nahi', 'muft hai kya', 'free of cost', 'paid hai kya', 'paise lagte hain', 'kharcha lagta hai', 'subscription hai kya', 'subscription lagti hai', 'muft milta hai', 'पैसे लगते हैं क्या', 'मुफ्त है क्या', 'free है क्या'],
    keywords: ['free', 'muft', 'मुफ्त', 'paisa', 'paise', 'charge', 'cost', 'fees', 'payment', 'paid', 'subscription', 'ਮੁਫ਼ਤ', 'मोफत', 'kharch', 'mulya', 'शुल्क', 'ਖਰਚਾ'],
    question: { en: 'Is the app free?', hi: 'क्या ऐप मुफ़्त है?', pa: 'ਕੀ ਐਪ ਮੁਫ਼ਤ ਹੈ?', mr: 'ॲप मोफत आहे का?' },
    answer: { en: 'MandiQ is 100% free! Price check, 7-day prediction, alerts, mandi comparison — everything is free. No subscription, no hidden charges, ever.', hi: 'MandiQ बिल्कुल मुफ़्त है! कीमत देखना, 7 दिन का अनुमान, अलर्ट, मंडी तुलना — सब कुछ मुफ़्त। कोई subscription या छुपा हुआ शुल्क नहीं।', pa: 'MandiQ ਬਿਲਕੁਲ ਮੁਫ਼ਤ ਹੈ! ਭਾਅ ਦੇਖਣਾ, 7-ਦਿਨ ਭਵਿੱਖਬਾਣੀ, ਅਲਰਟ — ਸਭ ਮੁਫ਼ਤ। ਕੋਈ ਸਬਸਕ੍ਰਿਪਸ਼ਨ ਨਹੀਂ।', mr: 'MandiQ 100% मोफत आहे! किंमत पाहणे, 7 दिवसांचा अंदाज, सूचना — सर्व मोफत. कोणतीही subscription नाही.' },
  },
  {
    phrases: ['bhav kaise dekhen', 'price kaise check karein', 'rate kaise pata kare', 'kimat kaise janein', 'kaise dekhun', 'price kaise dekhte hain', 'check karna hai price', 'bhav kaise pata kare', 'use kaise karein', 'app kaise use karein', 'kaise chalayein', 'kaise use karte hain', 'price dekhna hai', 'rate check karna hai'],
    keywords: ['kaise', 'कैसे', 'how', 'check', 'dekhen', 'देखें', 'use', 'tutorial', 'guide', 'sikhaiye', 'sikhao', 'chalao', 'ਕਿਵੇਂ', 'कसे'],
    question: { en: 'How to check price?', hi: 'कीमत कैसे देखें?', pa: 'ਭਾਅ ਕਿਵੇਂ ਦੇਖੀਏ?', mr: 'किंमत कशी पाहावी?' },
    answer: { en: 'Home screen → tap your State (Delhi / UP) → select a Mandi → select a Crop → tap "Check Price". Live price + 7-day chart appears instantly.', hi: 'होम स्क्रीन → राज्य चुनें (Delhi / UP) → मंडी चुनें → फसल चुनें → "कीमत देखें" दबाएं। लाइव कीमत + 7 दिन का चार्ट तुरंत दिखेगा।', pa: 'ਹੋਮ ਸਕਰੀਨ → ਰਾਜ ਚੁਣੋ (Delhi/UP) → ਮੰਡੀ ਚੁਣੋ → ਫਸਲ ਚੁਣੋ → "ਭਾਅ ਦੇਖੋ" ਦਬਾਓ। ਲਾਈਵ ਭਾਅ ਤੁਰੰਤ ਦਿਖੇਗਾ।', mr: 'होम स्क्रीन → राज्य निवडा → मंडी निवडा → पीक निवडा → "किंमत पाहा" दाबा. थेट किंमत लगेच दिसेल.' },
  },
  {
    phrases: ['kaun si mandis hain', 'available mandis', 'kaunsi market available hai', 'kitni mandis hain', 'mandis list', 'kaunsi mandi hai', 'mandi kaun kaun si hai', 'mandis kaun si', 'कौन सी मंडियाँ हैं', 'कितनी मंडियाँ हैं', 'mandi list kya hai'],
    keywords: ['mandi', 'mandis', 'मंडी', 'market', 'markets', 'available', 'list', 'kitni', 'कौन सी', 'कितनी', 'ਮੰਡੀਆਂ'],
    question: { en: 'Which mandis are available?', hi: 'कौन सी मंडियाँ हैं?', pa: 'ਕਿਹੜੀਆਂ ਮੰਡੀਆਂ ਹਨ?', mr: 'कोणत्या मंड्या आहेत?' },
    answer: { en: 'MandiQ currently has 3 mandis:\n• Delhi: Azadpur APMC, Keshopur APMC\n• Uttar Pradesh: Prayagraj APMC\nSelect your state on the Home screen first, then choose your mandi.', hi: 'अभी MandiQ में 3 मंडियाँ हैं:\n• दिल्ली: अजादपुर APMC, केशोपुर APMC\n• उत्तर प्रदेश: प्रयागराज APMC\nहोम स्क्रीन पर पहले राज्य चुनें, फिर मंडी।', pa: 'MandiQ ਵਿੱਚ 3 ਮੰਡੀਆਂ ਹਨ:\n• ਦਿੱਲੀ: ਅਜ਼ਾਦਪੁਰ APMC, ਕੇਸ਼ੋਪੁਰ APMC\n• ਯੂਪੀ: ਪ੍ਰਯਾਗਰਾਜ APMC', mr: 'MandiQ मध्ये 3 मंड्या आहेत:\n• दिल्ली: अझादपूर APMC, केशोपूर APMC\n• यूपी: प्रयागराज APMC' },
  },
  {
    phrases: ['kaun si fasal hain', 'available fasal', 'kaun si sabzi', 'kitni crops', 'kaunsi crop supported hai', 'kon si fasal', 'fasal kaun kaun si hai', 'कौन सी फसलें हैं', 'konse crop hain'],
    keywords: ['fasal', 'फसल', 'crop', 'crops', 'sabzi', 'vegetable', 'supported', 'kaunsi', 'ਫਸਲ', 'पीक', 'tomato', 'potato', 'onion', 'spinach', 'tamatar', 'aloo', 'pyaz', 'palak'],
    question: { en: 'Which crops are supported?', hi: 'कौन सी फसलें हैं?', pa: 'ਕਿਹੜੀਆਂ ਫਸਲਾਂ ਹਨ?', mr: 'कोणती पिके आहेत?' },
    answer: { en: 'Delhi mandis (Azadpur, Keshopur): Tomato, Potato, Onion, Spinach\nUP (Prayagraj APMC): Tomato, Potato, Onion\nSelect your state first — the right crops for your region will appear.', hi: 'दिल्ली मंडी (अजादपुर, केशोपुर): टमाटर, आलू, प्याज, पालक\nUP (प्रयागराज APMC): टमाटर, आलू, प्याज\nपहले राज्य चुनें — आपके क्षेत्र की फसलें दिखेंगी।', pa: 'ਦਿੱਲੀ ਮੰਡੀ: ਟਮਾਟਰ, ਆਲੂ, ਪਿਆਜ਼, ਪਾਲਕ\nਯੂਪੀ (ਪ੍ਰਯਾਗਰਾਜ): ਟਮਾਟਰ, ਆਲੂ, ਪਿਆਜ਼', mr: 'दिल्ली मंड्या: टोमॅटो, बटाटा, कांदा, पालक\nयूपी (प्रयागराज): टोमॅटो, बटाटा, कांदा' },
  },
  {
    phrases: ['uttar pradesh mandi', 'up ki mandi', 'prayagraj mandi kaise chunein', 'up mandi kaise use karein', 'allahabad mandi', 'prayagraj ka bhav', 'up mein kaun si mandi'],
    keywords: ['up', 'uttar', 'pradesh', 'उत्तर प्रदेश', 'prayagraj', 'allahabad', 'प्रयागराज', 'ਪ੍ਰਯਾਗਰਾਜ'],
    question: { en: 'How to use UP mandis?', hi: 'UP मंडी कैसे चुनें?', pa: 'ਯੂਪੀ ਮੰਡੀ ਕਿਵੇਂ ਚੁਣੀਏ?', mr: 'यूपी मंडी कशी निवडावी?' },
    answer: { en: 'Home screen → tap "Uttar Pradesh" → select Prayagraj APMC → choose your crop (Tomato, Potato or Onion). Live price and 7-day forecast will load.', hi: 'होम स्क्रीन → "उत्तर प्रदेश" टैप करें → Prayagraj APMC चुनें → फसल चुनें (टमाटर, आलू या प्याज)। लाइव कीमत और 7 दिन का अनुमान दिखेगा।', pa: 'ਹੋਮ ਸਕਰੀਨ → "ਉੱਤਰ ਪ੍ਰਦੇਸ਼" ਟੈਪ ਕਰੋ → ਪ੍ਰਯਾਗਰਾਜ APMC ਚੁਣੋ → ਫਸਲ ਚੁਣੋ।', mr: 'होम स्क्रीन → "उत्तर प्रदेश" टॅप करा → प्रयागराज APMC निवडा → पीक निवडा.' },
  },
  {
    phrases: ['7 din ka anuman', 'kal ka bhav', 'aage ka bhav', 'agla hafte ka bhav', 'next week price', 'prediction kaise kaam karta', 'AI forecast kya hai', 'bhavishya mein kya hoga', 'price badhega ya ghategga', 'agle 7 din', 'agle hafte', 'kal kya price hoga', 'forecast kaise kaam karta hai', '7 दिन का अनुमान', 'भविष्य में क्या होगा'],
    keywords: ['prediction', 'predict', 'forecast', 'anuman', 'अनुमान', 'भविष्य', 'future', 'aage', 'kal', 'estimate', 'पूर्वानुमान', 'ਭਵਿੱਖਬਾਣੀ', 'अंदाज', 'agle'],
    question: { en: 'How does Prediction work?', hi: 'पूर्वानुमान कैसे काम करता है?', pa: 'ਭਵਿੱਖਬਾਣੀ ਕਿਵੇਂ ਕੰਮ ਕਰਦੀ ਹੈ?', mr: 'अंदाज कसा काम करतो?' },
    answer: { en: 'MandiQ\'s AI studies past AGMARKNET price patterns and predicts the next 7 days. Tap the chart icon (bottom nav) to open the Prediction screen — it shows a forecast with confidence range and highlights the best selling day in orange.', hi: 'MandiQ का AI पिछले AGMARKNET कीमत पैटर्न से अगले 7 दिनों का अनुमान लगाता है। नीचे चार्ट आइकन दबाकर Prediction स्क्रीन खोलें — वहाँ confidence range के साथ forecast और सबसे अच्छा बेचने का दिन (orange) दिखता है।', pa: 'MandiQ ਦਾ AI ਪਿਛਲੇ AGMARKNET ਡੇਟਾ ਤੋਂ ਅਗਲੇ 7 ਦਿਨਾਂ ਦੀ ਭਵਿੱਖਬਾਣੀ ਕਰਦਾ ਹੈ। ਹੇਠਾਂ ਚਾਰਟ ਆਈਕਨ ਦਬਾ ਕੇ Prediction ਸਕਰੀਨ ਖੋਲੋ।', mr: 'MandiQ चे AI मागील AGMARKNET डेटावरून पुढील 7 दिवसांचा अंदाज लावते. खालील चार्ट आयकॉन दाबून Prediction स्क्रीन उघडा.' },
  },
  {
    phrases: ['kab bechna chahiye', 'kab bechunga', 'kab beche', 'bechne ka sahi time', 'best din kaunsa hai', 'sell karne ka sahi din', 'kab fasal bechun', 'when should i sell', 'kab bechun', 'sahi din kaunsa', 'best time to sell', 'fasal kab bechein', 'kab bechna theek hai', 'कब बेचना चाहिए', 'बेचने का सही समय', 'सबसे अच्छा दिन', 'ਕਦੋਂ ਵੇਚੀਏ'],
    keywords: ['bechna', 'बेचना', 'sell', 'kab', 'कब', 'best day', 'sahi', 'best time', 'peak', 'maximum', 'orange', 'highlight', 'ਵੇਚਣਾ', 'विकणे'],
    question: { en: 'When is the best day to sell?', hi: 'बेचने का सबसे अच्छा दिन?', pa: 'ਵੇਚਣ ਦਾ ਸਭ ਤੋਂ ਵਧੀਆ ਦਿਨ?', mr: 'विकण्याचा सर्वोत्तम दिवस?' },
    answer: { en: 'Go to the Prediction screen (chart icon). The day with the highest predicted price is marked with an orange dot — that\'s your best selling day. You can also enable "Best Day Alert" in the Alerts screen to get notified automatically.', hi: 'Prediction स्क्रीन (चार्ट आइकन) पर जाएं। जिस दिन कीमत सबसे ज़्यादा अनुमानित है, उसपर orange dot लगा होगा — वही बेचने का सबसे अच्छा दिन है। अलर्ट स्क्रीन में "Best Day Alert" चालू करें ताकि उस दिन notification मिले।', pa: 'Prediction ਸਕਰੀਨ ਤੇ ਜਾਓ (ਚਾਰਟ ਆਈਕਨ)। ਜਿਸ ਦਿਨ ਭਾਅ ਸਭ ਤੋਂ ਵੱਧ ਹੋਵੇਗਾ, ਉਸ ਤੇ orange dot ਹੋਵੇਗਾ। ਅਲਰਟ ਸਕਰੀਨ ਵਿੱਚ Best Day Alert ਚਾਲੂ ਕਰੋ।', mr: 'Prediction स्क्रीन (चार्ट आयकॉन) वर जा. सर्वाधिक अंदाजित किंमतीच्या दिवशी orange dot असतो. Alerts स्क्रीनवर Best Day Alert चालू करा.' },
  },
  {
    phrases: ['alert kaise lagaen', 'notification kaise set karein', 'price alert lagao', 'alarm kaise lagaen', 'mujhe batao jab price badhe', 'mujhe notification chahiye', 'alert set karna hai', 'price pe alert', 'jab price itna ho tab batao', 'price cross kare tab batao', 'अलर्ट कैसे लगाएं', 'सूचना कैसे सेट करें'],
    keywords: ['alert', 'अलर्ट', 'notification', 'सूचना', 'alarm', 'lagao', 'inform', 'batao', 'ਅਲਰਟ', 'set karo', 'target price'],
    question: { en: 'How to set a price alert?', hi: 'अलर्ट कैसे सेट करें?', pa: 'ਅਲਰਟ ਕਿਵੇਂ ਸੈੱਟ ਕਰੀਏ?', mr: 'सूचना कशी सेट करावी?' },
    answer: { en: 'Tap the Bell icon (bottom nav) → enter your target price → choose "Above" or "Below" → tap Save. When the market price crosses your target, you\'ll get a push notification automatically.', hi: 'नीचे Bell आइकन दबाएं → अपनी लक्ष्य कीमत डालें → "ऊपर" या "नीचे" चुनें → सेव करें। जब बाज़ार कीमत उस स्तर को छुए, आपको push notification मिलेगी।', pa: 'ਹੇਠਾਂ Bell ਆਈਕਨ ਦਬਾਓ → ਟੀਚਾ ਭਾਅ ਦਾਖਲ ਕਰੋ → "ਉੱਪਰ" ਜਾਂ "ਹੇਠਾਂ" ਚੁਣੋ → ਸੇਵ ਕਰੋ।', mr: 'खालील Bell आयकॉन दाबा → लक्ष्य किंमत टाका → "वरती" किंवा "खाली" निवडा → सेव्ह करा.' },
  },
  {
    phrases: ['mandi tulna karo', 'best mandi kaunsi hai', 'sabse acchi mandi', 'mandi comparison kaise karein', 'kaun si mandi zyada deti hai', 'net price kahan zyada hai', 'transport deduct karke', 'konsi mandi mein bechein', 'mujhe best mandi batao', 'मंडी तुलना', 'सबसे अच्छी मंडी'],
    keywords: ['compare', 'tulna', 'तुलना', 'comparison', 'best mandi', 'sabse', 'zyada', 'net price', 'transport', 'ਤੁਲਨਾ', 'तुलना'],
    question: { en: 'How to compare mandis?', hi: 'मंडी तुलना कैसे करें?', pa: 'ਮੰਡੀ ਤੁਲਨਾ ਕਿਵੇਂ ਕਰੀਏ?', mr: 'मंडी तुलना कशी करावी?' },
    answer: { en: 'After checking a price on the Home screen, scroll down to see the Mandi Comparison chart. It deducts estimated transport cost and shows which mandi gives you the highest net price for your crop.', hi: 'होम स्क्रीन पर कीमत देखने के बाद नीचे स्क्रॉल करें — मंडी तुलना चार्ट दिखेगा। यह अनुमानित transport खर्च घटाकर बताता है कि किस मंडी में सबसे ज़्यादा net पैसा मिलेगा।', pa: 'ਹੋਮ ਸਕਰੀਨ ਤੇ ਭਾਅ ਦੇਖਣ ਤੋਂ ਬਾਅਦ ਹੇਠਾਂ ਸਕ੍ਰੋਲ ਕਰੋ — ਮੰਡੀ ਤੁਲਨਾ ਚਾਰਟ ਦਿਖੇਗਾ।', mr: 'होम स्क्रीनवर किंमत पाहिल्यानंतर खाली स्क्रोल करा — मंडी तुलना चार्ट दिसेल.' },
  },
  {
    phrases: ['bhasha kaise badlein', 'language change karna hai', 'hindi mein karo', 'punjabi mein karein', 'marathi mein badlo', 'english mein karo', 'language switch karna hai', 'bhasha badlni hai', 'भाषा कैसे बदलें', 'ਭਾਸ਼ਾ ਕਿਵੇਂ ਬਦਲੀਏ'],
    keywords: ['language', 'bhasha', 'भाषा', 'hindi', 'punjabi', 'marathi', 'english', 'badlein', 'switch', 'ਭਾਸ਼ਾ', 'भाषा'],
    question: { en: 'How to change language?', hi: 'भाषा कैसे बदलें?', pa: 'ਭਾਸ਼ਾ ਕਿਵੇਂ ਬਦਲੀਏ?', mr: 'भाषा कशी बदलावी?' },
    answer: { en: 'MandiQ supports 4 languages: English, Hindi, Punjabi and Marathi. Go to the Profile screen (person icon, bottom nav) and tap the language button to switch instantly.', hi: 'MandiQ 4 भाषाओं में है: हिंदी, अंग्रेज़ी, पंजाबी, मराठी। Profile स्क्रीन पर जाएं (नीचे person आइकन) और language बटन दबाकर तुरंत बदलें।', pa: 'MandiQ 4 ਭਾਸ਼ਾਵਾਂ ਵਿੱਚ ਹੈ। ਪ੍ਰੋਫਾਈਲ ਸਕਰੀਨ ਤੇ (ਹੇਠਾਂ person ਆਈਕਨ) ਭਾਸ਼ਾ ਬਦਲੋ।', mr: 'MandiQ 4 भाषांमध्ये आहे. Profile स्क्रीनवर (खालील person आयकॉन) भाषा बदला.' },
  },
  {
    phrases: ['app kaam nahi kar raha', 'kuch nahi dikh raha', 'error aa raha hai', 'loading nahi ho raha', 'price nahi dikh raha', 'problem aa rahi hai', 'app crash ho raha', 'data nahi aa raha', 'kuch gadbad hai', 'app hang ho gaya', 'ऐप काम नहीं कर रहा', 'price load nahi ho raha'],
    keywords: ['problem', 'help', 'error', 'issue', 'kaam nahi', 'काम नहीं', 'not working', 'loading', 'support', 'madad', 'मदद', 'crash', 'gadbad', 'hang', 'slow'],
    question: { en: 'App not working?', hi: 'ऐप काम नहीं कर रहा?', pa: 'ਐਪ ਕੰਮ ਨਹੀਂ ਕਰ ਰਿਹਾ?', mr: 'ॲप काम करत नाही?' },
    answer: { en: 'Try: 1) Refresh the page 2) Check your internet connection 3) Wait 30 seconds — the server sometimes takes time to wake up. If the problem continues, email us at alphacoders111@gmail.com — we reply within 24 hours.', hi: 'कोशिश करें: 1) पेज रिफ्रेश करें 2) इंटरनेट कनेक्शन चेक करें 3) 30 सेकंड रुकें — server कभी-कभी जागने में समय लेता है। फिर भी समस्या हो तो alphacoders111@gmail.com पर लिखें — 24 घंटे में जवाब मिलेगा।', pa: 'ਕੋਸ਼ਿਸ਼ ਕਰੋ: 1) ਪੇਜ ਰਿਫ੍ਰੈਸ਼ ਕਰੋ 2) ਇੰਟਰਨੈੱਟ ਜਾਂਚੋ 3) 30 ਸਕਿੰਟ ਉਡੀਕ ਕਰੋ।', mr: 'प्रयत्न करा: 1) पेज रिफ्रेश करा 2) इंटरनेट तपासा 3) 30 सेकंद थांबा. तरी समस्या असल्यास alphacoders111@gmail.com ला लिहा.' },
  },
  {
    phrases: ['kitna sahi hai prediction', 'accuracy kitni hai', 'kitna accurate hai', 'kitna bharosa karein', 'prediction sach hoti hai kya', 'correct hoti hai kya', 'kitne percent sahi hai', 'galat bhi hota hai kya', 'prediction pe kitna trust karein', 'कितना सटीक है', 'कितना भरोसा करें'],
    keywords: ['accuracy', 'accurate', 'sahi', 'सटीक', 'percent', 'bharosa', 'trust', 'correct', 'galat', 'ਸਟੀਕ', 'अचूक', '70', '90', 'reliable'],
    question: { en: 'How accurate is the prediction?', hi: 'पूर्वानुमान कितना सटीक है?', pa: 'ਭਵਿੱਖਬਾਣੀ ਕਿੰਨੀ ਸਟੀਕ ਹੈ?', mr: 'अंदाज किती अचूक आहे?' },
    answer: { en: 'MandiQ\'s predictions are 70–90% accurate depending on crop and season. Weather events, sudden supply changes, and festival demand can cause unexpected swings. Always use predictions as a guide — not a guarantee.', hi: 'MandiQ की accuracy फसल और मौसम के अनुसार 70–90% है। अचानक मौसम बदलाव, त्योहार या आपूर्ति बदलाव कीमतें बदल सकते हैं। पूर्वानुमान को मार्गदर्शन मानें, गारंटी नहीं।', pa: 'MandiQ ਦੀ ਸਟੀਕਤਾ 70–90% ਹੈ। ਮੌਸਮ, ਤਿਉਹਾਰ ਜਾਂ ਸਪਲਾਈ ਵਿੱਚ ਅਚਾਨਕ ਬਦਲਾਅ ਭਾਅ ਬਦਲ ਸਕਦੇ ਹਨ।', mr: 'अचूकता 70–90% आहे. हवामान, सण किंवा पुरवठ्यातील बदल किंमती बदलू शकतात. अंदाज मार्गदर्शन म्हणून घ्या.' },
  },
  {
    phrases: ['data kahan se aata hai', 'price data kahan se', 'agmarknet kya hai', 'government data use karta hai', 'sarkari portal', 'data source kya hai', 'data kitna purana hai', 'daily update hota hai kya', 'डेटा कहाँ से आता है', 'कीमत का स्रोत'],
    keywords: ['data', 'agmarknet', 'source', 'kahan se', 'कहाँ से', 'government', 'sarkari', 'official', 'portal', 'live', 'daily', 'update', 'ਕਿੱਥੋਂ', 'कुठून'],
    question: { en: 'Where does the price data come from?', hi: 'डेटा कहाँ से आता है?', pa: 'ਡੇਟਾ ਕਿੱਥੋਂ ਆਉਂਦਾ ਹੈ?', mr: 'डेटा कुठून येतो?' },
    answer: { en: 'MandiQ uses live price data from AGMARKNET — the official Government of India agricultural market portal. Prices are scraped and updated every day, so what you see is always the latest market rate.', hi: 'MandiQ, AGMARKNET से लाइव कीमत डेटा लेता है — यह भारत सरकार का आधिकारिक कृषि बाज़ार पोर्टल है। डेटा हर रोज़ अपडेट होता है, इसलिए जो दिखता है वह हमेशा ताज़ा बाज़ार भाव है।', pa: 'MandiQ AGMARKNET (ਭਾਰਤ ਸਰਕਾਰ ਦਾ ਮੰਡੀ ਪੋਰਟਲ) ਤੋਂ ਰੋਜ਼ਾਨਾ ਡੇਟਾ ਲੈਂਦਾ ਹੈ।', mr: 'MandiQ AGMARKNET (भारत सरकारचे कृषी बाजार पोर्टल) कडून रोज डेटा घेते.' },
  },
  {
    phrases: ['purana data kahan hai', 'history kahan dekhen', 'pichhle rates', 'past prices kaise dekhen', 'historical data', 'pehle kya tha bhav', 'past trend kahan dekhen', 'pichhle mahine ka bhav', 'purane rates dekhne hain', 'पुराना डेटा', 'इतिहास'],
    keywords: ['history', 'historical', 'past', 'purana', 'पुराना', 'pichhla', 'पिछला', 'trend', 'पुरानी', 'ਇਤਿਹਾਸ', 'इतिहास', 'previous', 'older'],
    question: { en: 'How to see past price trends?', hi: 'पुराने भाव कहाँ देखें?', pa: 'ਪੁਰਾਣੇ ਭਾਅ ਕਿੱਥੇ ਦੇਖੀਏ?', mr: 'जुने भाव कुठे पाहावेत?' },
    answer: { en: 'Tap the "Past Trend" option (bottom nav or home screen). It shows historical price charts for your selected crop and mandi, helping you understand seasonal patterns.', hi: '"Past Trend" टैब खोलें (नीचे nav या होम स्क्रीन से)। इसमें आपकी चुनी हुई फसल और मंडी का पुराना price chart दिखता है, जिससे seasonal pattern समझने में मदद मिलती है।', pa: '"Past Trend" ਟੈਬ ਖੋਲੋ। ਇਸ ਵਿੱਚ ਤੁਹਾਡੀ ਫਸਲ ਅਤੇ ਮੰਡੀ ਦਾ ਪੁਰਾਣਾ price chart ਦਿਖਦਾ ਹੈ।', mr: '"Past Trend" टॅब उघडा. यात तुमच्या पिकाचा आणि मंडीचा जुना price chart दिसतो.' },
  },
  {
    phrases: ['mandi ka address', 'mandi ka time', 'mandi contact number', 'mandi ki jankari', 'mandi info kahan hai', 'market kab khulta hai', 'mandi ka location', 'mandi kahan hai', 'मंडी का पता', 'मंडी की जानकारी'],
    keywords: ['address', 'location', 'contact', 'timing', 'hours', 'info', 'jankari', 'details', 'phone', 'number', 'time', 'kahan hai', 'ਜਾਣਕਾਰੀ'],
    question: { en: 'Where to find Mandi Info?', hi: 'मंडी की जानकारी कहाँ है?', pa: 'ਮੰਡੀ ਜਾਣਕਾਰੀ ਕਿੱਥੇ ਮਿਲੇਗੀ?', mr: 'मंडी माहिती कुठे आहे?' },
    answer: { en: 'Tap "Mandi Info" in the bottom navigation. It shows the mandi\'s location, contact details, and operating hours for Azadpur, Keshopur and Prayagraj APMC.', hi: 'नीचे navigation में "Mandi Info" टैप करें। इसमें Azadpur, Keshopur और Prayagraj APMC का पता, contact और समय दिखता है।', pa: 'ਹੇਠਾਂ navigation ਵਿੱਚ "Mandi Info" ਟੈਪ ਕਰੋ। ਇਸ ਵਿੱਚ ਮੰਡੀਆਂ ਦਾ ਪਤਾ ਅਤੇ ਸੰਪਰਕ ਜਾਣਕਾਰੀ ਮਿਲੇਗੀ।', mr: 'खालील navigation मध्ये "Mandi Info" टॅप करा. यात मंड्यांचा पत्ता आणि संपर्क माहिती मिळेल.' },
  },
  {
    phrases: ['live price aur estimated mein kya fark hai', 'tilde ka matlab kya hai', 'live aur anumaan mein fark', 'estimated kya hota hai', 'live price kya hai', 'star ka matlab kya hai', 'ye anumaan hai ya asli', 'live vs predicted', 'live मतलब क्या', 'अनुमानित क्या होता है'],
    keywords: ['live', 'estimated', 'tilde', 'fark', 'difference', 'real', 'actual', 'asli', 'anumaan', 'symbol', 'अनुमानित', 'ਅਸਲੀ'],
    question: { en: 'Live price vs Estimated — what\'s the difference?', hi: 'Live और अनुमानित में क्या फ़र्क है?', pa: 'Live ਅਤੇ ਅਨੁਮਾਨਿਤ ਵਿੱਚ ਕੀ ਫ਼ਰਕ ਹੈ?', mr: 'Live आणि अंदाजित मध्ये काय फरक आहे?' },
    answer: { en: '📡 Live = real price scraped today from AGMARKNET.\n~अनुमानित = estimated — AGMARKNET data not yet available for that day, so the AI gives an estimate based on recent trends.', hi: '📡 Live = AGMARKNET से आज का असली बाज़ार भाव।\n~अनुमानित = उस दिन का AGMARKNET डेटा अभी नहीं आया — इसलिए AI हाल के trends से अनुमान लगाता है।', pa: '📡 Live = AGMARKNET ਤੋਂ ਅੱਜ ਦਾ ਅਸਲੀ ਭਾਅ।\n~ਅਨੁਮਾਨਿਤ = ਉਸ ਦਿਨ ਦਾ ਡੇਟਾ ਅਜੇ ਨਹੀਂ ਆਇਆ।', mr: '📡 Live = AGMARKNET कडून आजचा खरा भाव.\n~अंदाजित = त्या दिवसाचा डेटा अद्याप उपलब्ध नाही, AI अंदाज देतो.' },
  },
  {
    phrases: ['notification permission kaise dein', 'notification allow karna hai', 'notification band ho gayi', 'push notification kaise chalayein', 'notifications nahi aa rahi', 'notification setting kahan hai'],
    keywords: ['permission', 'notification', 'allow', 'push', 'block', 'enable', 'setting', 'browser', 'anumati', 'अनुमति'],
    question: { en: 'Notification not working?', hi: 'Notification नहीं आ रही?', pa: 'ਨੋਟੀਫਿਕੇਸ਼ਨ ਨਹੀਂ ਆ ਰਹੀ?', mr: 'Notification येत नाही?' },
    answer: { en: 'For alerts to work, you need to allow notifications. When the app asks permission, tap "Allow". If you blocked it, go to your browser settings → Site Permissions → Notifications → Allow mandi-q.vercel.app.', hi: 'अलर्ट काम करने के लिए notification permission देना ज़रूरी है। जब app permission माँगे, "Allow" दबाएं। अगर block हो गई है: browser settings → Site Permissions → Notifications → mandi-q.vercel.app को Allow करें।', pa: 'ਅਲਰਟ ਕੰਮ ਕਰਨ ਲਈ notification ਇਜਾਜ਼ਤ ਦੇਣੀ ਜ਼ਰੂਰੀ ਹੈ।', mr: 'अलर्ट काम करण्यासाठी notification परवानगी द्यावी लागते.' },
  },
  {
    phrases: ['profile kaise dekhein', 'account kahan hai', 'logout kaise karein', 'profile screen kahan hai', 'mera account', 'account settings', 'profile mein kya hota hai'],
    keywords: ['profile', 'account', 'logout', 'login', 'setting', 'personal', 'user', 'ਪ੍ਰੋਫਾਈਲ'],
    question: { en: 'What is in the Profile screen?', hi: 'Profile स्क्रीन में क्या है?', pa: 'Profile ਸਕਰੀਨ ਵਿੱਚ ਕੀ ਹੈ?', mr: 'Profile स्क्रीनमध्ये काय आहे?' },
    answer: { en: 'Profile screen (person icon, bottom nav) shows your account info, lets you change language, and has a Logout button. Your name and mobile number registered at signup are shown here.', hi: 'Profile स्क्रीन (नीचे person आइकन) में आपकी account जानकारी, भाषा बदलने का option और Logout बटन है। यहाँ आपका नाम और mobile number दिखता है।', pa: 'Profile ਸਕਰੀਨ ਵਿੱਚ account ਜਾਣਕਾਰੀ, ਭਾਸ਼ਾ ਬਦਲਣ ਦਾ option ਅਤੇ Logout ਬਟਨ ਹੈ।', mr: 'Profile स्क्रीनमध्ये account माहिती, भाषा बदलण्याचा पर्याय आणि Logout बटण आहे.' },
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
  const lower = query.toLowerCase().replace(/[।?!,:;।]/g, ' ');
  const tokens = lower.split(/\s+/).filter(w => w.length > 1);
  let bestMatch = -1;
  let bestScore = 0;
  for (let i = 0; i < QA.length; i++) {
    let score = 0;
    // Phrase match: multi-word phrases score ×2 their length (catches "kab bechna chahiye" etc.)
    for (const phrase of QA[i].phrases) {
      if (lower.includes(phrase.toLowerCase())) score += phrase.length * 2;
    }
    // Keyword match: token-level overlap
    for (const kw of QA[i].keywords) {
      const kwL = kw.toLowerCase();
      if (tokens.some(t => t.includes(kwL) || kwL.includes(t))) score += kw.length;
    }
    if (score > bestScore) { bestScore = score; bestMatch = i; }
  }
  // Require minimum confidence: at least a 4-char match to avoid random short-word hits
  if (bestScore >= 4 && bestMatch >= 0) {
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
  { label: { en: 'Best Day to Sell', hi: 'कब बेचें?', pa: 'ਕਦੋਂ ਵੇਚੀਏ?', mr: 'कधी विकावे?' }, qaIndex: 7 },           // best_day
  { label: { en: 'Set Price Alert', hi: 'अलर्ट लगाएं', pa: 'ਅਲਰਟ ਲਗਾਓ', mr: 'सूचना सेट करा' }, qaIndex: 8 },          // set_alert
  { label: { en: 'Compare Mandis', hi: 'मंडी तुलना', pa: 'ਮੰਡੀ ਤੁਲਨਾ', mr: 'मंडी तुलना' }, qaIndex: 9 },               // compare
  { label: { en: 'Which Mandis?', hi: 'कौन सी मंडी?', pa: 'ਕਿਹੜੀ ਮੰਡੀ?', mr: 'कोणती मंडी?' }, qaIndex: 3 },            // mandis
  { label: { en: 'Which Crops?', hi: 'कौन सी फसल?', pa: 'ਕਿਹੜੀ ਫਸਲ?', mr: 'कोणते पीक?' }, qaIndex: 4 },               // crops
  { label: { en: 'How Accurate?', hi: 'कितना सटीक?', pa: 'ਕਿੰਨਾ ਸਟੀਕ?', mr: 'किती अचूक?' }, qaIndex: 12 },             // accuracy
  { label: { en: 'Data Source', hi: 'डेटा कहाँ से?', pa: 'ਡੇਟਾ ਕਿੱਥੋਂ?', mr: 'डेटा कुठून?' }, qaIndex: 13 },           // data_source
  { label: { en: 'Change Language', hi: 'भाषा बदलें', pa: 'ਭਾਸ਼ਾ ਬਦਲੋ', mr: 'भाषा बदला' }, qaIndex: 10 },              // language
  { label: { en: 'App not working?', hi: 'ऐप काम नहीं?', pa: 'ਐਪ ਕੰਮ ਨਹੀਂ?', mr: 'ॲप काम नाही?' }, qaIndex: 11 },     // app_help
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
    // 2. AI chat endpoint
    try {
      const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
      const r = await fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed, lang,
          crop: localStorage.getItem('selectedCrop') ?? undefined,
          mandi: localStorage.getItem('selectedMarket') ?? undefined,
        }),
        signal: AbortSignal.timeout(9000),
      });
      if (r.ok) {
        const { reply } = await r.json();
        if (reply) {
          deliverBotMessage({ from: 'bot', text: reply, suggestions: getDefaultSuggestions(0, lang) }, reply);
          return;
        }
      }
    } catch {}
    // 3. QA keyword match fallback
    const { answer, found, matchedIndex } = findAnswer(trimmed, lang);
    if (found) {
      deliverBotMessage({ from: 'bot', text: answer, suggestions: getRelatedSuggestions(matchedIndex, lang) }, answer);
      return;
    }
    // 4. No match
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
