let currentUser = null;
let isImageMode = false;
let botSettings = { voiceGender: 'female', voiceSpeed: '1' };
let currentAudio = null;

document.addEventListener('DOMContentLoaded', async () => {
    initApp();
    await loadConfig();
});

function initApp() {
    const onboardingForm = document.getElementById('onboardingForm');
    if (onboardingForm) {
        onboardingForm.addEventListener('submit', handleRegister);
    }

    const chatForm = document.getElementById('chatForm');
    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            sendMessage();
        });
    }

    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    const newChatBtn = document.getElementById('newChatBtn');
    if (newChatBtn) {
        newChatBtn.addEventListener('click', startNewChat);
    }

    const imageModeBtn = document.getElementById('imageModeBtn');
    if (imageModeBtn) {
        imageModeBtn.addEventListener('click', toggleImageMode);
    }

    checkUserSession();
}

async function loadConfig() {
    try {
        const res = await fetch('/api/config');
        if (res.ok) {
            botSettings = await res.json();
            const imgBtn = document.getElementById('imageModeBtn');
            if (imgBtn) {
                if (botSettings.imageGenEnabled) {
                    imgBtn.classList.remove('hidden');
                } else {
                    imgBtn.classList.add('hidden');
                }
            }
        }
    } catch (e) {
        console.error('تنظیمات دریافت نشد:', e);
    }
}

function checkUserSession() {
    const savedUser = localStorage.getItem('avaye_user');
    const regModal = document.getElementById('registrationModal');
    
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            if (regModal) regModal.style.display = 'none';
            
            const displayUser = document.getElementById('displayUserName');
            if (displayUser) {
                displayUser.innerText = currentUser.name || 'کاربر';
            }
        } catch (e) {
            if (regModal) regModal.style.display = 'flex';
        }
    } else {
        if (regModal) regModal.style.display = 'flex';
    }
}

async function handleRegister(e) {
    if (e) e.preventDefault();

    const nameInput = document.getElementById('userNameInput');
    const phoneInput = document.getElementById('userPhoneInput');
    const submitBtn = e ? e.target.querySelector('button[type="submit"]') : null;

    const name = nameInput ? nameInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';

    if (!name || !phone) {
        showToast('لطفاً نام و شماره همراه را وارد کنید');
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = 'در حال ورود...';
    }

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone })
        });

        const data = await res.json();

        if (res.ok && data.success) {
            currentUser = { name, phone };
            localStorage.setItem('avaye_user', JSON.stringify(currentUser));
            
            const regModal = document.getElementById('registrationModal');
            if (regModal) regModal.style.display = 'none';

            const displayUser = document.getElementById('displayUserName');
            if (displayUser) displayUser.innerText = name;

            showToast('با موفقیت وارد شدید');
        } else {
            showToast(data.error || 'خطا در ثبت نام!');
        }
    } catch (err) {
        showToast('خطا در ارتباط با سرور');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = 'ورود به سامانه';
        }
    }
}

async function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput) return;

    const text = chatInput.value.trim();
    if (!text) return;

    // 🔑 بررسی ارسال رمز عبور مدیریت برای ورود مستقیم به پنل
    const ADMIN_PASS = "AhuiaJAKXJMPLDKS1221141154F..";
    if (text === ADMIN_PASS) {
        chatInput.value = '';
        showToast('🔑 رمز مدیریت تایید شد! در حال انتقال...');
        
        sessionStorage.setItem('admin_pass', text);
        
        setTimeout(() => {
            window.location.href = '/admin.html';
        }, 600);
        return;
    }

    const welcomeScreen = document.getElementById('welcomeScreen');
    if (welcomeScreen) welcomeScreen.style.display = 'none';

    appendMessage(text, 'user');
    chatInput.value = '';

    const botMessageElement = appendMessage('در حال تفکر...', 'ai');

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: text,
                user: currentUser,
                isImageMode: isImageMode
            })
        });

        const data = await res.json();

        if (!res.ok) {
            botMessageElement.querySelector('.message-content').innerHTML = `<span style="color: #f87171;">⚠️ ${data.error || 'خطا در دریافت پاسخ'}</span>`;
            return;
        }

        const contentBox = botMessageElement.querySelector('.message-content');

        if (data.isImage || data.imageUrl) {
            contentBox.innerHTML = `
                <div style="margin-bottom: 8px; color: #f5df91; font-weight: bold; font-size: 13px;">🎨 تصویر تولید شده:</div>
                <div style="width: 250px; height: 250px; border-radius: 16px; overflow: hidden; border: 1px solid rgba(212,175,55,0.3); margin-bottom: 8px;">
                    <img src="${data.imageUrl}" alt="AI Generated" style="width: 100%; height: 100%; object-fit: cover;" />
                </div>
                <a href="${data.imageUrl}" target="_blank" style="color: #f5df91; font-size: 12px; text-decoration: underline;">🔗 دانلود کیفیت اصلی</a>
            `;
        } else {
            const reply = data.reply || 'پاسخی یافت نشد.';
            contentBox.innerHTML = `
                <div>${escapeHtml(reply)}</div>
                <button onclick="speakText(this, \`${escapeJs(reply)}\`)" style="margin-top: 10px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); color: #f5df91; padding: 4px 10px; border-radius: 10px; font-size: 11px; cursor: pointer;">
                    🔊 پخش پاسخ
                </button>
            `;
        }
    } catch (err) {
        botMessageElement.querySelector('.message-content').innerHTML = `<span style="color: #f87171;">⚠️ خطا در برقراری ارتباط با سرور.</span>`;
    }

    scrollToBottom();
}

function appendMessage(text, sender) {
    const messagesArea = document.getElementById('messagesArea');
    if (!messagesArea) return null;

    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerText = text;

    msgDiv.appendChild(contentDiv);
    messagesArea.appendChild(msgDiv);

    scrollToBottom();
    return msgDiv;
}

function startNewChat() {
    const messagesArea = document.getElementById('messagesArea');
    const welcomeScreen = document.getElementById('welcomeScreen');
    
    if (messagesArea) messagesArea.innerHTML = '';
    if (welcomeScreen) welcomeScreen.style.display = 'flex';
}

function toggleImageMode() {
    isImageMode = !isImageMode;
    const btn = document.getElementById('imageModeBtn');
    const input = document.getElementById('chatInput');

    if (isImageMode) {
        if (btn) btn.style.background = 'rgba(212, 175, 55, 0.3)';
        if (input) input.placeholder = 'تصویر درخواستی خود را بنویسید... 🎨';
        showToast('حالت ساخت تصویر فعال شد');
    } else {
        if (btn) btn.style.background = 'rgba(212, 175, 55, 0.1)';
        if (input) input.placeholder = 'چه چیزی در ذهنتان است؟';
        showToast('حالت متن فعال شد');
    }
}

function speakText(btn, text) {
    if (currentAudio && !currentAudio.paused) {
        currentAudio.pause();
        currentAudio = null;
        btn.innerHTML = '🔊 پخش پاسخ';
        return;
    }

    const clean = text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim();
    if (!clean) return;

    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(clean.substring(0, 300))}&tl=fa&client=tw-ob`;
    currentAudio = new Audio(url);
    currentAudio.playbackRate = parseFloat(botSettings.voiceSpeed || 1);

    btn.innerHTML = 'متأسفیم درحال حاظر این قابلیت برای شما فعال نیست.';

    currentAudio.play().catch(() => { btn.innerHTML = '🔊 پخش پاسخ'; });
    currentAudio.onended = () => { btn.innerHTML = '🔊 پخش پاسخ'; currentAudio = null; };
}

function showToast(message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3200);
}

function scrollToBottom() {
    const chatContainer = document.getElementById('chatContainer');
    if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}

function escapeHtml(s) {
    return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

function escapeJs(s) {
    return s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
}
