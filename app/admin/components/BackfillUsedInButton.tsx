"use client";

import React, { useState } from "react";
import { toast } from "@payloadcms/ui";
import { comBasePath } from "@/lib/base-path";

export const BackfillUsedInButton: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        comBasePath("/api/admin/backfill-media-used-in"),
        {
          method: "POST",
        },
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Backfill failed");
      } else {
        toast.success(`Used In updated for ${data.updated} media item(s)`);
      }
    } catch {
      toast.error("Network error — backfill failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        padding: "0 0 12px 0",
      }}
    >
      <button
        onClick={handleClick}
        disabled={loading}
        className="btn btn--style-secondary btn--size-small"
      >
        {loading ? "Updating..." : "Update Used In"}
      </button>
    </div>
  );
};

export default BackfillUsedInButton;
