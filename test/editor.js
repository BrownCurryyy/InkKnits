export function initEditor() {
  return new Quill('#editor', {
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
}

export function renderGeneratedTextInline(quill, replyText) {
  const range = quill.getSelection(true);
  if (!range) return;
  const insertionIndex = range.index;

  const bounds = quill.getBounds(insertionIndex);

  const wrapper = document.createElement('div');
  wrapper.className = 'inline-generated-wrapper fade-in-up';
  wrapper.style.position = 'absolute';
  wrapper.style.zIndex = '50';
  wrapper.style.maxWidth = '80%';
  wrapper.style.maxHeight = '300px';
  wrapper.style.overflowY = 'auto';

  const editorRoot = quill.root;
  const editorPanel = document.querySelector('.editor-panel');
  const editorRect = editorRoot.getBoundingClientRect();
  const panelRect = editorPanel.getBoundingClientRect();
  
  wrapper.style.left = `${bounds.left + editorRect.left - panelRect.left}px`;
  wrapper.style.top = `${bounds.bottom + editorRect.top - panelRect.top + 10}px`;

  const textDiv = document.createElement('div');
  textDiv.className = 'generated-text';
  textDiv.textContent = replyText;
  wrapper.appendChild(textDiv);

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'generated-actions';
  
  const acceptBtn = document.createElement('button');
  acceptBtn.className = 'pill btn-accept';
  acceptBtn.textContent = 'Keep';
  acceptBtn.addEventListener('click', () => {
    wrapper.classList.add('fade-out-down');
    setTimeout(() => {
      wrapper.remove();
      quill.insertText(insertionIndex, replyText, 'user');
      quill.setSelection(insertionIndex + replyText.length, 0);
    }, 200);
  });

  const rejectBtn = document.createElement('button');
  rejectBtn.className = 'pill btn-reject';
  rejectBtn.textContent = 'Discard';
  rejectBtn.addEventListener('click', () => {
    wrapper.classList.add('fade-out-down');
    setTimeout(() => wrapper.remove(), 200);
  });

  actionsDiv.appendChild(acceptBtn);
  actionsDiv.appendChild(rejectBtn);
  wrapper.appendChild(actionsDiv);

  editorPanel.style.position = 'relative';
  editorPanel.appendChild(wrapper);
}

export function setLoading(loading) {
  const actionButtons = document.querySelectorAll('.action-btn');
  const topbar = document.getElementById('topbar');
  const statusText = document.getElementById('statusText');
  const editorPanel = document.querySelector('.editor-panel');

  actionButtons.forEach(b => b.disabled = loading);
  if (topbar) topbar.classList.toggle('hidden-during-send', loading);
  
  if (loading) {
    if (statusText) statusText.textContent = 'AI is generating...';
    let overlay = document.getElementById('editorLoadingOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'editorLoadingOverlay';
      overlay.className = 'fade-in';
      overlay.innerHTML = '<div class="editor-spinner"></div><p>Generating text...</p>';
      if (editorPanel) {
        editorPanel.style.position = 'relative'; 
        editorPanel.appendChild(overlay);
      }
    }
    overlay.style.display = 'flex';
  } else {
    if (statusText) statusText.textContent = 'Ready to assist.';
    let overlay = document.getElementById('editorLoadingOverlay');
    if (overlay) {
      overlay.classList.remove('fade-in');
      overlay.classList.add('fade-out');
      setTimeout(() => {
        overlay.style.display = 'none';
        overlay.classList.remove('fade-out');
      }, 200);
    }
  }
}
