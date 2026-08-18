async function testProdTokenCreation() {
  const base = 'https://vch-one.vercel.app';
  
  // 1. Get Queues
  const qRes = await fetch(base + '/api/queues').then(r => r.json());
  console.log('Queues:', qRes.queues.map(q => ({ id: q.id, name: q.name })));
  
  const targetQueueId = qRes.queues[0].id;
  
  // 2. Submit token
  const res = await fetch(base + '/api/tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      queueId: targetQueueId,
      visitorName: 'Prod Debug Test',
      purpose: 'Testing Vercel Serverless',
      turnstileToken: 'bypass-dev-token'
    })
  });
  
  console.log('Status:', res.status, res.statusText);
  const text = await res.text();
  console.log('Body:', text.substring(0, 500));
}
testProdTokenCreation();
