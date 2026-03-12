import { useState, useRef, useEffect } from 'react';
import './ChatPanel.css';

const API_BASE = '';

export default function ChatPanel({ onNodeSelect, onClose, fontSize }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Hi! Ask me anything about the knowledge graph. I\'ll find relevant nodes and answer with citations.',
    },
  ]);
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const question = input.trim();
    if (!question || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: data.answer,
          citedNodes: data.cited_nodes || [],
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: `Error: ${err.message}`, isError: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderText = (text, citedNodes = []) => {
    const parts = text.split(/(\[[a-f0-9]{8}\])/g);
    return parts.map((part, i) => {
      const match = part.match(/^\[([a-f0-9]{8})\]$/);
      if (match) {
        const shortId = match[1];
        const fullId = citedNodes.find((id) => id.startsWith(shortId));
        return (
          <button
            key={i}
            className="cite-link"
            onClick={() => fullId && onNodeSelect(fullId)}
            title={fullId || shortId}
          >
            [{shortId}]
          </button>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="chat-panel" style={{ fontSize: `${fontSize}px` }}>
      <div className="chat-header">
        <div className="chat-header-left">
          <span className="chat-icon">◉</span>
          <span className="chat-title">Atlas Chat</span>
        </div>
        <div className="chat-header-right">
          <button className="chat-close" onClick={onClose}>✕</button>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`chat-msg ${msg.role} ${msg.isError ? 'error' : ''}`}
          >
            <div className="chat-msg-bubble">
              {msg.role === 'assistant'
                ? renderText(msg.text, msg.citedNodes)
                : msg.text}
            </div>
            {msg.citedNodes?.length > 0 && (
              <div className="chat-citations">
                <span className="cite-label">Sources:</span>
                {msg.citedNodes.map((id) => (
                  <button
                    key={id}
                    className="cite-chip"
                    onClick={() => onNodeSelect(id)}
                  >
                    {id.slice(0, 8)}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="chat-msg assistant">
            <div className="chat-msg-bubble loading-dots">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          className="chat-input"
          rows={1}
          placeholder="Ask about events, geopolitics, conflicts..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          style={{ fontSize: `${fontSize}px` }}
        />
        <button
          className="chat-send"
          onClick={handleSend}
          disabled={loading || !input.trim()}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
