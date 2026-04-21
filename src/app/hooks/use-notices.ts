import { useEffect, useState } from "react";
import { fetchAnnouncement } from "@/features/shared";
import type { Announcement } from "@/features/shared";
import {
  LS_KEY_NOTICE_RATE_LIMITS,
  LS_KEY_NOTICE_UNOFFICIAL,
  LS_KEY_NOTICE_OPENSOURCE,
  LS_KEY_NOTICE_ANNOUNCEMENT_PREFIX,
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

// Manages dismiss state for all app notices and banners, persisting dismissals to localStorage.
export function useNotices(): NoticesState {
  const [noticeRateLimitsDismissed, setNoticeRateLimitsDismissed] = useState(
    () => localStorage.getItem(LS_KEY_NOTICE_RATE_LIMITS) === "1",
  );
  const [noticeUnofficialDismissed, setNoticeUnofficialDismissed] = useState(
    () => localStorage.getItem(LS_KEY_NOTICE_UNOFFICIAL) === "1",
  );
  const [noticeOpenSourceDismissed, setNoticeOpenSourceDismissed] = useState(
    () => localStorage.getItem(LS_KEY_NOTICE_OPENSOURCE) === "1",
  );
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);

  useEffect(() => {
    fetchAnnouncement().then((data) => {
      if (!data) return;
      const dismissed = localStorage.getItem(LS_KEY_NOTICE_ANNOUNCEMENT_PREFIX + data.id) === "1";
      setAnnouncementDismissed(dismissed);
      setAnnouncement(data);
    });
  }, []);

  // Persists a notice dismissal and updates local state.
  function dismiss(key: string, setter: (v: boolean) => void) {
    localStorage.setItem(key, "1");
    setter(true);
  }

  return {
    noticeRateLimitsDismissed,
    noticeUnofficialDismissed,
    noticeOpenSourceDismissed,
    announcement,
    announcementDismissed,
    dismissRateLimits: () => dismiss(LS_KEY_NOTICE_RATE_LIMITS, setNoticeRateLimitsDismissed),
    dismissUnofficial: () => dismiss(LS_KEY_NOTICE_UNOFFICIAL, setNoticeUnofficialDismissed),
    dismissOpenSource: () => dismiss(LS_KEY_NOTICE_OPENSOURCE, setNoticeOpenSourceDismissed),
    dismissAnnouncement: () => {
      if (!announcement) return;
      localStorage.setItem(LS_KEY_NOTICE_ANNOUNCEMENT_PREFIX + announcement.id, "1");
      setAnnouncementDismissed(true);
    },
  };
}
