import { Button } from "../components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-5 py-32 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-terracotta">404</p>
      <h1 className="mt-4 font-serif-display text-3xl text-charcoal">Page Not Found</h1>
      <p className="mt-4 text-charcoal-soft">
        The page you're looking for doesn't exist in this demo build.
      </p>
      <Button to="/" className="mt-8">
        Back to Home
      </Button>
    </div>
  );
}
