// ==========================================
// 1. متغیرهای عمومی
// ==========================================
let currentUserName = '';
let currentUserPhone = '';
let botSettings = {
    botActive: true,
    imageGenEnabled: false,
    welcomeMsg: 'سلام! چطور می‌تونم کمکتون کنم؟',
    voiceSpeed: 0.9
};

// ==========================================
// 2. اجرای خودکار پس از لود کامل DOM
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // افزودن شنونده رویداد به فرم ورود به صورت هوشمند
    const loginForm = document.querySelector('form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    checkSavedUser();
    fetchBotSettings();
});

// ==========================================
// 3. بررسی کاربر واردشده از قبل
// ==========================================
function checkSavedUser() {
    try {
        const savedUser = localStorage.getItem('app_user');
        if (savedUser) {
            const user = JSON.parse(savedUser);
            if (user && user.name && user.phone) {
                currentUserName = user.name;
                currentUserPhone = user.phone;
                showChatScreen();
                return;
            }
        }
    } catch (e) {
        console.error("خطا در خواندن حافظه مرورگر:", e);
    }
    showAuthScreen();
}

// ==========================================
// 4. دریافت تنظیمات سیستم
// ==========================================
async function fetchBotSettings() {
    try {
        const res = await fetch('/api/settings');
        if (res.ok) {
            const data = await res.json();
            botSettings = { ...botSettings, ...data };
            
            const chatContainer = document.getElementById('chatContainer');
            if (chatContainer && chatContainer.children.length === 0 && botSettings.welcomeMsg) {
                appendMessage('bot', botSettings.welcomeMsg);
            }
        }
    } catch (err) {
        console.error('خطا در دریافت تنظیمات:', err);
    }
}

// ==========================================
// 5. مدیریت کامل و بدون گیرِ ورود
// ==========================================
function handleLogin(e) {
    if (e && e.preventDefault) e.preventDefault();
    
    // پیدا کردن ورودی‌ها با آیدی یا اسم یا نوع ورودی (برای جلوگیری از هرگونه خطا)
    const nameInput = document.getElementById('userNameInput') || document.querySelector('input[type="text"]');
    const phoneInput = document.getElementById('userPhoneInput') || document.querySelector('input[type="tel"]');

    const name = nameInput ? nameInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';

    if (!name || !phone) {
        alert('لطفاً نام و شماره تماس خود را وارد کنید.');
        return false;
    }

    const userData = { name, phone, loginTime: new Date().toLocaleString('fa-IR') };
    
    try {
        localStorage.setItem('app_user', JSON.stringify(userData));
    } catch (err) {
        console.warn('حافظه محلی در دسترس نیست:', err);
    }

    currentUserName = name;
    currentUserPhone = phone;

    // ورود فوری و بدون معطلی به صفحه چت
    showChatScreen();

    // ثبت در سرور در پس‌زمینه
    fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
    }).catch(err => console.error('خطا در ثبت کاربر در سرور:', err));

    return false;
}

function logout() {
    localStorage.removeItem('app_user');
    location.reload();
}

function showAuthScreen() {
    const authEl = document.getElementById('authScreen');
    const chatEl = document.getElementById('chatScreen');
    if (authEl) authEl.classList.remove('hidden');
    if (chatEl) chatEl.classList.add('hidden');
}

function showChatScreen() {
    const authEl = document.getElementById('authScreen');
    const chatEl = document.getElementById('chatScreen');
    if (authEl) authEl.classList.add('hidden');
    if (chatEl) chatEl.classList.remove('hidden');
}

// ==========================================
// 6. ارسال پیام
// ==========================================
async function sendMessage() {
    const inputEl = document.getElementById('userInput') || document.querySelector('footer input') || document.querySelector('div.flex input');
    if (!inputEl) return;

    const message = inputEl.value.trim();
    if (!message) return;

    if (!botSettings.botActive) {
        alert('در حال حاضر سیستم پاسخگویی موقتاً غیرفعال است.');
        return;
    }

    appendMessage('user', message);
    inputEl.value = '';

    const loadingId = appendLoadingBubble();

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                userName: currentUserName,
                userPhone: currentUserPhone
            })
        });

        removeLoadingBubble(loadingId);

        if (!response.ok) {
            throw new Error('خطا در دریافت پاسخ');
        }

        const data = await response.json();
        
        if (data.isImage || (data.reply && data.reply.startsWith('http'))) {
            appendImageMessage('bot', data.reply);
        } else {
            appendMessage('bot', data.reply);
        }

    } catch (err) {
        removeLoadingBubble(loadingId);
        console.error('خطا در ارتباط:', err);
        appendMessage('bot', '⚠️ متأسفانه مشکلی در ارتباط با سرور رخ داد.');
    }
}

// ==========================================
// 7. رندر پیام‌ها در صفحه
// ==========================================
function appendMessage(sender, text) {
    const container = document.getElementById('chatContainer');
    if (!container) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `flex flex-col ${sender === 'user' ? 'items-end' : 'items-start'} mb-3`;

    const bubble = document.createElement('div');
    bubble.className = `max-w-[85%] md:max-w-[75%] p-3.5 rounded-2xl text-sm leading-relaxed ${
        sender === 'user' 
            ? 'bg-emerald-600 text-white rounded-br-none shadow-md' 
            : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700/60 shadow-md'
    }`;

    const formattedText = escapeHtml(text).replace(/\n/g, '<br>');
    bubble.innerHTML = `<div>${formattedText}</div>`;

    if (sender === 'bot') {
        const ttsBtn = document.createElement('button');
        ttsBtn.className = 'mt-2 text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-700/40 transition cursor-pointer';
        ttsBtn.innerHTML = '🔊 پخش صوتی';
        ttsBtn.onclick = function() { speakText(ttsBtn, text); };
        bubble.appendChild(ttsBtn);
    }

    msgDiv.appendChild(bubble);
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

function appendImageMessage(sender, imageUrl) {
    const container = document.getElementById('chatContainer');
    if (!container) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `flex flex-col ${sender === 'user' ? 'items-end' : 'items-start'} mb-3`;

    const bubble = document.createElement('div');
    bubble.className = 'max-w-[85%] md:max-w-[75%] p-2 rounded-2xl bg-slate-800 border border-slate-700/60 shadow-md';

    bubble.innerHTML = `
        <div class="w-64 h-64 rounded-xl overflow-hidden bg-slate-900">
            <img src="${imageUrl}" alt="تصویر AI" class="w-full h-full object-cover" loading="lazy" />
        </div>
        <a href="${imageUrl}" target="_blank" download class="block text-center text-xs text-amber-400 hover:underline mt-2 p-1">
            📥 دانلود تصویر اصلی
        </a>
    `;

    msgDiv.appendChild(bubble);
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

function appendLoadingBubble() {
    const container = document.getElementById('chatContainer');
    if (!container) return null;

    const id = 'loading-' + Date.now();
    const msgDiv = document.createElement('div');
    msgDiv.id = id;
    msgDiv.className = 'flex flex-col items-start mb-3';

    msgDiv.innerHTML = `
        <div class="bg-slate-800 text-slate-400 p-3 rounded-2xl rounded-bl-none border border-slate-700/60 text-xs animate-pulse">
            ⏳ در حال نوشتن پاسخ...
        </div>
    `;

    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
    return id;
}

function removeLoadingBubble(id) {
    if (!id) return;
    const el = document.getElementById(id);
    if (el) el.remove();
}

// ==========================================
// 8. پخش صوتی اختصاصی و کاملا هوشمند
// ==========================================
function speakText(btn, text) {
    if (!text) return;

    const cleanText = text
        .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
        .replace(/[*_#`~]/g, '')
        .trim();

    if (!cleanText) return;

    // پخش صوتی با ResponsiveVoice در صورت وجود
    if (typeof responsiveVoice !== 'undefined') {
        if (responsiveVoice.isPlaying()) {
            responsiveVoice.cancel();
            if (btn) btn.innerHTML = '🔊 پخش صوتی';
            return;
        }

        if (btn) btn.innerHTML = '⏹️ توقف پخش';
        responsiveVoice.speak(cleanText, "Iranian Female", {
            rate: botSettings.voiceSpeed || 0.9,
            onend: () => { if (btn) btn.innerHTML = '🔊 پخش صوتی'; },
            onerror: () => { if (btn) btn.innerHTML = '🔊 پخش صوتی'; }
        });
        return;
    }

    // پخش با مرورگر
    if ('speechSynthesis' in window) {
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            if (btn) btn.innerHTML = '🔊 پخش صوتی';
            return;
        }

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'fa-IR';
        utterance.rate = botSettings.voiceSpeed || 0.9;

        if (btn) btn.innerHTML = '⏹️ در حال پخش...';

        utterance.onend = () => { if (btn) btn.innerHTML = '🔊 پخش صوتی'; };
        utterance.onerror = () => { if (btn) btn.innerHTML = '🔊 پخش صوتی'; };

        window.speechSynthesis.speak(utterance);
    }
}

// ==========================================
// 9. ابزار کمکی
// ==========================================
function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
