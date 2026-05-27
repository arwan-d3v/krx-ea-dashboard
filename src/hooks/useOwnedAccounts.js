"use client";
import { useMemo } from "react";
import { useFirebaseData } from "./useFirebaseData";

/**
 * Hook untuk mendapatkan daftar akun yang dimiliki user berdasarkan role
 * @param {Object} user - User object dari AuthContext
 * @param {string} role - Role user (super_admin, admin, investor)
 * @returns {{ ownedAccounts, loading, accountData }}
 */
export function useOwnedAccounts(user, role) {
  // Load user profile
  const { data: userData, loading: userLoading } = useFirebaseData(
    user ? `users/${user.uid}` : null
  );

  // Load all account data
  const { data: accountData, loading: accountLoading } = useFirebaseData(
    "account_data"
  );

  // Load groups data (for admin)
  const { data: groupsData, loading: groupsLoading } = useFirebaseData("groups");

  const loading = userLoading || accountLoading || groupsLoading;

  const ownedAccounts = useMemo(() => {
    if (!accountData) return [];

    // super_admin: all accounts
    if (role === "super_admin") {
      return Object.keys(accountData).sort();
    }

    // admin: accounts from managed_groups
    if (role === "admin") {
      const managed = userData?.managed_groups || {};
      const allowed = new Set();
      Object.keys(managed)
        .filter((k) => managed[k])
        .forEach((groupId) => {
          const g = groupsData?.[groupId];
          if (g?.accounts) Object.keys(g.accounts).forEach((acc) => allowed.add(acc));
        });
      return [...allowed].filter((acc) => accountData[acc]).sort();
    }

    // investor: owned_accounts or subscriptions
    if (role === "investor") {
      const owned = userData?.owned_accounts || {};
      const fromOwned = Object.keys(owned).filter(
        (k) => owned[k] && accountData[k]
      );
      if (fromOwned.length > 0) return fromOwned.sort();

      // Fallback: dari subscriptions (struktur lama)
      const subs = userData?.subscriptions || {};
      const fromSubs = [];
      Object.entries(subs).forEach(([vpsKey, vpsData]) => {
        Object.entries(vpsData.accounts || {}).forEach(([accNum]) => {
          if (accountData[accNum]) fromSubs.push(accNum);
        });
      });
      return fromSubs.sort();
    }

    return [];
  }, [userData, accountData, groupsData, role]);

  return { ownedAccounts, loading, accountData };
}