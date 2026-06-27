"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSignaling } from "@/contexts/SignalingContext";
import { useRoom } from "@/contexts/RoomContext";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { StageInvitationMsg } from "@/types/signaling";

export function StageInviteToast() {
  const { send, on } = useSignaling();
  const { myRole } = useRoom();
  const [inviterPeerId, setInviterPeerId] = useState<string | null>(null);
  const t = useTranslations("StageInvite");

  useEffect(() => {
    const unsub = on("stage_invitation", (m) => {
      if (myRole === "listener" || myRole === "viewer") {
        setInviterPeerId((m as StageInvitationMsg).from_peer_id);
      }
    });
    return unsub;
  }, [on, myRole]);

  const accept = () => {
    send({ type: "accept_stage_invitation" });
    setInviterPeerId(null);
  };

  const decline = () => {
    send({ type: "decline_stage_invitation" });
    setInviterPeerId(null);
  };

  return (
    <Modal open={!!inviterPeerId} onClose={decline} title={t("title")}>
      <p className="text-gray-400 text-sm mb-6">{t("description")}</p>
      <div className="flex gap-3 justify-end">
        <Button variant="ghost" onClick={decline}>
          {t("decline")}
        </Button>
        <Button onClick={accept}>{t("accept")}</Button>
      </div>
    </Modal>
  );
}
