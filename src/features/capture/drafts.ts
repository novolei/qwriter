import { useEffect, useRef, useState } from "react";
import { newCard, type Card } from "./cards";
export const quickDraftKey = "qwriter.capture.draft";
const recoveryPrefix = "qwriter.capture.recovery.";
export function recoverAllDrafts(): Card[] {
  try {
    return Object.keys(localStorage)
      .filter((key) => key.startsWith(recoveryPrefix))
      .map((key) => recoverDraft(key))
      .filter(
        (card) => card.body.trim() || card.title.trim() || card.assetIds.length,
      );
  } catch {
    return [];
  }
}
export function recoverDraft(key = quickDraftKey): Card {
  try {
    const data = JSON.parse(localStorage.getItem(key) || "null");
    if (
      data &&
      typeof data.id === "string" &&
      typeof data.body === "string" &&
      typeof data.title === "string" &&
      Array.isArray(data.assetIds) &&
      data.assetIds.every((id: unknown) => typeof id === "string")
    )
      return { ...newCard(), ...data };
  } catch {
    /* a malformed cache must not prevent capture */
  }
  return newCard();
}
export function useCardDraft(card: Card, key?: string) {
  const latest = useRef(card);
  const saved = useRef(false);
  const [cached, setCached] = useState(false);
  latest.current = card;
  function persist() {
    if (!key || saved.current) return false;
    try {
      localStorage.setItem(key, JSON.stringify(latest.current));
      if (
        latest.current.body.trim() ||
        latest.current.title.trim() ||
        latest.current.assetIds.length
      )
        localStorage.setItem(
          `${recoveryPrefix}${latest.current.id}`,
          JSON.stringify(latest.current),
        );
      window.dispatchEvent(new Event("qwriter-drafts-changed"));
      return true;
    } catch {
      return false;
    }
  }
  useEffect(() => {
    const timer = setTimeout(() => setCached(persist()), 250);
    return () => clearTimeout(timer);
  }, [card, key]);
  useEffect(() => {
    const leaving = () => {
      persist();
    };
    window.addEventListener("beforeunload", leaving);
    return () => {
      window.removeEventListener("beforeunload", leaving);
      persist();
    };
  }, [key]);
  function clear() {
    saved.current = true;
    if (key) {
      try {
        localStorage.removeItem(key);
        localStorage.removeItem(`${recoveryPrefix}${latest.current.id}`);
      } catch {
        /* database save already succeeded */
      }
    }
  }
  return { cached, clear };
}
