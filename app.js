// متغیرهای عمومی سیستم
let currentUser = null;
let isImageMode = false;
let botSettings = { voiceGender: 'female', voiceSpeed: '1' };
let currentAudio = null;

// ۱. بارگذاری اولیه و تنظیمات
window.onload = async function () {
  checkUserSession();
  await loadConfig();
};

// دریافت کانفیگ از سرور (جهت تنظیمات صدا و تصویرساز)
async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      botSettings = await res.json();
      const imgBtn = document.getElementById('imageModeToggle');
      if (imgBtn) {
        if (botSettings.imageGenEnabled) {
          imgBtn.classList.remove('hidden');
        } else {
          imgBtn.classList.add('hidden');
        }
      }
    }
  } catch (e) {
    console.error('خطا در دریافت تنظیمات اولیه:', e);
  }
}

// بررسی وضعیت ورود کاربر از حافظه مرورگر
function checkUserSession() {
  const savedUser = localStorage.getItem('avaye_user');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    showChatInterface();
  } else {
    showAuthModal();
  }
}

// ثبت‌نام / ورود کاربر
async function handleRegister() {
  const nameInput = document.getElementById('userNameInput');
  const phoneInput = document.getElementById('userPhoneInput');
  const authError = document.getElementById('authError');

  const name = nameInput ? nameInput.value.trim() : '';
  const phone = phoneInput ? phoneInput.value.trim() : '';

  if (!name || !phone) {
    if (authError) {
      authError.innerText = 'لطفاً نام و شماره تماس خود را وارد کنید.';
      authError.classList.remove('hidden');
    } else {
      alert('لطفاً نام و شماره تماس خود را وارد کنید.');
    }
    return;
  }

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone })
    });

    if (res.ok) {
      currentUser = { name, phone };
      localStorage.setItem('avaye_user', JSON.stringify(currentUser));
      if (authError) authError.classList.add('hidden');
      showChatInterface();
    } else {
      const data = await res.json();
      if (authError) {
        authError.innerText = data.error || 'خطا در ثبت‌نام!';
        authError.classList.remove('hidden');
      }
    }
  } catch (err) {
    console.error('Registration Error:', err);
    if (authError) {
      authError.innerText = 'ارتباط با سرور برقرار نشد.';
      authError.classList.remove('hidden');
    }
  }
}

// نمایش/مخفی‌سازی مدال ورود و چت
function showAuthModal() {
  const authModal = document.getElementById('authModal');
  const chatContainer = document.getElementById('chatContainer');
  if (authModal) authModal.classList.remove('hidden');
  if (chatContainer) chatContainer.classList.add('hidden');
}

function showChatInterface() {
  const authModal = document.getElementById('authModal');
  const chatContainer = document.getElementById('chatContainer');
  const userDisplayName = document.getElementById('userDisplayName');

  if (authModal) authModal.classList.add('hidden');
  if (chatContainer) chatContainer.classList.remove('hidden');
  if (userDisplayName && currentUser) {
    userDisplayName.innerText = `${currentUser.name} (${currentUser.phone})`;
  }
}

// خروج کاربر
function handleLogout() {
  localStorage.removeItem('avaye_user');
  currentUser = null;
  location.reload();
}

// تغییر حالت بین گفتگو و تصویرسازی
function toggleImageMode() {
  isImageMode = !isImageMode;
  const imgBtn = document.getElementById('imageModeToggle');
  const messageInput = document.getElementById('messageInput');

  if (isImageMode) {
    if (imgBtn) imgBtn.classList.add('bg-amber-600', 'text-white');
    if (messageInput) messageInput.placeholder = 'توصیف تصوری که می‌خواهی بسازم را بنویس... 🎨';
  } else {
    if (imgBtn) imgBtn.classList.remove('bg-amber-600', 'text-white');
    if (messageInput) messageInput.placeholder = 'سوال دینی یا عمومی خود را بنویسید...';
  }
}

// ارسال پیام به ربات
async function sendMessage() {
  const messageInput = document.getElementById('messageInput');
  const chatBox = document.getElementById('chatMessages');

  if (!messageInput || !chatBox) return;

  const text = messageInput.value.trim();
  if (!text) return;

  // اضافه کردن پیام کاربر به صفحه
  appendUserMessage(text);
  messageInput.value = '';

  // ساخت کادر پیش‌فرض برای پاسخ ربات
  const botMessageEl = appendBotMessage('در حال پردازش و پاسخگویی... ⏳');

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
      botMessageEl.innerHTML = `<p class="text-red-400">⚠️ ${data.error || 'خطایی رخ داده است.'}</p>`;
      return;
    }

    // حالت دریافت تصویر
    if (data.isImage || data.imageUrl) {
      botMessageEl.innerHTML = `
        <p class="text-xs text-amber-300 font-medium mb-2">🎨 تصویر درخواستی شما ساخته شد:</p>
        <div class="w-64 h-64 rounded-xl overflow-hidden border border-amber-500/30 bg-slate-900 shadow-xl mb-2">
          <img src="${data.imageUrl}" alt="AI Image" class="w-full h-full object-cover" />
        </div>
        <a href="${data.imageUrl}" target="_blank" class="inline-block text-xs text-amber-400 hover:underline">🔗 مشاهده و دانلود کیفیت اصلی</a>
      `;
    } else {
      // حالت پاسخ متنی + دکمه خوانش صوتی
      const replyText = data.reply || 'پاسخی دریافت نشد.';
      botMessageEl.innerHTML = `
        <p class="text-sm text-slate-100 leading-relaxed">${escapeHtml(replyText)}</p>
        <button onclick="speakText(this, \`${escapeJsString(replyText)}\`)" class="text-xs text-amber-400 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 px-2.5 py-1 rounded-lg mt-3 inline-flex items-center gap-1.5 cursor-pointer transition">
          <span>🔊</span> پخش صوتی
        </button>
      `;
    }

    chatBox.scrollTop = chatBox.scrollHeight;

  } catch (err) {
    console.error('Chat Error:', err);
    botMessageEl.innerHTML = `<p class="text-red-400">⚠️ خطای شبکه یا عدم ارتباط با سرور.</p>`;
  }
}

// نمایش پیام کاربر در UI
function appendUserMessage(text) {
  const chatBox = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'flex justify-start mb-4';
  div.innerHTML = `
    <div class="bg-emerald-600/90 text-white p-3.5 rounded-2xl rounded-tr-none max-w-[85%] text-sm shadow-md">
      ${escapeHtml(text)}
    </div>
  `;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// ساخت کادر پیام ربات در UI
function appendBotMessage(initialText) {
  const chatBox = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'flex justify-end mb-4';

  const innerDiv = document.createElement('div');
  innerDiv.className = 'bg-slate-800/90 border border-slate-700/60 text-slate-200 p-3.5 rounded-2xl rounded-tl-none max-w-[85%] text-sm shadow-md';
  innerDiv.innerHTML = `<p class="text-slate-400 text-xs">${initialText}</p>`;

  div.appendChild(innerDiv);
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;

  return innerDiv;
}

// تابع هوشمند پخش صوتی پاسخ‌ها (TTS)
function speakText(buttonEl, text) {
  if (currentAudio && !currentAudio.paused) {
    currentAudio.pause();
    currentAudio = null;
    buttonEl.innerHTML = '<span>🔊</span> پخش صوتی';
    return;
  }

  // حذف ایموجی‌ها برای خوانش بهتر گوینده
  const cleanText = text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim();
  if (!cleanText) return;

  const encodedText = encodeURIComponent(cleanText.substring(0, 300));
  const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=fa&client=tw-ob`;

  currentAudio = new Audio(ttsUrl);
  currentAudio.playbackRate = parseFloat(botSettings.voiceSpeed || 1);

  buttonEl.innerHTML = '<span>⏹️</span> متوقف کردن';

  currentAudio.play().catch(err => {
    console.error('Audio playback error:', err);
    buttonEl.innerHTML = '<span>🔊</span> پخش صوتی';
  });

  currentAudio.onended = () => {
    buttonEl.innerHTML = '<span>🔊</span> پخش صوتی';
    currentAudio = null;
  };
}

// توابع کمکی امنیتی برای متن‌ها
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, function(m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m];
  });
}

function escapeJsString(str) {
  return str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
}
