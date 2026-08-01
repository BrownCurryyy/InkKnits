import { sendChatRequest } from './api.js';
import { renderGeneratedTextInline, setLoading } from './editor.js';

let activePopover = null;

function closePopover() {
  if (activePopover) {
    activePopover.remove();
    activePopover = null;
  }
}

document.addEventListener('click', (e) => {
  if (activePopover && !activePopover.contains(e.target) && !e.target.closest('.action-btn')) {
    closePopover();
  }
});

function createPopover(button, title, fields, onApply) {
  closePopover();
  const popover = document.createElement('div');
  popover.className = 'parameter-popover fade-in-up';
  
  let html = `<h4>${title}</h4><div class="popover-body">`;
  
  fields.forEach(f => {
    html += `<div class="panel-block">
      <label>${f.label}</label>
      <select id="popover-${f.id}">`;
    f.options.forEach(opt => html += `<option value="${opt}">${opt}</option>`);
    html += `</select></div>`;
  });
  
  html += `</div><button class="pill btn-solid w-full mt-2" id="popover-apply">Apply</button>`;
  popover.innerHTML = html;
  
  document.body.appendChild(popover);
  
  const btnRect = button.getBoundingClientRect();
  popover.style.top = `${btnRect.bottom + window.scrollY + 8}px`;
  popover.style.left = `${btnRect.left + window.scrollX}px`;
  
  activePopover = popover;
  
  document.getElementById('popover-apply').addEventListener('click', () => {
    const values = {};
    fields.forEach(f => {
      values[f.id] = document.getElementById(`popover-${f.id}`).value;
    });
    closePopover();
    onApply(values);
  });
}

export async function handleAction(action, quill, button) {
  const explicit = document.getElementById('explicitToggle')?.classList.contains('active') || false;
  
  const runGeneration = async (params, draftText) => {
    setLoading(true);
    try {
      const data = await sendChatRequest({ ...params, explicit, action });
      if (data.reply) {
        renderGeneratedTextInline(quill, data.reply.trim());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const sel = quill.getSelection();
  const hasSelection = sel && sel.length > 0;
  const selectedText = hasSelection ? quill.getText(sel.index, sel.length).trim() : '';
  const wholeText = quill.getText().trim();

  if (action === 'generate') {
    // Generate uses prompt + text
    const prompt = document.getElementById('promptInput')?.value.trim() || 'Continue the text.';
    await runGeneration({ prompt, draft: wholeText }, wholeText);
  } 
  else if (action === 'summarize') {
    await runGeneration({ prompt: 'Summarize the text.', draft: wholeText }, wholeText);
  }
  else if (action === 'expand') {
    if (!hasSelection) return alert('Please select text to expand.');
    createPopover(button, 'Expand Settings', [
      { id: 'mood', label: 'Mood', options: ['Professional', 'Casual', 'Persuasive', 'Dramatic'] },
      { id: 'style', label: 'Style', options: ['Narrative', 'Bullet Points', 'Academic', 'Blog'] },
      { id: 'audience', label: 'Audience', options: ['General', 'Experts', 'Students'] },
      { id: 'length', label: 'Length', options: ['Short', 'Medium', 'Long'] }
    ], (vals) => {
      runGeneration({ prompt: 'Expand the text.', draft: selectedText, ...vals }, selectedText);
    });
  }
  else if (action === 'change_audience') {
    if (!hasSelection) return alert('Please select text to change audience.');
    createPopover(button, 'Change Audience', [
      { id: 'audience', label: 'Audience', options: ['General', 'Experts', 'Students', 'Kids', 'Executives'] },
      { id: 'length', label: 'Length', options: ['Short', 'Medium', 'Long'] }
    ], (vals) => {
      runGeneration({ prompt: 'Change audience.', draft: selectedText, ...vals }, selectedText);
    });
  }
  else if (action === 'improve_tone') {
    if (!hasSelection) return alert('Please select text to improve tone.');
    createPopover(button, 'Improve Tone', [
      { id: 'mood', label: 'Mood', options: ['Professional', 'Casual', 'Persuasive', 'Dramatic', 'Friendly'] },
      { id: 'style', label: 'Style', options: ['Narrative', 'Direct', 'Academic', 'Conversational'] },
      { id: 'length', label: 'Length', options: ['Short', 'Medium', 'Long'] }
    ], (vals) => {
      runGeneration({ prompt: 'Improve tone.', draft: selectedText, ...vals }, selectedText);
    });
  }
}
