// Investigation 4: Test parsing of OSM User Details messages XML and periodic polling mechanics
import { JSDOM } from 'jsdom';

function testOsmMessagesXmlParsing() {
  console.log('--- Testing OSM User Details XML with Messages Block ---');

  const sampleUserWithMessages = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6" generator="OpenStreetMap server">
  <user id="987654" display_name="mapper_pro" account_created="2020-05-12T14:30:00Z">
    <description>Local mapper in Rhode Island</description>
    <changesets count="425"/>
    <traces count="12"/>
    <blocks>
      <received count="0" active="0"/>
    </blocks>
    <img href="https://www.openstreetmap.org/assets/avatar.png"/>
    <roles>
      <role>moderator</role>
    </roles>
    <messages>
      <received count="15" unread="3"/>
      <sent count="8"/>
    </messages>
  </user>
</osm>`;

  const dom = new JSDOM(sampleUserWithMessages, { contentType: 'text/xml' });
  const doc = dom.window.document;
  const userEl = doc.querySelector('user');
  if (!userEl) throw new Error('No user element found');

  const messagesEl = userEl.querySelector('messages');
  const receivedEl = messagesEl?.querySelector('received');
  const sentEl = messagesEl?.querySelector('sent');

  const unreadCount = receivedEl ? parseInt(receivedEl.getAttribute('unread') || '0', 10) : 0;
  const totalReceived = receivedEl ? parseInt(receivedEl.getAttribute('count') || '0', 10) : 0;
  const totalSent = sentEl ? parseInt(sentEl.getAttribute('count') || '0', 10) : 0;

  console.log('Parsed Messages Metadata:', {
    hasMessagesBlock: !!messagesEl,
    unreadCount,
    totalReceived,
    totalSent,
  });

  // Test zero unread
  const sampleZeroUnread = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6" generator="OpenStreetMap server">
  <user id="123" display_name="clean_inbox" account_created="2022-01-01T00:00:00Z">
    <messages>
      <received count="10" unread="0"/>
      <sent count="5"/>
    </messages>
  </user>
</osm>`;

  const dom2 = new JSDOM(sampleZeroUnread, { contentType: 'text/xml' });
  const receivedEl2 = dom2.window.document.querySelector('user > messages > received');
  console.log('Zero unread test:', {
    unread: receivedEl2 ? parseInt(receivedEl2.getAttribute('unread') || '0', 10) : 0,
    total: receivedEl2 ? parseInt(receivedEl2.getAttribute('count') || '0', 10) : 0,
  });

  // Test missing messages block (fallback gracefully)
  const sampleMissingMessages = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6" generator="OpenStreetMap server">
  <user id="456" display_name="legacy_server" account_created="2018-01-01T00:00:00Z">
  </user>
</osm>`;

  const dom3 = new JSDOM(sampleMissingMessages, { contentType: 'text/xml' });
  const receivedEl3 = dom3.window.document.querySelector('user > messages > received');
  console.log('Missing messages block test:', {
    unread: receivedEl3 ? parseInt(receivedEl3.getAttribute('unread') || '0', 10) : 0,
    total: receivedEl3 ? parseInt(receivedEl3.getAttribute('count') || '0', 10) : 0,
  });
}

testOsmMessagesXmlParsing();
