// 37_test_diff_upload.js
// Tests diff upload format and response on master.apis.dev.openstreetmap.org

async function testDiffUploadFormat() {
  const base = 'https://master.apis.dev.openstreetmap.org/api/0.6';

  const oscPayload = `<osmChange version="0.6" generator="Browsm">
  <create>
    <node id="-1" lat="51.5" lon="-0.1" changeset="1">
      <tag k="name" v="Test"/>
    </node>
  </create>
</osmChange>`;

  const res = await fetch(`${base}/changeset/1/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml' },
    body: oscPayload,
  });

  console.log(`POST /changeset/1/upload: ${res.status} ${res.statusText}`);
  const text = await res.text();
  console.log('Response body:', text);
}

testDiffUploadFormat();
