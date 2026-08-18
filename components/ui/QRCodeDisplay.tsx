"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  className?: string;
}

export function QRCodeDisplay({ value, size = 180, className = "" }: QRCodeDisplayProps) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    if (!value) return;

    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: {
        dark: "#09090b", // zinc-950 dark modules
        light: "#ffffff", // clean crisp white background
      },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        setDataUrl(url);
        setError(false);
      })
      .catch((err) => {
        console.error("QR Code generation error:", err);
        setError(true);
      });
  }, [value, size]);

  if (error || !dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-500 ${className}`}
      >
        <span>Generating QR...</span>
      </div>
    );
  }

  return (
    <div className={`p-3 rounded-xl bg-white border border-zinc-200 shadow-sm inline-block ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl}
        alt={`QR code for ${value}`}
        width={size}
        height={size}
        className="rounded select-none"
      />
    </div>
  );
}
