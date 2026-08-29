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

# 1. Download cloudflared binary
echo "Step 1: Downloading cloudflared binary..."
wget -q https://github.com -O cloudflared
chmod +x cloudflared
echo "✅ cloudflared downloaded successfully."
echo "========================================================="

# 2. Launch tunnel with high verbosity logging
echo "Step 2: Starting cloudflared access proxy on port $LOCAL_PORT..."
# --v=2 enables verbose tracing logs from cloudflared
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

# 3. Test Local Port Loopback
echo "Step 3: Checking if local proxy is listening..."
if nc -z 127.0.0.1 $LOCAL_PORT; then
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
# This verifies if the remote DB is responding through the wire protocol
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

