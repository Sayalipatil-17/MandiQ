import { createContext, useContext, useState, ReactNode } from 'react';

export type Lang = 'en' | 'hi' | 'pa' | 'mr';
type Entry = { en: string; hi: string; pa: string; mr: string };

const dict: Record<string, Entry> = {
  // ── app / common ──
  'app.tagline':       { en: 'Sell Smart, Earn Better', hi: 'समझदारी से बेचें, बेहतर कमाएँ', pa: 'ਸਮਝਦਾਰੀ ਨਾਲ ਵੇਚੋ, ਵੱਧ ਕਮਾਓ', mr: 'हुशारीने विका, अधिक कमवा' },
  'app.subtitle':      { en: 'AI-powered mandi price intelligence for smart farming decisions', hi: 'स्मार्ट खेती के फैसलों के लिए एआई-आधारित मंडी मूल्य जानकारी', pa: 'ਸਮਾਰਟ ਖੇਤੀ ਫੈਸਲਿਆਂ ਲਈ ਏਆਈ-ਆਧਾਰਿਤ ਮੰਡੀ ਮੁੱਲ ਜਾਣਕਾਰੀ', mr: 'स्मार्ट शेती निर्णयांसाठी एआय-आधारित मंडी किंमत माहिती' },
  'common.getStarted': { en: 'Get Started', hi: 'शुरू करें', pa: 'ਸ਼ੁਰੂ ਕਰੋ', mr: 'सुरू करा' },
  'common.selectLang': { en: 'Select Language', hi: 'भाषा चुनें', pa: 'ਭਾਸ਼ਾ ਚੁਣੋ', mr: 'भाषा निवडा' },
  'common.loading':    { en: 'Loading…', hi: 'लोड हो रहा है…', pa: 'ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ…', mr: 'लोड होत आहे…' },
  'common.perQuintal': { en: 'per quintal', hi: 'प्रति क्विंटल', pa: 'ਪ੍ਰਤੀ ਕੁਇੰਟਲ', mr: 'प्रति क्विंटल' },
  'common.dataError':  { en: 'Could not load data', hi: 'डेटा लोड नहीं हुआ', pa: 'ਡਾਟਾ ਲੋਡ ਨਹੀਂ ਹੋਇਆ', mr: 'डेटा लोड झाला नाही' },
  'common.search':     { en: 'Search', hi: 'खोजें', pa: 'ਖੋਜੋ', mr: 'शोधा' },
  'common.back':       { en: '← Back', hi: '← वापस जाएं', pa: '← ਵਾਪਸ ਜਾਓ', mr: '← मागे जा' },
  'common.noData':     { en: 'No data available', hi: 'डेटा उपलब्ध नहीं', pa: 'ਡਾਟਾ ਉਪਲਬਧ ਨਹੀਂ', mr: 'डेटा उपलब्ध नाही' },
  'common.min':        { en: 'Min', hi: 'न्यूनतम', pa: 'ਘੱਟੋ-ਘੱਟ', mr: 'किमान' },
  'common.max':        { en: 'Max', hi: 'अधिकतम', pa: 'ਵੱਧ ਤੋਂ ਵੱਧ', mr: 'कमाल' },
  'common.avg':        { en: 'Avg', hi: 'औसत', pa: 'ਔਸਤ', mr: 'सरासरी' },
  'common.today':      { en: 'Today', hi: 'आज', pa: 'ਅੱਜ', mr: 'आज' },
  'common.sell':       { en: 'Sell', hi: 'बेचें', pa: 'ਵੇਚੋ', mr: 'विका' },
  'common.set':        { en: 'Set', hi: 'सेट करें', pa: 'ਸੈੱਟ ਕਰੋ', mr: 'सेट करा' },
  'common.delete':     { en: 'Delete', hi: 'हटाएं', pa: 'ਹਟਾਓ', mr: 'हटवा' },

  // ── bottom nav ──
  'nav.home':    { en: 'Home', hi: 'होम', pa: 'ਹੋਮ', mr: 'होम' },
  'nav.predict': { en: 'Predict', hi: 'पूर्वानुमान', pa: 'ਭਵਿੱਖਬਾਣੀ', mr: 'अंदाज' },
  'nav.alerts':  { en: 'Alerts', hi: 'अलर्ट', pa: 'ਅਲਰਟ', mr: 'सूचना' },
  'nav.profile': { en: 'Profile', hi: 'प्रोफ़ाइल', pa: 'ਪ੍ਰੋਫਾਈਲ', mr: 'प्रोफाइल' },

  // ── login ──
  'login.namaste':     { en: 'Hello! 🙏', hi: 'नमस्ते! 🙏', pa: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! 🙏', mr: 'नमस्कार! 🙏' },
  'login.enterMobile': { en: 'Enter your mobile number', hi: 'अपना मोबाइल नंबर डालें', pa: 'ਆਪਣਾ ਮੋਬਾਈਲ ਨੰਬਰ ਦਰਜ ਕਰੋ', mr: 'तुमचा मोबाइल नंबर टाका' },
  'login.mobilePlaceholder': { en: 'Mobile number', hi: 'मोबाइल नंबर', pa: 'ਮੋਬਾਈਲ ਨੰਬਰ', mr: 'मोबाइल नंबर' },
  'login.sendOtp':     { en: 'Send OTP', hi: 'OTP भेजें', pa: 'OTP ਭੇਜੋ', mr: 'OTP पाठवा' },
  'login.enterOtp':    { en: 'Enter OTP', hi: 'OTP डालें', pa: 'OTP ਦਰਜ ਕਰੋ', mr: 'OTP टाका' },
  'login.sentTo':      { en: 'Sent to', hi: 'पर भेजा गया', pa: 'ਤੇ ਭੇਜਿਆ ਗਿਆ', mr: 'वर पाठवले' },
  'login.otpPlaceholder': { en: '6-digit OTP', hi: '6 अंकों का OTP', pa: '6 ਅੰਕਾਂ ਦਾ OTP', mr: '6 अंकी OTP' },
  'login.verifyOtp':   { en: 'Verify OTP', hi: 'OTP जाँचें', pa: 'OTP ਪੁਸ਼ਟੀ ਕਰੋ', mr: 'OTP तपासा' },
  'login.selectRole':  { en: 'Select Your Role', hi: 'अपनी भूमिका चुनें', pa: 'ਆਪਣੀ ਭੂਮਿਕਾ ਚੁਣੋ', mr: 'तुमची भूमिका निवडा' },
  'login.farmer':      { en: 'Farmer', hi: 'किसान', pa: 'ਕਿਸਾਨ', mr: 'शेतकरी' },
  'login.trader':      { en: 'Trader', hi: 'व्यापारी', pa: 'ਵਪਾਰੀ', mr: 'व्यापारी' },

  // ── home ──
  'home.namaste':       { en: '🙏 Hello', hi: '🙏 नमस्ते', pa: '🙏 ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ', mr: '🙏 नमस्कार' },
  'home.title':         { en: 'Check Crop Price', hi: 'फसल की कीमत देखें', pa: 'ਫਸਲ ਦਾ ਭਾਅ ਦੇਖੋ', mr: 'पिकाची किंमत पाहा' },
  'home.selectMandi':   { en: 'Select Mandi', hi: 'मंडी चुनें', pa: 'ਮੰਡੀ ਚੁਣੋ', mr: 'मंडी निवडा' },
  'home.selectMandiPh': { en: 'Select mandi…', hi: 'मंडी का नाम चुनें…', pa: 'ਮੰਡੀ ਦਾ ਨਾਮ ਚੁਣੋ…', mr: 'मंडीचे नाव निवडा…' },
  'home.selectCrop':    { en: 'Select Crop', hi: 'फसल चुनें', pa: 'ਫਸਲ ਚੁਣੋ', mr: 'पीक निवडा' },
  'home.checkPrice':    { en: 'Check Price', hi: 'कीमत देखें', pa: 'ਭਾਅ ਦੇਖੋ', mr: 'किंमत पाहा' },
  'home.loading':       { en: 'Loading…', hi: 'लोड हो रहा है…', pa: 'ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ…', mr: 'लोड होत आहे…' },
  'home.todayPrice':    { en: "Today's Price", hi: 'आज की कीमत', pa: 'ਅੱਜ ਦਾ ਭਾਅ', mr: 'आजची किंमत' },
  'home.estimated':     { en: 'estimated', hi: 'अनुमानित', pa: 'ਅਨੁਮਾਨਿਤ', mr: 'अंदाजित' },
  'home.selectDay':     { en: 'Select day:', hi: 'दिन चुनें:', pa: 'ਦਿਨ ਚੁਣੋ:', mr: 'दिवस निवडा:' },
  'home.mandiCompare':  { en: 'Mandi Comparison', hi: 'मंडी तुलना', pa: 'ਮੰਡੀ ਤੁਲਨਾ', mr: 'मंडी तुलना' },
  'home.whichBest':     { en: 'Which mandi is best?', hi: 'कौन सी मंडी सबसे अच्छी?', pa: 'ਕਿਹੜੀ ਮੰਡੀ ਸਭ ਤੋਂ ਵਧੀਆ?', mr: 'कोणती मंडी सर्वोत्तम?' },
  'home.bestSell':      { en: 'Best place to sell', hi: 'यहाँ बेचना सबसे फायदेमंद', pa: 'ਇੱਥੇ ਵੇਚਣਾ ਸਭ ਤੋਂ ਫਾਇਦੇਮੰਦ', mr: 'येथे विकणे सर्वात फायदेशीर' },
  'home.aiAdvice':      { en: 'AI Advice', hi: 'AI सलाह', pa: 'AI ਸਲਾਹ', mr: 'AI सल्ला' },
  'home.confidence':    { en: 'confidence', hi: 'भरोसा', pa: 'ਭਰੋਸਾ', mr: 'विश्वास' },
  'home.holdDays':      { en: 'days → get more', hi: 'दिन रुकें → ज़्यादा मिलेगा', pa: 'ਦਿਨ ਰੁਕੋ → ਵੱਧ ਮਿਲੇਗਾ', mr: 'दिवस थांबा → जास्त मिळेल' },
  'home.bestDay':       { en: 'Best day:', hi: 'सबसे अच्छा दिन:', pa: 'ਸਭ ਤੋਂ ਵਧੀਆ ਦਿਨ:', mr: 'सर्वोत्तम दिवस:' },
  'home.sellNow':       { en: 'Sell now — price not expected to rise', hi: 'अभी बेचें — कीमत बढ़ने की उम्मीद नहीं', pa: 'ਹੁਣ ਵੇਚੋ — ਭਾਅ ਵਧਣ ਦੀ ਉਮੀਦ ਨਹੀਂ', mr: 'आता विका — किंमत वाढण्याची शक्यता नाही' },
  'home.showGraph':     { en: 'View next 7 days graph', hi: 'अगले 7 दिन का ग्राफ देखें', pa: 'ਅਗਲੇ 7 ਦਿਨਾਂ ਦਾ ਗ੍ਰਾਫ਼ ਦੇਖੋ', mr: 'पुढील 7 दिवसांचा आलेख पाहा' },
  'home.graphDesc':     { en: 'Understand if price will rise or fall', hi: 'कीमत बढ़ेगी या घटेगी — ग्राफ से समझें', pa: 'ਭਾਅ ਵਧੇਗਾ ਜਾਂ ਘਟੇਗਾ — ਗ੍ਰਾਫ਼ ਤੋਂ ਸਮਝੋ', mr: 'किंमत वाढेल की घटेल — आलेखावरून समजा' },
  'home.closeGraph':    { en: 'Close ✕', hi: 'बंद करें ✕', pa: 'ਬੰਦ ਕਰੋ ✕', mr: 'बंद करा ✕' },
  'home.viewGraph':     { en: 'View →', hi: 'देखें →', pa: 'ਦੇਖੋ →', mr: 'पाहा →' },
  'home.mandiInfo':     { en: 'Mandi Info', hi: 'मंडी जानकारी', pa: 'ਮੰਡੀ ਜਾਣਕਾਰੀ', mr: 'मंडी माहिती' },
  'home.allPrices':     { en: 'See prices of all crops', hi: 'सभी फसलों के भाव देखें', pa: 'ਸਾਰੀਆਂ ਫਸਲਾਂ ਦੇ ਭਾਅ ਦੇਖੋ', mr: 'सर्व पिकांचे भाव पाहा' },
  'home.viewBtn':       { en: 'View →', hi: 'देखें →', pa: 'ਦੇਖੋ →', mr: 'पाहा →' },
  'home.fromYesterday': { en: 'from yesterday', hi: 'कल से', pa: 'ਕੱਲ੍ਹ ਤੋਂ', mr: 'काल पासून' },

  // ── mandi info ──
  'info.title':     { en: 'Mandi Information', hi: 'मंडी जानकारी', pa: 'ਮੰਡੀ ਜਾਣਕਾਰੀ', mr: 'मंडी माहिती' },
  'info.subtitle':  { en: 'Prices of all crops', hi: 'सभी फसलों के भाव', pa: 'ਸਾਰੀਆਂ ਫਸਲਾਂ ਦੇ ਭਾਅ', mr: 'सर्व पिकांचे भाव' },
  'info.selectMandi': { en: 'Select Mandi', hi: 'मंडी चुनें', pa: 'ਮੰਡੀ ਚੁਣੋ', mr: 'मंडी निवडा' },
  'info.todayPrices': { en: "Today's Prices", hi: 'आज के भाव', pa: 'ਅੱਜ ਦੇ ਭਾਅ', mr: 'आजचे भाव' },
  'info.loading':   { en: 'Loading prices…', hi: 'भाव लोड हो रहे हैं…', pa: 'ਭਾਅ ਲੋਡ ਹੋ ਰਹੇ ਹਨ…', mr: 'भाव लोड होत आहेत…' },
  'info.rising':    { en: '↑ Rising', hi: '↑ बढ़ रही', pa: '↑ ਵਧ ਰਿਹੀ', mr: '↑ वाढत आहे' },
  'info.falling':   { en: '↓ Falling', hi: '↓ घट रही', pa: '↓ ਘਟ ਰਿਹੀ', mr: '↓ घटत आहे' },
  'info.stable':    { en: 'No change', hi: 'कोई बदलाव नहीं', pa: 'ਕੋਈ ਬਦਲਾਅ ਨਹੀਂ', mr: 'बदल नाही' },
  'info.noData':    { en: 'No data', hi: 'डेटा नहीं', pa: 'ਡਾਟਾ ਨਹੀਂ', mr: 'डेटा नाही' },

  // ── mandi compare ──
  'cmp.title':       { en: 'Mandi Comparison', hi: 'मंडी तुलना', pa: 'ਮੰਡੀ ਤੁਲਨਾ', mr: 'मंडी तुलना' },
  'cmp.loading':     { en: 'Loading prices…', hi: 'कीमतें लोड हो रही हैं…', pa: 'ਭਾਅ ਲੋਡ ਹੋ ਰਹੇ ਹਨ…', mr: 'किंमती लोड होत आहेत…' },
  'cmp.bestSell':    { en: 'Best place to sell', hi: 'यहाँ बेचना सबसे फायदेमंद', pa: 'ਇੱਥੇ ਵੇਚਣਾ ਸਭ ਤੋਂ ਫਾਇਦੇਮੰਦ', mr: 'येथे विकणे सर्वात फायदेशीर' },
  'cmp.todayPrice':  { en: "Today's Price", hi: 'आज की कीमत', pa: 'ਅੱਜ ਦਾ ਭਾਅ', mr: 'आजची किंमत' },
  'cmp.noData':      { en: 'Data not available', hi: 'डेटा उपलब्ध नहीं', pa: 'ਡਾਟਾ ਉਪਲਬਧ ਨਹੀਂ', mr: 'डेटा उपलब्ध नाही' },
  'cmp.roseBy':      { en: 'rose by ₹', hi: 'कल से ₹', pa: 'ਕੱਲ੍ਹ ਤੋਂ ₹', mr: 'काल पेक्षा ₹' },
  'cmp.fellBy':      { en: 'fell by ₹', hi: 'कल से ₹', pa: 'ਕੱਲ੍ਹ ਤੋਂ ₹', mr: 'काल पेक्षा ₹' },
  'cmp.same':        { en: 'Same as yesterday', hi: 'कल जैसी कीमत', pa: 'ਕੱਲ੍ਹ ਵਰਗਾ ਭਾਅ', mr: 'काल सारखीच किंमत' },
  'cmp.increased':   { en: 'increased', hi: 'बढ़ी', pa: 'ਵਧੀ', mr: 'वाढली' },
  'cmp.decreased':   { en: 'decreased', hi: 'घटी', pa: 'ਘਟੀ', mr: 'घटली' },

  // ── alerts ──
  'alerts.title':       { en: 'Set Alert', hi: 'अलर्ट सेट करें', pa: 'ਅਲਰਟ ਸੈੱਟ ਕਰੋ', mr: 'सूचना सेट करा' },
  'alerts.subtitle':    { en: 'Get notified at the right time', hi: 'सही समय पर सूचना पाएं', pa: 'ਸਹੀ ਸਮੇਂ ਤੇ ਸੂਚਨਾ ਪਾਓ', mr: 'योग्य वेळी सूचना मिळवा' },
  'alerts.targetTitle': { en: 'Target Price Alert', hi: 'लक्ष्य कीमत अलर्ट', pa: 'ਟੀਚਾ ਭਾਅ ਅਲਰਟ', mr: 'लक्ष्य किंमत सूचना' },
  'alerts.targetDesc':  { en: 'When price reaches your target', hi: 'जब कीमत आपके लक्ष्य पर पहुँचे', pa: 'ਜਦੋਂ ਭਾਅ ਤੁਹਾਡੇ ਟੀਚੇ ਤੇ ਪਹੁੰਚੇ', mr: 'जेव्हा किंमत तुमच्या लक्ष्यावर पोहोचेल' },
  'alerts.howItWorks':  { en: 'How does it work?', hi: 'यह कैसे काम करता है?', pa: 'ਇਹ ਕਿਵੇਂ ਕੰਮ ਕਰਦਾ ਹੈ?', mr: 'हे कसे काम करते?' },
  'alerts.step1':       { en: 'Write the price at which you want to sell', hi: 'नीचे वह कीमत लिखें जिस पर आप बेचना चाहते हैं', pa: 'ਉਹ ਭਾਅ ਲਿਖੋ ਜਿਸ ਤੇ ਤੁਸੀਂ ਵੇਚਣਾ ਚਾਹੁੰਦੇ ਹੋ', mr: 'ज्या किंमतीला विकायचे आहे ती किंमत लिहा' },
  'alerts.step2':       { en: 'When mandi price reaches your target', hi: 'जब फसल की मंडी कीमत उस लक्ष्य पर पहुँचेगी', pa: 'ਜਦੋਂ ਮੰਡੀ ਭਾਅ ਟੀਚੇ ਤੇ ਪਹੁੰਚੇਗਾ', mr: 'जेव्हा मंडी किंमत लक्ष्यावर पोहोचेल' },
  'alerts.step3':       { en: 'You will get an instant notification — right time to sell!', hi: 'आपको तुरंत सूचना मिलेगी — बेचने का सही समय!', pa: 'ਤੁਹਾਨੂੰ ਤੁਰੰਤ ਸੂਚਨਾ ਮਿਲੇਗੀ — ਵੇਚਣ ਦਾ ਸਹੀ ਸਮਾਂ!', mr: 'तुम्हाला त्वरित सूचना मिळेल — विकण्याची योग्य वेळ!' },
  'alerts.selectCrop':  { en: 'Select crop:', hi: 'फसल चुनें:', pa: 'ਫਸਲ ਚੁਣੋ:', mr: 'पीक निवडा:' },
  'alerts.direction':   { en: 'Alert when price goes:', hi: 'जब कीमत जाए:', pa: 'ਜਦੋਂ ਭਾਅ ਜਾਵੇ:', mr: 'जेव्हा किंमत जाईल:' },
  'alerts.above':       { en: '📈 Above target', hi: '📈 लक्ष्य से ऊपर', pa: '📈 ਟੀਚੇ ਤੋਂ ਉੱਪਰ', mr: '📈 लक्ष्याच्या वर' },
  'alerts.below':       { en: '📉 Below target', hi: '📉 लक्ष्य से नीचे', pa: '📉 ਟੀਚੇ ਤੋਂ ਹੇਠਾਂ', mr: '📉 लक्ष्याच्या खाली' },
  'alerts.pricePh':     { en: 'Enter target price…', hi: 'लक्ष्य कीमत लिखें…', pa: 'ਟੀਚਾ ਭਾਅ ਲਿਖੋ…', mr: 'लक्ष्य किंमत लिहा…' },
  'alerts.setBtn':      { en: 'Set Alert', hi: 'सेट करें', pa: 'ਸੈੱਟ ਕਰੋ', mr: 'सेट करा' },
  'alerts.setDone':     { en: 'Alert set! ✓', hi: 'अलर्ट सेट हो गया! ✓', pa: 'ਅਲਰਟ ਸੈੱਟ ਹੋ ਗਿਆ! ✓', mr: 'सूचना सेट झाली! ✓' },
  'alerts.bestDayTitle':{ en: 'Best Day Alert', hi: 'सबसे अच्छे दिन का अलर्ट', pa: 'ਸਭ ਤੋਂ ਵਧੀਆ ਦਿਨ ਦਾ ਅਲਰਟ', mr: 'सर्वोत्तम दिवसाची सूचना' },
  'alerts.bestDayOn':   { en: '✓ Active', hi: '✓ चालू है', pa: '✓ ਚਾਲੂ ਹੈ', mr: '✓ सुरू आहे' },
  'alerts.bestDayOff':  { en: 'Off now', hi: 'अभी बंद है', pa: 'ਹੁਣ ਬੰਦ ਹੈ', mr: 'आत्ता बंद आहे' },
  'alerts.myAlerts':    { en: 'My Alerts', hi: 'मेरे अलर्ट', pa: 'ਮੇਰੇ ਅਲਰਟ', mr: 'माझ्या सूचना' },
  'alerts.whenReaches': { en: 'when price reaches', hi: 'जब कीमत पहुँचे', pa: 'ਜਦੋਂ ਭਾਅ ਪਹੁੰਚੇ', mr: 'जेव्हा किंमत पोहोचेल' },
  'alerts.createdOn':   { en: 'Created on', hi: 'को बनाया', pa: 'ਨੂੰ ਬਣਾਇਆ', mr: 'रोजी तयार' },

  // ── prediction ──
  'pred.title':        { en: 'Price Prediction', hi: 'मूल्य पूर्वानुमान', pa: 'ਮੁੱਲ ਭਵਿੱਖਬਾਣੀ', mr: 'किंमत अंदाज' },
  'pred.selectedCrop': { en: 'Selected Crop', hi: 'चयनित फसल', pa: 'ਚੁਣੀ ਫਸਲ', mr: 'निवडलेले पीक' },
  'pred.location':     { en: 'Location', hi: 'स्थान', pa: 'ਟਿਕਾਣਾ', mr: 'ठिकाण' },
  'pred.generating':   { en: 'Generating forecast…', hi: 'पूर्वानुमान बन रहा है…', pa: 'ਭਵਿੱਖਬਾਣੀ ਬਣ ਰਹੀ ਹੈ…', mr: 'अंदाज तयार होत आहे…' },
  'pred.forecast':     { en: '7-Day Price Forecast', hi: '7-दिन मूल्य पूर्वानुमान', pa: '7-ਦਿਨ ਮੁੱਲ ਭਵਿੱਖਬਾਣੀ', mr: '7-दिवस किंमत अंदाज' },
  'pred.withCI':       { en: 'With confidence interval', hi: 'विश्वास अंतराल के साथ', pa: 'ਭਰੋਸਾ ਅੰਤਰਾਲ ਨਾਲ', mr: 'विश्वास अंतरासह' },
  'pred.bestSellDay':  { en: 'Best selling day', hi: 'सर्वोत्तम बिक्री दिन', pa: 'ਸਭ ਤੋਂ ਵਧੀਆ ਵਿਕਰੀ ਦਿਨ', mr: 'सर्वोत्तम विक्री दिवस' },
  'pred.weatherImpact':{ en: 'Weather Impact', hi: 'मौसम प्रभाव', pa: 'ਮੌਸਮ ਪ੍ਰਭਾਵ', mr: 'हवामान परिणाम' },
  'pred.weatherText':  { en: 'Weather signals (rainfall, temperature) are used inside the model.', hi: 'मौसम संकेत (वर्षा, तापमान) मॉडल में उपयोग होते हैं।', pa: 'ਮੌਸਮ ਸੰਕੇਤ (ਮੀਂਹ, ਤਾਪਮਾਨ) ਮਾਡਲ ਵਿੱਚ ਵਰਤੇ ਜਾਂਦੇ ਹਨ।', mr: 'हवामान संकेत (पाऊस, तापमान) मॉडेलमध्ये वापरले जातात.' },
  'pred.demand':       { en: 'Demand Level', hi: 'मांग स्तर', pa: 'ਮੰਗ ਪੱਧਰ', mr: 'मागणी पातळी' },
  'pred.high':         { en: 'High', hi: 'अधिक', pa: 'ਵੱਧ', mr: 'जास्त' },
  'pred.demandText':   { en: 'Seasonal demand expected to rise', hi: 'मौसमी मांग बढ़ने की संभावना', pa: 'ਮੌਸਮੀ ਮੰਗ ਵਧਣ ਦੀ ਸੰਭਾਵਨਾ', mr: 'हंगामी मागणी वाढण्याची शक्यता' },
  'pred.confidence':   { en: 'Prediction Confidence', hi: 'पूर्वानुमान विश्वास', pa: 'ਭਵਿੱਖਬਾਣੀ ਭਰੋਸਾ', mr: 'अंदाज विश्वास' },
  'pred.confText':     { en: 'Confidence is derived from model prediction spread.', hi: 'विश्वास मॉडल की भविष्यवाणी से निकाला जाता है।', pa: 'ਭਰੋਸਾ ਮਾਡਲ ਦੀ ਭਵਿੱਖਬਾਣੀ ਤੋਂ ਨਿਕਲਦਾ ਹੈ।', mr: 'विश्वास मॉडेलच्या अंदाजावरून काढला जातो.' },
  'pred.wasAccurate':  { en: 'Was this prediction accurate?', hi: 'क्या यह पूर्वानुमान सही था?', pa: 'ਕੀ ਇਹ ਭਵਿੱਖਬਾਣੀ ਸਹੀ ਸੀ?', mr: 'हा अंदाज अचूक होता का?' },
  'pred.yes':          { en: 'Yes', hi: 'हाँ', pa: 'ਹਾਂ', mr: 'होय' },
  'pred.no':           { en: 'No', hi: 'नहीं', pa: 'ਨਹੀਂ', mr: 'नाही' },
  'pred.submit':       { en: 'Submit Feedback', hi: 'प्रतिक्रिया भेजें', pa: 'ਫੀਡਬੈਕ ਭੇਜੋ', mr: 'अभिप्राय पाठवा' },
  'pred.noModel':      { en: 'Model must be trained and backend running.', hi: 'मॉडल ट्रेन होना चाहिए और बैकएंड चालू।', pa: 'ਮਾਡਲ ਟ੍ਰੇਨ ਹੋਣਾ ਚਾਹੀਦਾ ਤੇ ਬੈਕਐਂਡ ਚਾਲੂ।', mr: 'मॉडेल प्रशिक्षित आणि बॅकएंड चालू हवे.' },
  'pred.currentPrice': { en: 'Current Price', hi: 'वर्तमान कीमत', pa: 'ਮੌਜੂਦਾ ਭਾਅ', mr: 'सध्याची किंमत' },
  'pred.bestForecast': { en: 'Best Forecast', hi: 'सर्वोत्तम अनुमान', pa: 'ਸਭ ਤੋਂ ਵਧੀਆ ਅਨੁਮਾਨ', mr: 'सर्वोत्तम अंदाज' },

  // ── past trend ──
  'trend.title':      { en: 'Past Trend', hi: 'पिछला ट्रेंड', pa: 'ਪਿਛਲਾ ਰੁਝਾਨ', mr: 'मागील कल' },
  'trend.subtitle':   { en: 'Historical price analysis', hi: 'ऐतिहासिक कीमत विश्लेषण', pa: 'ਇਤਿਹਾਸਕ ਭਾਅ ਵਿਸ਼ਲੇਸ਼ਣ', mr: 'ऐतिहासिक किंमत विश्लेषण' },
  'trend.selectCrop': { en: 'Select crop', hi: 'फसल चुनें', pa: 'ਫਸਲ ਚੁਣੋ', mr: 'पीक निवडा' },
  'trend.selectMkt':  { en: 'Select market', hi: 'मंडी चुनें', pa: 'ਮੰਡੀ ਚੁਣੋ', mr: 'मंडी निवडा' },
  'trend.period7':    { en: '7D', hi: '7D', pa: '7D', mr: '7D' },
  'trend.period30':   { en: '30D', hi: '30D', pa: '30D', mr: '30D' },
  'trend.period90':   { en: '90D', hi: '90D', pa: '90D', mr: '90D' },
  'trend.loading':    { en: 'Loading data…', hi: 'डेटा लोड हो रहा है…', pa: 'ਡਾਟਾ ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ…', mr: 'डेटा लोड होत आहे…' },
  'trend.overall':    { en: 'Overall Change', hi: 'कुल बदलाव', pa: 'ਕੁੱਲ ਬਦਲਾਅ', mr: 'एकूण बदल' },
  'trend.priceHistory': { en: 'Price History', hi: 'कीमत इतिहास', pa: 'ਭਾਅ ਇਤਿਹਾਸ', mr: 'किंमत इतिहास' },
  'trend.recent7':    { en: 'Last 7 Days', hi: 'पिछले 7 दिन', pa: 'ਪਿਛਲੇ 7 ਦਿਨ', mr: 'मागील 7 दिवस' },
  'trend.noData':     { en: 'No data found. Select crop and market.', hi: 'डेटा नहीं मिला। फसल और मंडी चुनें।', pa: 'ਡਾਟਾ ਨਹੀਂ ਮਿਲਿਆ। ਫਸਲ ਤੇ ਮੰਡੀ ਚੁਣੋ।', mr: 'डेटा सापडला नाही. पीक आणि मंडी निवडा.' },

  // ── profile ──
  'profile.farmer':   { en: 'Farmer', hi: 'किसान', pa: 'ਕਿਸਾਨ', mr: 'शेतकरी' },
  'profile.trader':   { en: 'Trader', hi: 'व्यापारी', pa: 'ਵਪਾਰੀ', mr: 'व्यापारी' },
  'profile.myCrops':  { en: 'My Crops', hi: 'मेरी फसलें', pa: 'ਮੇਰੀਆਂ ਫਸਲਾਂ', mr: 'माझी पिके' },
  'profile.language': { en: 'Language', hi: 'भाषा', pa: 'ਭਾਸ਼ਾ', mr: 'भाषा' },
  'profile.support':  { en: 'Support Chat', hi: 'सहायता चैट', pa: 'ਸਹਾਇਤਾ ਚੈਟ', mr: 'सहाय्य चॅट' },
  'profile.voice':    { en: 'Voice Assistant', hi: 'आवाज सहायक', pa: 'ਆਵਾਜ਼ ਸਹਾਇਕ', mr: 'व्हॉइस सहाय्यक' },
  'profile.logout':   { en: 'Logout', hi: 'लॉग आउट', pa: 'ਲੌਗ ਆਊਟ', mr: 'लॉग आउट' },

  // ── crops ──
  'crops.tomato':  { en: 'Tomato', hi: 'टमाटर', pa: 'ਟਮਾਟਰ', mr: 'टोमॅटो' },
  'crops.potato':  { en: 'Potato', hi: 'आलू', pa: 'ਆਲੂ', mr: 'बटाटा' },
  'crops.onion':   { en: 'Onion', hi: 'प्याज', pa: 'ਪਿਆਜ਼', mr: 'कांदा' },
  'crops.spinach': { en: 'Spinach', hi: 'पालक', pa: 'ਪਾਲਕ', mr: 'पालक' },
};

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (key: string) => string };
const LangContext = createContext<Ctx>({ lang: 'hi', setLang: () => {}, t: (k) => k });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>((localStorage.getItem('lang') as Lang) || 'hi');
  const setLang = (l: Lang) => { setLangState(l); localStorage.setItem('lang', l); };
  const t = (key: string): string => {
    const entry = dict[key];
    if (!entry) return key;
    return entry[lang] ?? entry.en;
  };
  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export function useT() {
  return useContext(LangContext);
}

// Crop name helper — language ke hisaab se crop name do
export function cropName(crop: string, t: (k: string) => string): string {
  const key = `crops.${crop.toLowerCase()}`;
  const result = t(key);
  return result === key ? crop : result;
}
