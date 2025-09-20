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
        // Get data from KV
        const stats = await getStats(env.TAHOE_KV);
        const recentParents = await getRecentParents(env.TAHOE_KV, 10);
        const recentCaregivers = await getRecentCaregivers(env.TAHOE_KV, 10);
        
        // Generate HTML dashboard
        const html = generateDashboardHTML(stats, recentParents, recentCaregivers);
        
        return new Response(html, {
            headers: { 'Content-Type': 'text/html' }
        });
    } catch (error) {
        console.error('Admin dashboard error:', error);
        return new Response('Internal server error', { status: 500 });
    }
}

function isValidAuth(authorization, env) {
    if (!authorization.startsWith('Basic ')) return false;
    
    const credentials = atob(authorization.slice(6));
    const [username, password] = credentials.split(':');
    
    return username === env.BASIC_AUTH_USER && password === env.BASIC_AUTH_PASS;
}

async function getStats(kv) {
    const stats = {
        totalParents: 0,
        totalCaregivers: 0,
        parentsThisWeek: 0,
        caregiversThisWeek: 0,
        totalSubmissions: 0,
        supplyDemandRatio: 0
    };
    
    if (!kv) return stats;
    
    try {
        // Get all keys to count
        const parentKeys = await kv.list({ prefix: 'parent:' });
        const caregiverKeys = await kv.list({ prefix: 'caregiver:' });
        
        stats.totalParents = parentKeys.keys.length;
        stats.totalCaregivers = caregiverKeys.keys.length;
        stats.totalSubmissions = stats.totalParents + stats.totalCaregivers;
        
        // Calculate this week's counts
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        for (const key of parentKeys.keys) {
            const data = await kv.get(key.name, 'json');
            if (data && new Date(data.created_at) > weekAgo) {
                stats.parentsThisWeek++;
            }
        }
        
        for (const key of caregiverKeys.keys) {
            const data = await kv.get(key.name, 'json');
            if (data && new Date(data.created_at) > weekAgo) {
                stats.caregiversThisWeek++;
            }
        }
        
        // Calculate supply/demand ratio
        if (stats.totalParents > 0) {
            stats.supplyDemandRatio = Math.round((stats.totalCaregivers / stats.totalParents) * 100);
        }
    } catch (error) {
        console.error('Error getting stats:', error);
    }
    
    return stats;
}

async function getRecentParents(kv, limit = 10) {
    if (!kv) return [];
    
    try {
        const keys = await kv.list({ prefix: 'parent:' });
        const recent = [];
        
        for (const key of keys.keys.slice(0, limit)) {
            const data = await kv.get(key.name, 'json');
            if (data) {
                recent.push({
                    ...data,
                    created_at_formatted: new Date(data.created_at).toLocaleDateString(),
                    first_name: data.full_name?.split(' ')[0] || '',
                    last_name: data.full_name?.split(' ').slice(1).join(' ') || '',
                    location: data.location || 'Not specified',
                    timeframe: data.start_timeframe || 'Not specified'
                });
            }
        }
        
        return recent.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } catch (error) {
        console.error('Error getting recent parents:', error);
        return [];
    }
}

async function getRecentCaregivers(kv, limit = 10) {
    if (!kv) return [];
    
    try {
        const keys = await kv.list({ prefix: 'caregiver:' });
        const recent = [];
        
        for (const key of keys.keys.slice(0, limit)) {
            const data = await kv.get(key.name, 'json');
            if (data) {
                recent.push({
                    ...data,
                    created_at_formatted: new Date(data.created_at).toLocaleDateString(),
                    first_name: data.full_name?.split(' ')[0] || '',
                    last_name: data.full_name?.split(' ').slice(1).join(' ') || '',
                    experience_years: data.experience_years || 'Not specified',
                    service_areas: data.willing_regions || 'Not specified'
                });
            }
        }
        
        return recent.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } catch (error) {
        console.error('Error getting recent caregivers:', error);
        return [];
    }
}

function generateDashboardHTML(stats, recentParents, recentCaregivers) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Dashboard - Tahoe Night Nurse</title>
    <meta name="description" content="Admin dashboard for Tahoe Night Nurse">
    
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
                <a href="/admin" class="flex items-center px-6 py-3 text-white bg-navy-700 border-r-4 border-blue-500">
                    <span>Dashboard</span>
                </a>
                <a href="/admin/parents" class="flex items-center px-6 py-3 text-navy-300 hover:text-white hover:bg-navy-700 transition-colors">
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
                <h1 class="text-3xl font-light text-gray-800 mb-8">Dashboard</h1>
                
                <!-- Stats Cards -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <!-- Total Parents -->
                    <div class="bg-white rounded-lg shadow-sm p-6">
                        <div class="text-3xl font-light text-blue-600 mb-2">${stats.totalParents}</div>
                        <div class="text-gray-600 font-medium">Total Parents</div>
                        <div class="text-sm text-gray-500 mt-1">${stats.parentsThisWeek} this week</div>
                    </div>
                    
                    <!-- Total Caregivers -->
                    <div class="bg-white rounded-lg shadow-sm p-6">
                        <div class="text-3xl font-light text-blue-600 mb-2">${stats.totalCaregivers}</div>
                        <div class="text-gray-600 font-medium">Total Caregivers</div>
                        <div class="text-sm text-gray-500 mt-1">${stats.caregiversThisWeek} this week</div>
                    </div>
                    
                    <!-- Supply/Demand Ratio -->
                    <div class="bg-white rounded-lg shadow-sm p-6">
                        <div class="text-3xl font-light text-green-600 mb-2">${stats.supplyDemandRatio}%</div>
                        <div class="text-gray-600 font-medium">Supply/Demand Ratio</div>
                        <div class="text-sm text-gray-500 mt-1">Caregiver availability</div>
                    </div>
                    
                    <!-- Total Submissions -->
                    <div class="bg-white rounded-lg shadow-sm p-6">
                        <div class="text-3xl font-light text-purple-600 mb-2">${stats.totalSubmissions}</div>
                        <div class="text-gray-600 font-medium">Total Submissions</div>
                        <div class="text-sm text-gray-500 mt-1">All time</div>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <!-- Recent Parent Leads -->
                    <div class="bg-white rounded-lg shadow-sm">
                        <div class="p-6 border-b border-gray-200">
                            <div class="flex justify-between items-center">
                                <h2 class="text-xl font-medium text-gray-800">Recent Parent Leads</h2>
                                <a href="/admin/parents" class="text-blue-600 hover:text-blue-700 text-sm font-medium">View All</a>
                            </div>
                        </div>
                        <div class="p-6">
                            <div class="overflow-x-auto">
                                <table class="w-full">
                                    <thead>
                                        <tr class="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            <th class="pb-3">Date</th>
                                            <th class="pb-3">Name</th>
                                            <th class="pb-3">Location</th>
                                            <th class="pb-3">Timeframe</th>
                                        </tr>
                                    </thead>
                                    <tbody class="text-sm">
                                        ${recentParents.length > 0 ? 
                                            recentParents.map(parent => `
                                            <tr class="border-t border-gray-100">
                                                <td class="py-3 text-gray-600">${parent.created_at_formatted}</td>
                                                <td class="py-3 font-medium text-gray-900">${parent.first_name} ${parent.last_name}</td>
                                                <td class="py-3 text-gray-600">${parent.location}</td>
                                                <td class="py-3 text-gray-600">${parent.timeframe}</td>
                                            </tr>
                                            `).join('') :
                                        `<tr>
                                            <td colspan="4" class="py-8 text-center text-gray-500">No parent leads yet</td>
                                        </tr>`}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- Recent Caregiver Applications -->
                    <div class="bg-white rounded-lg shadow-sm">
                        <div class="p-6 border-b border-gray-200">
                            <div class="flex justify-between items-center">
                                <h2 class="text-xl font-medium text-gray-800">Recent Caregiver Applications</h2>
                                <a href="/admin/caregivers" class="text-blue-600 hover:text-blue-700 text-sm font-medium">View All</a>
                            </div>
                        </div>
                        <div class="p-6">
                            <div class="overflow-x-auto">
                                <table class="w-full">
                                    <thead>
                                        <tr class="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            <th class="pb-3">Date</th>
                                            <th class="pb-3">Name</th>
                                            <th class="pb-3">Experience</th>
                                            <th class="pb-3">Regions</th>
                                        </tr>
                                    </thead>
                                    <tbody class="text-sm">
                                        ${recentCaregivers.length > 0 ? 
                                            recentCaregivers.map(caregiver => `
                                            <tr class="border-t border-gray-100">
                                                <td class="py-3 text-gray-600">${caregiver.created_at_formatted}</td>
                                                <td class="py-3 font-medium text-gray-900">${caregiver.first_name} ${caregiver.last_name}</td>
                                                <td class="py-3 text-gray-600">${caregiver.experience_years}</td>
                                                <td class="py-3 text-gray-600">${caregiver.service_areas}</td>
                                            </tr>
                                            `).join('') :
                                        `<tr>
                                            <td colspan="4" class="py-8 text-center text-gray-500">No caregiver applications yet</td>
                                        </tr>`}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;
}