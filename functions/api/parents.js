export async function onRequestPost(context) {
    try {
        const { request, env } = context;
        const formData = await request.formData();
        
        // Extract form data
        const data = {
            full_name: formData.get('full_name'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            baby_timing: formData.get('baby_timing'),
            start_timeframe: formData.get('start_timeframe'),
            notes: formData.get('notes'),
            updates_opt_in: formData.get('updates_opt_in') === 'on',
            company: formData.get('company') // honeypot
        };
        
        // Validation
        const errors = [];
        
        if (!data.full_name || data.full_name.trim().length === 0) {
            errors.push('Full name is required');
        }
        
        if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            errors.push('Valid email is required');
        }
        
        if (!data.start_timeframe) {
            errors.push('Start timeframe is required');
        }
        
        // Honeypot check
        if (data.company && data.company.length > 0) {
            errors.push('Bot detected');
        }
        
        if (errors.length > 0) {
            return new Response(JSON.stringify({ error: errors[0] }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Store in Cloudflare KV (you'll need to bind this in wrangler.toml)
        if (env.TAHOE_KV) {
            const id = Date.now().toString();
            await env.TAHOE_KV.put(`parent:${id}`, JSON.stringify({
                ...data,
                created_at: new Date().toISOString()
            }));
        }
        
        // Send email notification (optional - requires email service setup)
        // You can integrate with services like SendGrid, Mailgun, etc.
        
        // Redirect to thank you page
        return Response.redirect('/thank-you', 302);
        
    } catch (error) {
        console.error('Error processing parent form:', error);
        return new Response(JSON.stringify({ 
            error: 'We couldn\'t submit right now. Please try again shortly.' 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}