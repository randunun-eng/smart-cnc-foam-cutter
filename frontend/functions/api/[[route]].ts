interface Env {
    AI: any;
    MACHINE_KV: KVNamespace;
    ALERT_WEBHOOK_URL: string;
}

interface EventPayload {
    machineId: string;
    severity: "info" | "warning" | "error" | "critical";
    type: string;
    message: string;
    timestamp: number;
    extra?: any;
}

export const onRequest: PagesFunction<Env> = async (context) => {
    const { request, env } = context;
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    // --- AI Slicer Endpoint ---
    // Route: /api/slicer
    if (request.method === "POST" && url.pathname.endsWith("/slicer")) {
        try {
            let userPrompt = "";
            let imageInput: number[] | null = null;

            const contentType = request.headers.get("content-type") || "";

            if (contentType.includes("multipart/form-data")) {
                const formData = await request.formData();
                const promptPart = formData.get("prompt");
                const imagePart = formData.get("image");

                if (promptPart) userPrompt = promptPart.toString();

                if (imagePart && imagePart instanceof File) {
                    const arrayBuffer = await imagePart.arrayBuffer();
                    imageInput = [...new Uint8Array(arrayBuffer)];

                    // 1. Analyze Image with Llava
                    const llavaResponse = await env.AI.run("@cf/llava-hf/llava-1.5-7b-hf", {
                        image: imageInput,
                        prompt: "Describe this 2D shape in detail for a CNC foam cutter. Mention geometry, dimensions if visible, and complexity."
                    });

                    userPrompt = `Based on this image description: "${llavaResponse.description}". ${userPrompt}`;
                }

            } else {
                const body = await request.json() as { prompt: string };
                userPrompt = body.prompt;
            }

            if (!userPrompt) {
                return new Response("Missing prompt", { status: 400, headers: corsHeaders });
            }

            const systemPrompt = `You are a G-code generator for a CNC foam cutter.
      Output a JSON object containing:
      - "gcode": The G-code string. Use standard format (e.g., "G1 X10 Y10 F300"). Do NOT repeat commands on the same line (e.g., avoid "G1 F300 G1 X...").
      - "feed_rate": Recommended feed rate (mm/min, e.g., 300).
      - "heat_duty": Recommended wire heat duty cycle (0-100, e.g., 45).
      - "material": The material type inferred or default to "EPS".
      - "estimated_time": Estimated time in seconds (optional).
      Return ONLY the JSON object, no markdown formatting.`;

            const response = await env.AI.run("@cf/meta/llama-3-8b-instruct", {
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ]
            });

            // Attempt to parse JSON if Llama wraps it in text
            let jsonResponse = response;
            if (typeof response === 'string') {
                try {
                    // Try to find JSON block if mixed with text
                    const match = response.match(/\{[\s\S]*\}/);
                    if (match) {
                        jsonResponse = JSON.parse(match[0]);
                    } else {
                        jsonResponse = JSON.parse(response);
                    }
                } catch (e) {
                    // Fallback if parsing fails
                    jsonResponse = { gcode: response, feed_rate: 300, heat_duty: 40, material: "Unknown" };
                }
            } else if (response.response) {
                // Handle case where response is { response: "..." }
                try {
                    const match = response.response.match(/\{[\s\S]*\}/);
                    if (match) {
                        jsonResponse = JSON.parse(match[0]);
                    } else {
                        // Fallback if no JSON found in text
                        jsonResponse = { gcode: response.response, feed_rate: 300, heat_duty: 40, material: "Unknown" };
                    }
                } catch (e) {
                    // Fallback if parsing fails
                    jsonResponse = { gcode: response.response, feed_rate: 300, heat_duty: 40, material: "Unknown" };
                }
            }

            return new Response(JSON.stringify(jsonResponse), {
                headers: { "content-type": "application/json", ...corsHeaders }
            });

        } catch (e) {
            return new Response(`Error: ${e}`, { status: 500, headers: corsHeaders });
        }
    }

    // --- Watcher: Event Ingestion ---
    // Route: /api/event
    if (request.method === "POST" && url.pathname.endsWith("/event")) {
        try {
            const event = await request.json() as EventPayload;
            const { machineId, severity, type, timestamp } = event;

            // Store last event
            await env.MACHINE_KV.put(`machine:${machineId}:lastEvent`, JSON.stringify(event));

            // Store heartbeat
            if (type === "heartbeat") {
                await env.MACHINE_KV.put(`machine:${machineId}:heartbeat`, timestamp.toString());
            }

            // Alert on error/critical
            if (severity === "error" || severity === "critical") {
                await sendAlert(env, event);
            }

            return new Response(JSON.stringify({ status: "ok" }), {
                headers: { "content-type": "application/json", ...corsHeaders }
            });
        } catch (e) {
            return new Response(`Error: ${e}`, { status: 500, headers: corsHeaders });
        }
    }

    // --- Watcher: Status Check ---
    // Route: /api/machine_status
    if (request.method === "GET" && url.pathname.endsWith("/machine_status")) {
        const machineId = url.searchParams.get("machineId");
        if (!machineId) return new Response("Missing machineId", { status: 400, headers: corsHeaders });

        const lastEventStr = await env.MACHINE_KV.get(`machine:${machineId}:lastEvent`);
        const lastHeartbeatStr = await env.MACHINE_KV.get(`machine:${machineId}:heartbeat`);

        const lastEvent = lastEventStr ? JSON.parse(lastEventStr) : null;
        const lastHeartbeat = lastHeartbeatStr ? parseInt(lastHeartbeatStr) : 0;

        // Online if heartbeat within last 3 minutes (180000ms)
        const isOnline = (Date.now() - lastHeartbeat) < 180000;

        return new Response(JSON.stringify({
            machineId,
            online: isOnline,
            lastEvent,
            lastHeartbeat
        }), { headers: { "content-type": "application/json", ...corsHeaders } });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
};

async function sendAlert(env: Env, event: EventPayload) {
    if (!env.ALERT_WEBHOOK_URL) return;

    try {
        await fetch(env.ALERT_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text: `[${event.severity.toUpperCase()}] ${event.machineId}: ${event.message} (${event.type})`
            })
        });
    } catch (e) {
        console.error("Failed to send alert", e);
    }
}
