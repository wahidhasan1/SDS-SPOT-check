export default function Privacy() {
  return (
    <div className="prose-lesson mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold">Privacy</h1>
      <p>FluentPath stores the information you give us (email, display name, learning preferences) and the results of your learning activities so we can show your progress. Passwords are stored only as salted scrypt hashes.</p>
      <h2>Voice calls</h2>
      <p>During voice practice your partner sees only a random anonymous name and, if you allow it in settings, your estimated English level. Audio is sent directly between devices using WebRTC (or relayed through a TURN server when a direct connection is impossible). FluentPath does not record calls. We keep call metadata (time, duration, mode) for your call history and for safety reports.</p>
      <h2>Uploads</h2>
      <p>Book page photos and speaking recordings you upload are stored on our server and visible only to you (and administrators handling a support or safety issue). You can delete them at any time.</p>
      <h2>Third-party services</h2>
      <p>If the operator of this server configures them, writing, speaking and reader explanations are processed by an AI provider (Anthropic), payments by Stripe and email by an SMTP provider. When a service is not configured, the related feature says so clearly.</p>
      <h2>Your choices</h2>
      <p>You can edit your profile, change notification and privacy settings, block users, and deactivate or permanently delete your account from Settings.</p>
    </div>
  );
}
