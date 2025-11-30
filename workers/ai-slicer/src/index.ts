export interface Env {
    AI: any;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        // CORS headers
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        if (request.method !== "POST") {
            return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
        }

        const url = new URL(request.url);
        if (url.pathname !== "/slicer") {
            return new Response("Not Found", { status: 404, headers: corsHeaders });
        }

        try {
            const body = await request.json() as { prompt: string };
            const userPrompt = body.prompt;

            if (!userPrompt) {
                return new Response("Missing prompt", { status: 400, headers: corsHeaders });
            }

            const systemPrompt = "You are a G-code generator for a CNC foam cutter. Output ONLY the G-code. Assume the machine is at (0,0). Use G1 for cuts. Use F300 for feed rate. Do not use Z-axis. Return only plain text.";

            const response = await env.AI.run("@cf/meta/llama-3-8b-instruct", {
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ]
            });

            return new Response(JSON.stringify(response), {
                headers: { "content-type": "application/json", ...corsHeaders }
            });

        } catch (e) {
            return new Response(`Error: ${e}`, { status: 500, headers: corsHeaders });
        }
    }
};
