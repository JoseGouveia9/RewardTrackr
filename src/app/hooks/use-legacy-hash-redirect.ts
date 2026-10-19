import { useEffect } from "react";
import { useNavigate } from "react-router";

/** Old share links used "#view=<id>"; they now live at "/view/<id>". */
export function useLegacyHashRedirect(): void {
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#view=")) {
      const id = hash.slice(6).trim();
      if (id) void navigate(`/view/${id}`, { replace: true });
    }
  }, [navigate]);
}
