import { useEffect } from "react";
import { rememberActiveAccount } from "../../services/accounts";
import { useMyProfile } from "./hooks";

/** Keeps the saved account list current with whoever is signed in. */
export function useRememberAccount(): void {
  const { data: me } = useMyProfile();
  const username = me?.username;
  const avatar = me?.avatar_url;
  useEffect(() => {
    if (username) void rememberActiveAccount({ username, avatar_url: avatar });
  }, [username, avatar]);
}
