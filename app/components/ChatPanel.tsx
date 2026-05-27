'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type Node } from '@xyflow/react';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: Date;
}

interface ChatPanelProps {
  repoName: string;
  nodesCount: number;
  edgesCount: number;
  selectedNode: Node | null;
  onSendMessage: (text: string) => Promise<string>;
}

export function ChatPanel({
  repoName,
  nodesCount,
  edgesCount,
  selectedNode,
  onSendMessage,
}: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'agent',
      text: `Hello! I am your Repository Intelligence Agent. I have parsed **${repoName}** containing **${nodesCount} nodes** and **${edgesCount} edges**. How can I help you explore this codebase?`,
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Expand panel automatically when a node is selected to draw user attention
  useEffect(() => {
    if (selectedNode) {
      setIsOpen(true);
    }
  }, [selectedNode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput('');
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const reply = await onSendMessage(userText);
      const agentMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'agent',
        text: reply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, agentMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now() + 2}`,
        sender: 'agent',
        text: 'Sorry, I encountered an error communicating with the agent server.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Toggle Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={[
          'fixed bottom-6 right-6 z-30 flex items-center justify-center w-14 h-14 rounded-full',
          'bg-gradient-to-tr from-violet-600/70 to-fuchsia-600/70 text-white font-medium',
          'border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl',
          'hover:scale-105 active:scale-95 transition-transform duration-200 cursor-pointer',
        ].join(' ')}
        aria-label={isOpen ? 'Close chat' : 'Open repo chat assistant'}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 150, damping: 12, delay: 0.8 }}
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </motion.button>

      {/* Floating Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 400, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 400, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 120, damping: 14 }}
            className={[
              'fixed top-24 right-6 bottom-24 z-20 w-[380px] md:w-[420px] flex flex-col',
              'bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-glass-depth overflow-hidden',
            ].join(' ')}
          >
            {/* Header */}
            <div className="px-4 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
              <div className="flex flex-col">
                <h2 className="text-sm font-semibold text-white/95">Repository Agent</h2>
                <span className="text-[10px] text-white/40 tracking-wider font-mono truncate max-w-[280px]">
                  Context: {repoName}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-white/50 uppercase tracking-widest font-medium">Online</span>
              </div>
            </div>

            {/* Message Area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col max-w-[85%] ${
                    msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                  }`}
                >
                  <div
                    className={[
                      'px-3 py-2 rounded-2xl text-sm leading-relaxed',
                      msg.sender === 'user'
                        ? 'bg-gradient-to-tr from-violet-600/50 to-fuchsia-600/50 text-white border border-white/15 shadow-[0_4px_12px_rgba(0,0,0,0.15)] rounded-tr-none'
                        : 'bg-white/5 text-white/90 border border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.1)] rounded-tl-none',
                    ].join(' ')}
                  >
                    {/* Basic Markdown Support for Bold text */}
                    {msg.text.split('**').map((part, idx) =>
                      idx % 2 === 1 ? <strong key={idx} className="font-bold text-white">{part}</strong> : part
                    )}
                  </div>
                  <span className="text-[9px] text-white/30 mt-1 px-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}

              {isLoading && (
                <div className="flex flex-col mr-auto items-start max-w-[85%]">
                  <div className="px-3 py-2 rounded-2xl rounded-tl-none bg-white/5 border border-white/10 text-white/50 text-xs flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Selected Node Context Chip */}
            <AnimatePresence>
              {selectedNode && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 15 }}
                  className="px-3 py-1.5 mx-3 mb-2 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs backdrop-blur-md"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-white/40 uppercase tracking-widest text-[9px] font-bold shrink-0">Focusing:</span>
                    <span className="text-violet-300 font-semibold truncate">
                      {selectedNode.data?.label || selectedNode.id}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/50 border border-white/5 shrink-0 uppercase tracking-wider">
                      {selectedNode.type || 'node'}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="p-3 bg-white/5 border-t border-white/10 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                placeholder={selectedNode ? `Ask about "${selectedNode.data?.label || selectedNode.id}"...` : "Ask about files, modules, dependencies..."}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 transition-colors"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className={[
                  'w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer',
                  input.trim() && !isLoading
                    ? 'bg-violet-600/70 text-white hover:bg-violet-600/90 active:scale-95 border border-white/10'
                    : 'bg-white/5 text-white/30 cursor-not-allowed border border-white/5',
                ].join(' ')}
              >
                <svg className="w-4 h-4 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
