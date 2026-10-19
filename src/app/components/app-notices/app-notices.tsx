import { useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { AppNotice } from "@/components/app-notice/app-notice";
import { AnnouncementBanner } from "@/components/announcement-banner/announcement-banner";
import { useNotices } from "../../hooks/use-notices";
import { ShieldIcon, WarningIcon } from "@/components/icons";

export function AppNotices({ signedIn }: { signedIn: boolean }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const notices = useNotices();
  const isSharedView = pathname.startsWith("/view/");

  return (
    <>
      {notices.announcement && (
        <AnnouncementBanner
          visible={!notices.announcementDismissed}
          message={notices.announcement.message}
          onDismiss={notices.dismissAnnouncement}
        />
      )}

      <AppNotice
        visible={!isSharedView && !notices.noticeRateLimitsDismissed}
        onDismiss={notices.dismissRateLimits}
        icon={<WarningIcon className="app-notice-icon" />}
      >
        {t("app.rateLimitsNotice")}
      </AppNotice>

      <AppNotice
        visible={!isSharedView && !notices.noticeUnofficialDismissed}
        className="app-notice-unofficial"
        onDismiss={notices.dismissUnofficial}
        icon={<WarningIcon className="app-notice-icon" />}
      >
        {t("app.unofficialNotice")}
      </AppNotice>

      <AppNotice
        visible={!isSharedView && !signedIn && !notices.noticeOpenSourceDismissed}
        className="app-notice-opensource"
        onDismiss={notices.dismissOpenSource}
        icon={<ShieldIcon className="app-notice-icon" />}
      >
        {t("app.openSourceNotice")}{" "}
        <a
          href="https://github.com/JoseGouveia9/RewardTrackr"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("app.checkItHere")}
        </a>
      </AppNotice>
    </>
  );
}
