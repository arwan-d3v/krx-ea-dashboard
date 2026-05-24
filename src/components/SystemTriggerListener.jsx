"use client";

// ============================================================================
// SYSTEM TRIGGER LISTENER - Firebase Real-time Bridge
// ============================================================================
// Fungsi: Mendeteksi trigger yang di-set oleh VPS Python Bot di Firebase
// Realtime Database path "system_triggers/*", lalu memproses notifikasi
// Telegram berdasarkan tipe trigger.
//
// Arsitektur:
//   VPS Bot (Python) -> set trigger di Firebase -> Listener ini detect ->
//   fetch API route -> Telegram Bot mengirim pesan
// ============================================================================

import { useEffect, useRef } from "react";
import { ref, onValue, off } from "firebase/database";
import { db } from "../lib/firebase";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export default function SystemTriggerListener() {
  const processedRef = useRef(new Set());

  useEffect(() => {
    const triggersRef = ref(db, "system_triggers");

    const unsubscribe = onValue(triggersRef, async (snapshot) => {
      const triggers = snapshot.val();
      if (!triggers) return;

      for (const [triggerName, triggerData] of Object.entries(triggers)) {
        if (!triggerData || !triggerData.fired) continue;

        // Deduplication: skip if already processed
        const dedupKey = `${triggerName}_${triggerData.timestamp}`;
        if (processedRef.current.has(dedupKey)) continue;

        // Mark as processing
        processedRef.current.add(dedupKey);

        console.log(
          `[SystemTriggerListener] Trigger detected: ${triggerName}`,
          triggerData
        );

        try {
          // Call internal API route to process and send Telegram notification
          const response = await fetch(`${BASE_URL}/api/telegram/notify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              trigger: triggerName,
              timestamp: triggerData.timestamp,
              gmt8_time: triggerData.gmt8_time,
              payload: triggerData.payload || null,
            }),
          });

          if (!response.ok) {
            console.error(
              `[SystemTriggerListener] Failed to process ${triggerName}:`,
              response.statusText
            );
          } else {
            const result = await response.json();
            console.log(
              `[SystemTriggerListener] ${triggerName} processed:`,
              result
            );

            // Cleanup old dedup keys (keep last 100)
            if (processedRef.current.size > 100) {
              const keys = Array.from(processedRef.current);
              keys.slice(0, keys.length - 50).forEach((k) =>
                processedRef.current.delete(k)
              );
            }
          }
        } catch (error) {
          console.error(
            `[SystemTriggerListener] Error processing ${triggerName}:`,
            error
          );
          // Remove from processed set on error so it can retry
          processedRef.current.delete(dedupKey);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // This component renders nothing — it's purely a background listener
  return null;
}