import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate, useLocation } from "react-router";
import { DataViewer } from "@/features/records";
import { SharedBanner, fetchSharedProfile, type SharedProfile } from "@/features/community";

export function SharedView() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<SharedProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchSharedProfile(id)
      .then((sharedProfile) => setProfile(sharedProfile))
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
      sharedData={loading ? {} : (profile?.sheets ?? null)}
      header={{ title: t("share.communityTitle") }}
      banner={<SharedBanner profile={profile ?? undefined} loading={loading} />}
    />
  );
}
