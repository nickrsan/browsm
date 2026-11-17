// Mock browser
global.chrome = {
  runtime: {
    id: 'test-id',
    sendMessage: (msg) => {
      console.log('chrome.runtime.sendMessage received:\n', JSON.stringify(msg, null, 2));
      return Promise.resolve({ success: true });
    },
    onMessage: {
      addListener: (fn) => {
        console.log('Registered onMessage listener');
      },
    },
  },
};
global.browser = global.chrome;

async function test() {
  const { defineExtensionMessaging } = await import('@webext-core/messaging');
  const messaging = defineExtensionMessaging();
  await messaging.sendMessage('searchPoi', { query: 'test' });
}

test();
