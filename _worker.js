export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // ۱. ثبت‌نام کاربر جدید
      if (path === "/api/register" && request.method === "POST") {
        const { name, phone } = await request.json();
        if (!name || !phone) {
          return new Response(JSON.stringify({ error: "اطلاعات ناقص است" }), { status: 400, headers: corsHeaders });
        }
        
        try {
          let users = JSON.parse(await env.AVAYE_YAGHIN_KV.get("users") || "[]");
          if (!users.some(u => u.phone === phone)) {
            users.push({ name, phone, time: new Date().toLocaleString("fa-IR") });
            await env.AVAYE_YAGHIN_KV.put("users", JSON.stringify(users));
          }
        } catch (e) {}

        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // ۲. ارسال پیام و ارتباط با OpenRouter API
      if (path === "/api/chat" && request.method === "POST") {
        const { message, user } = await request.json();

        // بررسی مسدود بودن کاربر
        let blocked = [];
        try {
          blocked = JSON.parse(await env.AVAYE_YAGHIN_KV.get("blocked") || "[]");
        } catch (e) {}

        if (user?.phone && blocked.includes(user.phone)) {
          return new Response(JSON.stringify({ reply: "حساب کاربری شما در این سامانه مسدود شده است." }), { headers: corsHeaders });
        }

        // دریافت تنظیمات ادمین از KV
        let settings = {};
        try {
          settings = JSON.parse(await env.AVAYE_YAGHIN_KV.get("settings") || "{}");
        } catch (e) {}

        const systemPrompt = settings.systemPrompt || "تو دستیار هوشمند و متخصص دینی سامانه آوای یقین هستی. پاسخ‌ها باید کاملاً مستند، دقیق و به زبان فارسی روان باشند.";
        const selectedModel = settings.model || "openai/gpt-oss-20b";
        const temp = settings.temperature ?? 0.7;
        const maxTokens = settings.maxTokens ?? 1024;

        // فراخوانی OpenRouter API
        const openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
            "HTTP-Referer": request.headers.get("origin") || "https://avaye-yaghin.com",
            "X-Title": "Avaye Yaghin",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: message }
            ],
            temperature: temp,
            max_tokens: maxTokens
          })
        });

        const openRouterData = await openRouterRes.json();
        if (!openRouterRes.ok) {
          return new Response(JSON.stringify({ error: openRouterData.error?.message || "خطا در ارتباط با هوش مصنوعی OpenRouter" }), { status: 500, headers: corsHeaders });
        }
        
        const reply = openRouterData.choices?.[0]?.message?.content || "پاسخی از سرور دریافت نشد.";

        // ذخیره لاگ در KV
        try {
          let logs = JSON.parse(await env.AVAYE_YAGHIN_KV.get("chat_logs") || "[]");
          logs.unshift({
            userName: user?.name || "مهمان",
            userPhone: user?.phone || "نامشخص",
            question: message,
            reply: reply,
            time: new Date().toLocaleString("fa-IR")
          });
          if (logs.length > 100) logs = logs.slice(0, 100);
          await env.AVAYE_YAGHIN_KV.put("chat_logs", JSON.stringify(logs));
        } catch (e) {}

        return new Response(JSON.stringify({ reply }), { headers: corsHeaders });
      }

      // ۳. دریافت اطلاعات پنل ادمین
      if (path === "/api/admin/data" && request.method === "GET") {
        let users = [], logs = [], blocked = [], settings = {};
        try {
          users = JSON.parse(await env.AVAYE_YAGHIN_KV.get("users") || "[]");
          logs = JSON.parse(await env.AVAYE_YAGHIN_KV.get("chat_logs") || "[]");
          blocked = JSON.parse(await env.AVAYE_YAGHIN_KV.get("blocked") || "[]");
          settings = JSON.parse(await env.AVAYE_YAGHIN_KV.get("settings") || "{}");
        } catch (e) {}
        return new Response(JSON.stringify({ users, logs, blocked, settings }), { headers: corsHeaders });
      }

      // ۴. ذخیره تنظیمات ادمین
      if (path === "/api/admin/settings" && request.method === "POST") {
        const data = await request.json();
        await env.AVAYE_YAGHIN_KV.put("settings", JSON.stringify(data));
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // ۵. مسدود / فعال‌سازی کاربر
      if (path === "/api/admin/block" && request.method === "POST") {
        const { phone } = await request.json();
        let blocked = JSON.parse(await env.AVAYE_YAGHIN_KV.get("blocked") || "[]");
        if (blocked.includes(phone)) {
          blocked = blocked.filter(p => p !== phone);
        } else {
          blocked.push(phone);
        }
        await env.AVAYE_YAGHIN_KV.put("blocked", JSON.stringify(blocked));
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // ۶. پاکسازی کامل لاگ‌ها
      if (path === "/api/admin/clear-logs" && request.method === "POST") {
        await env.AVAYE_YAGHIN_KV.put("chat_logs", JSON.stringify([]));
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      return new Response("Not Found", { status: 404, headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
  }
};
