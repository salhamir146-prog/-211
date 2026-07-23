// ==========================================
// 1. متغیرهای عمومی و پیکربندی اولیه
// ==========================================
let currentUserId = null;
let currentUserName = '';
let currentUserPhone = '';
let botSettings = {
    botActive: true,
    imageGenEnabled: false,
    welcomeMsg: 'سلام! چطور می‌تونم کمکتون کنم؟',
    voiceSpeed: 1
};

// ==========================================
// 2. مقداردهی اولیه پس از بارگذاری صفحه
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    // بررسی وجود اطلاعات کاربر در حافظه محلی
    const savedUser = localStorage.getItem('app_user');
    if (savedUser) {
        const user = JSON.parse(savedUser);
        currentUserPhone = user.phone;
        currentUserName = user.name;
        showChatScreen();
    } else {
        showAuthScreen();
    }

    // دریافت آخرین تنظیمات ربات از سرور
    await fetchBotSettings();
});

// ==========================================
// 3. دریافت تنظیمات سیستم از Worker
// ==========================================
async function fetchBotSettings() {
    try {
        const res = await fetch('/api/settings');
        if (res.ok) {
            const data = await res.json();
            botSettings = { ...botSettings, ...data };
            
            // نمایش پیام خوش‌آمدگویی در صورت خالی بودن چت
            const chatContainer = document.getElementById('chatContainer');
            if (chatContainer && chatContainer.children.length === 0 && botSettings.welcomeMsg) {
                appendMessage('bot', botSettings.welcomeMsg);
            }
        }
    } catch (err) {
        console.error('خطا در دریافت تنظیمات ربات:', err);
    }
}

// ==========================================
// 4. مدیریت احراز هویت و ورود کاربر
// ==========================================
function handleLogin(e) {
    if (e) e.preventDefault();
    
    const nameInput = document.getElementById('userNameInput');
    const phoneInput = document.getElementById('userPhoneInput');

    const name = nameInput ? nameInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';

    if (!name || !phone) {
        alert('لطفاً نام و شماره تماس خود را وارد کنید.');
        return;
    }

    const userData = { name, phone, loginTime: new Date().toLocaleString('fa-IR') };
    localStorage.setItem('app_user', JSON.stringify(userData));

    currentUserName = name;
    currentUserPhone = phone;

    // ثبت کاربر در سرور
    fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
    }).catch(err => console.error('خطا در ثبت کاربر:', err));

    showChatScreen();
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
// 5. ارسال پیام و دریافت پاسخ از هوش مصنوعی
// ==========================================
async function sendMessage() {
    const inputEl = document.getElementById('userInput');
    if (!inputEl) return;

    const message = inputEl.value.trim();
    if (!message) return;

    if (!botSettings.botActive) {
        alert('در حال حاضر سیستم پاسخگویی موقتاً غیرفعال است.');
        return;
    }

    // نمایش پیام کاربر در صفحه
    appendMessage('user', message);
    inputEl.value = '';

    // نمایش حالت در حال تایپ
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
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || 'خطا در دریافت پاسخ از سرور');
        }

        const data = await response.json();
        
        // اگر پاسخ تصویر باشد یا متن عادی
        if (data.isImage || (data.reply && data.reply.startsWith('http'))) {
            appendImageMessage('bot', data.reply);
        } else {
            appendMessage('bot', data.reply);
        }

    } catch (err) {
        removeLoadingBubble(loadingId);
        console.error('خطا در ارسال پیام:', err);
        appendMessage('bot', '⚠️ متأسفانه مشکلی در برقراری ارتباط پیش آمد. لطفاً دوباره تلاش کنید.');
    }
}

// ==========================================
// 6. رندر پیام‌ها در رابط کاربری (UI)
// ==========================================
function appendMessage(sender, text) {
    const container = document.getElementById('chatContainer');
    if (!container) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `flex flex-col ${sender === 'user' ? 'items-end' : 'items-start'} mb-4`;

    const bubble = document.createElement('div');
    bubble.className = `max-w-[85%] md:max-w-[70%] p-3.5 rounded-2xl text-sm leading-relaxed ${
        sender === 'user' 
            ? 'bg-emerald-600 text-white rounded-br-none shadow-md' 
            : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700/60 shadow-md'
    }`;

    // تمیزسازی متن
    const formattedText = escapeHtml(text).replace(/\n/g, '<br>');
    bubble.innerHTML = `<div>${formattedText}</div>`;

    // افزودن دکمه پخش صوتی فقط برای پاسخ‌های ربات
    if (sender === 'bot') {
        const ttsBtn = document.createElement('button');
        ttsBtn.className = 'mt-2 text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 bg-slate-900/50 px-2.5 py-1 rounded-lg border border-slate-700/40 transition cursor-pointer';
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
    msgDiv.className = `flex flex-col ${sender === 'user' ? 'items-end' : 'items-start'} mb-4`;

    const bubble = document.createElement('div');
    bubble.className = 'max-w-[85%] md:max-w-[70%] p-2 rounded-2xl bg-slate-800 border border-slate-700/60 shadow-md';

    bubble.innerHTML = `
        <div class="w-64 h-64 rounded-xl overflow-hidden bg-slate-900 relative">
            <img src="${imageUrl}" alt="تصویر تولید شده" class="w-full h-full object-cover" loading="lazy" />
        </div>
        <a href="${imageUrl}" target="_blank" download class="block text-center text-xs text-amber-400 hover:underline mt-2 p-1">
            📥 دانلود تصویر کیفیت اصلی
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
    msgDiv.className = 'flex flex-col items-start mb-4';

    msgDiv.innerHTML = `
        <div class="bg-slate-800 text-slate-400 p-3.5 rounded-2xl rounded-bl-none border border-slate-700/60 text-xs flex items-center gap-2">
            <span class="animate-pulse">⏳ در حال پردازش و پاسخگویی...</span>
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
// 7. تابع پخش صوتی فارسی (کامل و اصلاح‌شده برای کروم)
// ==========================================
function speakText(btn, text) {
    if (!text) return;

    // پاک‌سازی کلمات و حذف کاراکترهای ناشناخته/ایموجی‌ها
    const cleanText = text
        .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
        .replace(/[*_#`~]/g, '')
        .trim();

    if (!cleanText) return;

    // پشتیبانی از ResponsiveVoice در صورت وجود در صفحه
    if (typeof responsiveVoice !== 'undefined') {
        if (responsiveVoice.isPlaying()) {
            responsiveVoice.cancel();
            if (btn) btn.innerHTML = '🔊 پخش صوتی';
            return;
        }

        if (btn) btn.innerHTML = '⏹️ توقف پخش';
        responsiveVoice.speak(cleanText, "Iranian Female", {
            rate: botSettings.voiceSpeed || 1,
            onend: () => { if (btn) btn.innerHTML = '🔊 پخش صوتی'; },
            onerror: () => { if (btn) btn.innerHTML = '🔊 پخش صوتی'; }
        });
        return;
    }

    // استفاده از Web Speech API استاندارد مرورگر
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

        utterance.onend = () => {
            if (btn) btn.innerHTML = '🔊 پخش صوتی';
        };

        utterance.onerror = (e) => {
            console.error('خطا در TTS:', e);
            if (btn) btn.innerHTML = '🔊 پخش صوتی';
            showToast('⚠️ موتور صوتی فارسی در مرورگر شما یافت نشد.');
        };

        window.speechSynthesis.speak(utterance);
    } else {
        showToast('⚠️ مرورگر شما امکان پخش صوتی را پشتیبانی نمی‌کند.');
    }
}

// ==========================================
// 8. ابزارهای کمکی (Utility Functions)
// ==========================================
function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-5 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-4 py-2.5 rounded-xl border border-slate-700 shadow-xl z-50 transition-all';
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}
