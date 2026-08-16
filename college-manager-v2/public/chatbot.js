// chatbot.js — floating AI helper widget (Gemini-powered), shared across dashboards
(function () {
  let history = [];

  const widgetHTML = `
    <button id="chatbotToggle" title="Ask AI Helper">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="12" fill="#dbeafe"/>
        <path d="M6 12a6 6 0 0112 0" stroke="#3730a3" stroke-width="1.8" fill="none" stroke-linecap="round"/>
        <circle cx="6" cy="13" r="1.6" fill="#67e8f9" stroke="#3730a3" stroke-width="1.5"/>
        <circle cx="18" cy="13" r="1.6" fill="#67e8f9" stroke="#3730a3" stroke-width="1.5"/>
        <path d="M18 14.5v1a3 3 0 01-3 3h-1.5" stroke="#3730a3" stroke-width="1.6" fill="none" stroke-linecap="round"/>
        <circle cx="13" cy="18.5" r="1" fill="#f0abfc"/>
      </svg>
    </button>
    <div id="chatbotPanel">
      <div class="chatbot-header">
        <span>AI Helper (24/7)</span>
        <button onclick="window.toggleChatbot()">✕</button>
      </div>
      <div class="chatbot-messages" id="chatbotMessages">
        <div class="chatbot-msg bot">Hi! I'm your AI helper. Ask me any academic doubt or question about using the app — anytime.</div>
      </div>
      <div class="chatbot-input-row">
        <input type="text" id="chatbotInput" placeholder="Type your doubt..." autocomplete="off">
        <button onclick="window.sendChatbotMessage()">Send</button>
      </div>
    </div>
  `;

  document.addEventListener('DOMContentLoaded', () => {
    const container = document.createElement('div');
    container.innerHTML = widgetHTML;
    document.body.appendChild(container);

    document.getElementById('chatbotToggle').addEventListener('click', () => window.toggleChatbot());
    document.getElementById('chatbotInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') window.sendChatbotMessage();
    });
  });

  window.toggleChatbot = function () {
    document.getElementById('chatbotPanel').classList.toggle('open');
  };

  window.sendChatbotMessage = async function () {
    const input = document.getElementById('chatbotInput');
    const message = input.value.trim();
    if (!message) return;
    const messagesEl = document.getElementById('chatbotMessages');

    const userDiv = document.createElement('div');
    userDiv.className = 'chatbot-msg user';
    userDiv.textContent = message;
    messagesEl.appendChild(userDiv);
    input.value = '';

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'chatbot-msg bot loading';
    loadingDiv.textContent = 'Thinking...';
    messagesEl.appendChild(loadingDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history })
      });
      const data = await res.json();
      loadingDiv.remove();
      if (!res.ok) {
        const errDiv = document.createElement('div');
        errDiv.className = 'chatbot-msg bot';
        errDiv.textContent = 'Error: ' + (data.error || 'Something went wrong');
        messagesEl.appendChild(errDiv);
        return;
      }
      const botDiv = document.createElement('div');
      botDiv.className = 'chatbot-msg bot';
      botDiv.textContent = data.reply;
      messagesEl.appendChild(botDiv);
      history.push({ role: 'user', content: message });
      history.push({ role: 'assistant', content: data.reply });
    } catch (err) {
      loadingDiv.remove();
      const errDiv = document.createElement('div');
      errDiv.className = 'chatbot-msg bot';
      errDiv.textContent = 'Network error. Try again.';
      messagesEl.appendChild(errDiv);
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  };
})();
