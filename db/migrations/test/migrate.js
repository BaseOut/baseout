const { bin } = require('cloudflared');
const { spawn } = require('child_process');
const net = require('net');
const { Client } = require('pg'); // Native driver test connection

const LOCAL_PORT = 5433;

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
        console.error(`❌ ERROR: Mandatory Environment variable "${envVar}" is missing!`);
        process.exit(1);
    }
}

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

tunnelProcess.stderr.on('data', (data) => {
    const output = data.toString();
    if (output.includes('ERR') || output.includes('error')) {
        console.error(`[cloudflared-err]: ${output.trim()}`);
    }
});

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
        console.log('🔄 Step 2: Validating client-side tunnel proxy loopback binding...');
        await waitForPort(LOCAL_PORT);
        console.log(`✅ Local loopback proxy actively routing on 127.0.0.1:${LOCAL_PORT}`);
        console.log('=========================================================');

        console.log('🔄 Step 3: Executing raw Postgres sanity test...');

        // Connect directly using the node-postgres driver
        const client = new Client({
            host: '127.0.0.1',
            port: LOCAL_PORT,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            ssl: { rejectUnauthorized: false } // Required by most cloud DB providers like DigitalOcean
        });

        await client.connect();
        console.log('✅ Connected to Postgres server successfully!');

        const res = await client.query('SELECT 1 + 1 AS connection_test_result;');
        console.log(`🎉 DATABASE RESPONSE SUCCESS: 1 + 1 = ${res.rows[0].connection_test_result}`);

        await client.end();

        console.log('=========================================================');
        console.log('🧹 Step 4: Tearing down background tunnel process...');
        tunnelProcess.kill();
        process.exit(0);

    } catch (error) {
        console.error(`❌ FAILURE: ${error.message}`);
        if (error.stack) console.error(error.stack);
        tunnelProcess.kill();
        process.exit(1);
    }
}

run();
