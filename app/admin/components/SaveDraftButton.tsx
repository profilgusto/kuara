"use client";

import React, { useCallback, useRef } from "react";
import {
  useForm,
  useFormModified,
  useLivePreviewContext,
} from "@payloadcms/ui";
import { useDocumentInfo } from "@payloadcms/ui";
import { useConfig } from "@payloadcms/ui";
import { useLocale } from "@payloadcms/ui";
import { useOperation } from "@payloadcms/ui";
import { useTranslation } from "@payloadcms/ui";
import { useEditDepth } from "@payloadcms/ui";
import { formatAdminURL } from "payload/shared";

export const SaveDraftButton: React.FC = () => {
  const {
    config: {
      routes: { api },
    },
  } = useConfig();
  const {
    id,
    collectionSlug,
    globalSlug,
    setUnpublishedVersionCount,
    uploadStatus,
  } = useDocumentInfo();
  const modified = useFormModified();
  const { code: locale } = useLocale();
  const ref = useRef<HTMLButtonElement>(null);
  const editDepth = useEditDepth();
  const { t } = useTranslation();
  const { submit } = useForm();
  const operation = useOperation();
  const { url: livePreviewURL, setURL: setLivePreviewURL } =
    useLivePreviewContext();

  const disabled =
    (operation === "update" && !modified) || uploadStatus === "uploading";

  const saveDraft = useCallback(async () => {
    if (disabled) return;

    const params = new URLSearchParams({
      depth: "0",
      "fallback-locale": "null",
      draft: "true",
    });
    if (locale) params.set("locale", locale);
    const search = `?${params.toString()}`;
    let action: string | undefined;
    let method = "POST";

    if (collectionSlug) {
      action = formatAdminURL({
        apiRoute: api,
        path: `/${collectionSlug}${id ? `/${id}` : ""}${search}`,
      });
      if (id) method = "PATCH";
    }

    if (globalSlug) {
      action = formatAdminURL({
        apiRoute: api,
        path: `/globals/${globalSlug}${search}`,
      });
    }

    const cachedURL = livePreviewURL;
    const isCreate = !id;

    await submit({
      action,
      method,
      overrides: { _status: "draft" },
      skipValidation: true,
    });

    setUnpublishedVersionCount((count: number) => count + 1);

    // For CREATE operations we're navigating away — don't fire state updates that
    // would interrupt the React 19 concurrent route transition to the new doc URL.
    if (!isCreate) {
      // Restore URL if it vanished (Payload core issue workaround on updates)
      setTimeout(() => {
        if (cachedURL) {
          setLivePreviewURL(cachedURL);
        }
      }, 50);

      // Tell the preview iframe to refresh
      setTimeout(() => {
        const iframes = document.querySelectorAll("iframe");
        iframes.forEach((iframe) => {
          if (iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: "payload-update" }, "*");
          }
        });
      }, 100);
    }
  }, [
    submit,
    collectionSlug,
    globalSlug,
    api,
    locale,
    id,
    disabled,
    setUnpublishedVersionCount,
    livePreviewURL,
    setLivePreviewURL,
  ]);

  return (
    <button
      id="action-save-draft"
      ref={ref}
      type="button"
      disabled={disabled}
      onClick={() => void saveDraft()}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        padding: "8px 16px",
        fontSize: "13px",
        fontWeight: 500,
        fontFamily: "inherit",
        lineHeight: "20px",
        borderRadius: "4px",
        border: "1px solid var(--theme-elevation-400, #555)",
        background: "var(--theme-elevation-100, #222)",
        color: "var(--theme-elevation-800, #ccc)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.15s ease",
        whiteSpace: "nowrap",
        marginRight: "8px",
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = "var(--theme-elevation-200, #333)";
          e.currentTarget.style.borderColor =
            "var(--theme-elevation-500, #666)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--theme-elevation-100, #222)";
        e.currentTarget.style.borderColor = "var(--theme-elevation-400, #555)";
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
      </svg>
      {t("version:saveDraft")}
    </button>
  );
};

export default SaveDraftButton;
