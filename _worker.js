export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json; charset=utf-8"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // ۱. دریافت کانفیگ اولیه برای فرانت‌اند
    if (path === "/api/config" && request.method === "GET") {
      let settings = {};
      try {
        settings = JSON.parse(await env.AVAYE_YAGHIN_KV.get("settings") || "{}");
      } catch (e) {}
      return new Response(JSON.stringify({ 
        imageGenEnabled: !!settings.imageGenEnabled,
        voiceGender: settings.voiceGender || "female",
        voiceSpeed: settings.voiceSpeed || "1"
      }), { headers: corsHeaders });
    }

    // ۲. دریافت تنظیمات و لاگ‌ها برای پنل ادمین
    if (path === "/api/admin/data" && request.method === "GET") {
      let settings = {};
      let logs = [];
      try {
        settings = JSON.parse(await env.AVAYE_YAGHIN_KV.get("settings") || "{}");
        logs = JSON.parse(await env.AVAYE_YAGHIN_KV.get("logs") || "[]");
      } catch (e) {}
      return new Response(JSON.stringify({ settings, logs }), { headers: corsHeaders });
    }

    // ۳. ذخیره تنظیمات جدید در ادمین
    if (path === "/api/admin/settings" && request.method === "POST") {
      try {
        const body = await request.json();
        await env.AVAYE_YAGHIN_KV.put("settings", JSON.stringify(body));
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
      }
    }

    // ۴. اندپوینت پردازش چت هوش مصنوعی
    if (path === "/api/chat" && request.method === "POST") {
      try {
        const { message } = await request.json();
        let settings = {};
        try {
          settings = JSON.parse(await env.AVAYE_YAGHIN_KV.get("settings") || "{}");
        } catch (e) {}

        const groqKey = settings.groqApiKey || env.GROQ_API_KEY;
        const openrouterKey = settings.openrouterKey || env.OPENROUTER_API_KEY;

        // تشخیص درخواست عکس با کلمات کلیدی
        const isImageRequest = settings.imageGenEnabled && (
          message.includes("عکس") || message.includes("تصویر") || message.includes("بکش") || message.includes("طراحی کن")
        );

        let finalResponse = "";
        let responseType = "text";

        if (isImageRequest) {
          responseType = "image";
          const imagePrompt = encodeURIComponent(message);
          finalResponse = `https://image.pollinations.ai/prompt/${imagePrompt}?width=800&height=800&nologo=true`;
        } else {
          // ارسال به API چت
          if (groqKey) {
            try {
              const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: "llama-3.3-70b-versatile",
                  messages: [{ role: "user", content: message }]
                })
              });
              if (res.ok) {
                const data = await res.json();
                finalResponse = data.choices[0].message.content;
              }
            } catch (err) {}
          }

          // سوئیچ هوشمند به OpenRouter در صورت عدم دریافت پاسخ
          if (!finalResponse && openrouterKey) {
            try {
              const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${openrouterKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: "meta-llama/llama-3.3-70b-instruct:free",
                  messages: [{ role: "user", content: message }]
                })
              });
              if (res.ok) {
                const data = await res.json();
                finalResponse = data.choices[0].message.content;
              }
            } catch (err) {}
          }

          if (!finalResponse) {
            finalResponse = "متأسفانه کلیدهای API تنظیم نشده‌اند یا با خطا مواجه شدند.";
          }
        }

        // ثبت لاگ تعامل
        try {
          let logs = JSON.parse(await env.AVAYE_YAGHIN_KV.get("logs") || "[]");
          logs.unshift({
            timestamp: new Date().toISOString(),
            prompt: message,
            response: finalResponse,
            type: responseType
          });
          if (logs.length > 50) logs = logs.slice(0, 50);
          await env.AVAYE_YAGHIN_KV.put("logs", JSON.stringify(logs));
        } catch (e) {}

        return new Response(JSON.stringify({ reply: finalResponse, isImage: responseType === "image" }), { headers: corsHeaders });

      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    return new Response("Not Found", { status: 404 });
  }
};
