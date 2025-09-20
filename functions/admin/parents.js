export async function onRequestGet(context) {
    const { request, env } = context;
    
    // Basic auth check
    const authorization = request.headers.get('Authorization');
    if (!authorization || !isValidAuth(authorization, env)) {
        return new Response('Access denied', {
            status: 401,
            headers: {
                'WWW-Authenticate': 'Basic realm="Admin Area"',
                'Content-Type': 'text/plain'
            }
        });
    }
    
    try {
        // Get all parent leads from KV
        const parents = await getAllParents(env.TAHOE_KV);
        
        // Generate HTML page
        const html = generateParentsHTML(parents);
        
        return new Response(html, {
            headers: { 'Content-Type': 'text/html' }
        });
    } catch (error) {
        console.error('Admin parents error:', error);
        return new Response('Internal server error', { status: 500 });
    }
}

function isValidAuth(authorization, env) {
    if (!authorization.startsWith('Basic ')) return false;
    
    const credentials = atob(authorization.slice(6));
    const [username, password] = credentials.split(':');
    
    return username === env.BASIC_AUTH_USER && password === env.BASIC_AUTH_PASS;
}

async function getAllParents(kv) {
    if (!kv) return [];
    
    try {
        const keys = await kv.list({ prefix: 'parent:' });
        const parents = [];
        
        for (const key of keys.keys) {
            const data = await kv.get(key.name, 'json');
            if (data) {
                parents.push({
                    id: key.name.split(':')[1],
                    ...data,
                    created_at_formatted: new Date(data.created_at).toLocaleDateString(),
                    first_name: data.full_name?.split(' ')[0] || '',
                    last_name: data.full_name?.split(' ').slice(1).join(' ') || ''
                });
            }
        }
        
        return parents.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } catch (error) {
        console.error('Error getting parents:', error);
        return [];
    }
}

function generateParentsHTML(parents) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Parent Leads - Admin - Tahoe Night Nurse</title>
    <meta name="description" content="Parent leads admin dashboard">
    
    <!-- Google Fonts - Lato -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900&display=swap" rel="stylesheet">
    
    <!-- Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        'sans': ['Lato', 'system-ui', 'sans-serif'],
                    },
                    colors: {
                        'navy': {
                            50: '#f8fafc',
                            100: '#f1f5f9',
                            200: '#e2e8f0',
                            300: '#cbd5e1',
                            400: '#94a3b8',
                            500: '#64748b',
                            600: '#475569',
                            700: '#334155',
                            800: '#1e293b',
                            900: '#0f172a',
                        }
                    }
                }
            }
        }
    </script>
    
    <style>
        body {
            font-family: 'Lato', system-ui, sans-serif;
            line-height: 1.6;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
        }
    </style>
</head>
<body class="bg-gray-50 font-sans">
    <div class="flex min-h-screen">
        <!-- Sidebar -->
        <div class="w-64 bg-navy-800 text-white">
            <div class="p-6">
                <h1 class="text-xl font-semibold text-white">TNN Admin</h1>
            </div>
            
            <nav class="mt-6">
                <a href="/admin" class="flex items-center px-6 py-3 text-navy-300 hover:text-white hover:bg-navy-700 transition-colors">
                    <span>Dashboard</span>
                </a>
                <a href="/admin/parents" class="flex items-center px-6 py-3 text-white bg-navy-700 border-r-4 border-blue-500">
                    <span>Parent Leads</span>
                </a>
                <a href="/admin/caregivers" class="flex items-center px-6 py-3 text-navy-300 hover:text-white hover:bg-navy-700 transition-colors">
                    <span>Caregivers</span>
                </a>
                <a href="/" target="_blank" class="flex items-center px-6 py-3 text-navy-300 hover:text-white hover:bg-navy-700 transition-colors">
                    <span>View Site</span>
                </a>
            </nav>
        </div>

        <!-- Main Content -->
        <div class="flex-1">
            <div class="p-8">
                <div class="flex justify-between items-center mb-8">
                    <h1 class="text-3xl font-light text-gray-800">Parent Leads</h1>
                    <div class="text-sm text-gray-600">
                        Total: ${parents.length} leads
                    </div>
                </div>
                
                <!-- Parents Table -->
                <div class="bg-white rounded-lg shadow-sm">
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead class="bg-gray-50">
                                <tr class="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    <th class="px-6 py-3">Date</th>
                                    <th class="px-6 py-3">Name</th>
                                    <th class="px-6 py-3">Email</th>
                                    <th class="px-6 py-3">Phone</th>
                                    <th class="px-6 py-3">Baby Timing</th>
                                    <th class="px-6 py-3">Start Timeframe</th>
                                    <th class="px-6 py-3">Notes</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                ${parents.length > 0 ? 
                                    parents.map(parent => `
                                    <tr class="hover:bg-gray-50">
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            ${parent.created_at_formatted}
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap">
                                            <div class="text-sm font-medium text-gray-900">${parent.full_name || 'N/A'}</div>
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap">
                                            <div class="text-sm text-gray-900">
                                                <a href="mailto:${parent.email}" class="text-blue-600 hover:text-blue-800">
                                                    ${parent.email || 'N/A'}
                                                </a>
                                            </div>
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            ${parent.phone || 'N/A'}
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            ${parent.baby_timing || 'N/A'}
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            ${parent.start_timeframe || 'N/A'}
                                        </td>
                                        <td class="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                                            ${parent.notes || 'None'}
                                        </td>
                                    </tr>
                                    `).join('') :
                                `<tr>
                                    <td colspan="7" class="px-6 py-12 text-center text-gray-500">
                                        <div class="text-lg mb-2">No parent leads yet</div>
                                        <div class="text-sm">Parent submissions will appear here once they start coming in.</div>
                                    </td>
                                </tr>`}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;
}