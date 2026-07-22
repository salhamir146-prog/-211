let ADMIN_PASSCODE = localStorage.getItem("avaye_admin_pass") || "Amidhjsos62627@_897";
let currentUser = null;

document.addEventListener("DOMContentLoaded", () => {
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

    // سایدبار موبایل
    const menuToggle = document.getElementById("menuToggle");
    const sidebar = document.getElementById("sidebar");
    if (menuToggle && sidebar) {
        menuToggle.addEventListener("click", () => sidebar.classList.toggle("active"));
    }

    // فرم ثبت‌نام و ارسال به سرور ابری
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

    chatInput.value = "";
    document.getElementById("welcomeScreen").style.display = "none";
    appendMessage(text, "user");

    // بررسی رمز ادمین در چت
    const currentPass = localStorage.getItem("avaye_admin_pass") || ADMIN_PASSCODE;
    if (text === currentPass || text === "Amidhjsos62627@_897") {
        appendMessage("رمز مدیریت تأیید شد. در حال انتقال به پنل مدیریت...", "ai");
        showToast("انتقال به پنل مدیریت...");
        setTimeout(() => { window.location.href = "admin.html"; }, 1200);
        return;
    }

    const aiBubble = appendMessage("در حال پردازش و استعلام پاسخ معتبر...", "ai");

    try {
        const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text, user: currentUser })
        });
        
        if (!res.ok) {
            throw new Error("خطا در پاسخ سرور");
        }

        const data = await res.json();
        aiBubble.innerText = data.reply || "پاسخی دریافت نشد.";
    } catch (err) {
        aiBubble.innerText = "خطا در ارتباط با سرور ابری. لطفاً اتصال خود را بررسی کنید.";
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
