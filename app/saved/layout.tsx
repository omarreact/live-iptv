import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Saved",
  description: "Your saved and recently watched Pinflix live TV channels.",
};

export default function SavedLayout({ children }: { children: ReactNode }) {
  return children;
}
