export async function onRequestPost(context) {
    try {
        const { request, env } = context;
        const formData = await request.formData();
        
        // Extract form data
        const email = formData.get('email');
        const company = formData.get('company'); // honeypot
        
        // Honeypot check
        if (company && company.length > 0) {
            return new Response(JSON.stringify({ error: 'Bot detected' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Validate email
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return new Response(JSON.stringify({ error: 'Valid email is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Store in Cloudflare KV (you'll need to bind this in wrangler.toml)
        if (env.TAHOE_KV) {
            const id = Date.now().toString();
            await env.TAHOE_KV.put(`newsletter:${id}`, JSON.stringify({
                email,
                created_at: new Date().toISOString()
            }));
        }
        
        // Redirect to thank you page
        return Response.redirect('/thank-you', 302);
        
    } catch (error) {
        console.error('Error processing newsletter signup:', error);
        return new Response(JSON.stringify({ 
            error: 'We couldn\'t submit right now. Please try again shortly.' 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}