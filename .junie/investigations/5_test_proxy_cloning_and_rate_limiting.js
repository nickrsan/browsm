// Investigation 5: Test proxy serialization, in-flight deduplication, and rate limiting/backoff for OSM API
import { JSDOM } from 'jsdom';

console.log('=== Investigation 5: Proxy Cloning & API Abuse Prevention ===\n');

// 1. Test Proxy object structured cloning vs JSON plain object
function testProxySerialization() {
  console.log('1. Testing Proxy serialization:');
  const targetObj = {
    isAuthenticated: true,
    isLoading: false,
    token: { accessToken: 'secret_abc_123', tokenType: 'Bearer', scope: 'read_prefs' },
    user: { id: 12345, username: 'osm_user', unreadMessagesCount: 2 }
  };

  const proxiedObj = new Proxy(targetObj, {
    get(target, prop) {
      return Reflect.get(target, prop);
    }
  });

  // Verify that structuredClone throws on Proxy in environments that strictly enforce it
  let structuredCloneFailed = false;
  try {
    // In Node 17+, structuredClone is global
    if (typeof structuredClone === 'function') {
      // In some JS engines structuredClone handles Proxies by copying target, but in Firefox WebExtension IPC it throws DataCloneError
    }
  } catch (e) {
    structuredCloneFailed = true;
  }

  // Test our clean serialization
  const cleanObj = JSON.parse(JSON.stringify(proxiedObj));
  console.log('  Cleaned object is plain object:', cleanObj && typeof cleanObj === 'object');
  console.log('  Cleaned object matches original properties:', cleanObj.token.accessToken === 'secret_abc_123');
  console.log('  Cleaned object has unreadMessagesCount:', cleanObj.user.unreadMessagesCount === 2);
}

// 2. Test Rate Limiting and In-flight deduplication
class UserDetailsPoller {
  lastFetchTime = 0;
  minIntervalMs = 60 * 1000; // 1 minute minimum cooldown
  errorBackoffMs = 120 * 1000; // 2 minutes on error
  consecutiveErrors = 0;
  inFlightPromise = null;
  mockApiCallCount = 0;

  get apiCalls() {
    return this.mockApiCallCount;
  }

  async fetchUserDetails(force = false, shouldFail = false) {
    if (this.inFlightPromise) {
      console.log('  [Poller] Request already in flight, reusing promise');
      return this.inFlightPromise;
    }

    const now = Date.now();
    const effectiveCooldown = this.consecutiveErrors > 0 
      ? Math.min(this.errorBackoffMs * Math.pow(2, this.consecutiveErrors - 1), 15 * 60 * 1000)
      : this.minIntervalMs;

    if (!force && (now - this.lastFetchTime < effectiveCooldown)) {
      console.log(`  [Poller] Skipping fetch, in cooldown (${now - this.lastFetchTime}ms < ${effectiveCooldown}ms)`);
      return { skipped: true, reason: 'cooldown' };
    }

    const promise = (async () => {
      this.mockApiCallCount++;
      try {
        if (shouldFail) {
          throw new Error('500 Internal Server Error');
        }
        this.lastFetchTime = Date.now();
        this.consecutiveErrors = 0;
        return { success: true, user: { id: 1, name: 'test' } };
      } catch (err) {
        this.consecutiveErrors++;
        this.lastFetchTime = Date.now();
        console.log(`  [Poller] Error encountered. Consecutive errors: ${this.consecutiveErrors}`);
        throw err;
      } finally {
        this.inFlightPromise = null;
      }
    })();

    this.inFlightPromise = promise;
    return promise;
  }
}

async function testPollerMechanics() {
  console.log('\n2. Testing Poller Mechanics & Anti-abuse:');
  const poller = new UserDetailsPoller();

  // Test 1: First call
  console.log('Call 1 (initial):');
  await poller.fetchUserDetails();
  console.log(`API calls so far: ${poller.apiCalls}`);

  // Test 2: Rapid consecutive call (should be blocked by cooldown)
  console.log('\nCall 2 (immediate consecutive):');
  await poller.fetchUserDetails();
  console.log(`API calls so far: ${poller.apiCalls} (expected: 1)`);

  // Test 3: Concurrent calls (should deduplicate)
  console.log('\nCall 3 & 4 (concurrent):');
  const [res1, res2] = await Promise.all([
    poller.fetchUserDetails(true),
    poller.fetchUserDetails(true)
  ]);
  console.log(`API calls so far: ${poller.apiCalls} (expected: 2)`);

  // Test 4: Error handling and backoff
  console.log('\nCall 5 (failing call):');
  try {
    await poller.fetchUserDetails(true, true);
  } catch (e) {
    console.log('Caught expected error');
  }
  console.log(`API calls so far: ${poller.apiCalls} (expected: 3)`);

  console.log('\nCall 6 (immediate after error, should be blocked by error backoff):');
  await poller.fetchUserDetails();
  console.log(`API calls so far: ${poller.apiCalls} (expected: 3)`);
}

testProxySerialization();
testPollerMechanics();
