import api from './axios';

// messages: [{ role: 'user' | 'assistant', content: string }]
export const sendChat = (messages) => api.post('/chat', { messages });
