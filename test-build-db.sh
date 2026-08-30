#!/bin/bash
# Do NOT set -e here so we can capture all failure stages for diagnosis

echo "========================================================="
# Check for required environment variables
REQUIRED_VARS=("DB_TUNNEL_HOSTNAME" "CF_CLIENT_ID" "CF_CLIENT_SECRET" "DB_USER" "DB_NAME")
for VAR in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!VAR}" ]; then
    echo "❌ ERROR: Environment variable $VAR is missing!"
    exit 1
  fi
done

LOCAL_PORT="5433"
echo "✅ Environment variables validated."
echo "========================================================="

# 1. Download cloudflared binary cleanly following redirect (-L)
echo "Step 1: Downloading cloudflared binary..."
curl -L "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64" -o cloudflared
chmod +x cloudflared
echo "✅ Genuine cloudflared binary downloaded successfully."
echo "========================================================="

# 2. Launch tunnel with logging
echo "Step 2: Starting cloudflared access proxy on port $LOCAL_PORT..."
./cloudflared access tcp \
  --hostname "$DB_TUNNEL_HOSTNAME" \
  --url 127.0.0.1:$LOCAL_PORT \
  --header "CF-Access-Client-Id: $CF_CLIENT_ID" \
  --header "CF-Access-Client-Secret: $CF_CLIENT_SECRET" \
  --v=2 > cloudflared_debug.log 2>&1 &

TUNNEL_PID=$!
echo "🔄 Waiting 5 seconds for tunnel to stabilize (PID: $TUNNEL_PID)..."
sleep 5
echo "========================================================="

# 3. Test Local Port Loopback using native Bash sockets (replaces 'nc')
echo "Step 3: Checking if local proxy is listening..."
if (echo > /dev/tcp/127.0.0.1/$LOCAL_PORT) >/dev/null 2>&1; then
  echo "✅ Local loopback proxy is actively listening on port $LOCAL_PORT."
else
  echo "❌ ERROR: Local proxy failed to open port $LOCAL_PORT. Checking logs..."
  cat cloudflared_debug.log
  kill $TUNNEL_PID 2>/dev/null
  exit 1
fi
echo "========================================================="

# 4. Test Postgres Wire Protocol Readiness
echo "Step 4: Sending Postgres ping via pg_isready..."
if npx pg_isready -h 127.0.0.1 -p $LOCAL_PORT -u "$DB_USER" -d "$DB_NAME" -t 5; then
  echo "✅ SUCCESS: Database is accepting connections through the Cloudflare Tunnel!"
  echo "========================================================="
  echo "🎉 Your environment is completely ready to run Drizzle migrations."
  kill $TUNNEL_PID
  exit 0
else
  echo "❌ ERROR: Database handshake failed or timed out."
  echo "========================================================="
  echo "📊 DUMPING CLOUDFLARED VERBOSE LOGS FOR TROUBLESHOOTING:"
  echo "---------------------------------------------------------"
  cat cloudflared_debug.log
  echo "---------------------------------------------------------"
  kill $TUNNEL_PID
  exit 1
fi
