import type { UserProfile } from "../../features/users/types";
import { CustomizeProfile } from "./CustomizeProfile";

export function ProfileSection({ profile }: { profile: UserProfile }) {
  return <CustomizeProfile key={JSON.stringify([profile.profile_settings, profile.pronouns, profile.custom_status, profile.about, profile.status])} profile={profile} />;
}
