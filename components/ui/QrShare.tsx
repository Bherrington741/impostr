"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, QrCode, Share2 } from "lucide-react";
import { Press } from "@/components/ui/Press";

export function QrShare({ code }: { code: string }) {
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/room/${code}`;

  async function copy(text: string, what: "link" | "code") {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(what);
    setTimeout(() => setCopied(null), 1600);
  }

  function nativeShare() {
    if (navigator.share) {
      void navigator.share({
        title: `Join my Impostr room: ${code}`,
        text: `Join my Impostr room!\nCode: ${code}\n${link}`,
        url: link,
      }).catch(() => {});
    } else {
      void copy(link, "link");
    }
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div
          onClick={() => void copy(code, "code")}
          className="flex-1 cursor-pointer rounded-2xl bg-slate-900/80 px-4 py-3 text-center"
          title="Tap to copy code"
        >
          <div className="text-[10px] font-bold tracking-[0.3em] text-slate-400">ROOM CODE</div>
          <div className="text-glow-white text-3xl font-black tracking-[0.35em] text-white">{code}</div>
        </div>
        <button
          onClick={() => setShowQr((v) => !v)}
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border transition-all ${
            showQr ? "border-lime-400/60 bg-lime-400/10 text-lime-300 glow-acid" : "border-white/10 bg-white/5 text-slate-300"
          }`}
          aria-label="Toggle QR code"
        >
          <QrCode className="h-6 w-6" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_1fr] gap-2">
        <Press variant="ghost" onClick={nativeShare} className="text-sm">
          <Share2 className="h-4 w-4" /> Share invite
        </Press>
        <Press variant="ghost" onClick={() => void copy(link, "link")} className="text-sm">
          {copied === "link" ? <Check className="h-4 w-4 text-lime-400" /> : <Copy className="h-4 w-4" />}
          {copied === "link" ? "Copied!" : "Copy link"}
        </Press>
      </div>

      {showQr && (
        <div className="mt-4 flex flex-col items-center gap-2">
          <div className="rounded-2xl bg-white p-3 shadow-[0_0_40px_rgba(163,230,53,0.25)]">
            <QRCodeSVG value={link} size={168} bgColor="#ffffff" fgColor="#020617" level="M" />
          </div>
          <span className="text-[11px] font-bold text-slate-400">Scan or type impostr → room {code}</span>
        </div>
      )}
    </div>
  );
}
