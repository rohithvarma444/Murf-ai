# TTS Connection Troubleshooting Guide

## "Exceeded Active context limit" Error

This error occurs when the Murf AI TTS service reaches its connection limits. Here's how to fix it:

### Quick Fix

1. **Reduce connection limit** in your `.env` file:
   ```bash
   MAX_TTS_CONNECTIONS=5
   ```

2. **Restart the server**:
   ```bash
   npm start
   ```

### Root Causes

1. **Too many concurrent sessions**: Each customer care session creates a WebSocket connection to Murf
2. **Murf plan limits**: Free/limited plans have lower connection limits
3. **Connection leaks**: Old connections not properly closed

### Solutions

#### 1. Adjust Connection Limits

| Murf Plan | Recommended MAX_TTS_CONNECTIONS |
|-----------|--------------------------------|
| Free      | 3-5                           |
| Basic     | 5-10                          |
| Pro       | 10-20                         |
| Enterprise| 20+                           |

#### 2. Check Your Murf Plan

- Log into your [Murf dashboard](https://app.murf.ai/)
- Check your plan limits under "Usage & Billing"
- Upgrade if needed for more concurrent connections

#### 3. Monitor Active Connections

Add this to your server logs to monitor connections:

```javascript
// In your main server file
setInterval(() => {
  const activeCount = customerCareService.webSocketTTS.getActiveConnectionsCount();
  console.log(`📊 Active TTS connections: ${activeCount}`);
}, 30000); // Every 30 seconds
```

#### 4. Implement Connection Pooling

The system now includes:
- ✅ Connection limits
- ✅ Connection queuing
- ✅ Automatic retry logic
- ✅ Graceful fallback to text-only mode

#### 5. Environment Setup

Run the setup script to configure properly:

```bash
cd backend
npm run setup
```

Then edit `.env` and set appropriate limits.

### Fallback Behavior

When TTS connections fail:
- ✅ Chat continues with text-only responses
- ✅ Users see "Text Only" status indicator
- ✅ Voice recording button is disabled
- ✅ No service interruption

### Monitoring

Check these logs for connection issues:

```bash
# Watch for connection errors
tail -f logs/server.log | grep "TTS\|WebSocket\|context limit"

# Monitor active connections
tail -f logs/server.log | grep "Active TTS connections"
```

### Advanced Configuration

For production environments, consider:

```bash
# More conservative limits for stability
MAX_TTS_CONNECTIONS=5
NODE_ENV=production

# Enable connection monitoring
DEBUG=websocket:*
```

### Still Having Issues?

1. **Check Murf API status**: [Murf Status Page](https://status.murf.ai/)
2. **Verify API key**: Ensure your `MURF_API_KEY` is valid
3. **Contact support**: If issues persist, contact Murf support with your plan details

### Testing

Test with reduced limits:

```bash
# Test with minimal connections
MAX_TTS_CONNECTIONS=2 npm start

# Open multiple browser tabs to test limits
```

The system will automatically queue connections and provide fallback text responses when limits are reached. 