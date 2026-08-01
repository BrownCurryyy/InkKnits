import { sendAtomizeRequest } from './api.js';

export function openAtomizeModal(quill) {
  const wholeText = quill.getText().trim();
  if (!wholeText || wholeText.length < 10) {
    alert("Not enough content to atomize.");
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'modal-overlay fade-in';
  
  modal.innerHTML = `
    <div class="modal-content scale-in">
      <div class="modal-header">
        <h2>Atomize Content</h2>
        <button class="close-modal">✕</button>
      </div>
      <div class="modal-body">
        <p class="mb-4 text-gray">Select formats to generate from your current document:</p>
        <div class="format-grid">
          <label><input type="checkbox" value="Blog Post"> <span>Blog Post</span></label>
          <label><input type="checkbox" value="LinkedIn Post"> <span>LinkedIn Post</span></label>
          <label><input type="checkbox" value="Instagram Caption"> <span>Instagram Caption</span></label>
          <label><input type="checkbox" value="Twitter/X Thread"> <span>Twitter/X Thread</span></label>
          <label><input type="checkbox" value="Press Release"> <span>Press Release</span></label>
          <label><input type="checkbox" value="Email Campaign"> <span>Email Campaign</span></label>
          <label><input type="checkbox" value="Promotional Copy"> <span>Promotional Copy</span></label>
          <label><input type="checkbox" value="Event Announcement"> <span>Event Announcement</span></label>
        </div>
        
        <h4 class="mt-4 mb-4" style="margin-top: 2rem; color: var(--text-main);">Settings</h4>
        <div class="controls-grid-horizontal" style="gap: 16px;">
          <div style="flex:1;">
            <label class="label">Mood</label>
            <select id="atomize-mood"><option>Professional</option><option>Hype</option><option>Casual</option></select>
          </div>
          <div style="flex:1;">
            <label class="label">Audience</label>
            <select id="atomize-audience"><option>General Audience</option><option>Professionals</option><option>Customers</option></select>
          </div>
          <div style="flex:1;">
            <label class="label">Length</label>
            <select id="atomize-length"><option>Short</option><option>Medium</option><option>Long</option></select>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="pill btn-solid w-full" id="btn-run-atomize">Run Atomization</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('.close-modal').addEventListener('click', () => modal.remove());

  modal.querySelector('#btn-run-atomize').addEventListener('click', async () => {
    const checkboxes = modal.querySelectorAll('.format-grid input:checked');
    const formats = Array.from(checkboxes).map(c => c.value);
    if (formats.length === 0) return alert("Select at least one format.");

    const mood = document.getElementById('atomize-mood').value;
    const audience = document.getElementById('atomize-audience').value;
    const length = document.getElementById('atomize-length').value;

    modal.innerHTML = `
      <div class="modal-content scale-in text-center p-8">
        <div class="editor-spinner mx-auto mb-4"></div>
        <h3>Atomizing Content...</h3>
        <p>Generating ${formats.length} assets. Please wait.</p>
      </div>
    `;

    try {
      const explicit = document.getElementById('explicitToggle')?.classList.contains('active') || false;
      const response = await sendAtomizeRequest({
        parent: wholeText,
        formats, mood, audience, length, explicit
      });
      modal.remove();
      if (window.loadSidebarAssets) window.loadSidebarAssets();
      showAtomizationResults(response.results);
    } catch (e) {
      alert("Error during atomization.");
      modal.remove();
    }
  });
}

export function showAtomizationResults(results) {
  const mainLayout = document.querySelector('.layout-grid');
  mainLayout.style.display = 'none'; // hide main editor

  let resultsView = document.getElementById('atomization-results');
  if (!resultsView) {
    resultsView = document.createElement('div');
    resultsView.id = 'atomization-results';
    resultsView.className = 'page-shell fade-in';
    document.body.appendChild(resultsView);
  }

  resultsView.innerHTML = `
    <div class="topbar mb-4">
      <h1>Atomization Results</h1>
      <button class="pill" id="btn-back-editor">← Back to Editor</button>
    </div>
    <div class="results-layout">
      <div class="lineage-tree panel">
        <h3>Parent Asset</h3>
        <ul class="tree-list">
          ${results.map(r => `<li>${r.asset_type}</li>`).join('')}
        </ul>
      </div>
      <div class="asset-cards-grid">
        ${results.map(r => `
          <div class="asset-card panel scale-in">
            <div class="card-header">
              <h4>${r.asset_type}</h4>
              <span class="text-sm text-gray">${new Date(r.timestamp*1000).toLocaleTimeString()}</span>
            </div>
            <div class="card-body">
              <p>${r.preview}</p>
            </div>
            <div class="card-footer">
              <button onclick="window.openChildEditor('${r.id}')" class="pill btn-ghost block text-center w-full">Open Editor</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.getElementById('btn-back-editor').addEventListener('click', () => {
    resultsView.remove();
    mainLayout.style.display = 'grid'; // show main editor
  });
}
