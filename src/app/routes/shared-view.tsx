import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import { DataViewer } from "@/features/data-viewer";
import { SharedBanner, fetchSharedProfile } from "@/features/shared";
import type { SharedProfile } from "@/features/shared";

export function SharedView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<SharedProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchSharedProfile(id)
      .then((p) => setProfile(p))
      .catch(() => void navigate("/", { replace: true }))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const returnTo = (location.state as { from?: string } | null)?.from ?? "/";

  function handleClose() {
    setProfile(null);
    navigate(returnTo, { replace: true });
  }

  return (
    <DataViewer
      onClose={handleClose}
      isFetching={loading}
      fetchingKeys={undefined}
      cacheVersion={0}
      onTabSeen={() => {}}
      sharedData={loading ? {} : (profile?.sheets ?? null)}
      title="Community"
      banner={
        <SharedBanner profile={profile ?? undefined} loading={loading} onClose={handleClose} />
      }
      onShare={undefined}
      shareDisabled={false}
    />
  );
}
