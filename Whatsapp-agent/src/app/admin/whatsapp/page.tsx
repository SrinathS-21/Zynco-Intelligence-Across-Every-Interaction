'use client';

import { useState, useEffect } from 'react';
import styles from './admin.module.css';

export default function WhatsAppAdmin() {
    const [status, setStatus] = useState<string>('DISCONNECTED');
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [googleConnected, setGoogleConnected] = useState(false);
    const [googleAuthUrl, setGoogleAuthUrl] = useState('');

    const fetchStatus = async () => {
        try {
            const res = await fetch('/api/whatsapp/status');
            const data = await res.json();
            setStatus(data.status);
            setQrCode(data.qr);
            setGoogleConnected(data.googleConnected);
            setGoogleAuthUrl(data.googleAuthUrl);
            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch status:', error);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="container" style={{ paddingTop: '4rem', paddingBottom: '4rem' }}>
            <div className="card glass">
                <h1>Admin Dashboard</h1>
                <p>Manage your WhatsApp bot and Google integrations.</p>

                <div className={styles.section}>
                    <h2>📱 WhatsApp Connection</h2>
                    <div className={styles.statusBadge}>
                        <span className={`${styles.dot} ${status === 'CONNECTED' ? styles.dotConnected : status === 'CONNECTING' ? styles.dotConnecting : styles.dotDisconnected}`}></span>
                        Status: {status}
                    </div>

                    {loading ? (
                        <div className={styles.loading}>Checking connection...</div>
                    ) : status === 'CONNECTED' ? (
                        <div className={styles.successBox}>
                            <h3>✅ Bot Active with Stealth Protection</h3>
                            <p>Your WhatsApp is connected. Stealth mode, random delays, and human emulation are enabled.</p>
                            <button className="button button-primary" style={{ marginTop: '1rem' }} onClick={() => window.location.reload()}>Refresh</button>
                        </div>
                    ) : status === 'CONNECTING' && qrCode ? (
                        <div className={styles.qrContainer}>
                            <h3>Scan QR Code</h3>
                            <p>Open WhatsApp on your phone, go to Linked Devices, and scan this code.</p>
                            <div className={styles.qrImageWrapper}>
                                <img src={qrCode} alt="WhatsApp QR Code" className={styles.qrImage} />
                            </div>
                            <p className={styles.hint}>The QR code updates every few seconds.</p>
                        </div>
                    ) : (
                        <div className={styles.idleBox}>
                            <p>Waiting for WhatsApp to initialize...</p>
                            <div className={styles.spinner}></div>
                        </div>
                    )}
                </div>

                <div className={styles.section} style={{ marginTop: '3rem' }}>
                    <h2>🔑 Google Integration</h2>
                    <p>Sync appointments to Google Sheets and Google Calendar.</p>

                    {googleConnected ? (
                        <div className={styles.successBox} style={{ border: '2px solid var(--primary)', background: 'rgba(59, 130, 246, 0.1)' }}>
                            <h3>📅 Google Services Synced</h3>
                            <p>Successfully authorized. Appointments will be logged to your sheet and calendar.</p>
                            <a href={googleAuthUrl} className="button button-secondary" style={{ marginTop: '1rem', display: 'inline-block' }}>Reconnect Google</a>
                        </div>
                    ) : (
                        <div className={styles.idleBox} style={{ border: '1px dashed var(--border)', borderRadius: '1rem' }}>
                            <p>Google is not connected. Authorize to enable sheet and calendar sync.</p>
                            <a href={googleAuthUrl} className="button button-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>Connect Google Account</a>
                        </div>
                    )}
                </div>

                <div className={styles.securitySection}>
                    <h3>🛡️ Security & Anti-Ban Guide</h3>
                    <div className={styles.grid}>
                        <div className={styles.securityCard}>
                            <h4>Human Emulation</h4>
                            <p>Simulated typing (2-5s) and read receipts are active to hide automated patterns.</p>
                        </div>
                        <div className={styles.securityCard}>
                            <h4>Message Queuing</h4>
                            <p>Bot processes one message at a time with random gaps (3-7s) between different users.</p>
                        </div>
                        <div className={styles.securityCard}>
                            <h4>Account Warming</h4>
                            <p>For new numbers, start slow (5-10 msgs/day) and increase gradually over 2 weeks.</p>
                        </div>
                        <div className={styles.securityCard}>
                            <h4>Stealth Browser</h4>
                            <p>Using Puppeteer Stealth, Custom User-Agents, and Proxy support to mask bot nature.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
