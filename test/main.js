import { initEditor } from './editor.js';
import { handleAction } from './actions.js';
import { openAtomizeModal } from './atomize.js';
import { fetchChildAssets } from './api.js';

let quill;
let childQuill;

document.addEventListener('DOMContentLoaded', () => {
  quill = initEditor();
  
  childQuill = new Quill('#child-editor', {
    theme: 'snow',
    modules: {
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        ['blockquote', 'code-block'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link'],
      ]
    }
  });

  const darkModeToggle = document.getElementById('darkModeToggle');
  const explicitToggle = document.getElementById('explicitToggle');

  darkModeToggle?.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    darkModeToggle.textContent = document.body.classList.contains('dark-mode') ? 'Light mode' : 'Dark mode';
  });

  explicitToggle?.addEventListener('click', () => {
    explicitToggle.classList.toggle('active');
    explicitToggle.textContent = explicitToggle.classList.contains('active') ? 'Explicit on' : 'Explicit off';
  });

  const actionButtons = document.querySelectorAll('.action-btn');
  actionButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const action = btn.dataset.action;
      if (action === 'atomize') {
        openAtomizeModal(quill);
      } else {
        handleAction(action, quill, btn);
      }
    });
  });

  function updateDependentButtons() {
    const sel = quill.getSelection();
    const hasSelection = sel && sel.length > 0;
    document.querySelectorAll('.btn-dependent').forEach(b => {
      b.disabled = !hasSelection;
      b.classList.toggle('disabled', !hasSelection);
    });
  }

  quill.on('selection-change', updateDependentButtons);
  updateDependentButtons();

  async function loadSidebarAssets() {
    const { assets } = await fetchChildAssets();
    const list = document.getElementById('child-assets-list');
    if (!list) return;
    if (assets && assets.length > 0) {
      list.innerHTML = assets.map(a => `
        <li>
          <a href="#" onclick="window.openChildEditor('${a.id}'); return false;" class="text-accent" style="text-decoration:none; color: var(--accent-color); font-weight:600;">
            ${a.asset_type}
          </a>
          <div class="text-sm text-gray" style="margin-top:4px;">${new Date(a.timestamp*1000).toLocaleTimeString()}</div>
        </li>
      `).join('');
    } else {
      list.innerHTML = '<p class="text-gray text-sm">No assets generated yet.</p>';
    }
  }

  loadSidebarAssets();
  
  window.loadSidebarAssets = loadSidebarAssets;

  window.openChildEditor = async (id) => {
    document.querySelector('.layout-grid').style.display = 'none';
    const resultsView = document.getElementById('atomization-results');
    if (resultsView) resultsView.style.display = 'none';
    document.getElementById('child-editor-view').style.display = 'block';

    document.getElementById('childAssetTypeLabel').textContent = 'Loading...';
    document.getElementById('childAssetIdLabel').textContent = 'Loading...';
    childQuill.setText('');

    const { asset } = await import('./api.js').then(m => m.fetchSingleChildAsset(id));
    if (asset) {
      document.getElementById('childAssetTypeLabel').textContent = asset.asset_type || 'Child Asset';
      document.getElementById('childAssetIdLabel').textContent = `Editing: ${asset.id}`;
      childQuill.insertText(0, asset.generated || '');
    } else {
      document.getElementById('childAssetTypeLabel').textContent = 'Error';
      document.getElementById('childAssetIdLabel').textContent = 'Asset not found.';
    }
  };

  document.getElementById('btn-child-back').addEventListener('click', () => {
    document.getElementById('child-editor-view').style.display = 'none';
    const resultsView = document.getElementById('atomization-results');
    if (resultsView) {
      resultsView.style.display = 'block';
    } else {
      document.querySelector('.layout-grid').style.display = 'grid';
    }
  });

  document.getElementById('btn-child-save').addEventListener('click', () => {
    alert("Saved! (Mock)");
  });
});
