export async function sendChatRequest(payload) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await response.json();
  } catch (error) {
    console.error('Chat API error:', error);
    throw error;
  }
}

export async function sendAtomizeRequest(payload) {
  try {
    const response = await fetch('/api/atomize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await response.json();
  } catch (error) {
    console.error('Atomize API error:', error);
    throw error;
  }
}

export async function fetchChildAssets() {
  try {
    const response = await fetch('/api/child_assets');
    return await response.json();
  } catch (error) {
    console.error('Child assets fetch error:', error);
    throw error;
  }
}

export async function fetchSingleChildAsset(id) {
  try {
    const response = await fetch(`/api/child_assets/${id}`);
    return await response.json();
  } catch (error) {
    console.error('Single asset fetch error:', error);
    throw error;
  }
}
