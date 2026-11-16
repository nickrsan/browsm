// Investigation 1: Verify OpenFreeMap vector tile style endpoints
async function testStyles() {
  const styles = [
    'https://tiles.openfreemap.org/styles/liberty',
    'https://tiles.openfreemap.org/styles/bright',
    'https://tiles.openfreemap.org/styles/positron',
    'https://tiles.openfreemap.org/styles/dark',
  ];

  for (const url of styles) {
    try {
      const res = await fetch(url);
      console.log(`Style ${url}: Status ${res.status}, Type: ${res.headers.get('content-type')}`);
      if (res.ok) {
        const data = await res.json();
        console.log(`  Name: ${data.name}, Version: ${data.version}, Sources: ${Object.keys(data.sources || {}).join(', ')}`);
      }
    } catch (err) {
      console.error(`Failed to fetch ${url}:`, err.message);
    }
  }
}

testStyles();
