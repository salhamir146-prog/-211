let ADMIN_PASSCODE = localStorage.getItem("avaye_admin_pass") || "Amidhjsos62627@_897";
let currentUser = null;
let isImageModeActive = false;

document.addEventListener("DOMContentLoaded", async () => {
    const savedUser = localStorage.getItem("avaye_user");
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            document.getElementById("displayUserName").innerText = currentUser.name;
            document.getElementById("registrationModal").classList.add("hidden");
        } catch (e) {
            localStorage.removeItem("avaye_user");
        }
    }

    // استعلام فعال بودن قابلیت تصویرساز از سرور
    checkImageGenStatus();

    // سایدبار موبایل
    const menuToggle = document.getElementById("menuToggle");
    const sidebar = document.getElementById("sidebar");
    if (menuToggle && sidebar) {
        menuToggle.addEventListener("click", () => sidebar.classList.toggle("active"));
    }

    // فرم ثبت‌نام
    const onboardingForm = document.getElementById("onboardingForm");
    if (onboardingForm) {
        onboardingForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = document.getElementById("userNameInput").value.trim();
            const phone = document.getElementById("userPhoneInput").value.trim();
            if (name && phone) {
                currentUser = { name, phone };
                localStorage.setItem("avaye_user", JSON.stringify(currentUser));
                
                try {
                    await fetch("/api/register", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(currentUser)
                    });
                } catch (err) {
                    console.error("خطا در ثبت‌نام ابری:", err);
                }

                document.getElementById("displayUserName").innerText = name;
                document.getElementById("registrationModal").classList.add("hidden");
                showToast("ورود با موفقیت انجام شد! خوش آمدید.");
            }
        });
    }

    // دکمه تغییر حالت ساخت تصویر
    const imageModeBtn = document.getElementById("imageModeBtn");
    if (imageModeBtn) {
        imageModeBtn.addEventListener("click", () => {
            isImageModeActive = !isImageModeActive;
            if (isImageModeActive) {
                imageModeBtn.classList.remove("bg-amber-400/10", "text-amber-300");
                imageModeBtn.classList.add("bg-amber-500", "text-slate-950", "shadow-lg", "shadow-amber-500/30", "scale-105");
                showToast("حالت ساخت تصویر فعال شد. توصیف تصویر را بنویسید.");
            } else {
                imageModeBtn.classList.remove("bg-amber-500", "text-slate-950", "shadow-lg", "shadow-amber-500/30", "scale-105");
                imageModeBtn.classList.add("bg-amber-400/10", "text-amber-300");
                showToast("حالت گفتگو متنی فعال شد.");
            }
        });
    }

    // ارسال پیام چت
    const chatForm = document.getElementById("chatForm");
    const chatInput = document.getElementById("chatInput");
    if (chatForm && chatInput) {
        chatForm.addEventListener("submit", (e) => {
            e.preventDefault();
            handleUserMessage();
        });
        chatInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleUserMessage();
            }
        });
    }

    // دکمه گفتگوی جدید
    document.getElementById("newChatBtn")?.addEventListener("click", () => {
        document.getElementById("messagesArea").innerHTML = "";
        document.getElementById("welcomeScreen").style.display = "flex";
        showToast("گفتگوی جدید آماده شد.");
    });

    // دکمه ورود به پنل مدیریت
    const adminTrigger = document.getElementById("adminTriggerBtn");
    if (adminTrigger) {
        adminTrigger.addEventListener("click", () => {
            const pass = prompt("لطفاً رمز عبور پنل مدیریت را وارد کنید:");
            if (pass === null) return;
            if (pass.trim() === (localStorage.getItem("avaye_admin_pass") || ADMIN_PASSCODE).trim()) {
                window.location.href = "admin.html";
            } else {
                showToast("رمز عبور اشتباه است!");
            }
        });
    }
});

async function checkImageGenStatus() {
    try {
        const res = await fetch("/api/config");
        const data = await res.json();
        const btn = document.getElementById("imageModeBtn");
        if (btn && data.imageGenEnabled) {
            btn.classList.remove("hidden");
        }
    } catch (e) {}
}

function sendSuggestion(text) {
    const chatInput = document.getElementById("chatInput");
    if (chatInput) {
        chatInput.value = text;
        handleUserMessage();
    }
}

async function handleUserMessage() {
    const chatInput = document.getElementById("chatInput");
    const text = chatInput.value.trim();
    if (!text) return;

    const isImageMode = isImageModeActive;
    chatInput.value = "";
    document.getElementById("welcomeScreen").style.display = "none";
    
    appendMessage(text, "user");

    // بررسی رمز ادمین
    const currentPass = localStorage.getItem("avaye_admin_pass") || ADMIN_PASSCODE;
    if (text === currentPass || text === "Amidhjsos62627@_897") {
        appendMessage("رمز مدیریت تأیید شد. در حال انتقال به پنل مدیریت...", "ai");
        showToast("انتقال به پنل مدیریت...");
        setTimeout(() => { window.location.href = "admin.html"; }, 1200);
        return;
    }

    // اگر حالت تصویرساز بود، ابتدا کادر مربعی چت‌جی‌پاتی جای‌گذاری می‌شود
    let aiBubble;
    if (isImageMode) {
        aiBubble = appendMessage("", "ai");
        aiBubble.innerHTML = `
            <div class="space-y-3 w-full max-w-[320px] sm:max-w-[380px]">
                <p class="text-xs text-amber-300 font-bold flex items-center gap-2">
                    <i class="fa-solid fa-spinner animate-spin"></i>
                    در حال خلق تصویر با هوش مصنوعی...
                </p>
                <!-- کادر مربعی با افکت لودینگ چت‌جی‌پاتی -->
                <div id="imgPlaceholder" class="relative w-full aspect-square rounded-2xl bg-slate-800/80 border border-white/10 overflow-hidden flex flex-col items-center justify-center shadow-2xl">
                    <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse"></div>
                    <i class="fa-solid fa-wand-magic-sparkles text-4xl text-amber-400/50 animate-bounce mb-3"></i>
                    <span class="text-xs text-slate-400 font-medium animate-pulse">لطفاً چند ثانیه شکیبا باشید...</span>
                </div>
            </div>
        `;
    } else {
        aiBubble = appendMessage("در حال پردازش و استعلام پاسخ معتبر...", "ai");
    }

    try {
        const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text, user: currentUser, isImageMode: isImageMode })
        });
        
        if (!res.ok) {
            throw new Error("خطا در پاسخ سرور");
        }

        const data = await res.json();

        if (data.isImage && data.imageUrl) {
            const imgId = "img_" + Math.random().toString(36).substring(2, 9);
            
            // جایگزینی کادر لودینگ مربعی با تصویر اصلی
            aiBubble.innerHTML = `
                <div class="space-y-3 w-full max-w-[320px] sm:max-w-[380px]">
                    <p class="text-xs text-amber-300 font-bold flex items-center gap-1.5">
                        <i class="fa-solid fa-sparkles text-amber-400"></i>
                        تصویر تولید شده با آوای یقین:
                    </p>
                    
                    <!-- کادر مربعی چت‌جی‌پاتی برای تصویر -->
                    <div class="relative w-full aspect-square rounded-2xl bg-slate-900 border border-amber-500/20 overflow-hidden shadow-2xl group">
                        <!-- تصویر واقعی -->
                        <img id="${imgId}" src="${data.imageUrl}" alt="Generated AI Image" class="w-full h-full object-cover rounded-2xl transition duration-500 hover:scale-105" 
                             onload="document.getElementById('${imgId}_loader').style.display='none'"
                             onerror="this.src='https://via.placeholder.com/512?text=Error+Loading+Image'"/>
                        
                        <!-- انیمیشن لودینگ روی خود عکس تا زمان لود کامل مرورگر -->
                        <div id="${imgId}_loader" class="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center gap-2">
                            <i class="fa-solid fa-circle-notch animate-spin text-amber-400 text-2xl"></i>
                            <span class="text-[11px] text-slate-400">در حال دریافت پیکسل‌ها...</span>
                        </div>
                    </div>

                    <div class="flex items-center justify-between gap-2 pt-1 bg-black/20 p-2.5 rounded-xl border border-white/5">
                        <span class="text-[10px] text-slate-400 truncate max-w-[200px]" title="${data.translatedPrompt}">🔤 ${data.translatedPrompt}</span>
                        <button onclick="downloadImage('${data.imageUrl}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-lg cursor-pointer">
                            <i class="fa-solid fa-download text-xs"></i> دانلود
                        </button>
                    </div>
                </div>
            `;
        } else {
            aiBubble.innerText = data.reply || "پاسخی دریافت نشد.";
        }
    } catch (err) {
        aiBubble.innerText = "خطا در ارتباط با سرور ابری. لطفاً اتصال خود را بررسی کنید.";
    }
}

// تابع اختصاصی دانلود تصویر بدون مشکل CORS
async function downloadImage(url) {
    try {
        showToast("در حال آماده‌سازی فایل دانلود...");
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `avaye-yaghin-${Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        showToast("دانلود با موفقیت انجام شد!");
    } catch (error) {
        window.open(url, "_blank");
    }
}

function appendMessage(text, sender) {
    const messagesArea = document.getElementById("messagesArea");
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${sender}`;
    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content";
    contentDiv.innerText = text;
    messageDiv.appendChild(contentDiv);
    messagesArea.appendChild(messageDiv);
    
    const chatContainer = document.getElementById("chatContainer");
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return contentDiv;
}

function showToast(message) {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
}
