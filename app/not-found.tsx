import Link from "next/link";

export default function NotFound() {
  return (
    <section className="empty-state full-page">
      <span className="eyebrow">404</span>
      <h1>Channel not found</h1>
      <p>The channel may have been renamed or removed from the current playlist.</p>
      <Link className="primary-link" href="/">Back to Live TV</Link>
    </section>
  );
}
