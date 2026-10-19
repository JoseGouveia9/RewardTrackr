import { useEffect, useState } from "react";
import {
  fetchAnnouncement,
  type Announcement,
} from "@/components/announcement-banner/api/announcement";
import {
  LOCAL_STORAGE_KEY_NOTICE_RATE_LIMITS,
  LOCAL_STORAGE_KEY_NOTICE_UNOFFICIAL,
  LOCAL_STORAGE_KEY_NOTICE_OPENSOURCE,
  LOCAL_STORAGE_KEY_NOTICE_ANNOUNCEMENT_PREFIX,
} from "@/lib/storage-keys";

export interface NoticesState {
  noticeRateLimitsDismissed: boolean;
  noticeUnofficialDismissed: boolean;
  noticeOpenSourceDismissed: boolean;
  announcement: Announcement | null;
  announcementDismissed: boolean;
  dismissRateLimits: () => void;
  dismissUnofficial: () => void;
  dismissOpenSource: () => void;
  dismissAnnouncement: () => void;
}

/**
 * Dismissal state for the info notices (persisted) and the remote announcement, which is
 * dismissed per announcement id.
 */
export function useNotices(): NoticesState {
  const [noticeRateLimitsDismissed, setNoticeRateLimitsDismissed] = useState(
    () => localStorage.getItem(LOCAL_STORAGE_KEY_NOTICE_RATE_LIMITS) === "1",
  );
  const [noticeUnofficialDismissed, setNoticeUnofficialDismissed] = useState(
    () => localStorage.getItem(LOCAL_STORAGE_KEY_NOTICE_UNOFFICIAL) === "1",
  );
  const [noticeOpenSourceDismissed, setNoticeOpenSourceDismissed] = useState(
    () => localStorage.getItem(LOCAL_STORAGE_KEY_NOTICE_OPENSOURCE) === "1",
  );
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);

  useEffect(() => {
    fetchAnnouncement().then((data) => {
      if (!data) return;
      const dismissed =
        localStorage.getItem(LOCAL_STORAGE_KEY_NOTICE_ANNOUNCEMENT_PREFIX + data.id) === "1";
      setAnnouncementDismissed(dismissed);
      setAnnouncement(data);
    });
  }, []);

  function dismiss(key: string, setter: (isDismissed: boolean) => void) {
    localStorage.setItem(key, "1");
    setter(true);
  }

  return {
    noticeRateLimitsDismissed,
    noticeUnofficialDismissed,
    noticeOpenSourceDismissed,
    announcement,
    announcementDismissed,
    dismissRateLimits: () =>
      dismiss(LOCAL_STORAGE_KEY_NOTICE_RATE_LIMITS, setNoticeRateLimitsDismissed),
    dismissUnofficial: () =>
      dismiss(LOCAL_STORAGE_KEY_NOTICE_UNOFFICIAL, setNoticeUnofficialDismissed),
    dismissOpenSource: () =>
      dismiss(LOCAL_STORAGE_KEY_NOTICE_OPENSOURCE, setNoticeOpenSourceDismissed),
    dismissAnnouncement: () => {
      if (!announcement) return;
      localStorage.setItem(LOCAL_STORAGE_KEY_NOTICE_ANNOUNCEMENT_PREFIX + announcement.id, "1");
      setAnnouncementDismissed(true);
    },
  };
}
