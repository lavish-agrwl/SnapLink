import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { API_BASE_URL } from "../lib/api";

export default function RedirectView() {
  const { slug } = useParams<{ slug: string }>();

  useEffect(() => {
    if (!slug) return;

    const redirectUrl = `${API_BASE_URL.replace(/\/$/, "")}/${encodeURIComponent(slug)}`;
    window.location.replace(redirectUrl);
  }, [slug]);

  return (
    <div className="flex min-h-32 items-center justify-center text-muted-foreground">
      Redirecting...
    </div>
  );
}
