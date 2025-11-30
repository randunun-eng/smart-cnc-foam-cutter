export interface Env {
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

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        // CORS
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        if (request.method === "POST" && url.pathname === "/event") {
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

        if (request.method === "GET" && url.pathname === "/machine_status") {
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
    },

    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
        // Check for offline machines
        // For now, hardcoded machineId as per prompt
        const machineId = "foam-cnc-01";
        const lastHeartbeatStr = await env.MACHINE_KV.get(`machine:${machineId}:heartbeat`);

        if (lastHeartbeatStr) {
            const lastHeartbeat = parseInt(lastHeartbeatStr);
            // If older than 5 minutes (300000ms)
            if (Date.now() - lastHeartbeat > 300000) {
                await sendAlert(env, {
                    machineId,
                    severity: "critical",
                    type: "offline_monitor",
                    message: "Machine appears to be offline (no heartbeat > 5m)",
                    timestamp: Date.now()
                });
            }
        }
    }
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
