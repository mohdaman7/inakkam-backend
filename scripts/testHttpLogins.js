const http = require('http');

const testCases = [
    // 1. Admin
    {
        type: 'Admin',
        url: 'http://127.0.0.1:7000/api/admin/login',
        body: { email: 'admin@gmail.com', password: 'admin123' }
    },
    {
        type: 'Admin (alt password)',
        url: 'http://127.0.0.1:7000/api/admin/login',
        body: { email: 'admin@gmail.com', password: 'admin@123' }
    },
    // 2. Customers
    {
        type: 'Customer 1 (Aarav)',
        url: 'http://127.0.0.1:7000/api/auth/login',
        body: { email: 'aarav.shah@gmail.com', password: 'Inakkam@2025' }
    },
    {
        type: 'Customer 2 (Priya)',
        url: 'http://127.0.0.1:7000/api/auth/login',
        body: { email: 'priya.das@gmail.com', password: 'Inakkam@2025' }
    },
    {
        type: 'Customer 3 (Muhammed Aman)',
        url: 'http://127.0.0.1:7000/api/auth/login',
        body: { email: 'muhammedaman2.oaman@gmail.com', password: 'mohdaman' }
    },
    // 3. Agents
    {
        type: 'Agent (Anjali)',
        url: 'http://127.0.0.1:7000/api/admin/login',
        body: { email: 'anjali@inakkam.com', password: 'Inakkam@2025' }
    },
    {
        type: 'Agent (Gauri)',
        url: 'http://127.0.0.1:7000/api/admin/login',
        body: { email: 'gauri@inakkam.com', password: 'Inakkam@2025' }
    },
    {
        type: 'Agent (Rhea)',
        url: 'http://127.0.0.1:7000/api/admin/login',
        body: { email: 'rhea.agent@inakkam.com', password: 'Inakkam@2025' }
    }
];

function testLogin(item) {
    return new Promise((resolve) => {
        const url = new URL(item.url);
        const data = JSON.stringify(item.body);

        const req = http.request({
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        }, (res) => {
            let resBody = '';
            res.on('data', chunk => resBody += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(resBody);
                    if (res.statusCode === 200 && parsed.success) {
                        console.log(`✅ [${item.type}] Login OK (Status ${res.statusCode}) - Token received`);
                        resolve(true);
                    } else {
                        console.error(`❌ [${item.type}] Failed (Status ${res.statusCode}):`, parsed);
                        resolve(false);
                    }
                } catch (e) {
                    console.error(`❌ [${item.type}] Non-JSON Response (Status ${res.statusCode}):`, resBody);
                    resolve(false);
                }
            });
        });

        req.on('error', (e) => {
            console.error(`❌ [${item.type}] Request Error:`, e.message);
            resolve(false);
        });

        req.write(data);
        req.end();
    });
}

async function runAll() {
    console.log('Testing End-to-End API Logins against http://localhost:7000 ...\n');
    let allPassed = true;
    for (const testCase of testCases) {
        const passed = await testLogin(testCase);
        if (!passed) allPassed = false;
    }

    if (allPassed) {
        console.log('\n🎉 ALL 8 LOGIN TESTS PASSED 100%!');
        process.exit(0);
    } else {
        console.log('\n❌ Some login tests failed.');
        process.exit(1);
    }
}

runAll();
