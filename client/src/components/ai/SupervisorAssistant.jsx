import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Loader2, Trash2, ChevronDown } from 'lucide-react';
import { assistantStreamUrl, clearAssistantHistory } from '../../api/ai';

const SUGGESTED = [
  'Which trainees are falling behind on attendance?',
  'Who are the most consistent attendees this period?',
  'Summarise overall department progress',
  'How are submissions and tasks tracking in my department?',
];

export default function SupervisorAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (overrideText) => {
    const text = (overrideText || input).trim();
    if (!text || streaming) return;

    setInput('');
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: text },
      { role: 'assistant', content: '' },
    ]);
    setStreaming(true);

    try {
      const response = await fetch(assistantStreamUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ question: text }),
      });

      // Non-streaming error responses (e.g. 503 not configured) come back as JSON.
      if (!response.ok && !response.headers.get('content-type')?.includes('text/event-stream')) {
        const data = await response.json().catch(() => ({}));
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: data.error || 'AI request failed.' };
          return copy;
        });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.chunk) {
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = {
                  ...copy[copy.length - 1],
                  content: copy[copy.length - 1].content + data.chunk,
                };
                return copy;
              });
            }
            if (data.error) {
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: 'assistant', content: data.error };
                return copy;
              });
            }
          } catch {
            /* ignore malformed SSE line */
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: 'Connection error. Please try again.' };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  };

  const clearHistory = async () => {
    try {
      await clearAssistantHistory();
    } catch {
      /* ignore */
    }
    setMessages([]);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-lg transition-all hover:shadow-indigo-500/25 hover:shadow-xl"
        >
          <Bot className="w-5 h-5" />
          <span className="text-sm font-medium">AI Assistant</span>
        </button>
      )}

      {open && (
        <div
          className="w-96 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden"
          style={{ height: '520px' }}
        >
          <div className="flex items-center justify-between px-4 py-3 bg-indigo-600 text-white">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              <span className="font-medium text-sm">Department AI Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={clearHistory} title="Clear history" className="p-1.5 rounded hover:bg-indigo-500 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded hover:bg-indigo-500 transition-colors">
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                  Ask me anything about your department
                </p>
                {SUGGESTED.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q)}
                    className="w-full text-left text-xs px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-gray-600 dark:text-gray-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-sm'
                }`}>
                  {m.content
                    ? m.content
                    : (streaming && i === messages.length - 1)
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : null}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="p-3 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Ask about your department…"
                disabled={streaming}
                className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || streaming}
                className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
