const { bin } = require('cloudflared');
const { spawn } = require('child_process');
const net = require('net');

const LOCAL_PORT = 5433;

// 1. Structural Validation of Pipeline Configuration Environment
console.log('=========================================================');
console.log('📊 CHECKING ENVIRONMENT PARAMETERS (First 4 chars shown):');
console.log('---------------------------------------------------------');
console.log(`DB_TUNNEL_HOSTNAME:   ${process.env.DB_TUNNEL_HOSTNAME || '❌ MISSING'}`);
console.log(`DB_USER:              ${process.env.DB_USER || '❌ MISSING'}`);
console.log(`DB_NAME:              ${process.env.DB_NAME || '❌ MISSING'}`);
console.log(`CF_CLIENT_ID:         ${process.env.CF_CLIENT_ID ? process.env.CF_CLIENT_ID.substring(0, 4) + '...' : '❌ MISSING'}`);
console.log(`CF_CLIENT_SECRET:     ${process.env.CF_CLIENT_SECRET ? process.env.CF_CLIENT_SECRET.substring(0, 4) + '...' : '❌ MISSING'}`);
console.log('=========================================================');

const REQUIRED_VARS = ['DB_TUNNEL_HOSTNAME', 'CF_CLIENT_ID', 'CF_CLIENT_SECRET', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
for (const envVar of REQUIRED_VARS) {
    if (!process.env[envVar]) {
        console.error(`❌ ERROR: Mandatory Environment variable "${envVar}" is missing in Build Context!`);
        process.exit(1);
    }
}

// 2. Configure Ephemeral Connection Arguments 
const tunnelArgs = [
    'access', 'tcp',
    '--hostname', process.env.DB_TUNNEL_HOSTNAME,
    '--url', `127.0.0.1:${LOCAL_PORT}`,
    '--service-token-id', process.env.CF_CLIENT_ID,
    '--service-token-secret', process.env.CF_CLIENT_SECRET,
    '--loglevel', 'debug'
];

console.log('🚀 Step 1: Initializing background Cloudflare Tunnel Proxy...');
const tunnelProcess = spawn(bin, tunnelArgs, { stdio: 'pipe' });

// Route trace logging out for validation visibility
tunnelProcess.stderr.on('data', (data) => {
    const output = data.toString();
    if (output.includes('ERR') || output.includes('error')) {
        console.error(`[cloudflared-err]: ${output.trim()}`);
    }
});

// Helper function to poll local socket loopback health
const waitForPort = (port, timeout = 10000) => {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const check = () => {
            const socket = new net.Socket();
            socket.setTimeout(1000);
            socket.once('connect', () => { socket.destroy(); resolve(); });
            socket.once('error', () => {
                if (Date.now() - start > timeout) {
                    reject(new Error(`Timeout waiting for local loopback proxy port ${port}`));
                } else {
                    setTimeout(check, 500);
                }
            });
            socket.connect(port, '127.0.0.1');
        };
        check();
    });
};

async function run() {
    try {
        // 3. Confirm Loopback Proxy is listening cleanly
        console.log('🔄 Step 2: Validating client-side tunnel proxy loopback binding...');
        await waitForPort(LOCAL_PORT);
        console.log(`✅ Local loopback proxy actively routing on 127.0.0.1:${LOCAL_PORT}`);
        console.log('=========================================================');

        // 4. Build isolated migration string mapping local port to remote destination
        const dbUrl = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@127.0.0.1:${LOCAL_PORT}/${process.env.DB_NAME}`;
        console.log('🔄 Step 3: Triggering Drizzle Engine Migrations...');

        const drizzle = spawn('npx', ['drizzle-kit', 'migrate'], {
            stdio: 'inherit',
            env: { ...process.env, DATABASE_URL: dbUrl }
        });

        drizzle.on('close', (code) => {
            // 5. Clean up background process safely on termination
            console.log('=========================================================');
            console.log('🧹 Step 4: Tearing down background tunnel process...');
            tunnelProcess.kill();

            if (code === 0) {
                console.log('🎉 SUCCESS: Database migrations applied cleanly!');
                process.exit(0);
            } else {
                console.error(`❌ FAILURE: Drizzle process exited with non-zero error code: ${code}`);
                process.exit(code || 1);
            }
        });

    } catch (error) {
        console.error(`❌ PIPELINE CRITICAL EXCEPTION: ${error.message}`);
        tunnelProcess.kill();
        process.exit(1);
    }
}

run();
