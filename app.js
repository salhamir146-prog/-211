let botSettings = { voiceGender: 'female', voiceSpeed: '1' };
let currentAudio = null;

// دریافت کانفیگ اولیه از بک‌اند
async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      botSettings = await res.json();
    }
  } catch (e) {
    console.log("نتوانست تنظیمات اولیه را دریافت کند.");
  }
}

// تابع پخش صوتی پاسخ‌های متنی با Google TTS و سرعت/لحن سفارشی
function speakText(buttonEl, text) {
  // اگر در حال پخش بود، متوقف شود
  if (currentAudio && !currentAudio.paused) {
    currentAudio.pause();
    currentAudio = null;
    buttonEl.innerHTML = "🔊 خوانش صوتی";
    return;
  }

  // حذف کاراکترهای علامت‌گذاری و ایموجی برای خوانش تمیزتر
  const cleanText = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
  if (!cleanText) return;

  // استفاده از API هوشمند گوگل برای صوتی ساختن متن فارسی
  const encodedText = encodeURIComponent(cleanText.substring(0, 200)); // تا ۲۰۰ کاراکتر اول برای سرعت بالا
  const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=fa&client=tw-ob`;

  currentAudio = new Audio(ttsUrl);
  currentAudio.playbackRate = parseFloat(botSettings.voiceSpeed || 1);

  buttonEl.innerHTML = "⏹️ در حال پخش...";

  currentAudio.play().catch(err => {
    console.error("خطا در پخش صدا:", err);
    buttonEl.innerHTML = "🔊 خوانش صوتی";
  });

  currentAudio.onended = () => {
    buttonEl.innerHTML = "🔊 خوانش صوتی";
    currentAudio = null;
  };
}

// اضافه کردن پیام به چت روم
function appendMessage(sender, text, isImage = false) {
  const chatContainer = document.getElementById('chatContainer');
  const msgDiv = document.createElement('div');
  msgDiv.className = `flex flex-col ${sender === 'user' ? 'items-end' : 'items-start'} my-2`;

  let innerHTML = '';
  if (sender === 'user') {
    innerHTML = `<div class="bg-emerald-600 text-white p-3 rounded-2xl rounded-tl-none max-w-[80%] text-sm shadow-md">${text}</div>`;
  } else {
    if (isImage) {
      innerHTML = `<div class="bg-slate-800 text-slate-100 p-2 rounded-2xl rounded-tr-none max-w-[85%] border border-slate-700 shadow-md">
        <img src="${text}" alt="تصویر تولید شده" class="rounded-xl w-full h-auto mb-2 loading="lazy"">
      </div>`;
    } else {
      const msgId = 'msg_' + Date.now();
      innerHTML = `
        <div class="bg-slate-800 text-slate-100 p-3.5 rounded-2xl rounded-tr-none max-w-[85%] border border-slate-700 shadow-md space-y-2">
          <p class="text-sm leading-relaxed">${text}</p>
          <div class="pt-2 border-t border-slate-700/60 flex items-center justify-between">
            <button onclick="speakText(this, \`${text.replace(/`/g, "\\`")}\`)" class="flex items-center gap-1 text-[11px] bg-slate-700/80 hover:bg-slate-700 text-amber-400 px-2.5 py-1 rounded-lg transition active:scale-95 border border-slate-600/50">
              🔊 خوانش صوتی
            </button>
          </div>
        </div>
      `;
    }
  }

  msgDiv.innerHTML = innerHTML;
  chatContainer.appendChild(msgDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// ارسال پیام به ورکر
async function sendMessage() {
  const inputEl = document.getElementById('userInput');
  const query = inputEl.value.trim();
  if (!query) return;

  appendMessage('user', query);
  inputEl.value = '';

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: query })
    });

    const data = await res.json();
    if (data.isImage) {
      appendMessage('bot', data.reply, true);
    } else {
      appendMessage('bot', data.reply, false);
    }
  } catch (err) {
    appendMessage('bot', 'متأسفانه در دریافت پاسخ مشکلی پیش آمد.');
  }
}

window.onload = loadConfig;
