import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className="container" style={{ paddingTop: '8rem', textAlign: 'center' }}>
      <div className="glass card" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '3.5rem', marginBottom: '1.5rem', background: 'linear-gradient(to right, var(--primary), var(--secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          WhatsApp Hospital Bot
        </h1>
        <p style={{ fontSize: '1.25rem', marginBottom: '2.5rem' }}>
          An AI-powered conversational assistant for booking hospital appointments.
          Streamline your patient experience with natural language scheduling on WhatsApp.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <Link href="/admin/whatsapp" className="button button-primary">
            Connect WhatsApp
          </Link>
          <Link href="/api/appointments" className="button" style={{ border: '1px solid var(--border)' }}>
            View Appointments
          </Link>
        </div>

        <div style={{ marginTop: '4rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2rem' }}>
          <div style={{ textAlign: 'left' }}>
            <h3 style={{ color: 'var(--primary)' }}>24/7 Booking</h3>
            <p style={{ fontSize: '0.875rem' }}>Allow patients to book anytime without human intervention.</p>
          </div>
          <div style={{ textAlign: 'left' }}>
            <h3 style={{ color: 'var(--primary)' }}>AI Powered</h3>
            <p style={{ fontSize: '0.875rem' }}>Natural language understanding for dates, doctors, and intents.</p>
          </div>
          <div style={{ textAlign: 'left' }}>
            <h3 style={{ color: 'var(--primary)' }}>Dashboard</h3>
            <p style={{ fontSize: '0.875rem' }}>Monitor and manage all appointments in a clean interface.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
