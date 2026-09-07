import { useCallback, useEffect, useRef, useState } from "react";
import { errorText } from "../../shared/i18n";
import { loadCards, saveCard, subscribeCards, type Card } from "./cards";

export function useCards() {
  const [cards, setCards] = useState<Card[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const epoch = useRef(0);
  const alive = useRef(true);
  const reload = useCallback(async () => {
    const request = ++epoch.current;
    try {
      const result = await loadCards();
      if (alive.current && request === epoch.current) {
        setCards(result);
        setError("");
      }
    } catch (error) {
      if (alive.current && request === epoch.current)
        setError(errorText(error));
    } finally {
      if (alive.current && request === epoch.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    void reload();
    let dispose: (() => void) | undefined;
    let stopped = false;
    void subscribeCards(() => {
      void reload();
    })
      .then((cleanup) => {
        if (stopped) cleanup();
        else dispose = cleanup;
      })
      .catch((error) => {
        if (!stopped) setError(errorText(error));
      });
    return () => {
      stopped = true;
      alive.current = false;
      epoch.current++;
      dispose?.();
    };
  }, [reload]);
  async function update(card: Card) {
    try {
      await saveCard(card);
      await reload();
    } catch (error) {
      setError(errorText(error));
    }
  }
  return { cards, loading, error, reload, update };
}
