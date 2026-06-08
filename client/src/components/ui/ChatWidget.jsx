import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Bot, Sparkles } from 'lucide-react';
import { sendChat } from '../../api/chat';

const SUGGESTIONS = [
  'What is Swahilipot Hub?',
  'What programmes do you offer?',
  'Where are you located?',
  'How does QR attendance work?',
];

const WELCOME =
  "Hi! I'm the SwahiliPot Assistant. Ask me anything about Swahilipot Hub Foundation or this system.";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // {role, content}
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  async function ask(text) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const next = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await sendChat(next);
      setMessages([...next, { role: 'assistant', content: res.data.reply }]);
    } catch (err) {
      setMessages([
        ...next,
        {
          role: 'assistant',
          content:
            err.response?.data?.error ||
            'Sorry, I had trouble responding. Please try again in a moment.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  }

  return (
    <>
      {/* Launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open Swahilipot assistant"
          className="fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-[#1e40af] text-white shadow-lg transition-transform hover:scale-105 hover:bg-[#1730a0]"
        >
          <MessageCircle size={24} />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-[60] flex h-[540px] max-h-[calc(100vh-2.5rem)] w-[370px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-[#1730a0] to-[#1e40af] px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                <Bot size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">SwahiliPot Assistant</p>
                <p className="text-[11px] text-white/70">Ask about Swahilipot</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-md p-1 hover:bg-white/15">
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-[#f8faff] p-4">
            {/* Welcome */}
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-[#374151] shadow-sm">
                {WELCOME}
              </div>
            </div>

            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => ask(s)}
                    className="inline-flex items-center gap-1 rounded-full border border-[#dbe4ff] bg-white px-3 py-1.5 text-xs font-medium text-[#1e40af] hover:bg-[#eff4ff]"
                  >
                    <Sparkles size={12} /> {s}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap px-3 py-2 text-sm shadow-sm ${
                    m.role === 'user'
                      ? 'rounded-2xl rounded-tr-sm bg-[#1e40af] text-white'
                      : 'rounded-2xl rounded-tl-sm bg-white text-[#374151]'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-tl-sm bg-white px-3 py-2.5 shadow-sm">
                  <span className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#9ca3af] [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#9ca3af] [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#9ca3af]" />
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-[#e2e8f0] bg-white p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask about Swahilipot…"
                className="max-h-24 flex-1 resize-none rounded-xl border border-[#e2e8f0] px-3 py-2 text-sm text-[#374151] focus:border-[#3b63d4] focus:outline-none focus:ring-2 focus:ring-[#b9d0fe]"
              />
              <button
                onClick={() => ask()}
                disabled={loading || !input.trim()}
                aria-label="Send"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1e40af] text-white transition-colors hover:bg-[#1730a0] disabled:opacity-40"
              >
                <Send size={17} />
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-[#9ca3af]">
              I only answer questions about Swahilipot Hub Foundation.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
