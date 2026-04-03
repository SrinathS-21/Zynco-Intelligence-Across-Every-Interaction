'use client';

import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function AdminChatsPage() {
    const [conversations, setConversations] = useState<any[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchConversations();
        const interval = setInterval(fetchConversations, 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (selectedId) {
            fetchMessages(selectedId);
            const interval = setInterval(() => fetchMessages(selectedId), 3000);
            return () => clearInterval(interval);
        }
    }, [selectedId]);

    const fetchConversations = async () => {
        const res = await fetch('/api/admin/conversations');
        const data = await res.json();
        if (Array.isArray(data)) setConversations(data);
        setLoading(false);
    };

    const fetchMessages = async (id: string) => {
        const res = await fetch(`/api/admin/conversations/${id}/messages`);
        const data = await res.json();
        if (Array.isArray(data)) setMessages(data);
    };

    const selectedChat = conversations.find(c => c.id === selectedId);

    return (
        <div className="admin-container">
            <Head>
                <title>Chat Management | SPINaBOT Health</title>
            </Head>

            <header className="admin-header">
                <h1>Conversations 💬</h1>
                <p>Monitor patient interactions in real-time.</p>
            </header>

            <div className="chat-layout">
                {/* Left Side: Conversation List */}
                <div className="chat-list">
                    {loading ? (
                        <div className="loading-spinner">Loading chats...</div>
                    ) : conversations.length === 0 ? (
                        <div className="empty-state">No active conversations found.</div>
                    ) : (
                        conversations.map((chat) => (
                            <div
                                key={chat.id}
                                className={`chat-item ${selectedId === chat.id ? 'active' : ''}`}
                                onClick={() => setSelectedId(chat.id)}
                            >
                                <div className="chat-avatar">
                                    {chat.patient?.name?.[0] || 'P'}
                                </div>
                                <div className="chat-info">
                                    <div className="chat-header-row">
                                        <span className="chat-name">{chat.patient?.name || chat.patient?.phoneNumber}</span>
                                        <span className="chat-time">
                                            {new Date(chat.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="chat-preview">{chat.messages?.[0]?.content || 'New conversation'}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Right Side: Message View */}
                <div className="message-view">
                    {selectedId ? (
                        <>
                            <div className="message-header">
                                <div className="header-info">
                                    <h2>{selectedChat?.patient?.name || selectedChat?.patient?.phoneNumber}</h2>
                                    <span className="patient-tag">Patient Profile: {selectedChat?.patient?.bloodGroup || 'General'}</span>
                                </div>
                                <div className="status-badge ACTIVE">Active Agent</div>
                            </div>

                            <div className="message-container">
                                {messages.map((msg) => (
                                    <div key={msg.id} className={`message-bubble ${msg.role}`}>
                                        <div className="bubble-content">
                                            {msg.type === 'image' && msg.metadata?.path && (
                                                <div className="card-attachment">
                                                    🖼️ Image Sent (View in WhatsApp)
                                                </div>
                                            )}
                                            <p dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, '<br/>') }} />
                                            <span className="bubble-time">
                                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="chat-placeholder">
                            <div className="placeholder-icon">📥</div>
                            <h3>Select a conversation to view history</h3>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                .admin-container {
                    padding: 2rem;
                    max-width: 1400px;
                    margin: 0 auto;
                    font-family: 'Inter', system-ui, sans-serif;
                    background: #f8fafc;
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                }
                .admin-header { margin-bottom: 2rem; }
                .admin-header h1 { font-size: 2.5rem; color: #1e293b; font-weight: 800; }
                
                .chat-layout {
                    display: flex;
                    background: white;
                    border-radius: 24px;
                    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);
                    flex: 1;
                    overflow: hidden;
                    border: 1px solid #e2e8f0;
                }

                .chat-list {
                    width: 350px;
                    border-right: 1px solid #e2e8f0;
                    overflow-y: auto;
                    background: #fdfdfd;
                }

                .chat-item {
                    display: flex;
                    padding: 1.25rem;
                    gap: 1rem;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    border-bottom: 1px solid #f1f5f9;
                }
                .chat-item:hover { background: #f8fafc; }
                .chat-item.active { background: #eff6ff; border-left: 4px solid #3b82f6; }

                .chat-avatar {
                    width: 48px;
                    height: 48px;
                    background: #3b82f6;
                    color: white;
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    font-size: 1.25rem;
                    flex-shrink: 0;
                }

                .chat-info { flex: 1; overflow: hidden; }
                .chat-header-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
                .chat-name { font-weight: 600; color: #1e293b; }
                .chat-time { font-size: 0.75rem; color: #64748b; }
                .chat-preview { 
                    font-size: 0.875rem; 
                    color: #64748b; 
                    white-space: nowrap; 
                    overflow: hidden; 
                    text-overflow: ellipsis; 
                }

                .message-view {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    background: white;
                }

                .message-header {
                    padding: 1.5rem 2rem;
                    border-bottom: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .header-info h2 { font-size: 1.25rem; font-weight: 700; color: #1e293b; margin: 0; }
                .patient-tag { font-size: 0.75rem; color: #3b82f6; font-weight: 600; }
                
                .status-badge {
                    padding: 4px 12px;
                    border-radius: 999px;
                    font-size: 0.75rem;
                    font-weight: bold;
                    text-transform: uppercase;
                }
                .status-badge.ACTIVE { background: #dcfce7; color: #166534; }

                .message-container {
                    flex: 1;
                    padding: 2rem;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                    background: #f1f5f9;
                }

                .message-bubble {
                    display: flex;
                    max-width: 70%;
                }
                .message-bubble.user { align-self: flex-start; }
                .message-bubble.bot { align-self: flex-end; }

                .bubble-content {
                    padding: 1rem 1.25rem;
                    border-radius: 20px;
                    position: relative;
                    font-size: 0.9375rem;
                    line-height: 1.5;
                }
                .user .bubble-content { background: white; border-bottom-left-radius: 4px; color: #1e293b; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
                .bot .bubble-content { background: #3b82f6; color: white; border-bottom-right-radius: 4px; }

                .bubble-time {
                    display: block;
                    font-size: 0.7rem;
                    margin-top: 6px;
                    opacity: 0.7;
                    text-align: right;
                }

                .chat-placeholder {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    color: #94a3b8;
                }
                .placeholder-icon { font-size: 4rem; margin-bottom: 1rem; }

                .card-attachment {
                    background: rgba(255,255,255,0.1);
                    padding: 1rem;
                    border-radius: 12px;
                    border: 1px dashed rgba(255,255,255,0.3);
                    margin-bottom: 10px;
                    font-size: 0.8rem;
                }
            `}</style>
        </div>
    );
}
