"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import { Plus, Mail, MessageSquare, Smartphone } from "lucide-react";

interface ConnectProviderButtonProps {
  onClick: () => void;
  className?: string;
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
  label?: string;
  channel?: "EMAIL" | "WHATSAPP" | "SMS";
}

export const ConnectProviderButton: React.FC<ConnectProviderButtonProps> = ({
  onClick,
  className = "",
  variant = "primary",
  size = "md",
  label,
  channel = "EMAIL",
}) => {
  const isWhatsApp = channel === "WHATSAPP";
  const isSms = channel === "SMS";
  const defaultLabel = "";

  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      className={`inline-flex items-center gap-2 shadow-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] ${
        isWhatsApp && variant === "primary"
          ? "bg-emerald-600 hover:bg-emerald-700 text-white border-transparent"
          : isSms && variant === "primary"
            ? "bg-sky-600 hover:bg-sky-700 text-white border-transparent"
            : ""
      } ${className}`}
    >
      <Plus className="w-4 h-4" />
      {isSms ? (
        <Smartphone className="w-4 h-4" />
      ) : isWhatsApp ? (
        <MessageSquare className="w-4 h-4" />
      ) : (
        <Mail className="w-4 h-4" />
      )}
      <span>{label || defaultLabel}</span>
    </Button>
  );
};
